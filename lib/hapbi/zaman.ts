import {
  ayBaslangici,
  ayKaydir,
  ceyrekBaslangici,
  haftaBaslangici,
  yilBaslangici,
} from "../zaman/kontrol";

import type {
  HapbiZamanAraligi,
  HapbiZamanSecimi,
  HapbiZamanTuru,
} from "./zamanSozlesmesi";

const GUN_MS = 24 * 60 * 60 * 1000;
const TR_SAAT_DILIMI = "Europe/Istanbul" as const;

function buZamanSinirlari(tur: HapbiZamanTuru, simdi: Date): { baslangic: Date; bitis: Date } {
  if (tur === "hafta") {
    const baslangic = haftaBaslangici(simdi);
    return { baslangic, bitis: new Date(baslangic.getTime() + 7 * GUN_MS) };
  }

  if (tur === "ay") {
    const baslangic = ayBaslangici(simdi);
    return { baslangic, bitis: ayKaydir(baslangic, 1) };
  }

  if (tur === "donem") {
    const baslangic = ceyrekBaslangici(simdi);
    return { baslangic, bitis: ayKaydir(baslangic, 3) };
  }

  const baslangic = yilBaslangici(simdi);
  return { baslangic, bitis: ayKaydir(baslangic, 12) };
}

function sonZamanSinirlari(tur: HapbiZamanTuru, simdi: Date): { baslangic: Date; bitis: Date } {
  const buZaman = buZamanSinirlari(tur, simdi);

  if (tur === "hafta") {
    return {
      baslangic: new Date(buZaman.baslangic.getTime() - 7 * GUN_MS),
      bitis: buZaman.baslangic,
    };
  }

  const geriAlinacakAy = tur === "ay" ? 1 : tur === "donem" ? 3 : 12;
  return {
    baslangic: ayKaydir(buZaman.baslangic, -geriAlinacakAy),
    bitis: buZaman.baslangic,
  };
}

export function hapbiZamanAraligiOlustur(
  secim: HapbiZamanSecimi,
  simdi: Date = new Date(),
): HapbiZamanAraligi {
  if (!Number.isFinite(simdi.getTime())) throw new Error("Geçersiz zaman referansı.");

  const sinirlar = secim.yonelim === "son"
    ? sonZamanSinirlari(secim.tur, simdi)
    : buZamanSinirlari(secim.tur, simdi);

  return {
    tur: secim.tur,
    yonelim: secim.yonelim,
    baslangic: sinirlar.baslangic.toISOString(),
    bitis: sinirlar.bitis.toISOString(),
    baslangicDahil: true,
    bitisHaric: true,
    saatDilimi: TR_SAAT_DILIMI,
  };
}
