// lib/utils/tarihAraligi.ts
//
// Periyot string'ini ISO tarih aralığına çevirir.
// Hafta/ay/yıl başlangıçları lib/zaman/kontrol.ts'ten import edilir (tek kaynak).

import { gunBaslangici, haftaBaslangici, ayBaslangici, ceyrekBaslangici, yilBaslangici } from "@/lib/zaman/kontrol";

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
    return { baslangic: ceyrekBaslangici(simdi).toISOString(), bitis };
  }
  if (zaman === 'bu_yil') {
    return { baslangic: yilBaslangici(simdi).toISOString(), bitis };
  }
  // bu_gun (default)
  return { baslangic: gunBaslangici(simdi).toISOString(), bitis };
}