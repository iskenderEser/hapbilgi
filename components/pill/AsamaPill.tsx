// components/pill/AsamaPill.tsx
//
// Üretim zincirindeki konum: Senaryo → Video → Soru Seti → Yayın.
//
// Renk NÖTR (İskender kararı 27.07, docs/pill_envanteri.md §E-5): aşama sıralı bir
// konum bilgisidir, uyarı değil. Önceden renkliydi ve durum pill'iyle çakışıyordu —
// #eff6ff hem "Video aşaması" hem "inceleme bekleniyor" demekti (bulgu P-4).
// Ayrıca aşama renk haritası iki dosyada kopyalanmıştı (P-5: UreticiAnaSayfa +
// IuAnaSayfa); nötre alınınca harita tümden ortadan kalktı.

"use client";

import { Pill, NOTR_RENK } from "./Pill";

/**
 * mesaj.ts'teki Asama tipi üç üretim aşamasıdır; liste satırı dördüncü olarak
 * üretimin bittiğini de gösterir. Dördüncüsü "Yayın" DEĞİL "Tamamlandı" —
 * durum sütunundaki metinlerin çoğu "yayın" kelimesini taşıdığı için yan yana
 * iki sütunda aynı kelime tekrarlanıyordu (İskender kararı 27.07).
 */
export type PillAsama = "Senaryo" | "Video" | "Soru Seti" | "Tamamlandı";

export function AsamaPill({ asama, className }: { asama: PillAsama; className?: string }) {
  return (
    <Pill renk={NOTR_RENK} className={className}>
      {asama}
    </Pill>
  );
}
