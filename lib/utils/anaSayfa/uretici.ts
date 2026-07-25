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
import { kayitDurumKodu, yayinDurumKodu, type DurumKodu } from "@/lib/utils/durum/mesaj";

type TakipKategori =
  | "inceleme" | "yayin-bekleyen" | "yayinda" | "durdurulan"
  | "devam" | "iptal" | "planlanan" | "hata" | "video-bekleyen";

interface TakipSatiri {
  talep_id: string;
  talep_no: number;
  firma_adi: string;
  urun_adi: string;
  teknik_adi: string;
  hedef_rol: HedefRol;
  hazir_video: boolean;
  hazir_soru_seti: boolean;
  asama: "Senaryo" | "Video" | "Soru Seti" | "Yayın";
  // Metin ve renk taşınmaz — yalnız kod taşınır, karşılığı tek sözlükten okunur
  // (lib/utils/durum/mesaj.ts). Böylece aynı durum her ekranda aynı yazar.
  durum_kodu: DurumKodu;
  tarih: string;
  yol: string;
  kategori: TakipKategori;
}

/** Durum kodu → ana sayfa stat kartı/filtre kategorisi. Karta bağlı olmayan kodlar yalnız "tümü"de görünür. */
function kategoriBul(kod: DurumKodu): TakipKategori {
  switch (kod) {
    case "onay_bekleniyor": return "inceleme";
    // Kendi hazır videosunu yüklemesi bekleniyor — aksiyon üreticide ama "onay"
    // kartına girmez (bugünkü davranış korunur; ayrı kart istenirse ayrı iş).
    case "video_bekleniyor": return "video-bekleyen";
    case "yayin_bekleniyor": return "yayin-bekleyen";
    case "yayinda": return "yayinda";
    case "planlandi": return "planlanan";
    case "yayin_durduruldu": return "durdurulan";
    case "iptal": return "iptal";
    case "sistem_hatasi": return "hata";
    default: return "devam";
  }
}

