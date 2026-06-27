// lib/oneri/limitKontrol.ts
//
// Öneri kota ve limit kontrolleri.
//
// Kurallar:
// 1. UTT haftalık limit: Bir UTT haftada en fazla MAKS_ALICI_HAFTA öneri alabilir.
// 2. BM aylık kota: Bir BM ay içinde toplam (kendi UTT sayısı × AYLIK_KOTA_KATSAYI) öneri gönderebilir.
//
// Ay tanımı: Takvim ayı (1-30/31). Ay başında kota sıfırlanır.
// Hafta tanımı: Pazartesi 00:00 → Pazar 23:59 (lib/zaman/kontrol.ts ile uyumlu).

import type { SupabaseClient } from "@supabase/supabase-js";
import { haftaBaslangici, ayBaslangici } from "@/lib/zaman/kontrol";

/** Bir alıcı UTT için haftalık öneri üst sınırı */
export const MAKS_ALICI_HAFTA = 3;

/** BM aylık kota katsayısı: UTT başına ay içinde gönderilebilecek max öneri sayısı */
export const AYLIK_KOTA_KATSAYI = 12;

export interface HaftalikLimitSonuc {
  hepsi_geciyor: boolean;
  asan_aliciler: {
    kullanici_id: string;
    mevcut: number;
    istenen: number;
  }[];
}

export interface AylikKotaSonuc {
  geciyor: boolean;
  mevcut: number;
  istenen: number;
  kota: number;
  utt_sayisi: number;
}

/**
 * Verilen öneren için, istek içindeki her alıcıya bu hafta kaç öneri olduğunu sayar,
 * mevcut haftalık öneriyi DB'den çeker, alıcı bazında limit kontrolü yapar.
 *
 * @param supabase Admin client
 * @param oneren_id Öneriyi gönderen BM'nin ID'si
 * @param istek_alicilari Bu POST isteğindeki öneriler için alıcı ID'leri (tekrar edebilir)
 */
export async function haftalikLimitKontrol(
  supabase: SupabaseClient,
  oneren_id: string,
  istek_alicilari: string[]
): Promise<HaftalikLimitSonuc> {
  const istek_sayim: Record<string, number> = {};
  for (const aliciId of istek_alicilari) {
    istek_sayim[aliciId] = (istek_sayim[aliciId] ?? 0) + 1;
  }

  const benzersiz_aliciler = Object.keys(istek_sayim);
  if (benzersiz_aliciler.length === 0) {
    return { hepsi_geciyor: true, asan_aliciler: [] };
  }

  const hafta_basi = haftaBaslangici(new Date());

  const { data: mevcutOneriler, error } = await supabase
    .from("oneri_kayitlari")
    .select("kullanici_id")
    .eq("oneren_id", oneren_id)
    .in("kullanici_id", benzersiz_aliciler)
    .gte("created_at", hafta_basi.toISOString());

  if (error) {
    throw new Error(`oneri_kayitlari SELECT — haftalık limit: ${error.message}`);
  }

  const mevcut_sayim: Record<string, number> = {};
  for (const row of mevcutOneriler ?? []) {
    mevcut_sayim[row.kullanici_id] = (mevcut_sayim[row.kullanici_id] ?? 0) + 1;
  }

  const asan_aliciler: HaftalikLimitSonuc["asan_aliciler"] = [];
  for (const aliciId of benzersiz_aliciler) {
    const mevcut = mevcut_sayim[aliciId] ?? 0;
    const istenen = istek_sayim[aliciId];
    if (mevcut + istenen > MAKS_ALICI_HAFTA) {
      asan_aliciler.push({
        kullanici_id: aliciId,
        mevcut,
        istenen,
      });
    }
  }

  return {
    hepsi_geciyor: asan_aliciler.length === 0,
    asan_aliciler,
  };
}

/**
 * BM'nin aylık kota kontrolü.
 *
 * Kota = BM'nin bölgesindeki UTT sayısı × AYLIK_KOTA_KATSAYI.
 * Mevcut = BM'nin bu ay içinde gönderdiği öneri toplamı.
 *
 * @param supabase Admin client
 * @param oneren_id BM'nin ID'si
 * @param istek_sayisi Bu POST isteğindeki toplam öneri sayısı
 * @param bolge_id BM'nin bölgesi (UTT sayımı için)
 */
export async function aylikKotaKontrol(
  supabase: SupabaseClient,
  oneren_id: string,
  istek_sayisi: number,
  bolge_id: string
): Promise<AylikKotaSonuc> {
  // BM'nin bölgesindeki aktif UTT sayısı
  const { count: utt_sayisi, error: uttError } = await supabase
    .from("kullanicilar")
    .select("kullanici_id", { count: "exact", head: true })
    .eq("bolge_id", bolge_id)
    .in("rol", ["utt", "kd_utt"])
    .eq("aktif_mi", true);

  if (uttError) {
    throw new Error(`kullanicilar SELECT — UTT sayımı: ${uttError.message}`);
  }

  const utt_sayisi_kesin = utt_sayisi ?? 0;
  const kota = utt_sayisi_kesin * AYLIK_KOTA_KATSAYI;

  // Ay başından beri gönderilen öneri sayısı
  const ay_basi = ayBaslangici();

  const { count: mevcut, error: mevcutError } = await supabase
    .from("oneri_kayitlari")
    .select("oneri_id", { count: "exact", head: true })
    .eq("oneren_id", oneren_id)
    .gte("created_at", ay_basi.toISOString());

  if (mevcutError) {
    throw new Error(`oneri_kayitlari SELECT — aylık kota: ${mevcutError.message}`);
  }

  const mevcut_kesin = mevcut ?? 0;

  return {
    geciyor: mevcut_kesin + istek_sayisi <= kota,
    mevcut: mevcut_kesin,
    istenen: istek_sayisi,
    kota,
    utt_sayisi: utt_sayisi_kesin,
  };
}