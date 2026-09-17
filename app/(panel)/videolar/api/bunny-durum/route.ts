// app/videolar/api/bunny-durum/route.ts
//
// A3 — videonun Bunny tarafındaki işlenme durumu (docs/bunny_dogrudan_yukleme_is_plani.md).
// Kart açılışında bir kez sorgulanır (polling yok): encode bitmediyse istemci
// "video işleniyor" rozetini gösterir. Bunny-dışı / eski kayıtlar hazir=true sayılır
// (rozet çıkmaz — davranış değişmez).
// A4: talep_id ile de sorgulanabilir — hazır videonun (talepler.hazir_video_url)
// encode durumu PM onay ekranında aynı rozetle gösterilir.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";
import { URETIM_HATTI_GORENLER } from "@/lib/utils/roller";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { bunnyVideoDurumu, embedUrlGuidCikar } from "@/lib/video/bunnyYukleme";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!URETIM_HATTI_GORENLER.includes(rol)) return rolHatasi("Sadece yetkili roller ve IU video durumunu görebilir.");

    const { searchParams } = new URL(request.url);
    const arac_id = searchParams.get("arac_id");
    const talep_id = searchParams.get("talep_id");
    if (!arac_id && !talep_id) return validasyonHatasi("arac_id ya da talep_id zorunludur.", ["arac_id", "talep_id"]);

    let videoUrl: string | null = null;
    if (arac_id) {
      const { data: video, error: videoError } = await adminSupabase
        .from("ogrenme_araclari")
        .select("arac_id, dosya_yolu")
        .eq("arac_id", arac_id)
        .eq("arac_turu", "video")
        .single();

      const videoKontrol = veriKontrol(video, "ogrenme_araclari SELECT — arac_id", "Video kaydı bulunamadı.");
      if (!videoKontrol.gecerli) return videoKontrol.yanit;
      if (videoError) return hataYaniti("Video sorgulanamadı.", "ogrenme_araclari SELECT", videoError, 404);
      videoUrl = video.dosya_yolu;
    } else {
      const { data: talep, error: talepError } = await adminSupabase
        .from("talepler")
        .select("talep_id, hazir_video_url")
        .eq("talep_id", talep_id!)
        .single();

      const talepKontrol = veriKontrol(talep, "talepler tablosu SELECT — talep_id", "Talep bulunamadı.");
      if (!talepKontrol.gecerli) return talepKontrol.yanit;
      if (talepError) return hataYaniti("Talep sorgulanamadı.", "talepler tablosu SELECT", talepError, 404);
      videoUrl = talep.hazir_video_url;
    }

    const guid = embedUrlGuidCikar(videoUrl);
    if (!guid) {
      // Bunny-dışı/eski kayıt: işlenme kavramı yok — hazır kabul edilir.
      return NextResponse.json({ hazir: true, hatali: false, bunny_kaydi: false }, { status: 200 });
    }

    const durum = await bunnyVideoDurumu(guid);
    if (!durum.ok) return hataYaniti(durum.hata, durum.adim, durum.detay ? { message: durum.detay } : null);

    // Tek yazıcı ilkesi (Faz 3): süreyi burada YAZMIYORUZ. Bu uç yalnız işlenme
    // durumunu (rozet) döndürür; süreyi yayın‑kapısı + webhook + backfill yazar.
    return NextResponse.json({
      hazir: durum.hazir,
      hatali: durum.hatali,
      bunny_kaydi: true,
      bunny_durum: durum.bunnyDurum,
      video_suresi_saniye: durum.videoSuresiSaniye,
    }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /videolar/api/bunny-durum");
  }
}
