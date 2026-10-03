import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PANEL_NAV, type NavContext } from "@/components/panel/panelNav.config";
import { mutabakatOnayDurumuEtiketi } from "@/lib/eczanem/uttMutabakat";

const oku = (yol: string) => readFileSync(yol, "utf8");

const temelBaglam: NavContext = {
  rolKucu: "bm",
  storeAcik: false,
  ccAcik: false,
  eclubAcik: false,
  eclubStoreAcik: false,
  eczanemAcik: true,
};

test("BM Eczanem sidebarında yalnız Mutabakat Takip öğesini görür", () => {
  const eczanem = PANEL_NAV.find((grup) => grup.baslik === "Eczanem");
  assert.ok(eczanem);
  const gorunur = eczanem.oglar.filter((oge) => oge.gate(temelBaglam));
  assert.deepEqual(gorunur.map((oge) => oge.etiket), ["Mutabakat Takip"]);
  assert.equal(gorunur[0].path, "/eczanem/bm/mutabakat");
});

test("BM mutabakat takip rotası rol ve Eczanem firma kapısıyla korunur", () => {
  const proxy = oku("proxy.ts");
  const erisim = oku("lib/eczanem/erisim.ts");
  const sayfa = oku("app/(panel)/eczanem/bm/mutabakat/page.tsx");
  const istemci = oku("app/(panel)/eczanem/bm/mutabakat/_components/BmMutabakatTakipClient.tsx");
  const ortakTablo = oku("app/(panel)/eczanem/_components/MutabakatIslemTablosu.tsx");
  const api = oku("app/eczanem/bm/api/mutabakat/route.ts");

  assert.match(proxy, /const bmDali = pathname\.startsWith\("\/eczanem\/bm"\)/);
  assert.match(proxy, /else if \(bmDali\)[\s\S]*?rol !== "bm"/);
  assert.match(erisim, /TUKETICI_ROLLER\.includes\(rol\) \|\| rol === "bm" \|\| rol === "tm"/);
  assert.match(sayfa, /if \(rol !== "bm"\) redirect\("\/ana-sayfa"\)/);
  assert.match(istemci, />Mutabakat Takip</);
  assert.match(api, /if \(rol !== "bm"\)/);
  assert.match(api, /hedefUtt\(yetki\.uttler!, uttId\)/);
  assert.match(api, /eclubYonetimKapsaminiGetir/);
  assert.doesNotMatch(`${sayfa}\n${istemci}\n${api}`, /uttMutabakatKarariVer|aria-label="UTT kararı"/);
  assert.match(api, /bmMutabakatKarariVer/);
  assert.match(istemci, /<MutabakatIslemTablosu/);
  assert.match(ortakTablo, /etiket: "Onayla"/);
  assert.match(ortakTablo, /etiket: "Beklet"/);
  assert.match(ortakTablo, /etiket: "Reddet"/);
  assert.match(api, /bmMutabakatiTmOnayinaGonder/);
  assert.match(ortakTablo, /TM Onayına Gönder/);
});

test("UTT ve eczane akordiyonları birbirinden bağımsız açık kalır", () => {
  const istemci = oku("app/(panel)/eczanem/bm/mutabakat/_components/BmMutabakatTakipClient.tsx");
  const ortakTablo = oku("app/(panel)/eczanem/_components/MutabakatIslemTablosu.tsx");

  assert.match(istemci, /const \[acikUttler, setAcikUttler\] = useState<Set<string>>/);
  assert.match(istemci, /const \[acikEczaneler, setAcikEczaneler\] = useState<Set<string>>/);
  assert.match(istemci, /new Set\(mevcut\)/g);
  assert.ok(istemci.includes("hidden={!acik}"));
  assert.match(istemci, /Tümünü kapat/);
  assert.match(ortakTablo, /<span className="text-center">Sonuç<\/span>/);
  assert.match(ortakTablo, /<span className="text-center">Karar<\/span>/);
  assert.doesNotMatch(istemci, /aria-label="UTT kararı"/);
});

