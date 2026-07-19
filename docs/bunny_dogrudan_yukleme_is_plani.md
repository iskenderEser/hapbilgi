# Bunny Doğrudan Yükleme — İş Planı

*19.07.2026. Kaynak bulgu: F-05 (docs/fiziksel_tespitler_ve_cozumler.md) — testin açığa çıkardığı gerçek sorun "yanlış link yapıştırma" değil, insanın Bunny panelinden link taşıdığı iş akışının kendisidir. İskender onayı: "çok iyi bir geliştirme olur, IU iş sürecini %50 azaltır" (19.07).*

## Amaç ve mimari karar

IU video yükleme akışından Bunny paneli ve link taşıma tümüyle çıkar: IU, HapBilgi ekranında dosya seçer; dosya tarayıcıdan **doğrudan Bunny'ye** yüklenir (bizim sunucuya uğramaz); sistem video kimliğini kendisi kaydeder.

**Depolama formülü (19.07 mutabakatı):** dosya Bunny'de, kimlik Supabase'de, izleme Bunny oynatıcısından. Supabase'e video dosyası hiçbir aşamada girmez (CDN/encode/bant genişliği işi Bunny'nin).

**Geleceğe uygunluk:** IU bugün insan; ileride otomatikleşebilir (İskender notu, 19.07: "insan-şimdilik"). Bu yüzden sunucu ucu, ekrandan bağımsız programatik çağrılabilir tasarlanır.

## Aşamalar

### A0 — Altyapı teyidi (keşif)
- Bunny Stream API ile video kaydı açma (`POST /library/{id}/videos`) ve TUS imza formülünün (SHA256: library API key + video GUID + son kullanma) küçük bir dosyayla uçtan uca denenmesi. Test, İskender'in test hesabında (hb2026 / 707975) yapılır.
- Env zaten hazır: `BUNNY_LIBRARY_ID`, `BUNNY_API_KEY`, `NEXT_PUBLIC_BUNNY_PULL_ZONE` (19.07'de hb2026 değerlerine eşitlendi).

### A1 — Sunucu ucu: yükleme başlatma ("vezne" modeli — İskender çerçevesi, 19.07)
IU = çalışan, sistem = şirketin veznesi; A1 o veznenin kuralları:
1. **Kimlik ve sıra kontrolü:** (a) oturum + rol gerçekten IU mu; (b) bu videonun sırası gerçekten yükleme mi (durum "revizyon bekleniyor" ya da ilk yükleme). Yetkisiz veya sırası gelmemiş istek Türkçe gerekçeyle reddedilir.
2. **Kaydı şirket açar, adı şirket koyar:** Bunny'deki video kaydını sistem açar, adı sistem verir (ör. `hepifarma_normavas_v2`) — kütüphane düzeni çalışanın adlandırma disiplinine emanet edilmez.
3. **Anahtar kasada, çalışana günlük kart:** API anahtarı yalnız sunucuda; IU'nun tarayıcısına inen şey TEK videoya özel, SÜRELİ yükleme imzası. Başka kapı açmaz; IU değişse Bunny tarafında iptal edilecek şey yoktur.
4. **Tutanak:** kim, hangi senaryo, hangi video kimliği, ne zaman — Supabase'e işlenir.
5. **Çalışan yarın robot olabilir:** uç, ekrana değil sözleşmeye bağlı — ileride yapay IU aynı ucu aynı kurallarla çağırır ("insan-şimdilik" notunun teknik karşılığı).
- Uç: `POST /videolar/api/bunny-yukleme-baslat` → `{video_guid, imza, sonKullanma, libraryId}`. Türkçe hata yönetimi (Bunny erişilemedi / limit / yetki).

### A2 — İstemci: dosya seç + doğrudan yükleme
- IU ekranındaki URL alanı yerine "Video dosyası seç" (+ sürükle-bırak); `tus-js-client` ile tarayıcıdan Bunny'ye doğrudan, kaldığı yerden devam edebilen yükleme; ilerleme çubuğu (%).
- Yükleme bitince sistem `video_url`'yi kanonik embed adresi olarak KENDİSİ yazar (`player.mediadelivery.net/embed/{lib}/{guid}`) — mevcut PUT rotası ve "inceleme bekleniyor" akışı aynen.
- Şema notu: ayrı `bunny_video_id` kolonu ilk fazda GEREKMEZ — GUID, embed URL'nin içinde; ihtiyaç doğarsa türetilir.

### A3 — Encode durumu (küçük)
- Bunny işlemeyi bitirmeden izleme açılmayabilir; kartta "video işleniyor" rozeti (Bunny video status sorgusu — kaydet anında + kart açılışında kontrol; sürekli polling yok).

### A4 — Hazır video akışı (faz 2, ayrı karar)
- Talep formundaki "hazır video" bugün Supabase storage'a gidiyor; IU indirip Bunny'ye taşıyordu. Aynı doğrudan-Bunny akışına alınması ayrı fazdır — kapsam ve sıra İskender kararı.

### A5 — Güvenlik fazı (canlı öncesi, ayrı iş)
- Bunny embed token authentication + CDN token: izleme istekleri sunucu imzalı olur, paneldeki güvenlik anahtarları o zaman açılır. Test döneminde anahtarlar kapalı (erişim tahmin edilemez GUID'e bağlı — kabul edilen risk, İskender 19.07).

## Doğrulama disiplini
- Her aşama: üçlü doğrulama + en fazla 1 smoke; canlı Bunny yazımı yalnız test hesabına.
- Fiziksel doğrulama İskender'de: gerçek dosyayla IU yüklemesi → PM izlemesi → kapak otomatik. Testin amacı akışı bitirmek değil, iyileştirme ihtiyaçlarını göstermektir.

## Riskler / sınırlar
- Dosya sunucudan geçmediği için Vercel gövde limiti sorun değil; sunucu yalnız imza üretir.
- Free Bunny hesabı süre/limitleri test kesintisi yaratabilir (F-05'te yaşandı).
- Encode süresi UX'i: A3 rozeti bu belirsizliği kullanıcıya dürüstçe gösterir.
- Yeni bağımlılık: `tus-js-client` (Bunny'nin resmî önerdiği yol).
