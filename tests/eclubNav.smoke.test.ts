import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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
      ["E-Club Takımım", "/eclub/eczanelerim"],
      ["E-Club Yayınları", "/eclub/yayinlar"],
      ["Ödül Sipariş Takibi", "/eclub/odul-siparis-takibi"],
      ["E-Club Raporları", "/eclub/raporlar"],
      ["E-Club Ligi", "/eclub/ligi"],
    ],
  );

  const yayinlar = eclub.oglar.find((oge) => oge.etiket === "E-Club Yayınları");
  assert.equal(yayinlar?.altOglar, undefined);
});

test("kaldırılan Gönderilen Yayınlar rotası birleşik sayfaya yönlenir ve ayrı rehber bırakmaz", () => {
  const eskiRota = readFileSync("app/(panel)/eclub/gonderilen-videolar/page.tsx", "utf8");
  const rehber = readFileSync("lib/rehber/sayfaRehberi.ts", "utf8");
  assert.match(eskiRota, /redirect\("\/eclub\/yayinlar"\)/);
  assert.doesNotMatch(rehber, /eclub-gonderilen-videolar/);
});

test("eski videolarım rotası E-Club Yayınları adresine yönlenir", () => {
  const eskiRota = readFileSync("app/(panel)/eclub/videolarim/page.tsx", "utf8");
  assert.match(eskiRota, /redirect\("\/eclub\/yayinlar"\)/);
});

test("BM, TM, üretici ve yönetici E-Club yönetim sayfalarını görür; video yönetimini görmez", () => {
  const eclub = PANEL_NAV.find((grup) => grup.baslik === "E-Club");
  const tclub = PANEL_NAV.find((grup) => grup.baslik === "T-Club");
  assert.ok(eclub);
  assert.ok(tclub);
  for (const rolKucu of ["bm", "tm", "pm", "gm"]) {
    assert.deepEqual(
      eclub.oglar.filter((oge) => oge.gate({ ...uttBaglami, rolKucu })).map((oge) => oge.etiket),
      [...(["bm", "tm"].includes(rolKucu) ? ["Ödül Sipariş Takibi"] : []), "E-Club Raporları", "E-Club Ligi"],
    );
  }
  assert.equal(tclub.oglar.some((oge) => oge.etiket === "E-Club Ligi"), false);
});

test("Çek Onay ve Takip bağlantısı sidebar yerine E-Club Takımım sayfasında yer alır", () => {
  const takimSayfasi = readFileSync("app/(panel)/eclub/eczanelerim/page.tsx", "utf8");
  assert.match(takimSayfasi, /router\.push\("\/eclub\/cek-onay-takip"\)/);
  assert.match(takimSayfasi, /Çek Onay ve Takip/);
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

  assert.equal(nav[1].baslik, "E-Club Hediye Çeki");
  assert.deepEqual(
    nav[1].oglar.filter((o) => o.gate(baglam)).map((o) => o.etiket),
    ["Hediye Çeki", "Çek Taleplerim"]
  );
  assert.equal(nav[1].oglar.find((o) => o.etiket === "Çek Taleplerim")?.path, "/eclub/cek-taleplerim");

  assert.equal(nav[2].baslik, "Eczanem");
  assert.deepEqual(
    nav[2].oglar.filter((o) => o.gate(baglam)).map((o) => o.etiket),
    ["Müşterilerim", "Video Dağıtımı", "Sipariş Onayı", "İşlem Dökümü"]
  );
});
