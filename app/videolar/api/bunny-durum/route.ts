// app/videolar/api/bunny-durum/route.ts
//
// A3 — videonun Bunny tarafındaki işlenme durumu (docs/bunny_dogrudan_yukleme_is_plani.md).
// Kart açılışında bir kez sorgulanır (polling yok): encode bitmediyse istemci
// "video işleniyor" rozetini gösterir. Bunny-dışı / eski kayıtlar hazir=true sayılır
// (rozet çıkmaz — davranış değişmez).

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";
import { URETICI_ROLLER } from "@/lib/utils/roller";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { bunnyVideoDurumu, embedUrlGuidCikar } from "@/lib/video/bunnyYukleme";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (![...URETICI_ROLLER, "iu"].includes(rol)) return rolHatasi("Sadece yetkili roller ve IU video durumunu görebilir.");

    const { searchParams } = new URL(request.url);
    const video_id = searchParams.get("video_id");
    if (!video_id) return validasyonHatasi("video_id zorunludur.", ["video_id"]);

    const { data: video, error: videoError } = await adminSupabase
      .from("videolar")
      .select("video_id, video_url")
      .eq("video_id", video_id)
      .single();

    const videoKontrol = veriKontrol(video, "videolar tablosu SELECT — video_id", "Video kaydı bulunamadı.");
    if (!videoKontrol.gecerli) return videoKontrol.yanit;
    if (videoError) return hataYaniti("Video sorgulanamadı.", "videolar tablosu SELECT", videoError, 404);

    const guid = embedUrlGuidCikar(video.video_url);
    if (!guid) {
      // Bunny-dışı/eski kayıt: işlenme kavramı yok — hazır kabul edilir.
      return NextResponse.json({ hazir: true, hatali: false, bunny_kaydi: false }, { status: 200 });
    }

    const durum = await bunnyVideoDurumu(guid);
    if (!durum.ok) return hataYaniti(durum.hata, durum.adim, durum.detay ? { message: durum.detay } : null);

    return NextResponse.json({
      hazir: durum.hazir,
      hatali: durum.hatali,
      bunny_kaydi: true,
      bunny_durum: durum.bunnyDurum,
    }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /videolar/api/bunny-durum");
  }
}
