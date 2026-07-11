// app/eczanem/api/davet-kabul/route.ts
// Davet kabulü (girişsiz — İP-§3.2): KVKK onayı + telefon + OTP → üyelik doğar,
// oturum açılır. Route ince orkestrasyondur; kurallar lib/eczanem/davet.ts'te.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { sunucuHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { davetKabul } from "@/lib/eczanem/davet";
import { musteriAuthSagla, musteriOturumAc } from "@/lib/eczanem/oturum";
import { telefonNormalize } from "@/lib/eczanem/telefon";

export async function POST(request: NextRequest) {
  try {
    const adminSupabase = createAdminClient();
    const ssrSupabase = await createClient();
    const body = await request.json();

    // KVKK onayı üyeliğin ön şartıdır (İP-§3.2) — sunucu tarafında da doğrulanır.
    if (body?.kvkk_onay !== true) {
      return validasyonHatasi("Üyelik için KVKK aydınlatma metnini onaylamanız gerekir.", ["kvkk_onay"]);
    }

    const girilenOtp = String(body?.otp ?? "").trim();
    if (!/^\d{6}$/.test(girilenOtp)) return validasyonHatasi("6 haneli kodu girin.", ["otp"]);

    const kabul = await davetKabul(adminSupabase, body?.telefon ?? "", girilenOtp);
    if (!kabul.ok) return isKuraluHatasi(kabul.hata ?? "Davet kabul edilemedi.");

    const telefon = telefonNormalize(body?.telefon ?? "")!;
    const { data: musteri, error: musteriHatasi } = await adminSupabase
      .from("eczanem_musteriler")
      .select("musteri_id, auth_user_id, telefon, aktif_mi")
      .eq("musteri_id", kabul.musteriId!)
      .single();

    if (musteriHatasi || !musteri) return sunucuHatasi(musteriHatasi, "eczanem_musteriler SELECT — kabul sonrası");

    const auth = await musteriAuthSagla(adminSupabase, musteri);
    if (!auth.ok) return isKuraluHatasi(auth.hata ?? "Kimlik hazırlanamadı.");

    const oturum = await musteriOturumAc(adminSupabase, ssrSupabase, telefon);
    if (!oturum.ok) return isKuraluHatasi(oturum.hata ?? "Oturum açılamadı.");

    return NextResponse.json({ ok: true, yonlendir: "/eczanem" }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "POST /eczanem/api/davet-kabul");
  }
}
