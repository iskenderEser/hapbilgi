// lib/utils/anaSayfa/uretici.ts
// Üretici rolleri ana sayfa verisi (içerik takibi: her talebin aşama + durumu).
//
// 27.07 — DOSYA SIFIRDAN YAZILDI. Eski sürüm üretim zincirini TypeScript'te
// döngüyle yürüyor, talep başına 7 sorgu atıyordu (1+7N). 6 talepli bir
// üreticide 43 ardışık gidiş-geliş ölçüldü: /ana-sayfa/api 2.9 sn. Projenin
// geri kalanı hesabı DB'ye yaptırır (Yayındaki Videolar → v_yayin_detay,
// Raporlar → get_kullanici_ozet, Talepler → tek toplu sorgu); bu dosya tek
// aykırıydı ve şikayetin tamamı buradan geliyordu.
//
// YENİ DESEN — talep sayısından bağımsız SABİT 2 sorgu, ikisi paralel:
//   1) talepler + künye join'leri → adlar tek çeviriciden (haritalaTalep)
//   2) v_uretici_icerik_takip     → zincirin son durumu (LATERAL, DB'de çözülür)
//
// SINIR — view ne yapar, ne yapmaz: view yalnız HAM veri döndürür (son
// kayıtların id/iu_id/durum/tarih'i). Aşama seçimi ve durum metni burada kalır:
// durum kodları mesaj.ts'in tek sözlüğünden okunur, böylece aynı durum her
// ekranda aynı yazar. Zinciri DB'ye taşımak bu ayrımı bozmaz.
//
// "Kayıt yok" ile "kayıt var ama durumu yok" ayrımı *_id kolonlarının
// NULL'luğundan yapılır — durum ikisinde de NULL'dur, ayrımı id verir.
//
// 23.07 kuralı korunur: hazır video senaryosuzdur, senaryo aşaması yalnız normal
// kolda işletilir; video her iki kolda da talep_id ile bulunur.

import { SupabaseClient } from "@supabase/supabase-js";
import type { HedefRol } from "@/lib/utils/roller";
import { kayitDurumKodu, yayinDurumKodu, type DurumKodu } from "@/lib/utils/durum/mesaj";
import { TALEP_ALANLARI, haritalaTalep, type TalepBilgisi } from "@/lib/utils/talepZinciri";

type TakipKategori =
  | "inceleme" | "yayin-bekleyen" | "yayinda" | "durdurulan"
  | "devam" | "iptal" | "planlanan" | "hata" | "video-bekleyen";

// 27.07: dördüncü aşama "Yayın" değil "Tamamlandı". Sebep: durum sütunundaki
// metinlerin çoğu "yayın" kelimesini taşıyor (Yayına Alınız, Yayına Aldınız,
// Yayınını Planladınız); yan yana iki sütunda aynı kelime tekrarlanıyordu.
type Asama = "Senaryo" | "Video" | "Soru Seti" | "Tamamlandı";

interface TakipSatiri {
  talep_id: string;
  talep_no: number | null;
  firma_adi: string;
  urun_adi: string;
  teknik_adi: string;
  hedef_rol: HedefRol;
  hazir_video: boolean;
  hazir_soru_seti: boolean;
  asama: Asama;
  // Metin ve renk taşınmaz — yalnız kod taşınır, karşılığı tek sözlükten okunur
  // (lib/utils/durum/mesaj.ts). Böylece aynı durum her ekranda aynı yazar.
  durum_kodu: DurumKodu;
  tarih: string;
  yol: string;
  kategori: TakipKategori;
}

/** v_uretici_icerik_takip'in bir satırı: bir talebin üretim zinciri anlık görüntüsü. */
interface ZincirSatiri {
  talep_id: string;
  senaryo_id: string | null;
  senaryo_iu_id: string | null;
  senaryo_durum: string | null;
  senaryo_durum_tarih: string | null;
  video_id: string | null;
  video_iu_id: string | null;
  video_durum: string | null;
  video_durum_tarih: string | null;
  soru_seti_id: string | null;
  soru_seti_iu_id: string | null;
  soru_seti_durum: string | null;
  soru_seti_durum_tarih: string | null;
  yayin_durum: string | null;
  yayin_tarihi: string | null;
}

