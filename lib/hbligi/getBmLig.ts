// lib/hbligi/getBmLig.ts
//
// BM rolü için HBLigi verisi.
// Kendi bölgesindeki UTT sıralaması + takımındaki tüm bölgelerin toplam puan sıralaması.

import type { SupabaseClient } from "@supabase/supabase-js";
import { toplamPuanGrupla, sirayaKoy } from "./agregasyonlar";

export interface BmLigUttSatiri {
  sira: number;
  kullanici_id: string;
  ad: string;
  rol: string;
  bolge: string;
  izleme_puani: number;
  cevaplama_puani: number;
  oneri_puani: number;
  extra_puani: number;
  toplam_puan: number;
}

export interface BmBolgeSiraSatiri {
  bolge_id: string;
  bolge_adi: string;
  toplam_puan: number;
  sira: number;
}

export interface BmLigSonuc {
  tip: "bm";
  bolge_utt: BmLigUttSatiri[];
  takim_bolge_siralaması: BmBolgeSiraSatiri[];
}

/**
 * BM için iki veri seti döner:
 * 1. Kendi bölgesindeki UTT sıralaması (bireysel)
 * 2. Takımındaki tüm bölgelerin toplam puana göre sıralaması
 *
 * @param supabase Admin client
 * @param bolge_id BM'nin bağlı olduğu bölge
 * @param takim_id BM'nin bağlı olduğu takım
 */
export async function getBmLig(
  supabase: SupabaseClient,
  bolge_id: string,
  takim_id: string
): Promise<BmLigSonuc> {
  // Kendi bölgesindeki UTT'ler
  const { data: bolgeUttler, error: uttError } = await supabase
    .from("v_hbligi_sirali")
    .select(
      "kullanici_id, rol, ad, soyad, bolge_id, bolge_adi, toplam_puan, bolge_sirasi, izleme_puani, cevaplama_puani, oneri_puani, extra_puani"
    )
    .in("rol", ["utt", "kd_utt"])
    .eq("bolge_id", bolge_id)
    .order("toplam_puan", { ascending: false });

  if (uttError) {
    throw new Error(`v_hbligi_sirali SELECT — BM UTT: ${uttError.message}`);
  }

  // Takımındaki tüm bölgelerin UTT puanları — bölge toplamı için
  const { data: takimUttler, error: takimError } = await supabase
    .from("v_hbligi_sirali")
    .select("bolge_id, bolge_adi, toplam_puan")
    .in("rol", ["utt", "kd_utt"])
    .eq("takim_id", takim_id);

  if (takimError) {
    throw new Error(`v_hbligi_sirali SELECT — BM takım: ${takimError.message}`);
  }

  // Bölge toplamlarını hesapla + sıraya koy
  const bolgeGrup = toplamPuanGrupla(takimUttler ?? [], "bolge_id", "bolge_adi");
  const takim_bolge_siralaması = sirayaKoy(bolgeGrup, "bolge_id", "bolge_adi") as BmBolgeSiraSatiri[];

  // UTT satırlarını formatla
  const bolge_utt: BmLigUttSatiri[] = (bolgeUttler ?? []).map((l: any) => ({
    sira: l.bolge_sirasi,
    kullanici_id: l.kullanici_id,
    ad: `${l.ad} ${l.soyad}`,
    rol: l.rol,
    bolge: l.bolge_adi ?? "-",
    izleme_puani: l.izleme_puani,
    cevaplama_puani: l.cevaplama_puani,
    oneri_puani: l.oneri_puani,
    extra_puani: l.extra_puani,
    toplam_puan: l.toplam_puan,
  }));

  return {
    tip: "bm",
    bolge_utt,
    takim_bolge_siralaması,
  };
}