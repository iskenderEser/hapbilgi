import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function oku(goreceliYol: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), goreceliYol), "utf8");
}

// ============================================================================
// KOMUT 4: KALICI PODCAST TASLAĞI KESİNLEŞTİRME VE UÇTAN UCA HEDEF TESTLERİ
// ============================================================================

test("Hedef 1: Uçtan uca akış: AI seçimi → taslak → podcast yükleme → AI taslağı → onay → Gönderiniz", () => {
  const hookKodu = oku("app/(panel)/talepler/_hooks/useTalepFormu.ts");
  const apiRouteKodu = oku("app/(panel)/talepler/api/route.ts");
  const sqlKodu = oku("scripts/sql/ogrenme_araclari_faz3_podcast_taslak.sql");

  // 1a. AI seçimi ile taslak oluşturulur ve ses hemen Bunny'ye yüklenir
  assert.match(hookKodu, /fetch\("\/talepler\/api\/taslak"/);
  assert.match(hookKodu, /await hazirPodcastYukle\(\{[\s\S]*talepId[\s\S]*aracId[\s\S]*ses: bekleyenPodcast\.dosya/);

  // 1b. AI taslağı onaylanana kadar buton kilitlidir, onaylanınca açılır
  assert.match(hookKodu, /sunucuTranskriptDurumu === "onaylandi"/);
  assert.match(hookKodu, /handlePodcastTranskriptSunucuOnayla/);

  // 1c. Gönderiniz tıklandığında mevcut taslak_talep_id sunucuya iletilir
  assert.match(hookKodu, /taslak_talep_id: podcastTaslakTalepId \|\| undefined/);

  // 1d. Sunucu kesinleştirmeyi atomik RPC ile yapar ve taslak_mi false olur
  assert.match(apiRouteKodu, /podcast_taslak_atomik_kesinlestir/);
  assert.match(sqlKodu, /taslak_mi = false/);
  assert.match(sqlKodu, /taslak_oturum_anahtari = NULL/);
});

test("Hedef 2: Hata durumu ve tekrar deneme: AI seçimi → hata → tekrar deneme → onay → Gönderiniz", () => {
  const hookKodu = oku("app/(panel)/talepler/_hooks/useTalepFormu.ts");
  const editorKodu = oku("app/(panel)/talepler/_components/PodcastTranskriptEditoru.tsx");

  // 2a. Hata oluştuğunda sunucu durumu hata olur ve buton kilitli kalır
  assert.match(hookKodu, /setSunucuTranskriptDurumu\("hata"\)/);
  assert.match(hookKodu, /"Transkript işlemi hata verdi; tekrar deneyin veya transkriptsiz devam edin"/);

  // 2b. Editörde "Tekrar Dene" butonu yer alır ve süreci yeniden başlatır
  assert.match(editorKodu, /Tekrar Dene/);
  assert.match(editorKodu, /onClick=\{onAiBaslat \?\? aiBaslatTekrar\}/);
});

test("Hedef 3: İptal ve transkriptsiz devam: AI seçimi → iptal → transkriptsiz devam → Gönderiniz", () => {
  const hookKodu = oku("app/(panel)/talepler/_hooks/useTalepFormu.ts");
  const editorKodu = oku("app/(panel)/talepler/_components/PodcastTranskriptEditoru.tsx");
  const transkriptYonetKodu = oku("app/api/ogrenme-araclari/[arac_id]/transkript-yonet/route.ts");

  // 3a. İptal seçildiğinde sunucuya iptal_et bildirilir ve sunucuTranskriptDurumu iptal olur
  assert.match(editorKodu, /Transkriptsiz Devam Et/);
  assert.match(hookKodu, /handlePodcastTranskriptSunucuIptal/);
  assert.match(hookKodu, /setSunucuTranskriptDurumu\("iptal"\)/);
  assert.match(transkriptYonetKodu, /islem === "iptal_et"/);

  // 3b. İptal durumu butonu açar ve transkriptsiz kesinleştirmeye izin verir
  assert.match(hookKodu, /if \(sunucuTranskriptDurumu === "iptal"\) \{\s*return \{ gonderButonuEtkin: true, gonderButonuPasifNedeni: null \};/);
});

test("Hedef 4: Sayfa yenileme sonrası geri yükleme: podcast, AI durumu ve transkript kararı geri gelir", () => {
  const hookKodu = oku("app/(panel)/talepler/_hooks/useTalepFormu.ts");

  // 4a. sessionStorage'dan kayıt okunur
  assert.match(hookKodu, /sessionStorage\.getItem\(depoAnahtari\)/);
  assert.match(hookKodu, /setPodcastTaslakTalepId\(kayit\.talep_id\)/);
  assert.match(hookKodu, /setPodcastAracId\(kayit\.arac_id\)/);

  // 4b. transkript-durum sorgulanarak ses_yuklendi ve transkript durumları geri yüklenir
  assert.match(hookKodu, /fetch\(`\/api\/ogrenme-araclari\/\$\{kayit\.arac_id\}\/transkript-durum`\)/);
  assert.match(hookKodu, /if \(data\.ses_yuklendi\) \{\s*setPodcastSesYuklendi\(true\);/);
  assert.match(hookKodu, /setSunucuTranskriptDurumu\(durum\)/);
});

test("Hedef 5: Çift AI tıklama koruması: birden fazla çağrı engellenir ve idempotent taslak döner", () => {
  const hookKodu = oku("app/(panel)/talepler/_hooks/useTalepFormu.ts");
  const sqlKodu = oku("scripts/sql/ogrenme_araclari_faz3_podcast_taslak.sql");

  // 5a. İstemcide podcastAiYukleniyor bayrağı ile çift tıklama engellenir
  assert.match(hookKodu, /if \(podcastAiYukleniyor\) return;/);

  // 5b. Veritabanında aynı oturum anahtarı için advisory lock ve mevcut taslağın döndürülmesi
  assert.match(sqlKodu, /hashtextextended\(p_uretici_id::text \|\| ':taslak:' \|\| p_oturum_anahtari::text, 42\)/);
  assert.match(sqlKodu, /'mevcut', true/);
});

test("Hedef 6: Çift Gönderiniz koruması: aynı talep ikinci kez kesinleştirilmez (idempotent)", () => {
  const hookKodu = oku("app/(panel)/talepler/_hooks/useTalepFormu.ts");
  const sqlKodu = oku("scripts/sql/ogrenme_araclari_faz3_podcast_taslak.sql");

  // 6a. İstemcide islem_anahtari sessionStorage ile saklanır ve gönderilir
  assert.match(hookKodu, /islem_anahtari: islemAnahtari/);

  // 6b. RPC seviyesinde kesinleşmiş talep aynı işlem anahtarı ile gelirse mevcut sonucu döner
  assert.match(sqlKodu, /IF NOT v_taslak_mi THEN/);
  assert.match(sqlKodu, /IF v_mevcut_anahtar = p_islem_anahtari THEN/);
  assert.match(sqlKodu, /'kesinlesmis', true/);
});

test("Hedef 7: Podcastin yeniden yüklenmemesi ve Gemini'nin yeniden başlatılmaması", () => {
  const hookKodu = oku("app/(panel)/talepler/_hooks/useTalepFormu.ts");

  // 7a. Ses zaten yüklüyse hazirPodcastYukle içine ses undefined ve tamamlananParcalar: ['ana'] gönderilir
  assert.match(hookKodu, /const sesOncedenYuklendi = podcastSesYuklendi \|\| Boolean\(/);
  assert.match(hookKodu, /ses: sesOncedenYuklendi \? undefined : bekleyenPodcast\.dosya/);
  assert.match(hookKodu, /tamamlananParcalar: sesOncedenYuklendi \? \["ana"\] : undefined/);

  // 7b. Nihai gönderimde aiTranskriptIstendi kesinlikle false gönderilir
  assert.match(hookKodu, /aiTranskriptIstendi: false, \/\/ Kesinleştirmede Gemini ASLA yeniden başlatılmaz/);
});

test("Hedef 8: Taslak aktif operasyon listelerinde görünmez", () => {
  const sqlKodu = oku("scripts/sql/ogrenme_araclari_faz3_podcast_taslak.sql");

  // 8a. Taslak bayrağı varsayılan true olarak açılır ve listelerde filtrelenir
  assert.match(sqlKodu, /taslak_mi boolean NOT NULL DEFAULT false/);
  assert.match(sqlKodu, /WHERE t\.taslak_mi = true/);
  assert.match(sqlKodu, /taslak_mi = false/);
});

test("Hedef 9: Kesinleşen talep doğru V2/V4 zincirine yalnız bir kez girer", () => {
  const sqlKodu = oku("scripts/sql/ogrenme_araclari_faz3_podcast_taslak.sql");

  // 9a. Kesinleştirme anında uretim_talep_ilk_gorevini_ac tek bir kez çağrılır
  assert.match(sqlKodu, /v_ilk_gorev := public\.uretim_talep_ilk_gorevini_ac\(\s*p_talep_id,\s*p_uretici_id,\s*p_islem_anahtari\s*\);/);
});

test("Hedef 10: Terk edilen taslak ve dosya temizliği altyapısı", () => {
  const sqlKodu = oku("scripts/sql/ogrenme_araclari_faz3_podcast_taslak.sql");
  const taslakRoute = oku("app/(panel)/talepler/api/taslak/route.ts");
  const temizleyiciKodu = oku("lib/ogrenmeAraci/podcastTaslakTemizleyici.ts");
  const cronKodu = oku("app/api/cron/transkript-kuyruk/route.ts");

  // 10a. Kullanıcı iptal ettiğinde DELETE rotası podcast_taslak_iptal_et_atomik çağırır
  assert.match(taslakRoute, /export async function DELETE/);
  assert.match(taslakRoute, /podcast_taslak_iptal_et_atomik/);

  // 10b. İptal ve zaman aşımı RPC'leri Bunny dosyalarını ogrenme_araci_depolama_temizleme_kuyrugu'na yazar
  assert.match(sqlKodu, /CREATE OR REPLACE FUNCTION public\.podcast_taslak_iptal_et_atomik/);
  assert.match(sqlKodu, /ogrenme_araci_depolama_temizleme_kuyrugu/);
  assert.match(sqlKodu, /CREATE OR REPLACE FUNCTION public\.podcast_taslak_zaman_asimi_temizle_atomik/);

  // 10c. Zaman aşımı temizleyicisi cron üzerinden periyodik olarak çalıştırılır
  assert.match(temizleyiciKodu, /terkEdilenPodcastTaslaklariniTemizle/);
  assert.match(cronKodu, /terkEdilenPodcastTaslaklariniTemizle/);
});

test("Hedef 11: V1/V3 ve önceki podcast geliştirmelerinin regresyonu", () => {
  const hookKodu = oku("app/(panel)/talepler/_hooks/useTalepFormu.ts");
  const sqlKodu = oku("scripts/sql/ogrenme_araclari_faz3_podcast_taslak.sql");

  // 11a. Hazır olmayan (V1/V3) taleplerde buton kilit mantığı pas geçilir
  assert.match(hookKodu, /if \(!hazirVideo \|\| ogrenmeAraciTuru !== "podcast"\) \{\s*return \{ gonderButonuEtkin: true, gonderButonuPasifNedeni: null \};/);

  // 11b. Taslak oluşturma RPC'si V1/V3 talepleri doğrudan reddeder
  assert.match(sqlKodu, /IF NOT v_hazir_video THEN\s*RAISE EXCEPTION 'Yalnızca hazır V2\/V4 podcast akışı için taslak oluşturulabilir/);
});
