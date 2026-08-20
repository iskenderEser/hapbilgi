// Müşterinin KENDİ hesabını silmesinin tek uygulama kapısı.
// Uygulama tabloları ve auth.users kimliği DB'deki tek RPC transaction'ında
// silinir. Eczacının listeden silme/günlük akışından tamamen ayrıdır.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface MusteriTamSilmeSonucu {
  ok: boolean;
  hata?: string;
}

interface KimlikSatiri {
  musteri_id: string;
  auth_user_id: string;
}

export async function musteriTamSil(
  adminSupabase: SupabaseClient,
  kimlik: KimlikSatiri,
): Promise<MusteriTamSilmeSonucu> {
  const { data, error } = await adminSupabase.rpc("eczanem_musteri_kendini_tam_sil", {
    p_musteri_id: kimlik.musteri_id,
    p_auth_user_id: kimlik.auth_user_id,
  });

  if (error) {
    console.error("[lib/eczanem/silme] Atomik tam silme hatası:", {
      musteri_id: kimlik.musteri_id,
      kod: error.code,
      hata: error.message,
    });
    return { ok: false, hata: error.message || "Hesap silinemedi." };
  }
  if (data !== true) return { ok: false, hata: "Hesap silme işlemi doğrulanamadı." };
  return { ok: true };
}
