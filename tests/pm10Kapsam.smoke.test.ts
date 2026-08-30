import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ureticiUrunListeKapsami, ureticiUrunYazmaKapsami } from "@/lib/uretici/urunKapsami";

const pm = { rol: "pm", firma_id: "hepifarma", takim_id: "simsek", aktif_mi: true };
const medikal = { rol: "med_md", firma_id: "hepifarma", takim_id: null, aktif_mi: true };

test("PM-10: PM ürün sözlüğünde yalnız kendi firma ve takım kapsamını kullanır", () => {
  assert.deepEqual(ureticiUrunListeKapsami(pm, "hepifarma", "simsek"), {
    firma_id: "hepifarma", takim_id: "simsek",
  });
  assert.deepEqual(ureticiUrunListeKapsami(pm, "hepifarma", null), {
    firma_id: "hepifarma", takim_id: "simsek",
  });
  assert.equal(ureticiUrunListeKapsami(pm, "mill", "simsek"), null);
  assert.equal(ureticiUrunListeKapsami(pm, "hepifarma", "yildirim"), null);
  assert.equal(ureticiUrunListeKapsami({ ...pm, aktif_mi: false }, "hepifarma", "simsek"), null);
});

test("PM-10: firma kapsamlı üretici yalnız kendi firmasında takım seçebilir", () => {
  assert.deepEqual(ureticiUrunListeKapsami(medikal, "hepifarma", "simsek"), {
    firma_id: "hepifarma", takim_id: "simsek",
  });
  assert.equal(ureticiUrunListeKapsami(medikal, "mill", "simsek"), null);
  assert.equal(ureticiUrunYazmaKapsami(medikal, "hepifarma", null), null);
  assert.deepEqual(ureticiUrunYazmaKapsami(pm, "hepifarma", null), {
    firma_id: "hepifarma", takim_id: "simsek",
  });
});

test("PM-10: ürün API'si sorgu ve yazımda doğrulanmış kapsamı kullanır", () => {
  const route = readFileSync(new URL("../app/urunler/api/route.ts", import.meta.url), "utf8");
  assert.match(route, /ureticiUrunListeKapsami\(profil, firma_id, takim_id\)/);
  assert.match(route, /\.eq\("firma_id", kapsam\.firma_id\)/);
  assert.match(route, /query\.or\(`takim_id\.eq\.\$\{kapsam\.takim_id\},takim_id\.is\.null`\)/);
  assert.match(route, /ureticiUrunYazmaKapsami\(profil, firma_id, takim_id \?\? null\)/);
  assert.match(route, /\.insert\(\{ firma_id: kapsam\.firma_id, takim_id: kapsam\.takim_id/);
});

test("PM-10: yayın kataloğu oturum sahibinin firma kapsamını sunucuda uygular", () => {
  const katalog = readFileSync(new URL("../lib/video/yayindakiVideolar.ts", import.meta.url), "utf8");
  assert.match(katalog, /\.eq\("kullanici_id", userId\)/);
  assert.match(katalog, /firma_id\.eq\.\$\{kullanici\.firma_id\}/);
  assert.match(katalog, /\.eq\("firma_id", kullanici\.firma_id\)/);
});
