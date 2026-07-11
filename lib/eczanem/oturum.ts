// lib/eczanem/oturum.ts
// Müşteri oturum üretiminin tek kaynağı (K1 mimari kararı):
//
// Müşteri de bir Supabase auth kullanıcısıdır (eczanem_musteriler.auth_user_id)
// — E-Club'ın auth.admin.createUser deseninin uzantısı. Telefonla giriş için
// Supabase'in native phone auth'u BİLİNÇLİ olarak kullanılmaz (SMS sağlayıcısının
// Supabase'e bağlanmasını gerektirir; K-E1'i bloklar, ince-bağımlılık felsefesine
// aykırı). Bunun yerine OTP bizde doğrulanır (lib/eczanem/otp.ts), oturum ise
// generateLink(magiclink) → verifyOtp(token_hash) köprüsüyle standart Supabase
// çerez oturumu olarak açılır — proxy ve AuthProvider için müşteri, diğer
// kimliklerden farksızdır.

import { SupabaseClient } from "@supabase/supabase-js";

// Sentetik e-posta: auth katmanı e-posta ister, müşterinin e-postası yoktur.
// Telefon kanonik biçimde olduğundan (lib/eczanem/telefon.ts) adres deterministiktir.
// Bu adrese hiçbir zaman e-posta gönderilmez; yalnızca auth anahtarıdır.
export function musteriEposta(telefon: string): string {
  return `eczanem-${telefon}@musteri.hapbilgi.app`;
}

export interface MusteriKaydi {
  musteri_id: string;
  auth_user_id: string | null;
  telefon: string;
  aktif_mi: boolean;
}

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

// Müşterinin auth kaydını garanti eder: varsa döner, yoksa oluşturup
// eczanem_musteriler.auth_user_id'ye bağlar (gecerliTur'un kendini onarma
// deseni — U2 davet akışı da aynı fonksiyonu kullanır, çifte yazım olmaz).
export async function musteriAuthSagla(
  adminSupabase: SupabaseClient,
  musteri: MusteriKaydi
): Promise<{ ok: boolean; authUserId?: string; hata?: string }> {
  if (musteri.auth_user_id) return { ok: true, authUserId: musteri.auth_user_id };

  const { data: authData, error: createHatasi } = await adminSupabase.auth.admin.createUser({
    email: musteriEposta(musteri.telefon),
    email_confirm: true,
    user_metadata: { kimlik: "eczanem_musteri" },
  });

  if (createHatasi || !authData?.user) {
    return { ok: false, hata: "Müşteri auth kaydı oluşturulamadı." };
  }

  const { error: bagHatasi } = await adminSupabase
    .from("eczanem_musteriler")
    .update({ auth_user_id: authData.user.id })
    .eq("musteri_id", musteri.musteri_id);

  if (bagHatasi) {
    // Bağ yazılamadıysa auth kaydı sahipsiz kalmasın — geri al (E-Club rollback deseni).
    await adminSupabase.auth.admin.deleteUser(authData.user.id);
    return { ok: false, hata: "Müşteri auth bağı kurulamadı." };
  }

  return { ok: true, authUserId: authData.user.id };
}

// OTP doğrulaması SONRASI çağrılır: SSR client'a (çerez yazan) Supabase
// oturumu açar. adminSupabase link üretir, ssrSupabase token'ı doğrulayıp
// session çerezlerini yazar.
export async function musteriOturumAc(
  adminSupabase: SupabaseClient,
  ssrSupabase: SupabaseClient,
  telefon: string
): Promise<{ ok: boolean; hata?: string }> {
  const { data: linkData, error: linkHatasi } = await adminSupabase.auth.admin.generateLink({
    type: "magiclink",
    email: musteriEposta(telefon),
  });

  const tokenHash = linkData?.properties?.hashed_token;
  if (linkHatasi || !tokenHash) return { ok: false, hata: "Oturum bağlantısı üretilemedi." };

  const { error: dogrulamaHatasi } = await ssrSupabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: tokenHash,
  });

  if (dogrulamaHatasi) return { ok: false, hata: "Oturum açılamadı." };
  return { ok: true };
}
