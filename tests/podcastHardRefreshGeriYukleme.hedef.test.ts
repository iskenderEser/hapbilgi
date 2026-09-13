import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function oku(goreceliYol: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), goreceliYol), "utf8");
}

// ============================================================================
// KOMUT 2: HARD REFRESH SONRASI PODCAST İŞLEMİNİ EKSİKSİZ GERİ YÜKLEME TESTLERİ
// ============================================================================

test("1. GET /talepler/api/taslak: Üretici yetkisi ve firma sahipliği kilit altındadır (Multi-tenant sınır)", () => {
  const taslakRoute = oku("app/(panel)/talepler/api/taslak/route.ts");

  // GET metodu mevcut olmalı
  assert.match(taslakRoute, /export async function GET\(request: NextRequest\)/);

  // Kullanıcı ve rol doğrulaması
  assert.match(taslakRoute, /const rol = await rolCozucu\(adminSupabase, user\.id\)/);
  assert.match(taslakRoute, /ureticiYetenegi\(rol\)/);

  // Firma sahipliği doğrulaması
  assert.match(taslakRoute, /kullanicilar tablosu SELECT — üretici firma_id/);
  assert.match(taslakRoute, /\.eq\("uretici_id", user\.id\)/);
  assert.match(taslakRoute, /\.eq\("firma_id", kullaniciKaydi\.firma_id\)/);
});

