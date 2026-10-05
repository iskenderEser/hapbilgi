import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { eclubBmGruplari } from "@/lib/eclub/bmGruplari";
import { PANEL_NAV, type NavContext } from "@/components/panel/panelNav.config";

const oku = (yol: string) => readFileSync(yol, "utf8");
const takim = oku("app/(panel)/eclub/eczanelerim/_components/BmEclubTakimim.tsx");
const yayin = oku("app/(panel)/eclub/yayinlar/_components/BmEclubYayinlari.tsx");

test("BM gruplaması farklı BM'leri ayırır, atamasız UTT'leri kaybetmez", () => {
  const uttler = [
    { utt_id: "u1", bm_id: "b1", bm_adi: "Ayşe", bolge_adi: "Ege" },
    { utt_id: "u2", bm_id: "b2", bm_adi: "Berk", bolge_adi: "Marmara" },
    { utt_id: "u3", bm_id: "b1", bm_adi: "Ayşe", bolge_adi: "Ege" },
    { utt_id: "u4", bm_id: null, bm_adi: "BM ataması bulunmuyor", bolge_adi: "Akdeniz" },
  ];
  const gruplar = eclubBmGruplari(uttler);
  assert.equal(gruplar.length, 3);
  assert.deepEqual(gruplar.find((bm) => bm.id === "b1")?.uttler.map((utt) => utt.utt_id), ["u1", "u3"]);
  assert.deepEqual(gruplar.find((bm) => bm.id === "b1")?.bolgeler, ["Ege"]);
  assert.equal(gruplar.find((bm) => bm.id === "atanmamis")?.uttler[0].utt_id, "u4");
  assert.equal(uttler.length, 4);
  assert.deepEqual(eclubBmGruplari([]), []);
});

test("TM sekmeleri modül kapalıyken açılmaz", () => {
  const baglam: NavContext = { rolKucu: "tm", storeAcik: true, ccAcik: true, eclubAcik: false, eclubStoreAcik: true, eczanemAcik: true };
  const eclub = PANEL_NAV.find((grup) => grup.baslik === "E-Club")!;
  assert.equal(eclub.oglar.filter((oge) => oge.gate(baglam)).length, 0);
});

test("TM mevcut ortak bileşenleri kullanır; BM ve UTT davranışı korunur", () => {
  assert.match(oku("app/(panel)/eclub/eczanelerim/page.tsx"), /<BmEclubTakimim rol="tm" \/>/);
  assert.match(oku("app/(panel)/eclub/yayinlar/page.tsx"), /<BmEclubYayinlari rol="tm" \/>/);
  assert.match(takim, /<Button[^\n]+hediye-takip/);
  assert.match(takim, /acikBmler\.has\(bm\.id\)/);
  assert.match(takim, /renderUttler\(bm\.uttler\)/);
  assert.match(yayin, /etiket="BM"/);
  assert.match(yayin, /etiket="UTT"/);
  assert.match(yayin, /bmGruplari\.find\(\(bm\) => bm\.id === seciliBmId\)/);
  assert.match(yayin, /istek !== istekSirasi\.current/);
  assert.doesNotMatch(`${takim}\n${yayin}`, /method:\s*"(?:POST|PUT|DELETE|PATCH)"/);
});

test("API'ler TM'yi oturum kapsamıyla sınırlar; yayın statları seçili UTT'ye daralmaz", () => {
  for (const yol of ["app/(panel)/eclub/eczanelerim/api/route.ts", "app/(panel)/eclub/yayinlar/api/bm/route.ts"]) {
    const api = oku(yol);
    assert.match(api, /!kullanici\.aktif_mi/);
    assert.match(api, /!YONLENDIRICI_ROLLER\.includes/);
    assert.match(api, /eclubYonetimKapsaminiGetir\(admin, kullanici\)/);
  }
  const kapsam = oku("lib/eclub/yonetimKapsami.ts");
  assert.match(kapsam, /rol === "tm" \|\| rol === "bm"/);
  assert.match(kapsam, /uttSorgusu = uttSorgusu\.eq\("takim_id", kullanici\.takim_id\)/);
  const api = oku("app/(panel)/eclub/yayinlar/api/bm/route.ts");
  assert.match(api, /\.in\("oneren_id", uttIdler\)/);
  assert.match(api, /istenenUttId && !seciliUtt/);
});
