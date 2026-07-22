// app/videolar/api/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";
import { URETICI_ROLLER } from "@/lib/utils/roller";
import { rolCozucu } from "@/lib/utils/rolCozucu";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (![...URETICI_ROLLER, "iu"].includes(rol)) return rolHatasi("Sadece yetkili roller ve IU videolara erişebilir.");

    const { searchParams } = new URL(request.url);
    const senaryo_durum_id = searchParams.get("senaryo_durum_id");

    // Görünürlük RLS'te (Adım 4): İU tüm videoları, üretici yalnız kendi talebinin
    // videolarını görür. Bu yüzden okuma İU/üretici OTURUMUYLA yapılır (elle süzgeç
    // ve v_uretim_detay kalktı — Adım 5). senaryo_durum_id filtresi ek daraltmadır.
    let query = supabase
      .from("videolar")
      .select("video_id, senaryo_durum_id, iu_id, video_url, thumbnail_url, created_at")
      .order("created_at", { ascending: false });

    if (senaryo_durum_id) {
      query = query.eq("senaryo_durum_id", senaryo_durum_id);
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

    const rol = await rolCozucu(adminSupabase, user.id);
    if (rol !== "iu") return rolHatasi("Sadece IU video URL'i girebilir.");

    const body = await request.json();
    const { video_id, video_url, thumbnail_url } = body;

    if (!video_id) return validasyonHatasi("video_id zorunludur.", ["video_id"]);
    if (!video_url || video_url.trim() === "") return validasyonHatasi("video_url zorunludur.", ["video_url"]);

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