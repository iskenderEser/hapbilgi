// lib/eczanem/davet.ts
// Davet akışının tek kaynağı (İP-§3.1/3.2): oluşturma (eczacı tarafı) ve
// kabul (müşteri tarafı). Route'lar yalnızca orkestre eder.
//
// Kayıt-anı ilkeleri:
//  - Davet, üyelik DEĞİLDİR: gerçek müşteri kaydı yalnızca kabul anında doğar
//    (İP-§3.2); süresi dolan davet sorgu-anında geçersiz sayılır (K-E2 açık —
//    fiziksel temizlik stratejisi o kararla gelir).
//  - Telefon her sınırda kanonik biçime çevrilir (lib/eczanem/telefon.ts).
//  - OTP üretim/hash/sabit-kod tek kaynaktan (lib/eczanem/otp.ts, K-E8).

import { SupabaseClient } from "@supabase/supabase-js";
import { otpUret, otpHashle, sabitKodGecerliMi, OTP_MAKS_DENEME } from "@/lib/eczanem/otp";
import { telefonNormalize } from "@/lib/eczanem/telefon";
import { smsGonder } from "@/lib/sms/gonderici";

// Ayar okunamazsa güvenli geri düşüş (oneriLimit.ts deseni).
export const DAVET_GECERLILIK_SAAT_VARSAYILAN = 24;

/** sistem_ayarlari.eczanem_davet_gecerlilik_saat — davetin yaşam süresi. */
export async function davetGecerlilikSaat(adminSupabase: SupabaseClient): Promise<number> {
  const { data, error } = await adminSupabase
    .from("sistem_ayarlari")
    .select("deger")
    .eq("anahtar", "eczanem_davet_gecerlilik_saat")
    .single();

  const deger = Number(data?.deger);
  if (error || !Number.isFinite(deger) || deger <= 0) {
    console.error("[UYARI] eczanem_davet_gecerlilik_saat okunamadı, varsayılan kullanılıyor:", error?.message ?? data?.deger);
    return DAVET_GECERLILIK_SAAT_VARSAYILAN;
  }
  return deger;
}

export interface DavetSonuc {
  ok: boolean;
  hata?: string;
}

