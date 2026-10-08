// Bluebook §13: seçim görünümü sayfada yeniden tanımlanamaz.
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const sorunlar = [];
let ortakKullanim = 0;
const ortakAdlar = new Set(["SadeSecim", "SadeTabloSecimi", "SadeListeSecimi", "SadeFormSecimi", "SadeKapsulFiltre", "SadeZamanToggle", "SadeKontrolGrubu", "SadeKontrolButonu", "SadeCokluAliciSecimi", "SadeAySecimi", "SadeSecimButonu", "SadeSecimMenusu", "SadeSecimSecenegi", "SadeAramaAlani", "PeriyotButonlari", "UttYayinTuruToggle", "SelectTrigger"]);
function tara(klasor) {
  for (const oge of fs.readdirSync(klasor, { withFileTypes: true })) {
    const dosya = path.join(klasor, oge.name);
    if (oge.isDirectory()) { tara(dosya); continue; }
    if (!dosya.endsWith(".tsx") || dosya.startsWith("components/kontrol/") || dosya.startsWith("components/ui/")) continue;
    const kaynak = ts.createSourceFile(dosya, fs.readFileSync(dosya, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function hata(node, mesaj) { sorunlar.push(`${dosya}:${kaynak.getLineAndCharacterOfPosition(node.getStart()).line + 1} — ${mesaj}`); }
    function incele(node) {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const ad = node.tagName.getText(kaynak);
        const attrs = node.attributes.properties;
        const role = attrs.find((a) => a.name?.getText(kaynak) === "role")?.getText(kaynak);
        if (ad === "select") hata(node, "Bağımsız select; ortak form veya liste seçimini kullanın.");
        if (ad === "button" && role === 'role="tab"') hata(node, "Bağımsız sekme; ortak sekme kontrolünü kullanın.");
        if (ortakAdlar.has(ad)) {
          ortakKullanim++;
          if (attrs.some((a) => a.name?.getText(kaynak) === "style")) hata(node, "Ortak kontrolün görünümü inline style ile değiştirilmiş.");
          const sinif = attrs.find((a) => a.name?.getText(kaynak) === "className");
          if (sinif && /(?:\bh-\d|\bh-\[|\bmin-h-|\btext-(?:xs|sm|base|\[)|\bfont-|\bbg-|\brounded-|\bborder-(?:\[|gray|blue)|\bshadow-|\[&.*button)/.test(sinif.getText(kaynak))) hata(node, "Ortak kontrolün ölçüsü/renk/yazısı sayfadan değiştiriliyor.");
        }
      }
      ts.forEachChild(node, incele);
    }
    incele(kaynak);
  }
}
tara("app"); tara("components");
if (sorunlar.length) { console.error(sorunlar.join("\n")); process.exitCode = 1; }
else console.log(`Kontrol standardı: ${ortakKullanim} ortak kullanım; bağımsız select/sekme veya yerel görünüm değişikliği bulunmadı.`);
