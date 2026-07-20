// lib/soru/parse.ts
//
// Soru seti metin parse'ının TEK doğruluk kaynağı (D-1 —
// docs/soru_seti_is_sureci_iyilestirme_ve_gelistirme_is_plani_iki_kol.md).
// İki ekran da bunu kullanır: üretici talep formu (hazır soru seti) ve IU
// soru seti yazım ekranı. Önceden iki ayrı kopya vardı ve boş satır temelli
// blok ayrımı, soru İÇİNDEKİ boş satırda kırılıyordu (yaşanan olay, 19.07).
//
// Toleranslı satır-temelli mantık:
//   - Boş satırlar TÜMÜYLE anlamsızdır (soru içinde de arada da serbest).
//   - Numaralı satır ("1." / "1)") yeni soruyu başlatır; numarasız düz satır da
//     (önceki soru tamamlandıysa ya da ilk soruysa) yeni soru sayılır — Word
//     otomatik listesi numarayı düşürse bile çalışır.
//   - "Doğru:" ve "Dogru:" (ğ'siz) ikisi de kabul edilir.
//   - Uzun metinlerin alt satıra taşması desteklenir: sınıflandırılamayan satır,
//     son görülen öğeye (soru metni / A / B) eklenir.
//   - Format şartı DEĞİŞMEZ: her soru = soru metni + tam 2 seçenek (A/B) + doğru şık.
//   - Hata mesajları konumludur (D-2): kullanıcıyı kaçıncı soruda ne eksik
//     olduğuna götürür.
//
// Çıktı sözleşmesi eski parse ile birebir aynı (soru_metni / secenekler[harf,
// metin, dogru]) — alt akış (kayıt, hazır modül, izleme uçları) etkilenmez.

import type { SoruTaslagi } from "./taslak";

export interface Soru {
  soru_metni: string;
  secenekler: { harf: string; metin: string; dogru: boolean }[];
}

const NUMARA = /^\d+[\.\)]\s*/;
const SECENEK_A = /^A[\)\.]\s*/i;
const SECENEK_B = /^B[\)\.]\s*/i;
const DOGRU = /^do[gğ]ru\s*:\s*/i;

interface TaslakSoru {
  soru_metni: string;
  a: string | null;
  b: string | null;
  dogru: "A" | "B" | null;
}

export const parseSoruSeti = (metin: string, maxSoru: number): { sorular: Soru[]; hata: string } => {
  const satirlar = metin
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0); // boş satırlar burada elenir — hiçbir anlamı yoktur

  const taslaklar: TaslakSoru[] = [];
  let aktif: TaslakSoru | null = null;
  // Uzun metin taşması hangi öğeye eklenecek: en son yazılan öğe.
  let sonOge: "soru" | "a" | "b" | null = null;

  const hataYap = (mesaj: string) => ({ sorular: [] as Soru[], hata: mesaj });

  const tamamlandi = (t: TaslakSoru | null): boolean =>
    !!t && t.a !== null && t.b !== null && t.dogru !== null;

  // Kapanan sorunun eksiğini konumlu mesajla söyler; eksiksizse null döner.
  const eksikKontrol = (t: TaslakSoru, sira: number): string | null => {
    if (t.a === null) return `${sira}. soruda A seçeneği bulunamadı.`;
    if (t.b === null) return `${sira}. soruda B seçeneği bulunamadı.`;
    if (t.dogru === null) return `${sira}. soruda doğru cevap satırı ("Doğru: A") bulunamadı.`;
    return null;
  };

  // Açık soruyu (varsa) eksik kontrolünden geçirip listeye iter; aktif'e ATAMAZ —
  // atamalar döngü gövdesinde kalır (TS akış analizi kapanış-içi atamayı izleyemez).
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
      aktif = { soru_metni: satir.replace(NUMARA, ""), a: null, b: null, dogru: null };
      sonOge = "soru";
      continue;
    }

    if (SECENEK_A.test(satir)) {
      if (!aktif) return hataYap("1. sorunun A seçeneği, soru metninden önce geldi — önce soru metnini yazın.");
      if (aktif.a !== null) return hataYap(`${siraNo}. soruda birden fazla A seçeneği var.`);
      aktif.a = satir.replace(SECENEK_A, "");
      sonOge = "a";
      continue;
    }

    if (SECENEK_B.test(satir)) {
      if (!aktif) return hataYap("1. sorunun B seçeneği, soru metninden önce geldi — önce soru metnini yazın.");
      if (aktif.b !== null) return hataYap(`${siraNo}. soruda birden fazla B seçeneği var.`);
      aktif.b = satir.replace(SECENEK_B, "");
      sonOge = "b";
      continue;
    }

    if (DOGRU.test(satir)) {
      if (!aktif) return hataYap('1. sorunun "Doğru:" satırı, soru metninden önce geldi — önce soru metnini yazın.');
      const harf = satir.replace(DOGRU, "").match(/[AB]/i)?.[0]?.toUpperCase();
      if (harf !== "A" && harf !== "B") return hataYap(`${siraNo}. soruda doğru cevap A veya B olmalıdır.`);
      aktif.dogru = harf;
      sonOge = null;
      continue;
    }

    // Sınıflandırılamayan düz satır: önceki soru tamamlandıysa (ya da hiç soru
    // yoksa) numarasız yeni sorudur; değilse son öğenin devam satırıdır.
    if (!aktif || tamamlandi(aktif)) {
      const hata = oncekiniKapat();
      if (hata) return hataYap(hata);
      aktif = { soru_metni: satir, a: null, b: null, dogru: null };
      sonOge = "soru";
    } else {
      const t: TaslakSoru = aktif;
      if (sonOge === "a" && t.a !== null) t.a = `${t.a} ${satir}`;
      else if (sonOge === "b" && t.b !== null) t.b = `${t.b} ${satir}`;
      else t.soru_metni = `${t.soru_metni} ${satir}`.trim();
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
    secenekler: [
      { harf: "A", metin: t.a as string, dogru: t.dogru === "A" },
      { harf: "B", metin: t.b as string, dogru: t.dogru === "B" },
    ],
  }));

  return { sorular, hata: "" };
};