// Davet edenin (eczacı/teknisyen) kişi kaydını ve aktif eczanesini çözer.
export async function davetEdenEczanesi(
  adminSupabase: SupabaseClient,
  authUserId: string
): Promise<{ ok: boolean; kisiId?: string; eczaneId?: string; hata?: string }> {
  const { data: kisi, error: kisiHatasi } = await adminSupabase
    .from("eclub_kisiler")
    .select("kisi_id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (kisiHatasi || !kisi) return { ok: false, hata: "Kişi kaydınız bulunamadı." };

  const { data: bag, error: bagHatasi } = await adminSupabase
    .from("eclub_kisi_eczane")
    .select("eczane_id")
    .eq("kisi_id", kisi.kisi_id)
    .eq("aktif_mi", true)
    .maybeSingle();

  if (bagHatasi || !bag) return { ok: false, hata: "Aktif eczane bağınız bulunamadı." };
  return { ok: true, kisiId: kisi.kisi_id, eczaneId: bag.eczane_id };
}

// İP-§3.4: davet edilen telefon, o eczanenin eczacı/teknisyen telefonlarından
// biriyse RED (kendi kendine puan üretme suistimalinin karşılığı).
// Karşılaştırma normalize edilerek yapılır — DB'deki yazım biçimine bağımlı değildir.
async function eczaneKisisiMi(
  adminSupabase: SupabaseClient,
  eczaneId: string,
  telefon: string
): Promise<boolean> {
  const { data: baglar } = await adminSupabase
    .from("eclub_kisi_eczane")
    .select("kisi_id")
    .eq("eczane_id", eczaneId)
    .eq("aktif_mi", true);

  const kisiIdler = (baglar ?? []).map((b: any) => b.kisi_id);
  if (kisiIdler.length === 0) return false;

  const { data: kisiler } = await adminSupabase
    .from("eclub_kisiler")
    .select("telefon")
    .in("kisi_id", kisiIdler);

  return (kisiler ?? []).some((k: any) => telefonNormalize(k.telefon ?? "") === telefon);
}

// Davet oluşturma (İP-§3.1/3.2): doğrulamalar → eski bekleyen davetlerin
// iptali → OTP'li davet kaydı → SMS. Eczacı dilerse yeni davet gönderir;
// aynı telefona tek bekleyen davet kuralı iptalle korunur (yapısal UNIQUE yok,
// davet geçici veridir).
export async function davetOlustur(
  adminSupabase: SupabaseClient,
  authUserId: string,
  hamTelefon: string,
  adSoyad: string
): Promise<DavetSonuc> {
  const eden = await davetEdenEczanesi(adminSupabase, authUserId);
  if (!eden.ok) return { ok: false, hata: eden.hata };

  const telefon = telefonNormalize(hamTelefon);
  if (!telefon) return { ok: false, hata: "Geçerli bir cep telefonu girin." };

  const temizAd = (adSoyad ?? "").trim();
  if (temizAd.length < 3) return { ok: false, hata: "Ad soyad girin." };

  if (await eczaneKisisiMi(adminSupabase, eden.eczaneId!, telefon)) {
    return { ok: false, hata: "Bu numara eczanenizin eczacı/teknisyen kaydına ait; müşteri olarak davet edilemez." };
  }

  // Zaten bu eczanenin aktif üyesi mi? (Başka eczanenin üyesi olması engel
  // değildir — İP-§1.3 çoklu liste; kabulde yalnız üyelik bağı eklenir.)
  const { data: musteri } = await adminSupabase
    .from("eczanem_musteriler")
    .select("musteri_id")
    .eq("telefon", telefon)
    .eq("aktif_mi", true)
    .maybeSingle();

  if (musteri) {
    const { data: uyelik } = await adminSupabase
      .from("eczanem_uyelikler")
      .select("uyelik_id")
      .eq("musteri_id", musteri.musteri_id)
      .eq("eczane_id", eden.eczaneId!)
      .eq("aktif_mi", true)
      .maybeSingle();
    if (uyelik) return { ok: false, hata: "Bu numara zaten eczanenizin üyesi." };
  }

  // Aynı telefona bekleyen davetler iptal edilir — tek geçerli davet kalır.
  await adminSupabase
    .from("eczanem_davetler")
    .update({ durum: "iptal" })
    .eq("eczane_id", eden.eczaneId!)
    .eq("telefon", telefon)
    .eq("durum", "bekliyor");

  const saat = await davetGecerlilikSaat(adminSupabase);
  const otp = otpUret();

  const { error: insertHatasi } = await adminSupabase.from("eczanem_davetler").insert({
    eczane_id: eden.eczaneId!,
    davet_eden_kisi_id: eden.kisiId!,
    telefon,
    ad_soyad: temizAd,
    otp_hash: otpHashle(telefon, otp),
    son_gecerlilik: new Date(Date.now() + saat * 60 * 60 * 1000).toISOString(),
    durum: "bekliyor",
  });

  if (insertHatasi) return { ok: false, hata: "Davet kaydı oluşturulamadı." };

  const sms = await smsGonder(
    telefon,
    `Eczaneniz sizi HapBilgi Eczanem'e davet etti. Kodunuz: ${otp} — Üyelik: hapbilgi.com/eczanem/davet (${saat} saat geçerli)`
  );
  if (!sms.ok) return { ok: false, hata: sms.hata ?? "SMS gönderilemedi." };

  return { ok: true };
}

// Davet kabulü (İP-§3.2): KVKK onayı + OTP → ANCAK BU ANDA gerçek müşteri
// kaydı doğar. Müşteri zaten varsa (başka eczaneden) yalnız üyelik bağı
// eklenir; UNIQUE(musteri_id, eczane_id) mükerrer bağı yapısal engeller.
export async function davetKabul(
  adminSupabase: SupabaseClient,
  hamTelefon: string,
  girilenOtp: string
): Promise<DavetSonuc & { musteriId?: string; eczaneId?: string }> {
  const telefon = telefonNormalize(hamTelefon);
  if (!telefon) return { ok: false, hata: "Geçerli bir cep telefonu girin." };

  const simdi = new Date().toISOString();
  const { data: davetler, error: davetHatasi } = await adminSupabase
    .from("eczanem_davetler")
    .select("davet_id, eczane_id, ad_soyad, otp_hash, deneme_sayisi")
    .eq("telefon", telefon)
    .eq("durum", "bekliyor")
    .gte("son_gecerlilik", simdi)
    .order("created_at", { ascending: false })
    .limit(1);

  if (davetHatasi) return { ok: false, hata: "Davet sorgulanamadı." };

  const davet = (davetler ?? [])[0];
  if (!davet) return { ok: false, hata: "Geçerli bir davet bulunamadı; eczanenizden yeni davet isteyin." };
  if (davet.deneme_sayisi >= OTP_MAKS_DENEME) {
    return { ok: false, hata: "Çok fazla hatalı deneme; eczanenizden yeni davet isteyin." };
  }

  const kodDogru =
    sabitKodGecerliMi(telefon, girilenOtp) || davet.otp_hash === otpHashle(telefon, girilenOtp);

  if (!kodDogru) {
    await adminSupabase
      .from("eczanem_davetler")
      .update({ deneme_sayisi: davet.deneme_sayisi + 1 })
      .eq("davet_id", davet.davet_id);
    return { ok: false, hata: "Kod hatalı." };
  }

  // Müşteri kimliği: yoksa KVKK onay damgasıyla doğar; pasifse yeniden
  // onayla aktifleşir (telefon = tek kişi, İP-§3.3 — ikinci kayıt açılmaz).
  const { data: mevcut } = await adminSupabase
    .from("eczanem_musteriler")
    .select("musteri_id, aktif_mi")
    .eq("telefon", telefon)
    .maybeSingle();

  let musteriId = mevcut?.musteri_id as string | undefined;

  if (!musteriId) {
    const { data: yeni, error: musteriHatasi } = await adminSupabase
      .from("eczanem_musteriler")
      .insert({ telefon, ad_soyad: davet.ad_soyad, kvkk_onay_tarihi: simdi, aktif_mi: true })
      .select("musteri_id")
      .single();
    if (musteriHatasi || !yeni) return { ok: false, hata: "Üyelik kaydı oluşturulamadı." };
    musteriId = yeni.musteri_id;
  } else if (mevcut && !mevcut.aktif_mi) {
    const { error: aktifHatasi } = await adminSupabase
      .from("eczanem_musteriler")
      .update({ aktif_mi: true, kvkk_onay_tarihi: simdi })
      .eq("musteri_id", musteriId);
    if (aktifHatasi) return { ok: false, hata: "Üyelik yeniden etkinleştirilemedi." };
  }

  // Eczane bağı — UNIQUE(musteri_id, eczane_id) çakışması "zaten bağlı" demektir, sessiz geçilir.
  const { error: uyelikHatasi } = await adminSupabase
    .from("eczanem_uyelikler")
    .insert({ musteri_id: musteriId, eczane_id: davet.eczane_id, aktif_mi: true });
  if (uyelikHatasi && uyelikHatasi.code !== "23505") {
    return { ok: false, hata: "Eczane üyeliği kurulamadı." };
  }

  await adminSupabase
    .from("eczanem_davetler")
    .update({ durum: "tamamlandi" })
    .eq("davet_id", davet.davet_id);

  return { ok: true, musteriId, eczaneId: davet.eczane_id };
}
