// lib/hapbi/rehber/rehberCozucu.ts
//
// Kullanıcı sorusunu rehber kataloğundaki anahtar kavramlarla eşleştiren hızlı deterministik çözücü.

import { REHBER_KATALOGU, type RehberKonu } from "./rehberKatalogu";

function metniNormalizeEt(metin: string): string {
  return metin
    .normalize("NFKC")
    .toLocaleLowerCase("tr-TR")
    .replaceAll("ç", "c")
    .replaceAll("ğ", "g")
    .replaceAll("ı", "i")
    .replaceAll("ö", "o")
    .replaceAll("ş", "s")
    .replaceAll("ü", "u")
    .replace(/[^a-z0-9\s]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

export type RehberCozumSonucu =
  | Readonly<{ basarili: true; konu: RehberKonu }>
  | Readonly<{ basarili: false }>;

export function hapbiRehberiniCoz(soru: string): RehberCozumSonucu {
  const normSoru = metniNormalizeEt(soru);
  if (!normSoru) return { basarili: false };

  // 1. Doğrudan tam veya alt metin eşleşmesi
  let enIyiKonu: RehberKonu | null = null;
  let enYuksekSkor = 0;

  for (const konu of REHBER_KATALOGU) {
    for (const anahtar of konu.anahtarKelimeler) {
      const normAnahtar = metniNormalizeEt(anahtar);
      if (normSoru.includes(normAnahtar)) {
        // Anahtar kelime ne kadar uzun ve spesifikse o kadar yüksek skor
        const skor = normAnahtar.length * 2;
        if (skor > enYuksekSkor) {
          enYuksekSkor = skor;
          enIyiKonu = konu;
        }
      }
    }
  }

  if (enIyiKonu && enYuksekSkor > 0) {
    return { basarili: true, konu: enIyiKonu };
  }

  // 2. Genel "nedir / nerede" kalıbı kontrolü
  const soruKelimeleri = normSoru.split(" ");
  const rehberSorusuMu = soruKelimeleri.some((k) =>
    ["nedir", "nerede", "nerde", "nereden", "nasil", "neye"].includes(k)
  );

  if (rehberSorusuMu) {
    for (const konu of REHBER_KATALOGU) {
      for (const anahtar of konu.anahtarKelimeler) {
        const anahtarKelimeleri = metniNormalizeEt(anahtar).split(" ");
        const ortakKelimeSayisi = anahtarKelimeleri.filter((ak) =>
          soruKelimeleri.includes(ak)
        ).length;

        if (ortakKelimeSayisi > 0 && ortakKelimeSayisi * 3 > enYuksekSkor) {
          enYuksekSkor = ortakKelimeSayisi * 3;
          enIyiKonu = konu;
        }
      }
    }
  }

  if (enIyiKonu && enYuksekSkor >= 3) {
    return { basarili: true, konu: enIyiKonu };
  }

  return { basarili: false };
}
