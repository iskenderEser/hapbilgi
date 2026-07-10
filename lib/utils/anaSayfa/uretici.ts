// lib/utils/anaSayfa/uretici.ts
// Üretici rolleri ana sayfa verisi. (R0: lib/utils/anaSayfaVeri.ts'ten saf taşıma — davranış değişmedi.)
// Not: Döngü içi sıralı sorgu (N+1) deseni bilinçli olarak İYİLEŞTİRİLMEDEN taşındı — ayrı perf işi.

import { SupabaseClient } from "@supabase/supabase-js";

interface TakipSatiri {
  talep_id: string;
  urun_adi: string;
  teknik_adi: string;
  hedef_rol: "utt" | "bm";
  asama: "Senaryo" | "Video" | "Soru Seti" | "Yayın";
  durum: string;
  tarih: string;
  yol: string;
  kategori: "inceleme" | "yayin-bekleyen" | "yayinda" | "durdurulan" | "devam";
}

export async function getUreticiAnaSayfaVeri(userId: string, adminSupabase: SupabaseClient) {
  const { data: talepler, error: talepError } = await adminSupabase
    .from("talepler")
    .select(`talep_id, hedef_rol, created_at, urunler(urun_adi), teknikler(teknik_adi)`)
    .eq("uretici_id", userId)
    .order("created_at", { ascending: false });

  if (talepError) throw new Error("Talepler çekilemedi.");

  const satirlar: TakipSatiri[] = [];
  let inceleme_bekleyen = 0;
  let yayin_bekleyen = 0;
  let yayinda = 0;

  for (const talep of talepler ?? []) {
    const urun_adi = (talep as any).urunler?.urun_adi ?? "-";
    const teknik_adi = (talep as any).teknikler?.teknik_adi ?? "-";
    const hedef_rol = ((talep as any).hedef_rol ?? "utt") as "utt" | "bm";

    const { data: senaryolar } = await adminSupabase
      .from("senaryolar")
      .select("senaryo_id")
      .eq("talep_id", talep.talep_id)
      .order("created_at", { ascending: false })
      .limit(1);

    const sonSenaryo = senaryolar?.[0];

    if (!sonSenaryo) {
      satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, hedef_rol, asama: "Senaryo", durum: "Senaryo Bekleniyor", tarih: talep.created_at, yol: `/talepler/${talep.talep_id}`, kategori: "devam" });
      continue;
    }

    const { data: senaryoDurumlar } = await adminSupabase
      .from("senaryo_durumu")
      .select("durum, senaryo_durum_id, created_at")
      .eq("senaryo_id", sonSenaryo.senaryo_id)
      .order("created_at", { ascending: false })
      .limit(1);

    const sonSD = senaryoDurumlar?.[0];

    if (!sonSD || sonSD.durum !== "onaylandi") {
      const durum = sonSD?.durum === "inceleme bekleniyor" ? "İnceleme Bekliyor" :
                    sonSD?.durum === "revizyon bekleniyor" ? "Revizyon Gönderildi" : "Devam Ediyor";
      const kategori = sonSD?.durum === "inceleme bekleniyor" ? "inceleme" : "devam";
      if (sonSD?.durum === "inceleme bekleniyor") inceleme_bekleyen++;
      satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, hedef_rol, asama: "Senaryo", durum, tarih: sonSD?.created_at ?? talep.created_at, yol: `/senaryolar/${talep.talep_id}`, kategori });
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
      satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, hedef_rol, asama: "Video", durum: "Video Bekleniyor", tarih: sonSD.created_at, yol: `/videolar`, kategori: "devam" });
      continue;
    }

    const { data: videoDurumlar } = await adminSupabase
      .from("video_durumu")
      .select("durum, video_durum_id, created_at")
      .eq("video_id", sonVideo.video_id)
      .order("created_at", { ascending: false })
      .limit(1);

    const sonVD = videoDurumlar?.[0];

    if (!sonVD || sonVD.durum !== "onaylandi") {
      const durum = sonVD?.durum === "inceleme bekleniyor" ? "İnceleme Bekliyor" :
                    sonVD?.durum === "revizyon bekleniyor" ? "Revizyon Gönderildi" : "Devam Ediyor";
      const kategori = sonVD?.durum === "inceleme bekleniyor" ? "inceleme" : "devam";
      if (sonVD?.durum === "inceleme bekleniyor") inceleme_bekleyen++;
      satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, hedef_rol, asama: "Video", durum, tarih: sonVD?.created_at ?? sonSD.created_at, yol: `/videolar`, kategori });
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
      satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, hedef_rol, asama: "Soru Seti", durum: "Soru Seti Bekleniyor", tarih: sonVD.created_at, yol: `/soru-setleri`, kategori: "devam" });
      continue;
    }

    const { data: soruSetiDurumlar } = await adminSupabase
      .from("soru_seti_durumu")
      .select("durum, soru_seti_durum_id, created_at")
      .eq("soru_seti_id", sonSoruSeti.soru_seti_id)
      .order("created_at", { ascending: false })
      .limit(1);

    const sonSSD = soruSetiDurumlar?.[0];

    if (!sonSSD || sonSSD.durum !== "onaylandi") {
      const durum = sonSSD?.durum === "inceleme bekleniyor" ? "İnceleme Bekliyor" :
                    sonSSD?.durum === "revizyon bekleniyor" ? "Revizyon Gönderildi" : "Devam Ediyor";
      const kategori = sonSSD?.durum === "inceleme bekleniyor" ? "inceleme" : "devam";
      if (sonSSD?.durum === "inceleme bekleniyor") inceleme_bekleyen++;
      satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, hedef_rol, asama: "Soru Seti", durum, tarih: sonSSD?.created_at ?? sonVD.created_at, yol: `/soru-setleri`, kategori });
      continue;
    }

    const { data: yayin } = await adminSupabase
      .from("yayin_yonetimi")
      .select("yayin_id, durum, yayin_tarihi")
      .eq("soru_seti_durum_id", sonSSD.soru_seti_durum_id)
      .maybeSingle();

    if (!yayin) {
      yayin_bekleyen++;
      satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, hedef_rol, asama: "Yayın", durum: "Yayın Bekliyor", tarih: sonSSD.created_at, yol: `/yayin-yonetimi`, kategori: "yayin-bekleyen" });
    } else if (yayin.durum === "yayinda") {
      yayinda++;
      satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, hedef_rol, asama: "Yayın", durum: "Yayında", tarih: yayin.yayin_tarihi, yol: `/yayin-yonetimi`, kategori: "yayinda" });
    } else {
      satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, hedef_rol, asama: "Yayın", durum: "Durduruldu", tarih: yayin.yayin_tarihi, yol: `/yayin-yonetimi`, kategori: "durdurulan" });
    }
  }

  return {
    satirlar,
    istatistikler: {
      inceleme_bekleyen,
      yayin_bekleyen,
      yayinda,
      toplam: (talepler ?? []).length,
    },
  };
}
