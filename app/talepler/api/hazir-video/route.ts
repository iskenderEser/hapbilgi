// app/talepler/api/hazir-video/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";

// PUT: IU video URL kaydeder
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (rol !== "iu") return rolHatasi("Sadece IU video URL girebilir.");

    const body = await request.json();
    const { talep_id, hazir_video_url } = body;

    if (!talep_id) return validasyonHatasi("talep_id zorunludur.", ["talep_id"]);
    if (!hazir_video_url) return validasyonHatasi("hazir_video_url zorunludur.", ["hazir_video_url"]);

    const { data: talep, error: talepError } = await adminSupabase
      .from("talepler")
      .select("talep_id, hazir_video")
      .eq("talep_id", talep_id)
      .single();

    if (talepError || !talep) return hataYaniti("Talep bulunamadı.", "talepler tablosu SELECT — talep_id", talepError);
    if (!talep.hazir_video) return isKuraluHatasi("Bu talep hazır video talebi değil.");

    const { error: updateError } = await adminSupabase
      .from("talepler")
      .update({ hazir_video_url: hazir_video_url.trim() })
      .eq("talep_id", talep_id);

    if (updateError) return hataYaniti("Video URL kaydedilemedi.", "talepler tablosu UPDATE — hazir_video_url", updateError);

    return NextResponse.json({ mesaj: "Video URL kaydedildi." }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "PUT /talepler/api/hazir-video");
  }
}

// POST: PM onayla veya reddet
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (!["pm", "jr_pm", "kd_pm"].includes(rol)) return rolHatasi("Sadece PM onaylayabilir.");

    const body = await request.json();
    const { talep_id, karar } = body;

    if (!talep_id) return validasyonHatasi("talep_id zorunludur.", ["talep_id"]);
    if (!["onayla", "reddet"].includes(karar)) return validasyonHatasi("karar 'onayla' veya 'reddet' olmalıdır.", ["karar"]);

    const { data: talep, error: talepError } = await adminSupabase
      .from("talepler")
      .select("talep_id, pm_id, urun_adi, teknik_adi, hazir_video, hazir_video_url, takim_id")
      .eq("talep_id", talep_id)
      .single();

    if (talepError || !talep) return hataYaniti("Talep bulunamadı.", "talepler tablosu SELECT — talep_id", talepError);
    if (!talep.hazir_video) return isKuraluHatasi("Bu talep hazır video talebi değil.");
    if (talep.pm_id !== user.id) return rolHatasi("Bu talebi onaylama yetkiniz yok.");
    if (!talep.hazir_video_url) return isKuraluHatasi("IU henüz video URL'i girmemiş.");

    if (karar === "reddet") {
      // URL'i temizle, IU tekrar yükleyebilsin
      const { error: resetError } = await adminSupabase
        .from("talepler")
        .update({ hazir_video_url: null })
        .eq("talep_id", talep_id);

      if (resetError) return hataYaniti("Red işlemi gerçekleştirilemedi.", "talepler tablosu UPDATE — hazir_video_url reset", resetError);
      return NextResponse.json({ mesaj: "Video reddedildi. IU yeni URL girebilir." }, { status: 200 });
    }

    // Onaylama — zinciri otomatik oluştur
    // 1. senaryolar — boş senaryo
    const { data: senaryo, error: senaryoError } = await adminSupabase
      .from("senaryolar")
      .insert({
        talep_id,
        iu_id: null,
        senaryo_metni: "[Hazır Video — Senaryo Atlandı]",
      })
      .select("senaryo_id")
      .single();

    if (senaryoError || !senaryo) return hataYaniti("Senaryo oluşturulamadı.", "senaryolar tablosu INSERT", senaryoError);

    // 2. senaryo_durumu — Onaylandi
    const { data: senaryoDurum, error: sdError } = await adminSupabase
      .from("senaryo_durumu")
      .insert({
        senaryo_id: senaryo.senaryo_id,
        durum: "Onaylandi",
        degistiren_id: user.id,
        notlar: "Hazır video talebi — otomatik onay",
      })
      .select("senaryo_durum_id")
      .single();

    if (sdError || !senaryoDurum) return hataYaniti("Senaryo durumu oluşturulamadı.", "senaryo_durumu tablosu INSERT", sdError);

    // 3. videolar
    const { data: video, error: videoError } = await adminSupabase
      .from("videolar")
      .insert({
        senaryo_durum_id: senaryoDurum.senaryo_durum_id,
        iu_id: null,
        video_url: talep.hazir_video_url,
        thumbnail_url: null,
      })
      .select("video_id")
      .single();

    if (videoError || !video) return hataYaniti("Video oluşturulamadı.", "videolar tablosu INSERT", videoError);

    // 4. video_durumu — Onaylandi
    const { data: videoDurum, error: vdError } = await adminSupabase
      .from("video_durumu")
      .insert({
        video_id: video.video_id,
        durum: "Onaylandi",
        degistiren_id: user.id,
        notlar: "Hazır video talebi — otomatik onay",
      })
      .select("video_durum_id")
      .single();

    if (vdError || !videoDurum) return hataYaniti("Video durumu oluşturulamadı.", "video_durumu tablosu INSERT", vdError);

    // 5. soru_setleri — boş sorular
    const { data: soruSeti, error: ssError } = await adminSupabase
      .from("soru_setleri")
      .insert({
        video_durum_id: videoDurum.video_durum_id,
        iu_id: null,
        sorular: [],
      })
      .select("soru_seti_id")
      .single();

    if (ssError || !soruSeti) return hataYaniti("Soru seti oluşturulamadı.", "soru_setleri tablosu INSERT", ssError);

    return NextResponse.json({
      mesaj: "Video onaylandı. Soru seti yazım süreci başlayabilir.",
      soru_seti_id: soruSeti.soru_seti_id,
      video_durum_id: videoDurum.video_durum_id,
    }, { status: 201 });

  } catch (err) {
    return sunucuHatasi(err, "POST /talepler/api/hazir-video");
  }
}