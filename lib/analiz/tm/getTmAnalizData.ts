// lib/analiz/tm/getTmAnalizData.ts
//
// TM rolü için analiz verilerini çeken katman.
// TM yalnızca tüketim görür (üretici değil).
// Takım sabit, kalan filtreler: bolge_id, urun_id, utt_id, egitim_turu, tarih.

import { createClient } from "@/lib/supabase/server";
import type { TuketimMetrikleri } from "@/lib/analiz/yonetici/getYoneticiAnalizData";

export type TmFiltreleri = {
  baslangic?: string | null;
  bitis?: string | null;
  urun_id?: string | null;
  egitim_turu?: string | null;
  bolge_id?: string | null;
  utt_id?: string | null;
};

export type TmKapsam = {
  takim_id: string;
  takim_adi: string;
  bolgeler: { bolge_id: string; bolge_adi: string }[];
  urunler: { urun_id: string; urun_adi: string }[];
  utt_listesi: {
    kullanici_id: string;
    ad: string;
    soyad: string;
    rol: string;
    bolge_id: string | null;
  }[];
  egitim_turleri: string[];
};

export async function getTmAnalizData(
  kullanici_id: string,
  filtreler: TmFiltreleri
): Promise<TuketimMetrikleri> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_analiz_tm_tuketim", {
    p_kullanici_id: kullanici_id,
    p_baslangic: filtreler.baslangic ?? null,
    p_bitis: filtreler.bitis ?? null,
    p_urun_id: filtreler.urun_id ?? null,
    p_egitim_turu: filtreler.egitim_turu ?? null,
    p_bolge_id: filtreler.bolge_id ?? null,
    p_utt_id: filtreler.utt_id ?? null,
  });

  if (error) {
    throw new Error(`TM tüketim RPC hatası: ${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : data;
  return row as TuketimMetrikleri;
}

export async function getTmKapsam(kullanici_id: string): Promise<TmKapsam> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_analiz_tm_kapsam", {
    p_kullanici_id: kullanici_id,
  });

  if (error) {
    throw new Error(`TM kapsam RPC hatası: ${error.message}`);
  }

  return data as TmKapsam;
}