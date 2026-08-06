// lib/utils/periyotAltKirilim.ts
//
// Çizgi grafik için periyodu alt dilimlere böler.
// Her dilim: { etiket, baslangic, bitis } — frontend her dilim için ayrı sorgu atar.
//
// Dilim sayıları (default davranış, YTD/MAT yok):
//   bu_gun:     4 dilim (6 / 12 / 18 / 24)
//   bu_hafta:   7 dilim (Pzt / Sal / ... / Paz)
//   bu_ay:      4 dilim (1 / 2 / 3 / 4 hafta)
//   bu_donem:   3 dilim (dönemdeki 3 ay)
//   bu_yil:    12 dilim (Oca / ... / Ara)
//
// X ekseninde gösterilecek etiket, dilim sayısı, dilim sınırları frontend'de
// LineChart'ı doldurmak için kullanılır.

import type { Periyot } from "@/lib/utils/raporUtils";
import {
  gunBaslangici,
  haftaBaslangici,
  ayBaslangici,
  ceyrekBaslangici,
  yilBaslangici,
  ayKaydir,
  aktifDonem,
} from "@/lib/zaman/kontrol";

export type Dilim = {
  etiket: string;
  baslangic: string; // ISO
  bitis: string;     // ISO
};

const AY_KISALTMALARI = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const GUN_KISALTMALARI = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const SAAT_MS = 60 * 60 * 1000;
const GUN_MS = 24 * SAAT_MS;

// Tüm sınırlar lib/zaman/kontrol.ts kavramlarından TR saatine göre kurulur;
// makinenin saat diliminden bağımsızdır (etiket ile sınır aynı takvimden gelir).
// Türkiye DST kullanmadığı için gün/saat kaydırmaları milisaniye ile güvenlidir.
export function periyotAltKirilim(periyot: Periyot, simdi: Date = new Date()): Dilim[] {
  if (periyot === "bu_gun") {
    // 4 dilim: TR 6 saatlik aralıklar (00-06, 06-12, 12-18, 18-24)
    const gunBas = gunBaslangici(simdi).getTime();
    return [0, 1, 2, 3].map((i) => ({
      etiket: String((i + 1) * 6),
      baslangic: new Date(gunBas + i * 6 * SAAT_MS).toISOString(),
      bitis: new Date(gunBas + (i + 1) * 6 * SAAT_MS).toISOString(),
    }));
  }

  if (periyot === "bu_hafta") {
    // 7 dilim: Pzt-Paz (TR)
    const pazartesi = haftaBaslangici(simdi).getTime();
    return [0, 1, 2, 3, 4, 5, 6].map((i) => ({
      etiket: GUN_KISALTMALARI[i],
      baslangic: new Date(pazartesi + i * GUN_MS).toISOString(),
      bitis: new Date(pazartesi + (i + 1) * GUN_MS).toISOString(),
    }));
  }

  if (periyot === "bu_ay") {
    // 4 dilim: ay başından ay sonuna 4 eşit hafta benzeri parça (TR)
    const ayBas = ayBaslangici(simdi);
    const ayBitis = ayKaydir(simdi, 1); // sonraki ayın 1'i
    const toplamGun = Math.round((ayBitis.getTime() - ayBas.getTime()) / GUN_MS);
    const dilimGun = Math.ceil(toplamGun / 4);
    return [0, 1, 2, 3].map((i) => ({
      etiket: String(i + 1),
      baslangic: new Date(ayBas.getTime() + i * dilimGun * GUN_MS).toISOString(),
      // son dilim ay sonuna kadar
      bitis: (i === 3 ? ayBitis : new Date(ayBas.getTime() + (i + 1) * dilimGun * GUN_MS)).toISOString(),
    }));
  }

  if (periyot === "bu_donem") {
    // 3 dilim: bu çeyreğin 3 ayı (TR)
    const ceyrekBas = ceyrekBaslangici(simdi);
    const ceyrekBasAy = (aktifDonem(simdi).ceyrek - 1) * 3; // 0, 3, 6, 9 → etiket için
    return [0, 1, 2].map((i) => ({
      etiket: AY_KISALTMALARI[ceyrekBasAy + i],
      baslangic: ayKaydir(ceyrekBas, i).toISOString(),
      bitis: ayKaydir(ceyrekBas, i + 1).toISOString(),
    }));
  }

  if (periyot === "bu_yil") {
    // 12 dilim: Oca-Ara (TR)
    const yilBas = yilBaslangici(simdi);
    return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => ({
      etiket: AY_KISALTMALARI[i],
      baslangic: ayKaydir(yilBas, i).toISOString(),
      bitis: ayKaydir(yilBas, i + 1).toISOString(),
    }));
  }

  return [];
}