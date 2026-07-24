// lib/utils/anaSayfa/uretici.ts
// Üretici rolleri ana sayfa verisi (içerik takibi: her talebin aşama + durumu).
// R0: lib/utils/anaSayfaVeri.ts'ten saf taşıma.
// 23.07 — hazır-farkında yapıldı: hazır video senaryosuz olduğundan senaryo aşaması
// yalnız normal kolda işletilir; video artık talep_id ile bulunur (senaryo_durum_id
// zinciri yerine — hazır videoda o null). Böylece hazır video içeriği "Senaryo
// Bekleniyor"da donmaz, gerçek aşamasını (Video/Soru Seti/Yayın) gösterir. Normal
// kol davranışı değişmez (talep başına tek video → talep_id ile aynı satır bulunur).
// Not: Döngü içi sıralı sorgu (N+1) deseni bilinçli olarak İYİLEŞTİRİLMEDEN taşındı — ayrı perf işi.

import { SupabaseClient } from "@supabase/supabase-js";
import type { HedefRol } from "@/lib/utils/roller";

interface TakipSatiri {
  talep_id: string;
  talep_no: number;
  firma_adi: string;
  urun_adi: string;
  teknik_adi: string;
  hedef_rol: HedefRol;
  asama: "Senaryo" | "Video" | "Soru Seti" | "Yayın";
  durum: string;
  tarih: string;
  yol: string;
  kategori: "inceleme" | "yayin-bekleyen" | "yayinda" | "durdurulan" | "devam";
}

export async function getUreticiAnaSayfaVeri(userId: string, adminSupabase: SupabaseClient) {
  const { data: talepler, error: talepError } = await adminSupabase
    .from("talepler")
    .select(`talep_id, talep_no, hedef_rol, hazir_video, created_at, urun_adi, urunler(urun_adi), teknikler(teknik_adi), firmalar(firma_adi)`)
    .eq("uretici_id", userId)
    .order("created_at", { ascending: false });

  if (talepError) throw new Error("Talepler çekilemedi.");

  const satirlar: TakipSatiri[] = [];
  let inceleme_bekleyen = 0;
  let yayin_bekleyen = 0;
  let yayinda = 0;

  for (const talep of talepler ?? []) {
    const urun_adi = (talep as any).urunler?.urun_adi ?? (talep as any).urun_adi ?? "-";
    const teknik_adi = (talep as any).teknikler?.teknik_adi ?? "-";
    const hedef_rol = ((talep as any).hedef_rol ?? "utt") as HedefRol;
    const talep_no = (talep as any).talep_no as number;
    const firma_adi = (talep as any).firmalar?.firma_adi ?? "";
    const hazirVideo = (talep as any).hazir_video === true;
    // Zincir boyunca "bir önceki aşamanın tarihi" — bekleyen satırların tarihi buradan.
    let oncekiTarih: string = talep.created_at;

    // ── Senaryo aşaması: yalnız normal kol. Hazır video senaryosuz, bu aşamayı atlar. ──
    if (!hazirVideo) {
      const { data: senaryolar } = await adminSupabase
        .from("senaryolar")
        .select("senaryo_id")
        .eq("talep_id", talep.talep_id)
        .order("created_at", { ascending: false })
        .limit(1);

      const sonSenaryo = senaryolar?.[0];

      if (!sonSenaryo) {
        satirlar.push({ talep_id: talep.talep_id, talep_no, firma_adi, urun_adi, teknik_adi, hedef_rol, asama: "Senaryo", durum: "Senaryo Bekleniyor", tarih: oncekiTarih, yol: `/talepler/${talep.talep_id}`, kategori: "devam" });
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
        satirlar.push({ talep_id: talep.talep_id, talep_no, firma_adi, urun_adi, teknik_adi, hedef_rol, asama: "Senaryo", durum, tarih: sonSD?.created_at ?? oncekiTarih, yol: `/senaryolar/${talep.talep_id}`, kategori });
        continue;
      }
      oncekiTarih = sonSD.created_at;
    }

    // ── Video aşaması (ortak): video talebe talep_id ile bağlı (hazır + normal). ──
    const { data: videolar } = await adminSupabase
      .from("videolar")
      .select("video_id")
      .eq("talep_id", talep.talep_id)
      .order("created_at", { ascending: false })
      .limit(1);

    const sonVideo = videolar?.[0];

    if (!sonVideo) {
      satirlar.push({ talep_id: talep.talep_id, talep_no, firma_adi, urun_adi, teknik_adi, hedef_rol, asama: "Video", durum: "Video Bekleniyor", tarih: oncekiTarih, yol: `/videolar`, kategori: "devam" });
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
      satirlar.push({ talep_id: talep.talep_id, talep_no, firma_adi, urun_adi, teknik_adi, hedef_rol, asama: "Video", durum, tarih: sonVD?.created_at ?? oncekiTarih, yol: `/videolar`, kategori });
      continue;
    }
    oncekiTarih = sonVD.created_at;

    // ── Soru seti aşaması (ortak): set video_durum_id ile bağlı. ──
    const { data: soruSetleri } = await adminSupabase
      .from("soru_setleri")
      .select("soru_seti_id")
      .eq("video_durum_id", sonVD.video_durum_id)
      .order("created_at", { ascending: false })
      .limit(1);

    const sonSoruSeti = soruSetleri?.[0];

    if (!sonSoruSeti) {
      satirlar.push({ talep_id: talep.talep_id, talep_no, firma_adi, urun_adi, teknik_adi, hedef_rol, asama: "Soru Seti", durum: "Soru Seti Bekleniyor", tarih: oncekiTarih, yol: `/soru-setleri`, kategori: "devam" });
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
      satirlar.push({ talep_id: talep.talep_id, talep_no, firma_adi, urun_adi, teknik_adi, hedef_rol, asama: "Soru Seti", durum, tarih: sonSSD?.created_at ?? oncekiTarih, yol: `/soru-setleri`, kategori });
      continue;
    }
    oncekiTarih = sonSSD.created_at;

    // ── Yayın aşaması ──
    const { data: yayin } = await adminSupabase
      .from("yayin_yonetimi")
      .select("yayin_id, durum, yayin_tarihi")
      .eq("soru_seti_durum_id", sonSSD.soru_seti_durum_id)
      .maybeSingle();

    if (!yayin) {
      yayin_bekleyen++;
      satirlar.push({ talep_id: talep.talep_id, talep_no, firma_adi, urun_adi, teknik_adi, hedef_rol, asama: "Yayın", durum: "Yayın Bekliyor", tarih: oncekiTarih, yol: `/yayin-yonetimi`, kategori: "yayin-bekleyen" });
    } else if (yayin.durum === "yayinda") {
      yayinda++;
      satirlar.push({ talep_id: talep.talep_id, talep_no, firma_adi, urun_adi, teknik_adi, hedef_rol, asama: "Yayın", durum: "Yayında", tarih: yayin.yayin_tarihi, yol: `/yayin-yonetimi`, kategori: "yayinda" });
    } else {
      satirlar.push({ talep_id: talep.talep_id, talep_no, firma_adi, urun_adi, teknik_adi, hedef_rol, asama: "Yayın", durum: "Durduruldu", tarih: yayin.yayin_tarihi, yol: `/yayin-yonetimi`, kategori: "durdurulan" });
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