// Kolonlar açık yazılır (select("*") DEĞİL): denetim aracı yıldızı atlar, açık
// listede ise view kolonu değişirse `npm run denetim` bunu yakalar.
const ZINCIR_ALANLARI = `
  talep_id,
  senaryo_id, senaryo_iu_id, senaryo_durum, senaryo_durum_tarih,
  video_id, video_iu_id, video_durum, video_durum_tarih,
  soru_seti_id, soru_seti_iu_id, soru_seti_durum, soru_seti_durum_tarih,
  yayin_durum, yayin_tarihi
`;

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

/**
 * Zincirin nerede durduğunu bulur: ilk tamamlanmamış aşama satırın aşamasıdır.
 * Saf fonksiyon — sorgu yapmaz, yalnız view satırını okur.
 * Bekleyen aşamaların tarihi "bir önceki aşamanın onay tarihi"dir (oncekiTarih).
 */
function asamaCoz(talep: TalepBilgisi, z: ZincirSatiri): Omit<TakipSatiri, keyof TalepKunye | "kategori"> {
  let oncekiTarih: string = talep.created_at ?? "";

  // ── Senaryo: yalnız normal kol. Hazır video senaryosuz, bu aşamayı atlar. ──
  if (!talep.hazir_video) {
    if (!z.senaryo_id) {
      // Senaryo kaydı yok → hiçbir İÜ işi üstlenmemiş; iş İÜ tarafında bekliyor.
      return { asama: "Senaryo", durum_kodu: "iu_iletildi", tarih: oncekiTarih, yol: `/talepler/${talep.talep_id}` };
    }
    if (z.senaryo_durum !== "onaylandi") {
      return {
        asama: "Senaryo",
        durum_kodu: kayitDurumKodu(z.senaryo_durum, !!z.senaryo_iu_id),
        tarih: z.senaryo_durum_tarih ?? oncekiTarih,
        yol: `/senaryolar/${talep.talep_id}`,
      };
    }
    oncekiTarih = z.senaryo_durum_tarih ?? oncekiTarih;
  }

  // ── Video (ortak): video talebe talep_id ile bağlı (hazır + normal). ──
  if (!z.video_id) {
    // Hazır kolda video kaydı yoksa yükleme üreticidedir. Normal kolda kabuk
    // senaryo onayıyla doğduğundan burada olmaması zincir kopmasıdır.
    const kod: DurumKodu = talep.hazir_video ? "video_bekleniyor" : "sistem_hatasi";
    return {
      asama: "Video",
      durum_kodu: kod,
      tarih: oncekiTarih,
      yol: talep.hazir_video ? `/talepler/${talep.talep_id}` : "/videolar",
    };
  }
  if (z.video_durum !== "onaylandi") {
    return {
      asama: "Video",
      durum_kodu: kayitDurumKodu(z.video_durum, !!z.video_iu_id),
      tarih: z.video_durum_tarih ?? oncekiTarih,
      yol: "/videolar",
    };
  }
  oncekiTarih = z.video_durum_tarih ?? oncekiTarih;

  // ── Soru seti (ortak): set video_durum_id ile bağlı. ──
  if (!z.soru_seti_id) {
    // Set kabuğu video onayıyla (hazır kolda yükleme anında) doğar; yoksa zincir kopuktur.
    return { asama: "Soru Seti", durum_kodu: "sistem_hatasi", tarih: oncekiTarih, yol: "/soru-setleri" };
  }
  if (z.soru_seti_durum !== "onaylandi") {
    return {
      asama: "Soru Seti",
      durum_kodu: kayitDurumKodu(z.soru_seti_durum, !!z.soru_seti_iu_id),
      tarih: z.soru_seti_durum_tarih ?? oncekiTarih,
      yol: "/soru-setleri",
    };
  }
  oncekiTarih = z.soru_seti_durum_tarih ?? oncekiTarih;

  // ── Yayın: zincirin sonu. Kayıt yoksa yayına alma üreticidedir (mesaj.ts). ──
  return {
    asama: "Tamamlandı",
    durum_kodu: yayinDurumKodu(z.yayin_durum),
    tarih: z.yayin_tarihi ?? oncekiTarih,
    yol: "/yayin-yonetimi",
  };
}

