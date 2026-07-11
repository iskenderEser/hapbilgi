// app/eczanem/api/silme-otp/route.ts
// KVKK silme 1. adım: oturumlu müşterinin KENDİ telefonuna teyit kodu gönderilir
// (İP-§3.6: silme OTP ile teyit edilir). Bekçi /eczanem'i korur; burada yine de
// rol doğrulanır (derinlemesine savunma).

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { sunucuHatasi, yetkiHatasi, rolHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { MUSTERI_ROLU } from "@/lib/utils/roller";
import { girisOtpOlustur } from "@/lib/eczanem/otp";
import { smsGonder } from "@/lib/sms/gonderici";

export async function POST() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (rol !== MUSTERI_ROLU) return rolHatasi("Bu işlem yalnızca Eczanem üyelerine açıktır.");

    const { data: musteri, error: musteriHatasi } = await adminSupabase
      .from("eczanem_musteriler")
      .select("telefon")
      .eq("auth_user_id", user.id)
      .single();

    if (musteriHatasi || !musteri) return sunucuHatasi(musteriHatasi, "eczanem_musteriler SELECT — auth_user_id");

    const otpSonuc = await girisOtpOlustur(adminSupabase, musteri.telefon);
    if (!otpSonuc.ok || !otpSonuc.otp) return isKuraluHatasi(otpSonuc.hata ?? "Kod üretilemedi.");

    const sms = await smsGonder(
      musteri.telefon,
      `HapBilgi Eczanem üyelik SİLME teyit kodunuz: ${otpSonuc.otp} — Bu işlem geri alınamaz.`
    );
    if (!sms.ok) return isKuraluHatasi(sms.hata ?? "SMS gönderilemedi.");

    return NextResponse.json({ ok: true, mesaj: "Teyit kodu gönderildi." }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "POST /eczanem/api/silme-otp");
  }
}
