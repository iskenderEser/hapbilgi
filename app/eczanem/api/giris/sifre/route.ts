// app/eczanem/api/giris/sifre/route.ts
// Telefon + şifre girişi. /login e-postayı doğrudan signInWithPassword ile
// geçer; telefon Supabase'e doğrudan giriş yapamadığından (proje phone-auth'u
// bilinçli kullanmıyor) burada Eczanem/E-Club kimliği → auth e-postasına çözülüp
// SSR client ile oturum açılır. Kontrollü geçişten sonra telefon girişi korunur.

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

    // Kontrollü Eczanem → E-Club geçişinde aynı Auth hesabı ve telefonla giriş
    // devam eder. İki kimlik tablosu birlikte çözülür; bütünlük tetikleyicisine
    // rağmen çakışma görülürse güvenli tarafta kalıp giriş reddedilir.
    const [musteriSonucu, eclubSonucu] = await Promise.all([
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
    ]);
    const { data: musteri, error: musteriHatasi } = musteriSonucu;
    const { data: eclubKisi, error: eclubHatasi } = eclubSonucu;
    if (musteriHatasi) return sunucuHatasi(musteriHatasi, "eczanem_musteriler SELECT — telefon");
    if (eclubHatasi) return sunucuHatasi(eclubHatasi, "eclub_kisiler SELECT — telefon girişi");

    const musteriAuthId = musteri?.aktif_mi ? musteri.auth_user_id : null;
    const eclubAuthId = eclubKisi?.auth_user_id ?? null;
    if ((!musteriAuthId && !eclubAuthId) || (musteriAuthId && eclubAuthId)) {
      return isKuraluHatasi("Telefon veya şifre hatalı.");
    }

    const authUserId = musteriAuthId ?? eclubAuthId!;

    const { data: authData, error: authHatasi } = await adminSupabase.auth.admin.getUserById(authUserId);
    if (authHatasi || !authData?.user?.email) {
      return isKuraluHatasi("Telefon veya şifre hatalı.");
    }

    const { error: girisHatasi } = await ssrSupabase.auth.signInWithPassword({
      email: authData.user.email,
      password: sifre,
    });
    if (girisHatasi) return isKuraluHatasi("Telefon veya şifre hatalı.");

    return NextResponse.json({ ok: true, yonlendir: eclubAuthId ? "/eclub/panel" : "/eczanem" }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "POST /eczanem/api/giris/sifre");
  }
}