export async function getUreticiAnaSayfaVeri(userId: string, adminSupabase: SupabaseClient) {
  const { data: talepler, error: talepError } = await adminSupabase
    .from("talepler")
    .select(`talep_id, talep_no, hedef_rol, hazir_video, hazir_soru_seti, created_at, urun_adi, urunler(urun_adi), teknikler(teknik_adi), firmalar(firma_adi)`)
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
    const hazir_soru_seti = (talep as any).hazir_soru_seti === true;
    // Zincir boyunca "bir önceki aşamanın tarihi" — bekleyen satırların tarihi buradan.
    let oncekiTarih: string = talep.created_at;

    // ── Senaryo aşaması: yalnız normal kol. Hazır video senaryosuz, bu aşamayı atlar. ──
    if (!hazirVideo) {
      const { data: senaryolar } = await adminSupabase
        .from("senaryolar")
        .select("senaryo_id, iu_id")
        .eq("talep_id", talep.talep_id)
        .order("created_at", { ascending: false })
        .limit(1);

      const sonSenaryo = senaryolar?.[0];

      if (!sonSenaryo) {
        // Senaryo kaydı yok → hiçbir İÜ işi üstlenmemiş; iş İÜ tarafında bekliyor.
        satirlar.push({ talep_id: talep.talep_id, talep_no, firma_adi, urun_adi, teknik_adi, hedef_rol, hazir_video: hazirVideo, hazir_soru_seti, asama: "Senaryo", durum_kodu: "iu_iletildi", tarih: oncekiTarih, yol: `/talepler/${talep.talep_id}`, kategori: "devam" });
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
        const kod = kayitDurumKodu(sonSD?.durum, !!(sonSenaryo as any).iu_id);
        if (kod === "onay_bekleniyor") inceleme_bekleyen++;
        satirlar.push({ talep_id: talep.talep_id, talep_no, firma_adi, urun_adi, teknik_adi, hedef_rol, hazir_video: hazirVideo, hazir_soru_seti, asama: "Senaryo", durum_kodu: kod, tarih: sonSD?.created_at ?? oncekiTarih, yol: `/senaryolar/${talep.talep_id}`, kategori: kategoriBul(kod) });
        continue;
      }
      oncekiTarih = sonSD.created_at;
    }

    // ── Video aşaması (ortak): video talebe talep_id ile bağlı (hazır + normal). ──
    const { data: videolar } = await adminSupabase
      .from("videolar")
      .select("video_id, iu_id")
      .eq("talep_id", talep.talep_id)
      .order("created_at", { ascending: false })
      .limit(1);

    const sonVideo = videolar?.[0];

    if (!sonVideo) {
      // Hazır kolda video kaydı yoksa yükleme üreticidedir. Normal kolda kabuk
      // senaryo onayıyla doğduğundan burada olmaması zincir kopmasıdır.
      const kod: DurumKodu = hazirVideo ? "video_bekleniyor" : "sistem_hatasi";
      satirlar.push({ talep_id: talep.talep_id, talep_no, firma_adi, urun_adi, teknik_adi, hedef_rol, hazir_video: hazirVideo, hazir_soru_seti, asama: "Video", durum_kodu: kod, tarih: oncekiTarih, yol: hazirVideo ? `/talepler/${talep.talep_id}` : `/videolar`, kategori: kategoriBul(kod) });
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
      const kod = kayitDurumKodu(sonVD?.durum, !!(sonVideo as any).iu_id);
      if (kod === "onay_bekleniyor") inceleme_bekleyen++;
      satirlar.push({ talep_id: talep.talep_id, talep_no, firma_adi, urun_adi, teknik_adi, hedef_rol, hazir_video: hazirVideo, hazir_soru_seti, asama: "Video", durum_kodu: kod, tarih: sonVD?.created_at ?? oncekiTarih, yol: `/videolar`, kategori: kategoriBul(kod) });
      continue;
    }
    oncekiTarih = sonVD.created_at;

    // ── Soru seti aşaması (ortak): set video_durum_id ile bağlı. ──
    const { data: soruSetleri } = await adminSupabase
      .from("soru_setleri")
      .select("soru_seti_id, iu_id")
      .eq("video_durum_id", sonVD.video_durum_id)
      .order("created_at", { ascending: false })
      .limit(1);

    const sonSoruSeti = soruSetleri?.[0];

    if (!sonSoruSeti) {
      // Set kabuğu video onayıyla (hazır kolda yükleme anında) doğar; yoksa zincir kopuktur.
      satirlar.push({ talep_id: talep.talep_id, talep_no, firma_adi, urun_adi, teknik_adi, hedef_rol, hazir_video: hazirVideo, hazir_soru_seti, asama: "Soru Seti", durum_kodu: "sistem_hatasi", tarih: oncekiTarih, yol: `/soru-setleri`, kategori: "hata" });
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
      const kod = kayitDurumKodu(sonSSD?.durum, !!(sonSoruSeti as any).iu_id);
      if (kod === "onay_bekleniyor") inceleme_bekleyen++;
      satirlar.push({ talep_id: talep.talep_id, talep_no, firma_adi, urun_adi, teknik_adi, hedef_rol, hazir_video: hazirVideo, hazir_soru_seti, asama: "Soru Seti", durum_kodu: kod, tarih: sonSSD?.created_at ?? oncekiTarih, yol: `/soru-setleri`, kategori: kategoriBul(kod) });
      continue;
    }
    oncekiTarih = sonSSD.created_at;

    // ── Yayın aşaması ──
    const { data: yayin } = await adminSupabase
      .from("yayin_yonetimi")
      .select("yayin_id, durum, yayin_tarihi")
      .eq("soru_seti_durum_id", sonSSD.soru_seti_durum_id)
      .maybeSingle();

    // Yayın durumu tek eşleyiciden okunur — 'planlandi' artık "Durduruldu"ya düşmez.
    const yayinKodu = yayinDurumKodu(yayin?.durum);
    if (yayinKodu === "yayin_bekleniyor") yayin_bekleyen++;
    if (yayinKodu === "yayinda") yayinda++;
    satirlar.push({
      talep_id: talep.talep_id, talep_no, firma_adi, urun_adi, teknik_adi, hedef_rol,
      hazir_video: hazirVideo, hazir_soru_seti, asama: "Yayın",
      durum_kodu: yayinKodu,
      tarih: yayin?.yayin_tarihi ?? oncekiTarih,
      yol: `/yayin-yonetimi`,
      kategori: kategoriBul(yayinKodu),
    });
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
