// lib/eczanem/otp.ts
// OTP davranışının TEK KAYNAĞI (K-E8): üretim, hash, kayıt, doğrulama ve
// test modu bu dosyada yaşar. Giriş akışı (U1) eczanem_giris_otp tablosunu,
// davet akışı (U2) eczanem_davetler.otp_hash kolonunu aynı üretim/hash
// fonksiyonlarıyla kullanır.
//
// K-E8 — test modu (kapalı karar, 10.07.2026):
//   Canlı olmayan her ortamda (local + Vercel preview) sabit kod 123456
//   geçerlidir ve SMS gönderilmez (lib/sms tarafı). Sabit kod kabulü
//   YALNIZCA canliOrtamMi() false iken çalışır — çift kilit lib/utils/ortam.ts'te.
//   Test-modu doğrulamaları loglanır.

import { randomInt, createHash } from "node:crypto";
import { SupabaseClient } from "@supabase/supabase-js";
import { canliOrtamMi } from "@/lib/utils/ortam";

// Giriş OTP kuralları. Davet geçerliliği AYRI kavramdır ve
// sistem_ayarlari.eczanem_davet_gecerlilik_saat'ten okunur (U2);
// giriş kodu kısa ömürlü tek kullanımlıktır, ayar gerektirmez.
export const OTP_GECERLILIK_DAKIKA = 5;
export const OTP_MAKS_DENEME = 5;
export const OTP_YENIDEN_GONDERIM_SANIYE = 60;
const TEST_OTP = "123456";

export interface OtpSonuc {
  ok: boolean;
  hata?: string;
}

export function otpUret(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

// Hash telefonla tuzlanır: aynı kodun iki numarada aynı hash'i üretmesi
// engellenir. 6 haneli uzayda asıl koruma hash değil deneme sınırıdır
// (OTP_MAKS_DENEME) — hash yalnızca kodun DB'de düz durmaması içindir.
export function otpHashle(telefon: string, otp: string): string {
  return createHash("sha256").update(`${telefon}:${otp}:hapbilgi-eczanem-otp`).digest("hex");
}

// K-E8 sabit kod kapısı — TEK yer: giriş doğrulaması da davet kabulü de
// buradan geçer. Canlı ortamda koşulsuz false (çift kilit ortam.ts'te).
export function sabitKodGecerliMi(telefon: string, girilenOtp: string): boolean {
  if (canliOrtamMi() || girilenOtp !== TEST_OTP) return false;
  console.log(`[OTP TEST] ${telefon} sabit kodla doğrulandı (canlı dışı ortam — K-E8).`);
  return true;
}

// Giriş OTP'si üretir, hash'ini kaydeder, kodu döner (SMS metnini çağıran kurar).
// Spam koruması: aynı telefona OTP_YENIDEN_GONDERIM_SANIYE içinde ikinci kod üretilmez.
export async function girisOtpOlustur(
  adminSupabase: SupabaseClient,
  telefon: string
): Promise<OtpSonuc & { otp?: string }> {
  const esik = new Date(Date.now() - OTP_YENIDEN_GONDERIM_SANIYE * 1000).toISOString();
  const { data: yeniKayitlar, error: kontrolHatasi } = await adminSupabase
    .from("eczanem_giris_otp")
    .select("otp_id")
    .eq("telefon", telefon)
    .gte("created_at", esik)
    .limit(1);

  if (kontrolHatasi) return { ok: false, hata: "OTP kontrolü yapılamadı." };
  if ((yeniKayitlar ?? []).length > 0) {
    return { ok: false, hata: `Kısa süre önce kod gönderildi; ${OTP_YENIDEN_GONDERIM_SANIYE} saniye sonra yeniden deneyin.` };
  }

  const otp = otpUret();
  const sonGecerlilik = new Date(Date.now() + OTP_GECERLILIK_DAKIKA * 60 * 1000).toISOString();

  const { error: insertHatasi } = await adminSupabase.from("eczanem_giris_otp").insert({
    telefon,
    otp_hash: otpHashle(telefon, otp),
    son_gecerlilik: sonGecerlilik,
  });

  if (insertHatasi) return { ok: false, hata: "OTP kaydı oluşturulamadı." };
  return { ok: true, otp };
}

// Giriş OTP'sini doğrular. Sıra önemlidir:
//   1) Test modu (canlı DEĞİLKEN sabit kod) — K-E8.
//   2) Telefonun süresi geçmemiş, kullanılmamış en yeni kaydı bulunur.
//   3) Deneme sınırı aşıldıysa red; hash eşleşirse kayıt tek kullanımlık
//      kapatılır (kullanildi_mi=true); eşleşmezse deneme sayacı artar.
export async function girisOtpDogrula(
  adminSupabase: SupabaseClient,
  telefon: string,
  girilenOtp: string
): Promise<OtpSonuc> {
  if (sabitKodGecerliMi(telefon, girilenOtp)) return { ok: true };

  const simdi = new Date().toISOString();
  const { data: kayitlar, error: okumaHatasi } = await adminSupabase
    .from("eczanem_giris_otp")
    .select("otp_id, otp_hash, deneme_sayisi")
    .eq("telefon", telefon)
    .eq("kullanildi_mi", false)
    .gte("son_gecerlilik", simdi)
    .order("created_at", { ascending: false })
    .limit(1);

  if (okumaHatasi) return { ok: false, hata: "OTP doğrulaması yapılamadı." };

  const kayit = (kayitlar ?? [])[0];
  if (!kayit) return { ok: false, hata: "Geçerli bir kod bulunamadı; yeni kod isteyin." };
  if (kayit.deneme_sayisi >= OTP_MAKS_DENEME) {
    return { ok: false, hata: "Çok fazla hatalı deneme; yeni kod isteyin." };
  }

  if (kayit.otp_hash !== otpHashle(telefon, girilenOtp)) {
    await adminSupabase
      .from("eczanem_giris_otp")
      .update({ deneme_sayisi: kayit.deneme_sayisi + 1 })
      .eq("otp_id", kayit.otp_id);
    return { ok: false, hata: "Kod hatalı." };
  }

  const { error: kapatmaHatasi } = await adminSupabase
    .from("eczanem_giris_otp")
    .update({ kullanildi_mi: true })
    .eq("otp_id", kayit.otp_id)
    .eq("kullanildi_mi", false);

  if (kapatmaHatasi) return { ok: false, hata: "OTP kapatılamadı; yeniden deneyin." };
  return { ok: true };
}
