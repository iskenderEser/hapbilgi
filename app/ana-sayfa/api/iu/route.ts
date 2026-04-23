// app/ana-sayfa/api/iu/route.ts
import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi } from "@/lib/utils/hataIsle";

interface IsSatiri {
  talep_id: string;
  urun_adi: string;
  teknik_adi: string;
  asama: "Senaryo" | "Video" | "Soru Seti";
  durum: string;
  tarih: string;
  yol: string;
  kategori: "bekleyen" | "revizyon" | "devam" | "tamamlanan";
}

export async function GET() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (rol !== "iu") return rolHatasi("Sadece IU bu veriye erişebilir.");

    // Tüm talepleri çek (IU tüm firmaların taleplerini görür)
    const { data: talepler, error: talepError } = await adminSupabase
      .from("talepler")
      .select(`talep_id, created_at, urunler(urun_adi), teknikler(teknik_adi)`)
      .order("created_at", { ascending: false });

    if (talepError) return hataYaniti("Talepler çekilemedi.", "talepler tablosu SELECT", talepError);

    const satirlar: IsSatiri[] = [];
    let bekleyen = 0;
    let revizyon = 0;
    let devam = 0;
    let tamamlanan = 0;

    for (const talep of talepler ?? []) {
      const urun_adi = (talep as any).urunler?.urun_adi ?? "-";
      const teknik_adi = (talep as any).teknikler?.teknik_adi ?? "-";

      // Son senaryo
      const { data: senaryolar } = await adminSupabase
        .from("senaryolar")
        .select("senaryo_id, iu_id")
        .eq("talep_id", talep.talep_id)
        .order("created_at", { ascending: false })
        .limit(1);

      const sonSenaryo = senaryolar?.[0];

      if (!sonSenaryo) {
        bekleyen++;
        satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, asama: "Senaryo", durum: "Senaryo Bekleniyor", tarih: talep.created_at, yol: `/senaryolar/${talep.talep_id}`, kategori: "bekleyen" });
        continue;
      }

      const { data: senaryoDurumlar } = await adminSupabase
        .from("senaryo_durumu")
        .select("durum, senaryo_durum_id, created_at")
        .eq("senaryo_id", sonSenaryo.senaryo_id)
        .order("created_at", { ascending: false })
        .limit(1);

      const sonSD = senaryoDurumlar?.[0];

      if (!sonSD || sonSD.durum === "Senaryo Yaziliyor") {
        devam++;
        satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, asama: "Senaryo", durum: "Yazılıyor", tarih: sonSD?.created_at ?? talep.created_at, yol: `/senaryolar/${talep.talep_id}`, kategori: "devam" });
        continue;
      }

      if (sonSD.durum === "Revizyon Bekleniyor") {
        revizyon++;
        satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, asama: "Senaryo", durum: "Revizyon Bekleniyor", tarih: sonSD.created_at, yol: `/senaryolar/${talep.talep_id}`, kategori: "revizyon" });
        continue;
      }

      if (sonSD.durum === "Inceleme Bekleniyor") {
        devam++;
        satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, asama: "Senaryo", durum: "İncelemede", tarih: sonSD.created_at, yol: `/senaryolar/${talep.talep_id}`, kategori: "devam" });
        continue;
      }

      if (sonSD.durum === "Iptal Edildi") {
        satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, asama: "Senaryo", durum: "İptal Edildi", tarih: sonSD.created_at, yol: `/senaryolar/${talep.talep_id}`, kategori: "tamamlanan" });
        continue;
      }

      // Senaryo onaylandı — video aşaması
      const { data: videolar } = await adminSupabase
        .from("videolar")
        .select("video_id, video_url")
        .eq("senaryo_durum_id", sonSD.senaryo_durum_id)
        .order("created_at", { ascending: false })
        .limit(1);

      const sonVideo = videolar?.[0];

      if (!sonVideo || !sonVideo.video_url) {
        bekleyen++;
        satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, asama: "Video", durum: "Video URL Bekleniyor", tarih: sonSD.created_at, yol: `/videolar`, kategori: "bekleyen" });
        continue;
      }

      const { data: videoDurumlar } = await adminSupabase
        .from("video_durumu")
        .select("durum, video_durum_id, created_at")
        .eq("video_id", sonVideo.video_id)
        .order("created_at", { ascending: false })
        .limit(1);

      const sonVD = videoDurumlar?.[0];

      if (!sonVD) {
        devam++;
        satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, asama: "Video", durum: "Gönderilmedi", tarih: sonSD.created_at, yol: `/videolar`, kategori: "devam" });
        continue;
      }

      if (sonVD.durum === "Revizyon Bekleniyor") {
        revizyon++;
        satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, asama: "Video", durum: "Revizyon Bekleniyor", tarih: sonVD.created_at, yol: `/videolar`, kategori: "revizyon" });
        continue;
      }

      if (sonVD.durum === "Inceleme Bekleniyor") {
        devam++;
        satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, asama: "Video", durum: "İncelemede", tarih: sonVD.created_at, yol: `/videolar`, kategori: "devam" });
        continue;
      }

      if (sonVD.durum === "Iptal Edildi") {
        satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, asama: "Video", durum: "İptal Edildi", tarih: sonVD.created_at, yol: `/videolar`, kategori: "tamamlanan" });
        continue;
      }

      // Video onaylandı — soru seti aşaması
      const { data: soruSetleri } = await adminSupabase
        .from("soru_setleri")
        .select("soru_seti_id")
        .eq("video_durum_id", sonVD.video_durum_id)
        .order("created_at", { ascending: false })
        .limit(1);

      const sonSoruSeti = soruSetleri?.[0];

      if (!sonSoruSeti) {
        bekleyen++;
        satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, asama: "Soru Seti", durum: "Soru Seti Bekleniyor", tarih: sonVD.created_at, yol: `/soru-setleri`, kategori: "bekleyen" });
        continue;
      }

      const { data: soruSetiDurumlar } = await adminSupabase
        .from("soru_seti_durumu")
        .select("durum, soru_seti_durum_id, created_at")
        .eq("soru_seti_id", sonSoruSeti.soru_seti_id)
        .order("created_at", { ascending: false })
        .limit(1);

      const sonSSD = soruSetiDurumlar?.[0];

      if (!sonSSD) {
        devam++;
        satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, asama: "Soru Seti", durum: "Yazılıyor", tarih: sonVD.created_at, yol: `/soru-setleri`, kategori: "devam" });
        continue;
      }

      if (sonSSD.durum === "Revizyon Bekleniyor") {
        revizyon++;
        satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, asama: "Soru Seti", durum: "Revizyon Bekleniyor", tarih: sonSSD.created_at, yol: `/soru-setleri`, kategori: "revizyon" });
        continue;
      }

      if (sonSSD.durum === "Inceleme Bekleniyor") {
        devam++;
        satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, asama: "Soru Seti", durum: "İncelemede", tarih: sonSSD.created_at, yol: `/soru-setleri`, kategori: "devam" });
        continue;
      }

      if (sonSSD.durum === "Onaylandi") {
        tamamlanan++;
        satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, asama: "Soru Seti", durum: "Tamamlandı", tarih: sonSSD.created_at, yol: `/soru-setleri`, kategori: "tamamlanan" });
        continue;
      }

      satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, asama: "Soru Seti", durum: "İptal Edildi", tarih: sonSSD.created_at, yol: `/soru-setleri`, kategori: "tamamlanan" });
    }

    return NextResponse.json({
      satirlar,
      istatistikler: { bekleyen, revizyon, devam, tamamlanan },
    }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /ana-sayfa/api/iu");
  }
}