// components/pill/TeknikPill.tsx
//
// Künye satırında tekniğin adı. Teknik kayıtlı değilse ("-" ya da boş) hiç
// çizilmez — boş rozet bırakmaz.
//
// Taşındı (27.07): eski yeri components/TeknikPill.tsx. Ölçü artık Pill'den gelir.

"use client";

import { Pill } from "./Pill";

const TEKNIK_RENK = { bg: "#f9fafb", metin: "#4b5563", kenar: "#e5e7eb" };

export function TeknikPill({ teknikAdi, className }: { teknikAdi: string | null | undefined; className?: string }) {
  if (!teknikAdi || teknikAdi === "-") return null;

  return (
    <Pill renk={TEKNIK_RENK} className={className}>
      {teknikAdi}
    </Pill>
  );
}
