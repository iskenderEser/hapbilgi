import type { HapbiMotorCalistirmaSonucu } from "../motor/calistir";
import type { HapbiSonucDogrulamaSonucu } from "../motor/dogrula";
import type { HapbiKanitOlusturmaSonucu } from "../motor/kanit";
import type { HapbiSorguPlaniSonucu } from "../motor/sorguOlustur";

export type HapbiBelirsizlikTuru =
  | "sonuc_bulunamadi"
  | "sorgu_desteklenmiyor"
  | "sonuc_dogrulanamadi"
  | "veri_okunamadi";

export type HapbiBelirsizlikYaniti = Readonly<{
  tur: HapbiBelirsizlikTuru;
  metin: string;
}>;

export type HapbiBelirsizlikGirdisi =
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

function yanit(tur: HapbiBelirsizlikTuru, metin: string): HapbiBelirsizlikYaniti {
  return { tur, metin };
}

function planlamaYaniti(sonuc: HapbiSorguPlaniSonucu): HapbiBelirsizlikYaniti | null {
  if (sonuc.basarili) return null;
  return yanit(
    "sorgu_desteklenmiyor",
    "Bu sorgu için izinli ve doğrulanabilir bir veri kaynağı bulunmuyor.",
  );
}

function calistirmaYaniti(sonuc: HapbiMotorCalistirmaSonucu): HapbiBelirsizlikYaniti | null {
  if (!sonuc.basarili) {
    return yanit("veri_okunamadi", "İstenen veri şu anda okunamadı. Lütfen yeniden deneyin.");
  }
  if (sonuc.sonuc.veriDurumu === "bos") {
    return yanit("sonuc_bulunamadi", "Belirtilen kapsam ve zaman aralığında sonuç bulunamadı.");
  }
  if (sonuc.sonuc.veriDurumu === "eksik") {
    return yanit(
      "sonuc_dogrulanamadi",
      "Sonuç için gereken veriler eksik olduğu için kesin bir değer verilemiyor.",
    );
  }
  return null;
}

function dogrulamaYaniti(sonuc: HapbiSonucDogrulamaSonucu): HapbiBelirsizlikYaniti | null {
  if (sonuc.dogrulandi) return null;
  return yanit(
    "sonuc_dogrulanamadi",
    "Hesaplanan sonuç doğrulanamadığı için kesin bilgi verilemiyor.",
  );
}

function kanitYaniti(sonuc: HapbiKanitOlusturmaSonucu): HapbiBelirsizlikYaniti | null {
  if (sonuc.basarili) return null;
  if (sonuc.neden === "sonuc_bos") {
    return yanit("sonuc_bulunamadi", "Belirtilen kapsam ve zaman aralığında sonuç bulunamadı.");
  }
  return yanit(
    "sonuc_dogrulanamadi",
    "Sonucu destekleyen kanıtlar doğrulanamadığı için kesin bilgi verilemiyor.",
  );
}

export function hapbiBelirsizlikYanitiOlustur(
  girdi: HapbiBelirsizlikGirdisi,
): HapbiBelirsizlikYaniti | null {
  if (girdi.asama === "planlama") return planlamaYaniti(girdi.sonuc);
  if (girdi.asama === "calistirma") return calistirmaYaniti(girdi.sonuc);
  if (girdi.asama === "dogrulama") return dogrulamaYaniti(girdi.sonuc);
  return kanitYaniti(girdi.sonuc);
}
