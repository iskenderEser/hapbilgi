// lib/soru/parse.ts
//
// Soru seti metin parse'ının TEK doğruluk kaynağı (D-1 —
// docs/soru_seti_is_sureci_iyilestirme_ve_gelistirme_is_plani_iki_kol.md).
// İki ekran da bunu kullanır: üretici talep formu (hazır soru seti) ve IU
// soru seti yazım ekranı.
//
// Toleranslı satır-temelli mantık:
//   - Boş satırlar TÜMÜYLE anlamsızdır (soru içinde de arada da serbest).
//   - Numaralı satır ("1." / "1)") yeni soruyu başlatır; numarasız düz satır da
//     (önceki soru tamamlandıysa ya da ilk soruysa) yeni soru sayılır.
//   - "Doğru:" ve "Dogru:" (ğ'siz) ikisi de kabul edilir.
//   - Uzun metinlerin alt satıra taşması desteklenir: sınıflandırılamayan satır,
//     son görülen öğeye (soru metni / seçenek) eklenir.
//   - Seçenek sayısı PARAMETRİK (24.07): her soru = soru metni + tam
//     `secenekSayisi` seçenek (A, B, C, D…) + doğru şık. Harf secenekSayisi'ni
//     aşarsa (ör. 2 seçenekli sette "C)") o satır seçenek sayılmaz.
//   - Hata mesajları konumludur (D-2).
//
// Çıktı sözleşmesi aynı (soru_metni / secenekler[harf, metin, dogru]).

import type { SoruTaslagi } from "./taslak";
import { harfBul } from "./taslak";

export interface Soru {
  soru_metni: string;
  secenekler: { harf: string; metin: string; dogru: boolean }[];
}

const NUMARA = /^\d+[\.\)]\s*/;
const SECENEK = /^([A-E])[\)\.]\s*/i; // harfi yakalar
const DOGRU = /^do[gğ]ru\s*:\s*/i;

const harfIdx = (h: string): number => h.toUpperCase().charCodeAt(0) - 65; // A→0

export const parseSoruSeti = (metin: string, maxSoru: number, secenekSayisi: number): { sorular: Soru[]; hata: string } => {
  const satirlar = metin
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  interface TaslakSoru {
    soru_metni: string;
    secenekler: (string | null)[]; // uzunluk secenekSayisi
    dogru: number | null; // indeks
  }
  const yeni = (soru_metni: string): TaslakSoru => ({
    soru_metni,
    secenekler: Array.from({ length: secenekSayisi }, () => null),
    dogru: null,
  });

  const taslaklar: TaslakSoru[] = [];
  let aktif: TaslakSoru | null = null;
  let sonOge: "soru" | number | null = null; // number = seçenek indeksi

  const hataYap = (mesaj: string) => ({ sorular: [] as Soru[], hata: mesaj });

  const tamamlandi = (t: TaslakSoru | null): boolean =>
    !!t && t.secenekler.every(s => s !== null) && t.dogru !== null;

  const eksikKontrol = (t: TaslakSoru, sira: number): string | null => {
    for (let i = 0; i < secenekSayisi; i++) {
      if (t.secenekler[i] === null) return `${sira}. soruda ${harfBul(i)} seçeneği bulunamadı.`;
    }
    if (t.dogru === null) return `${sira}. soruda doğru cevap satırı ("Doğru: A") bulunamadı.`;
    return null;
  };

  const oncekiniKapat = (): string | null => {
    if (!aktif) return null;
    const eksik = eksikKontrol(aktif, taslaklar.length + 1);
    if (eksik) return eksik;
    taslaklar.push(aktif);
    return null;
  };

  for (const satir of satirlar) {
    const siraNo = taslaklar.length + (aktif ? 1 : 0) || 1;

    if (NUMARA.test(satir)) {
      const hata = oncekiniKapat();
      if (hata) return hataYap(hata);
      aktif = yeni(satir.replace(NUMARA, ""));
      sonOge = "soru";
      continue;
    }

    const sm = satir.match(SECENEK);
    if (sm && harfIdx(sm[1]) < secenekSayisi) {
      const idx = harfIdx(sm[1]);
      if (!aktif) return hataYap(`1. sorunun ${harfBul(idx)} seçeneği, soru metninden önce geldi — önce soru metnini yazın.`);
      if (aktif.secenekler[idx] !== null) return hataYap(`${siraNo}. soruda birden fazla ${harfBul(idx)} seçeneği var.`);
      aktif.secenekler[idx] = satir.replace(SECENEK, "");
      sonOge = idx;
      continue;
    }

    // Sınır dışı şık işareti — taşma DEĞİL, uyuşmazlıktır.
    // "C)" satırı 2 seçenekli sette şık sayılmaz; aşağıdaki taşma kuralına
    // düşerse sessizce bir önceki şıkkın metnine yapışır (fazla şık kaybolur,
    // kimse uyarılmaz). Bu yüzden burada durdurulur.
    if (sm) {
      return hataYap(`Her soruya sadece ${secenekSayisi} seçenek yazabilirsiniz. ${siraNo}. soruda ${sm[1].toUpperCase()} seçeneği var.`);
    }

    if (DOGRU.test(satir)) {
      if (!aktif) return hataYap('1. sorunun "Doğru:" satırı, soru metninden önce geldi — önce soru metnini yazın.');
      const harf = satir.replace(DOGRU, "").match(/[A-E]/i)?.[0];
      const idx = harf ? harfIdx(harf) : -1;
      if (idx < 0 || idx >= secenekSayisi) return hataYap(`${siraNo}. soruda doğru cevap A–${harfBul(secenekSayisi - 1)} arasında olmalıdır.`);
      aktif.dogru = idx;
      sonOge = null;
      continue;
    }

    // Sınıflandırılamayan düz satır.
    if (!aktif || tamamlandi(aktif)) {
      const hata = oncekiniKapat();
      if (hata) return hataYap(hata);
      aktif = yeni(satir);
      sonOge = "soru";
    } else {
      const t: TaslakSoru = aktif;
      if (typeof sonOge === "number" && t.secenekler[sonOge] !== null) {
        t.secenekler[sonOge] = `${t.secenekler[sonOge]} ${satir}`;
      } else {
        t.soru_metni = `${t.soru_metni} ${satir}`.trim();
      }
    }
  }

  if (aktif) {
    const eksik = eksikKontrol(aktif, taslaklar.length + 1);
    if (eksik) return hataYap(eksik);
    taslaklar.push(aktif);
  }

  if (taslaklar.length !== maxSoru) {
    return hataYap(`Soru sayısı ${maxSoru} olmalıdır. Şu an: ${taslaklar.length}`);
  }

  const sorular: Soru[] = taslaklar.map(t => ({
    soru_metni: t.soru_metni,
    secenekler: t.secenekler.map((metin, idx) => ({ harf: harfBul(idx), metin: metin as string, dogru: t.dogru === idx })),
  }));

  return { sorular, hata: "" };
};

