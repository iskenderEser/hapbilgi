import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const oku = (yol: string) => readFileSync(new URL(`../${yol}`, import.meta.url), "utf8");

const sql = oku("scripts/sql/yarim_ogrenme_araci_yuklemeleri.sql");
const videoBaslat = oku("app/(panel)/talepler/api/bunny-yukleme-baslat/route.ts");
const tus = oku("lib/video/bunnyTusIstemci.ts");
const ortakApi = oku("app/api/ogrenme-araclari/yarim-yuklemeler/route.ts");
const modal = oku("components/ogrenme-araci/YarimYuklemeBildirimi.tsx");
const storageBaslat = oku("app/api/ogrenme-araclari/yukleme-baslat/route.ts");

test("PM-04/A video kesintisi aynı oturum ve TUS aktarımıyla sürer; iptal tam temizlikten sonra bildirilir", () => {
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.ogrenme_araci_video_yukleme_oturumlari/);
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS uq_video_yukleme_aktif_talep/);
  assert.match(videoBaslat, /\.from\("ogrenme_araci_video_yukleme_oturumlari"\)[\s\S]*\.eq\("talep_id", talep_id\)[\s\S]*bunnyYuklemeIzniniYenile/);
  assert.match(videoBaslat, /Devam için yarım kalan yüklemedeki aynı video dosyasını seçmelisiniz/);
  assert.match(tus, /findPreviousUploads\(\)[\s\S]*resumeFromPreviousUpload\(ayniVideo\)/);
  assert.match(ortakApi, /body\.islem === "aktarim_tamamlandi"[\s\S]*durum: "dogrulama_bekliyor"/);
  assert.match(ortakApi, /await bunnyVideoSil\(kayit\.video_guid\)[\s\S]*\.delete\(\)\.eq\("yukleme_id"/);
  assert.match(modal, /const videoDevam[\s\S]*bunnyTusYukle/);
  assert.match(modal, /aktif\.arac_turu === "video"[\s\S]*Video dosyası/);
  assert.match(modal, /basari\(sonuc\.mesaj \?\? "Yarım kalan yükleme başarıyla iptal edildi\."\)/);
});

test("PM-04/B Literatür PDF kesintisi aynı arac_id ile sürer; Bunny temizlenmeden atomik DB iptali yapılmaz", () => {
  assert.match(storageBaslat, /const mevcutAracId[\s\S]*const yarimYukleme/);
  assert.match(storageBaslat, /oncekiBeyan\.checksum_sha256[\s\S]*checksum_sha256\.toLowerCase\(\)/);
  assert.match(storageBaslat, /arac_id: mevcutAracId[\s\S]*arac_durum_id: sonDurum\.arac_durum_id/);
  assert.match(modal, /aktif\.arac_turu === "flip_pdf"[\s\S]*Literatür PDF/);
  assert.match(modal, /hazirFlipPdfYukle\(\{[\s\S]*aracId: kayit\.arac_id/);
  const storageIptal = ortakApi.slice(ortakApi.indexOf("const metadata = (arac.metadata"));
  assert.ok(storageIptal.indexOf("bunnyStorageNesneSil") < storageIptal.indexOf('db.rpc("ogrenme_araci_yarim_yukleme_iptal"'));
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.ogrenme_araci_yarim_yukleme_iptal[\s\S]*FOR UPDATE[\s\S]*DELETE FROM public\.ogrenme_araci_durumu[\s\S]*DELETE FROM public\.ogrenme_araclari/);
  assert.match(modal, /setYuklemeler\(\(liste\) => liste\.filter\(\(x\) => x\.kimlik !== aktif\.kimlik\)\)[\s\S]*basari/);
});
