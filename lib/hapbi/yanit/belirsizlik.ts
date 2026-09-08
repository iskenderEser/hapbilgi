import type {
  HapbiDerlemeAlani,
  HapbiDerlemeSonucu,
} from "../dil/derleyici";
import type { HapbiMotorCalistirmaSonucu } from "../motor/calistir";
import type { HapbiSonucDogrulamaSonucu } from "../motor/dogrula";
import type { HapbiKanitOlusturmaSonucu } from "../motor/kanit";
import type { HapbiSorguPlaniSonucu } from "../motor/sorguOlustur";

export type HapbiBelirsizlikTuru =
  | "netlestirme"
  | "sonuc_bulunamadi"
  | "sorgu_desteklenmiyor"
  | "sonuc_dogrulanamadi"
  | "veri_okunamadi";

export type HapbiBelirsizlikYaniti = Readonly<{
  tur: HapbiBelirsizlikTuru;
  metin: string;
  istenenAlan: HapbiDerlemeAlani | null;
  eksikAlanlar: readonly HapbiDerlemeAlani[];
  geminiCagrisi: 0;
}>;

export type HapbiBelirsizlikGirdisi =
  | Readonly<{
    asama: "derleme";
    sonuc: HapbiDerlemeSonucu;
  }>
  | Readonly<{
    asama: "planlama";
    sonuc: HapbiSorguPlaniSonucu;
  }>
  | Readonly<{
    asama: "calistirma";
    sonuc: HapbiMotorCalistirmaSonucu;
  }>
  | Readonly<{
    asama: "dogrulama";
    sonuc: HapbiSonucDogrulamaSonucu;
  }>
  | Readonly<{
    asama: "kanit";
    sonuc: HapbiKanitOlusturmaSonucu;
  }>;

export type HapbiBekleyenNetlestirme = Readonly<{
  soruKimligi: string;
  beklenenAlan: HapbiDerlemeAlani;
}>;

export type HapbiDevamBaglamiGirdisi = Readonly<{
  soruKimligi: string;
  kesinDevamSorusuMu: boolean;
  oncekiBeklenti?: HapbiBekleyenNetlestirme | null;
}>;

const ALAN_SORULARI: Readonly<Record<HapbiDerlemeAlani, string>> = {
  zaman: "Hangi zamanı esas alayım: bu hafta, son hafta, bu ay, son ay, bu dönem, son dönem, bu yıl veya son yıl?",
  olcut: "Hangi ölçütü esas alayım: puan, izleme, beğeni, favori, doğru cevap, yanlış cevap veya ileri sarılan süre?",
  sonucOlcutu: "Seçilen varlık için hangi sonuç ölçütünü vereyim?",
  kirilim: "Sonucu hangi kırılımda vereyim: kullanıcı, UTT, ürün, yayın, takım, bölge veya firma?",
  islem: "Hangi işlemi yapayım: doğrudan değer, toplam, sıralama, karşılaştırma, fark, dağılım, katkı, eğilim veya koşullu seçim?",
  siralamaYonu: "Sıralama artan mı, azalan mı olsun?",
  karsilastirma: "Karşılaştırmanın diğer zamanını veya varlığını belirtir misiniz?",
};

const ALAN_ONCELIGI = [
  "olcut",
  "sonucOlcutu",
  "kirilim",
  "islem",
  "siralamaYonu",
  "karsilastirma",
  "zaman",
] as const satisfies readonly HapbiDerlemeAlani[];

function benzersizAlanlar(alanlar: readonly HapbiDerlemeAlani[]): HapbiDerlemeAlani[] {
  return [...new Set(alanlar)];
}

function istenecekAlaniSec(alanlar: readonly HapbiDerlemeAlani[]): HapbiDerlemeAlani | null {
  const alanKumesi = new Set(alanlar);
  return ALAN_ONCELIGI.find((alan) => alanKumesi.has(alan)) ?? null;
}

function netlestirmeYaniti(
  alanlar: readonly HapbiDerlemeAlani[],
  ayrinti?: string,
): HapbiBelirsizlikYaniti {
  const eksikAlanlar = benzersizAlanlar(alanlar);
  const istenenAlan = istenecekAlaniSec(eksikAlanlar);
  if (!istenenAlan) {
    return {
      tur: "sorgu_desteklenmiyor",
      metin: ayrinti
        ? `Bu sorgu henüz desteklenmiyor: ${ayrinti}.`
        : "Bu sorgu henüz desteklenmiyor.",
      istenenAlan: null,
      eksikAlanlar: [],
      geminiCagrisi: 0,
    };
  }

  return {
    tur: "netlestirme",
    metin: ALAN_SORULARI[istenenAlan],
    istenenAlan,
    eksikAlanlar,
    geminiCagrisi: 0,
  };
}

