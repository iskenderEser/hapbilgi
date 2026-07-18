# HapBilgi — Web Push Bildirim Katmanı Teknik İş Planı

*Oturumdan bağımsız, rol-farkında, tarayıcı temelli push bildirim orkestrasyonu*

*Sürüm: v1.3 — 17.07.2026. v1.3: K-P12 (hesap-düzeyi ilk rıza — fiziksel test bulgusu üzerine). v1.1: kod taraması sonrası 3 düzeltme (Eczanem K-P3 istisnası, serverless `after()` netlemesi, NULL `auth_user_id` atlama kuralı). v1.2: **P0–P8 uygulandı** (kod `lib/push/` + `app/api/push/abonelik` + SW/manifest + P6 entegrasyonları; DB tabloları/ayarları canlıda; `video_yayini` olayı eklendi; store + pg_cron bulguları C.9'a işlendi). Kalan: C.7 fiziksel test bloğu (insan-yürütümlü) + P9 deploy (C.8 ön koşulları). Kapsam: mevcut in-app bildirim + badge (polling) katmanının ÜSTÜNE eklenen, HapBilgi kapalıyken ve kullanıcı login değilken bile tarayıcı üzerinden teslim edilen bir push katmanı. Bu belge ana teknik raporun (`hapbilgi_teknik_rapor_guncel.md` — bundan sonra "TR") desenine bağlıdır; § referansları TR'ye işaret eder. İş kuralı ayrıntıları geliştikçe bu belge canlı tutulur.*

---

## İçindekiler

- [A. Mevcut Teknik Durum (bu konuya özel)](#a-mevcut-teknik-durum-bu-konuya-özel)
  - [A.1 Bugün var olan bildirim modeli — polling](#a1-bugün-var-olan-bildirim-modeli--polling)
  - [A.2 Bugün var OLMAYAN — push, service worker, PWA](#a2-bugün-var-olmayan--push-service-worker-pwa)
  - [A.3 Yeniden kullanılacak mevcut desenler](#a3-yeniden-kullanılacak-mevcut-desenler)
  - [A.4 "Tarayıcı açılınca gelir" beklentisinin teknik gerçeği](#a4-tarayıcı-açılınca-gelir-beklentisinin-teknik-gerçeği)
  - [A.5 Tarayıcı/işletim sistemi kapsam matrisi](#a5-tarayıcıişletim-sistemi-kapsam-matrisi)
- [B. Talep Edilen Geliştirmenin Tam Tanımı](#b-talep-edilen-geliştirmenin-tam-tanımı)
  - [B.1 Hedef senaryo (kullanıcının gözünden)](#b1-hedef-senaryo-kullanıcının-gözünden)
  - [B.2 Fonksiyonel gereksinimler](#b2-fonksiyonel-gereksinimler)
  - [B.3 Kapsam dışı (bilinçli)](#b3-kapsam-dışı-bilinçli)
  - [B.4 Yeter–gerek koşulların karşılanma biçimi](#b4-yetergerek-koşulların-karşılanma-biçimi)
- [C. Geliştirme Planı](#c-geliştirme-planı)
  - [C.0 Kapalı kararlar (K-P serisi)](#c0-kapalı-kararlar-k-p-serisi)
  - [C.1 Mimari genel bakış — üç katman](#c1-mimari-genel-bakış--üç-katman)
  - [C.2 Veri modeli](#c2-veri-modeli)
  - [C.3 Adım adım uygulama (P0–P9)](#c3-adım-adım-uygulama-p0p9)
  - [C.4 Orkestrasyon olay haritası](#c4-orkestrasyon-olay-haritası)
  - [C.5 Güvenlik ve gizlilik](#c5-güvenlik-ve-gizlilik)
  - [C.6 Kalite, denetim, lint entegrasyonu](#c6-kalite-denetim-lint-entegrasyonu)
  - [C.7 Doğrulama — fiziksel test senaryoları](#c7-doğrulama--fiziksel-test-senaryoları)
  - [C.8 Deploy ön koşulları](#c8-deploy-ön-koşulları)
  - [C.9 Açık işler ve ertelenenler](#c9-açık-işler-ve-ertelenenler)

---

## A. Mevcut Teknik Durum (bu konuya özel)

### A.1 Bugün var olan bildirim modeli — polling

HapBilgi bugün tek bir bildirim modeli işletir: **uygulama-içi bildirim + Navbar badge**, ve teslim mekanizması **polling**'dir (push değil). TR'deki fiili durum şudur:

- Üretim hattı durum geçişlerinde (senaryo/video/soru seti onay–revizyon–iptal) bildirim `lib/utils/bildirimOlustur.ts` ile veritabanına yazılır (TR §3.1). E-Club tarafında karşılığı `lib/utils/eclubBildirim.ts` → `eclub_bildirimler` (TR §4.3). **Eczanem tarafında ise in-app bildirim yazımı YOKTUR** — şemada Eczanem'e ait bildirim tablosu yok; gönderim kaydı bildirim/metrik üretmez (`lib/eczanem/gonderim.ts`, İP-§6.2 izlenme-takibi ilkesi). Bu, "bildirim yapılmasın" diye verilmiş bir karar değil, hiç ele alınmamış bir konudur; push planında Eczanem bu yüzden istisnalı işlenir (K-P3 istisnası).
- Badge'ler, **kullanıcının okunmamış bildirimlerini periyodik olarak sorgulayan bir hook** üzerinden Navbar'da görünür (TR §3.1). Yani istemci sunucuyu belli aralıklarla yoklar — sunucu istemciyi tetiklemez.
- Alıcısız geçişlerde gönderenin badge'i `gonderenBildirimleriOkunduIsaretle()` ile yeni bildirim üretmeden kapatılır (TR §3.1).

Bu model **yerinde kalır**; bu iş onun yerine değil, üstüne eklenir.

### A.2 Bugün var OLMAYAN — push, service worker, PWA

Aşağıdakilerin hiçbiri sistemde tanımlı değildir (kod taraması + TR):

- **Push notification** (OS/tarayıcı bildirimi) — hiçbir katmanda yok. E-Club tarafında "harici kanal (WhatsApp/SMS) bildirimi" açık iş olarak listeli (TR §4.3, §6.4), ama web push hiç ele alınmamış.
- **Service Worker** — Next.js App Router projesinde arka plan servis işçisi yok.
- **PWA manifesti** — `manifest.json` yok; site yüklenebilir uygulama değil.
- **VAPID anahtarları / push aboneliği tablosu** — env'de ve şemada yok.

> **Not — kelime tuzağı.** TR'de "push" kelimesi "git push / Vercel deploy" anlamında geçer ("Push bilinçli bekletiliyor" vb.). Bu belgedeki "push", **push notification**'dır; ikisi karıştırılmamalı.

### A.3 Yeniden kullanılacak mevcut desenler

Bu iş sıfırdan mimari icat etmez; HapBilgi'nin hâlihazırda olgunlaşmış dört desenine oturur:

| Mevcut desen | TR | Push'taki karşılığı |
|---|---|---|
| Provider-agnostik gönderici — `lib/sms/gonderici.ts` (SMS), `lib/utils/aiIstemci.ts` (AI, retry'lı) | §2.7 | `lib/push/gonderici.ts` — VAPID transport'u arayüz arkasına alır, `denemeliFetch` retry desenini taşır |
| Birleşik kimlik + rol tekleştirme — `v_auth_kimlik` + `rolCozucu` | §2.2, §2.4 | Abonelik üç kimlik düzlemi için ortak; rol gönderim anında `rolCozucu` ile çözülür |
| "kim?" (auth) vs "ne?" (yetki) ayrımı | §2.4 | **Abone olmak yalnız "kim?" ister** (her oturum), **gönderim "ne?" yapar** (rol-aware) |
| Tek kaynak + korumalı tablolar + `lint:mimari` | §2.5, §6.2 | İçerik şablonları ve tablolar tek kaynak; yazım yalnız `lib/push/` |
| Test modu çift kilidi — K-E8, `lib/utils/ortam.ts` | Bölüm 5.1 | Canlı-dışı ortamda push no-op; VAPID private key yalnız production |
| Ayarların DB tek-kaynağı — `sistem_ayarlari` (jsonb) | §2.5, §6.1 | TTL, olay bazlı aç/kapa `sistem_ayarlari`'nda |

### A.4 "Tarayıcı açılınca gelir" beklentisinin teknik gerçeği

Talepteki senaryo — "kullanıcı bir gün offline, sonra Chrome'u açıyor, o an bildirimler düşüyor" — teknik olarak şöyle işler ve bu ayrımı en baştan netleştirmek plan boyunca belirleyicidir:

- Push'u **sunucu tetikler**, kullanıcının tarayıcıyı açması değil. Sunucu gönderdiği an cihaz online ise bildirim hemen düşer.
- Cihaz/tarayıcı o an kapalıysa, mesaj push servisinde (Chrome→FCM, Firefox→Mozilla, Safari→Apple) **TTL süresince kuyrukta bekletilir**. Cihaz yeniden online olup tarayıcının arka plan servisi ayağa kalktığında kuyruk boşaltılır. Kullanıcının gözünde "Chrome açılınca geldi" — ama fiilî sebep cihazın yeniden bağlanmasıdır.
- Bu yüzden teslim **best-effort**'tur, %100 garantili değildir (TTL geçerse mesaj düşer; kullanıcı tarayıcıyı hiç açmazsa gelmez). **Sonuç:** push asıl kaynak olamaz — in-app bildirim (A.1) asıl kayıt olarak kalmalı, push yalnız "haberdar etme" katmanı olmalıdır (bkz. K-P3).

### A.5 Tarayıcı/işletim sistemi kapsam matrisi

| Ortam | Web Push | Şart |
|---|---|---|
| Chrome — masaüstü (Win/macOS/Linux) + Android | Tam destek | İzin. Teslim için tarayıcının arka plan süreci gerekir |
| Edge / Firefox / Opera — masaüstü | Tam destek | İzin |
| Safari — macOS 16.1+ (2022) | Tam destek | İzin, normal ziyaret yeter |
| Safari — iOS/iPadOS 16.4+ (2023) | **Kısıtlı** | Site **"Ana Ekrana Ekle" ile PWA olarak kurulmuş** olmalı; normal sekmeye push gitmez |

Masaüstü ağırlıklı bir kitle için senaryo neredeyse birebir çalışır. iPhone kullanıcıları, siteyi PWA olarak kurmadıkça kapsam dışıdır — bu bilinçli kabul edilen bir kısıttır (K-P1).

---

## B. Talep Edilen Geliştirmenin Tam Tanımı

### B.1 Hedef senaryo (kullanıcının gözünden)

Kullanıcı — hangi rolde olursa olsun (UTT, BM, üretici, İU, eczacı, eczane müşterisi) — HapBilgi'ye Chrome/Safari ile **bir kez** girip izin verir. Sonra çıkış yapar ya da tarayıcıyı kapatır. Aradan zaman geçer; bu sırada sistemde onu ilgilendiren bir şey olur (senaryosu revizyon ister, kendisine video önerilir, siparişi onaylanır…). Kullanıcı bilgisayarını açıp tarayıcıyı bir sebeple aktive ettiğinde — **HapBilgi'ye login olmadan** — birikmiş bildirimler cihazına düşer. Bildirime tıklarsa uygulamaya (gerekirse login ekranına) gelir.

### B.2 Fonksiyonel gereksinimler

1. **Oturumdan bağımsızlık.** Bir kez izin + abonelik alındıktan sonra push, kullanıcı login olmasa da çalışır. Abonelik logout'ta silinmez (bkz. K-P2).
2. **Rol-farkında orkestrasyon.** Merkezî bir mantık, "hangi olay → hangi role → hangi içerik" kararını verir. Aynı olay farklı rollere farklı içerikle gider (örn. bir üretim hattı geçişi İU'ya ve üretici role farklı metinle).
3. **Üç kimlik düzlemini de kapsar.** `kullanicilar`, `eclub_kisiler`, `eczanem_musteriler` — üçü de abone olabilir ve push alabilir.
4. **Tarayıcı temelli, native değil.** Web Push. Mobil uygulama yoktur, gerekmez.
5. **Mevcut polling'in üstüne, yerine değil.** In-app bildirim + badge asıl kayıt; push haberdar etme katmanı.
6. **Yönetilebilir.** TTL, olay bazlı aç/kapa gibi parametreler tek kaynaktan (`sistem_ayarlari`) yönetilir.

### B.3 Kapsam dışı (bilinçli)

- Native mobil push (FCM/APNs + uygulama) — mobil yok, ihtiyaç yok.
- iOS Safari'de PWA kurmayan kullanıcıya teslim — platform kısıtı (A.5).
- Push'un %100 garantili teslimi — protokol best-effort (A.4); garanti in-app katmandadır.
- WhatsApp/SMS harici bildirim (E-Club açık işi, TR §6.4) — ayrı iş; bu plan yalnız web push'tur.

### B.4 Yeter–gerek koşulların karşılanma biçimi

| Koşul | Nasıl karşılanır |
|---|---|
| **1 — Mevcut HapBilgi dokusuna birebir uygun** | Provider-agnostik gönderici (§2.7 ikizi), `rolCozucu`/`v_auth_kimlik` (§2.4), route=ince/lib=kalın (§2.6), tek kaynak + korumalı tablo + `lint:mimari` (§2.5/§6.2), K-E8 test modu deseni, `sistem_ayarlari` — hepsi yeniden kullanılır (A.3) |
| **2 — Uluslararası kod/mimari standartlarına uygun** | Web Push Protocol (RFC 8030), VAPID (RFC 8292), payload şifreleme (RFC 8291); istemci tarafında standart Service Worker + Push API + Notifications API. `web-push` kütüphanesi açık standardı uygular (sağlayıcıya kilitlemez) |
| **3 — Yüksek kalite** | Best-effort'un in-app ile yedeklenmesi, ölü abonelik budaması, payload gizlilik minimizasyonu, test modu çift kilidi, denetim/lint temizliği, fiziksel test bloğu (C.7) |

---

## C. Geliştirme Planı

### C.0 Kapalı kararlar (K-P serisi)

**K-P1 — Teslim kanalı: Web Push (VAPID), native değil.** Web Push Protocol + VAPID + RFC 8291 şifreleme. Kapsam A.5 matrisidir; iOS-Safari-PWA-dışı kısıt bilinçli kabul edilir.

**K-P2 — Abonelik kimlik düzlemi bağımsızdır ve oturumdan bağımsız yaşar.** `push_abonelikleri.auth_user_id`, üç kimlik düzleminin (kullanicilar/eclub_kisiler/eczanem_musteriler) ortak paydası olan Supabase auth id'sine bağlanır; tek bir iş tablosuna FK verilmez. **Rol abonelikte SAKLANMAZ** — gönderim anında `rolCozucu` (§2.4) ile çözülür, böylece rol değişikliği aboneliği bayatlatmaz (rolCozucu felsefesinin push'a taşınması). Abonelik logout'ta silinmez; yalnız ölü dönüş (K-P5) ya da kullanıcının izni geri çekmesi onu düşürür. **Bu karar talebin çekirdeğidir:** "kullanıcı login olmadan, sadece tarayıcıyı açtı, mesaj geldi" ancak abonelik oturumdan bağımsız yaşarsa mümkündür.

PK→auth eşlemesi ve NULL kuralı: `kullanicilar.kullanici_id` auth id'nin kendisidir (`bildirimler.alici_id` doğrudan kullanılır); `eclub_kisiler` ve `eczanem_musteriler`'de eşleme `auth_user_id` kolonu üzerinden orkestrasyonda yapılır. `eclub_kisiler.auth_user_id` **nullable**'dır (giriş kimliği olmayan kişi) — `auth_user_id`'si NULL olan alıcı gönderimde **sessizce atlanır** (giriş yapamayan kişi abone de olamaz; hata değildir, loglanmaz).

**K-P3 — Push, in-app bildirimin yan etkisidir; asıl kaynak değildir.** Teslim best-effort'tur (A.4). Push, in-app bildirim veritabanına YAZILDIKTAN sonra tetiklenir; başarısız olursa in-app kayıt ve iş akışı bozulmaz (yalnız loglanır — "tur açılışı başarısız olursa yayın geri alınmaz, uyarı loglanır" deseni, §2.8; ve "kritik iş mantığı üçüncü taraf sağlayıcıya emanet edilmez", §2.7). Badge/okundu gerçeği in-app katmanda kalır.

> **İstisna — Eczanem (İskender kararı, 16.07.2026).** Eczanem'de in-app bildirim katmanı hiç kurulmamıştır (A.1); push'un bağlanacağı bir in-app kayıt yoktur. Karar: Eczanem push'u **doğrudan iş olayından** (gönderim/sipariş yazan lib fonksiyonundan) tetiklenir; in-app kayıt ön şartı bu düzlemde aranmaz. `push_gonderim_kayitlari` bu düzlemde tek denetim izidir. Eczanem'e in-app bildirim katmanı eklenirse istisna kapanır ve genel kurala dönülür (C.9'a açık iş).

**K-P4 — Provider-agnostik gönderici.** `lib/push/gonderici.ts`, `lib/sms/gonderici.ts`'in ikizidir (§2.7). `web-push` bir sağlayıcı SDK'sı değil açık standart (RFC 8291 şifreleme, VAPID imzalama) uygulamasıdır — elle yazmak riskli olduğundan kullanılır, ama transport arayüz arkasına alınır; ince-bağımlılık felsefesine (§2.1) aykırı değildir (Supabase/Recharts gibi standart bir bağımlılıktır, Bunny/AI gibi provider-lock değil). Geçici hatalarda `denemeliFetch` deseniyle (§2.7) exponential backoff.

**K-P5 — Ölü abonelik budaması.** Push servisi `404`/`410` dönerse abonelik `aktif_mi=false` yapılır (endpoint geçersiz). Endpoint rotasyonu için her login/app-load'da abonelik `endpoint` üzerinden upsert edilir.

**K-P6 — Payload minimizasyonu (gizlilik).** Push yükü üçüncü taraf push servislerinden (FCM/Apple/Mozilla) geçtiğinden **PII taşımaz**. Başlık/gövde jeneriktir ("Yeni bir video önerildi"); ayrıntı, tıklamada uygulama içinden (authed) çekilir. Eczanem'de müşteri kimliği/adı asla yüke girmez — İP-§9 gizlilik ilkesiyle (kişi verisi hiçbir role sızmaz, TR §5.5) birebir uyum.

**K-P7 — Test/no-op modu.** Canlı-dışı ortamda push gönderimi no-op'tur (veya yalnız konsol log); çift kilit `lib/utils/ortam.ts` (`VERCEL_ENV`/`NODE_ENV`) ile production dışında gerçek gönderimi yapısal olarak kapatır (K-E8 deseni, TR Bölüm 5.1). VAPID **private** key yalnız production env'de tanımlıdır; **public** key (`NEXT_PUBLIC_`) her ortamda tanımlıdır ki abonelik/izin akışı preview ve local'de de denenebilsin — gerçek gönderim kilidi private key yokluğu + `canliOrtamMi()` çift kilididir. "Kaldırmayı unutma" riski yoktur.

**K-P8 — Tek yazım noktası + korumalı tablolar.** `push_abonelikleri` ve `push_gonderim_kayitlari`, `KORUMALI_TABLOLAR`'a eklenir; tek meşru yazım noktası `lib/push/`'tur (`lint:mimari` `kayit-tek-kaynak` muafiyeti — `lib/eczanem/` deseni, §6.2).

**K-P9 — Ölçek: senkron fan-out yeterli, dayanıklı kuyruk sonraya.** Mevcut ölçekte (~500–1000 kullanıcı, §2.5) gönderim istek içinde yapılır; ayrı kuyruk/worker kurulmaz. **Serverless gerçeği:** Vercel'de route yanıtı döndükten sonra function donabilir — çıplak (await'siz) fire-and-forget promise'ler yarıda ölebilir. Bu yüzden fan-out ya `next/server`'ın `after()` mekanizmasıyla koşulur (yanıtı geciktirmez, yanıt sonrası işin tamamlanmasını platform garanti eder — tercih edilen) ya da düz `await` edilir; her iki yolda da hata yutulur ve loglanır (K-P3). Büyük ölçekte dayanıklı kuyruk (`push_kuyrugu` tablosu + worker/edge function) geçiş yolu olarak durur — "HB Ligi ölçek notu"nun (§2.5, §6.4) push karşılığı. Erken optimizasyon yapılmaz.

**K-P10 — Olay→rol→içerik eşlemesi tek kaynaktır.** Orkestrasyon, alıcı çözümünde `roller.ts` (§2.3) kümelerini kullanır; içerik şablonları `lib/push/icerik.ts`'te rol-aware ve tek kaynaktır (koda dağılmış string yoktur — TR §2.5 İlke 3).

**K-P11 — Abone olmak rol-agnostiktir, göndermek rol-aware'dir.** `/api/push/abonelik` yalnız geçerli oturum ister (herkes abone olabilir), rol kapısı yoktur. Rol mantığı gönderim (orkestrasyon) anında uygulanır. Bu, §2.4'teki "kim?/ne?" ayrımının push'a düşmesidir.

**K-P12 — Hesap-düzeyi ilk rıza; sessiz otomatik abonelik yoktur (İskender kararı, 17.07.2026).** Tarayıcı izni SİTEYE verilir (cihaz kapsamı — platform kuralı), abonelik ise HESABA açılır. İlk uygulama, cihaz izni varken giren her hesabı sorgusuz abone ediyordu (fiziksel testte yakalandı: aynı tarayıcıda hesap değiştikçe abonelik rızasız el değiştirdi). Karar: cihazda tarayıcı izni verilmiş olsa bile, o cihazda daha önce rıza vermemiş her hesabın ilk girişinde yumuşak kart çıkar; "İzin ver" denmeden o hesap adına abonelik açılmaz/devralınmaz. Cihaz izni zaten varsa tarayıcı prompt'u tekrar görünmez — tek tık yeter. Rıza ve erteleme anahtarları hesaba özeldir (`hb_push_onay_<id>`, `hb_push_erteleme_<id>`, localStorage — rıza cihaz+hesap kapsamındadır, DB gerektirmez). Bilinçli yan etki: ortak cihazda rıza vermeyen hesap çalışırken son rıza verenin (PII'siz — K-P6) bildirimi düşebilir; satır son rıza verende kalır. Kalıcı, cihazlar-arası tercih paneli C.9'daki açık iştir.

### C.1 Mimari genel bakış — üç katman

```
[İSTEMCI]                    [SUNUCU / lib]                     [DIŞ]
Service Worker (sw.js)  ─┐   /api/push/abonelik (route, ince)   Push servisi
Push aboneliği           ├─▶ lib/push/abonelik.ts  ───────────▶ (FCM/Mozilla/Apple)
usePushAbonelik hook     │   lib/push/orkestrasyon.ts  ◀── olay      │
İzin UI                 ─┘   lib/push/icerik.ts (rol→içerik)         │
        ▲                    lib/push/gonderici.ts (VAPID, retry) ───┘
        └──────────────── showNotification / notificationclick ◀─────┘
```

Üç katman ve sorumlulukları:

- **İstemci katmanı** — Service Worker push olayını yakalar ve `showNotification` ile OS balonunu gösterir; site kapalıyken çalışan tek parça budur. `usePushAbonelik` hook'u izin ister ve aboneliği upsert eder.
- **Sunucu/lib katmanı** — route yalnız orkestrasyondur (auth + validasyon + lib çağrısı, §2.6). Asıl mantık `lib/push/`'ta: abonelik saklama, olay→rol→alıcı çözümü, rol-aware içerik, VAPID gönderimi.
- **Dış katman** — tarayıcının push servisi (VAPID sunucu anahtarıyla imzalı istekleri alır, cihaza teslim eder). HapBilgi bu servise doğrudan bağlanmaz; `web-push` protokolü konuşur.

### C.2 Veri modeli

İki yeni tablo. Mevcut şema (§2.2, §2.5) desenine — nullable denormalizasyon, kayıt-anı simetrisi — uyumludur.

**`push_abonelikleri`** — bir kullanıcının bir tarayıcısındaki aboneliği.

| Kolon | Tip | Not |
|---|---|---|
| `abonelik_id` | uuid PK | |
| `auth_user_id` | uuid | Supabase auth id — üç kimlik düzleminin ortak paydası (K-P2). İş tablosuna FK YOK |
| `endpoint` | text | **UNIQUE** — push servisi teslim adresi; abonelik kimliğinin doğal anahtarı |
| `p256dh` | text | İstemci public anahtarı (şifreleme, RFC 8291) |
| `auth` | text | İstemci auth secret'ı |
| `user_agent` | text (nullable) | Teşhis/temizlik için |
| `aktif_mi` | boolean | Ölü budamada `false` (K-P5); fiziksel silme değil (§2.5 felsefesi) |
| `created_at` | timestamptz | |
| `son_gorulme` | timestamptz | Her upsert'te güncellenir |

**`push_gonderim_kayitlari`** — gönderim denetim kaydı (opsiyonel ama denetim kültürüne, §6.2, uygun).

| Kolon | Tip | Not |
|---|---|---|
| `gonderim_id` | uuid PK | |
| `auth_user_id` | uuid | Alıcı |
| `olay_turu` | text | C.4 haritasındaki olay |
| `alici_rol` | text | **Gönderim anındaki rol** — kayıt-anı simetrisi (§2.5); sonradan rol değişse de kayıt donar |
| `durum` | text | `gonderildi` / `basarisiz` / `abonelik_olu` |
| `created_at` | timestamptz | |

> **Not.** Push içeriği (başlık/gövde) kayıtta tutulabilir ama gizlilik gereği (K-P6) yalnız olay türü + rol tutmak yeterlidir; PII'siz denetim izi bırakır.

Yeni tablolar mevcut karar gereği (K-E7, §6.4) **RLS'siz doğar**, `service_role`'e GRANT'li, `anon/authenticated`'a kapalı; RLS açık iş listesine eklenir (bkz. C.8).

### C.3 Adım adım uygulama (P0–P9)

Eczanem'in U0–U9 dizisiyle aynı disiplinde; her adım `tsc` + `denetim` + `lint:mimari` temiz kapanır.

**P0 — Zemin.**
- `web-push` bağımlılığını ekle (yalnız sunucu tarafı; istemciye bundle edilmez).
- VAPID anahtar çifti üret (`npx web-push generate-vapid-keys`). Env'e ekle: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (istemci), `VAPID_PRIVATE_KEY` (sunucu), `VAPID_SUBJECT` (`mailto:` — RFC 8292 zorunlu alanı). Grupları §6.3 env listesine işle.
- `sistem_ayarlari`'na anahtarlar: `push_ttl_saniye` (varsayılan ör. 259200 = 3 gün), `push_olay_aktif` (jsonb — olay bazlı aç/kapa). Yeni anahtar migration'dır (§6.1).
- İki tabloyu (`push_abonelikleri`, `push_gonderim_kayitlari`) migration ile aç.
- `lib/push/tipler.ts` — abonelik, olay, içerik tipleri tek kaynak.

**P1 — Service Worker + PWA manifesti.**
- `public/sw.js` — `push` olay handler'ı (`event.data.json()` → `self.registration.showNotification(baslik, { body, data:{url}, icon, badge })`) ve `notificationclick` handler'ı (`clients.openWindow`/`focus` → `data.url`). SW kök scope'ta (`/sw.js`) sunulur.
- `public/manifest.json` — iOS PWA kurulumu ve masaüstü yüklenebilirlik için (ad, ikonlar, `start_url`, `display: standalone`). `app/layout.tsx`'e manifest + gerekli meta.
- `proxy.ts` matcher'ının `/sw.js` ve `/manifest.json`'u statik-dışlama kapsamında geçirdiğini doğrula (§2.4 — `config.matcher` statik dosyaları dışlar); gerekirse negatif-lookahead'e ekle. SW'nin doğru `Content-Type` ve kök `Service-Worker-Allowed` ile sunulduğunu doğrula.

**P2 — İstemci abonelik akışı.**
- `lib/push/istemci.ts` (client) — SW register, `Notification.permission` kontrolü, `pushManager.subscribe({ userVisibleOnly:true, applicationServerKey: VAPID_PUBLIC })`, aboneliği `/api/push/abonelik`'e POST.
- `usePushAbonelik` hook + yumuşak izin UI'ı (tarayıcının ham prompt'unu doğrudan değil, önce kısa bir açıklama kartıyla iste — uluslararası UX iyi pratiği; reddedilirse zorlama yok). İlk login'de ve her app-load'da aboneliği tazele (K-P5 upsert).

**P3 — Abonelik saklama (route ince + lib kalın).**
- `app/api/push/abonelik/route.ts` — POST: oturum çöz (`createServerClient` → `auth.getUser()`, §2.4), **rol kapısı YOK** (K-P11), `lib/push/abonelik.ts`'i çağır. DELETE: kullanıcı izni geri çekince aboneliği pasifle.
- `lib/push/abonelik.ts` — `abonelikUpsert()` (endpoint UNIQUE üzerinden), `abonelikPasifle()`. Korumalı tablonun tek yazım noktası (K-P8).

**P4 — Provider-agnostik gönderici.**
- `lib/push/gonderici.ts` — `pushGonder(abonelik, yuk)`: `web-push`'u VAPID ile çağırır, `denemeliFetch` benzeri retry (geçici hata: 429/500/502/503/504 → backoff; kalıcı: 400/401/403/404/410 → retry yok). `404`/`410` → `abonelikPasifle()` (K-P5). Test modunda no-op (K-P7). Transport arayüz arkasında (K-P4).

**P5 — Orkestrasyon merkezi + rol-aware içerik.**
- `lib/push/orkestrasyon.ts` — `pushYayinla(olay, baglam)`: olaydan alıcı auth_user_id kümesini çözer (rol kümeleri `roller.ts`'ten, §2.3; kişinin rolü `rolCozucu`'dan, §2.4), her alıcının aktif aboneliklerini çeker, her biri için `lib/push/icerik.ts`'ten **role uygun** içeriği üretir, `gonderici.ts` ile gönderir, `push_gonderim_kayitlari`'na `alici_rol` snapshot'ıyla yazar (kayıt-anı simetrisi).
- `lib/push/icerik.ts` — `(olayTuru, aliciRol) → {baslik, govde, url, icon}` tek kaynak eşlemesi (K-P10). PII taşımaz (K-P6).

**P6 — Mevcut bildirim noktalarına entegrasyon.**
- `bildirimOlustur.ts` (§3.1) ve `eclubBildirim.ts` (§4.3) — in-app bildirim veritabanına yazıldıktan **sonra**, aynı yerden `pushYayinla()` çağrılır. Çağrı `after()` içinde ya da hata-yutan `await` ile koşulur (K-P9); in-app yazımın transaction'ı push'a bağlı değildir (K-P3).
- **Eczanem (K-P3 istisnası)** — in-app bildirim katmanı olmadığından `pushYayinla()` doğrudan iş olayını yazan lib fonksiyonlarından (gönderim/sipariş, `lib/eczanem/`) çağrılır. Alıcı `eczanem_musteriler.auth_user_id` / eczacı auth id'sidir; K-P6 gereği yükte kişi verisi yoktur.

**P7 — Kalite/denetim.**
- İki tabloyu `KORUMALI_TABLOLAR`'a, `lib/push/`'u `kayit-tek-kaynak` muafiyetine ekle (§6.2). `olu-rpc`/`dogru-client` kuralları yeni kodu kapsar. `denetim` (kod↔DB) ve `lint:mimari` temiz koşum.

**P8 — RLS + güvenlik kapanışı.** C.5 + C.8'e göre.

**P9 — Deploy.** C.8'e göre — Vercel env (VAPID) + push disiplini (§6.3).

### C.4 Orkestrasyon olay haritası

"Rol-aware içerik" tam olarak burada somutlaşır. Aynı olay farklı role farklı metinle gider; alıcı kümesi mevcut rol kümelerinden (§2.3) türetilir.

| Olay | Mevcut in-app kaynak (§) | Alıcı(lar) | İçerik ekseni (PII'siz) |
|---|---|---|---|
| Üretim hattı durum geçişi (senaryo/video/soru seti onay–revizyon–iptal) | `bildirimOlustur.ts` (§3.1, §2.8) | İU + ilgili üretici rol | İU: "Bir içeriğe revizyon istendi"; üretici: "İçeriğiniz onaya hazır" — role göre farklı |
| Video önerisi (BM/TM → UTT) | öneri akışı (§3.1) | hedef UTT | "Size yeni bir video önerildi" |
| Video yayına girdi (app-tarafı, `kayit_turu='yayin'`) | `bildirimOlustur.ts` — yayın yönetimi | hedef UTT | "Yeni bir video yayında" (P6'da eklendi; pg_cron aktivasyon bildirimi kapsam DIŞI — C.9) |
| E-Club öneri (UTT → kişi) | `eclubBildirim.ts` (§4.3) | eclub_kisi | "Eczanenizden yeni bir video önerisi var" |
| Challenge (BM → BM) | challenge akışı (§3.3) | alan BM | "Size bir challenge geldi" |
| Eczanem gönderim/sipariş onayı | **in-app kaynak YOK** — doğrudan iş olayından, `lib/eczanem/` (K-P3 istisnası) | müşteri / eczacı | "Yeni bir video var" / "Bir işlem onay bekliyor" — kişi verisi yok (K-P6, §5.5) |
| HBStore / E-Club Store sipariş durumu | **in-app kaynak YOK** (P6 taraması: store durum değişikliği bildirim üretmiyor) — C.9 açık işi | sipariş sahibi | "Siparişinizde gelişme var" (içerik `icerik.ts`'te hazır; tetik noktası açık iş) |

Yeni olay eklemek: `icerik.ts`'e satır + `pushYayinla` çağrısı — koda dağılmış özel iş gerekmez (tek kaynak, K-P10).

### C.5 Güvenlik ve gizlilik

- **VAPID gizli anahtarı** yalnız sunucu env'inde (`VAPID_PRIVATE_KEY`); public anahtar istemcide (`NEXT_PUBLIC_`). Payload şifrelemesi (RFC 8291) `web-push` tarafından otomatik yapılır.
- **Payload minimizasyonu (K-P6)** — üçüncü taraf push servisinden geçen yükte PII yok; detay tıklamada authed çekilir. Eczanem gizlilik ilkesiyle (§5.5) uyum.
- **Abonelik tablosu korumalı** (K-P8); `service_role` erişimli, `anon/authenticated`'a kapalı (K-E7 deseni).
- **Abone endpoint'i auth ister** (K-P11) ama rol istemez; kötüye kullanım (başkası adına abonelik) engeli, aboneliğin oturumdaki `auth_user_id`'ye bağlanmasıdır — istemci auth_user_id'yi seçemez.
- **İzin geri çekme** — kullanıcı tarayıcıdan izni kaldırırsa istemci bunu algılar ve `DELETE /api/push/abonelik` ile aboneliği pasifler.

### C.6 Kalite, denetim, lint entegrasyonu

- `denetim` (kod↔DB, §6.2) yeni tabloları/kolonları otomatik kapsar — elle liste yok; `sema-cek` DB'den çeker.
- `lint:mimari`: `kayit-tek-kaynak` korumalı tabloları `lib/push/` dışından yazıma kapatır; `dogru-client` doğru Supabase client'ı zorlar; `olu-rpc` push RPC'si eklenirse (K-P9 kuyruk yolunda) kapsar.
- Commit disiplini (§6.3): `feat: push abonelik altyapisi`, `feat: push orkestrasyon rol-aware icerik` gibi tek-amaçlı commit'ler; hepsi üç doğrulamadan (tsc + denetim + lint:mimari) geçer.

### C.7 Doğrulama — fiziksel test senaryoları

Push, teslim doğası gereği (A.4) yalnız gerçek tarayıcı/cihazla doğrulanır (Eczanem U10/U11 mantığı — insan-yürütümlü test, §6.4). Push öncesi şart:

1. İzin akışı — default/granted/denied üç halde doğru davranış; reddedilince zorlama yok.
2. Abonelik upsert — aynı tarayıcıda tekrar login endpoint'i çoğaltmaz (UNIQUE); farklı tarayıcı ayrı abonelik.
3. **Oturumdan bağımsız teslim (talebin çekirdeği)** — login → izin → logout → sunucudan olay → Chrome kapalı/açık senaryosunda bildirimin düşmesi; tıklayınca login'e/uygulamaya gelme.
4. TTL — cihaz uzun offline → tekrar online'da kuyruğun boşalması; TTL aşımında düşme.
5. Rol-aware içerik — aynı olayın İU ve üretici role farklı metinle gitmesi.
6. Üç kimlik düzlemi — kullanıcı, eclub_kisi ve eczanem müşterisi için ayrı ayrı teslim.
7. Gizlilik — Eczanem push'unda hiçbir katmanda kişi adı/kimliği yok (§5.5, K-P6).
8. Ölü budama — geçersiz endpoint 410 → abonelik pasifleniyor, tekrar denenmiyor.
9. Test modu — canlı-dışı ortamda gerçek gönderim yapılmıyor (K-P7 çift kilit).
10. Safari — macOS'ta normal, iOS'ta yalnız PWA kurulumunda çalıştığının teyidi (A.5).
11. Best-effort kanıtı — push başarısızken in-app bildirim + badge'in bozulmadan çalışması (K-P3).

### C.8 Deploy ön koşulları

- **VAPID anahtarları** production Vercel env'inde tanımlı (`VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`) — SMS sağlayıcı env'lerinin (§6.3, Bölüm 5.1) push karşılığı; tanımsızsa production'da gönderim no-op kalır.
- **RLS** — `push_abonelikleri` + `push_gonderim_kayitlari`, §6.4'teki genel RLS mecburi işine eklenir (RLS'siz doğar, K-E7 deseni; deploy öncesi RLS + service_role/anon sınırı netleştirilir).
- **Fiziksel test bloğu (C.7)** kapanmadan push edilmez — mevcut push disiplini (§6.3): biriken commit'ler tek hazır durum olarak yayınlanır.
- **Service Worker + manifest** production'da kök scope'tan doğru sunuluyor (P1 doğrulaması).

### C.9 Açık işler ve ertelenenler

- **Dayanıklı kuyruk (K-P9)** — büyük ölçekte `push_kuyrugu` + worker/edge function; şimdilik senkron fan-out. HB Ligi ölçek notunun (§2.5) kardeşi.
- **Okundu/etkileşim geri bildirimi** — push tıklanma metriği; ihtiyaç doğarsa `push_gonderim_kayitlari`'na `tiklandi_mi` kolonu.
- **E-Club harici kanal (WhatsApp/SMS)** — TR §4.3/§6.4'teki ayrı açık iş; web push onu kapatmaz, tamamlar.
- **Kullanıcı tercih paneli** — olay bazlı push aç/kapa'yı kullanıcı düzeyine indirme (şimdilik yalnız `sistem_ayarlari` global); ihtiyaç doğarsa `push_tercihleri` tablosu.
- **iOS kapsamı** — PWA kurulum teşviki (in-app "Ana Ekrana Ekle" yönlendirmesi) ayrı UX işi.
- **Eczanem in-app bildirim katmanı** — push tüm rollerde geliştirilecek; Eczanem'e ileride in-app bildirim + badge eklenirse K-P3 istisnası kapanır, push orada da genel kurala (in-app yan etkisi) döner.
- **pg_cron yayın aktivasyonu push üretmez** (P6 bulgusu) — `yayin_planlananlari_aktive()` DB fonksiyonu in-app bildirimleri DB içinde yazar (§2.8), lib katmanından geçmediği için push tetiklenmez. Planlanan yayınların UTT push'u için yol: aktivasyonu izleyen app-tarafı tetik ya da DB→HTTP webhook; ihtiyaç netleşince ele alınır. (Hemen Yayınla app yolu `bildirimOlustur` üzerinden push üretir.)
- **Store sipariş durumu bildirimsiz** (P6 bulgusu) — HBStore/E-Club Store durum değişiklikleri bugün in-app bildirim de üretmiyor; K-P3 gereği push da yok. `icerik.ts`'te `store_siparis` içeriği hazır; in-app bildirim eklendiğinde `pushYayinla` çağrısı tek satırdır.
