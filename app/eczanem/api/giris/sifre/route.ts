// app/eczanem/api/giris/sifre/route.ts
// Müşteri girişi — telefon + şifre. /login e-postayı doğrudan signInWithPassword
// ile geçer; telefon Supabase'e doğrudan giriş yapamadığından (proje phone-auth'u
// bilinçli kullanmıyor) burada telefon → auth e-postasına çözülüp SSR client ile
// oturum açılır (çerezleri SSR client yazar — davet-kabul/dogrula ile aynı desen).

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { sunucuHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { telefonNormalize } from "@/lib/eczanem/telefon";

export async function POST(request: NextRequest) {
  try {
    const adminSupabase = createAdminClient();
    const ssrSupabase = await createClient();
    const body = await request.json();

    const telefon = telefonNormalize(body?.telefon ?? "");
    if (!telefon) return validasyonHatasi("Geçerli bir cep telefonu girin.", ["telefon"]);

    const sifre = String(body?.sifre ?? "");
    if (!sifre) return validasyonHatasi("Şifrenizi girin.", ["sifre"]);

    // Telefondan aktif müşteriyi ve auth kaydını bul. Hata mesajı, numaranın
    // kayıtlı olup olmadığını sızdırmamak için hep aynı (jenerik).
    const { data: musteri, error: musteriHatasi } = await adminSupabase
      .from("eczanem_musteriler")
      .select("auth_user_id, aktif_mi")
      .eq("telefon", telefon)
      .maybeSingle();
    if (musteriHatasi) return sunucuHatasi(musteriHatasi, "eczanem_musteriler SELECT — telefon");
    if (!musteri || !musteri.aktif_mi || !musteri.auth_user_id) {
      return isKuraluHatasi("Telefon veya şifre hatalı.");
    }

    const { data: authData, error: authHatasi } = await adminSupabase.auth.admin.getUserById(musteri.auth_user_id);
    if (authHatasi || !authData?.user?.email) {
      return isKuraluHatasi("Telefon veya şifre hatalı.");
    }

    const { error: girisHatasi } = await ssrSupabase.auth.signInWithPassword({
      email: authData.user.email,
      password: sifre,
    });
    if (girisHatasi) return isKuraluHatasi("Telefon veya şifre hatalı.");

    return NextResponse.json({ ok: true, yonlendir: "/eczanem" }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "POST /eczanem/api/giris/sifre");
  }
}
