// app/talepler/_hooks/useSoruSetiParse.ts
//
// Hazır soru seti parse state'ini ve önizleme akışını yönetir.
// Parse'ın kendisi lib/soru/parse.ts'tedir (D-1: tek doğruluk kaynağı,
// toleranslı satır-temelli mantık) — buradan yalnız yeniden export edilir.

import { useCallback, useState } from "react";
import type { Soru } from "../_types";
import { parseSoruSeti } from "@/lib/soru/parse";

export { parseSoruSeti };

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