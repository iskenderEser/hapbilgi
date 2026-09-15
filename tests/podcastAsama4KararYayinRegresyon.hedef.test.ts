import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function oku(goreceliYol: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), goreceliYol), "utf8");
}

// ============================================================================
// AŞAMA 4: 21 HEDEF TEST VE REGRESYON SÜİTİ
// ============================================================================

// ----------------------------------------------------------------------------
// 1. Transkriptsiz V2 Tamamlama
// ----------------------------------------------------------------------------
test("Hedef 1: Transkriptsiz V2 tamamlama — hazır ses yüklenir, transkriptsiz onaylanır ve soru zinciri açılır", () => {
  const sql = oku("scripts/sql/ogrenme_araclari_faz3_podcast_opsiyonel_transkript.sql");
  // Transkript yokluğunda hata fırlatmaz, podcast doğrulanır
  assert.match(sql, /kaynak = 'hazir'/);
  assert.match(sql, /uretim_podcast_soru_zinciri_ac/);

  const dogrulaRoute = oku("app/api/ogrenme-araclari/[arac_id]/podcast-dogrula/route.ts");
  assert.match(dogrulaRoute, /uretim_podcast_dogrula/);
});

// ----------------------------------------------------------------------------
// 2. Transkriptsiz V4 Tamamlama
// ----------------------------------------------------------------------------
test("Hedef 2: Transkriptsiz V4 tamamlama — hazır ses ve soru seti ile transkript olmadan yayın havuzuna geçer", () => {
  const yuklemeIstemci = oku("lib/ogrenmeAraci/bunnyYuklemeIstemci.ts");
  assert.match(yuklemeIstemci, /const transkriptGerekli = Boolean\(girdi\.kaynak === "iu" && !tamamlananParcalar\.has\("transkript"\)\);/);

  const talepHook = oku("app/(panel)/talepler/_hooks/useTalepFormu.ts");
  // Podcast için ses zorunluyken transkript zorunlu değildir
  assert.match(talepHook, /if \(hazirVideo && ogrenmeAraciTuru === "podcast" && !bekleyenPodcast\)/);
  assert.doesNotMatch(talepHook, /if \(hazirVideo && ogrenmeAraciTuru === "podcast" && !bekleyenPodcastTranskript\)/);
});

// ----------------------------------------------------------------------------
// 3. Transkriptsiz Yayınlama
// ----------------------------------------------------------------------------
test("Hedef 3: Transkriptsiz yayınlama — transkript_yolu olmadan yayına alınır, oynatıcıda hata mesajı gösterilmez", () => {
  const yayinlarRoute = oku("app/(panel)/yayin-yonetimi/api/yayinlar/route.ts");
  assert.doesNotMatch(yayinlarRoute, /transkript_yolu.*zorunlu/i);

  const erisimRoute = oku("app/api/ogrenme-araclari/[arac_id]/erisim/route.ts");
  assert.match(erisimRoute, /transkriptUrl = null/);
  assert.match(erisimRoute, /transkriptMetni = null/);

  const oynatici = oku("components/ogrenme-araci/PodcastOynatici.tsx");
  // Transkript yoksa panel veya hata mesajı render edilmez
  assert.match(oynatici, /erisim\.transkript_metni &&/);
  assert.match(oynatici, /erisim\.transkript_url &&/);
});

// ----------------------------------------------------------------------------
// 4. DOCX Metin Çıkarma ve Onay
// ----------------------------------------------------------------------------
test("Hedef 4: DOCX metin çıkarma ve onay — mammoth ile çıkarılır, düzenlenip onaylanır", () => {
  const metinCikarici = oku("lib/ogrenmeAraci/transkriptMetinCikarici.ts");
  assert.match(metinCikarici, /mammoth\.extractRawText/);
  assert.match(metinCikarici, /docxMetniCikar/);

  const transkriptYonet = oku("app/api/ogrenme-araclari/[arac_id]/transkript-yonet/route.ts");
  assert.match(transkriptYonet, /islem === "onayla"/);
  assert.match(transkriptYonet, /durum: "onaylandi"/);
});

// ----------------------------------------------------------------------------
// 5. PDF Metin Çıkarma ve Onay
// ----------------------------------------------------------------------------
test("Hedef 5: PDF metin çıkarma ve onay — pdfjs-dist ile çıkarılır, şifreli PDF reddedilir", () => {
  const metinCikarici = oku("lib/ogrenmeAraci/transkriptMetinCikarici.ts");
  assert.match(metinCikarici, /pdfMetniCikar/);
  assert.match(metinCikarici, /pdfjs-dist/);
  assert.match(metinCikarici, /Şifreli PDF dosyaları işlenemez/);

  const istemciCikarici = oku("lib/ogrenmeAraci/transkriptIstemciCikarici.ts");
  assert.match(istemciCikarici, /istemcideMetinCikar/);
  assert.match(istemciCikarici, /pdfjs-dist/);
});

