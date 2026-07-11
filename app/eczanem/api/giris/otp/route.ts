// app/eczanem/api/giris/otp/route.ts
// Müşteri girişi 1. adım: telefon → OTP üret + SMS gönder.
// Girişsiz endpoint'tir (login öncesi) — koruma OTP mekanizmasının kendisidir:
// kod yalnızca kayıtlı telefona SMS'le gider, üretim spam'i lib/eczanem/otp.ts'teki
// yeniden-gönderim eşiğiyle sınırlıdır.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sunucuHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { telefonNormalize } from "@/lib/eczanem/telefon";
import { girisOtpOlustur } from "@/lib/eczanem/otp";
import { smsGonder } from "@/lib/sms/gonderici";

export async function POST(request: NextRequest) {
  try {
    const adminSupabase = createAdminClient();
    const body = await request.json();

    const telefon = telefonNormalize(body?.telefon ?? "");
    if (!telefon) return validasyonHatasi("Geçerli bir cep telefonu girin.", ["telefon"]);

    // Yalnızca kayıtlı ve aktif müşteriye kod gönderilir (üyelik davetle doğar — İP-§3.1).
    const { data: musteri, error: musteriHatasi } = await adminSupabase
      .from("eczanem_musteriler")
      .select("musteri_id, aktif_mi")
      .eq("telefon", telefon)
      .maybeSingle();

    if (musteriHatasi) return sunucuHatasi(musteriHatasi, "eczanem_musteriler SELECT — telefon");
    if (!musteri || !musteri.aktif_mi) {
      return isKuraluHatasi("Bu numara kayıtlı değil. Üyelik eczanenizin davetiyle başlar.");
    }

    const otpSonuc = await girisOtpOlustur(adminSupabase, telefon);
    if (!otpSonuc.ok || !otpSonuc.otp) return isKuraluHatasi(otpSonuc.hata ?? "Kod üretilemedi.");

    const sms = await smsGonder(telefon, `HapBilgi Eczanem giriş kodunuz: ${otpSonuc.otp}`);
    if (!sms.ok) return isKuraluHatasi(sms.hata ?? "SMS gönderilemedi.");

    return NextResponse.json({ ok: true, mesaj: "Kod gönderildi." }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "POST /eczanem/api/giris/otp");
  }
}
