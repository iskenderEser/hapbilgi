// HBStore firma-ürün görünürlüğünün tek kaynağı.
//
// Katalog globaldir. Bir firma için ayrıca kayıt yoksa ürün görünür; yalnızca
// açıkça kapatılan ürünler o firmanın vitrininden çıkar. Global ürün pasifliği
// her zaman üstündür.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface HbstoreFirmaBaglami {
  firmaId: string | null;
  hbstoreAktif: boolean;
  hata: unknown | null;
}

export function firmaIcinUrunAktifMi(
  urunGlobalAktif: boolean,
  firmaAyari: boolean | null | undefined,
): boolean {
  return urunGlobalAktif && firmaAyari !== false;
}

export async function hbstoreFirmaBaglami(
  supabase: SupabaseClient,
  kullaniciId: string,
): Promise<HbstoreFirmaBaglami> {
  const { data: kullanici, error: kullaniciError } = await supabase
    .from("kullanicilar")
    .select("firma_id")
    .eq("kullanici_id", kullaniciId)
    .maybeSingle();

  if (kullaniciError || !kullanici?.firma_id) {
    return { firmaId: null, hbstoreAktif: false, hata: kullaniciError };
  }

  const { data: firma, error: firmaError } = await supabase
    .from("firmalar")
    .select("hbstore_aktif")
    .eq("firma_id", kullanici.firma_id)
    .maybeSingle();

  return {
    firmaId: kullanici.firma_id,
    hbstoreAktif: firma?.hbstore_aktif === true,
    hata: firmaError,
  };
}

export async function firmaKapaliUrunIdleri(
  supabase: SupabaseClient,
  firmaId: string,
  urunIdleri?: string[],
): Promise<{ kapaliUrunIdleri: Set<string>; hata: unknown | null }> {
  let sorgu = supabase
    .from("store_urun_firma_ayarlari")
    .select("urun_id")
    .eq("firma_id", firmaId)
    .eq("aktif_mi", false);

  if (urunIdleri) {
    if (urunIdleri.length === 0) {
      return { kapaliUrunIdleri: new Set<string>(), hata: null };
    }
    sorgu = sorgu.in("urun_id", urunIdleri);
  }

  const { data, error } = await sorgu;
  return {
    kapaliUrunIdleri: new Set((data ?? []).map((satir) => satir.urun_id)),
    hata: error,
  };
}
