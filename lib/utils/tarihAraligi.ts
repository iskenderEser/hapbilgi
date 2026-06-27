// lib/utils/tarihAraligi.ts
//
// Periyot string'ini ISO tarih aralığına çevirir.
// Hafta/ay/yıl başlangıçları lib/zaman/kontrol.ts'ten import edilir (tek kaynak).

import { haftaBaslangici, ayBaslangici, yilBaslangici } from "@/lib/zaman/kontrol";

export function tarihAraligi(zaman: string): { baslangic: string; bitis: string } {
  const simdi = new Date();
  const bitis = simdi.toISOString();

  if (zaman === 'bu_hafta') {
    return { baslangic: haftaBaslangici(simdi).toISOString(), bitis };
  }
  if (zaman === 'bu_ay') {
    return { baslangic: ayBaslangici(simdi).toISOString(), bitis };
  }
  if (zaman === 'bu_donem') {
    const ay = simdi.getMonth();
    const ceyrekBaslangicAy = Math.floor(ay / 3) * 3;
    const baslangic = new Date(simdi.getFullYear(), ceyrekBaslangicAy, 1);
    return { baslangic: baslangic.toISOString(), bitis };
  }
  if (zaman === 'bu_yil') {
    return { baslangic: yilBaslangici(simdi).toISOString(), bitis };
  }
  // bu_gun (default)
  const bugun = new Date(simdi);
  bugun.setHours(0, 0, 0, 0);
  return { baslangic: bugun.toISOString(), bitis };
}