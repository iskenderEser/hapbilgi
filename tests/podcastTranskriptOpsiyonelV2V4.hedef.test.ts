import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ogrenmeAraciUretimAkisi } from "../lib/ogrenmeAraci/uretimAkisi.ts";
import type { PodcastTranskriptDurumu, PodcastTranskriptMetadata } from "../lib/ogrenmeAraci/tipler.ts";

const oku = (yol: string) => readFileSync(new URL(`../${yol}`, import.meta.url), "utf8");

test("Aşama 1 Veri Sözleşmesi: 8 transkript durumu ve metadata alanları eksiksiz tanımlıdır", () => {
  const durumlar: PodcastTranskriptDurumu[] = [
    "yok",
    "manuel_taslak",
    "ai_bekliyor",
    "ai_isleniyor",
    "ai_taslak",
    "onaylandi",
    "iptal",
    "hata",
  ];
  assert.equal(durumlar.length, 8);

  const ornekMeta: PodcastTranskriptMetadata = {
    durum: "yok",
    kaynak: null,
    taslak_metin: null,
    onaylanan_metin: null,
    onaylayan_kullanici_id: null,
    onay_tarihi: null,
    son_duzenleme_tarihi: null,
    surum: 1,
    bagli_ses_checksum: null,
    ai_girisim_id: null,
    kullanilan_model: null,
    hata_kodu: null,
  };
  assert.equal(ornekMeta.durum, "yok");
  assert.equal(ornekMeta.surum, 1);
});

test("Aşama 1 V2 ve V4 Akışları: hazır podcast transkriptten bağımsız doğru varyanta bağlanır", () => {
  const v2 = ogrenmeAraciUretimAkisi("podcast", true, false);
  assert.equal(v2.varyant, "V2");
  assert.equal(v2.hazirArac, true);
  assert.equal(v2.hazirSoruSeti, false);
  assert.equal(v2.ilkAdim, "hazir_arac_yukleme");
  assert.equal(v2.aracOnayiSonrasi, "soru_seti");

  const v4 = ogrenmeAraciUretimAkisi("podcast", true, true);
  assert.equal(v4.varyant, "V4");
  assert.equal(v4.hazirArac, true);
  assert.equal(v4.hazirSoruSeti, true);
  assert.equal(v4.ilkAdim, "hazir_arac_yukleme");
  assert.equal(v4.aracOnayiSonrasi, "yayin_yonetimi");
});

