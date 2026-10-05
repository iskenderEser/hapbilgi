import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PANEL_NAV, type NavContext } from "@/components/panel/panelNav.config";

const oku = (yol: string) => readFileSync(yol, "utf8");
const sayfa = oku("app/(panel)/eclub/yayinlar/page.tsx");
const bm = oku("app/(panel)/eclub/yayinlar/_components/BmEclubYayinlari.tsx");
const api = oku("app/(panel)/eclub/yayinlar/api/bm/route.ts");
const kart = oku("app/(panel)/eclub/yayinlar/_components/EclubYayinGonderimKarti.tsx");

const baglam: NavContext = { rolKucu: "bm", storeAcik: true, ccAcik: true, eclubAcik: true, eclubStoreAcik: true, eczanemAcik: true };

test("BM sidebar'da E-Club Yayınları sekmesini görür", () => {
  const eclub = PANEL_NAV.find((grup) => grup.baslik === "E-Club");
  assert.ok(eclub?.oglar.some((oge) => oge.path === "/eclub/yayinlar" && oge.gate(baglam)));
});

test("aynı rota BM ve UTT görünümünü rol üzerinden ayırır", () => {
  assert.match(sayfa, /toLowerCase\(\) === "bm"/);
  assert.match(sayfa, /<BmEclubYayinlari \/>/);
  assert.match(sayfa, /<UttEclubVideolarimPage \/>/);
});

test("BM API yalnız oturum BM'sinin bölge kapsamındaki UTT'yi kabul eder", () => {
  assert.match(api, /eclubYonetimKapsaminiGetir\(admin, kullanici\)/);
  assert.match(api, /kapsam\.uttler\.find\(\(utt\) => utt\.utt_id === istenenUttId\)/);
  assert.match(api, /Seçilen UTT, yönetim kapsamında değildir/);
  assert.match(api, /bag\.firmaId === kullanici\.firma_id/);
  assert.doesNotMatch(api, /export async function (?:POST|PUT|PATCH|DELETE)/);
});

test("BM sayfası onaylanan UTT sayfası yapısını ve UTT filtresini korur", () => {
  for (const metin of ["Eczacılar", "Eczane Teknisyenleri", "Eczacı ve Eczane Teknisyeni", "Gönderime Hazır", "Gönderilenler", "İzleyenler", "Bekleyenler", "İzlemeyenler"]) {
    assert.match(`${bm}\n${oku("app/(panel)/eclub/yayinlar/_components/EclubGonderimDetayKarti.tsx")}`, new RegExp(metin));
  }
  assert.match(bm, /filtreliUttler\.map/);
  assert.match(bm, /void veriCek\(uttId\)/);
  assert.match(bm, /UttYayinTuruToggle/);
  assert.match(bm, /EclubYayinGonderimKarti/);
});

test("bölge statları UTT seçimine bağlı olmayan bölge gönderim kümesini kullanır", () => {
  assert.match(api, /\.in\("oneren_id", uttIdler\)/);
  assert.match(api, /bolge_gonderilen_yayin_idleri/);
  assert.match(bm, /bolgeGonderilenler/);
  assert.match(bm, /Bölgede yayındaki toplam yayın/);
});

test("BM yayın ve alıcı gönderemez; ortak kart UTT'de varsayılan davranışını korur", () => {
  assert.match(bm, /secimGoster=\{false\}/);
  assert.doesNotMatch(bm, /oneriGonder|Gönderiliyor|method:\s*"POST"/);
  assert.match(kart, /secimGoster = true/);
  assert.match(kart, /secimGoster && \(secilebilir \|\| gonderilecekGoster\)/);
});
