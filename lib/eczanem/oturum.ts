// lib/eczanem/oturum.ts
// Müşteri kimlik çözümü. Müşteri de bir Supabase auth kullanıcısıdır
// (eczanem_musteriler.auth_user_id); giriş /login üzerinden e-posta/telefon +
// şifre ile yapılır (bkz. app/eczanem/api/giris/sifre). Bu modül, izleme/sipariş
// route'larının ortak girişi olan aktif müşteri çözümünü sağlar.

import { SupabaseClient } from "@supabase/supabase-js";

// auth kullanıcısından aktif müşteri kimliğini çözer (izleme/kazanım
// route'larının ortak girişi). Pasif/kayıtsız → reddedilir.
export async function musteriKimligi(
  adminSupabase: SupabaseClient,
  authUserId: string
): Promise<{ ok: boolean; musteriId?: string; hata?: string }> {
  const { data, error } = await adminSupabase
    .from("eczanem_musteriler")
    .select("musteri_id, aktif_mi")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error || !data) return { ok: false, hata: "Müşteri kaydınız bulunamadı." };
  if (!data.aktif_mi) return { ok: false, hata: "Üyeliğiniz aktif değil." };
  return { ok: true, musteriId: data.musteri_id };
}
