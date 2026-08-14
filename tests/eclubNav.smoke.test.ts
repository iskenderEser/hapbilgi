import test from "node:test";
import assert from "node:assert/strict";

import { PANEL_NAV, type NavContext } from "@/components/panel/panelNav.config";

const uttBaglami: NavContext = {
  rolKucu: "utt",
  storeAcik: true,
  ccAcik: true,
  eclubAcik: true,
  eclubStoreAcik: true,
  eczanemAcik: true,
};

test("UTT E-Club altında kararlaştırılan dört sayfayı doğru sırada görür", () => {
  const eclub = PANEL_NAV.find((grup) => grup.baslik === "E-Club");
  assert.ok(eclub);
  assert.deepEqual(
    eclub.oglar.filter((oge) => oge.gate(uttBaglami)).map((oge) => [oge.etiket, oge.path]),
    [
      ["Videolar ve Eczanelerim", "/eclub/listem"],
      ["Raporlar", "/eclub/raporlar"],
      ["E-Club Ligi", "/eclub/ligi"],
      ["Siparişler", "/eclub/siparisler"],
    ],
  );
});

test("BM iç E-Club sayfalarını, UTT ise Ligler altında yinelenen E-Club Ligi bağlantısını görmez", () => {
  const eclub = PANEL_NAV.find((grup) => grup.baslik === "E-Club");
  const ligler = PANEL_NAV.find((grup) => grup.baslik === "Ligler");
  assert.ok(eclub);
  assert.ok(ligler);
  assert.equal(eclub.oglar.some((oge) => oge.gate({ ...uttBaglami, rolKucu: "bm" })), false);
  assert.equal(ligler.oglar.some((oge) => oge.etiket === "E-Club Ligi"), false);
});
