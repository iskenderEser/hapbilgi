// app/talepler/api/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";
import { cokluBildirimOlustur } from "@/lib/utils/bildirimOlustur";

export async function GET() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (!["pm", "jr_pm", "kd_pm", "iu"].includes(rol)) return rolHatasi("Sadece PM ve IU taleplerine erişebilir.");

    let query = adminSupabase
      .from("talepler")
      .select(`
        talep_id, pm_id, takim_id, aciklama, hazir_video, hazir_video_url, dosya_urls, created_at,
        urun_id, teknik_id,
        urunler(urun_adi),
        teknikler(teknik_adi)
      `)
      .order("created_at", { ascending: false });

    if (["pm", "jr_pm", "kd_pm"].includes(rol)) {
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
      urun_adi: t.urunler?.urun_adi ?? t.urun_adi ?? "-",
      teknik_adi: t.teknikler?.teknik_adi ?? t.teknik_adi ?? "-",
      aciklama: t.aciklama,
      hazir_video: t.hazir_video,
      hazir_video_url: t.hazir_video_url,
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
    if (!["pm", "jr_pm", "kd_pm"].includes(rol)) return rolHatasi("Sadece PM talep oluşturabilir.");

    const { data: pmKullanici, error: pmError } = await adminSupabase
      .from("kullanicilar")
      .select("takim_id, firma_id")
      .eq("kullanici_id", user.id)
      .single();

    const pmKontrol = veriKontrol(pmKullanici, "kullanicilar tablosu SELECT — pm takim_id", "PM kullanıcı kaydı bulunamadı.");
    if (!pmKontrol.gecerli) return pmKontrol.yanit;
    if (pmError) return hataYaniti("PM bilgisi sorgulanırken hata oluştu.", "kullanicilar tablosu SELECT", pmError);
    if (!pmKullanici.takim_id) return validasyonHatasi("PM'in takım kaydı eksik. Lütfen admin ile iletişime geçin.", ["takim_id"]);

    const body = await request.json();
    const { urun_id, teknik_id, aciklama, hazir_video } = body;

    if (!urun_id) return validasyonHatasi("Ürün seçimi zorunludur.", ["urun_id"]);
    if (!teknik_id) return validasyonHatasi("Teknik seçimi zorunludur.", ["teknik_id"]);

    const { data: yeniTalep, error } = await adminSupabase
      .from("talepler")
      .insert({
        pm_id: user.id,
        takim_id: pmKullanici.takim_id,
        urun_id,
        teknik_id,
        aciklama: aciklama?.trim() ?? null,
        hazir_video: hazir_video ?? false,
      })
      .select(`
        talep_id, takim_id, hazir_video, created_at,
        urun_id, teknik_id,
        urunler(urun_adi),
        teknikler(teknik_adi)
      `)
      .single();

    if (error) return hataYaniti("Talep oluşturulamadı.", "talepler tablosu INSERT", error);

    const urun_adi = (yeniTalep as any).urunler?.urun_adi ?? "-";

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
        urun_adi,
        teknik_adi: (yeniTalep as any).teknikler?.teknik_adi ?? "-",
      }
    }, { status: 201 });

  } catch (err) {
    return sunucuHatasi(err, "POST /talepler/api");
  }
}