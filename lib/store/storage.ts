// lib/store/storage.ts
// HBStore ürün görseli yükleme/silme katmanı.
//
// Supabase Storage bucket: store-urun-gorselleri
// Public read, service_role write (RLS bypass).
//
// Dosya adı: timestamp + random + uzantı (collision riskini sıfırlamak için)
// Örnek: 1719234567890-x7k3p-kapak.jpg

import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET_ADI = "store-urun-gorselleri";

const IZINLI_MIME_TIPLERI = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

const MAKS_DOSYA_BOYUTU = 2 * 1024 * 1024; // 2 MB

// ─── 1. YÜKLE ────────────────────────────────────────────────────────────────

export interface YuklemeSonuc {
  ok: boolean;
  url?: string;
  yol?: string; // Storage içindeki yol (silme için kullanılır)
  error?: string;
}

/**
 * Görsel dosyasını Supabase Storage'a yükler.
 * Başarılıysa public URL'i döner.
 *
 * @param supabase service_role client (admin endpoint'inde createAdminClient())
 * @param dosya File veya Buffer/Uint8Array (Node.js)
 * @param mimeType "image/jpeg" gibi
 * @param dosyaAdi orijinal dosya adı (uzantı için kullanılır)
 */
export async function gorselYukle(
  supabase: SupabaseClient,
  dosya: File | Blob | ArrayBuffer | Uint8Array,
  mimeType: string,
  dosyaAdi: string
): Promise<YuklemeSonuc> {
  // 1. Mime tip kontrolü
  if (!IZINLI_MIME_TIPLERI.includes(mimeType)) {
    return {
      ok: false,
      error: `İzin verilmeyen dosya formatı. Sadece JPEG, PNG, WebP kabul edilir.`,
    };
  }

  // 2. Boyut kontrolü (File/Blob için)
  if (dosya instanceof Blob && dosya.size > MAKS_DOSYA_BOYUTU) {
    return {
      ok: false,
      error: `Dosya çok büyük. Maksimum 2 MB.`,
    };
  }

  // 3. Dosya adını oluştur (timestamp + random + uzantı)
  const uzanti = dosyaAdi.includes(".")
    ? dosyaAdi.split(".").pop()?.toLowerCase() ?? "jpg"
    : "jpg";
  const timestamp = Date.now();
  const rastgele = Math.random().toString(36).substring(2, 8);
  const yeniDosyaAdi = `${timestamp}-${rastgele}.${uzanti}`;

  // 4. Yükle
  const { data, error } = await supabase.storage
    .from(BUCKET_ADI)
    .upload(yeniDosyaAdi, dosya, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    console.error("[lib/store/storage] gorselYukle hatası:", error.message);
    return { ok: false, error: error.message };
  }

  // 5. Public URL al
  const { data: urlData } = supabase.storage
    .from(BUCKET_ADI)
    .getPublicUrl(data.path);

  return {
    ok: true,
    url: urlData.publicUrl,
    yol: data.path,
  };
}

// ─── 2. SİL ──────────────────────────────────────────────────────────────────

export interface SilmeSonuc {
  ok: boolean;
  error?: string;
}

/**
 * Storage'dan görsel siler.
 * Ürün silindiğinde veya görseli değiştirildiğinde çağrılır.
 *
 * @param yol Storage içindeki dosya yolu (örn. "1719234567890-x7k3p.jpg")
 */
export async function gorselSil(
  supabase: SupabaseClient,
  yol: string
): Promise<SilmeSonuc> {
  if (!yol) {
    return { ok: false, error: "Dosya yolu boş." };
  }

  const { error } = await supabase.storage
    .from(BUCKET_ADI)
    .remove([yol]);

  if (error) {
    console.error("[lib/store/storage] gorselSil hatası:", error.message);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

// ─── 3. URL'DEN YOL ÇIKAR ────────────────────────────────────────────────────

/**
 * Public URL'den storage yolunu çıkarır (silmek için).
 *
 * Örn URL: https://xxx.supabase.co/storage/v1/object/public/store-urun-gorselleri/1719234567890-x7k3p.jpg
 * Sonuç: 1719234567890-x7k3p.jpg
 */
export function urlDenYolCikar(url: string | null | undefined): string | null {
  if (!url) return null;
  const ayrac = `/${BUCKET_ADI}/`;
  const indeks = url.indexOf(ayrac);
  if (indeks === -1) return null;
  return url.substring(indeks + ayrac.length);
}