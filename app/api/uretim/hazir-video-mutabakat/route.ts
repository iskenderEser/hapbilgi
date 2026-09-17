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
import { hazirVideoTamamla } from "@/lib/video/hazirVideoTamamla";
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
    const { data: videoOturumlar, error: iuOturumError } = await adminSupabase
      .from("ogrenme_araci_video_yukleme_oturumlari")
      .select("yukleme_id, kullanici_id, talep_id, kaynak, gorev_id, arac_id, video_guid, embed_url")
      .eq("durum", "dogrulama_bekliyor")
      .limit(MAX_ISLENEN);
    if (iuOturumError) {
      return NextResponse.json({ hata: "İÜ video teslim oturumları sorgulanamadı.", detay: iuOturumError.message }, { status: 500 });
    }
    const iuOturumlar = (videoOturumlar ?? []).filter((o) => o.kaynak === "iu");
    const acikHazirTalepler = new Set((videoOturumlar ?? []).filter((o) => o.kaynak === "hazir").map((o) => o.talep_id));
    if (adayTalepler.length === 0 && (iuOturumlar?.length ?? 0) === 0) {
      return NextResponse.json({ mesaj: "Bekleyen video yok.", tamamlanan: 0 }, { status: 200 });
    }

    const talepIdler = adayTalepler.map((t) => t.talep_id);
    const { data: mevcutVideolar, error: videoError } = await adminSupabase
      .from("ogrenme_araclari")
      .select("talep_id, metadata_dogrulandi")
      .eq("kaynak", "hazir")
      .eq("arac_turu", "video")
      .in("talep_id", talepIdler);
    if (videoError) {
      return NextResponse.json({ hata: "Video kayıtları sorgulanamadı.", detay: videoError.message }, { status: 500 });
    }
    // Vezne yükleme oturumu için doğrulanmamış bir araç kabuğunu önceden açar.
    // Yalnız doğrulanmış araç tamamlanmış sayılır; kabuk mutabakattan kaçamaz.
    const kayitliSet = new Set((mevcutVideolar ?? [])
      .filter((v: { metadata_dogrulandi: boolean | null }) => v.metadata_dogrulandi === true)
      .map((v: { talep_id: string }) => v.talep_id));
    const bekleyenler = adayTalepler.filter((t) => !kayitliSet.has(t.talep_id) || acikHazirTalepler.has(t.talep_id)).slice(0, MAX_ISLENEN);

    let tamamlanan = 0;
    let bekliyor = 0;
    let hatali = 0;
    const detaylar: { talep_id: string; sonuc: string }[] = [];

    for (const talep of bekleyenler) {
      const guid = embedUrlGuidCikar(talep.hazir_video_url);
      if (!guid) { detaylar.push({ talep_id: talep.talep_id, sonuc: "guid-yok" }); continue; }

      const durum = await bunnyVideoDurumu(guid);
      if (!durum.ok) {
        detaylar.push({ talep_id: talep.talep_id, sonuc: `bunny-erisilemedi: ${durum.adim ?? "?"} — ${durum.detay ?? durum.hata ?? "?"} (guid=${guid})` });
        continue;
      }

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

      const sonuc = await hazirVideoTamamla(adminSupabase, {
        talep_id: talep.talep_id, uretici_id: talep.uretici_id,
        video_url: talep.hazir_video_url, guid,
      }, durum.videoSuresiSaniye);

      const alici = (sonuc as { sonraki?: { atanan_iu_id?: string } | null } | null)?.sonraki?.atanan_iu_id;
      if (alici) pushYayinlaArkada(adminSupabase, "uretim_durum_gecisi", [alici]);
      tamamlanan += 1;
      detaylar.push({ talep_id: talep.talep_id, sonuc: "tamamlandi" });
    }

    let tamamlananIu = 0;
    for (const oturum of iuOturumlar ?? []) {
      if (!oturum.gorev_id || !oturum.arac_id) continue;
      const durum = await bunnyVideoDurumu(oturum.video_guid);
      if (!durum.ok) continue;
      if (durum.hatali) {
        await adminSupabase.from("ogrenme_araci_video_yukleme_oturumlari")
          .update({ durum: "iptal_hatasi", son_hata: "Bunny video işleme hatası", updated_at: new Date().toISOString() })
          .eq("yukleme_id", oturum.yukleme_id);
        hatali += 1;
        continue;
      }
      if (!durum.hazir || !durum.videoSuresiSaniye || durum.videoSuresiSaniye <= 0) {
        bekliyor += 1;
        continue;
      }
      const { data: sonuc, error: teslimError } = await adminSupabase.rpc("uretim_video_teslim_et", {
        p_gorev_id: oturum.gorev_id,
        p_iu_id: oturum.kullanici_id,
        p_video_url: oturum.embed_url,
        p_thumbnail_url: null,
        p_islem_anahtari: oturum.video_guid,
      });
      if (teslimError) continue;
      const { error: sureError } = await adminSupabase.from("ogrenme_araclari")
        .update({ sure_saniye: durum.videoSuresiSaniye, metadata_dogrulandi: true })
        .eq("arac_id", oturum.arac_id).eq("arac_turu", "video");
      if (sureError) continue;
      await adminSupabase.from("ogrenme_araci_video_yukleme_oturumlari").delete().eq("yukleme_id", oturum.yukleme_id);
      const talepId = (sonuc as { talep_id?: string } | null)?.talep_id;
      if (talepId) {
        const { data: talep } = await adminSupabase.from("talepler").select("uretici_id").eq("talep_id", talepId).maybeSingle();
        if (talep?.uretici_id) pushYayinlaArkada(adminSupabase, "uretim_durum_gecisi", [talep.uretici_id]);
      }
      tamamlananIu += 1;
    }

    return NextResponse.json(
      { mesaj: "Mutabakat tamamlandı.", tamamlanan, tamamlanan_iu: tamamlananIu, bekliyor, hatali, detaylar },
      { status: 200 },
    );
  } catch (err) {
    return NextResponse.json(
      { hata: "Mutabakat işlenemedi.", detay: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
