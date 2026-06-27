// lib/analiz/uretici/getUreticiAnalizData.ts
//
// Üretici rolü (PM/egt_*/med_md) için analiz verilerini çeken katman.
// 3 RPC paralel çağrılır: tüketim, üretim, kapsam.
// Takım-bağlı vs takım-bağımsız üretici ayrımı RPC içinde yapılır,
// frontend için tek arayüz.

import { createClient } from "@/lib/supabase/server";
import type {
  AnalizFiltreleri,
  TuketimMetrikleri,
  UretimMetrikleri,
} from "@/lib/analiz/yonetici/getYoneticiAnalizData";

export type UreticiKapsam = {
  takim_bagi: boolean;
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

export type UreticiAnalizData = {
  tuketim: TuketimMetrikleri;
  uretim: UretimMetrikleri;
};

export async function getUreticiAnalizData(
  kullanici_id: string,
  filtreler: AnalizFiltreleri
): Promise<UreticiAnalizData> {
  const supabase = await createClient();

  const tuketimPromise = supabase.rpc("get_analiz_uretici_tuketim", {
    p_kullanici_id: kullanici_id,
    p_baslangic: filtreler.baslangic ?? null,
    p_bitis: filtreler.bitis ?? null,
    p_urun_id: filtreler.urun_id ?? null,
    p_egitim_turu: filtreler.egitim_turu ?? null,
    p_takim_id: filtreler.takim_id ?? null,
    p_bolge_id: filtreler.bolge_id ?? null,
    p_utt_id: filtreler.utt_id ?? null,
  });

  const uretimPromise = supabase.rpc("get_analiz_uretici_uretim", {
    p_kullanici_id: kullanici_id,
    p_baslangic: filtreler.baslangic ?? null,
    p_bitis: filtreler.bitis ?? null,
    p_urun_id: filtreler.urun_id ?? null,
    p_egitim_turu: filtreler.egitim_turu ?? null,
  });

  const [tuketimRes, uretimRes] = await Promise.all([tuketimPromise, uretimPromise]);

  if (tuketimRes.error) {
    throw new Error(`Üretici tüketim RPC hatası: ${tuketimRes.error.message}`);
  }
  if (uretimRes.error) {
    throw new Error(`Üretici üretim RPC hatası: ${uretimRes.error.message}`);
  }

  const tuketimRow = Array.isArray(tuketimRes.data) ? tuketimRes.data[0] : tuketimRes.data;
  const uretimRow = Array.isArray(uretimRes.data) ? uretimRes.data[0] : uretimRes.data;

  return {
    tuketim: tuketimRow as TuketimMetrikleri,
    uretim: uretimRow as UretimMetrikleri,
  };
}

export async function getUreticiKapsam(kullanici_id: string): Promise<UreticiKapsam> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_analiz_uretici_kapsam", {
    p_kullanici_id: kullanici_id,
  });

  if (error) {
    throw new Error(`Üretici kapsam RPC hatası: ${error.message}`);
  }

  return data as UreticiKapsam;
}