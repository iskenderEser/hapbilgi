// lib/firma/logoStorage.ts
//
// Firma kurumsal logo dosyalarını Supabase Storage'a yükleme katmanı.
// SVG, PNG, WebP ve JPEG formatlarını destekler (5 MB tavan limiti).

import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET_ADI = "store-urun-gorselleri";

const IZINLI_MIME_TIPLERI = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/svg+xml",
];

const MAKS_DOSYA_BOYUTU = 5 * 1024 * 1024; // 5 MB

export interface LogoYuklemeSonuc {
  ok: boolean;
  url?: string;
  yol?: string;
  error?: string;
}

export async function firmaLogoYukle(
  supabase: SupabaseClient,
  dosya: File | Blob | ArrayBuffer | Uint8Array,
  mimeType: string,
  dosyaAdi: string
): Promise<LogoYuklemeSonuc> {
  // 1. MIME tip kontrolü
  const normalizeMime = mimeType.toLowerCase();
  const uzanti = dosyaAdi.includes(".")
    ? dosyaAdi.split(".").pop()?.toLowerCase() ?? "png"
    : "png";

  const svgMi = uzanti === "svg" || normalizeMime.includes("svg");
  if (!IZINLI_MIME_TIPLERI.includes(normalizeMime) && !svgMi) {
    return {
      ok: false,
      error: "İzin verilmeyen dosya formatı. SVG, PNG, WebP veya JPEG yükleyebilirsiniz.",
    };
  }

  // 2. Boyut kontrolü
  if (dosya instanceof Blob && dosya.size > MAKS_DOSYA_BOYUTU) {
    return {
      ok: false,
      error: "Dosya çok büyük. Maksimum 5 MB yükleyebilirsiniz.",
    };
  }

  // 3. Dosya adı oluşturma
  const timestamp = Date.now();
  const rastgele = Math.random().toString(36).substring(2, 8);
  const yeniDosyaAdi = `firma-logolar/${timestamp}-${rastgele}.${uzanti}`;

  // 4. Supabase Storage yüklemesi
  const { data, error } = await supabase.storage
    .from(BUCKET_ADI)
    .upload(yeniDosyaAdi, dosya, {
      contentType: svgMi ? "image/svg+xml" : normalizeMime,
      upsert: false,
    });

  if (error) {
    console.error("[lib/firma/logoStorage] firmaLogoYukle hatası:", error.message);
    return { ok: false, error: error.message };
  }

  // 5. Genel erişim bağlantısı (Public URL)
  const { data: urlData } = supabase.storage
    .from(BUCKET_ADI)
    .getPublicUrl(data.path);

  return {
    ok: true,
    url: urlData.publicUrl,
    yol: data.path,
  };
}
