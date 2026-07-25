// components/HedefRolBant.tsx
//
//   <HedefRolPill>  → Liste ve künye satırlarında küçük rozet (UTT/BM kısa etiketi)
//
// Renk ve etiket _types.HEDEF_ROL_TASARIM'dan okunur — tek doğruluk kaynağı.
//
// 25.07: <HedefRolBant> KALDIRILDI (İskender kararı). Sayfaların üstünde duran
// "Bu talep ... içindir" geniş bandıydı; önce üretici rollerde gizlendi (iletişim
// kartına temas ediyordu), sonra tamamen silindi — aynı bilgiyi künye satırındaki
// pill zaten taşıyor, bant tasarım bütünlüğünü bozuyordu.

"use client";

import { HEDEF_ROL_TASARIM, type HedefRol } from "@/app/talepler/_types";

interface HedefRolPillProps {
  hedefRol: HedefRol;
}

/**
 * Liste satırlarında ve künye satırlarında talebin hedef kitlesini gösteren küçük
 * rozet. Sadece kısa etiket (UTT / BM), inline yerleşim için.
 *
 * 25.07: köşe yarıçapı TAM YUVARLAK (İskender kararı) — künye satırında eğitim
 * türü ve teknik pill'lerinin yanında köşeli duruyordu; tüm rozetler tek formda.
 */
export function HedefRolPill({ hedefRol }: HedefRolPillProps) {
  const tasarim = HEDEF_ROL_TASARIM[hedefRol];

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border"
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