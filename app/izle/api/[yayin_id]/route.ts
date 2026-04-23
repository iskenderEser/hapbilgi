// app/izle/api/[yayin_id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ yayin_id: string }> }
) {
  try {
    const { yayin_id } = await params;
    if (!yayin_id) return validasyonHatasi("yayin_id zorunludur.", ["yayin_id"]);

    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (!["utt", "kd_utt"].includes(rol)) return rolHatasi("Sadece utt ve kd_utt erişebilir.");

    // Yayın bilgisi
    const { data: yayin, error: yayinError } = await adminSupabase
      .from("yayin_yonetimi")
      .select("yayin_id, soru_seti_durum_id, durum, yayin_tarihi")
      .eq("yayin_id", yayin_id)
      .single();

    const yayinKontrol = veriKontrol(yayin, "yayin_yonetimi tablosu SELECT — yayin_id kontrolü", "Yayın bulunamadı.");
    if (!yayinKontrol.gecerli) return yayinKontrol.yanit;
    if (yayinError) return hataYaniti("Yayın sorgulanırken hata oluştu.", "yayin_yonetimi tablosu SELECT", yayinError, 404);
    if (yayin.durum !== "Yayinda") return isKuraluHatasi(`Video şu an yayında değil. Mevcut durum: ${yayin.durum}`);

    let urun_adi = "-";
    let teknik_adi = "-";
    let video_url = null;
    let thumbnail_url = null;
    let video_puani = null;

    const { data: soruSetiDurum, error: ssdError } = await adminSupabase
      .from("soru_seti_durumu")
      .select("soru_seti_id")
      .eq("soru_seti_durum_id", yayin.soru_seti_durum_id)
      .single();

    if (ssdError || !soruSetiDurum) {
      console.error("[UYARI] Soru seti durumu çekilemedi:", { soru_seti_durum_id: yayin.soru_seti_durum_id, hata: ssdError?.message });
    } else {
      const { data: soruSeti, error: ssError } = await adminSupabase
        .from("soru_setleri")
        .select("video_durum_id")
        .eq("soru_seti_id", soruSetiDurum.soru_seti_id)
        .single();

      if (ssError || !soruSeti) {
        console.error("[UYARI] Soru seti çekilemedi:", { soru_seti_id: soruSetiDurum.soru_seti_id, hata: ssError?.message });
      } else {
        const { data: vPuan } = await adminSupabase
          .from("video_puanlari")
          .select("video_puani")
          .eq("video_durum_id", soruSeti.video_durum_id)
          .single();

        video_puani = vPuan?.video_puani ?? null;

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

            const { data: senaryoDurum, error: sdError } = await adminSupabase
              .from("senaryo_durumu")
              .select("senaryo_id")
              .eq("senaryo_durum_id", video.senaryo_durum_id)
              .single();

            if (sdError || !senaryoDurum) {
              console.error("[UYARI] Senaryo durumu çekilemedi:", { senaryo_durum_id: video.senaryo_durum_id, hata: sdError?.message });
            } else {
              const { data: senaryo, error: senaryoError } = await adminSupabase
                .from("senaryolar")
                .select("talep_id")
                .eq("senaryo_id", senaryoDurum.senaryo_id)
                .single();

              if (senaryoError || !senaryo) {
                console.error("[UYARI] Senaryo çekilemedi:", { senaryo_id: senaryoDurum.senaryo_id, hata: senaryoError?.message });
              } else {
                const { data: talep, error: talepError } = await adminSupabase
                  .from("talepler")
                  .select("urun_adi, teknik_adi")
                  .eq("talep_id", senaryo.talep_id)
                  .single();

                if (talepError || !talep) {
                  console.error("[UYARI] Talep çekilemedi:", { talep_id: senaryo.talep_id, hata: talepError?.message });
                } else {
                  urun_adi = talep.urun_adi ?? "-";
                  teknik_adi = talep.teknik_adi ?? "-";
                }
              }
            }
          }
        }
      }
    }

    // Daha önce izledi mi
    const { data: izleme } = await adminSupabase
      .from("izleme_kayitlari")
      .select("izleme_id")
      .eq("yayin_id", yayin_id)
      .eq("kullanici_id", user.id)
      .eq("tamamlandi_mi", true)
      .limit(1);

    return NextResponse.json({
      yayin: {
        yayin_id: yayin.yayin_id,
        urun_adi,
        teknik_adi,
        video_url,
        thumbnail_url,
        video_puani,
        yayin_tarihi: yayin.yayin_tarihi,
        daha_once_izledi: (izleme ?? []).length > 0,
      }
    }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /izle/api/[yayin_id]");
  }
}