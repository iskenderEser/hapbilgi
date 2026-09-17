import assert from "node:assert/strict";
import test from "node:test";
import { eclubYayinKapsamindaMi } from "../lib/eclub/oneriKapsam.ts";
import {
  tuketiciHedefRolu,
  yayinTuketiciRoluneAcikMi,
} from "../lib/utils/roller.ts";
import {
  aracHedefMatrisi,
  TUKETICI_FIXTURELARI,
  TUKETIM_ARACLARI,
  yayinFixture,
} from "./helpers/tuketimSenaryosu.ts";

const HEDEFTEKI_KIMLIK_SAYISI = {
  utt: 2,
  bm: 1,
  eczaci: 3,
  eczane_teknisyeni: 1,
  eczanem: 1,
} as const;

test("20 araç-hedef yayınının her biri yalnız doğru tüketici kimliklerine açılır", () => {
  for (const yayin of aracHedefMatrisi()) {
    const hedef = yayin.hedef_roller[0];
    const erisebilenler = TUKETICI_FIXTURELARI.filter((kisi) =>
      yayinTuketiciRoluneAcikMi(yayin, kisi.rol),
    );

    assert.equal(erisebilenler.length, HEDEFTEKI_KIMLIK_SAYISI[hedef], `${yayin.arac_turu} × ${hedef}`);
    assert.ok(erisebilenler.every((kisi) => kisi.hedefRol === hedef));
    assert.ok(
      TUKETICI_FIXTURELARI
        .filter((kisi) => kisi.hedefRol !== hedef)
        .every((kisi) => !yayinTuketiciRoluneAcikMi(yayin, kisi.rol)),
      `${yayin.arac_turu} × ${hedef} hedef dışı kimliğe açıldı`,
    );
  }
});

test("UTT, BM, E-Club unvanları ve Eczanem müşterisi kanonik hedefe çözülür", () => {
  const beklenen = new Map(TUKETICI_FIXTURELARI.map((kisi) => [kisi.rol, kisi.hedefRol]));
  for (const [rol, hedef] of beklenen) assert.equal(tuketiciHedefRolu(rol), hedef);

  assert.equal(tuketiciHedefRolu("tm"), null);
  assert.equal(tuketiciHedefRolu("pm"), null);
  assert.equal(tuketiciHedefRolu("iu"), null);
  assert.equal(tuketiciHedefRolu("bilinmeyen"), null);
});

test("E-Club ortak hedefi iki tüketici grubuna, diğer hedefleri yalnız kendi kanalına açılır", () => {
  for (const arac of TUKETIM_ARACLARI) {
    const ortak = {
      ...yayinFixture(arac, "eczaci"),
      hedef_roller: ["eczaci", "eczane_teknisyeni"],
    } as const;

    for (const rol of ["eczaci", "ikinci_eczaci", "yardimci_eczaci", "eczane_teknisyeni"]) {
      assert.equal(yayinTuketiciRoluneAcikMi(ortak, rol), true, `${arac} ortak E-Club × ${rol}`);
    }
    for (const rol of ["utt", "kd_utt", "bm", "musteri", "tm"]) {
      assert.equal(yayinTuketiciRoluneAcikMi(ortak, rol), false, `${arac} ortak E-Club hedef dışı × ${rol}`);
    }
  }
});

test("UTT E-Club dağıtımında firma ve takım kapsamı bütün araçlarda aynıdır", () => {
  const utt = { firma_id: "firma-test", takim_id: "takim-test" };

  for (const arac of TUKETIM_ARACLARI) {
    const yayin = yayinFixture(arac, "eczaci");
    assert.equal(eclubYayinKapsamindaMi(utt, yayin), true);
    assert.equal(eclubYayinKapsamindaMi(utt, { ...yayin, takim_id: null }), true);
    assert.equal(eclubYayinKapsamindaMi(utt, { ...yayin, firma_id: "baska-firma" }), false);
    assert.equal(eclubYayinKapsamindaMi(utt, { ...yayin, takim_id: "baska-takim" }), false);
  }
});

test("hedef eşlemesi büyük-küçük harf ve çevre boşluklarından etkilenmez", () => {
  assert.equal(tuketiciHedefRolu("  KD_UTT "), "utt");
  assert.equal(tuketiciHedefRolu(" YARDIMCI_ECZACI "), "eczaci");
  assert.equal(tuketiciHedefRolu(" MUSTERI "), "eczanem");
});
