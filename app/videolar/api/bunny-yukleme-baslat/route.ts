// app/videolar/api/bunny-yukleme-baslat/route.ts
//
// A1 — Bunny doğrudan yükleme başlatma ("vezne" ucu; docs/bunny_dogrudan_yukleme_is_plani.md).
// IU dosya yüklemek istediğinde: (1) kimlik + rol, (2) sıra kontrolü (bu videonun
// gerçekten yükleme sırası mı), (3) Bunny kaydını SİSTEM açar ve adı SİSTEM koyar,
// (4) tek videoya özel süreli TUS imzası döner. API anahtarı istemciye asla inmez.
// Uç, ekrandan bağımsız çağrılabilir — ileride yapay IU aynı sözleşmeyle kullanır.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { bunnyYuklemeBaslat, BUNNY_TUS_ENDPOINT } from "@/lib/video/bunnyYukleme";
import { talepBilgisiVideo } from "@/lib/utils/talepZinciri";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    // 1) Kimlik + rol
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (rol !== "iu") return rolHatasi("Sadece IU video yükleme başlatabilir.");

    const body = await request.json();
    const { video_id } = body;
    if (!video_id) return validasyonHatasi("video_id zorunludur.", ["video_id"]);

    // 2) Sıra kontrolü — istemcideki iuGonderebilir kuralının sunucu karşılığı:
    // video_url boşsa (ilk yükleme) ya da son durum "revizyon bekleniyor" ise izin.
    const { data: video, error: videoError } = await adminSupabase
      .from("videolar")
      .select("video_id, senaryo_durum_id, video_url")
      .eq("video_id", video_id)
      .single();

    const videoKontrol = veriKontrol(video, "videolar tablosu SELECT — video_id", "Video kaydı bulunamadı.");
    if (!videoKontrol.gecerli) return videoKontrol.yanit;
    if (videoError) return hataYaniti("Video sorgulanamadı.", "videolar tablosu SELECT", videoError, 404);

    if (video.video_url) {
      const { data: sonDurum, error: durumError } = await adminSupabase
        .from("video_durumu")
        .select("durum")
        .eq("video_id", video_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (durumError) return hataYaniti("Video durumu sorgulanamadı.", "video_durumu SELECT", durumError);
      if (sonDurum?.durum !== "revizyon bekleniyor") {
        return validasyonHatasi("Bu videonun yükleme sırası değil — yalnız ilk yükleme ya da revizyon bekleyen video yüklenebilir.", ["video_id"]);
      }
    }

    // 3) Ad üretimi — kütüphane düzeni sisteme aittir: ürün adı + versiyon no.
    // Ürün adı talepten gelir (talep_id doğrudan bağ — Adım 5; v_uretim_detay kalktı).
    const talepBilgisi = await talepBilgisiVideo(adminSupabase, video_id);

    const { count } = await adminSupabase
      .from("videolar")
      .select("video_id", { count: "exact", head: true })
      .eq("senaryo_durum_id", video.senaryo_durum_id);

    const baslik = `${talepBilgisi?.urun_adi ?? "video"}_v${count ?? 1}`;

    // 4) Bunny kaydı + süreli imza
    const kayit = await bunnyYuklemeBaslat(baslik);
    if (!kayit.ok) return hataYaniti(kayit.hata, kayit.adim, kayit.detay ? { message: kayit.detay } : null);

    // Tutanak: kim, hangi video satırı, hangi Bunny kimliği, ne zaman.
    console.log(`[bunny-yukleme-baslat] iu=${user.id} video_id=${video_id} guid=${kayit.videoGuid} baslik="${baslik}"`);

    return NextResponse.json({
      video_guid: kayit.videoGuid,
      library_id: kayit.libraryId,
      imza: kayit.imza,
      son_kullanma: kayit.sonKullanma,
      tus_endpoint: BUNNY_TUS_ENDPOINT,
      embed_url: kayit.embedUrl,
      baslik,
    }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "POST /videolar/api/bunny-yukleme-baslat");
  }
}