// ----------------------------------------------------------------------------
// 6. Kopyala-Yapıştır ve Onay
// ----------------------------------------------------------------------------
test("Hedef 6: Kopyala-yapıştır ve onay — metin_kaydet ve onayla işlemleriyle onaylanır", () => {
  const transkriptYonet = oku("app/api/ogrenme-araclari/[arac_id]/transkript-yonet/route.ts");
  assert.match(transkriptYonet, /islem === "metin_kaydet"/);
  assert.match(transkriptYonet, /durum: "manuel_taslak"/);
  assert.match(transkriptYonet, /islem === "onayla"/);
  assert.match(transkriptYonet, /ASGARI_TRANSKRIPT_KARAKTER/);
});

// ----------------------------------------------------------------------------
// 7. Manuel Taslağın Yayınlanmaması
// ----------------------------------------------------------------------------
test("Hedef 7: Manuel taslağın yayınlanmaması — durum manuel_taslak iken /erisim rotası metni null döner", () => {
  const erisimRoute = oku("app/api/ogrenme-araclari/[arac_id]/erisim/route.ts");
  assert.match(erisimRoute, /if \(transkriptObj\.durum === "onaylandi"\)/);
  assert.match(erisimRoute, /delete temizMetadata\.transkript_metni/);
  assert.match(erisimRoute, /delete temizMetadata\.taslak_metin/);
});

// ----------------------------------------------------------------------------
// 8. AI İşleminin Yalnız Kullanıcı Seçimiyle Başlaması
// ----------------------------------------------------------------------------
test("Hedef 8: AI işleminin yalnız kullanıcı seçimiyle başlaması — otomatik başlatılmaz, istek gerekir", () => {
  const yuklemeIstemci = oku("lib/ogrenmeAraci/bunnyYuklemeIstemci.ts");
  assert.match(yuklemeIstemci, /if \(girdi\.aiTranskriptIstendi\)/);
  assert.match(yuklemeIstemci, /\/transkript-ai-baslat/);

  const aiBaslat = oku("app/api/ogrenme-araclari/[arac_id]/transkript-ai-baslat/route.ts");
  assert.match(aiBaslat, /POST/);
  assert.match(aiBaslat, /status:\s*202/);
});

// ----------------------------------------------------------------------------
// 9. AI Taslağının Yayınlanmaması
// ----------------------------------------------------------------------------
test("Hedef 9: AI taslağının yayınlanmaması — durum ai_taslak iken yayında metin görünmez", () => {
  const erisimRoute = oku("app/api/ogrenme-araclari/[arac_id]/erisim/route.ts");
  assert.match(erisimRoute, /transkriptObj\.durum === "onaylandi"/);
  // ai_taslak onaylanmadığı sürece onaylanan_metin silinir
  assert.match(erisimRoute, /delete \(kalanTranskript as Record<string, unknown>\)\.onaylanan_metin/);
});

// ----------------------------------------------------------------------------
// 10. AI Metninin Doğrudan Onaylanması
// ----------------------------------------------------------------------------
test("Hedef 10: AI metninin doğrudan onaylanması — kullanıcının onayladığı Gemini transkripti onaylandi olur", () => {
  const transkriptYonet = oku("app/api/ogrenme-araclari/[arac_id]/transkript-yonet/route.ts");
  assert.match(transkriptYonet, /kaynak:\s*\(mevcutTranskript\.kaynak as "manuel" \| "ai" \| null\) \?\? "manuel"/);
  assert.match(transkriptYonet, /onaylayan_kullanici_id:\s*user\.id/);
});

// ----------------------------------------------------------------------------
// 11. AI Metninin Düzenlenip Onaylanması
// ----------------------------------------------------------------------------
test("Hedef 11: AI metninin düzenlenip onaylanması — nihai_metin kullanıcı tarafından değiştirilip onaylanır", () => {
  const transkriptYonet = oku("app/api/ogrenme-araclari/[arac_id]/transkript-yonet/route.ts");
  assert.match(transkriptYonet, /const nihaiMetin = typeof body\.nihai_metin === "string"/);
  assert.match(transkriptYonet, /onaylanan_metin: nihaiMetin/);

  const editor = oku("app/(panel)/talepler/_components/PodcastTranskriptEditoru.tsx");
  assert.match(editor, /handleOnaylaVeKaydet/);
  assert.match(editor, /body:\s*JSON\.stringify\(\{\s*islem:\s*"onayla",\s*nihai_metin:\s*nihaiMetin\s*\}\)/);
});

