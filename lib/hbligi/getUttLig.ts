// lib/hbligi/getUttLig.ts
//
// UTT/KD_UTT rolü için HBLigi verisi.
// Kullanıcının kendi bölgesindeki UTT'leri toplam puana göre sıralı döner.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface UttLigSatiri {
  sira: number;
  kullanici_id: string;
  ad: string;
  rol: string;
  bolge: string;
  takim: string;
  izleme_puani: number;
  cevaplama_puani: number;
  oneri_puani: number;
  extra_puani: number;
  toplam_puan: number;
  benim: boolean;
}

export interface UttLigSonuc {
  tip: "utt";
  lig: UttLigSatiri[];
}

/**
 * UTT/KD_UTT için kendi bölgesindeki UTT lig sıralamasını döner.
 *
 * @param supabase Admin client
 * @param kullanici_id Giriş yapan kullanıcının ID'si
 * @param bolge_id Kullanıcının bölgesi
 * @throws Hata mesajı string olarak fırlatır; çağıran endpoint hataYaniti ile sarar
 */
export async function getUttLig(
  supabase: SupabaseClient,
  kullanici_id: string,
  bolge_id: string
): Promise<UttLigSonuc> {
  const { data, error } = await supabase
    .from("v_hbligi_sirali")
    .select(
      "kullanici_id, rol, ad, soyad, bolge_id, bolge_adi, takim_id, takim_adi, firma_id, firma_adi, izleme_puani, cevaplama_puani, oneri_puani, extra_puani, toplam_puan, firma_sirasi, bolge_sirasi, takim_sirasi"
    )
    .in("rol", ["utt", "kd_utt"])
    .eq("bolge_id", bolge_id)
    .order("toplam_puan", { ascending: false });

  if (error) {
    throw new Error(`v_hbligi_sirali SELECT — UTT: ${error.message}`);
  }

  const lig: UttLigSatiri[] = (data ?? []).map((l: any) => ({
    sira: l.bolge_sirasi,
    kullanici_id: l.kullanici_id,
    ad: `${l.ad} ${l.soyad}`,
    rol: l.rol,
    bolge: l.bolge_adi ?? "-",
    takim: l.takim_adi ?? "-",
    izleme_puani: l.izleme_puani,
    cevaplama_puani: l.cevaplama_puani,
    oneri_puani: l.oneri_puani,
    extra_puani: l.extra_puani,
    toplam_puan: l.toplam_puan,
    benim: l.kullanici_id === kullanici_id,
  }));

  return { tip: "utt", lig };
}