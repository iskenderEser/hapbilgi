import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  PANEL_NAV,
  mobilPanelNavOlustur,
  type NavContext,
} from "@/components/panel/panelNav.config";

const temelBaglam: NavContext = {
  rolKucu: "utt",
  storeAcik: true,
  ccAcik: false,
  eclubAcik: false,
  eclubStoreAcik: false,
  eczanemAcik: false,
};

const kisiselStoreYollari = ["/store", "/store/siparislerim", "/store/adreslerim"];

function sabitYollar(gruplar: ReturnType<typeof mobilPanelNavOlustur>) {
  return gruplar.flatMap((grup) =>
    grup.oglar.flatMap((oge) => typeof oge.path === "string" ? [oge.path] : []),
  );
}

test("mobil HBStore grubu UTT, KD_UTT ve BM için C-Club bayrağından bağımsız ve tekil görünür", () => {
  for (const rolKucu of ["utt", "kd_utt", "bm"]) {
    const mobilNav = mobilPanelNavOlustur(PANEL_NAV, { ...temelBaglam, rolKucu });
    const hbstoreIndexi = mobilNav.findIndex((grup) => grup.baslik === "HBStore");
    const tclubIndexi = mobilNav.findIndex((grup) => grup.baslik === "T-Club");
    const hbstore = mobilNav[hbstoreIndexi];

    assert.ok(hbstore);
    assert.equal(hbstoreIndexi + 1, tclubIndexi);
    assert.deepEqual(
      hbstore.oglar.filter((oge) => oge.gate({ ...temelBaglam, rolKucu })).map((oge) => oge.path),
      kisiselStoreYollari,
    );
    for (const storeYolu of kisiselStoreYollari) {
      assert.equal(sabitYollar(mobilNav).filter((yol) => yol === storeYolu).length, 1);
    }
  }

  const drawer = fs.readFileSync(path.join(process.cwd(), "components/panel/MobilDrawer.tsx"), "utf8");
  assert.match(drawer, /mobilPanelNavOlustur\(props\.gruplar \?\? PANEL_NAV, props\)/);
  assert.match(drawer, /minHeight: "44px"/);
  assert.match(drawer, /router\.push\(path\); props\.onKapat\(\)/);
});

test("mobil HBStore grubu kapalı mağazada ve yetkisiz rollerde görünmez", () => {
  const kapaliMagaza = mobilPanelNavOlustur(PANEL_NAV, { ...temelBaglam, storeAcik: false });
  assert.equal(kapaliMagaza.some((grup) => grup.baslik === "HBStore"), false);
  for (const storeYolu of kisiselStoreYollari) {
    assert.equal(sabitYollar(kapaliMagaza).includes(storeYolu), false);
  }

  for (const rolKucu of ["tm", "pm", "gm", "admin", "iu"]) {
    const mobilNav = mobilPanelNavOlustur(PANEL_NAV, { ...temelBaglam, rolKucu });
    assert.equal(mobilNav.some((grup) => grup.baslik === "HBStore"), false);
    for (const storeYolu of kisiselStoreYollari) {
      assert.equal(sabitYollar(mobilNav).includes(storeYolu), false);
    }
  }
});
