// lib/eclub/store/eclubStoreStorage.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EclubStoreGorselSonuc } from "./eclubStoreTipler";

const BUCKET = "eclub-store-urun-gorselleri";
const IZINLI_TIPLER = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_BOYUT = 5 * 1024 * 1024;

export async function eclubStoreGorselYukle(
  supabase: SupabaseClient,
  dosya: File,
  mimeType: string,
  orijinalAd: string
): Promise<EclubStoreGorselSonuc> {
  if (!IZINLI_TIPLER.includes(mimeType.toLowerCase())) {
    return { ok: false, error: "Yalnız JPEG, PNG veya WEBP görsel yüklenebilir." };
  }
  if (dosya.size > MAX_BOYUT) {
    return { ok: false, error: "Görsel en fazla 5 MB olabilir." };
  }

  const uzanti = orijinalAd.split(".").pop()?.toLowerCase() ?? "jpg";
  const ad = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${uzanti}`;
  const yol = ad;

  const buffer = Buffer.from(await dosya.arrayBuffer());

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(yol, buffer, { contentType: mimeType, upsert: false });

  if (error) {
    console.error("[lib/eclub/store/storage] eclubStoreGorselYukle hatası:", error.message);
    return { ok: false, error: "Görsel yüklenemedi." };
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(yol);
  return { ok: true, url: data.publicUrl, yol };
}

export async function eclubStoreGorselSil(
  supabase: SupabaseClient,
  yol: string
): Promise<boolean> {
  const { error } = await supabase.storage.from(BUCKET).remove([yol]);
  if (error) {
    console.error("[lib/eclub/store/storage] eclubStoreGorselSil hatası:", error.message);
    return false;
  }
  return true;
}