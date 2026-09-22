// components/hbligi/league/kursuYerlesimi.ts
// Kürsü için deterministik yerleşim sağlayıcı.
// Eşit puan ve sıralamaya sahip kullanıcılar olduğunda aynı kişinin birden fazla
// basamakta görünmesini engeller; her basamağa benzersiz bir yarışmacı yerleştirir.

import type { SiraliSatir } from "./types";

export interface KursuYerlesimiSonuc {
  lider: SiraliSatir | null;
  ikinci: SiraliSatir | null;
  ucuncu: SiraliSatir | null;
}

/**
 * Verilen sıralı satırlardan kürsü için deterministik ve benzersiz ilk 3'ü çıkarır.
 *
 * Kurallar:
 * 1. Tekillik: Bir kullanici_id kürsüde en fazla bir basamakta yer alabilir.
 * 2. Eşit-Sıra Koruması: Kullanıcıların sahip olduğu eşit sıra (rank) ve puanlar değiştirilmez.
 * 3. Determinizm:
 *    - Öncelik 1: rank (artan)
 *    - Öncelik 2: toplam_puan (azalan)
 *    - Öncelik 3: ad (Türkçe alfabetik artan)
 * 4. Eksik Veri: Katılımcı sayısı 3'ten azsa, olmayan basamaklar null döner.
 */
export function kursuYerlesimi(satirlar?: SiraliSatir[] | null): KursuYerlesimiSonuc {
  if (!satirlar || satirlar.length === 0) {
    return { lider: null, ikinci: null, ucuncu: null };
  }

  // 1. Kullanıcı kimliğine göre tekilleştir (aynı kişi dizide iki kez gelse bile engelle)
  const gorulenIdler = new Set<string>();
  const tekilSatirlar: SiraliSatir[] = [];
  for (const satir of satirlar) {
    if (!satir || !satir.kullanici_id) continue;
    if (gorulenIdler.has(satir.kullanici_id)) continue;
    gorulenIdler.add(satir.kullanici_id);
    tekilSatirlar.push(satir);
  }

  // 2. Deterministik kürsü önceliğine göre sırala
  const sirali = [...tekilSatirlar].sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (b.toplam_puan !== a.toplam_puan) return b.toplam_puan - a.toplam_puan;
    return a.ad.localeCompare(b.ad, "tr");
  });

  return {
    lider: sirali[0] ?? null,
    ikinci: sirali[1] ?? null,
    ucuncu: sirali[2] ?? null,
  };
}
