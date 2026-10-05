import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const oku = (yol: string) => readFileSync(yol, "utf8");
const takim = oku("app/(panel)/eclub/eczanelerim/_components/BmEclubTakimim.tsx");
const istemci = oku("app/(panel)/eclub/hediye-takip/_components/HediyeTakipIstemcisi.tsx");
const bm = oku("app/(panel)/eclub/hediye-takip/_components/BmHediyeTakipIstemcisi.tsx");
const cekApi = oku("app/(panel)/eclub/hediye-takip/api/bm/cek-takip/route.ts");
const siparisApi = oku("app/(panel)/eclub/hediye-takip/api/bm/siparis-takip/route.ts");
const kapsam = oku("lib/eclub/hediyeTakip/bmTakipKapsami.ts");
const cekListe = oku("app/(panel)/eclub/hediye-takip/_components/CekTakipListesi.tsx");
const siparisListe = oku("app/(panel)/eclub/hediye-takip/_components/SiparisTakipListesi.tsx");

test("BM E-Club Takımım sayfasından Hediye Takibi'ne geçebilir", () => {
  assert.match(takim, /router\.push\("\/eclub\/hediye-takip"\)/);
  assert.match(takim, /Hediye Takip/);
});

test("aynı rota BM ve UTT Hediye Takibi istemcilerini rol üzerinden ayırır", () => {
  assert.match(istemci, /toLowerCase\(\) === "bm"/);
  assert.match(istemci, /<BmHediyeTakipIstemcisi \/>/);
  assert.match(istemci, /<UttHediyeTakipIstemcisi \/>/);
});

test("BM API kapsamı oturumdaki bölgeye bağlı UTT'lerden kurulur ve seçilen UTT doğrulanır", () => {
  assert.match(kapsam, /eclubYonetimKapsaminiGetir\(admin, kullanici\)/);
  assert.match(kapsam, /uttler\.find\(\(utt\) => utt\.utt_id === istenenUttId\)/);
  assert.match(kapsam, /Seçilen UTT, yönetim kapsamında değildir/);
  assert.doesNotMatch(`${cekApi}\n${siparisApi}`, /export async function (?:POST|PUT|PATCH|DELETE)/);
});

test("BM statları tüm bölge UTT'lerinden, liste ise seçili UTT kapsamından hazırlanır", () => {
  assert.match(cekApi, /listeKapsami\.uttler\.map/);
  assert.match(cekApi, /erisim\.uttler\.map\(\(utt\) => cekTakipStatlariniGetir/);
  assert.match(siparisApi, /listeKapsami\.uttler\.map/);
  assert.match(siparisApi, /erisim\.uttler\.map\(\(utt\) => siparisTakipVerisiniGetir/);
});

test("BM Hediye Takibi UTT filtreli düz çek ve sipariş tablolarıdır", () => {
  assert.match(bm, /Tüm UTT’ler|uttler=\{uttler\}/);
  assert.match(bm, /uttGoster/);
  assert.doesNotMatch(bm, /Accordion|akordiyon|acikUtt/);
  assert.match(cekListe, /UTT Adı/);
  assert.match(siparisListe, /UTT Adı/);
});

test("BM çek ve sipariş işlemleri ayrı onay uçlarını kullanır", () => {
  assert.match(cekListe, /saltOkunur = false/);
  assert.match(cekListe, /!saltOkunur/);
  assert.match(siparisListe, /saltOkunur = false/);
  assert.match(siparisListe, /!saltOkunur/);
  assert.match(bm, /islem === "bm_onayla"/);
  assert.match(bm, /api\/bm\/siparis-takip\/\$\{talepId\}/);
  assert.match(cekApi, /talep\.onay\.bm\.kullanici_id === user\.id/);
  const onay = oku("app/(panel)/eclub/hediye-takip/api/bm/cek-takip/[talepId]/route.ts");
  assert.match(onay, /talep\.bm_id !== user\.id/);
  assert.match(onay, /utt\.kapsam\.firma_id === talep\.firma_id/);
  assert.match(onay, /talep\.durum !== "bm_onayinda"/);
  assert.match(onay, /rpc\("eclub_store_bm_onayla"/);
  assert.match(onay, /guncel\.durum !== "tm_onayinda"/);
});
