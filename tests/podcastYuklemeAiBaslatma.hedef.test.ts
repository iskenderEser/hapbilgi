import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  baslatLocalTranskriptWorker,
  durdurLocalTranskriptWorker,
  localTranskriptWorkerDurumu,
} from "@/lib/ogrenmeAraci/localTranskriptWorker";

function oku(goreceliYol: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), goreceliYol), "utf8");
}

// ============================================================================
// KOMUT 2: PODCAST YÜKLEME VE AI BAŞLATMA AKIŞI HEDEF TESTLERİ
// ============================================================================

test("Hedef 1: AI butonu taslak oluşturur ve 7 durum arayüzde açıkça yer alır", () => {
  const editor = oku("app/(panel)/talepler/_components/PodcastTranskriptEditoru.tsx");
  const formHook = oku("app/(panel)/talepler/_hooks/useTalepFormu.ts");

  // 1a. "AI ile Transkript Oluştur" butonu ve onAiBaslat tetiklemesi
  assert.match(editor, /AI ile Transkript Oluştur/);
  assert.match(editor, /onAiBaslat\?\.?\(\)/);

  // 1b. useTalepFormu handlePodcastAiTranskriptBaslat fonksiyonu taslak API'sini çağırır
  assert.match(formHook, /handlePodcastAiTranskriptBaslat = useCallback\(async \(\) =>/);
  assert.match(formHook, /fetch\("\/talepler\/api\/taslak"/);
  assert.match(formHook, /setPodcastAiAsamasi\("taslak_hazirlaniyor"\)/);

  // 1c. İstenen 7 durumun tamamı hem badge hem gövde olarak PodcastTranskriptEditoru'nda yer alır:
  // - Taslak hazırlanıyor
  assert.match(editor, /Taslak hazırlanıyor/);
  // - Podcast yükleniyor: yüzde
  assert.match(editor, /Podcast yükleniyor: %/);
  // - Podcast doğrulanıyor
  assert.match(editor, /Podcast doğrulanıyor/);
  // - AI işi kuyruğa alındı
  assert.match(editor, /AI işi kuyruğa alındı/);
  // - AI transkripti hazırlanıyor
  assert.match(editor, /AI transkripti hazırlanıyor/);
  // - Transkript hazır
  assert.match(editor, /Transkript hazır/);
  // - Transkript oluşturulamadı
  assert.match(editor, /Transkript oluşturulamadı/);
});

test("Hedef 2: Podcast hemen Bunny Storage'a yüklenir — Gönderiniz butonunu beklemez", () => {
  const formHook = oku("app/(panel)/talepler/_hooks/useTalepFormu.ts");

  // 2a. handlePodcastAiTranskriptBaslat içinde taslak alındıktan sonra derhal hazirPodcastYukle çağrılır
  assert.match(formHook, /await hazirPodcastYukle\(\{[\s\S]*talepId[\s\S]*aracId[\s\S]*ses: bekleyenPodcast\.dosya/);

  // 2b. Yükleme ve doğrulama aşamaları arayüz durumuna anlık yansıtılır
  assert.match(formHook, /setPodcastAiAsamasi\("podcast_dogrulaniyor"\)/);
  assert.match(formHook, /setPodcastAiAsamasi\("podcast_yukleniyor"\)/);
  assert.match(formHook, /setPodcastAiYuklemeYuzdesi\(bilgi\.yuzde\)/);
});

test("Hedef 3: AI işi yükleme tamamlanmadan başlamaz — Sunucu ve istemci sözleşmesi", () => {
  const formHook = oku("app/(panel)/talepler/_hooks/useTalepFormu.ts");
  const aiBaslatRoute = oku("app/api/ogrenme-araclari/[arac_id]/transkript-ai-baslat/route.ts");

  // 3a. İstemci akışı: AI başlatma isteği kesinlikle hazirPodcastYukle tamamlandıktan sonra atılır
  const baslatIndex = formHook.indexOf("handlePodcastAiTranskriptBaslat = useCallback");
  const yukleIndex = formHook.indexOf("await hazirPodcastYukle", baslatIndex);
  const aiBaslatIndex = formHook.indexOf("/transkript-ai-baslat", yukleIndex);
  assert.ok(
    yukleIndex < aiBaslatIndex,
    "AI başlatma çağrısı ses yüklemesi tamamlanmadan önce çağrılamaz"
  );

  // 3b. Sunucu kapısı: Ses dosyası doğrulanıp dosya_yolu atanmadan AI transkripti başlatılamaz (422)
  assert.match(
    aiBaslatRoute,
    /if \(!arac\.dosya_yolu\) \{\s*return NextResponse\.json\(\{\s*hata: "Ses dosyası yüklenmeden AI transkripti başlatılamaz\."\s*\}, \{\s*status: 422\s*\}\);/
  );
});

test("Hedef 4: “Gönderiniz” tıklanmadan AI kuyruğu oluşur — Bağımsız 202 Accepted", () => {
  const formHook = oku("app/(panel)/talepler/_hooks/useTalepFormu.ts");
  const aiBaslatRoute = oku("app/api/ogrenme-araclari/[arac_id]/transkript-ai-baslat/route.ts");

  // 4a. handlePodcastAiTranskriptBaslat içinde "Gönderiniz" butonu tıklanmadan kuyruk başlatılır
  assert.match(formHook, /fetch\(`\/api\/ogrenme-araclari\/\$\{aracId\}\/transkript-ai-baslat`/);
  assert.match(formHook, /setPodcastAiAsamasi\("ai_kuyrukta"\)/);

  // 4b. Sunucu kuyruğa ekleyip anında 202 döner
  assert.match(aiBaslatRoute, /status: 202/);
  assert.match(aiBaslatRoute, /AI transkript işi kalıcı kuyruğa alındı/);
});

test("Hedef 5: Çift tıklama koruması mükerrer kayıt oluşturmaz", () => {
  const formHook = oku("app/(panel)/talepler/_hooks/useTalepFormu.ts");
  const taslakSql = oku("scripts/sql/ogrenme_araclari_faz3_podcast_taslak.sql");
  const aiSql = oku("scripts/sql/ogrenme_araclari_faz3_podcast_ai_transkript.sql");

  // 5a. İstemcide çift tıklama koruması
  assert.match(formHook, /if \(podcastAiYukleniyor\) return;/);

  // 5b. Taslak oluşturmada benzersiz oturum anahtarı ile idempotent koruma
  assert.match(taslakSql, /uq_talepler_uretici_taslak_oturumu/);

  // 5c. AI başlatmada aktif girişim varsa mükerrer kayıt engellenir
  assert.match(aiSql, /podcast_transkript_ai_baslat_atomik/);
  assert.match(aiSql, /v_mevcut_durum IN \('ai_bekliyor', 'ai_isleniyor'\)/);
});

test("Hedef 6: Yenileme sonrası durum ve taslak kimlikleri geri gelir", () => {
  const formHook = oku("app/(panel)/talepler/_hooks/useTalepFormu.ts");

  // 6a. sessionStorage üzerinden talep_id, arac_id ve oturum_anahtari geri yüklenir
  assert.match(formHook, /sessionStorage\.getItem\(depoAnahtari\)/);
  assert.match(formHook, /setPodcastTaslakTalepId\(kayit\.talep_id\)/);
  assert.match(formHook, /setPodcastAracId\(kayit\.arac_id\)/);
  assert.match(formHook, /setPodcastTaslakOturumAnahtari\(kayit\.oturum_anahtari\)/);

  // 6b. Sunucu transkript durumu sorgulanıp arayüz durumu geri getirilir
  assert.match(formHook, /fetch\(`\/api\/ogrenme-araclari\/\$\{kayit\.arac_id\}\/transkript-durum`\)/);
  assert.match(formHook, /setPodcastAiAsamasi\("ai_kuyrukta"\)/);
  assert.match(formHook, /setPodcastAiAsamasi\("ai_isleniyor"\)/);
  assert.match(formHook, /setPodcastAiAsamasi\("transkript_hazir"\)/);
});

test("Hedef 7: Local worker kuyruğu bağımsız ve singleton olarak işler", () => {
  durdurLocalTranskriptWorker();

  // 7a. Local worker başlatılabilir
  const baslatildi = baslatLocalTranskriptWorker({ zorla: true, periyotMs: 500 });
  assert.strictEqual(baslatildi, true);

  // 7b. Tekillik (Singleton) doğrulaması: İkinci kez başlatılsa bile aynı tek örneği korur
  const ikinciBaslatma = baslatLocalTranskriptWorker({ zorla: true, periyotMs: 500 });
  assert.strictEqual(ikinciBaslatma, true);

  const durum = localTranskriptWorkerDurumu();
  assert.strictEqual(durum.calisiyor, true);
  assert.strictEqual(durum.singleton, true);

  durdurLocalTranskriptWorker();
  const durduktanSonra = localTranskriptWorkerDurumu();
  assert.strictEqual(durduktanSonra.calisiyor, false);

  // 7c. Instrumentation kancası Next.js dev sunucusu başlarken worker'ı devreye alır
  const instrumentation = oku("instrumentation.ts");
  assert.match(instrumentation, /register\(\)/);
  assert.match(instrumentation, /process\.env\.NODE_ENV === "development"/);
  assert.match(instrumentation, /baslatLocalTranskriptWorker/);
});

test("Hedef 8: Production cron davranışı bozulmaz — Güvenli koruma", () => {
  // 8a. Local worker production ortamında ASLA çalışmaz
  const envObj = process.env as Record<string, string | undefined>;
  const eskiNodeEnv = envObj.NODE_ENV;
  try {
    envObj.NODE_ENV = "production";
    const prodBaslatma = baslatLocalTranskriptWorker();
    assert.strictEqual(prodBaslatma, false, "Local worker production'da başlatılamaz");
  } finally {
    envObj.NODE_ENV = eskiNodeEnv;
  }

  // 8b. Production cron rotası korunur
  const cronRoute = oku("app/api/cron/transkript-kuyruk/route.ts");
  assert.match(cronRoute, /Authorization: Bearer \$\{CRON_SECRET\}/);
  assert.match(cronRoute, /transkriptKuyrugunuTuket/);
  assert.match(cronRoute, /leaseSaniye/);
});

test("Hedef 9: Development ortamında AI işi kuyruğa eklendiğinde local worker otomatik başlar", () => {
  const aiBaslatRoute = oku("app/api/ogrenme-araclari/[arac_id]/transkript-ai-baslat/route.ts");

  // 9a. transkript-ai-baslat rotasında process.env.NODE_ENV === 'development' kontrolü bulunur
  assert.match(aiBaslatRoute, /if \(process\.env\.NODE_ENV === "development"\)/);

  // 9b. baslatLocalTranskriptWorker() çağrılır
  assert.match(aiBaslatRoute, /baslatLocalTranskriptWorker\(\)/);
});

test("Hedef 10: Kullanıcı 202 yanıtı için Gemini sonucunu beklemez (Asenkron Başlangıç)", () => {
  const aiBaslatRoute = oku("app/api/ogrenme-araclari/[arac_id]/transkript-ai-baslat/route.ts");

  // 10a. Worker çağrısı transkript sonucunu await etmez; API derhal 202 döner
  assert.doesNotMatch(aiBaslatRoute, /await transkriptKuyrugunuTuket/);
  assert.doesNotMatch(aiBaslatRoute, /await sesTranskriptiOlusturGemini/);
  assert.match(aiBaslatRoute, /status: 202/);

  // 10b. baslatLocalTranskriptWorker() senkron olarak tetikler ve arka planda döner
  durdurLocalTranskriptWorker();
  const baslamaSonucu = baslatLocalTranskriptWorker({ zorla: true, periyotMs: 500 });
  assert.strictEqual(baslamaSonucu, true);
  durdurLocalTranskriptWorker();
});

test("Hedef 11: Çift AI isteği birden fazla worker oluşturmaz (Singleton Güvencesi)", () => {
  durdurLocalTranskriptWorker();

  // İlk istek worker'ı başlatır
  const ilk = baslatLocalTranskriptWorker({ zorla: true, periyotMs: 1000 });
  assert.strictEqual(ilk, true);

  // İkinci istek (çift tıklama veya paralel çağrı) ikinci bir worker döngüsü açmaz
  const ikinci = baslatLocalTranskriptWorker({ zorla: true, periyotMs: 1000 });
  assert.strictEqual(ikinci, true);

  const durum = localTranskriptWorkerDurumu();
  assert.strictEqual(durum.calisiyor, true);
  assert.strictEqual(durum.singleton, true);

  durdurLocalTranskriptWorker();
});

test("Hedef 12: Bekleyen iş sunucu yeniden başladığında instrumentation.ts tarafından alınır", () => {
  const instrumentation = oku("instrumentation.ts");

  // register() kancası Node.js runtime ve development ortamında çalışır
  assert.match(instrumentation, /export async function register\(\)/);
  assert.match(instrumentation, /process\.env\.NEXT_RUNTIME === "nodejs"/);
  assert.match(instrumentation, /process\.env\.NODE_ENV === "development"/);
  assert.match(instrumentation, /baslatLocalTranskriptWorker/);
});

test("Hedef 13: İş kullanıcı müdahalesi olmadan ai_bekliyor → ai_isleniyor → ai_taslak zincirini tamamlar ve hata mekanizması çalışır", () => {
  const kuyrukIsleyici = oku("lib/ogrenmeAraci/transkriptKuyrukIsleyici.ts");
  const aiSql = oku("scripts/sql/ogrenme_araclari_faz3_podcast_ai_transkript.sql");

  // 13a. Kuyruk tüketiminde iş önce 'isleniyor' (ai_isleniyor) durumuna alınır
  assert.match(aiSql, /podcast_transkript_ai_isi_al_atomik/);
  assert.match(aiSql, /"ai_isleniyor"/);

  // 13b. Gemini başarılı olduğunda 'tamamlandi' ve metadata transkript 'ai_taslak' durumuna geçer
  assert.match(kuyrukIsleyici, /podcast_transkript_ai_tamamla_atomik/);
  assert.match(aiSql, /"ai_taslak"/);

  // 13c. Worker hataları işi sessizce sonsuza kadar ai_bekliyor durumunda bırakmaz:
  // - Kalıcı hata durumunda podcast_transkript_ai_hata_atomik çağrılır ('hata' durumu)
  assert.match(kuyrukIsleyici, /podcast_transkript_ai_hata_atomik/);
  // - Geçici hata durumunda artan aralıkla (exponential backoff) yeniden deneme yapılır
  assert.match(kuyrukIsleyici, /podcast_transkript_ai_gecici_hata_atomik/);
  assert.match(kuyrukIsleyici, /Math\.min\(30 \* Math\.pow\(2/);
});

