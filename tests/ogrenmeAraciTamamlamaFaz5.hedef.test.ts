import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const oku = (yol: string) => readFileSync(new URL(`../${yol}`, import.meta.url), "utf8");
const erisim = oku("app/api/ogrenme-araclari/[arac_id]/erisim/route.ts");
const podcast = oku("components/ogrenme-araci/PodcastOynatici.tsx");
const podcastIlerleme = oku("app/api/ogrenme-araclari/podcast-ilerleme/route.ts");
const gorsel = oku("components/ogrenme-araci/GorselOynatici.tsx");
const gorselTamamla = oku("app/api/ogrenme-araclari/gorsel-tamamla/route.ts");
const flip = oku("components/ogrenme-araci/FlipPdfOynatici.tsx");
const flipIlerleme = oku("app/api/ogrenme-araclari/flip-pdf-ilerleme/route.ts");
const eclubBaslat = oku("app/(panel)/eclub/panel/api/baslat/route.ts");
const eclubBitir = oku("app/(panel)/eclub/panel/api/bitir/route.ts");
const eclubSorular = oku("app/(panel)/eclub/panel/api/sorular/route.ts");
const eclubCevapla = oku("app/(panel)/eclub/panel/api/cevapla/route.ts");
const eczanemListe = oku("app/eczanem/api/videolar/route.ts");
const eczanemBitir = oku("app/eczanem/api/izleme/bitir/route.ts");
const eczanemRaf = oku("app/eczanem/_components/EczanemVideoRafi.tsx");
const talepFormu = oku("app/(panel)/talepler/_components/YeniTalepFormV2.tsx");
const uttListe = oku("lib/utils/anaSayfa/utt.ts");
const bmListe = oku("app/(panel)/challenge-club/api/route.ts");
const eclubListe = oku("app/(panel)/eclub/panel/api/route.ts");
const videoOynatici = oku("components/izle/VideoOynatici.tsx");

test("UTT ve KD_UTT erişimi aktif kullanıcı, firma, takım, hedef rol ve öneri bağıyla sınırlıdır", () => {
  for (const kural of ["aktif_mi", "firma?.aktif", "detay.takim_id", "hedefRolleriOku(yayin)", "oneri.kullanici_id === user.id", "oneri.yayin_id === yayin.yayin_id"]) assert.match(erisim, new RegExp(kural.replace(/[?.()]/g, "\\$&")));
});

test("BM erişimi aktif firma, C-Club ve challenge sahipliğiyle sınırlıdır", () => {
  assert.match(erisim, /rol !== "bm" \|\| firma\.cc_aktif/);
  assert.match(erisim, /challenge\.alan_id === user\.id/);
  assert.match(erisim, /challenge\.yayin_id === yayin\.yayin_id/);
});

test("Eczacı ve teknisyen erişimi aktif E-Club firma, hedef rol ve öneri bağıyla doğrulanır", () => {
  assert.match(erisim, /eclubKisiErisimi/);
  assert.match(erisim, /kisiErisimi\.eclub_aktif/);
  assert.match(erisim, /firmaIdler\.has\(detay\.firma_id\)/);
  assert.match(erisim, /oneri\.kisi_id === kisi\.kisi_id/);
  assert.match(eclubBaslat, /Yayın aktif E-Club firma bağlantınıza ait değil/);
});

test("Müşteri erişimi kesin gönderim ve aktif üyelik üzerinden doğrulanır", () => {
  assert.match(erisim, /\.eq\("gonderim_id", bagId\)/);
  assert.match(erisim, /gonderim\.musteri_id === kimlik\.musteriId/);
  assert.match(erisim, /aktifGonderimUyeliginiDogrula/);
  assert.match(eczanemBitir, /aktifGonderimUyeliginiDogrula/);
});

test("Eczanem oynatıcı bağlantısı yayın yerine kesin gonderim_id taşır", () => {
  assert.match(eczanemListe, /gonderim_id: g\.gonderim_id/);
  assert.match(oku("app/eczanem/_components/EczanemVideoOynatici.tsx"), /bagId=\{video\.gonderim_id\}/);
});

test("Aynı yayının farklı gönderimleri gönderim bazında ayrı tutulur", () => {
  assert.match(eczanemListe, /izlemeDurumu\.get\(g\.gonderim_id\)/);
  assert.match(eczanemRaf, /key=\{`\$\{baslik\}-\$\{video\.gonderim_id\}`\}/);
  assert.doesNotMatch(eczanemListe, /new Map\(rows\.map\(\(g\) => \[g\.yayin_id/);
});

test("Podcast ileri sarma, doğrulanmış süre, tamamlama ve soru kapılarını uygular", () => {
  assert.match(podcast, /ileriSarmaAcik = false/);
  assert.match(podcast, /audio\.currentTime > izinliKonumRef\.current \+ 2/);
  assert.match(podcastIlerleme, /sunucuLimiti/);
  assert.match(podcastIlerleme, /PODCAST_ARACI\.tamamlanabilirMi/);
  for (const route of [eclubBitir, eczanemBitir]) assert.match(route, /tamamlamaKanitiDogrula\("podcast"/);
});

test("Görsel yalnız aktif sekme süresi ve kullanıcı onayıyla tamamlanır", () => {
  assert.match(gorsel, /document\.visibilityState === "visible"/);
  assert.match(gorsel, /Math\.min\(1\.5/);
  assert.match(gorselTamamla, /body\.sekme_aktif !== true/);
  assert.match(gorselTamamla, /body\.kullanici_onayi !== true/);
  assert.match(gorselTamamla, /baslangictanBeri < 3/);
});

test("Flip PDF yakınlaştırma, mobil sayfa düzeni, sayfa süresi ve tamamlanma şartını uygular", () => {
  assert.match(flip, /Math\.max\(0\.6/);
  assert.match(flip, /Math\.min\(2/);
  assert.match(flip, /matchMedia\("\(min-width: 768px\)"\)/);
  assert.match(flip, /okunanSayisi < belge\.numPages/);
  assert.match(flipIlerleme, /kalanArtis/);
  assert.match(flipIlerleme, /Bütün PDF sayfaları okunmadan tamamlanamaz/);
});

test("Süresi dolmuş öneri ve pasif E-Club bağlantısı soru veya puan üretemez", () => {
  assert.match(eclubBitir, /eclubAktifYayinYetkisi/);
  assert.match(eclubSorular, /Süresi geçmiş öneride soru gösterilmez/);
  assert.match(eclubCevapla, /Süresi geçmiş öneride soru cevaplanamaz/);
  for (const route of [eclubSorular, eclubCevapla]) assert.match(route, /eclubAktifYayinYetkisi/);
});

test("Devre dışı araçlar talep formunda ve tüm tüketim listelerinde gizlenir", () => {
  assert.match(talepFormu, /filter\(\(tur\) => formu\.ogrenmeAraciBayraklari\[tur\]\)/);
  for (const kaynak of [uttListe, bmListe, eclubListe, eczanemListe]) {
    assert.match(kaynak, /ogrenmeAraciBayraklari/);
    assert.match(kaynak, /\.in\("arac_turu"/);
  }
});

test("Yeni araç dalları mevcut video oynatma davranışını değiştirmez", () => {
  assert.match(videoOynatici, /createVideoPlayer/);
  assert.match(videoOynatici, /!\(\["podcast", "gorsel", "flip_pdf"\]\.includes\(video\.arac_turu \?\? "video"\)\)/);
  assert.match(videoOynatici, /video\.video_url/);
});
