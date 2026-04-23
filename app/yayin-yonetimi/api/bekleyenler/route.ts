// app/yayin-yonetimi/api/bekleyenler/route.ts
import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi } from "@/lib/utils/hataIsle";

export async function GET() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (!["pm", "jr_pm", "kd_pm"].includes(rol)) return rolHatasi("Sadece PM bekleyen videoları görebilir.");

    const { data: yayinlar, error: yayinError } = await adminSupabase
      .from("yayin_yonetimi")
      .select("soru_seti_durum_id");

    if (yayinError) return hataYaniti("Yayınlar çekilemedi.", "yayin_yonetimi tablosu SELECT", yayinError);

    const yayindakiIds = new Set((yayinlar ?? []).map((y: any) => y.soru_seti_durum_id));

    const { data: onaylananlar, error: onayError } = await adminSupabase
      .from("soru_seti_durumu")
      .select("soru_seti_durum_id, soru_seti_id, created_at")
      .eq("durum", "Onaylandi");

    if (onayError) return hataYaniti("Onaylanan soru seti durumları çekilemedi.", "soru_seti_durumu tablosu SELECT — Onaylandi filtresi", onayError);

    const bekleyenIds = (onaylananlar ?? []).filter(
      (ss: any) => !yayindakiIds.has(ss.soru_seti_durum_id)
    );

    if (bekleyenIds.length === 0) return NextResponse.json({ bekleyenler: [] }, { status: 200 });

    const sonuc = await Promise.all(
      bekleyenIds.map(async (ss: any) => {

        const { data: soruSeti, error: ssError } = await adminSupabase
          .from("soru_setleri")
          .select("soru_seti_id, video_durum_id, sorular")
          .eq("soru_seti_id", ss.soru_seti_id)
          .single();

        if (ssError || !soruSeti) {
          console.error("[UYARI] Soru seti çekilemedi:", { soru_seti_id: ss.soru_seti_id, hata: ssError?.message });
          return null;
        }

        // Video puanı
        const { data: videoPuan, error: vPuanError } = await adminSupabase
          .from("video_puanlari")
          .select("video_puan_id, video_puani")
          .eq("video_durum_id", soruSeti.video_durum_id)
          .single();

        if (vPuanError && vPuanError.code !== "PGRST116") {
          console.error("[UYARI] Video puanı çekilemedi:", { video_durum_id: soruSeti.video_durum_id, hata: vPuanError?.message });
        }

        // Soru bazlı puanları çek
        const { data: soruPuanlari, error: sPuanError } = await adminSupabase
          .from("soru_seti_puanlari")
          .select("soru_seti_puan_id, soru_index, soru_puani")
          .eq("soru_seti_durum_id", ss.soru_seti_durum_id)
          .order("soru_index", { ascending: true });

        if (sPuanError) {
          console.error("[UYARI] Soru puanları çekilemedi:", { soru_seti_durum_id: ss.soru_seti_durum_id, hata: sPuanError?.message });
        }

        const soruPuanMap: Record<number, { soru_seti_puan_id: string; soru_puani: number }> = {};
        for (const sp of soruPuanlari ?? []) {
          soruPuanMap[sp.soru_index] = { soru_seti_puan_id: sp.soru_seti_puan_id, soru_puani: sp.soru_puani };
        }

        // Video zinciri
        let urun_adi = "-";
        let teknik_adi = "-";
        let video_url = null;
        let thumbnail_url = null;

        const { data: videoDurum, error: vdError } = await adminSupabase
          .from("video_durumu")
          .select("video_id")
          .eq("video_durum_id", soruSeti.video_durum_id)
          .single();

        if (vdError || !videoDurum) {
          console.error("[UYARI] Video durumu çekilemedi:", { video_durum_id: soruSeti.video_durum_id, hata: vdError?.message });
        } else {
          const { data: video, error: videoError } = await adminSupabase
            .from("videolar")
            .select("senaryo_durum_id, video_url, thumbnail_url")
            .eq("video_id", videoDurum.video_id)
            .single();

          if (videoError || !video) {
            console.error("[UYARI] Video çekilemedi:", { video_id: videoDurum.video_id, hata: videoError?.message });
          } else {
            video_url = video.video_url ?? null;
            thumbnail_url = video.thumbnail_url ?? null;

            const { data: senaryoDurum } = await adminSupabase
              .from("senaryo_durumu")
              .select("senaryo_id")
              .eq("senaryo_durum_id", video.senaryo_durum_id)
              .single();

            if (senaryoDurum?.senaryo_id) {
              const { data: senaryo } = await adminSupabase
                .from("senaryolar")
                .select("talep_id")
                .eq("senaryo_id", senaryoDurum.senaryo_id)
                .single();

              if (senaryo?.talep_id) {
                const { data: talep } = await adminSupabase
                  .from("talepler")
                  .select(`urunler(urun_adi), teknikler(teknik_adi)`)
                  .eq("talep_id", senaryo.talep_id)
                  .single();

                urun_adi = (talep as any)?.urunler?.urun_adi ?? "-";
                teknik_adi = (talep as any)?.teknikler?.teknik_adi ?? "-";
              }
            }
          }
        }

        return {
          soru_seti_durum_id: ss.soru_seti_durum_id,
          soru_seti_id: ss.soru_seti_id,
          video_durum_id: soruSeti.video_durum_id,
          sorular: soruSeti.sorular ?? [],
          video_url,
          thumbnail_url,
          video_puan_id: videoPuan?.video_puan_id ?? null,
          video_puani: videoPuan?.video_puani ?? null,
          soru_puan_map: soruPuanMap,
          urun_adi,
          teknik_adi,
          onay_tarihi: ss.created_at,
        };
      })
    );

    return NextResponse.json({ bekleyenler: sonuc.filter(Boolean) }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /yayin-yonetimi/api/bekleyenler");
  }
}