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
const storageTamamla = oku("app/api/ogrenme-araclari/yukleme-tamamla/route.ts");
const podcastDestekTamamla = oku("app/api/ogrenme-araclari/[arac_id]/destek-yukleme-tamamla/route.ts");
const podcastDogrula = oku("app/api/ogrenme-araclari/[arac_id]/podcast-dogrula/route.ts");

test("PM-03/A video kesintisi devam ettirilmez; yeni deneme yeni GUID ile doğrudan başlar", () => {
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.ogrenme_araci_video_yukleme_oturumlari/);
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS uq_video_yukleme_aktif_talep/);
  assert.match(videoBaslat, /eskiOturumlar[\s\S]*bunnyVideoSil\(eski\.video_guid\)[\s\S]*\.delete\(\)[\s\S]*bunnyYuklemeBaslat\(baslik\)/);
  assert.doesNotMatch(videoBaslat, /bunnyYuklemeIzniniYenile|Devam için yarım kalan yüklemedeki aynı video/);
  assert.match(tus, /metadata: \{ filetype: dosya\.type, title: izin\.baslik \}/);
  assert.match(tus, /yukleme\.start\(\)/);
  assert.doesNotMatch(tus, /fingerprint|findPreviousUploads|resumeFromPreviousUpload/);
  assert.match(ortakApi, /durum\.bunnyDurum < 0/);
  assert.match(ortakApi, /body\.islem === "aktarim_tamamlandi"[\s\S]*durum: "dogrulama_bekliyor"/);
  assert.match(ortakApi, /await bunnyVideoSil\(kayit\.video_guid\)[\s\S]*\.delete\(\)\.eq\("yukleme_id"/);
  assert.match(ortakApi, /Video aktarımı kullanıcı tarafından devam ettirilmez/);
  assert.doesNotMatch(modal, /videoDevam|bunnyTusYukle|Video dosyası|arac_turu:\s*"video"/);
  assert.match(modal, /basari\(sonuc\.mesaj \?\? "Yarım kalan yükleme başarıyla iptal edildi\."\)/);
});

