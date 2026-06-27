// components/HedefRolBant.tsx
//
// İki kullanım modu:
//   <HedefRolBant>  → Üretim sayfalarının üst kısmında geniş bant
//                     (talep detay, senaryo, video, soru seti, yayın yönetimi)
//   <HedefRolPill>  → Liste satırlarında küçük rozet (UTT/BM kısa etiketi)
//
// Renk ve etiket _types.HEDEF_ROL_TASARIM'dan okunur — tek doğruluk kaynağı.

"use client";

import { HEDEF_ROL_TASARIM, type HedefRol } from "@/app/talepler/_types";

interface HedefRolBantProps {
  hedefRol: HedefRol;
}

/**
 * Üretim sayfalarının üst kısmında talebin hedef kitlesini gösteren bant.
 * UTT için mavi tonu, BM için bordo tonu.
 */
export function HedefRolBant({ hedefRol }: HedefRolBantProps) {
  const tasarim = HEDEF_ROL_TASARIM[hedefRol];

  return (
    <div
      className="w-full py-2 px-4 flex items-center justify-center gap-2 text-xs font-semibold"
      style={{
        background: tasarim.bg,
        color: tasarim.renk,
        borderTop: `1px solid ${tasarim.border}`,
        borderBottom: `1px solid ${tasarim.border}`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: tasarim.renk }}
      />
      <span>Bu talep {tasarim.tamEtiket} içindir</span>
    </div>
  );
}

interface HedefRolPillProps {
  hedefRol: HedefRol;
}

/**
 * Liste satırlarında talebin hedef kitlesini gösteren küçük rozet.
 * Sadece kısa etiket (UTT / BM), inline yerleşim için.
 */
export function HedefRolPill({ hedefRol }: HedefRolPillProps) {
  const tasarim = HEDEF_ROL_TASARIM[hedefRol];

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border"
      style={{
        background: tasarim.bg,
        color: tasarim.renk,
        borderColor: tasarim.border,
      }}
    >
      {tasarim.kisaEtiket}
    </span>
  );
}