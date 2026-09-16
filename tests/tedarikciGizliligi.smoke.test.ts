import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const KULLANICI_YUZEYLERI = [
  "components/ogrenme-araci/YarimYuklemeBildirimi.tsx",
  "app/(panel)/talepler/_components/HazirVideoYukleme.tsx",
  "app/(panel)/talepler/_components/VideoYukleme.tsx",
  "lib/ogrenmeAraci/bunnyYuklemeIstemci.ts",
  "lib/video/bunnyYukleme.ts",
  "lib/video/videoPlayer.ts",
  "app/(panel)/uretim/api/teslim/route.ts",
  "app/(panel)/uretim/api/hazir-video/route.ts",
  "app/(panel)/yayin-yonetimi/api/bekleyenler/sil/route.ts",
  "app/(panel)/yayin-yonetimi/api/yayinlar/route.ts",
  "app/(panel)/videolar/api/bunny-yukleme-baslat/route.ts",
  "app/(panel)/videolar/api/bunny-durum/route.ts",
  "app/(panel)/talepler/api/bunny-yukleme-baslat/route.ts",
  "app/api/ogrenme-araclari/yarim-yuklemeler/route.ts",
  "app/api/ogrenme-araclari/yukleme-local/route.ts",
  "app/api/ogrenme-araclari/yukleme-tamamla/route.ts",
  "app/api/ogrenme-araclari/yukleme-baslat/route.ts",
  "app/api/ogrenme-araclari/[arac_id]/erisim/route.ts",
  "app/api/ogrenme-araclari/[arac_id]/destek-yukleme-baslat/route.ts",
] as const;

function metinSabitleri(kaynak: string): string[] {
  const dosya = ts.createSourceFile("kullanici-yuzeyi.tsx", kaynak, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const metinler: string[] = [];

  const gelistiriciGunluguMu = (dugum: ts.Node): boolean => {
    for (let ust = dugum.parent; ust; ust = ust.parent) {
      if (ts.isCallExpression(ust) && ts.isPropertyAccessExpression(ust.expression)) {
        const hedef = ust.expression;
        if (ts.isIdentifier(hedef.expression) && hedef.expression.text === "console") return true;
      }
    }
    return false;
  };

  const gez = (dugum: ts.Node): void => {
    if (ts.isStringLiteralLike(dugum) && !gelistiriciGunluguMu(dugum)) metinler.push(dugum.text);
    if (ts.isJsxText(dugum)) metinler.push(dugum.text);
    ts.forEachChild(dugum, gez);
  };
  gez(dosya);
  return metinler;
}

test("kullanıcıya ulaşan arayüz ve API metinleri altyapı sağlayıcısının adını göstermez", () => {
  for (const yol of KULLANICI_YUZEYLERI) {
    const kaynak = readFileSync(new URL(`../${yol}`, import.meta.url), "utf8");
    assert.doesNotMatch(metinSabitleri(kaynak).join("\n"), /\bBunny(?:\.net| CDN| Storage| Stream)?\b/, yol);
  }
});

test("yükleme arayüzü sağlayıcıdan bağımsız kullanıcı metinlerini gösterir", () => {
  const yukleme = readFileSync(new URL("../app/(panel)/talepler/_components/HazirVideoYukleme.tsx", import.meta.url), "utf8");
  const ilerleme = readFileSync(new URL("../app/(panel)/talepler/_components/VideoYukleme.tsx", import.meta.url), "utf8");
  assert.match(yukleme, /"Videoyu Yükle"/);
  assert.match(ilerleme, /\{ayar\.yukleniyorMetni\} %\{yuklemeYuzdesi\}/);
  assert.match(ilerleme, /"Video yükleniyor\.\.\."/);
});