/** Satırın künye alanları — talepten gelir, zincirden değil. */
type TalepKunye = Pick<TakipSatiri,
  "talep_id" | "talep_no" | "firma_adi" | "urun_adi" | "teknik_adi" | "hedef_rol" | "hazir_video" | "hazir_soru_seti">;

export async function getUreticiAnaSayfaVeri(userId: string, adminSupabase: SupabaseClient) {
  // İki sorgu paralel: künye/adlar ∥ zincir. İkisi de uretici_id süzgeçli.
  const [talepR, zincirR] = await Promise.all([
    adminSupabase
      .from("talepler")
      .select(TALEP_ALANLARI)
      .eq("uretici_id", userId)
      .order("created_at", { ascending: false }),
    adminSupabase
      .from("v_uretici_icerik_takip")
      .select(ZINCIR_ALANLARI)
      .eq("uretici_id", userId),
  ]);

  // DB'nin kendi mesajı taşınır: "çekilemedi" tek başına teşhis ettirmiyor
  // (27.07 dersi — 500'ün sebebi ancak sunucu terminalinden bulunabiliyordu).
  if (talepR.error) throw new Error(`Talepler çekilemedi: ${talepR.error.message}`);
  if (zincirR.error) throw new Error(`İçerik takibi çekilemedi: ${zincirR.error.message}`);

  const zincirler = new Map<string, ZincirSatiri>();
  for (const z of (zincirR.data ?? []) as unknown as ZincirSatiri[]) zincirler.set(z.talep_id, z);

  const satirlar: TakipSatiri[] = [];

  for (const ham of talepR.data ?? []) {
    // Alan listesi ve ad kuralı ortak kaynaktan (25.07, Aşama 3): tek çeviriciden geçilir.
    const talep = haritalaTalep(ham);
    const zincir = zincirler.get(talep.talep_id);

    // View talepler'den beslenir, her talep için tam bir satır döndürür. Eşleşme
    // yoksa veri eksiktir; sessizce "İÜ'ye iletildi" göstermek yanlış bilgi olur.
    if (!zincir) throw new Error("İçerik takibi eksik: talep zinciri okunamadı.");

    const kunye: TalepKunye = {
      talep_id: talep.talep_id,
      talep_no: talep.talep_no,
      firma_adi: talep.firma_adi,
      urun_adi: talep.urun_adi,
      teknik_adi: talep.teknik_adi,
      hedef_rol: talep.hedef_rol,
      hazir_video: talep.hazir_video,
      hazir_soru_seti: talep.hazir_soru_seti,
    };
    const asama = asamaCoz(talep, zincir);
    satirlar.push({ ...kunye, ...asama, kategori: kategoriBul(asama.durum_kodu) });
  }

  // Sayaçlar durum kodundan türer. Eşdeğerlik: "onay_bekleniyor" yalnız kayıt
  // aşamalarından (kayitDurumKodu), "yayin_bekleniyor"/"yayinda" yalnız yayın
  // aşamasından (yayinDurumKodu) doğabilir — ikisi ortak kod üretmez. Bu yüzden
  // koda bakmak, aşama içinde sayaç artırmakla birebir aynı sonucu verir.
  const say = (kod: DurumKodu) => satirlar.filter((s) => s.durum_kodu === kod).length;

  return {
    satirlar,
    istatistikler: {
      inceleme_bekleyen: say("onay_bekleniyor"),
      yayin_bekleyen: say("yayin_bekleniyor"),
      yayinda: say("yayinda"),
      toplam: satirlar.length,
    },
  };
}
