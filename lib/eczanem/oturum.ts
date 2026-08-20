// lib/eczanem/oturum.ts
// Müşteri kimlik çözümü. Müşteri de bir Supabase auth kullanıcısıdır
// (eczanem_musteriler.auth_user_id); giriş /login üzerinden e-posta/telefon +
// şifre ile yapılır (bkz. app/eczanem/api/giris/sifre). Bu modül, izleme/sipariş
// route'larının ortak girişi olan aktif müşteri çözümünü sağlar.

import { SupabaseClient } from "@supabase/supabase-js";
import { ECZANEM_KAPALI_MESAJI, musteriEczanemErisimi } from "@/lib/eczanem/erisim";

// auth kullanıcısından aktif müşteri kimliğini çözer (izleme/kazanım
// route'larının ortak girişi). Pasif/kayıtsız → reddedilir.
export async function musteriKimligi(
  adminSupabase: SupabaseClient,
  authUserId: string
): Promise<{ ok: boolean; musteriId?: string; firmaIdler?: string[]; eczaneIdler?: string[]; hata?: string }> {
  const erisim = await musteriEczanemErisimi(adminSupabase, authUserId);
  if (!erisim.ok) return { ok: false, hata: erisim.hata ?? "Müşteri erişimi doğrulanamadı." };
  if (!erisim.musteriId) return { ok: false, hata: "Müşteri kaydınız bulunamadı." };
  if (!erisim.acik) return { ok: false, hata: ECZANEM_KAPALI_MESAJI };
  return {
    ok: true,
    musteriId: erisim.musteriId,
    firmaIdler: erisim.firmaIdler,
    eczaneIdler: erisim.eczaneIdler,
  };
}
