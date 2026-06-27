// lib/analiz/yonetici/getYoneticiAnalizData.ts
//
// Yönetici rolü için analiz verilerini çeken katman.
// 3 RPC paralel çağrılır: tüketim, üretim, kapsam.
// Sayfa filtrelerini RPC parametrelerine geçirir.

import { createClient } from "@/lib/supabase/server";

export type AnalizFiltreleri = {
  baslangic?: string | null;
  bitis?: string | null;
  urun_id?: string | null;
  egitim_turu?: string | null;
  takim_id?: string | null;
  bolge_id?: string | null;
  utt_id?: string | null;
};

export type TuketimMetrikleri = {
  izlenen_video_sayisi: number;
  kazanilan_izleme_puani: number;
  cevaplanan_soru_sayisi: number;
  kazanilan_cevaplama_puani: number;
  onerilen_video_sayisi: number;
  kazanilan_oneri_izleme_puani: number;
  extra_izleme_olan_video_sayisi: number;
  kazanilan_extra_izleme_puani: number;
  izlenmeyen_video_sayisi: number;
  kaybedilen_video_puani: number;
  yanlis_cevaplanan_soru_sayisi: number;
  kaybedilen_cevaplama_puani: number;
  izlenmeyen_oneri_video_sayisi: number;
  kaybedilen_oneri_video_puani: number;
  ileri_sarilan_video_sayisi: number;
  kaybedilen_ileri_sarma_puani: number;
  kazanilan_toplam_puan: number;
  kaybedilen_toplam_puan: number;
  net_puan: number;
};

export type UretimMetrikleri = {
  urun_sayisi: number;
  video_sayisi: number;
  soru_sayisi: number;
  ileri_sarma_izinli_video_sayisi: number;
  potansiyel_video_izleme_puani: number;
  potansiyel_dogru_cevap_puani: number;
};

export type KapsamItem = {
  takim_id?: string | null;
  takim_adi?: string;
  bolge_id?: string;
  bolge_adi?: string;
  urun_id?: string;
  urun_adi?: string;
  kullanici_id?: string;
  ad?: string;
  soyad?: string;
  rol?: string;
};

export type Kapsam = {
  takimlar: { takim_id: string; takim_adi: string }[];
  bolgeler: { bolge_id: string; bolge_adi: string; takim_id: string }[];
  urunler: { urun_id: string; urun_adi: string; takim_id: string | null }[];
  utt_listesi: {
    kullanici_id: string;
    ad: string;
    soyad: string;
    rol: string;
    takim_id: string | null;
    bolge_id: string | null;
  }[];
  egitim_turleri: string[];
};

export type YoneticiAnalizData = {
  tuketim: TuketimMetrikleri;
  uretim: UretimMetrikleri;
};

export async function getYoneticiAnalizData(
  kullanici_id: string,
  filtreler: AnalizFiltreleri
): Promise<YoneticiAnalizData> {
  const supabase = await createClient();

  const tuketimPromise = supabase.rpc("get_analiz_yonetici_tuketim", {
    p_kullanici_id: kullanici_id,
    p_baslangic: filtreler.baslangic ?? null,
    p_bitis: filtreler.bitis ?? null,
    p_urun_id: filtreler.urun_id ?? null,
    p_egitim_turu: filtreler.egitim_turu ?? null,
    p_takim_id: filtreler.takim_id ?? null,
    p_bolge_id: filtreler.bolge_id ?? null,
    p_utt_id: filtreler.utt_id ?? null,
  });

  const uretimPromise = supabase.rpc("get_analiz_yonetici_uretim", {
    p_kullanici_id: kullanici_id,
    p_baslangic: filtreler.baslangic ?? null,
    p_bitis: filtreler.bitis ?? null,
    p_urun_id: filtreler.urun_id ?? null,
    p_egitim_turu: filtreler.egitim_turu ?? null,
    p_takim_id: filtreler.takim_id ?? null,
  });

  const [tuketimRes, uretimRes] = await Promise.all([tuketimPromise, uretimPromise]);

  if (tuketimRes.error) {
    throw new Error(`Tüketim RPC hatası: ${tuketimRes.error.message}`);
  }
  if (uretimRes.error) {
    throw new Error(`Üretim RPC hatası: ${uretimRes.error.message}`);
  }

  const tuketimRow = Array.isArray(tuketimRes.data) ? tuketimRes.data[0] : tuketimRes.data;
  const uretimRow = Array.isArray(uretimRes.data) ? uretimRes.data[0] : uretimRes.data;

  return {
    tuketim: tuketimRow as TuketimMetrikleri,
    uretim: uretimRow as UretimMetrikleri,
  };
}

export async function getYoneticiKapsam(kullanici_id: string): Promise<Kapsam> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_analiz_yonetici_kapsam", {
    p_kullanici_id: kullanici_id,
  });

  if (error) {
    throw new Error(`Kapsam RPC hatası: ${error.message}`);
  }

  return data as Kapsam;
}