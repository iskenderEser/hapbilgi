import {
  ayBaslangici,
  ayKaydir,
  ceyrekBaslangici,
  haftaBaslangici,
  yilBaslangici,
} from "../zaman/kontrol";

import type {
  HapbiZamanAraligi,
  HapbiZamanCozumlemeSecenekleri,
  HapbiZamanCozumlemeSonucu,
  HapbiZamanSecimi,
  HapbiZamanTuru,
  HapbiZamanYonelimi,
} from "./zamanSozlesmesi";

const GUN_MS = 24 * 60 * 60 * 1000;
const TR_SAAT_DILIMI = "Europe/Istanbul" as const;

const BAGIL_ZAMAN_DESENI = /(?:^|\s)(bu|son)\s+(hafta(?:da|nin|yi)?|ay(?:da|in|i)?|donem(?:de|in|i)?|ceyrek(?:te|in|i)?|kuartir(?:da|in|i)?|quarter|yil(?:da|in|i)?)(?=\s|$)/gu;
const UC_AY_DESENI = /(?:^|\s)3\s+ay(?:da|in|i)?(?=\s|$)/u;

function turkceyiSadelestir(ifade: string): string {
  return ifade
    .toLocaleLowerCase("tr-TR")
    .replaceAll("ç", "c")
    .replaceAll("ğ", "g")
    .replaceAll("ı", "i")
    .replaceAll("ö", "o")
    .replaceAll("ş", "s")
    .replaceAll("ü", "u")
    .replace(/[^a-z0-9\s]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function zamanTurunuBul(ifade: string): HapbiZamanTuru {
  if (ifade.startsWith("hafta")) return "hafta";
  if (ifade.startsWith("ay")) return "ay";
  if (ifade.startsWith("yil")) return "yil";
  return "donem";
}

function benzersizSecimler(secimler: HapbiZamanSecimi[]): HapbiZamanSecimi[] {
  const gorulenler = new Set<string>();
  return secimler.filter((secim) => {
    const anahtar = `${secim.yonelim}:${secim.tur}`;
    if (gorulenler.has(anahtar)) return false;
    gorulenler.add(anahtar);
    return true;
  });
}

export function hapbiZamanSecimleriniBul(ifade: string): HapbiZamanSecimi[] {
  const sadeIfade = turkceyiSadelestir(ifade);
  const secimler = [...sadeIfade.matchAll(BAGIL_ZAMAN_DESENI)].map((eslesme) => ({
    yonelim: eslesme[1] as HapbiZamanYonelimi,
    tur: zamanTurunuBul(eslesme[2]),
  }));

  return benzersizSecimler(secimler);
}

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

export function hapbiZamanIfadesiniCoz(
  ifade: string,
  secenekler: HapbiZamanCozumlemeSecenekleri = {},
): HapbiZamanCozumlemeSonucu {
  const secimler = hapbiZamanSecimleriniBul(ifade);

  if (secimler.length > 1) return { basarili: false, neden: "birden_fazla_zaman" };
  if (secimler.length === 1) {
    return {
      basarili: true,
      zaman: hapbiZamanAraligiOlustur(secimler[0], secenekler.simdi),
      kaynak: "soru",
    };
  }

  if (UC_AY_DESENI.test(turkceyiSadelestir(ifade))) {
    return { basarili: false, neden: "uc_ay_donem_degildir" };
  }

  if (secenekler.kesinDevamSorusuMu === true && secenekler.oncekiZaman) {
    return {
      basarili: true,
      zaman: secenekler.oncekiZaman,
      kaynak: "devam_baglami",
    };
  }

  return { basarili: false, neden: "zaman_bulunamadi" };
}
