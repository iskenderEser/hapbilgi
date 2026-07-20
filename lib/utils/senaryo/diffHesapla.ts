// lib/utils/senaryo/diffHesapla.ts
//
// Senaryo tek metin + fark gösterimi (G-1 —
// docs/senaryo_tek_metin_diff_gelistirme_is_plani.md). PM'in en son gördüğü
// metin ile IU'nun yeni gönderdiği metin arasındaki kelime bazlı farkı saf
// olarak hesaplar. Yan etki yok — smoke testi bunu hedefler.
//
// Çıkarılan/değiştirilen kısım SİLİNMEZ (kategori "cikar" — ekranda üstü
// çizili gösterilir), eklenen kısım "ekle" (kırmızı vurgu), değişmeyen "ayni".

import { diffWords } from "diff";

export type SenaryoDiffTuru = "ayni" | "ekle" | "cikar";

export interface SenaryoDiffParcasi {
  tur: SenaryoDiffTuru;
  metin: string;
}

/** onceki boşsa (ilk gönderim, karşılaştıracak bir şey yok) tüm metin "ayni" döner. */
export function senaryoDiffHesapla(onceki: string, guncel: string): SenaryoDiffParcasi[] {
  if (!onceki.trim()) return guncel ? [{ tur: "ayni", metin: guncel }] : [];

  return diffWords(onceki, guncel).map(parca => ({
    tur: parca.added ? "ekle" : parca.removed ? "cikar" : "ayni",
    metin: parca.value,
  }));
}