function derlemeYaniti(sonuc: HapbiDerlemeSonucu): HapbiBelirsizlikYaniti | null {
  if (sonuc.basarili) return null;
  if (sonuc.neden === "eksik_bilgi" || sonuc.neden === "belirsiz_bilgi") {
    return netlestirmeYaniti(sonuc.alanlar, sonuc.ayrinti);
  }
  return {
    tur: "sorgu_desteklenmiyor",
    metin: "Bu sorgunun ölçüt, kırılım ve işlem birleşimi henüz desteklenmiyor.",
    istenenAlan: null,
    eksikAlanlar: [],
    geminiCagrisi: 0,
  };
}

function planlamaYaniti(sonuc: HapbiSorguPlaniSonucu): HapbiBelirsizlikYaniti | null {
  if (sonuc.basarili) return null;
  return {
    tur: "sorgu_desteklenmiyor",
    metin: "Bu sorgu için izinli ve doğrulanabilir bir veri kaynağı bulunmuyor.",
    istenenAlan: null,
    eksikAlanlar: [],
    geminiCagrisi: 0,
  };
}

function calistirmaYaniti(sonuc: HapbiMotorCalistirmaSonucu): HapbiBelirsizlikYaniti | null {
  if (!sonuc.basarili) {
    return {
      tur: "veri_okunamadi",
      metin: "İstenen veri şu anda okunamadı. Lütfen yeniden deneyin.",
      istenenAlan: null,
      eksikAlanlar: [],
      geminiCagrisi: 0,
    };
  }
  if (sonuc.sonuc.veriDurumu === "bos") {
    return {
      tur: "sonuc_bulunamadi",
      metin: "Belirtilen kapsam ve zaman aralığında sonuç bulunamadı.",
      istenenAlan: null,
      eksikAlanlar: [],
      geminiCagrisi: 0,
    };
  }
  if (sonuc.sonuc.veriDurumu === "eksik") {
    return {
      tur: "sonuc_dogrulanamadi",
      metin: "Sonuç için gereken veriler eksik olduğu için kesin bir değer verilemiyor.",
      istenenAlan: null,
      eksikAlanlar: [],
      geminiCagrisi: 0,
    };
  }
  return null;
}

function dogrulamaYaniti(sonuc: HapbiSonucDogrulamaSonucu): HapbiBelirsizlikYaniti | null {
  if (sonuc.dogrulandi) return null;
  return {
    tur: "sonuc_dogrulanamadi",
    metin: "Hesaplanan sonuç doğrulanamadığı için kesin bilgi verilemiyor.",
    istenenAlan: null,
    eksikAlanlar: [],
    geminiCagrisi: 0,
  };
}

function kanitYaniti(sonuc: HapbiKanitOlusturmaSonucu): HapbiBelirsizlikYaniti | null {
  if (sonuc.basarili) return null;
  if (sonuc.neden === "sonuc_bos") {
    return {
      tur: "sonuc_bulunamadi",
      metin: "Belirtilen kapsam ve zaman aralığında sonuç bulunamadı.",
      istenenAlan: null,
      eksikAlanlar: [],
      geminiCagrisi: 0,
    };
  }
  return {
    tur: "sonuc_dogrulanamadi",
    metin: "Sonucu destekleyen kanıtlar doğrulanamadığı için kesin bilgi verilemiyor.",
    istenenAlan: null,
    eksikAlanlar: [],
    geminiCagrisi: 0,
  };
}

export function hapbiBelirsizlikYanitiOlustur(
  girdi: HapbiBelirsizlikGirdisi,
): HapbiBelirsizlikYaniti | null {
  if (girdi.asama === "derleme") return derlemeYaniti(girdi.sonuc);
  if (girdi.asama === "planlama") return planlamaYaniti(girdi.sonuc);
  if (girdi.asama === "calistirma") return calistirmaYaniti(girdi.sonuc);
  if (girdi.asama === "dogrulama") return dogrulamaYaniti(girdi.sonuc);
  return kanitYaniti(girdi.sonuc);
}

export function hapbiBekleyenNetlestirmeyiOlustur(
  soruKimligi: string,
  yanit: HapbiBelirsizlikYaniti,
): HapbiBekleyenNetlestirme | null {
  const temizKimlik = soruKimligi.trim();
  if (yanit.tur !== "netlestirme" || !yanit.istenenAlan || !temizKimlik) return null;
  return {
    soruKimligi: temizKimlik,
    beklenenAlan: yanit.istenenAlan,
  };
}

export function hapbiDevamBaglaminiCoz(
  girdi: HapbiDevamBaglamiGirdisi,
): HapbiBekleyenNetlestirme | null {
  if (!girdi.kesinDevamSorusuMu || !girdi.oncekiBeklenti) return null;
  if (!girdi.soruKimligi.trim() || girdi.oncekiBeklenti.soruKimligi !== girdi.soruKimligi.trim()) return null;
  return girdi.oncekiBeklenti;
}

export function hapbiDevamYanitiBeklenenAlaniTamamliyorMu(
  beklenen: HapbiBekleyenNetlestirme,
  tamamlananAlanlar: readonly HapbiDerlemeAlani[],
): boolean {
  const benzersiz = benzersizAlanlar(tamamlananAlanlar);
  return benzersiz.length === 1 && benzersiz[0] === beklenen.beklenenAlan;
}
