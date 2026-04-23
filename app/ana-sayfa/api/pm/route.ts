// app/ana-sayfa/api/pm/route.ts
import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi } from "@/lib/utils/hataIsle";

interface TakipSatiri {
  talep_id: string;
  urun_adi: string;
  teknik_adi: string;
  asama: "Senaryo" | "Video" | "Soru Seti" | "Yayın";
  durum: string;
  tarih: string;
  yol: string;
  kategori: "inceleme" | "yayin-bekleyen" | "yayinda" | "durdurulan" | "devam";
}

export async function GET() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (!["pm", "jr_pm", "kd_pm"].includes(rol)) return rolHatasi("Sadece PM bu veriye erişebilir.");

    const { data: pmKullanici, error: pmError } = await adminSupabase
      .from("kullanicilar")
      .select("takim_id, firma_id")
      .eq("kullanici_id", user.id)
      .single();

    if (pmError || !pmKullanici) return hataYaniti("PM bilgisi alınamadı.", "kullanicilar tablosu SELECT", pmError);

    // PM'in tüm taleplerini çek
    const { data: talepler, error: talepError } = await adminSupabase
      .from("talepler")
      .select(`talep_id, created_at, urunler(urun_adi), teknikler(teknik_adi)`)
      .eq("pm_id", user.id)
      .order("created_at", { ascending: false });

    if (talepError) return hataYaniti("Talepler çekilemedi.", "talepler tablosu SELECT", talepError);

    const satirlar: TakipSatiri[] = [];
    let inceleme_bekleyen = 0;
    let yayin_bekleyen = 0;
    let yayinda = 0;

    for (const talep of talepler ?? []) {
      const urun_adi = (talep as any).urunler?.urun_adi ?? "-";
      const teknik_adi = (talep as any).teknikler?.teknik_adi ?? "-";

      // Son senaryo
      const { data: senaryolar } = await adminSupabase
        .from("senaryolar")
        .select("senaryo_id")
        .eq("talep_id", talep.talep_id)
        .order("created_at", { ascending: false })
        .limit(1);

      const sonSenaryo = senaryolar?.[0];

      if (!sonSenaryo) {
        satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, asama: "Senaryo", durum: "Senaryo Bekleniyor", tarih: talep.created_at, yol: `/talepler/${talep.talep_id}`, kategori: "devam" });
        continue;
      }

      // Senaryo son durum
      const { data: senaryoDurumlar } = await adminSupabase
        .from("senaryo_durumu")
        .select("durum, senaryo_durum_id, created_at")
        .eq("senaryo_id", sonSenaryo.senaryo_id)
        .order("created_at", { ascending: false })
        .limit(1);

      const sonSD = senaryoDurumlar?.[0];

      if (!sonSD || sonSD.durum !== "Onaylandi") {
        const durum = sonSD?.durum === "Inceleme Bekleniyor" ? "İnceleme Bekliyor" :
                      sonSD?.durum === "Revizyon Bekleniyor" ? "Revizyon Gönderildi" : "Devam Ediyor";
        const kategori = sonSD?.durum === "Inceleme Bekleniyor" ? "inceleme" : "devam";
        if (sonSD?.durum === "Inceleme Bekleniyor") inceleme_bekleyen++;
        satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, asama: "Senaryo", durum, tarih: sonSD?.created_at ?? talep.created_at, yol: `/senaryolar/${talep.talep_id}`, kategori });
        continue;
      }

      // Video aşaması
      const { data: videolar } = await adminSupabase
        .from("videolar")
        .select("video_id")
        .eq("senaryo_durum_id", sonSD.senaryo_durum_id)
        .order("created_at", { ascending: false })
        .limit(1);

      const sonVideo = videolar?.[0];

      if (!sonVideo) {
        satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, asama: "Video", durum: "Video Bekleniyor", tarih: sonSD.created_at, yol: `/videolar`, kategori: "devam" });
        continue;
      }

      const { data: videoDurumlar } = await adminSupabase
        .from("video_durumu")
        .select("durum, video_durum_id, created_at")
        .eq("video_id", sonVideo.video_id)
        .order("created_at", { ascending: false })
        .limit(1);

      const sonVD = videoDurumlar?.[0];

      if (!sonVD || sonVD.durum !== "Onaylandi") {
        const durum = sonVD?.durum === "Inceleme Bekleniyor" ? "İnceleme Bekliyor" :
                      sonVD?.durum === "Revizyon Bekleniyor" ? "Revizyon Gönderildi" : "Devam Ediyor";
        const kategori = sonVD?.durum === "Inceleme Bekleniyor" ? "inceleme" : "devam";
        if (sonVD?.durum === "Inceleme Bekleniyor") inceleme_bekleyen++;
        satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, asama: "Video", durum, tarih: sonVD?.created_at ?? sonSD.created_at, yol: `/videolar`, kategori });
        continue;
      }

      // Soru Seti aşaması
      const { data: soruSetleri } = await adminSupabase
        .from("soru_setleri")
        .select("soru_seti_id")
        .eq("video_durum_id", sonVD.video_durum_id)
        .order("created_at", { ascending: false })
        .limit(1);

      const sonSoruSeti = soruSetleri?.[0];

      if (!sonSoruSeti) {
        satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, asama: "Soru Seti", durum: "Soru Seti Bekleniyor", tarih: sonVD.created_at, yol: `/soru-setleri`, kategori: "devam" });
        continue;
      }

      const { data: soruSetiDurumlar } = await adminSupabase
        .from("soru_seti_durumu")
        .select("durum, soru_seti_durum_id, created_at")
        .eq("soru_seti_id", sonSoruSeti.soru_seti_id)
        .order("created_at", { ascending: false })
        .limit(1);

      const sonSSD = soruSetiDurumlar?.[0];

      if (!sonSSD || sonSSD.durum !== "Onaylandi") {
        const durum = sonSSD?.durum === "Inceleme Bekleniyor" ? "İnceleme Bekliyor" :
                      sonSSD?.durum === "Revizyon Bekleniyor" ? "Revizyon Gönderildi" : "Devam Ediyor";
        const kategori = sonSSD?.durum === "Inceleme Bekleniyor" ? "inceleme" : "devam";
        if (sonSSD?.durum === "Inceleme Bekleniyor") inceleme_bekleyen++;
        satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, asama: "Soru Seti", durum, tarih: sonSSD?.created_at ?? sonVD.created_at, yol: `/soru-setleri`, kategori });
        continue;
      }

      // Yayın aşaması
      const { data: yayin } = await adminSupabase
        .from("yayin_yonetimi")
        .select("yayin_id, durum, yayin_tarihi")
        .eq("soru_seti_durum_id", sonSSD.soru_seti_durum_id)
        .maybeSingle();

      if (!yayin) {
        yayin_bekleyen++;
        satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, asama: "Yayın", durum: "Yayın Bekliyor", tarih: sonSSD.created_at, yol: `/yayin-yonetimi`, kategori: "yayin-bekleyen" });
      } else if (yayin.durum === "Yayinda") {
        yayinda++;
        satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, asama: "Yayın", durum: "Yayında", tarih: yayin.yayin_tarihi, yol: `/yayin-yonetimi`, kategori: "yayinda" });
      } else {
        satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, asama: "Yayın", durum: "Durduruldu", tarih: yayin.yayin_tarihi, yol: `/yayin-yonetimi`, kategori: "durdurulan" });
      }
    }

    return NextResponse.json({
      satirlar,
      istatistikler: {
        inceleme_bekleyen,
        yayin_bekleyen,
        yayinda,
        toplam: (talepler ?? []).length,
      },
    }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /ana-sayfa/api/pm");
  }
}