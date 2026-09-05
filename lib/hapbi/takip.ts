import { hapbiDoneminiCoz } from "@/lib/hapbi/soruPlani";
import type { HapbiBekleyenTakip } from "@/lib/hapbi/sozlesme";

type Takvim = { yil: number; ay: number; ceyrek: number; hafta: number };

export type HapbiTakipCozumu = {
  soru: string;
  durum: "yok" | "cozuldu" | "eksik";
};

function duzelt(metin: string): string {
  return metin.toLocaleLowerCase("tr-TR").replace(/[’']/gu, "").replace(/\s+/gu, " ").trim();
}

function yalnizDonemYanitiMi(soru: string): boolean {
  const s = duzelt(soru).replace(/[.!?]+$/u, "").trim();
  const ceyrek = "(?:çeyrek|ceyrek|quarter|kuartır|kuartir|dönem|donem)";
  const sira = "(?:birinci|ilk|ikinci|üçüncü|dördüncü)";
  const ifade = [
    `q\\s*[1-4](?:te|ta|de|da)?`,
    `[1-4]\\s*q`,
    `[1-4]\\.?\\s*${ceyrek}`,
    `${ceyrek}\\s*[1-4]`,
    `${sira}\\s+${ceyrek}`,
    `bu\\s+(?:hafta|ay|${ceyrek}|yıl)`,
    `\\d{1,2}\\.?\\s*(?:hafta|ay)`,
    `20\\d{2}(?:\\s+yılı)?`,
  ].join("|");
  return new RegExp(`^(?:20\\d{2}\\s+)?(?:${ifade})(?:\\s+20\\d{2})?(?:\\s+(?:olsun|için|lütfen|esas al(?:alım)?))?$`, "u").test(s);
}

function donemiYaz(p: Record<string, string | number>): string {
  if (p.periyot === "donem") return `${p.ceyrek}. çeyrek ${p.yil}`;
  if (p.periyot === "hafta") return `${p.hafta}. hafta ${p.yil}`;
  if (p.periyot === "ay") return `${p.ay}. ay ${p.yil}`;
  return `${p.yil} yılı`;
}

function donemYanitiGibiMi(soru: string): boolean {
  const s = duzelt(soru);
  return s.length <= 40 && /\b(?:hafta|ay|çeyrek|ceyrek|quarter|kuartır|kuartir|dönem|donem|yıl|q\s*[1-4]|[1-4]\s*q)\b/u.test(s);
}

export function hapbiTakibiniCoz(
  soru: string,
  bekleyen: HapbiBekleyenTakip | null | undefined,
  pathname: string,
  takvim: Takvim,
): HapbiTakipCozumu {
  if (!bekleyen || bekleyen.pathname !== pathname || bekleyen.eksikAlanlar[0] !== "donem") {
    return { soru, durum: "yok" };
  }
  const donem = hapbiDoneminiCoz(soru, takvim);
  if (donem && yalnizDonemYanitiMi(soru)) {
    return { soru: `${bekleyen.soru} ${donemiYaz(donem)}`, durum: "cozuldu" };
  }
  if (donemYanitiGibiMi(soru)) return { soru: bekleyen.soru, durum: "eksik" };
  return { soru, durum: "yok" };
}

export function hapbiBekleyenTakipOlustur(soru: string, pathname: string): HapbiBekleyenTakip {
  return { tur: "netlestirme", soru, eksikAlanlar: ["donem"], pathname };
}
