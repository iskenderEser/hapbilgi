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

test("UTT E-Club altında kararlaştırılan yönetim alanlarını doğru sırada görür", () => {
  const eclub = PANEL_NAV.find((grup) => grup.baslik === "E-Club");
  assert.ok(eclub);
  assert.deepEqual(
    eclub.oglar.filter((oge) => oge.gate(uttBaglami)).map((oge) => [oge.etiket, oge.path]),
    [
      ["Eczanelerim", "/eclub/eczanelerim"],
      ["Video Yönetimi", undefined],
      ["E-Club Raporları", "/eclub/raporlar"],
      ["E-Club Ligi", "/eclub/ligi"],
    ],
  );
});

test("BM, TM, üretici ve yönetici E-Club yönetim sayfalarını görür; video yönetimini görmez", () => {
  const eclub = PANEL_NAV.find((grup) => grup.baslik === "E-Club");
  const tclub = PANEL_NAV.find((grup) => grup.baslik === "T-Club");
  assert.ok(eclub);
  assert.ok(tclub);
  for (const rolKucu of ["bm", "tm", "pm", "gm"]) {
    assert.deepEqual(
      eclub.oglar.filter((oge) => oge.gate({ ...uttBaglami, rolKucu })).map((oge) => oge.etiket),
      ["E-Club Raporları", "E-Club Ligi"],
    );
  }
  assert.equal(tclub.oglar.some((oge) => oge.etiket === "E-Club Ligi"), false);
});

test("eclub_kisi (eczacı/teknisyen) grupları ve sekmeleri eksiksiz görür", async () => {
  const { eclubKisiNavOlustur } = await import("@/components/panel/panelNav.config");
  const nav = eclubKisiNavOlustur([
    { firma_id: "f1", firma_adi: "Firma A" },
    { firma_id: "f2", firma_adi: "Firma B" },
  ]);

  const baglam: NavContext = {
    rolKucu: "eczaci",
    storeAcik: true,
    ccAcik: false,
    eclubAcik: true,
    eclubStoreAcik: true,
    eczanemAcik: true,
  };

  assert.equal(nav.length, 3);
  assert.equal(nav[0].baslik, "E-Club");
  assert.equal(nav[0].oglar[0].etiket, "Firmaların Videoları");
  assert.equal(nav[0].oglar[0].altOglar?.length, 2);

  assert.equal(nav[1].baslik, "E-Club Store");
  assert.deepEqual(
    nav[1].oglar.filter((o) => o.gate(baglam)).map((o) => o.etiket),
    ["Mağazam", "Siparişlerim", "Adreslerim"]
  );

  assert.equal(nav[2].baslik, "Eczanem");
  assert.deepEqual(
    nav[2].oglar.filter((o) => o.gate(baglam)).map((o) => o.etiket),
    ["Müşterilerim", "Video Dağıtımı", "Sipariş Onayı", "İşlem Dökümü"]
  );
});
