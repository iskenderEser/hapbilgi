import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { PANEL_NAV, type NavContext } from "@/components/panel/panelNav.config";
import { STORE_ALABILEN_ROLLER } from "@/lib/utils/roller";

const kok = process.cwd();

function oku(dosya: string) {
  return fs.readFileSync(path.join(kok, dosya), "utf8");
}

test("UTT navbar özeti yalnızca takım sırası ve sipariş puanını taşır", () => {
  const navbar = oku("components/panel/PanelNavbar.tsx");
  const layout = oku("app/(panel)/layout.tsx");
  const cache = oku("lib/panel/panelCache.ts");
  const profilApi = oku("app/(panel)/profil/api/route.ts");
  const storeSayfasi = oku("app/(panel)/store/page.tsx");

  assert.match(navbar, /Takım Sırası:/);
  assert.match(navbar, /Sipariş:/);
  assert.match(navbar, /router\.push\("\/store"\)/);
  assert.match(navbar, />\s*HBStore\s*<\/button>/);
  assert.match(navbar, /\{hbStoreGoster && \(/);
  assert.match(layout, /hbStoreGoster=\{!isEclubKisi && etkinFlags\.storeAcik && STORE_ALABILEN_ROLLER\.includes\(rolKucu\)\}/);
  assert.match(storeSayfasi, /<h1[^>]*>\s*HBStore\s*<\/h1>/);
  assert.doesNotMatch(navbar, /Haftalık:/);
  assert.doesNotMatch(navbar, /haftalikPuan/);

  assert.doesNotMatch(layout, /haftalikPuan|haftalik_puan/);
  assert.doesNotMatch(cache, /haftalikPuan/);

  assert.doesNotMatch(profilApi, /haftalik_puan/);
  assert.match(profilApi, /takim_sirasi/);
  assert.match(profilApi, /siparis_puani/);
});

test("HBStore navbar girişi yalnız kişisel sipariş verebilen rollere açılır", () => {
  assert.deepEqual(STORE_ALABILEN_ROLLER, ["utt", "kd_utt", "bm"]);
  for (const rol of ["tm", "pm", "gm", "admin", "iu"]) {
    assert.ok(!STORE_ALABILEN_ROLLER.includes(rol));
  }
});

test("HBStore adı Bi, rehber ve BM menüsünde tutarlı kalır", () => {
  const biSayfalari = oku("lib/bi/sayfalar.ts");
  const biKatalogu = oku("lib/bi/cevapKatalogu.ts");
  const rehber = oku("lib/rehber/sayfaRehberi.ts");
  const storeSayfasi = oku("app/(panel)/store/page.tsx");
  const hbStoreRehberi = rehber.slice(
    rehber.indexOf('"store-magaza"'),
    rehber.indexOf('"eclub-eczanelerim"'),
  );
  const bmBaglami: NavContext = {
    rolKucu: "bm",
    storeAcik: true,
    ccAcik: true,
    eclubAcik: false,
    eclubStoreAcik: false,
    eczanemAcik: false,
  };
  const cclub = PANEL_NAV.find((grup) => grup.baslik === "C-Club");
  assert.ok(cclub);

  const bmEtiketleri = cclub.oglar
    .filter((oge) => !oge.gate || oge.gate(bmBaglami))
    .map((oge) => oge.etiket);

  assert.match(biSayfalari, /"store": \{ etiket: "HBStore", url: "\/store" \}/);
  assert.match(biKatalogu, /id: "hbstore",\s*baslik: "HBStore"/);
  assert.match(hbStoreRehberi, /baslik: "HBStore"/);
  assert.match(hbStoreRehberi, /baslik: "HBStore Günleri"/);
  assert.match(hbStoreRehberi, /HBStore açıkken/);
  assert.match(hbStoreRehberi, /HBStore kapalıyken/);
  assert.doesNotMatch(hbStoreRehberi, /Mağazam/);
  assert.doesNotMatch(hbStoreRehberi, /Mağaza/);
  assert.match(storeSayfasi, /HBStore Günleri Açık/);
  assert.match(storeSayfasi, /HBStore Günleri Kapalı/);
  assert.match(storeSayfasi, /Siparişler yalnızca HBStore Günleri/);
  assert.ok(bmEtiketleri.includes("HBStore"));
  assert.ok(!bmEtiketleri.includes("Mağazam"));
});

test("UTT mağaza bağlantıları sidebar yerine navbar ve mağaza içinde kalır", () => {
  const baglam: NavContext = {
    rolKucu: "utt",
    storeAcik: true,
    ccAcik: false,
    eclubAcik: false,
    eclubStoreAcik: false,
    eczanemAcik: false,
  };
  const tclub = PANEL_NAV.find((grup) => grup.baslik === "T-Club");
  assert.ok(tclub);

  const gorunenEtiketler = tclub.oglar
    .filter((oge) => !oge.gate || oge.gate(baglam))
    .map((oge) => oge.etiket);

  assert.ok(!gorunenEtiketler.includes("Mağazam"));
  assert.ok(!gorunenEtiketler.includes("Siparişlerim"));
  assert.ok(!gorunenEtiketler.includes("Adreslerim"));
});
