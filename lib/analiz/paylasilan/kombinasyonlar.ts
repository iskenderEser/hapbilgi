// lib/analiz/paylasilan/kombinasyonlar.ts
//
// Pill seçimini DB'deki kombinasyon kaydına eşler.
// 4 analiz tablosu paylaşımlıdır (rol bağımsız):
//   - analiz_uretim_degiskenleri      (6 satır)
//   - analiz_uretim_kombinasyonlari   (27 satır)
//   - analiz_tuketim_degiskenleri     (19 satır)
//   - analiz_tuketim_kombinasyonlari  (699 satır)
//
// Kombinasyon arama alfabetik sıralı degisken_idleri[] üzerinden yapılır.

import { createClient } from "@/lib/supabase/server";

export type Kategori = "uretim" | "tuketim";

export type Degisken = {
  degisken_id: string;
  ad: string;
  sira: number;
  alt_kategori?: "kazanim" | "kayip" | "turev" | null;
  kombinasyon_havuzunda?: boolean | null;
};

export type Kombinasyon = {
  id: number;
  boyut: number;
  degisken_idleri: string[];
  tanim: string;
  tamamlayici_mi: boolean;
};

export async function getDegiskenler(kategori: Kategori): Promise<Degisken[]> {
  const supabase = await createClient();
  const tablo =
    kategori === "uretim"
      ? "analiz_uretim_degiskenleri"
      : "analiz_tuketim_degiskenleri";

  const { data, error } = await supabase
    .from(tablo)
    .select("*")
    .order("sira", { ascending: true });

  if (error) {
    throw new Error(`${tablo} sorgu hatası: ${error.message}`);
  }
  return (data ?? []) as Degisken[];
}

/**
 * Seçilen pill'lerin tanımını ve tamamlayıcı bilgisini DB'den çeker.
 * degisken_idleri alfabetik sıralanmalıdır (DB lookup için).
 *
 * PostgreSQL text[] kolonla eşleşme için `contains` + `containedBy`
 * kombinasyonu kullanılır (yalnızca aynı elemanlardan oluşan, aynı uzunlukta dizi).
 */
export async function getKombinasyon(
  kategori: Kategori,
  degisken_idleri: string[]
): Promise<Kombinasyon | null> {
  if (degisken_idleri.length === 0) return null;

  const supabase = await createClient();
  const tablo =
    kategori === "uretim"
      ? "analiz_uretim_kombinasyonlari"
      : "analiz_tuketim_kombinasyonlari";

  const sirali = [...degisken_idleri].sort();

  const { data, error } = await supabase
    .from(tablo)
    .select("*")
    .eq("boyut", sirali.length)
    .contains("degisken_idleri", sirali)
    .containedBy("degisken_idleri", sirali)
    .maybeSingle();

  if (error) {
    throw new Error(`${tablo} sorgu hatası: ${error.message}`);
  }
  return data as Kombinasyon | null;
}

/**
 * Verilen kategori için seçili pill'lerin adını getirir.
 * AI promptu için degisken adlarını çözmek üzere kullanılır.
 */
export async function getDegiskenAdlari(
  kategori: Kategori,
  degisken_idleri: string[]
): Promise<Record<string, string>> {
  if (degisken_idleri.length === 0) return {};

  const supabase = await createClient();
  const tablo =
    kategori === "uretim"
      ? "analiz_uretim_degiskenleri"
      : "analiz_tuketim_degiskenleri";

  const { data, error } = await supabase
    .from(tablo)
    .select("degisken_id, ad")
    .in("degisken_id", degisken_idleri);

  if (error) {
    throw new Error(`${tablo} sorgu hatası: ${error.message}`);
  }

  const harita: Record<string, string> = {};
  for (const row of data ?? []) {
    harita[row.degisken_id] = row.ad;
  }
  return harita;
}

export function degiskenIdleriSirali(idler: string[]): string[] {
  return [...idler].sort();
}