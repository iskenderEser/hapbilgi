// app/eczanem/api/giris/sifre/route.ts
// Telefon + şifre girişi. /login e-postayı doğrudan signInWithPassword ile
// geçer; telefon Supabase'e doğrudan giriş yapamadığından (proje phone-auth'u
// bilinçli kullanmıyor) burada iç kullanıcı/Eczanem/E-Club kimliği → auth
// e-postasına çözülüp SSR client ile oturum açılır. Kontrollü geçişten sonra
// telefon girişi korunur.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { sunucuHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { telefonNormalize } from "@/lib/eczanem/telefon";
import { eclubTelefonVaryantlari } from "@/lib/eczanem/eclubUyesiKontrol";

export async function POST(request: NextRequest) {
  try {
    const adminSupabase = createAdminClient();
    const ssrSupabase = await createClient();
    const body = await request.json();

    const telefon = telefonNormalize(body?.telefon ?? "");
    if (!telefon) return validasyonHatasi("Geçerli bir cep telefonu girin.", ["telefon"]);

    const sifre = String(body?.sifre ?? "");
    if (!sifre) return validasyonHatasi("Şifrenizi girin.", ["sifre"]);

    // Üç kimlik düzlemi birlikte çözülür. Aynı telefon birden fazla düzlemde
    // bulunursa hangi Auth hesabının sahibi olduğu belirsizdir; güvenli tarafta
    // kalıp giriş reddedilir.
    const [musteriSonucu, eclubSonucu, icKullaniciSonucu] = await Promise.all([
      adminSupabase
        .from("eczanem_musteriler")
        .select("auth_user_id, aktif_mi")
        .eq("telefon", telefon)
        .maybeSingle(),
      adminSupabase
        .from("eclub_kisiler")
        .select("auth_user_id")
        .in("telefon", eclubTelefonVaryantlari(telefon))
        .maybeSingle(),
      adminSupabase
        .from("kullanicilar")
        .select("kullanici_id, aktif_mi")
        .eq("telefon", telefon)
        .maybeSingle(),
    ]);
    const { data: musteri, error: musteriHatasi } = musteriSonucu;
    const { data: eclubKisi, error: eclubHatasi } = eclubSonucu;
    const { data: icKullanici, error: icKullaniciHatasi } = icKullaniciSonucu;
    if (musteriHatasi) return sunucuHatasi(musteriHatasi, "eczanem_musteriler SELECT — telefon");
    if (eclubHatasi) return sunucuHatasi(eclubHatasi, "eclub_kisiler SELECT — telefon girişi");
    if (icKullaniciHatasi) return sunucuHatasi(icKullaniciHatasi, "kullanicilar SELECT — telefon girişi");

    const adaylar = [
      musteri?.auth_user_id
        ? { authId: musteri.auth_user_id, kimlikTuru: "musteri" as const, aktifMi: musteri.aktif_mi === true }
        : null,
      eclubKisi?.auth_user_id
        ? { authId: eclubKisi.auth_user_id, kimlikTuru: "eclub_kisi" as const, aktifMi: true }
        : null,
      icKullanici?.kullanici_id
        ? { authId: icKullanici.kullanici_id, kimlikTuru: "ic_kullanici" as const, aktifMi: icKullanici.aktif_mi === true }
        : null,
    ].filter((aday): aday is NonNullable<typeof aday> => aday !== null);

    if (adaylar.length !== 1 || !adaylar[0].aktifMi) {
      return isKuraluHatasi("Telefon veya şifre hatalı.");
    }

    const kimlik = adaylar[0];

    const { data: authData, error: authHatasi } = await adminSupabase.auth.admin.getUserById(kimlik.authId);
    if (authHatasi || !authData?.user?.email) {
      return isKuraluHatasi("Telefon veya şifre hatalı.");
    }

    const { error: girisHatasi } = await ssrSupabase.auth.signInWithPassword({
      email: authData.user.email,
      password: sifre,
    });
    if (girisHatasi) return isKuraluHatasi("Telefon veya şifre hatalı.");

    const yonlendir = kimlik.kimlikTuru === "ic_kullanici"
      ? "/login"
      : kimlik.kimlikTuru === "eclub_kisi"
        ? "/eclub/panel"
        : "/eczanem";
    return NextResponse.json({ ok: true, yonlendir }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "POST /eczanem/api/giris/sifre");
  }
}
