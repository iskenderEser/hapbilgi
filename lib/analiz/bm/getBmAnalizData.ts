// lib/analiz/bm/getBmAnalizData.ts
//
// BM rolü için analiz verilerini çeken katman.
// BM yalnızca tüketim görür (üretici değil).
// Takım + Bölge sabit, kalan filtreler: urun_id, utt_id, egitim_turu, tarih.

import { createClient } from "@/lib/supabase/server";
import type { TuketimMetrikleri } from "@/lib/analiz/yonetici/getYoneticiAnalizData";

export type BmFiltreleri = {
  baslangic?: string | null;
  bitis?: string | null;
  urun_id?: string | null;
  egitim_turu?: string | null;
  utt_id?: string | null;
};

export type BmKapsam = {
  takim_id: string;
  takim_adi: string;
  bolge_id: string;
  bolge_adi: string;
  urunler: { urun_id: string; urun_adi: string }[];
  utt_listesi: {
    kullanici_id: string;
    ad: string;
    soyad: string;
    rol: string;
  }[];
  egitim_turleri: string[];
};

export async function getBmAnalizData(
  kullanici_id: string,
  filtreler: BmFiltreleri
): Promise<TuketimMetrikleri> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_analiz_bm_tuketim", {
    p_kullanici_id: kullanici_id,
    p_baslangic: filtreler.baslangic ?? null,
    p_bitis: filtreler.bitis ?? null,
    p_urun_id: filtreler.urun_id ?? null,
    p_egitim_turu: filtreler.egitim_turu ?? null,
    p_utt_id: filtreler.utt_id ?? null,
  });

  if (error) {
    throw new Error(`BM tüketim RPC hatası: ${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : data;
  return row as TuketimMetrikleri;
}

export async function getBmKapsam(kullanici_id: string): Promise<BmKapsam> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_analiz_bm_kapsam", {
    p_kullanici_id: kullanici_id,
  });

  if (error) {
    throw new Error(`BM kapsam RPC hatası: ${error.message}`);
  }

  return data as BmKapsam;
}