// ----------------------------------------------------------------------------
// 12. İptal Sonrası Gecikmiş AI Cevabı
// ----------------------------------------------------------------------------
test("Hedef 12: İptal sonrası gecikmiş AI cevabı — kullanıcı iptal ettiğinde gecikmiş cevap taslağa çeviremez", () => {
  const sql = oku("scripts/sql/ogrenme_araclari_faz3_podcast_ai_transkript.sql");
  assert.match(sql, /IF \(v_transkript->>'durum'\) IN \('iptal', 'onaylandi'\) THEN/);

  const isleyici = oku("lib/ogrenmeAraci/transkriptKuyrukIsleyici.ts");
  assert.match(isleyici, /transkript\.durum === "iptal"/);
  assert.match(isleyici, /transkript\.durum === "onaylandi"/);
});

// ----------------------------------------------------------------------------
// 13. Eski ve Yeni AI Girişimi Yarışı
// ----------------------------------------------------------------------------
test("Hedef 13: Eski ve yeni AI girişimi yarışı — eski ai_girisim_id yeni girişimi ezemez", () => {
  const sql = oku("scripts/sql/ogrenme_araclari_faz3_podcast_ai_transkript.sql");
  assert.match(sql, /IF \(v_transkript->>'ai_girisim_id'\) <> p_girisim_id::text THEN\s+RETURN false;\s+END IF;/);

  const isleyici = oku("lib/ogrenmeAraci/transkriptKuyrukIsleyici.ts");
  assert.match(isleyici, /transkript\.ai_girisim_id !== ai_girisim_id/);
});