test("2. GET /talepler/api/taslak: Gerçek şema kolonları (talep_id, taslak_oturum_anahtari) kullanılır, eski yanlış adlar bulunmaz", () => {
  const taslakRoute = oku("app/(panel)/talepler/api/taslak/route.ts");
  const getGovdesi = taslakRoute.slice(
    taslakRoute.indexOf("export async function GET"),
    taslakRoute.indexOf("export async function POST")
  );

  // Gerçek şema kolonları select içinde yer almalı
  assert.match(getGovdesi, /talep_id,\s*uretici_id/);
  assert.match(getGovdesi, /taslak_oturum_anahtari,/);

  // Eski kolon adları select ve filtrelerde bulunmamalı
  assert.doesNotMatch(getGovdesi, /select\(`[\s\S]*\bid\b[\s\S]*`\)/, "select içinde id değil talep_id kullanılmalı");
  assert.doesNotMatch(getGovdesi, /select\(`[\s\S]*\boturum_anahtari\b[\s\S]*`\)/, "select içinde oturum_anahtari değil taslak_oturum_anahtari kullanılmalı");
  assert.doesNotMatch(getGovdesi, /query\.eq\("id",/, "Filtrelemede id değil talep_id kullanılmalı");
  assert.doesNotMatch(getGovdesi, /query\.eq\("oturum_anahtari",/, "Filtrelemede oturum_anahtari değil taslak_oturum_anahtari kullanılmalı");
  assert.doesNotMatch(getGovdesi, /\.eq\("talep_id", talep\.id\)/, "Araç sorgusunda talep.id değil talep.talep_id kullanılmalı");
  assert.doesNotMatch(getGovdesi, /talep_id: talep\.id,/, "Yanıtta talep.id değil talep.talep_id kullanılmalı");
  assert.doesNotMatch(getGovdesi, /oturum_anahtari: talep\.oturum_anahtari,/, "Yanıtta talep.oturum_anahtari değil talep.taslak_oturum_anahtari kullanılmalı");

  // talep_id ve oturum_anahtari sorgu parametreleri doğru kolonlara bağlanmalı
  assert.match(getGovdesi, /const talepId = searchParams\.get\("talep_id"\)/);
  assert.match(getGovdesi, /const oturumAnahtari = searchParams\.get\("oturum_anahtari"\)/);
  assert.match(getGovdesi, /query = query\.eq\("talep_id", talepId\)/);
  assert.match(getGovdesi, /query = query\.eq\("taslak_oturum_anahtari", oturumAnahtari\)/);
  assert.match(getGovdesi, /query\.order\("updated_at", \{ ascending: false \}\)\.limit\(1\)/);

  // Yalnız taslak_mi=true, ogrenme_araci_turu=podcast ve hazir_video=true kayıtları döner
  assert.match(getGovdesi, /\.eq\("taslak_mi", true\)/);
  assert.match(getGovdesi, /\.eq\("ogrenme_araci_turu", "podcast"\)/);
  assert.match(getGovdesi, /\.eq\("hazir_video", true\)/);

  // İlişkili araç sorgusu ve yanıt alanları gerçek kolonları kullanır
  assert.match(getGovdesi, /\.eq\("talep_id", talep\.talep_id\)/);
  assert.match(getGovdesi, /talep_id: talep\.talep_id,/);
  assert.match(getGovdesi, /oturum_anahtari: talep\.taslak_oturum_anahtari,/);
});

test("3. GET /talepler/api/taslak: İlişkili öğrenme aracı, ses, kapak ve transkript bilgilerini tam döner", () => {
  const taslakRoute = oku("app/(panel)/talepler/api/taslak/route.ts");

  assert.match(taslakRoute, /\.from\("ogrenme_araclari"\)/);
  assert.match(taslakRoute, /ses_yuklendi: sesYuklendi/);
  assert.match(taslakRoute, /ses_dosya_adi: sesDosyaAdi/);
  assert.match(taslakRoute, /kapak_yuklendi: kapakYuklendi/);
  assert.match(taslakRoute, /kapak_dosya_adi: kapakDosyaAdi/);
  assert.match(taslakRoute, /transkript:\s*\{[\s\S]*durum: transkriptDurumu/);
  assert.match(taslakRoute, /taslak_metin: taslakMetin/);
  assert.match(taslakRoute, /onaylanan_metin: onaylananMetin/);
});

test("4. useTalepFormu: Sayfa açılışında formun tamamı (eğitim türü, roller, ürün/teknik, açıklama, soru seti) geri yüklenir", () => {
  const formHook = oku("app/(panel)/talepler/_hooks/useTalepFormu.ts");

  // Sayfa açılışında GET /talepler/api/taslak çağrısı
  assert.match(formHook, /let taslakUrl = "\/talepler\/api\/taslak"/);
  assert.match(formHook, /fetch\(taslakUrl, \{ cache: "no-store" \}\)/);

  // Form alanlarının geri yüklenmesi ve eğitim türü seçim durumunun geri gelmesi
  assert.match(formHook, /if \(taslak\.egitim_turu\) \{[\s\S]*setEgitimTuru\(taslak\.egitim_turu\)[\s\S]*setEgitimTuruSecildiMi\(true\)/);
  assert.match(formHook, /setHedefRoller\(taslak\.hedef_roller\)/);
  assert.match(formHook, /setSeciliUrunId\(taslak\.urun_id\)/);
  assert.match(formHook, /setSeciliTeknikId\(taslak\.teknik_id\)/);
  assert.match(formHook, /setSerbestAd\(taslak\.urun_adi\)/);
  assert.match(formHook, /setAciklama\(taslak\.aciklama\)/);
  assert.match(formHook, /setOgrenmeAraciTuru\("podcast"\)/);
  assert.match(formHook, /setHazirVideo\(true\)/);

  // Soru seti ve soruların geri yüklenmesi
  assert.match(formHook, /setSoruSetiBuyuklugu\(taslak\.soru_seti_buyuklugu\)/);
  assert.match(formHook, /setSecenekSayisi\(taslak\.secenek_sayisi\)/);
  assert.match(formHook, /setVideoBasiSoruSayisi\(taslak\.video_basi_soru_sayisi\)/);
  assert.match(formHook, /setSoruTaslaklari\(sorulardanTaslaklar\(taslak\.hazir_soru_seti_verisi\)\)/);
});

test("5. useTalepFormu: Boş File nesnesi üretilmez; podcastSesYuklendi=true ve dosya adı ayarlanır", () => {
  const formHook = oku("app/(panel)/talepler/_hooks/useTalepFormu.ts");

  // Geri yükleme sırasında new File([], ...) bulunmamalı
  assert.doesNotMatch(
    formHook,
    /new File\(\[\],/g,
    "Geri yüklemede asla boş File nesnesi üretilmemelidir"
  );

  // podcastSesYuklendi ve dosya adı set edilmeli
  assert.match(formHook, /setPodcastSesYuklendi\(true\)/);
  assert.match(formHook, /setPodcastYuklenenDosyaAdi\(taslak\.ses_dosya_adi \|\| "podcast\.mp3"\)/);

  // Validasyon ve gönderim podcastSesYuklendi durumunda dosya seçimini zorunlu tutmaz
  assert.match(formHook, /if \(hazirVideo && ogrenmeAraciTuru === "podcast" && !bekleyenPodcast\) \{[\s\S]*if \(!podcastSesYuklendi\)/);
  assert.match(formHook, /if \(!bekleyenPodcast && !podcastSesYuklendi\) \{[\s\S]*uyari\("Lütfen önce podcast dosyasını seçiniz\."\)/);
});

test("6. useTalepFormu: Transkript durumları tam karşılanır (ai_bekliyor, ai_isleniyor, ai_taslak, onaylandi, hata, iptal)", () => {
  const formHook = oku("app/(panel)/talepler/_hooks/useTalepFormu.ts");

  // ai_bekliyor -> ai_kuyrukta
  assert.match(formHook, /if \(durum === "ai_bekliyor"\) \{[\s\S]*setPodcastAiAsamasi\("ai_kuyrukta"\)[\s\S]*setPodcastAiYukleniyor\(true\)/);

  // ai_isleniyor -> ai_isleniyor
  assert.match(formHook, /else if \(durum === "ai_isleniyor"\) \{[\s\S]*setPodcastAiAsamasi\("ai_isleniyor"\)[\s\S]*setPodcastAiYukleniyor\(true\)/);

  // ai_taslak -> transkript_hazir ve onaylandi=false
  assert.match(formHook, /else if \(durum === "ai_taslak"\) \{[\s\S]*setPodcastAiAsamasi\("transkript_hazir"\)[\s\S]*setPodcastTranskriptOnaylandi\(false\)/);

  // onaylandi -> transkript_hazir ve onaylandi=true
  assert.match(formHook, /else if \(durum === "onaylandi"\) \{[\s\S]*setPodcastAiAsamasi\("transkript_hazir"\)[\s\S]*setPodcastTranskriptOnaylandi\(true\)/);

  // hata -> hata
  assert.match(formHook, /else if \(durum === "hata"\) \{[\s\S]*setPodcastAiAsamasi\("hata"\)/);

  // iptal -> bosta ve transkriptsiz devam
  assert.match(formHook, /else if \(durum === "iptal"\) \{[\s\S]*setPodcastAiAsamasi\("bosta"\)/);
});

test("7. useTalepFormu: ai_bekliyor ve ai_isleniyor durumlarında sayfa yenilense bile periyodik yoklama otomatik sürer", () => {
  const formHook = oku("app/(panel)/talepler/_hooks/useTalepFormu.ts");

  // Yoklama kancası podcastAiAsamasi ai_kuyrukta veya ai_isleniyor iken aktiftir
  assert.match(formHook, /if \(podcastAiAsamasi !== "ai_kuyrukta" && podcastAiAsamasi !== "ai_isleniyor"\) return/);
  assert.match(formHook, /void yokla\(\)/);
  assert.match(formHook, /setInterval\(yokla, 2500\)/);
});

test("8. useTalepFormu: Gönderiniz butonu yalnız transkript onaylandı veya iptal ise açılır; taslak/hata/işleniyor pasiftir", () => {
  const formHook = oku("app/(panel)/talepler/_hooks/useTalepFormu.ts");

  // iptal durumunda buton açık
  assert.match(formHook, /if \(sunucuTranskriptDurumu === "iptal"\) \{[\s\S]*return \{ gonderButonuEtkin: true, gonderButonuPasifNedeni: null \}/);

  // onaylandi durumunda yalnız transkript onaylandı ise açık
  assert.match(formHook, /if \(sunucuTranskriptDurumu === "onaylandi"\) \{[\s\S]*if \(podcastTranskriptOnaylandi\) \{[\s\S]*return \{ gonderButonuEtkin: true/);

  // ai_isleniyor veya ai_bekliyor pasif
  assert.match(formHook, /sunucuTranskriptDurumu === "ai_bekliyor"/);
  assert.match(formHook, /gonderButonuPasifNedeni: "AI transkripti hazırlanıyor"/);

  // hata pasif
  assert.match(formHook, /gonderButonuPasifNedeni:\s*"Transkript işlemi hata verdi; tekrar deneyin veya transkriptsiz devam edin"/);

  // taslak pasif
  assert.match(formHook, /gonderButonuPasifNedeni: "Transkripti onaylayın veya transkriptsiz devam edin"/);
});

test("9. useTalepFormu: Kurtarma kaydı başarılı kesinleştirmede veya taslak iptalinde temizlenir, yenilemede kaybolmaz", () => {
  const formHook = oku("app/(panel)/talepler/_hooks/useTalepFormu.ts");

  // submitTalep başarılı kesinleştirme sonrası sessionStorage temizliği
  assert.match(formHook, /if \(kullanici\?\.id\) window\.sessionStorage\.removeItem\(`hapbilgi:podcast-taslak:\$\{kullanici\.id\}`\)/);

  // handlePodcastTaslakIptal iptal sonrası sessionStorage temizliği
  assert.match(formHook, /handlePodcastTaslakIptal = useCallback\(async \(\)/);
  assert.match(formHook, /window\.sessionStorage\.removeItem\(depoAnahtari\)/);
});

test("10. PodcastTalepAlanlari ve PodcastTranskriptEditoru: Sunucuda yüklü ses göstergesi ve otomatik transkript kartı", () => {
  const alanlarKodu = oku("app/(panel)/talepler/_components/PodcastTalepAlanlari.tsx");
  const editorKodu = oku("app/(panel)/talepler/_components/PodcastTranskriptEditoru.tsx");
  const formV2Kodu = oku("app/(panel)/talepler/_components/YeniTalepFormV2.tsx");

  // Sunucuda Yüklü rozeti
  assert.match(alanlarKodu, /Sunucuda Yüklü:/);
  assert.match(alanlarKodu, /sunucudaYuklu=\{props\.sesYuklendi\}/);
  assert.match(alanlarKodu, /yuklenenDosyaAdi=\{props\.sesDosyaAdi\}/);

  // YeniTalepFormV2 prop aktarımı
  assert.match(formV2Kodu, /sesYuklendi=\{formu\.podcastSesYuklendi\}/);
  assert.match(formV2Kodu, /sesDosyaAdi=\{formu\.podcastYuklenenDosyaAdi\}/);

  // PodcastTranskriptEditoru veri geldiğinde otomatik açılır
  assert.match(editorKodu, /useEffect\(\(\) => \{[\s\S]*if \(islemDurumu && islemDurumu !== "bosta"\) \{[\s\S]*setAcik\(true\)/);
  assert.match(editorKodu, /else if \(aiIstendi\) \{[\s\S]*setAcik\(true\)/);
});
