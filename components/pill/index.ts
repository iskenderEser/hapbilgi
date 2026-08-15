// components/pill/index.ts
//
// Pill ailesinin tek girişi. Sayfalar buradan alır:
//   import { DurumPill, AsamaPill } from "@/components/pill";
//
// Ölçü Pill.tsx'te, renk/metin anlam sözlüklerinde (mesaj.ts, HEDEF_ROL_TASARIM).
// Sayfada satır içi pill yazılmaz — envanter ve gerekçe: docs/pill_envanteri.md.

export { Pill, PillButon, NOTR_RENK, type PillRenk } from "./Pill";
export { AsamaPill, type PillAsama } from "./AsamaPill";
export { DurumPill } from "./DurumPill";
export { HedefRolPill, HedefRolPilleri } from "./HedefRolPill";
export { VaryantPill } from "./VaryantPill";
export { TeknikPill } from "./TeknikPill";
