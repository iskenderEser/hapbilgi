// scripts/denetim/kod-tara.js
//
// HapBilgi kod tarayıcı.
// ts-morph ile tüm .ts/.tsx dosyalarını gezer, Supabase çağrılarını çıkarır:
//   .from("tablo")        → tablo referansı
//   .select("kolonlar")   → kolon + nested embed referansı
//   .rpc("fonksiyon")     → RPC referansı
//
// Bu aşamada denetim YOK — sadece "kodda ne kullanılıyor" envanteri üretir.
// Faz 1.4 (denetle.js) bunu sema.json ile karşılaştırır.
//
// Kullanım:  node scripts/denetim/kod-tara.js
// Çıktı:     scripts/denetim/kullanim.json + konsola özet

const { Project, SyntaxKind } = require("ts-morph");
const fs = require("fs");
const path = require("path");

// Proje kökü (scripts/denetim'den iki üst)
const PROJE_KOKU = path.resolve(__dirname, "..", "..");

function main() {
  const project = new Project({
    tsConfigFilePath: path.join(PROJE_KOKU, "tsconfig.json"),
    skipAddingFilesFromTsConfig: true,
  });

  // app + lib altındaki tüm .ts/.tsx dosyaları
  project.addSourceFilesAtPaths([
    path.join(PROJE_KOKU, "app/**/*.ts"),
    path.join(PROJE_KOKU, "app/**/*.tsx"),
    path.join(PROJE_KOKU, "lib/**/*.ts"),
    path.join(PROJE_KOKU, "lib/**/*.tsx"),
  ]);

  const sourceFiles = project.getSourceFiles();

  // Toplanan referanslar
  const fromlar = []; // { dosya, satir, tablo }
  const selectler = []; // { dosya, satir, ham } — ham select string'i
  const rpcler = []; // { dosya, satir, fonksiyon }

  for (const sf of sourceFiles) {
    const dosyaYolu = path.relative(PROJE_KOKU, sf.getFilePath());

    // Tüm CallExpression'ları gez
    const cagrilar = sf.getDescendantsOfKind(SyntaxKind.CallExpression);

    for (const cagri of cagrilar) {
      const ifade = cagri.getExpression();
      // ifade "x.from" / "x.select" / "x.rpc" biçiminde PropertyAccessExpression olmalı
      if (ifade.getKind() !== SyntaxKind.PropertyAccessExpression) continue;

      const metodAdi = ifade.getLastChild()?.getText();
      const argümanlar = cagri.getArguments();
      if (argümanlar.length === 0) continue;

      // storage.from("bucket") → DB tablosu değil, atla.
      // .from'un sol tarafı (ifade.getExpression()) metni "storage" ile bitiyorsa storage çağrısıdır.
      if (metodAdi === "from") {
        const solTaraf = ifade.getExpression().getText();
        if (/\.storage$/.test(solTaraf) || solTaraf === "storage") continue;
      }

      const ilkArg = argümanlar[0];
      const satir = cagri.getStartLineNumber();

      // Yalnızca string literal argümanları al (değişken/expression'ları atla — güvenli)
      const stringDeger = stringLiteralDegeri(ilkArg);

      if (metodAdi === "from") {
        if (stringDeger !== null) {
          fromlar.push({ dosya: dosyaYolu, satir, tablo: stringDeger });
        }
      } else if (metodAdi === "select") {
        if (stringDeger !== null) {
          selectler.push({
            dosya: dosyaYolu,
            satir,
            ham: stringDeger,
            tablo: zincirdenFromTablosu(cagri),
          });
        }
      } else if (metodAdi === "rpc") {
        if (stringDeger !== null) {
          rpcler.push({ dosya: dosyaYolu, satir, fonksiyon: stringDeger });
        }
      }
    }
  }

  const kullanim = { fromlar, selectler, rpcler };
  const cikisYol = path.join(__dirname, "kullanim.json");
  fs.writeFileSync(cikisYol, JSON.stringify(kullanim, null, 2), "utf8");

  console.log("kullanim.json yazıldı:", cikisYol);
  console.log("  .from  çağrısı (string literal):", fromlar.length);
  console.log("  .select çağrısı (string literal):", selectler.length);
  console.log("  .rpc   çağrısı (string literal):", rpcler.length);
}

// Bir .select() çağrısının ait olduğu .from("tablo") tablosunu bulur.
// Aynı method zincirinde geriye doğru yürür: x.from("t").select(...) →
// select'in expression'ı "....from(...)" içerir. from çağrısını bulup arg'ını okur.
function zincirdenFromTablosu(selectCagri) {
  // selectCagri.getExpression() = "<zincir>.select" ; onun sol tarafı zincirin devamı
  let node = selectCagri.getExpression(); // PropertyAccessExpression (.select)
  if (!node || node.getKind() !== SyntaxKind.PropertyAccessExpression) return null;
  let sol = node.getExpression(); // .select'ten önceki kısım

  // Zincirde geriye yürü: .from(...) CallExpression'ını ara
  while (sol) {
    const kind = sol.getKind();
    if (kind === SyntaxKind.CallExpression) {
      const ifade = sol.getExpression();
      if (
        ifade &&
        ifade.getKind() === SyntaxKind.PropertyAccessExpression &&
        ifade.getLastChild()?.getText() === "from"
      ) {
        const args = sol.getArguments();
        if (args.length > 0) {
          const v = stringLiteralDegeri(args[0]);
          return v;
        }
        return null;
      }
      // başka bir call (ör. .eq(...)) → onun expression'ının soluna in
      sol = ifade && ifade.getKind() === SyntaxKind.PropertyAccessExpression
        ? ifade.getExpression()
        : null;
    } else if (kind === SyntaxKind.PropertyAccessExpression) {
      sol = sol.getExpression();
    } else {
      break;
    }
  }
  return null;
}

// Bir AST node'u string literal ise değerini döndürür, değilse null.
// StringLiteral ('...' veya "...") ve NoSubstitutionTemplateLiteral (`...`) kabul edilir.
function stringLiteralDegeri(node) {
  const kind = node.getKind();
  if (
    kind === SyntaxKind.StringLiteral ||
    kind === SyntaxKind.NoSubstitutionTemplateLiteral
  ) {
    return node.getLiteralValue ? node.getLiteralValue() : node.getText().slice(1, -1);
  }
  return null;
}

main();