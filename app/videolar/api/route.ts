// app/videolar/api/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (!["pm", "jr_pm", "kd_pm", "iu"].includes(rol)) return rolHatasi("Sadece PM ve IU videolara erişebilir.");

    const { searchParams } = new URL(request.url);
    const senaryo_durum_id = searchParams.get("senaryo_durum_id");

    let query = adminSupabase
      .from("videolar")
      .select("video_id, senaryo_durum_id, iu_id, video_url, thumbnail_url, created_at")
      .order("created_at", { ascending: false });

    if (senaryo_durum_id) {
      query = query.eq("senaryo_durum_id", senaryo_durum_id);
    } else if (["pm", "jr_pm", "kd_pm"].includes(rol)) {
      // PM kendi taleplerinin zincirini takip eder
      const { data: talepler, error: talepError } = await adminSupabase
        .from("talepler")
        .select("talep_id")
        .eq("pm_id", user.id);

      if (talepError) return hataYaniti("PM'in talepleri çekilemedi.", "talepler tablosu SELECT — pm_id filtresi", talepError);

      const talepIdler = (talepler ?? []).map((t: any) => t.talep_id);
      if (talepIdler.length === 0) return NextResponse.json({ videolar: [] }, { status: 200 });

      const { data: senaryolar, error: senaryoError } = await adminSupabase
        .from("senaryolar")
        .select("senaryo_id")
        .in("talep_id", talepIdler);

      if (senaryoError) return hataYaniti("Senaryolar çekilemedi.", "senaryolar tablosu SELECT — talep_id filtresi", senaryoError);

      const senaryoIdler = (senaryolar ?? []).map((s: any) => s.senaryo_id);
      if (senaryoIdler.length === 0) return NextResponse.json({ videolar: [] }, { status: 200 });

      const { data: senaryoDurumlari, error: sdError } = await adminSupabase
        .from("senaryo_durumu")
        .select("senaryo_durum_id")
        .in("senaryo_id", senaryoIdler)
        .eq("durum", "Onaylandi");

      if (sdError) return hataYaniti("Senaryo durumları çekilemedi.", "senaryo_durumu tablosu SELECT — Onaylandi filtresi", sdError);

      const senaryoDurumIdler = (senaryoDurumlari ?? []).map((sd: any) => sd.senaryo_durum_id);
      if (senaryoDurumIdler.length === 0) return NextResponse.json({ videolar: [] }, { status: 200 });

      query = query.in("senaryo_durum_id", senaryoDurumIdler);
    }

    const { data: videolar, error } = await query;
    if (error) return hataYaniti("Videolar çekilemedi.", "videolar tablosu SELECT", error);

    return NextResponse.json({ videolar: videolar ?? [] }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /videolar/api");
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (rol !== "iu") return rolHatasi("Sadece IU video URL'i girebilir.");

    const body = await request.json();
    const { video_id, video_url, thumbnail_url } = body;

    if (!video_id) return validasyonHatasi("video_id zorunludur.", ["video_id"]);
    if (!video_url || video_url.trim() === "") return validasyonHatasi("video_url zorunludur.", ["video_url"]);

    // Video var mı kontrol et
    const { data: mevcutVideo, error: videoGetError } = await adminSupabase
      .from("videolar")
      .select("video_id")
      .eq("video_id", video_id)
      .single();

    const videoKontrol = veriKontrol(mevcutVideo, "videolar tablosu SELECT — video_id kontrolü", "Video bulunamadı.");
    if (!videoKontrol.gecerli) return videoKontrol.yanit;
    if (videoGetError) return hataYaniti("Video sorgulanırken hata oluştu.", "videolar tablosu SELECT", videoGetError, 404);

    const { data: video, error: updateError } = await adminSupabase
      .from("videolar")
      .update({
        video_url: video_url.trim(),
        thumbnail_url: thumbnail_url?.trim() ?? null,
        iu_id: user.id,
      })
      .eq("video_id", video_id)
      .select("video_id, video_url, thumbnail_url")
      .single();

    if (updateError) return hataYaniti("Video URL güncellenemedi.", "videolar tablosu UPDATE", updateError);

    const guncellenenKontrol = veriKontrol(video, "videolar tablosu UPDATE — dönen veri", "Video güncellendi ancak veri döndürülemedi.");
    if (!guncellenenKontrol.gecerli) return guncellenenKontrol.yanit;

    return NextResponse.json({ mesaj: "Video URL kaydedildi.", video }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "PUT /videolar/api");
  }
}