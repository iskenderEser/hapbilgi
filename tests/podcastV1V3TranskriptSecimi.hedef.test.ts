import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { podcastTranskriptTercihiCoz } from "../lib/ogrenmeAraci/sozlesme.ts";
import type { PodcastOgrenmeAraciTercihleri } from "../lib/ogrenmeAraci/tipler.ts";

function oku(goreceliYol: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), goreceliYol), "utf8");
}

// ============================================================================
// PODCAST V1 / V3 TRANSKRİPT TERCİHİ HEDEF DAVRANIŞ TESTLERİ (FAZ 1)
// ============================================================================

test("1. V1 ilk talepte 'istiyorum' seçiminin true kaydedilmesi", () => {
  const hookKodu = oku("app/(panel)/talepler/_hooks/useTalepFormu.ts");
  const apiKodu = oku("app/(panel)/talepler/api/route.ts");

  // Hook tarafında V1 (hazirVideo = false, ogrenmeAraciTuru = 'podcast') için tercih aktarımı
  assert.match(
    hookKodu,
    /ogrenme_araci_tercihleri:\s*\(!hazirVideo\s*&&\s*ogrenmeAraciTuru === "podcast"\)\s*\?\s*\{\s*transkript_istendi:\s*podcastIuTranskriptIstendi\s*\}\s*:\s*\{\}/
  );

  // API rotasında transkript_istendi: true kabul edilmeli ve temizAracTercihleri'ne yazılmalı
  assert.match(apiKodu, /temizAracTercihleri\s*=\s*\{\s*transkript_istendi:\s*aracTercihleri\.transkript_istendi\s*\}/);

  // Mantıksal doğrulama: V1 ve transkript_istendi: true
  const secim = true;
  const tercihler: PodcastOgrenmeAraciTercihleri = { transkript_istendi: secim };
  assert.equal(tercihler.transkript_istendi, true);
  assert.equal(podcastTranskriptTercihiCoz(tercihler), true);
});

test("2. V3 ilk talepte 'istemiyorum' seçiminin false kaydedilmesi", () => {
  const secim = false;
  const tercihler: PodcastOgrenmeAraciTercihleri = { transkript_istendi: secim };

  // Açıkça false seçildiğinde false kalmalı
  assert.equal(tercihler.transkript_istendi, false);
  assert.equal(podcastTranskriptTercihiCoz(tercihler), false);
  assert.equal(podcastTranskriptTercihiCoz({ ogrenme_araci_tercihleri: tercihler }), false);
});

