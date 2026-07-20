// lib/soru/taslak.ts
//
// Yapısal soru girişinin saf çekirdeği (Y-1 —
// docs/soru_seti_is_sureci_iyilestirme_ve_gelistirme_is_plani_iki_kol.md).
// "Taslak", formdaki doldurulmakta olan soru kartıdır; eksik alanlara izin verir.
// Kayıt sözleşmesine (Soru: soru_metni/secenekler) çevrim yalnız doğrulamadan
// geçtikten sonra yapılır — alt akış (kayıt, hazır modül, yayın, izleme) değişmez.

import type { Soru } from "./parse";

export interface SoruTaslagi {
  soru_metni: string;
  secenek_a: string;
  secenek_b: string;
  dogru: "A" | "B" | null;
}

export const bosSoruTaslagi = (): SoruTaslagi => ({
  soru_metni: "",
  secenek_a: "",
  secenek_b: "",
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
    if (!t.secenek_a.trim()) return `${sira}. sorunun A seçeneği boş.`;
    if (!t.secenek_b.trim()) return `${sira}. sorunun B seçeneği boş.`;
    if (t.dogru !== "A" && t.dogru !== "B") return `${sira}. soruda doğru cevap işaretlenmemiş.`;
  }
  return null;
}

/** Doğrulamadan geçmiş taslakları kayıt sözleşmesine çevirir. */
export function taslaklardanSorular(taslaklar: SoruTaslagi[]): Soru[] {
  return taslaklar.map(t => ({
    soru_metni: t.soru_metni.trim(),
    secenekler: [
      { harf: "A", metin: t.secenek_a.trim(), dogru: t.dogru === "A" },
      { harf: "B", metin: t.secenek_b.trim(), dogru: t.dogru === "B" },
    ],
  }));
}

/** Kayıtlı soruları form kartlarına yükler (revizyon / toplu doldurma sonrası). */
export function sorulardanTaslaklar(sorular: Soru[]): SoruTaslagi[] {
  return sorular.map(s => {
    const a = s.secenekler.find(se => se.harf === "A");
    const b = s.secenekler.find(se => se.harf === "B");
    return {
      soru_metni: s.soru_metni,
      secenek_a: a?.metin ?? "",
      secenek_b: b?.metin ?? "",
      dogru: a?.dogru ? "A" : b?.dogru ? "B" : null,
    };
  });
}

/** Taslak listesini hedef sayıya getirir: eksikse boş kart ekler, fazlaysa BOŞ kartları sondan atar
 * (dolu kart varken sayı fazlaysa dokunmaz — fazlalığı doğrulama mesajı gösterir, veri sessizce silinmez). */
export function taslaklariBoyutla(taslaklar: SoruTaslagi[], buyukluk: number): SoruTaslagi[] {
  const sonuc = [...taslaklar];
  while (sonuc.length < buyukluk) sonuc.push(bosSoruTaslagi());
  while (sonuc.length > buyukluk) {
    const son = sonuc[sonuc.length - 1];
    const bos = !son.soru_metni.trim() && !son.secenek_a.trim() && !son.secenek_b.trim() && son.dogru === null;
    if (!bos) break;
    sonuc.pop();
  }
  return sonuc;
}
