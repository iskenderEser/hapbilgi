// app/eczanem/api/giris/dogrula/route.ts
// Müşteri girişi 2. adım: telefon + OTP → doğrulama → Supabase çerez oturumu.
// Oturum açıldıktan sonra müşteri, AuthProvider/proxy gözünde standart bir
// auth kullanıcısıdır; v_auth_kimlik müşteri UNION'ı U2'de eklenecektir.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { sunucuHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { telefonNormalize } from "@/lib/eczanem/telefon";
import { girisOtpDogrula } from "@/lib/eczanem/otp";
import { musteriAuthSagla, musteriOturumAc } from "@/lib/eczanem/oturum";

export async function POST(request: NextRequest) {
  try {
    const adminSupabase = createAdminClient();
    const ssrSupabase = await createClient();
    const body = await request.json();

    const telefon = telefonNormalize(body?.telefon ?? "");
    if (!telefon) return validasyonHatasi("Geçerli bir cep telefonu girin.", ["telefon"]);

    const girilenOtp = String(body?.otp ?? "").trim();
    if (!/^\d{6}$/.test(girilenOtp)) return validasyonHatasi("6 haneli kodu girin.", ["otp"]);

    const { data: musteri, error: musteriHatasi } = await adminSupabase
      .from("eczanem_musteriler")
      .select("musteri_id, auth_user_id, telefon, aktif_mi")
      .eq("telefon", telefon)
      .maybeSingle();

    if (musteriHatasi) return sunucuHatasi(musteriHatasi, "eczanem_musteriler SELECT — telefon");
    if (!musteri || !musteri.aktif_mi) {
      return isKuraluHatasi("Bu numara kayıtlı değil. Üyelik eczanenizin davetiyle başlar.");
    }

    const dogrulama = await girisOtpDogrula(adminSupabase, telefon, girilenOtp);
    if (!dogrulama.ok) return isKuraluHatasi(dogrulama.hata ?? "Kod doğrulanamadı.");

    const auth = await musteriAuthSagla(adminSupabase, musteri);
    if (!auth.ok) return isKuraluHatasi(auth.hata ?? "Kimlik hazırlanamadı.");

    const oturum = await musteriOturumAc(adminSupabase, ssrSupabase, telefon);
    if (!oturum.ok) return isKuraluHatasi(oturum.hata ?? "Oturum açılamadı.");

    return NextResponse.json({ ok: true, yonlendir: "/eczanem" }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "POST /eczanem/api/giris/dogrula");
  }
}
