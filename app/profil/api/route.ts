// app/profil/api/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";

export async function GET() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();

    const { data: kullanici, error: kullaniciError } = await adminSupabase
      .from("kullanicilar")
      .select("kullanici_id, ad, soyad, eposta, rol, firma_id, takim_id, bolge_id, fotograf_url")
      .eq("kullanici_id", user.id)
      .single();

    if (kullaniciError || !kullanici) return hataYaniti("Kullanıcı bilgisi alınamadı.", "kullanicilar tablosu SELECT", kullaniciError);

    let firma_adi = null;
    let takim_adi = null;
    let bolge_adi = null;

    if (kullanici.firma_id) {
      const { data: firma } = await adminSupabase.from("firmalar").select("firma_adi").eq("firma_id", kullanici.firma_id).single();
      firma_adi = firma?.firma_adi ?? null;
    }
    if (kullanici.takim_id) {
      const { data: takim } = await adminSupabase.from("takimlar").select("takim_adi").eq("takim_id", kullanici.takim_id).single();
      takim_adi = takim?.takim_adi ?? null;
    }
    if (kullanici.bolge_id) {
      const { data: bolge } = await adminSupabase.from("bolgeler").select("bolge_adi").eq("bolge_id", kullanici.bolge_id).single();
      bolge_adi = bolge?.bolge_adi ?? null;
    }

    const profilTemel = { ...kullanici, firma_adi, takim_adi, bolge_adi };

    if (!["utt", "kd_utt"].includes(rol)) {
      return NextResponse.json({ profil: profilTemel }, { status: 200 });
    }

    // UTT/KD_UTT için ek veriler
    const simdi = new Date();
    const yilBaslangic = new Date(simdi.getFullYear(), 0, 1).toISOString();
    const ayBaslangic = new Date(simdi.getFullYear(), simdi.getMonth(), 1).toISOString();
    const haftaBaslangic = new Date();
    haftaBaslangic.setDate(haftaBaslangic.getDate() - haftaBaslangic.getDay() + 1);
    haftaBaslangic.setHours(0, 0, 0, 0);

    // İzleme sayıları
    const { count: haftaIzleme } = await adminSupabase
      .from("izleme_kayitlari")
      .select("izleme_id", { count: "exact", head: true })
      .eq("kullanici_id", user.id)
      .eq("tamamlandi_mi", true)
      .gte("created_at", haftaBaslangic.toISOString());

    const { count: ayIzleme } = await adminSupabase
      .from("izleme_kayitlari")
      .select("izleme_id", { count: "exact", head: true })
      .eq("kullanici_id", user.id)
      .eq("tamamlandi_mi", true)
      .gte("created_at", ayBaslangic);

    const { count: ytdIzleme } = await adminSupabase
      .from("izleme_kayitlari")
      .select("izleme_id", { count: "exact", head: true })
      .eq("kullanici_id", user.id)
      .eq("tamamlandi_mi", true)
      .gte("created_at", yilBaslangic);

    // Puan dağılımı (YTD)
    const { data: puanlar } = await adminSupabase
      .from("kazanilan_puanlar")
      .select("puan_turu, puan")
      .eq("kullanici_id", user.id)
      .gte("created_at", yilBaslangic);

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