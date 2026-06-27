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

export type Dilim = {
  etiket: string;
  baslangic: string; // ISO
  bitis: string;     // ISO
};

const AY_KISALTMALARI = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const GUN_KISALTMALARI = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

export function periyotAltKirilim(periyot: Periyot): Dilim[] {
  const simdi = new Date();

  if (periyot === "bu_gun") {
    // 4 dilim: 6 saatlik aralıklar (0-6, 6-12, 12-18, 18-24)
    const gunBas = new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate());
    return [0, 1, 2, 3].map((i) => {
      const bas = new Date(gunBas);
      bas.setHours(i * 6);
      const bit = new Date(gunBas);
      bit.setHours((i + 1) * 6);
      return {
        etiket: String((i + 1) * 6),
        baslangic: bas.toISOString(),
        bitis: bit.toISOString(),
      };
    });
  }

  if (periyot === "bu_hafta") {
    // 7 dilim: Pzt-Paz
    const gun = simdi.getDay();
    const pazartesiOffset = gun === 0 ? 6 : gun - 1;
    const pazartesi = new Date(simdi);
    pazartesi.setDate(simdi.getDate() - pazartesiOffset);
    pazartesi.setHours(0, 0, 0, 0);

    return [0, 1, 2, 3, 4, 5, 6].map((i) => {
      const bas = new Date(pazartesi);
      bas.setDate(pazartesi.getDate() + i);
      const bit = new Date(bas);
      bit.setDate(bas.getDate() + 1);
      return {
        etiket: GUN_KISALTMALARI[i],
        baslangic: bas.toISOString(),
        bitis: bit.toISOString(),
      };
    });
  }

  if (periyot === "bu_ay") {
    // 4 dilim: ay başından bugüne 4 eşit hafta benzeri parça
    // Sade tutmak için: ay başı + her hafta 7 gün, son dilim ay sonuna kadar
    const ayBas = new Date(simdi.getFullYear(), simdi.getMonth(), 1);
    const ayBitis = new Date(simdi.getFullYear(), simdi.getMonth() + 1, 1);
    const toplamGun = Math.round((ayBitis.getTime() - ayBas.getTime()) / (1000 * 60 * 60 * 24));
    const dilimGun = Math.ceil(toplamGun / 4);

    return [0, 1, 2, 3].map((i) => {
      const bas = new Date(ayBas);
      bas.setDate(ayBas.getDate() + i * dilimGun);
      const bit = new Date(ayBas);
      bit.setDate(ayBas.getDate() + (i + 1) * dilimGun);
      if (i === 3) bit.setTime(ayBitis.getTime()); // son dilim ay sonuna kadar
      return {
        etiket: String(i + 1),
        baslangic: bas.toISOString(),
        bitis: bit.toISOString(),
      };
    });
  }

  if (periyot === "bu_donem") {
    // 3 dilim: bu çeyreğin 3 ayı
    const ay = simdi.getMonth();
    const ceyrekBasAy = Math.floor(ay / 3) * 3;
    return [0, 1, 2].map((i) => {
      const bas = new Date(simdi.getFullYear(), ceyrekBasAy + i, 1);
      const bit = new Date(simdi.getFullYear(), ceyrekBasAy + i + 1, 1);
      return {
        etiket: AY_KISALTMALARI[ceyrekBasAy + i],
        baslangic: bas.toISOString(),
        bitis: bit.toISOString(),
      };
    });
  }

  if (periyot === "bu_yil") {
    // 12 dilim: Oca-Ara
    return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => {
      const bas = new Date(simdi.getFullYear(), i, 1);
      const bit = new Date(simdi.getFullYear(), i + 1, 1);
      return {
        etiket: AY_KISALTMALARI[i],
        baslangic: bas.toISOString(),
        bitis: bit.toISOString(),
      };
    });
  }

  return [];
}