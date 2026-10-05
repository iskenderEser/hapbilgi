import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PANEL_NAV, type NavContext } from "@/components/panel/panelNav.config";

const oku = (yol: string) => readFileSync(yol, "utf8");
const sayfa = oku("app/(panel)/eclub/eczanelerim/page.tsx");
const gorunum = oku("app/(panel)/eclub/eczanelerim/_components/BmEclubTakimim.tsx");
const api = oku("app/(panel)/eclub/eczanelerim/api/route.ts");
const uttEczaneApi = oku("app/(panel)/eclub/listem/api/eczaneler/route.ts");
const uttKisiApi = oku("app/(panel)/eclub/listem/api/kisiler/route.ts");

const baglam: NavContext = {
  rolKucu: "bm",
  storeAcik: true,
  ccAcik: true,
  eclubAcik: true,
  eclubStoreAcik: true,
  eczanemAcik: true,
};

test("BM sidebar'da E-Club Takımım sekmesini görür", () => {
  const eclub = PANEL_NAV.find((grup) => grup.baslik === "E-Club");
  assert.ok(eclub);
  assert.ok(eclub.oglar.some((oge) => oge.path === "/eclub/eczanelerim" && oge.gate(baglam)));
});

test("aynı sayfa BM'yi salt okunur akordiyona, UTT'yi mevcut yönetim görünümüne ayırır", () => {
  assert.match(sayfa, /toLowerCase\(\) === "bm"/);
  assert.match(sayfa, /<BmEclubTakimim \/>/);
  assert.match(sayfa, /<UttEclubEczanelerimPage \/>/);
  assert.doesNotMatch(gorunum, /method:\s*"(?:POST|PUT|PATCH|DELETE)"/);
});

test("BM API kapsamı istemciden değil oturumdaki firma-takım-bölgeden kurar", () => {
  assert.match(api, /\.eq\("kullanici_id", user\.id\)/);
  assert.match(api, /!YONLENDIRICI_ROLLER\.includes\(\(kullanici\.rol \?\? ""\)\.toLowerCase\(\)\)/);
  assert.match(api, /eclubYonetimKapsaminiGetir\(admin, kullanici\)/);
  assert.match(api, /filter\(\(bag\) => bag\.firmaId === kullanici\.firma_id\)/);
  assert.doesNotMatch(api, /request\.json|searchParams/);
});

test("UTT'nin düzenleme API'leri BM'ye açılmaz", () => {
  assert.match(uttEczaneApi, /ECLUB_GOREN_ROLLER\.includes\(rolKucu\)/);
  assert.match(uttKisiApi, /ECLUB_GOREN_ROLLER\.includes\(rolKucu\)/);
  assert.match(uttEczaneApi, /yalnız UTT\/KD_UTT/);
  assert.match(uttKisiApi, /yalnız UTT\/KD_UTT/);
});

test("UTT ve eczane akordiyonları birden fazla satırı açık tutan Set yapısını kullanır", () => {
  assert.match(gorunum, /useState<Set<string>>\(new Set\(\)\)/);
  assert.match(gorunum, /const sonraki = new Set\(mevcut\)/);
  assert.match(gorunum, /acikUttler\.has\(utt\.utt_id\)/);
  assert.match(gorunum, /acikEczaneler\.has\(eczane\.eczane_id\)/);
  assert.match(gorunum, /className=\{uttAcik \? bmStyles\.openRow/);
});

test("eczane akordiyonu kişileri UTT ekranındaki sütunlu satır listesiyle gösterir", () => {
  assert.match(gorunum, /bmStyles\.nestedUttWrap/);
  assert.match(gorunum, /bmStyles\.nestedUttHeader/);
  assert.match(gorunum, /<span>Kişi<\/span><span>Unvan<\/span><span>E-posta<\/span><span>Telefon<\/span>/);
  assert.match(gorunum, /bmStyles\.nestedUttRow/);
  assert.doesNotMatch(gorunum, /md:grid-cols-2 xl:grid-cols-3/);
});