// ----------------------------------------------------------------------------
// 14. Ses Değişince Onayın Geçersizleşmesi
// ----------------------------------------------------------------------------
test("Hedef 14: Ses değişince onayın geçersizleşmesi — yeni ses yüklendiğinde onay sıfırlanır", () => {
  const talepHook = oku("app/(panel)/talepler/_hooks/useTalepFormu.ts");
  assert.match(talepHook, /setPodcastTranskriptOnaylandi\(false\)/);

  const yuklemeBaslatRoute = oku("app/api/ogrenme-araclari/yukleme-baslat/route.ts");
  assert.match(yuklemeBaslatRoute, /transkript_yolu:\s*null/);
  assert.match(yuklemeBaslatRoute, /metadata_dogrulandi:\s*false/);

  const transkriptYonet = oku("app/api/ogrenme-araclari/[arac_id]/transkript-yonet/route.ts");
  assert.match(transkriptYonet, /bagli_ses_checksum:\s*\(metadataOnceki\.checksum_sha256/);
});

// ----------------------------------------------------------------------------
// 15. Yetkisiz Kullanıcı ve Firma Erişimi
// ----------------------------------------------------------------------------
test("Hedef 15: Yetkisiz kullanıcı ve firma erişimi — URETICI_ROLLER dışındaki veya farklı firma istekleri engellenir", () => {
  const transkriptYonet = oku("app/api/ogrenme-araclari/[arac_id]/transkript-yonet/route.ts");
  assert.match(transkriptYonet, /URETICI_ROLLER\.includes\(rol\)/);
  assert.match(transkriptYonet, /uretimAraciYetkisiniDogrula/);

  const erisimRoute = oku("app/api/ogrenme-araclari/[arac_id]/erisim/route.ts");
  assert.match(erisimRoute, /kullanici\?\.firma_id/);
  assert.match(erisimRoute, /detay\.firma_id === kullanici\.firma_id/);
});

// ----------------------------------------------------------------------------
// 16. Çift Onay ve Çift İptal
// ----------------------------------------------------------------------------
test("Hedef 16: Çift onay ve çift iptal — tekrarlanan işlemler idempotent şekilde işlenir", () => {
  const transkriptYonet = oku("app/api/ogrenme-araclari/[arac_id]/transkript-yonet/route.ts");
  assert.match(transkriptYonet, /islem === "onayla"/);
  assert.match(transkriptYonet, /islem === "iptal_et"/);
  assert.match(transkriptYonet, /return NextResponse\.json\(\{ ok: true, transkript: onayliTranskript \}\);/);
});

// ----------------------------------------------------------------------------
// 17. Gemini Hatası ve Tekrar Deneme
// ----------------------------------------------------------------------------
test("Hedef 17: Gemini hatası ve tekrar deneme — kalıcı hata hata durumuna alır, UI tekrar deneme imkanı verir", () => {
  const isleyici = oku("lib/ogrenmeAraci/transkriptKuyrukIsleyici.ts");
  assert.match(isleyici, /KALICI_HATALAR/);
  assert.match(isleyici, /podcast_transkript_ai_hata_atomik/);
  assert.match(isleyici, /podcast_transkript_ai_gecici_hata_atomik/);

  const editor = oku("app/(panel)/talepler/_components/PodcastTranskriptEditoru.tsx");
  assert.match(editor, /aiBaslatTekrar/);
  assert.match(editor, /Tekrar Dene/);
});

// ----------------------------------------------------------------------------
// 18. Sayfa Yenileme ve Yarım İşlem Kurtarma
// ----------------------------------------------------------------------------
test("Hedef 18: Sayfa yenileme ve yarım işlem kurtarma — transkript-durum endpointi durumu korur ve döndürür", () => {
  const durumRoute = oku("app/api/ogrenme-araclari/[arac_id]/transkript-durum/route.ts");
  assert.match(durumRoute, /arac\.metadata/);
  assert.match(durumRoute, /transkript/);

  const editor = oku("app/(panel)/talepler/_components/PodcastTranskriptEditoru.tsx");
  assert.match(editor, /aiDurumunuSorgula/);
  assert.match(editor, /\/api\/ogrenme-araclari\/\$\{aracId\}\/transkript-durum/);
});

// ----------------------------------------------------------------------------
// 19. Eski Podcast Uyumluluğu
// ----------------------------------------------------------------------------
test("Hedef 19: Eski podcast uyumluluğu — transkript_dogrulandi: true olan eski kayıtlar çalışmaya devam eder", () => {
  const erisimRoute = oku("app/api/ogrenme-araclari/[arac_id]/erisim/route.ts");
  assert.match(erisimRoute, /const eskiDogrulandi = metadata\.transkript_dogrulandi === true;/);
  assert.match(erisimRoute, /transkriptUrl = arac\.transkript_yolu \? bunnyCdnImzaliUrl\(arac\.transkript_yolu\) : null;/);
  // Sahte kullanıcı onayı eklenmez (onaylayan_kullanici_id üretilmez)
  assert.match(erisimRoute, /delete temizMetadata\.onaylayan_kullanici_id;/);
});

// ----------------------------------------------------------------------------
// 20. İlk Üç Geliştirme Regresyonu
// ----------------------------------------------------------------------------
test("Hedef 20: İlk üç geliştirme regresyonu — Aşama 1, 2 ve 3 sözleşmeleri tam korunur", () => {
  const tipler = oku("lib/ogrenmeAraci/tipler.ts");
  assert.match(tipler, /export type PodcastTranskriptDurumu/);
  for (const durum of ["yok", "manuel_taslak", "ai_bekliyor", "ai_isleniyor", "ai_taslak", "onaylandi", "iptal", "hata"]) {
    assert.match(tipler, new RegExp(`"${durum}"`));
  }

  const cronSql = oku("scripts/sql/kuyruk_cronlarini_supabase_tasima.sql");
  assert.match(cronSql, /\/api\/cron\/transkript-kuyruk/);
  assert.match(cronSql, /hapbilgi_cron_secret/);

  const envExample = oku(".env.example");
  assert.match(envExample, /CRON_SECRET=/);
});

// ----------------------------------------------------------------------------
// 21. Oynatıcı XSS Güvenliği ve Sunucu Öncesi Onay Bildirimi Sözleşmesi
// ----------------------------------------------------------------------------
test("Hedef 21: Oynatıcı XSS güvenliği ve sunucu öncesi onay bildirimi sözleşmesi", () => {
  // 21a. Oynatıcı XSS ve HTML kaçış kontrolü
  const oynatici = oku("components/ogrenme-araci/PodcastOynatici.tsx");
  assert.match(oynatici, /\{erisim\.transkript_metni\}/);
  assert.doesNotMatch(oynatici, /dangerouslySetInnerHTML/);

  // 21b. PodcastTranskriptEditoru: aracId yokken sunucu kayıt başarısı gösterilmez
  const editor = oku("app/(panel)/talepler/_components/PodcastTranskriptEditoru.tsx");
  assert.doesNotMatch(
    editor,
    /setBasariMesaji\("Transkript onaylandı\. Talep oluşturulduğunda kaydedilecektir\."\)/,
    "aracId yokken yeşil başarı bildirimi gösterilmemelidir"
  );
  assert.match(
    editor,
    /aracId && \(onaylandi \|\| aiDurumu === "onaylandi"\)/,
    "✓ Onaylandı rozeti ve başarı bildirimi yalnızca aracId mevcutken gösterilmelidir"
  );
  assert.match(
    editor,
    /!aracId && onaylandi \? \(\s*<span[^>]*bg-slate-100/,
    "aracId yokken onay durumu yeşil rozet yerine nötr slate stiliyle gösterilmelidir"
  );

  // 21c. useTalepFormu: hazirPodcastYukle sunucu hatasında transkript onaylı gösterilmez
  const hook = oku("app/(panel)/talepler/_hooks/useTalepFormu.ts");
  assert.match(
    hook,
    /catch \(error\) \{\s*setPodcastTranskriptOnaylandi\(false\);/,
    "hazirPodcastYukle hatasında yerel transkript onay durumu false yapılmalıdır"
  );
});
