// app/talepler/api/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";
import { cokluBildirimOlustur } from "@/lib/utils/bildirimOlustur";
import { PM_ROLLERI } from "@/lib/utils/roller";

export async function GET() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (![...PM_ROLLERI, "iu"].includes(rol)) return rolHatasi("Sadece yetkili roller ve IU taleplerine erişebilir.");

    let query = adminSupabase
      .from("talepler")
      .select(`
        talep_id, pm_id, takim_id, aciklama, hazir_video, hazir_video_url, dosya_urls, created_at,
        urun_id, teknik_id, kategori_id, egitim_turu,
        hazir_soru_seti,
        soru_seti_buyuklugu, video_basi_soru_sayisi,
        urunler(urun_adi),
        teknikler(teknik_adi),
        kategoriler(kategori_adi)
      `)
      .order("created_at", { ascending: false });

    if (PM_ROLLERI.includes(rol)) {
      query = query.eq("pm_id", user.id);
    }

    const { data: talepler, error } = await query;
    if (error) return hataYaniti("Talepler çekilemedi.", "talepler tablosu SELECT", error);

    const sonuc = (talepler ?? []).map((t: any) => ({
      talep_id: t.talep_id,
      pm_id: t.pm_id,
      takim_id: t.takim_id,
      urun_id: t.urun_id,
      teknik_id: t.teknik_id,
      kategori_id: t.kategori_id ?? null,
      egitim_turu: t.egitim_turu ?? "urun_egitimi",
      urun_adi: t.urunler?.urun_adi ?? t.urun_adi ?? "-",
      teknik_adi: t.teknikler?.teknik_adi ?? t.teknik_adi ?? "-",
      kategori_adi: t.kategoriler?.kategori_adi ?? null,
      aciklama: t.aciklama,
      hazir_video: t.hazir_video,
      hazir_video_url: t.hazir_video_url,
      hazir_soru_seti: t.hazir_soru_seti ?? false,
      soru_seti_buyuklugu: t.soru_seti_buyuklugu ?? 25,
      video_basi_soru_sayisi: t.video_basi_soru_sayisi ?? 2,
      dosya_urls: t.dosya_urls,
      created_at: t.created_at,
    }));

    return NextResponse.json({ talepler: sonuc }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /talepler/api");
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (!PM_ROLLERI.includes(rol)) return rolHatasi("Sadece yetkili roller talep oluşturabilir.");

    const { data: pmKullanici, error: pmError } = await adminSupabase
      .from("kullanicilar")
      .select("takim_id, firma_id")
      .eq("kullanici_id", user.id)
      .single();

    const pmKontrol = veriKontrol(pmKullanici, "kullanicilar tablosu SELECT — pm takim_id", "Kullanıcı kaydı bulunamadı.");
    if (!pmKontrol.gecerli) return pmKontrol.yanit;
    if (pmError) return hataYaniti("Kullanıcı bilgisi sorgulanırken hata oluştu.", "kullanicilar tablosu SELECT", pmError);
    if (!pmKullanici.takim_id) return validasyonHatasi("Takım kaydı eksik. Lütfen admin ile iletişime geçin.", ["takim_id"]);

    const body = await request.json();
    const {
      egitim_turu,
      urun_id, teknik_id, kategori_id, aciklama,
      hazir_video, hazir_soru_seti, hazir_soru_seti_verisi,
      soru_seti_buyuklugu, video_basi_soru_sayisi,
    } = body;

    // egitim_turu validasyonu
    const egitimTuru = egitim_turu ?? "urun_egitimi";
    if (!["urun_egitimi", "genel_egitim"].includes(egitimTuru)) {
      return validasyonHatasi("Eğitim türü geçersiz.", ["egitim_turu"]);
    }

    // Ürün ve teknik yalnızca urun_egitimi için zorunlu
    if (egitimTuru === "urun_egitimi") {
      if (!urun_id) return validasyonHatasi("Ürün seçimi zorunludur.", ["urun_id"]);
      if (!teknik_id) return validasyonHatasi("Teknik seçimi zorunludur.", ["teknik_id"]);
    }

    if (hazir_soru_seti && !hazir_soru_seti_verisi) {
      return validasyonHatasi("Hazır soru seti verisi zorunludur.", ["hazir_soru_seti_verisi"]);
    }

    const soruSetiBuyuklugu = soru_seti_buyuklugu ?? 25;
    const videoBasisSoruSayisi = video_basi_soru_sayisi ?? 2;

    if (![10, 15, 20, 25].includes(soruSetiBuyuklugu)) return validasyonHatasi("Soru seti büyüklüğü 10, 15, 20 veya 25 olmalıdır.", ["soru_seti_buyuklugu"]);
    if (videoBasisSoruSayisi < 1 || videoBasisSoruSayisi > soruSetiBuyuklugu) return validasyonHatasi(`Video başı soru sayısı 1 ile ${soruSetiBuyuklugu} arasında olmalıdır.`, ["video_basi_soru_sayisi"]);

    const { data: yeniTalep, error } = await adminSupabase
      .from("talepler")
      .insert({
        pm_id: user.id,
        takim_id: pmKullanici.takim_id,
        egitim_turu: egitimTuru,
        urun_id: egitimTuru === "urun_egitimi" ? urun_id : null,
        teknik_id: egitimTuru === "urun_egitimi" ? teknik_id : null,
        kategori_id: kategori_id ?? null,
        aciklama: aciklama?.trim() ?? null,
        hazir_video: hazir_video ?? false,
        hazir_soru_seti: hazir_soru_seti ?? false,
        hazir_soru_seti_verisi: hazir_soru_seti_verisi ?? null,
        soru_seti_buyuklugu: soruSetiBuyuklugu,
        video_basi_soru_sayisi: videoBasisSoruSayisi,
      })
      .select(`
        talep_id, takim_id, hazir_video, created_at,
        urun_id, teknik_id, kategori_id, egitim_turu,
        hazir_soru_seti, hazir_soru_seti_verisi,
        soru_seti_buyuklugu, video_basi_soru_sayisi,
        urunler(urun_adi),
        teknikler(teknik_adi),
        kategoriler(kategori_adi)
      `)
      .single();

    if (error) return hataYaniti("Talep oluşturulamadı.", "talepler tablosu INSERT", error);

    const urun_adi = egitimTuru === "urun_egitimi"
      ? ((yeniTalep as any).urunler?.urun_adi ?? "-")
      : "Genel Eğitim";

    // Tüm IU kullanıcılarına bildirim gönder
    const { data: iuKullanicilar } = await adminSupabase
      .from("kullanicilar")
      .select("kullanici_id")
      .eq("rol", "iu")
      .eq("aktif_mi", true);

    const iuIdler = (iuKullanicilar ?? []).map((k: any) => k.kullanici_id);

    await cokluBildirimOlustur({
      adminSupabase,
      alici_idler: iuIdler,
      gonderen_id: user.id,
      kayit_turu: "talep",
      kayit_id: (yeniTalep as any).talep_id,
      mesaj: `Yeni talep: ${urun_adi}`,
    });

    return NextResponse.json({
      mesaj: "Talep oluşturuldu.",
      talep: {
        ...yeniTalep,
        egitim_turu: egitimTuru,
        urun_adi,
        teknik_adi: egitimTuru === "urun_egitimi"
          ? ((yeniTalep as any).teknikler?.teknik_adi ?? "-")
          : "-",
        kategori_adi: (yeniTalep as any).kategoriler?.kategori_adi ?? null,
      }
    }, { status: 201 });

  } catch (err) {
    return sunucuHatasi(err, "POST /talepler/api");
  }
}