import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const davetHash = (token: string) => createHash("sha256").update(token).digest("hex");
export const davetTokenGecerli = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{43}$/.test(v);
export const davetBekliyor = (metadata: Record<string, unknown> | undefined) => metadata?.eclub_davet_bekliyor === true;

export async function davetAltyapisiKontrol(db: SupabaseClient) {
  const { error } = await db.from("eclub_uyelik_davetleri").select("auth_user_id").limit(0);
  if (error) throw new Error("Üyelik daveti veritabanı kurulumu tamamlanmamış.");
}

const kacir = (v: string) => v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");

export function davetSiteAdresi(origin: string): string {
  const url = new URL(process.env.HAPBILGI_SITE_URL || origin);
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new Error("Davet için güvenli HAPBILGI_SITE_URL tanımlayın.");
  }
  // Üretimde Host başlığını e-posta bağlantısının kaynağı olarak kabul etmeyiz.
  if (process.env.NODE_ENV === "production" && !process.env.HAPBILGI_SITE_URL) throw new Error("HAPBILGI_SITE_URL eksik.");
  return url.origin;
}

export async function uyelikDavetiGonder(db: SupabaseClient, authId: string, origin: string) {
  const { data, error } = await db.auth.admin.getUserById(authId);
  if (error || !data.user?.email) throw new Error("Davet hesabı doğrulanamadı.");
  if (!davetBekliyor(data.user.app_metadata)) throw new Error("Bu kişinin giriş hesabı zaten hazır.");
  const token = randomBytes(32).toString("base64url");
  const { data: davetId, error: kayitHatasi } = await db.rpc("eclub_davet_yenile", {
    p_auth: authId, p_hash: davetHash(token), p_eposta: data.user.email,
  });
  if (kayitHatasi) return { gonderildi: false, mesaj: `Kişi kayıtlı; davet gönderilemedi. ${kayitHatasi.message}` };
  try {
    const adres = davetSiteAdresi(origin);
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.ECLUB_DAVET_EMAIL_FROM || process.env.ECLUB_CEK_EMAIL_FROM;
    if (!apiKey || !from) throw new Error("Davet e-postası için RESEND_API_KEY ve ECLUB_DAVET_EMAIL_FROM tanımlanmalı.");
    const link = `${adres}/sifre-olustur?token=${token}`;
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST", signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `eclub-davet/${davetId}` },
      body: JSON.stringify({ from, to: [data.user.email], subject: "HapBilgi E-Club üyelik davetiniz",
        html: `<p>Merhaba ${kacir(String(data.user.user_metadata.ad ?? ""))},</p><p>E-Club üyeliğinizi tamamlamak için kendi şifrenizi oluşturun.</p><p><a href="${kacir(link)}">Şifre oluştur</a></p><p>Bu bağlantı 24 saat geçerlidir ve tek kullanımlıktır. Süresi dolarsa temsilcinizden daveti yeniden göndermesini isteyebilirsiniz.</p>`,
      }),
    });
    if (!r.ok) throw new Error("Davet e-postası gönderilemedi.");
    const { error: gonderimHatasi } = await db.from("eclub_uyelik_davetleri").update({ gonderildi: true }).eq("davet_id", davetId);
    if (gonderimHatasi) throw new Error("Davet gönderim durumu kaydedilemedi.");
    return { gonderildi: true, mesaj: "Kişi eklendi; şifre oluşturma daveti e-postasına gönderildi." };
  } catch (e) {
    return { gonderildi: false, mesaj: `Kişi kaydedildi ancak davet gönderimi tamamlanamadı. Daveti yeniden gönderin. ${e instanceof Error ? e.message : ""}` };
  }
}

/** Kişi zaten kayıtlıdır; gönderim kesintisi başarılı kaydı hataya çeviremez. */
export async function kayitSonrasiDavetGonder(db: SupabaseClient, authId: string, origin: string) {
  try { return await uyelikDavetiGonder(db, authId, origin); }
  catch { return { gonderildi: false, mesaj: "Kişi kaydedildi ancak davet gönderilemedi. Daveti yeniden gönderin." }; }
}