// ============================================================================
// Esnek parse (Y-2) — form ön doldurucu: ASLA reddetmez.
// ============================================================================

export const parseSoruSetiEsnek = (metin: string, secenekSayisi: number): { taslaklar: SoruTaslagi[]; uyari: string } => {
  const satirlar = metin
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const yeni = (soru_metni: string): SoruTaslagi => ({
    soru_metni,
    secenekler: Array.from({ length: secenekSayisi }, () => ""),
    dogru: null,
  });

  const taslaklar: SoruTaslagi[] = [];
  let aktif: SoruTaslagi | null = null;
  let sonOge: "soru" | number | null = null;
  const sinirDisiSiralar = new Set<number>(); // seçenek sayısını aşan şık görülen soru sıraları

  const tamam = (t: SoruTaslagi) => t.secenekler.every(s => s !== "") && t.dogru !== null;

  for (const satir of satirlar) {
    if (NUMARA.test(satir)) {
      if (aktif) taslaklar.push(aktif);
      aktif = yeni(satir.replace(NUMARA, ""));
      sonOge = "soru";
      continue;
    }
    const sm = satir.match(SECENEK);
    if (sm && harfIdx(sm[1]) < secenekSayisi) {
      if (!aktif) aktif = yeni("");
      const idx = harfIdx(sm[1]);
      const m = satir.replace(SECENEK, "");
      aktif.secenekler[idx] = aktif.secenekler[idx] ? `${aktif.secenekler[idx]} ${m}` : m;
      sonOge = idx;
      continue;
    }
    // Sınır dışı şık işareti — bu kol reddetmez, ama satırı bir öncekine
    // yapıştırmaz da: forma alınmaz, sıra numarası uyarıda bildirilir.
    if (sm) {
      sinirDisiSiralar.add(taslaklar.length + (aktif ? 1 : 0) || 1);
      continue;
    }
    if (DOGRU.test(satir)) {
      if (!aktif) aktif = yeni("");
      const harf = satir.replace(DOGRU, "").match(/[A-E]/i)?.[0];
      const idx = harf ? harfIdx(harf) : -1;
      aktif.dogru = idx >= 0 && idx < secenekSayisi ? idx : null; // çözülemeyen işaret boş kalır — formda seçilir
      sonOge = null;
      continue;
    }
    if (!aktif || tamam(aktif)) {
      if (aktif) taslaklar.push(aktif);
      aktif = yeni(satir);
      sonOge = "soru";
    } else if (typeof sonOge === "number") {
      aktif.secenekler[sonOge] = `${aktif.secenekler[sonOge]} ${satir}`.trim();
    } else {
      aktif.soru_metni = `${aktif.soru_metni} ${satir}`.trim();
    }
  }
  if (aktif) taslaklar.push(aktif);

  if (taslaklar.length === 0) {
    return { taslaklar, uyari: "Metinde soru bulunamadı — formu elle doldurabilirsiniz." };
  }
  const eksikler = taslaklar
    .map((t, i) => (!t.soru_metni || t.secenekler.some(s => !s) || t.dogru === null ? i + 1 : null))
    .filter((n): n is number => n !== null);

  const uyarilar: string[] = [];
  if (sinirDisiSiralar.size > 0) {
    const siralar = [...sinirDisiSiralar].sort((a, b) => a - b).join(", ");
    uyarilar.push(`Her soruya sadece ${secenekSayisi} seçenek yazabilirsiniz. ${siralar}. soru(lar)daki fazla şık forma alınmadı.`);
  }
  if (eksikler.length > 0) {
    uyarilar.push(`${eksikler.join(", ")}. soru(lar)da eksik alan var — formda tamamlayın.`);
  }
  return { taslaklar, uyari: uyarilar.join(" ") };
};
