// components/pill/HedefRolPill.tsx
//
// Talebin hedef kitlesi (UTT / BM). Renk ve etiket HEDEF_ROL_TASARIM'dan okunur —
// tek doğruluk kaynağı orada, burada kopyası tutulmaz.
//
// Taşındı (27.07): eski yeri components/HedefRolBant.tsx. Ölçüsü kendi içinde
// yazılıydı (px-2 py-0.5, 1px kenar, 600) ve yanındaki rozetlerden farklı
// yükseklikteydi; artık ölçü Pill'den gelir.

"use client";

import { HEDEF_ROL_TASARIM, type HedefRol } from "@/app/(panel)/talepler/_types";
import { Pill } from "./Pill";

export function HedefRolPill({ hedefRol, className }: { hedefRol: HedefRol; className?: string }) {
  const tasarim = HEDEF_ROL_TASARIM[hedefRol];

  return (
    <Pill
      renk={{ bg: tasarim.bg, metin: tasarim.renk, kenar: tasarim.border }}
      className={className}
    >
      {tasarim.kisaEtiket}
    </Pill>
  );
}

export function HedefRolPilleri({ hedefRoller, className }: { hedefRoller: readonly HedefRol[]; className?: string }) {
  return (
    <span className={`inline-flex flex-wrap items-center justify-center gap-1 ${className ?? ""}`}>
      {hedefRoller.map((hedefRol) => <HedefRolPill key={hedefRol} hedefRol={hedefRol} />)}
    </span>
  );
}