test("UTT, BM ve TM tek merkezi işlem tablosu ile aynı sütun standardını kullanır", () => {
  const utt = oku("app/(panel)/eczanem/utt/mutabakat/page.tsx");
  const bmTm = oku("app/(panel)/eczanem/bm/mutabakat/_components/BmMutabakatTakipClient.tsx");
  const ortakTablo = oku("app/(panel)/eczanem/_components/MutabakatIslemTablosu.tsx");
  const stiller = oku("app/(panel)/eczanem/_components/MutabakatIslemTablosu.module.css");

  assert.match(utt, /<MutabakatIslemTablosu[\s\S]*?rol="utt"/);
  assert.match(bmTm, /<MutabakatIslemTablosu[\s\S]*?rol=\{rol\}/);
  assert.doesNotMatch(`${utt}\n${bmTm}`, /ISLEM_SUTUNLARI|grid-template-columns/);
  assert.match(ortakTablo, /type MutabakatTabloRolu = "utt" \| "bm" \| "tm"/);
  assert.match(ortakTablo, /styles\.sutunlar/g);
  assert.match(stiller, /container-type: inline-size/);
  assert.match(stiller, /@container mutabakat-islem-tablosu \(min-width: 600px\) and \(max-width: 1099px\)/);
  assert.match(stiller, /@container mutabakat-islem-tablosu \(min-width: 1100px\)/);
  assert.match(stiller, /\.tablo\s*\{[\s\S]*?overflow: hidden/);
  assert.match(stiller, /\.duzTablo\s*\{[\s\S]*?overflow-x: auto/);
  assert.match(stiller, /\.duzUtt \.sutunlar\s*\{[\s\S]*?min-width: 1780px/);
  assert.match(stiller, /\.duzBm \.sutunlar\s*\{[\s\S]*?min-width: 1960px/);
  assert.match(stiller, /\.duzTm \.sutunlar\s*\{[\s\S]*?min-width: 2120px/);
  assert.match(stiller, /flex-wrap: nowrap/);
  assert.match(stiller, /height: 44px/);
  assert.match(stiller, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(stiller, /font-size: clamp/);
  assert.match(stiller, /grid-template-columns:[\s\S]*?minmax\(0,/);
});

test("TM mutabakat takibi BM, UTT ve eczane akordiyon hiyerarşisini son onaya taşır", () => {
  const nav = PANEL_NAV.find((grup) => grup.baslik === "Eczanem");
  assert.ok(nav);
  const tmBaglami = { ...temelBaglam, rolKucu: "tm" };
  const gorunur = nav.oglar.filter((oge) => oge.gate(tmBaglami));
  assert.deepEqual(gorunur.map((oge) => oge.path), ["/eczanem/tm/mutabakat"]);

  const proxy = oku("proxy.ts");
  const sayfa = oku("app/(panel)/eczanem/tm/mutabakat/page.tsx");
  const api = oku("app/eczanem/tm/api/mutabakat/route.ts");
  const istemci = oku("app/(panel)/eczanem/bm/mutabakat/_components/BmMutabakatTakipClient.tsx");
  const ortakTablo = oku("app/(panel)/eczanem/_components/MutabakatIslemTablosu.tsx");
  const kapsam = oku("lib/eclub/yonetimKapsami.ts");
  assert.match(proxy, /const tmDali = pathname\.startsWith\("\/eczanem\/tm"\)/);
  assert.match(proxy, /else if \(tmDali\)[\s\S]*?rol !== "tm"/);
  assert.match(sayfa, /if \(rol !== "tm"\) redirect\("\/ana-sayfa"\)/);
  assert.match(sayfa, /rol="tm"/);
  assert.match(api, /tmMutabakatKarariVer/);
  assert.match(ortakTablo, /return kayit\.tm_karar/);
  assert.match(istemci, /tm_karar: sonuc\.karar/);
  assert.match(kapsam, /bm_id: bm\?\.kullanici_id \?\? null/);
  assert.match(istemci, /const \[acikBmler, setAcikBmler\] = useState<Set<string>>/);
  assert.match(istemci, /function BmPaneli/);
  assert.match(istemci, />BM Adı</);
  assert.match(istemci, /bmGruplari\.map\(\(bm\) => <BmPaneli/);
  assert.match(istemci, /bm\.uttler\.map\(\(utt\) => <UttPaneli/);
});

test("UTT, BM ve TM mutabakat görünümü akordiyon ve düz tablo arasında beklemeden değişir", () => {
  const utt = oku("app/(panel)/eczanem/utt/mutabakat/page.tsx");
  const uttApi = oku("app/eczanem/utt/api/mutabakat/route.ts");
  const bmApi = oku("app/eczanem/bm/api/mutabakat/route.ts");
  const tmApi = oku("app/eczanem/tm/api/mutabakat/route.ts");
  const istemci = oku("app/(panel)/eczanem/bm/mutabakat/_components/BmMutabakatTakipClient.tsx");
  const ortakTablo = oku("app/(panel)/eczanem/_components/MutabakatIslemTablosu.tsx");
  const veriKaynagi = oku("lib/eczanem/uttMutabakat.ts");

  assert.match(utt, /Akordiyon Tablo/);
  assert.match(utt, /Düz Tablo/);
  assert.match(istemci, /Akordiyon Tablo/);
  assert.match(istemci, /Düz Tablo/);
  assert.match(utt, /<h2[^>]*>İndirim Onay Tablosu<\/h2>/);
  assert.match(istemci, /<h2[^>]*>İndirim Onay Tablosu<\/h2>/);
  assert.doesNotMatch(`${utt}\n${istemci}`, /Düz Mutabakat Tablosu/);
  assert.match(utt, /eczanem-utt-mutabakat-gorunumu/);
  assert.match(istemci, /`eczanem-\$\{rol\}-mutabakat-gorunumu`/);
  assert.match(istemci, /const \[sonuc, duzSonuc\] = await Promise\.all\(\[/);
  assert.match(istemci, /const gorunumDegistir[\s\S]*?setGorunum\(sonraki\)[\s\S]*?localStorage\.setItem/);
  assert.match(utt, /const \[yanit, duzYanit\] = await Promise\.all\(\[/);
  assert.match(istemci, /gorunum="duz"/);
  assert.match(utt, /gorunum="duz"/);
  assert.match(istemci, /kayitGuncellemeleri/);
  for (const api of [uttApi, bmApi, tmApi]) {
    assert.match(api, /gorunum === "duz"/);
    assert.match(api, /tumUttMutabakatKayitlariniListele/);
  }
  assert.match(veriKaynagi, /export async function tumUttMutabakatKayitlariniListele/);
  assert.match(ortakTablo, /rol === "tm" && <span>BM<\/span>/);
  assert.match(ortakTablo, /rol !== "utt" && <span>UTT<\/span>/);
  assert.match(ortakTablo, /<span>Eczane<\/span>/);
});

test("İndirim Onay Tablosu üç rolde ortak XLSX dışa aktarma butonunu kullanır", () => {
  const paket = oku("package.json");
  const utt = oku("app/(panel)/eczanem/utt/mutabakat/page.tsx");
  const bmTm = oku("app/(panel)/eczanem/bm/mutabakat/_components/BmMutabakatTakipClient.tsx");
  const excel = oku("app/(panel)/eczanem/_components/MutabakatExcelButonu.tsx");
  const veri = oku("lib/eczanem/uttMutabakat.ts");

  assert.match(paket, /"xlsx": "\^0\.18\.5"/);
  assert.match(utt, /<MutabakatExcelButonu rol="utt" donem=\{donem\}/);
  assert.match(bmTm, /<MutabakatExcelButonu rol=\{rol\} donem=\{donem\}/);
  assert.match(excel, /await import\("xlsx"\)/);
  assert.match(excel, /XLSX\.utils\.aoa_to_sheet/);
  assert.match(excel, /XLSX\.utils\.book_append_sheet\(kitap, sayfa, "İndirim Onay Tablosu"\)/);
  assert.match(excel, /XLSX\.writeFile\(kitap, `indirim_onay_tablosu_\$\{rol\}_\$\{donem\}\.xlsx`/);
  assert.match(excel, /sayfa\["!autofilter"\]/);
  assert.match(excel, /rol === "tm" \? \["BM"\] : \[\]/);
  assert.match(excel, /rol !== "utt" \? \["UTT"\] : \[\]/);
  assert.match(excel, /"Eczane", "İndirim Onay Tarihi", "Ürün Adı", "Öğrenme Aracı", "PSF", "İndirim Limiti"/);
  assert.match(excel, /"İndirim ID", "Onaylanan İndirim Puanı", "İndirim Tutarı", "Karar", "Sonuç"/);
  assert.match(excel, /mutabakatRolSonucEtiketi\(kayit, rol\)/);
  assert.match(veri, /export function mutabakatRolSonucEtiketi/);
});

test("mutabakat onay SQL'i UTT, BM ve TM geçişlerini atomik ve sıralı tanımlar", () => {
  const sql = oku("scripts/sql/eczanem_mutabakat_onay_hiyerarsisi.sql");
  assert.match(sql, /CHECK \(onay_durumu IN \('utt_hazirliginda','bm_onayinda','tm_onayinda','onaylandi','tm_reddetti'\)\)/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.eczanem_mutabakat_bm_onayina_gonder/);
  assert.match(sql, /SET onay_durumu = 'bm_onayinda'/);
  assert.match(sql, /cardinality\(v_bm_idler\) IS DISTINCT FROM 1/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.eczanem_mutabakat_bm_karar_ver/);
  assert.match(sql, /FROM public\.eczanem_bm_mutabakat_kararlari k[\s\S]*?bm_karar_surumu = v_sonraki_surum/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.eczanem_mutabakat_tm_onayina_gonder/);
  assert.match(sql, /v_mutabakat\.bm_karar IS DISTINCT FROM 'onay'/);
  assert.match(sql, /SET onay_durumu = 'tm_onayinda'/);
  assert.match(sql, /cardinality\(v_tm_idler\) IS DISTINCT FROM 1/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.eczanem_mutabakat_tm_onayla/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.eczanem_mutabakat_tm_karar_ver/);
  assert.match(sql, /WHEN 'ret' THEN 'tm_reddetti'/);
  assert.match(sql, /FROM public\.eczanem_tm_mutabakat_kararlari k[\s\S]*?tm_karar_surumu = v_sonraki_surum/);
  assert.doesNotMatch(sql, /bm_karar_surumu = 0|tm_karar_surumu = 0/);
  assert.match(sql, /SET onay_durumu = 'onaylandi'/);
  assert.match(sql, /v_mutabakat\.onay_durumu <> 'utt_hazirliginda'/);
});

test("aynı onay durumu her role kendi süreç diliyle gösterilir", () => {
  assert.equal(mutabakatOnayDurumuEtiketi("utt", "bm_onayinda"), "BM Onayı Bekleniyor");
  assert.equal(mutabakatOnayDurumuEtiketi("utt", "tm_onayinda"), "TM Onayı Bekleniyor");
  assert.equal(mutabakatOnayDurumuEtiketi("utt", "onaylandi"), "Onaylandı");
  assert.equal(mutabakatOnayDurumuEtiketi("bm", "tm_onayinda"), "TM Onayı Bekleniyor");
  assert.equal(mutabakatOnayDurumuEtiketi("bm", "onaylandi"), "TM Onayladı");
  assert.equal(mutabakatOnayDurumuEtiketi("tm", "tm_onayinda"), "TM Onayınız Bekleniyor");
  assert.equal(mutabakatOnayDurumuEtiketi("tm", "tm_reddetti"), "Reddedildi");
});
