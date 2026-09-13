import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("UreticiAnaSayfa satirYolu yayindaki ve bekleyen yayinlari yayin-yonetimi URL parametrelerine yonlendirir", () => {
  const anaSayfa = readFileSync("components/ana-sayfa/UreticiAnaSayfa.tsx", "utf8");
  assert.match(anaSayfa, /yayinHedefGrubuBelirle/);
  assert.match(anaSayfa, /\/yayin-yonetimi\?durum=yayinda&hedef=/);
  assert.match(anaSayfa, /\/yayin-yonetimi\?durum=durdurulan&hedef=/);
  assert.match(anaSayfa, /\/yayin-yonetimi\?durum=bekleyen&hedef=/);
});

test("YayinYonetimiPage useSearchParams ile durum ve hedef parametrelerini okur ve baslangic state'ine baglar", () => {
  const sayfa = readFileSync("app/(panel)/yayin-yonetimi/page.tsx", "utf8");
  assert.match(sayfa, /useSearchParams/);
  assert.match(sayfa, /searchParams\.get\("durum"\)/);
  assert.match(sayfa, /searchParams\.get\("hedef"\)/);
  assert.match(sayfa, /useState<YayinHedefGrubu>\(baslangicHedef \?\? "utt"\)/);
  assert.match(sayfa, /useState<AltSekme>\(baslangicDurum\)/);
  assert.match(sayfa, /<Suspense/);
});