// ============================================================================
// Esnek parse (Y-2) — form ön doldurucu: ASLA reddetmez.
// Sert parse kabul kapısıdır; bu ise yapıştırılan/dosyadan gelen metni form
// kartlarına döker — çözülemeyen alanlar boş kalır, kullanıcı formda tamamlar.
// ============================================================================

export const parseSoruSetiEsnek = (metin: string): { taslaklar: SoruTaslagi[]; uyari: string } => {
  const satirlar = metin
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const taslaklar: SoruTaslagi[] = [];
  let aktif: SoruTaslagi | null = null;
  let sonOge: "soru" | "a" | "b" | null = null;

  const tamam = (t: SoruTaslagi) => t.secenek_a !== "" && t.secenek_b !== "" && t.dogru !== null;

  for (const satir of satirlar) {
    if (NUMARA.test(satir)) {
      if (aktif) taslaklar.push(aktif);
      aktif = { soru_metni: satir.replace(NUMARA, ""), secenek_a: "", secenek_b: "", dogru: null };
      sonOge = "soru";
      continue;
    }
    if (SECENEK_A.test(satir)) {
      if (!aktif) aktif = { soru_metni: "", secenek_a: "", secenek_b: "", dogru: null };
      const metinA = satir.replace(SECENEK_A, "");
      aktif.secenek_a = aktif.secenek_a ? `${aktif.secenek_a} ${metinA}` : metinA;
      sonOge = "a";
      continue;
    }
    if (SECENEK_B.test(satir)) {
      if (!aktif) aktif = { soru_metni: "", secenek_a: "", secenek_b: "", dogru: null };
      const metinB = satir.replace(SECENEK_B, "");
      aktif.secenek_b = aktif.secenek_b ? `${aktif.secenek_b} ${metinB}` : metinB;
      sonOge = "b";
      continue;
    }
    if (DOGRU.test(satir)) {
      if (!aktif) aktif = { soru_metni: "", secenek_a: "", secenek_b: "", dogru: null };
      const harf = satir.replace(DOGRU, "").match(/[AB]/i)?.[0]?.toUpperCase();
      aktif.dogru = harf === "A" || harf === "B" ? harf : null; // çözülemeyen işaret boş kalır — formda seçilir
      sonOge = null;
      continue;
    }
    if (!aktif || tamam(aktif)) {
      if (aktif) taslaklar.push(aktif);
      aktif = { soru_metni: satir, secenek_a: "", secenek_b: "", dogru: null };
      sonOge = "soru";
    } else if (sonOge === "a") {
      aktif.secenek_a = `${aktif.secenek_a} ${satir}`;
    } else if (sonOge === "b") {
      aktif.secenek_b = `${aktif.secenek_b} ${satir}`;
    } else {
      aktif.soru_metni = `${aktif.soru_metni} ${satir}`.trim();
    }
  }
  if (aktif) taslaklar.push(aktif);

  if (taslaklar.length === 0) {
    return { taslaklar, uyari: "Metinde soru bulunamadı — formu elle doldurabilirsiniz." };
  }
  const eksikler = taslaklar
    .map((t, i) => (!t.soru_metni || !t.secenek_a || !t.secenek_b || t.dogru === null ? i + 1 : null))
    .filter((n): n is number => n !== null);
  const uyari = eksikler.length > 0
    ? `${eksikler.join(", ")}. soru(lar)da eksik alan var — formda tamamlayın.`
    : "";
  return { taslaklar, uyari };
};
