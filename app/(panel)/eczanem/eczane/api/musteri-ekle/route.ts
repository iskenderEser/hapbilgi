// app/(panel)/eczanem/eczane/api/musteri-ekle/route.ts
// Eczacı/teknisyen — doğrudan müşteri kaydı (şifreli): SMS'li davet akışının
// yanında ikinci yol. Eczacı müşterinin Ad Soyad / Cep Tel / E-posta / Şifre
// bilgisini girer; müşteri bu bilgilerle /login'den giriş yapar.
//
// UTT'nin eczacıyı kaydetme deseninin (auth.admin.createUser + kimlik + bağ,
// atomik geri alma) müşteri tarafına uygulanmış halidir. Gerçek e-posta ve
// şifre auth.users'da tutulur; eczanem_musteriler şeması değişmez.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { sunucuHatasi, validasyonHatasi, yetkiHatasi, rolHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { ECLUB_TUKETICI_ROLLERI } from "@/lib/utils/roller";
import { davetEdenEczanesi } from "@/lib/eczanem/davet";
import { telefonNormalize } from "@/lib/eczanem/telefon";

function epostaGecerliMi(eposta: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(eposta);
}

function epostaCakismasiMi(mesaj?: string): boolean {
  return /already|registered|exists|duplicate/i.test(mesaj ?? "");
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!ECLUB_TUKETICI_ROLLERI.includes(rol))
      return rolHatasi("Müşteri kaydı yalnızca eczacı/teknisyen tarafından yapılabilir.");

    const eden = await davetEdenEczanesi(adminSupabase, user.id);
    if (!eden.ok) return isKuraluHatasi(eden.hata ?? "Aktif eczane bağınız bulunamadı.");

    const body = await request.json();

    const adSoyad = String(body?.ad_soyad ?? "").trim();
    if (adSoyad.length < 3) return validasyonHatasi("Ad soyad girin.", ["ad_soyad"]);
    if (adSoyad.length > 200) return validasyonHatasi("Ad soyad 200 karakterden uzun olamaz.", ["ad_soyad"]);

    const telefon = telefonNormalize(body?.telefon ?? "");
    if (!telefon) return validasyonHatasi("Geçerli bir cep telefonu girin.", ["telefon"]);

    const eposta = String(body?.eposta ?? "").trim().toLowerCase();
    if (!eposta) return validasyonHatasi("E-posta zorunludur.", ["eposta"]);
    if (eposta.length > 200) return validasyonHatasi("E-posta 200 karakterden uzun olamaz.", ["eposta"]);
    if (!epostaGecerliMi(eposta)) return validasyonHatasi("Geçerli bir e-posta adresi giriniz.", ["eposta"]);

    const sifre = String(body?.sifre ?? "");
    if (sifre.length < 6) return validasyonHatasi("Şifre en az 6 karakter olmalıdır.", ["sifre"]);

    // Telefon = tek kişi (İP-§3.3). Zaten kayıtlı numaraya ikinci kimlik açılmaz;
    // canlı müşteri henüz yok (İskender), bu yüzden birleştirme yerine net ret.
    const { data: mevcut, error: mevcutHatasi } = await adminSupabase
      .from("eczanem_musteriler")
      .select("musteri_id")
      .eq("telefon", telefon)
      .maybeSingle();
    if (mevcutHatasi) return sunucuHatasi(mevcutHatasi, "eczanem_musteriler SELECT — telefon");
    if (mevcut) return validasyonHatasi("Bu numara zaten kayıtlı.", ["telefon"]);

    // 1) Auth hesabı — gerçek e-posta + şifre (UTT'nin eczacıya hesap açması gibi).
    const { data: authData, error: authInsertHatasi } = await adminSupabase.auth.admin.createUser({
      email: eposta,
      password: sifre,
      email_confirm: true,
      user_metadata: { kimlik: "eczanem_musteri", ad_soyad: adSoyad },
    });
    if (authInsertHatasi || !authData?.user) {
      if (epostaCakismasiMi(authInsertHatasi?.message)) return validasyonHatasi("Bu e-posta zaten kayıtlı.", ["eposta"]);
      return sunucuHatasi(authInsertHatasi, "auth.admin.createUser — müşteri");
    }
    const authUserId = authData.user.id;

    // 2) Müşteri kimliği — KVKK onayı eczacının sözlü rızasıyla kayıt anında damgalanır.
    const { data: yeniMusteri, error: musteriHatasi } = await adminSupabase
      .from("eczanem_musteriler")
      .insert({
        telefon,
        ad_soyad: adSoyad,
        kvkk_onay_tarihi: new Date().toISOString(),
        aktif_mi: true,
        auth_user_id: authUserId,
      })
      .select("musteri_id")
      .single();
    if (musteriHatasi || !yeniMusteri) {
      // Geri alma: kimlik yazılamadıysa auth kaydı sahipsiz kalmasın.
      await adminSupabase.auth.admin.deleteUser(authUserId);
      if (musteriHatasi?.code === "23505") return validasyonHatasi("Bu numara zaten kayıtlı.", ["telefon"]);
      return sunucuHatasi(musteriHatasi, "eczanem_musteriler INSERT");
    }
    const musteriId = yeniMusteri.musteri_id;

    // 3) Eczane üyeliği (bağ).
    const { error: uyelikHatasi } = await adminSupabase
      .from("eczanem_uyelikler")
      .insert({ musteri_id: musteriId, eczane_id: eden.eczaneId!, aktif_mi: true });
    if (uyelikHatasi) {
      // Geri alma: bağ kurulamadıysa kimlik ve auth kaydını da geri al.
      await adminSupabase.from("eczanem_musteriler").delete().eq("musteri_id", musteriId);
      await adminSupabase.auth.admin.deleteUser(authUserId);
      return sunucuHatasi(uyelikHatasi, "eczanem_uyelikler INSERT");
    }

    return NextResponse.json({ ok: true, mesaj: "Müşteri kaydedildi." }, { status: 201 });
  } catch (err) {
    return sunucuHatasi(err, "POST /eczanem/eczane/api/musteri-ekle");
  }
}
