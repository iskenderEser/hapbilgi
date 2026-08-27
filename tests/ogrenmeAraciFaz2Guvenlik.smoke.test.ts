import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const oku = (yol: string) => readFileSync(yol, "utf8");
const baslat = oku("app/api/ogrenme-araclari/yukleme-baslat/route.ts");
const tamamla = oku("app/api/ogrenme-araclari/yukleme-tamamla/route.ts");
const erisim = oku("app/api/ogrenme-araclari/[arac_id]/erisim/route.ts");
const durum = oku("app/api/ogrenme-araclari/[arac_id]/durum/route.ts");
const bunny = oku("lib/ogrenmeAraci/bunnyStorage.ts");
const edge = oku("infra/bunny/ogrenme-araci-upload/index.ts");
const bayraklar = oku("lib/ogrenmeAraci/bayraklar.ts");

test("yeni araçlar varsayılan kapalı, video varsayılan açıktır", () => {
  assert.match(bayraklar, /OGRENME_ARACI_VIDEO_AKTIF, true/);
  assert.match(bayraklar, /OGRENME_ARACI_PODCAST_AKTIF, false/);
  assert.match(bayraklar, /OGRENME_ARACI_GORSEL_AKTIF, false/);
  assert.match(bayraklar, /OGRENME_ARACI_FLIP_PDF_AKTIF, false/);
});

test("Storage anahtarları istemciye ve NEXT_PUBLIC alanına açılmaz", () => {
  const tumKaynak = [baslat, tamamla, erisim, durum, bunny, edge].join("\n");
  assert.doesNotMatch(tumKaynak, /NEXT_PUBLIC_BUNNY_LEARNING/);
  assert.doesNotMatch(baslat, /STORAGE_ACCESS_KEY|AccessKey/);
  assert.doesNotMatch(erisim, /STORAGE_ACCESS_KEY|AccessKey/);
  assert.match(edge, /process\.env\.STORAGE_ACCESS_KEY/);
  assert.match(edge, /headers: \{ AccessKey: storageAccessKey/);
});

test("yükleme yetkisi kullanıcı, araç, yol, MIME, boyut, checksum ve süreye bağlıdır", () => {
  for (const alan of ["aracId", "kullaniciId", "dosyaYolu", "dosyaBoyutu", "mimeType", "checksumSha256", "sonKullanma"]) {
    assert.match(bunny, new RegExp(alan));
  }
  assert.match(bunny, /createHmac\("sha256", ortam\.uploadSharedSecret\)/);
  assert.match(edge, /crypto\.subtle\.sign\("HMAC"/);
  assert.match(edge, /sonKullanma < Math\.floor\(Date\.now\(\) \/ 1000\)/);
  assert.match(edge, /gercekBoyut !== dosyaBoyutu/);
  assert.match(edge, /Checksum: checksumSha256/);
});

test("nesne yolu sunucuda üretilir ve Edge path traversal'ı reddeder", () => {
  assert.match(baslat, /bunnyNesneYoluOlustur\(/);
  assert.doesNotMatch(baslat, /body\.dosya_yolu/);
  assert.match(edge, /!yol\.includes\("\.\."\)/);
  assert.match(edge, /!yol\.includes\("\\\\"\)/);
});

test("yükleme tamamlama gerçek boyut, imza ve checksum doğrulamasından sonra ilerler", () => {
  assert.match(tamamla, /nesne\.dosyaBoyutu !== beyan\.dosya_boyutu/);
  assert.match(tamamla, /dosyaImzasiDogrula\(arac\.arac_turu, nesne\.ilkBaytlar\)/);
  assert.match(tamamla, /nesne\.checksumSha256 !== beyanChecksum/);
  assert.match(tamamla, /durum: "dogrulama_bekliyor"/);
  assert.match(tamamla, /metadata_dogrulandi: false/);
});

test("durum ve erişim API'leri sahiplik ve hedef bağını sunucuda sınar", () => {
  assert.match(durum, /uretimAraciYetkisiniDogrula/);
  assert.match(erisim, /uretimAraciYetkisiniDogrula/);
  assert.match(erisim, /hedefRolleriOku\(yayin\)/);
  assert.match(erisim, /eclub_oneri_kayitlari/);
  assert.match(erisim, /aktifGonderimUyeliginiDogrula/);
  assert.match(erisim, /Cache-Control": "private, no-store/);
});

test("medya Vercel ve Git paketlerinden dışlanır", () => {
  const vercelIgnore = oku(".vercelignore");
  const gitIgnore = oku(".gitignore");
  const tsconfig = oku("tsconfig.json");
  assert.match(vercelIgnore, /\/media/);
  assert.match(vercelIgnore, /\/uploads/);
  assert.match(vercelIgnore, /\/public\/ogrenme-araclari-medya/);
  assert.match(gitIgnore, /\/media/);
  assert.match(gitIgnore, /\/uploads/);
  assert.match(gitIgnore, /\/infra\/\*\*\/node_modules\//);
  assert.match(tsconfig, /"infra"/);
});
