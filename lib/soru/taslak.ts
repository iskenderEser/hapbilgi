// lib/soru/taslak.ts
//
// Yapısal soru girişinin saf çekirdeği (Y-1 —
// docs/soru_seti_is_sureci_iyilestirme_ve_gelistirme_is_plani_iki_kol.md).
// "Taslak", formdaki doldurulmakta olan soru kartıdır; eksik alanlara izin verir.
// Kayıt sözleşmesine (Soru: soru_metni/secenekler) çevrim yalnız doğrulamadan
// geçtikten sonra yapılır — alt akış (kayıt, hazır modül, yayın, izleme) değişmez.
//
// SEÇENEK SAYISI PARAMETRİK (24.07): seçenekler sabit A/B değil, uzunluğu talebin
// secenek_sayisi'ne eşit bir dizidir. dogru = doğru seçeneğin indeksidir.

import type { Soru } from "./parse";

// Seçenek indeksi → harf. Kayıt sözleşmesi harf taşır (A, B, C, D, E...).
export const SECENEK_HARF = ["A", "B", "C", "D", "E"] as const;
export const harfBul = (idx: number): string => SECENEK_HARF[idx] ?? String.fromCharCode(65 + idx);

export interface SoruTaslagi {
  soru_metni: string;
  secenekler: string[]; // uzunluk = seçenek sayısı
  dogru: number | null; // doğru seçeneğin indeksi
}

export const bosSoruTaslagi = (secenekSayisi: number): SoruTaslagi => ({
  soru_metni: "",
  secenekler: Array.from({ length: secenekSayisi }, () => ""),
  dogru: null,
});

/** İlk eksikliği konumlu Türkçe mesajla döner; form eksiksizse null (saf — smoke bununla). */
export function taslaklariDogrula(taslaklar: SoruTaslagi[], buyukluk: number): string | null {
  if (taslaklar.length !== buyukluk) {
    return `Soru sayısı ${buyukluk} olmalıdır. Şu an: ${taslaklar.length}`;
  }
  for (let i = 0; i < taslaklar.length; i++) {
    const t = taslaklar[i];
    const sira = i + 1;
    if (!t.soru_metni.trim()) return `${sira}. sorunun soru metni boş.`;
    for (let j = 0; j < t.secenekler.length; j++) {
      if (!t.secenekler[j].trim()) return `${sira}. sorunun ${harfBul(j)} seçeneği boş.`;
    }
    if (t.dogru === null || t.dogru < 0 || t.dogru >= t.secenekler.length) {
      return `${sira}. soruda doğru cevap işaretlenmemiş.`;
    }
  }
  return null;
}

/** Doğrulamadan geçmiş taslakları kayıt sözleşmesine çevirir. */
export function taslaklardanSorular(taslaklar: SoruTaslagi[]): Soru[] {
  return taslaklar.map(t => ({
    soru_metni: t.soru_metni.trim(),
    secenekler: t.secenekler.map((metin, idx) => ({
      harf: harfBul(idx),
      metin: metin.trim(),
      dogru: t.dogru === idx,
    })),
  }));
}

/** Kayıtlı soruları form kartlarına yükler (revizyon / toplu doldurma sonrası).
 * Seçenek sayısı kayıtlı setin kendi seçenek sayısıdır. */
export function sorulardanTaslaklar(sorular: Soru[]): SoruTaslagi[] {
  return sorular.map(s => {
    const dogruIdx = s.secenekler.findIndex(se => se.dogru);
    return {
      soru_metni: s.soru_metni,
      secenekler: s.secenekler.map(se => se.metin),
      dogru: dogruIdx >= 0 ? dogruIdx : null,
    };
  });
}

/** Taslak listesini hedef sayıya getirir: eksikse boş kart ekler, fazlaysa BOŞ kartları sondan atar
 * (dolu kart varken sayı fazlaysa dokunmaz — fazlalığı doğrulama mesajı gösterir, veri sessizce silinmez). */
export function taslaklariBoyutla(taslaklar: SoruTaslagi[], buyukluk: number, secenekSayisi: number): SoruTaslagi[] {
  const sonuc = [...taslaklar];
  while (sonuc.length < buyukluk) sonuc.push(bosSoruTaslagi(secenekSayisi));
  while (sonuc.length > buyukluk) {
    const son = sonuc[sonuc.length - 1];
    const bos = !son.soru_metni.trim() && son.secenekler.every(s => !s.trim()) && son.dogru === null;
    if (!bos) break;
    sonuc.pop();
  }
  return sonuc;
}
