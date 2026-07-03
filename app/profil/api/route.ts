// app/profil/api/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";
import { haftaBaslangici, ayBaslangici, yilBaslangici } from "@/lib/zaman/kontrol";

export async function GET() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();

    // v_kullanici_detay view'ı firma_adi, takim_adi, bolge_adi'yı join'liyor — 3 ayrı SELECT yerine tek view sorgusu
    const { data: kullanici, error: kullaniciError } = await adminSupabase
      .from("v_kullanici_detay")
      .select("kullanici_id, ad, soyad, eposta, rol, firma_id, firma_adi, takim_id, takim_adi, bolge_id, bolge_adi, fotograf_url")
      .eq("kullanici_id", user.id)
      .single();

    if (kullaniciError || !kullanici) return hataYaniti("Kullanıcı bilgisi alınamadı.", "v_kullanici_detay SELECT", kullaniciError);

    // Firmanın HBStore, Challenge Club ve E-Club açık/kapalı durumu — Navbar ve ilgili yüzeyler bunu okur
    let hbstore_aktif = false;
    let cc_aktif = false;
    let eclub_aktif = false;
    if (kullanici.firma_id) {
      const { data: firma } = await adminSupabase
        .from("firmalar")
        .select("hbstore_aktif, cc_aktif, eclub_aktif")
        .eq("firma_id", kullanici.firma_id)
        .single();
      hbstore_aktif = firma?.hbstore_aktif ?? false;
      cc_aktif = firma?.cc_aktif ?? false;
      eclub_aktif = firma?.eclub_aktif ?? false;
    }

    const profilTemel = { ...kullanici, hbstore_aktif, cc_aktif, eclub_aktif };

    if (!["utt", "kd_utt"].includes(rol)) {
      return NextResponse.json({ profil: profilTemel }, { status: 200 });
    }

    // UTT/KD_UTT için ek veriler — zaman sınırları lib'den
    const haftaBasi = haftaBaslangici(new Date()).toISOString();
    const ayBasi = ayBaslangici().toISOString();
    const yilBasi = yilBaslangici().toISOString();

    // İzleme sayıları
    const { count: haftaIzleme } = await adminSupabase
      .from("izleme_kayitlari")
      .select("izleme_id", { count: "exact", head: true })
      .eq("kullanici_id", user.id)
      .eq("tamamlandi_mi", true)
      .gte("created_at", haftaBasi);

    const { count: ayIzleme } = await adminSupabase
      .from("izleme_kayitlari")
      .select("izleme_id", { count: "exact", head: true })
      .eq("kullanici_id", user.id)
      .eq("tamamlandi_mi", true)
      .gte("created_at", ayBasi);

    const { count: ytdIzleme } = await adminSupabase
      .from("izleme_kayitlari")
      .select("izleme_id", { count: "exact", head: true })
      .eq("kullanici_id", user.id)
      .eq("tamamlandi_mi", true)
      .gte("created_at", yilBasi);

    // Puan dağılımı (YTD)
    const { data: puanlar } = await adminSupabase
      .from("kazanilan_puanlar")
      .select("puan_turu, puan")
      .eq("kullanici_id", user.id)
      .gte("created_at", yilBasi);

    let izleme_puani = 0;
    let cevaplama_puani = 0;
    let oneri_puani = 0;
    let extra_puani = 0;

    for (const p of puanlar ?? []) {
      if (p.puan_turu === "izleme") izleme_puani += p.puan;
      else if (p.puan_turu === "cevaplama") cevaplama_puani += p.puan;
      else if (p.puan_turu === "oneri") oneri_puani += p.puan;
      else if (p.puan_turu === "extra") extra_puani += p.puan;
    }

    // Sıralama
    const { data: siralama } = await adminSupabase
      .from("v_hbligi_sirali")
      .select("firma_sirasi, takim_sirasi, bolge_sirasi")
      .eq("kullanici_id", user.id)
      .single();

    return NextResponse.json({
      profil: profilTemel,
      izleme: {
        haftalik: haftaIzleme ?? 0,
        aylik: ayIzleme ?? 0,
        ytd: ytdIzleme ?? 0,
      },
      puan_dagilimi: {
        izleme_puani,
        cevaplama_puani,
        oneri_puani,
        extra_puani,
      },
      siralama: {
        firma_sirasi: siralama?.firma_sirasi ?? null,
        takim_sirasi: siralama?.takim_sirasi ?? null,
        bolge_sirasi: siralama?.bolge_sirasi ?? null,
      },
    }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /profil/api");
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const body = await request.json();
    const { fotograf_url, mevcut_sifre, yeni_sifre } = body;

    if (fotograf_url !== undefined) {
      const { error: updateError } = await adminSupabase
        .from("kullanicilar")
        .update({ fotograf_url })
        .eq("kullanici_id", user.id);
      if (updateError) return hataYaniti("Fotoğraf güncellenemedi.", "kullanicilar tablosu UPDATE — fotograf_url", updateError);
      return NextResponse.json({ mesaj: "Fotoğraf güncellendi." }, { status: 200 });
    }

    if (mevcut_sifre && yeni_sifre) {
      const { error: sifreError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: mevcut_sifre,
      });
      if (sifreError) return hataYaniti("Mevcut şifre hatalı.", "auth.signInWithPassword — şifre doğrulama", sifreError, 400);

      const { error: updateError } = await adminSupabase.auth.admin.updateUserById(user.id, { password: yeni_sifre });
      if (updateError) return hataYaniti("Şifre güncellenemedi.", "auth.admin.updateUserById — şifre güncelleme", updateError);
      return NextResponse.json({ mesaj: "Şifre güncellendi." }, { status: 200 });
    }

    return hataYaniti("Geçersiz istek.", "PUT /profil/api — body kontrolü", null, 400);

  } catch (err) {
    return sunucuHatasi(err, "PUT /profil/api");
  }
}