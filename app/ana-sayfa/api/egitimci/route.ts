// app/ana-sayfa/api/egitimci/route.ts
import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi } from "@/lib/utils/hataIsle";

const EGITIMCI_ROLLER = ["egt_md", "egt_yrd_md", "egt_yon", "egt_uz"];

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
    if (!EGITIMCI_ROLLER.includes(rol)) return rolHatasi("Sadece eğitimci roller bu veriye erişebilir.");

    // Kullanıcı bilgisi
    const { data: kullanici, error: kullaniciError } = await adminSupabase
      .from("kullanicilar")
      .select("firma_id, takim_id")
      .eq("kullanici_id", user.id)
      .single();

    if (kullaniciError || !kullanici) return hataYaniti("Kullanıcı bilgisi alınamadı.", "kullanicilar tablosu SELECT", kullaniciError);

    // ——— BÖLÜM 1: İçerik takibi (PM gibi) ———
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

    // ——— BÖLÜM 2: BM takibi (TM gibi) ———
    const { data: bolgeler } = await adminSupabase
      .from("bolgeler")
      .select("bolge_id, bolge_adi")
      .eq("takim_id", kullanici.takim_id);

    const bolgeMap: Record<string, string> = {};
    for (const b of bolgeler ?? []) {
      bolgeMap[b.bolge_id] = b.bolge_adi;
    }

    const { data: bmler } = await adminSupabase
      .from("kullanicilar")
      .select("kullanici_id, ad, soyad, bolge_id")
      .eq("takim_id", kullanici.takim_id)
      .eq("rol", "bm")
      .eq("aktif_mi", true);

    const haftaBaslangic = new Date();
    haftaBaslangic.setDate(haftaBaslangic.getDate() - haftaBaslangic.getDay() + 1);
    haftaBaslangic.setHours(0, 0, 0, 0);

    const bmIdler = (bmler ?? []).map((b: any) => b.kullanici_id);

    const { data: tumOneriler } = bmIdler.length > 0 ? await adminSupabase
      .from("oneri_kayitlari")
      .select("oneri_id, oneren_id, izlendi_mi, created_at")
      .in("oneren_id", bmIdler) : { data: [] };

    const bmSatirlari = (bmler ?? []).map((bm: any) => {
      const bmOneriler = (tumOneriler ?? []).filter((o: any) => o.oneren_id === bm.kullanici_id);
      const haftaOneriler = bmOneriler.filter((o: any) => new Date(o.created_at) >= haftaBaslangic);
      return {
        kullanici_id: bm.kullanici_id,
        bm_adi: `${bm.ad} ${bm.soyad}`,
        bolge_adi: bolgeMap[bm.bolge_id] ?? "-",
        hafta_oneri: haftaOneriler.length,
        bekleyen: bmOneriler.filter((o: any) => !o.izlendi_mi).length,
        tamamlanan: bmOneriler.filter((o: any) => o.izlendi_mi).length,
      };
    });

    return NextResponse.json({
      satirlar,
      istatistikler: { inceleme_bekleyen, yayin_bekleyen, yayinda, toplam: (talepler ?? []).length },
      bm_satirlari: bmSatirlari,
      bm_istatistikler: {
        bm_sayisi: (bmler ?? []).length,
        hafta_aktif_bm: bmSatirlari.filter(b => b.hafta_oneri > 0).length,
        toplam_bekleyen: bmSatirlari.reduce((acc, b) => acc + b.bekleyen, 0),
        toplam_tamamlanan: bmSatirlari.reduce((acc, b) => acc + b.tamamlanan, 0),
      },
    }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /ana-sayfa/api/egitimci");
  }
}