test("Aşama 1 Talep Formu ve Doğrulama: transkript alanı zorunlu olmaktan çıkarılmıştır ve tek editör kullanılır", () => {
  const talepAlanlari = oku("app/(panel)/talepler/_components/PodcastTalepAlanlari.tsx");
  assert.doesNotMatch(talepAlanlari, /<DosyaAlani etiket="Transkript"/);
  assert.match(talepAlanlari, /<PodcastTranskriptEditoru/);

  const hook = oku("app/(panel)/talepler/_hooks/useTalepFormu.ts");
  // Yalnızca ses dosyası yoksa hata vermeli
  assert.match(hook, /if \(hazirVideo && ogrenmeAraciTuru === "podcast" && !bekleyenPodcast\) \{/);
  // Transkript zorunluluğu hatası fırlatılmamalı
  assert.doesNotMatch(hook, /Hazır podcast talebi için podcast ve transkript dosyaları zorunludur/);
});

test("Aşama 1 Yükleme Yardımcısı: hazirPodcastYukle transkript olmadan da yüklemeyi tamamlar", () => {
  const yuklemeIstemci = oku("lib/ogrenmeAraci/bunnyYuklemeIstemci.ts");
  assert.doesNotMatch(yuklemeIstemci, /Podcast transkripti zorunludur/);
  assert.match(yuklemeIstemci, /\(dosya_rolu === "kapak" \|\| dosya_rolu === "transkript"\) && !dosya/);
});

test("Aşama 1 SQL RPC: uretim_podcast_dogrula transkript yokluğunu engellemez", () => {
  const sql = oku("scripts/sql/ogrenme_araclari_faz3_podcast_opsiyonel_transkript.sql");
  // Ses kontrolü korunur
  assert.match(sql, /Ses dosyası doğrulanmadan podcast tamamlanamaz/);
  // Transkript varsa doğrulanması şartı aranır
  assert.match(sql, /Eklenen transkript doğrulanmadan podcast tamamlanamaz/);
  // Transkript yokken doğrudan hata fırlatan eski kontrol bulunmaz
  assert.doesNotMatch(sql, /Ses ve transkript doğrulanmadan podcast tamamlanamaz/);
});

test("Aşama 1 Yayınlama Kapısı: yayinlar API'si transkript_yolu eksikliğiyle engellenmez", () => {
  const yayinlarRoute = oku("app/(panel)/yayin-yonetimi/api/yayinlar/route.ts");
  assert.doesNotMatch(yayinlarRoute, /!arac\.transkript_yolu/);
  assert.match(yayinlarRoute, /if \(arac\.arac_turu === "podcast" && Number\(arac\.sure_saniye\) <= 0\)/);
});

test("Aşama 1 Yarım Yükleme: başlatılmamış transkript yarım yükleme sayılmaz", () => {
  const yarimYuklemeler = oku("app/api/ogrenme-araclari/yarim-yuklemeler/route.ts");
  assert.match(yarimYuklemeler, /transkript_yarim/);

  const yarimBildirim = oku("components/ogrenme-araci/YarimYuklemeBildirimi.tsx");
  assert.match(yarimBildirim, /aktif\.transkript_yarim === true/);
});

test("Aşama 1 Erişim ve Oynatıcı: transkript yoksa null döner, oynatıcı transkript alanı açmaz", () => {
  const erisim = oku("app/api/ogrenme-araclari/[arac_id]/erisim/route.ts");
  assert.match(erisim, /transkript_metni/);
  assert.match(erisim, /transkript_url/);

  const oynatici = oku("components/ogrenme-araci/PodcastOynatici.tsx");
  // transkript_url veya metni yoksa link açılmaz
  assert.match(oynatici, /erisim\.transkript_url &&/);
});

test("Düzeltme 1 — Kapsam Ayrımı: İÜ zorunluluğu talep tercihine bağlıdır, hazır akışta transkript opsiyoneldir", () => {
  const sql = oku("scripts/sql/ogrenme_araclari_faz3_podcast_v1_v3_teslim.sql");
  // İÜ akışında tercih true ise onaylı AI metni, false ise yalnız doğrulanmış ses aranır.
  assert.match(sql, /IF v_transkript_istendi THEN/);
  assert.match(sql, /COALESCE\(v_transkript->>'kaynak', ''\) <> 'ai'/);
  assert.doesNotMatch(sql, /v_arac\.transkript_yolu IS NULL/);
  // Hazır akışta opsiyonel ama eklenmişse doğrulanma şartı
  assert.match(sql, /Hazır podcast \(V2\/V4\): Transkript opsiyoneldir/);

  const istemci = oku("lib/ogrenmeAraci/bunnyYuklemeIstemci.ts");
  // İÜ transkripti fiziksel dosya değildir; tercih varsa AI akışında üretilir.
  assert.match(istemci, /const transkriptGerekli = false;/);
});

test("Düzeltme 2 — İstemciden Durum Kabul Etmeme: podcast-dogrula istemciden transkript_durumu almaz, sahte onay üretmez", () => {
  const istemci = oku("lib/ogrenmeAraci/bunnyYuklemeIstemci.ts");
  // bunnyYuklemeIstemci podcast-dogrula rotasına transkript_durumu göndermez
  assert.doesNotMatch(istemci, /transkript_durumu:/);

  const route = oku("app/api/ogrenme-araclari/[arac_id]/podcast-dogrula/route.ts");
  // body.transkript_durumu kabul edilmez
  assert.doesNotMatch(route, /body\.transkript_durumu/);
  // Teslim rotası istemciden metin veya onay beyanı almaz; kalıcı sunucu kaydını denetler.
  assert.doesNotMatch(route, /body\.transkript_metni/);
  assert.match(route, /podcastIuTeslimKapisiDogrula/);
});

test("Düzeltme 3 — Transkript Erişimini Koruma: Yalnız onaylı transkript döner, taslak ve hassas alanlar sanitize edilir", () => {
  const erisim = oku("app/api/ogrenme-araclari/[arac_id]/erisim/route.ts");
  // Yalnızca transkriptObj.durum === "onaylandi" ise döner
  assert.match(erisim, /if \(transkriptObj\.durum === "onaylandi"\)/);
  // Diğer durumlarda transkriptUrl ve transkriptMetni null yapılır
  assert.match(erisim, /transkriptUrl = null;\s*transkriptMetni = null;/);
  // Eski kayıtlarda transkript_dogrulandi kontrol edilir
  assert.match(erisim, /const eskiDogrulandi = metadata\.transkript_dogrulandi === true;/);
  // Tüketiciye sızdırılmaması gereken taslak ve iç alanlar sanitize edilir
  assert.match(erisim, /taslak_metin: _taslakMetin/);
  assert.match(erisim, /ai_girisim_id: _aiGirisimId/);
  assert.match(erisim, /hata_kodu: _hataKodu/);
  assert.match(erisim, /onaylayan_kullanici_id: _onaylayanKullaniciId/);
  assert.match(erisim, /metadata: temizMetadata/);
});
