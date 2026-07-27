// components/liste/index.ts
//
// Liste ailesinin tek girişi. Sayfalar buradan alır:
//   const liste = useListe({ veri: talepler, aramaAlanlari: [...] });
//   <ListeArama arama={liste.arama} />
//   {liste.gorunen.map(...)}                  ← satırı sayfa çizer
//   <DahaFazlaGoster {...} />
//
// Merkez satır çizmez; yalnız arama, dilimleme ve "daha fazla" durumunu tutar.

export { useListe, type AramaAlani } from "./useListe";
export { ListeArama } from "./ListeArama";
export { DahaFazlaGoster } from "./DahaFazlaGoster";
