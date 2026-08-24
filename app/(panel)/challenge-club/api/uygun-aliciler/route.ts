// app/challenge-club/api/uygun-aliciler/route.ts
//
// Seçilen video için gönderilebilir BM listesi.
// uygunAliciListesi tüm aktif BM'leri döner; her birinin gonderilebilir bayrağı
// ve gerekirse sebep alanı doldurulur. UI uygun olmayanları gri/disabled gösterebilir.
//
// İş mantığı lib/cc/uygunAliciListesi'nde — bu endpoint ince orchestration.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  hataYaniti,
  veriKontrol,
  sunucuHatasi,
  yetkiHatasi,
  rolHatasi,
  validasyonHatasi,
} from "@/lib/utils/hataIsle";
import { uygunAliciListesi } from "@/lib/cclub/uygunAliciListesi";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { gecerliTur } from "@/lib/tclub/tur/kayit";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Auth kontrolü
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();

    // 2. Rol kontrolü — sadece BM
    const rol = await rolCozucu(adminSupabase, user.id);
    if (rol !== "bm") {
      return rolHatasi("Sadece BM rolü Challenge Club gönderebilir.");
    }

    // 3. Query parametresi
    const { searchParams } = new URL(request.url);
    const yayin_id = searchParams.get("yayin_id");

    if (!yayin_id) {
      return validasyonHatasi("yayin_id zorunludur.", ["yayin_id"]);
    }

    // 4. Gönderenin firma_id'sini çek (uygunAliciListesi firma içi BM'leri istiyor)
    const { data: kullanici, error: kullaniciError } = await adminSupabase
      .from("kullanicilar")
      .select("firma_id, aktif_mi")
      .eq("kullanici_id", user.id)
      .single();

    const kullaniciKontrol = veriKontrol(
      kullanici,
      "kullanicilar SELECT — firma_id kontrolü",
      "Kullanıcı bilgisi bulunamadı."
    );
    if (!kullaniciKontrol.gecerli) return kullaniciKontrol.yanit;
    if (kullaniciError) {
      return hataYaniti(
        "Kullanıcı bilgisi çekilirken hata oluştu.",
        "kullanicilar SELECT",
        kullaniciError
      );
    }

    if (!kullanici.firma_id) {
      return hataYaniti(
        "Kullanıcının firma bilgisi eksik.",
        "kullanicilar — firma_id null",
        null
      );
    }
    if (!kullanici.aktif_mi) return rolHatasi("Aktif olmayan kullanıcı challenge gönderemez.");

    const { data: firma, error: firmaError } = await adminSupabase
      .from("firmalar")
      .select("aktif, cc_aktif")
      .eq("firma_id", kullanici.firma_id)
      .single();
    if (firmaError || !firma) return hataYaniti("Firma bilgisi alınamadı.", "firmalar SELECT — CC uygun alıcılar", firmaError);
    if (!firma.aktif || !firma.cc_aktif) return rolHatasi("Firmanızda C-Club erişimi kapalıdır.");

    // Geçerli tur başlangıcını çöz
    const turSonuc = await gecerliTur(adminSupabase, yayin_id);
    const turBaslangici = turSonuc.tur?.baslangic_tarihi;

    // 5. Lib'e delege et
    const aliciler = await uygunAliciListesi(
      adminSupabase,
      user.id,
      kullanici.firma_id,
      yayin_id,
      turBaslangici
    );

    return NextResponse.json({ aliciler }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /challenge-club/api/uygun-aliciler");
  }
}