test("PM-03/B Literatür kesintisi aynı arac_id ile sürer; Bunny temizlenmeden atomik DB iptali yapılmaz", () => {
  assert.match(storageBaslat, /const mevcutAracId[\s\S]*const yarimYukleme/);
  assert.match(storageBaslat, /oncekiBeyan\.checksum_sha256[\s\S]*checksum_sha256\.toLowerCase\(\)/);
  assert.match(storageBaslat, /arac_id: mevcutAracId[\s\S]*arac_durum_id: sonDurum\.arac_durum_id/);
  assert.match(modal, /aktif\.arac_turu === "flip_pdf"[\s\S]*Literatür/);
  assert.match(modal, /hazirFlipPdfYukle\(\{[\s\S]*aracId: kayit\.arac_id/);
  const storageIptal = ortakApi.slice(ortakApi.indexOf("const metadata = (arac.metadata"));
  assert.ok(storageIptal.indexOf("bunnyStorageNesneSil") < storageIptal.indexOf('db.rpc("ogrenme_araci_yarim_yukleme_iptal"'));
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.ogrenme_araci_yarim_yukleme_iptal[\s\S]*FOR UPDATE[\s\S]*DELETE FROM public\.ogrenme_araci_durumu[\s\S]*DELETE FROM public\.ogrenme_araclari/);
  assert.match(modal, /setYuklemeler\(\(liste\) => liste\.filter\(\(x\) => x\.kimlik !== aktif\.kimlik\)\)[\s\S]*basari/);
});

test("PM-03/C Podcast devamında tamamlanmış ses, kapak ve transkript yeniden yüklenmez", () => {
  const istemci = oku("lib/ogrenmeAraci/bunnyYuklemeIstemci.ts");
  assert.match(storageBaslat, /tamamlananParcalar\.push\("ana"\)/);
  assert.match(storageBaslat, /mevcut\.kapak_yolu[\s\S]*tamamlananParcalar\.push\("kapak"\)/);
  assert.match(storageBaslat, /mevcut\.transkript_yolu[\s\S]*tamamlananParcalar\.push\("transkript"\)/);
  assert.match(istemci, /const tamamlananParcalar = new Set[\s\S]*!tamamlananParcalar\.has\("ana"\)/);
  assert.match(istemci, /tamamlananParcalar\.has\(dosya_rolu\)\) continue/);
  assert.match(ortakApi, /tamamlanan_parcalar: tamamlananParcalar[\s\S]*podcast_sure_hazir[\s\S]*podcast_transkript_bilgisi_hazir/);
  assert.match(modal, /podcastSesGerekli && dosyaSecici\("ana", "Podcast ses dosyası"/);
  assert.match(modal, /podcastKapakGerekli && dosyaSecici\("kapak", "Yayın Görseli \(isteğe bağlı\)"/);
  assert.match(modal, /podcastTranskriptGerekli && dosyaSecici\("transkript", "Podcast transkripti"/);
  assert.doesNotMatch(modal, /if \(!dosyalar\.kapak \|\| !dosyalar\.transkript\)/);
  assert.match(modal, /tamamlananParcalar: kayit\.tamamlanan_parcalar/);
  assert.match(storageTamamla, /sure_saniye_beyani: sureSaniye/);
  assert.match(podcastDestekTamamla, /bunnyStorageNesneIndir\(body\.dosya_yolu\)[\s\S]*transkriptDosyasindanMetinCikar\(karar\.uzanti, dosyaBaytlari\)/);
  assert.match(podcastDestekTamamla, /durum:\s*"manuel_taslak"/);
  assert.match(podcastDestekTamamla, /onaylanan_metin:\s*null/);
  assert.match(podcastDogrula, /kayitliSure[\s\S]*podcastIuTeslimKapisiDogrula[\s\S]*podcast_dogrulama_islem_anahtari[\s\S]*p_islem_anahtari: islemAnahtari/);
  assert.match(storageBaslat, /delete yenilenenMetadata\.podcast_dogrulama_islem_anahtari/);
});

test("PM-03/D Dijital Broşür aynı arac_id ile tamamlanır ve ortak iptal temizliğini kullanır", () => {
  const istemci = oku("lib/ogrenmeAraci/bunnyYuklemeIstemci.ts");
  assert.match(modal, /aktif\.arac_turu === "gorsel"[\s\S]*Dijital broşür/);
  assert.match(modal, /hazirGorselYukle\(\{[\s\S]*aracId: kayit\.arac_id/);
  assert.match(istemci, /hazirGorselYukle[\s\S]*tamamlanan_parcalar\?\.includes\("ana"\)/);
  assert.match(ortakApi, /arac\.dosya_yolu, arac\.kapak_yolu, arac\.transkript_yolu[\s\S]*bunnyStorageNesneSil/);
});

test("Aşama 2 Doğrulamaları: Tek transkript alanı ve kaynağa göre transkript yetkisi", () => {
  const talepAlanlari = oku("app/(panel)/talepler/_components/PodcastTalepAlanlari.tsx");
  // Formda eski DosyaAlani Transkript bulunmaz, yalnızca tek transkript alanı (PodcastTranskriptEditoru) bulunur
  assert.doesNotMatch(talepAlanlari, /<DosyaAlani etiket="Transkript"/);
  assert.match(talepAlanlari, /<PodcastTranskriptEditoru/);

  const transkriptYonet = oku("app/api/ogrenme-araclari/[arac_id]/transkript-yonet/route.ts");
  assert.match(transkriptYonet, /podcastTranskriptYetkisiDogrula/);
  assert.match(transkriptYonet, /if \(yetki\.kaynak === "iu"\)/);
  assert.match(transkriptYonet, /mevcutTranskript\.kaynak !== "ai"/);
  assert.match(transkriptYonet, /if \(yetki\.kaynak === "hazir"\)/);
});