interface Davet { auth_user_id: string; davet_id: string; eposta: string; }

export async function davetSifresiniKaydet(db: SupabaseClient, token: unknown, sifre: unknown, tekrar: unknown) {
  if (!davetTokenGecerli(token)) throw new Error("Davet bağlantısı geçersiz.");
  if (typeof sifre !== "string" || sifre.length < 6 || sifre.length > 128) throw new Error("Şifre 6–128 karakter olmalıdır.");
  if (sifre !== tekrar) throw new Error("Şifreler eşleşmiyor.");
  const lease = randomUUID();
  const { data, error } = await db.rpc("eclub_davet_islem_al", { p_hash: davetHash(token), p_lease: lease });
  if (error) throw new Error("Davet doğrulanamadı. Lütfen yeniden deneyin.");
  const davet = (Array.isArray(data) ? data[0] : data) as Davet | undefined;
  if (!davet) throw new Error("Davet kullanılmış, süresi dolmuş veya işlem sürüyor. Temsilcinizden yeni davet isteyin.");
  let authTamamlandi = false;
  let authYazimiBelirsiz = false;
  try {
    const { data: hesap, error: hesapHatasi } = await db.auth.admin.getUserById(davet.auth_user_id);
    if (hesapHatasi || !hesap.user || hesap.user.email?.toLowerCase() !== davet.eposta.toLowerCase()) throw new Error("Davet hesabı değişmiş. Yeni davet isteyin.");
    const { data: kisi, error: kisiHatasi } = await db.from("eclub_kisiler").select("kisi_id").eq("auth_user_id", davet.auth_user_id).maybeSingle();
    if (kisiHatasi || !kisi) throw new Error("Davet üyeliği bulunamadı.");
    const { data: baglar, error: bagHatasi } = await db.from("eclub_kisi_eczane").select("kisi_id").eq("kisi_id", kisi.kisi_id).eq("aktif_mi", true).limit(1);
    if (bagHatasi || !baglar?.length) throw new Error("Eczane üyeliği pasife alınmış. Temsilcinizle iletişime geçin.");
    // Auth kaydı başarılı, DB tamamlama yanıtı kaybolmuşsa tekrar şifre yazılmaz.
    authTamamlandi = hesap.user.app_metadata.eclub_davet_tamamlandi === davet.davet_id;
    if (!authTamamlandi) {
      if (!davetBekliyor(hesap.user.app_metadata)) throw new Error("Bu hesap için davet artık geçerli değil.");
      authYazimiBelirsiz = true;
      const { error: sifreHatasi } = await db.auth.admin.updateUserById(davet.auth_user_id, {
        password: sifre, email_confirm: true, ban_duration: "none",
        app_metadata: { ...hesap.user.app_metadata, eclub_davet_bekliyor: false, eclub_davet_tamamlandi: davet.davet_id },
      });
      if (sifreHatasi) {
        authYazimiBelirsiz = !sifreHatasi.status || sifreHatasi.status >= 500;
        throw new Error(authYazimiBelirsiz ? "Şifre kaydı doğrulanamadı. İki dakika sonra tekrar deneyin." : "Şifre kaydedilemedi. Lütfen yeniden deneyin.");
      }
      authTamamlandi = true;
    }
    const { data: bitti, error: bitisHatasi } = await db.rpc("eclub_davet_islem_bitir", { p_auth: davet.auth_user_id, p_lease: lease, p_basarili: true });
    if (bitisHatasi || !bitti) throw new Error("Şifre kaydedildi; kayıt tamamlama işlemi için iki dakika sonra tekrar deneyin.");
  } catch (e) {
    // Auth işlemi başarıyla bitmişse davet bekliyor durumuna geri döndürülmez.
    if (!authTamamlandi && !authYazimiBelirsiz) await db.rpc("eclub_davet_islem_bitir", { p_auth: davet.auth_user_id, p_lease: lease, p_basarili: false });
    throw e;
  }
}
