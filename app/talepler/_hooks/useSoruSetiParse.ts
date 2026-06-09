// app/talepler/_hooks/useSoruSetiParse.ts
//
// Hazır soru seti parse state'ini ve önizleme akışını yönetir.
// parseSoruSeti saf fonksiyon olarak ayrıca export edilir (test + yeniden kullanım için).

import { useCallback, useState } from "react";
import type { Soru } from "../_types";

// ============================================================================
// Saf parse fonksiyonu
// ============================================================================

export const parseSoruSeti = (metin: string, maxSoru: number): { sorular: Soru[]; hata: string } => {
  const bloklar = metin.split(/\n\s*\n/).filter(b => b.trim());
  const sorular: Soru[] = [];

  for (const blok of bloklar) {
    const lines = blok.split("\n").map(l => l.trim()).filter(l => l);
    if (lines.length < 4) continue;

    const soruLine = lines.find(l => /^\d+[\.\)]/.test(l));
    if (!soruLine) return { sorular: [], hata: "Soru metni bulunamadı." };

    const soruMetni = soruLine.replace(/^\d+[\.\)]\s*/, "");

    const aLine = lines.find(l => /^A[\)\.]/i.test(l));
    const bLine = lines.find(l => /^B[\)\.]/i.test(l));
    if (!aLine || !bLine) return { sorular: [], hata: "A ve B seçenekleri bulunamadı." };

    const secenekA = aLine.replace(/^A[\)\.]\s*/i, "");
    const secenekB = bLine.replace(/^B[\)\.]\s*/i, "");

    const dogruLine = lines.find(l => /^Doğru:/i.test(l));
    if (!dogruLine) return { sorular: [], hata: "Doğru cevap satırı bulunamadı." };

    const dogruHarf = dogruLine.match(/[AB]/i)?.[0]?.toUpperCase();
    if (dogruHarf !== "A" && dogruHarf !== "B") return { sorular: [], hata: "Doğru cevap A veya B olmalıdır." };

    sorular.push({
      soru_metni: soruMetni,
      secenekler: [
        { harf: "A", metin: secenekA, dogru: dogruHarf === "A" },
        { harf: "B", metin: secenekB, dogru: dogruHarf === "B" },
      ],
    });
  }

  if (sorular.length !== maxSoru) {
    return { sorular: [], hata: `Soru sayısı ${maxSoru} olmalıdır. Şu an: ${sorular.length}` };
  }

  return { sorular, hata: "" };
};

// ============================================================================
// Hook
// ============================================================================

export interface UseSoruSetiParseReturn {
  metin: string;
  setMetin: (m: string) => void;
  onizleme: Soru[];
  hata: string;
  onOnizle: (buyukluk: number) => void;
  reset: () => void;
}

export function useSoruSetiParse(): UseSoruSetiParseReturn {
  const [metin, setMetinInternal] = useState("");
  const [onizleme, setOnizleme] = useState<Soru[]>([]);
  const [hata, setHata] = useState("");

  // Metin değişince önizleme ve hata otomatik temizlenir.
  // (page.tsx'teki textarea onChange davranışını içeride taşır.)
  const setMetin = useCallback((m: string) => {
    setMetinInternal(m);
    setOnizleme([]);
    setHata("");
  }, []);

  const onOnizle = useCallback((buyukluk: number) => {
    setHata("");
    setOnizleme([]);
    const result = parseSoruSeti(metin, buyukluk);
    if (result.hata) {
      setHata(result.hata);
      return;
    }
    setOnizleme(result.sorular);
  }, [metin]);

  // hazirSoruSeti toggle off veya form submit sonrası temizlik için.
  const reset = useCallback(() => {
    setMetinInternal("");
    setOnizleme([]);
    setHata("");
  }, []);

  return { metin, setMetin, onizleme, hata, onOnizle, reset };
}