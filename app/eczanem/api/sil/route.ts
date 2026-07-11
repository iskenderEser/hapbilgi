// app/eczanem/api/sil/route.ts
// KVKK silme 2. adım: OTP teyidi doğruysa TAM silme (K-E5) çalışır ve oturum
// kapatılır. Bakiye kontrolü bilinçli olarak YOKTUR (İP-§3.6).

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { MUSTERI_ROLU } from "@/lib/utils/roller";
import { girisOtpDogrula } from "@/lib/eczanem/otp";
import { musteriSil } from "@/lib/eczanem/silme";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (rol !== MUSTERI_ROLU) return rolHatasi("Bu işlem yalnızca Eczanem üyelerine açıktır.");

    const body = await request.json();
    const girilenOtp = String(body?.otp ?? "").trim();
    if (!/^\d{6}$/.test(girilenOtp)) return validasyonHatasi("6 haneli teyit kodunu girin.", ["otp"]);

    const { data: musteri, error: musteriHatasi } = await adminSupabase
      .from("eczanem_musteriler")
      .select("musteri_id, telefon")
      .eq("auth_user_id", user.id)
      .single();

    if (musteriHatasi || !musteri) return sunucuHatasi(musteriHatasi, "eczanem_musteriler SELECT — auth_user_id");

    const dogrulama = await girisOtpDogrula(adminSupabase, musteri.telefon, girilenOtp);
    if (!dogrulama.ok) return isKuraluHatasi(dogrulama.hata ?? "Kod doğrulanamadı.");

    const silme = await musteriSil(adminSupabase, musteri.musteri_id);
    if (!silme.ok) return isKuraluHatasi(silme.hata ?? "Silme tamamlanamadı.");

    // Auth kaydı silindi; yerel oturum çerezleri de temizlenir.
    await supabase.auth.signOut();

    return NextResponse.json({ ok: true, mesaj: "Üyeliğiniz silindi." }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "POST /eczanem/api/sil");
  }
}
