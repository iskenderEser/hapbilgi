// Müşterinin kendi hesabını kalıcı olarak silmesi.
// İstemciden kimlik kabul edilmez; hedef yalnız oturumdaki müşteridir.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { isKuraluHatasi, rolHatasi, sunucuHatasi, validasyonHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { MUSTERI_ROLU } from "@/lib/utils/roller";
import { musteriTamSil } from "@/lib/eczanem/silme";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authHatasi } = await supabase.auth.getUser();
    if (authHatasi || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (rol !== MUSTERI_ROLU) return rolHatasi("Bu işlem yalnızca Eczanem müşterisine açıktır.");

    const body = await request.json();
    const sifre = String(body?.sifre ?? "");
    if (!sifre) return validasyonHatasi("Devam etmek için mevcut şifrenizi girin.", ["sifre"]);
    if (!user.email) return isKuraluHatasi("Giriş hesabınız doğrulanamadı.");

    // Kritik işlemden hemen önce mevcut şifreyle yeniden kimlik doğrulaması.
    const { data: teyit, error: teyitHatasi } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: sifre,
    });
    if (teyitHatasi || teyit.user?.id !== user.id) return isKuraluHatasi("Şifreniz hatalı.");

    const { data: musteri, error: musteriHatasi } = await adminSupabase
      .from("eczanem_musteriler")
      .select("musteri_id, auth_user_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (musteriHatasi) return sunucuHatasi(musteriHatasi, "eczanem_musteriler SELECT — kendi hesabını silme");
    if (!musteri?.auth_user_id) return isKuraluHatasi("Müşteri hesabınız bulunamadı.");

    const sonuc = await musteriTamSil(adminSupabase, {
      musteri_id: musteri.musteri_id,
      auth_user_id: musteri.auth_user_id,
    });
    if (!sonuc.ok) return isKuraluHatasi(sonuc.hata ?? "Hesap silinemedi.");

    // Auth hesabı silinmiştir; kalan tarayıcı çerezini de temizlemeyi dener.
    await supabase.auth.signOut({ scope: "local" });
    return NextResponse.json({ ok: true, mesaj: "Hesabınız kalıcı olarak silindi." }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "POST /eczanem/api/hesabimi-sil");
  }
}
