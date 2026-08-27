import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const oku = (yol: string) => readFileSync(yol, "utf8");

const form = oku("app/(panel)/talepler/_components/YeniTalepFormV2.tsx");
const modal = oku("app/(panel)/talepler/_components/TalepOnayModal.tsx");
const hook = oku("app/(panel)/talepler/_hooks/useTalepFormu.ts");
const dosyaRoute = oku("app/(panel)/talepler/api/dosyalar/route.ts");

test("mutlu: referans dosyası bütün üretici rollerinde sahiplik ve görev bağıyla korunur", () => {
  assert.match(dosyaRoute, /URETICI_ROLLER/);
  assert.match(dosyaRoute, /talep\.uretici_id !== user\.id/);
  assert.match(dosyaRoute, /\.from\("uretim_gorevleri"\)[\s\S]*?\.eq\("atanan_iu_id", user\.id\)/);
  assert.match(dosyaRoute, /dosyaTalebeBagli/);
  assert.match(hook, /const metadataRes = await fetch\("\/talepler\/api\/dosyalar"/);
  assert.match(hook, /if \(!metadataRes\.ok\)[\s\S]*?remove\(\[dosyaYolu\]\)[\s\S]*?basarisizlar\.push/);
});

test("mutlu: V2 açıklaması ve V4 onayı gerçek sonraki adımı gösterir", () => {
  assert.match(form, /Hazır videonuzu yükledikten sonra soru seti İçerik Üreticisinden talep edilecektir/);
  assert.doesNotMatch(form, /hazır soru setinizle devam edebilir ya da/);
  assert.match(form, /sonrakiAdim=\{ikiliHazir \? "yayin_yonetimi" : "icerik_ureticisi"\}/);
  assert.match(modal, /Onayla ve Yayın Yönetimine Gönder/);
  assert.match(modal, /Onayla ve İçerik Üreticisine Gönder/);
});

test("red: üretim hattı rolü olmak başkasının referans dosyasını okumaya yetmez", () => {
  assert.match(dosyaRoute, /Dosya talebe bağlı değil/);
  assert.match(dosyaRoute, /Bu talebin dosyasını görüntüleme yetkiniz yok/);
  assert.match(dosyaRoute, /Yalnız talep açabilen üretici roller dosya yükleyebilir/);
});
