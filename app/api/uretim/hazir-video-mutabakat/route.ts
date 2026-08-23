// app/api/uretim/hazir-video-mutabakat/route.ts
//
// Hazır video MUTABAKATI (self-heal). Webhook ıskalasa bile hazır videoyu
// tamamlar: Bunny'de encode'u bitmiş ama HapBilgi'de videolar kaydı açılmamış
// talepleri bulur ve idempotent üretim zincirini (uretim_hazir_video_kaydet)
// çalıştırır. pg_cron + pg_net ile periyodik tetiklenir; secret'le korunur:
//   POST /api/uretim/hazir-video-mutabakat?secret=<MUTABAKAT_SECRET>

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { bunnyVideoDurumu, bunnyVideoSil, embedUrlGuidCikar } from "@/lib/video/bunnyYukleme";
import { pushYayinlaArkada } from "@/lib/push/orkestrasyon";

const MAX_ISLENEN = 50;

export async function POST(request: NextRequest) {
  try {
    const beklenenGizli = process.env.MUTABAKAT_SECRET;
    if (!beklenenGizli) {
      return NextResponse.json({ hata: "Mutabakat yapılandırılmamış (MUTABAKAT_SECRET yok)." }, { status: 503 });
    }
    const { searchParams } = new URL(request.url);
    const gelenGizli = searchParams.get("secret") ?? request.headers.get("x-mutabakat-secret") ?? "";
    if (gelenGizli !== beklenenGizli) {
      return NextResponse.json({ hata: "Yetkisiz." }, { status: 401 });
    }

    const adminSupabase = createAdminClient();

    const { data: talepler, error: talepError } = await adminSupabase
      .from("talepler")
      .select("talep_id, uretici_id, hazir_video_url")
      .eq("hazir_video", true)
      .not("hazir_video_url", "is", null);
    if (talepError) {
      return NextResponse.json({ hata: "Talepler sorgulanamadı.", detay: talepError.message }, { status: 500 });
    }
    const adayTalepler = (talepler ?? []) as { talep_id: string; uretici_id: string; hazir_video_url: string }[];
    if (adayTalepler.length === 0) {
      return NextResponse.json({ mesaj: "Bekleyen hazır video yok.", tamamlanan: 0 }, { status: 200 });
    }

    const talepIdler = adayTalepler.map((t) => t.talep_id);
    const { data: mevcutVideolar, error: videoError } = await adminSupabase
      .from("videolar")
      .select("talep_id")
      .eq("kaynak", "hazir")
      .in("talep_id", talepIdler);
    if (videoError) {
      return NextResponse.json({ hata: "Video kayıtları sorgulanamadı.", detay: videoError.message }, { status: 500 });
    }
    const kayitliSet = new Set((mevcutVideolar ?? []).map((v: { talep_id: string }) => v.talep_id));
    const bekleyenler = adayTalepler.filter((t) => !kayitliSet.has(t.talep_id)).slice(0, MAX_ISLENEN);

    let tamamlanan = 0;
    let bekliyor = 0;
    let hatali = 0;
    const detaylar: { talep_id: string; sonuc: string }[] = [];

    for (const talep of bekleyenler) {
      const guid = embedUrlGuidCikar(talep.hazir_video_url);
      if (!guid) { detaylar.push({ talep_id: talep.talep_id, sonuc: "guid-yok" }); continue; }

      const durum = await bunnyVideoDurumu(guid);
      if (!durum.ok) { detaylar.push({ talep_id: talep.talep_id, sonuc: "bunny-erisilemedi" }); continue; }

      if (durum.hatali) {
        await adminSupabase.from("talepler").update({ hazir_video_url: null })
          .eq("talep_id", talep.talep_id).eq("hazir_video_url", talep.hazir_video_url);
        await bunnyVideoSil(guid);
        hatali += 1;
        detaylar.push({ talep_id: talep.talep_id, sonuc: "encode-hatali-ayrildi" });
        continue;
      }

      if (!durum.hazir || durum.videoSuresiSaniye == null || durum.videoSuresiSaniye <= 0) {
        bekliyor += 1;
        detaylar.push({ talep_id: talep.talep_id, sonuc: "henuz-hazir-degil" });
        continue;
      }

      const { data: sonuc, error: rpcError } = await adminSupabase.rpc("uretim_hazir_video_kaydet", {
        p_talep_id: talep.talep_id,
        p_uretici_id: talep.uretici_id,
        p_video_url: talep.hazir_video_url,
        p_islem_anahtari: guid,
      });
      if (rpcError) { detaylar.push({ talep_id: talep.talep_id, sonuc: "rpc-hata" }); continue; }
      const videoId = (sonuc as { video_id?: string } | null)?.video_id;
      if (!videoId) { detaylar.push({ talep_id: talep.talep_id, sonuc: "video-id-yok" }); continue; }

      const { error: sureError } = await adminSupabase
        .from("videolar")
        .update({ video_suresi_saniye: durum.videoSuresiSaniye })
        .eq("video_id", videoId);
      if (sureError) { detaylar.push({ talep_id: talep.talep_id, sonuc: "sure-yazilamadi" }); continue; }

      const alici = (sonuc as { sonraki?: { atanan_iu_id?: string } | null } | null)?.sonraki?.atanan_iu_id;
      if (alici) pushYayinlaArkada(adminSupabase, "uretim_durum_gecisi", [alici]);
      tamamlanan += 1;
      detaylar.push({ talep_id: talep.talep_id, sonuc: "tamamlandi" });
    }

    return NextResponse.json(
      { mesaj: "Mutabakat tamamlandı.", tamamlanan, bekliyor, hatali, detaylar },
      { status: 200 },
    );
  } catch (err) {
    return NextResponse.json(
      { hata: "Mutabakat işlenemedi.", detay: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
