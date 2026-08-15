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
import type { HedefRoller } from "@/lib/utils/roller";
import { type DurumKodu } from "@/lib/utils/durum/mesaj";
import { TALEP_ALANLARI, haritalaTalep } from "@/lib/utils/talepZinciri";
// Zincir okuma ve aşama kaskadı ortak dosyada (27.07): aynı soruyu Talepler
// sayfası da soruyor, iki kopya zamanla iki farklı cevap verirdi.
import { asamaCoz, zincirHaritasi, type ZincirAsama } from "@/lib/utils/uretimZinciri";

type TakipKategori =
  | "inceleme" | "yayin-bekleyen" | "yayinda" | "durdurulan"
  | "devam" | "iptal" | "planlanan" | "hata" | "video-bekleyen";

type Asama = ZincirAsama;

interface TakipSatiri {
  talep_id: string;
  talep_no: number | null;
  firma_adi: string;
  urun_adi: string;
  teknik_adi: string;
  hedef_roller: HedefRoller;
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

/** Satırın künye alanları — talepten gelir, zincirden değil. */
type TalepKunye = Pick<TakipSatiri,
  "talep_id" | "talep_no" | "firma_adi" | "urun_adi" | "teknik_adi" | "hedef_roller" | "hazir_video" | "hazir_soru_seti">;

export async function getUreticiAnaSayfaVeri(userId: string, adminSupabase: SupabaseClient) {
  // İki sorgu paralel: künye/adlar ∥ zincir. İkisi de uretici_id süzgeçli.
  const [talepR, zincirler] = await Promise.all([
    adminSupabase
      .from("talepler")
      .select(TALEP_ALANLARI)
      .eq("uretici_id", userId)
      .order("created_at", { ascending: false }),
    zincirHaritasi(adminSupabase, { ureticiId: userId }),
  ]);

  // DB'nin kendi mesajı taşınır: "çekilemedi" tek başına teşhis ettirmiyor
  // (27.07 dersi — 500'ün sebebi ancak sunucu terminalinden bulunabiliyordu).
  if (talepR.error) throw new Error(`Talepler çekilemedi: ${talepR.error.message}`);

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
      hedef_roller: talep.hedef_roller,
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