test("3. Seçim yapılmadan V1/V3 podcast talebinin reddedilmesi (Form ve API)", () => {
  const hookKodu = oku("app/(panel)/talepler/_hooks/useTalepFormu.ts");
  const apiKodu = oku("app/(panel)/talepler/api/route.ts");

  // A. Form başlangıç durumunda null olmalı
  assert.match(hookKodu, /const\s*\[podcastIuTranskriptIstendi,\s*setPodcastIuTranskriptIstendi\]\s*=\s*useState<boolean\s*\|\s*null>\(null\);/);

  // B. Kullanıcı seçim yapmadığında (null) buton pasif olmalı
  assert.match(hookKodu, /!hazirVideo\s*&&\s*ogrenmeAraciTuru === "podcast"/);
  assert.match(hookKodu, /if\s*\(podcastIuTranskriptIstendi === null\)\s*\{\s*return\s*\{\s*gonderButonuEtkin:\s*false/);

  // C. validateForm seçim yapılmadığında hata fırlatmalı
  assert.match(hookKodu, /if\s*\(!hazirVideo\s*&&\s*ogrenmeAraciTuru === "podcast"\s*&&\s*podcastIuTranskriptIstendi === null\)/);

  // D. API rotası boolean olmayan veya eksik değeri 422 ile reddetmeli
  assert.match(apiKodu, /if\s*\(typeof\s*aracTercihleri\.transkript_istendi\s*!==\s*"boolean"\)\s*\{/);
  assert.match(apiKodu, /V1\/V3 podcast talepleri için transkript tercihi/);
});

test("4. Podcast dışındaki talebin bu alan olmadan kabul edilmesi", () => {
  const apiKodu = oku("app/(panel)/talepler/api/route.ts");

  // Video, Görsel, Flip PDF taleplerinde transkript_istendi zorunlu tutulmamalı
  assert.match(apiKodu, /if\s*\(ogrenme_araci_turu === "podcast"\)\s*\{[\s\S]*\}\s*else\s*\{[\s\S]*temizAracTercihleri\s*=/);

  // Podcast dışındaki bir talepte fonksiyon hata fırlatmaz, güvenli çalışır
  const videoTercihleri = {};
  assert.equal(podcastTranskriptTercihiCoz(videoTercihleri), true);
});

test("5. Eski V1/V3 podcast kaydında alan yoksa ortak çözümleyicinin true döndürmesi", () => {
  // Alanın hiç bulunmadığı eski kayıtlar
  assert.equal(podcastTranskriptTercihiCoz({}), true, "Boş nesnede geriye dönük true dönmeli");
  assert.equal(podcastTranskriptTercihiCoz(null), true, "Null tercihte true dönmeli");
  assert.equal(podcastTranskriptTercihiCoz(undefined), true, "Tanımsız tercihte true dönmeli");
  assert.equal(podcastTranskriptTercihiCoz({ anlatim_turu: "monolog" }), true, "Eski monolog kaydında true dönmeli");
  assert.equal(podcastTranskriptTercihiCoz({ ogrenme_araci_tercihleri: {} }), true, "Talep sarmalayıcısında true dönmeli");
});

test("6. Açıkça false kaydedilen değerin geriye uyumluluk varsayımıyla ezilmemesi", () => {
  // Açıkça false verilmişse kesinlikle false dönmeli, true varsayımı bunu ezmemeli
  assert.equal(podcastTranskriptTercihiCoz({ transkript_istendi: false }), false);
  assert.equal(podcastTranskriptTercihiCoz({ ogrenme_araci_tercihleri: { transkript_istendi: false } }), false);

  // Açıkça true verilmişse true dönmeli
  assert.equal(podcastTranskriptTercihiCoz({ transkript_istendi: true }), true);
  assert.equal(podcastTranskriptTercihiCoz({ ogrenme_araci_tercihleri: { transkript_istendi: true } }), true);
});

test("7. V2/V4 hazır podcast formu ve API davranışının değişmemesi", () => {
  const hookKodu = oku("app/(panel)/talepler/_hooks/useTalepFormu.ts");
  const alanlarKodu = oku("app/(panel)/talepler/_components/PodcastTalepAlanlari.tsx");

  // A. V2/V4 hazır podcast akışında mevcut buton kilit ve transkript mekanizması korunmalı
  assert.match(hookKodu, /if\s*\(sunucuTranskriptDurumu === "onaylandi"\)/);
  assert.match(hookKodu, /podcastAiTranskriptIstendi/);
  assert.match(hookKodu, /podcastTranskriptMetni/);

  // B. PodcastTalepAlanlari içinde V2/V4 hazır modu (props.hazir) aynen korunmalı
  assert.match(alanlarKodu, /\{props\.hazir\s*&&\s*\(/);
  assert.match(alanlarKodu, /<PodcastTranskriptEditoru/);
  assert.match(alanlarKodu, /etiket="Podcast"/);
  assert.match(alanlarKodu, /etiket="Yayın Görseli"/);
  assert.match(alanlarKodu, /AI ile Transkript/);
  assert.match(alanlarKodu, /Manuel Transkript/);
});

test("8. Form arayüzünde seçim butonları ve AI açıklamasının bulunması", () => {
  const alanlarKodu = oku("app/(panel)/talepler/_components/PodcastTalepAlanlari.tsx");

  // V1/V3 için iki seçenek olmalı
  assert.match(alanlarKodu, /Transkript istiyorum/);
  assert.match(alanlarKodu, /Transkript istemiyorum/);

  // Transkript istendiğinde İçerik Üreticisi tarafından AI ile üretileceği belirtilmeli
  assert.match(alanlarKodu, /İçerik Üreticisi tarafından podcast sesinden AI ile oluşturulacaktır/);
});
