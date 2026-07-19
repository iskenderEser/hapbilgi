# Bunny Doğrudan Yükleme — İş Planı

*19.07.2026. Kaynak bulgu: F-05 (docs/fiziksel_tespitler_ve_cozumler.md) — testin açığa çıkardığı gerçek sorun "yanlış link yapıştırma" değil, insanın Bunny panelinden link taşıdığı iş akışının kendisidir. İskender onayı: "çok iyi bir geliştirme olur, IU iş sürecini %50 azaltır" (19.07).*

## Amaç ve mimari karar

IU video yükleme akışından Bunny paneli ve link taşıma tümüyle çıkar: IU, HapBilgi ekranında dosya seçer; dosya tarayıcıdan **doğrudan Bunny'ye** yüklenir (bizim sunucuya uğramaz); sistem video kimliğini kendisi kaydeder.

**Depolama formülü (19.07 mutabakatı):** dosya Bunny'de, kimlik Supabase'de, izleme Bunny oynatıcısından. Supabase'e video dosyası hiçbir aşamada girmez (CDN/encode/bant genişliği işi Bunny'nin).

**Geleceğe uygunluk:** IU bugün insan; ileride otomatikleşebilir (İskender notu, 19.07: "insan-şimdilik"). Bu yüzden sunucu ucu, ekrandan bağımsız programatik çağrılabilir tasarlanır.

## Aşamalar

### A0 — Altyapı teyidi (keşif)
- Bunny Stream API ile video kaydı açma (`POST /library/{id}/videos`) ve TUS imza formülünün (SHA256: library_id + api_key + expiration + video_guid) küçük bir dosyayla uçtan uca denenmesi. Test, İskender'in test hesabında (hb2026 / 707975) yapılır.
- Env zaten hazır: `BUNNY_LIBRARY_ID`, `BUNNY_API_KEY`, `NEXT_PUBLIC_BUNNY_PULL_ZONE` (19.07'de hb2026 değerlerine eşitlendi).

**A0 SONUCU (19.07.2026 — koşuldu):** 5 adımdan 4'ü TEYİT: API ile kayıt açma ✅ · imza üretimi + TUS oturum açılışı (201) ✅ · bozuk imzanın reddi (401) ✅ · API ile silme ✅. Bunny planlanan esnekliği SUNUYOR; anahtar-kasada/süreli-imza modeli çalışıyor. Tek açık uç: veri aktarım adımı (TUS PATCH) el yapımı istekte 400 aldı — güçlü şüphe chunked gövde/Content-Length ayrıntısı; `tus-js-client` bunu kendiliğinden doğru yapar. Teyidin şimdi mi (tek deneme) A2'de mi yapılacağı İskender kararında. Bunny tarafı temiz bırakıldı (tüm test kayıtları silindi; imza formülü doğrulandı ve A1'de bu haliyle kullanılacak).

### A1 — Sunucu ucu: yükleme başlatma ("vezne" modeli — İskender çerçevesi, 19.07)
IU = çalışan, sistem = şirketin veznesi; A1 o veznenin kuralları:
1. **Kimlik ve sıra kontrolü:** (a) oturum + rol gerçekten IU mu; (b) bu videonun sırası gerçekten yükleme mi (durum "revizyon bekleniyor" ya da ilk yükleme). Yetkisiz veya sırası gelmemiş istek Türkçe gerekçeyle reddedilir.
2. **Kaydı şirket açar, adı şirket koyar:** Bunny'deki video kaydını sistem açar, adı sistem verir (ör. `hepifarma_normavas_v2`) — kütüphane düzeni çalışanın adlandırma disiplinine emanet edilmez.
3. **Anahtar kasada, çalışana günlük kart:** API anahtarı yalnız sunucuda; IU'nun tarayıcısına inen şey TEK videoya özel, SÜRELİ yükleme imzası. Başka kapı açmaz; IU değişse Bunny tarafında iptal edilecek şey yoktur.
4. **Tutanak:** kim, hangi senaryo, hangi video kimliği, ne zaman — Supabase'e işlenir.
5. **Çalışan yarın robot olabilir:** uç, ekrana değil sözleşmeye bağlı — ileride yapay IU aynı ucu aynı kurallarla çağırır ("insan-şimdilik" notunun teknik karşılığı).
- Uç: `POST /videolar/api/bunny-yukleme-baslat` → `{video_guid, imza, sonKullanma, libraryId}`. Türkçe hata yönetimi (Bunny erişilemedi / limit / yetki).

**A1 SONUCU (19.07.2026 — BİTTİ, `93e686c`):** Uç yazıldı: IU rol + sıra kontrolü (yalnız ilk yükleme ya da "revizyon bekleniyor"), başlığı sistem koyar (`urunadi_vN` — v_yayin_detay + versiyon sayımı), 2 saatlik tek-videoluk imza, kanonik `embed_url` yanıtla döner (istemci URL kurmaz), tutanak log'u. Çekirdek `lib/video/bunnyYukleme.ts` (oluştur/imza/sil-telafi) — sunucu-tarafı, ekrandan bağımsız. Üçlü doğrulama temiz; smoke: imza formülü bilinen vektör + guid ayrımı. A0 açık ucu kararı: PATCH teyidi A2'de gerçek kütüphaneyle (İskender: "b", 19.07).

### A2 — İstemci: dosya seç + doğrudan yükleme
- IU ekranındaki URL alanı yerine "Video dosyası seç" (+ sürükle-bırak); `tus-js-client` ile tarayıcıdan Bunny'ye doğrudan, kaldığı yerden devam edebilen yükleme; ilerleme çubuğu (%).
- Yükleme bitince sistem `video_url`'yi kanonik embed adresi olarak KENDİSİ yazar (`player.mediadelivery.net/embed/{lib}/{guid}`) — mevcut PUT rotası ve "inceleme bekleniyor" akışı aynen.
- Şema notu: ayrı `bunny_video_id` kolonu ilk fazda GEREKMEZ — GUID, embed URL'nin içinde; ihtiyaç doğarsa türetilir.

**A2 SONUCU (19.07.2026 — KOD BİTTİ, `a47aa63`):** IU ekranında URL alanı kalktı; "Video dosyası seç" + ilerleme çubuğu + "Yükle ve Gönder". Akış: vezneden izin → `tus-js-client` ile tarayıcıdan doğrudan Bunny'ye (kesintiden devam; dosya sunucumuza uğramaz) → kanonik embed adresini sistem yazar → durum "inceleme bekleniyor". Yeni bağımlılık: `tus-js-client ^4.3.1`. Bilinen açık uç: yükleme yarıda kalırsa Bunny'de yetim kayıt kalabilir — telafi ucu A3 kapsamına not edildi. **Doğrulama:** üçlü temiz. **Fiziksel teyit (İskender, 19.07.2026): gerçek dosyayla yükleme UÇTAN UCA BAŞARILI** — dosya seç → doğrudan Bunny'ye TUS → "yükleme başarılı". A0'ın açık ucu (TUS veri aktarımı) böylece kapandı; A0 5/5 TEYİT.

### A3 — Encode durumu (küçük)
- Bunny işlemeyi bitirmeden izleme açılmayabilir; kartta "video işleniyor" rozeti (Bunny video status sorgusu — kaydet anında + kart açılışında kontrol; sürekli polling yok).

**A3 SONUCU (19.07.2026 — KOD BİTTİ, `1f18454`):** Kart açılışında TEK Bunny durum sorgusu (`GET /videolar/api/bunny-durum` — polling yok): encode sürüyorsa mavi "video işleniyor" rozeti (F-06 kapak gecikmesi bulgusunun çözümü), encode hatasında (status 5/6) kırmızı dürüst uyarı; hazır (status 4) ya da Bunny-dışı/eski kayıtlarda rozet çıkmaz. A2'nin açık ucu kapandı: TUS hatasında vezneden açılan yetim kayıt `POST bunny-yukleme-iptal` ile silinir — güvenlik kuralı: bir kayda bağlanmış GUID SİLİNMEZ, yalnız yetim silinir. Çekirdek eklemeler `lib/video/bunnyYukleme.ts`: `embedUrlGuidCikar` (saf) + `bunnyVideoDurumu`. Üçlü doğrulama temiz; smoke: `embedUrlGuidCikar` mutlu + red. Fiziksel teyit ayrıca yapılmadı — İskender kararı (19.07): beklemeden A4'e geçildi; rozet, olağan kullanımda ilk encode'lu yüklemede kendini gösterecek.

### A4 — Hazır video akışı (faz 2, ayrı karar)
- Talep formundaki "hazır video" bugün Supabase storage'a gidiyor; IU indirip Bunny'ye taşıyordu. Aynı doğrudan-Bunny akışına alınması ayrı fazdır — kapsam ve sıra İskender kararı.

**A4 SONUCU (19.07.2026 — KOD BİTTİ):** Kapsam kararı (İskender): **PM formdan doğrudan** — hazır video Supabase storage'a hiç girmez; PM'in talep formunda seçtiği dosya, talep oluşunca tarayıcıdan doğrudan Bunny'ye gider; IU'nun indir-yeniden-yükle adımı tümüyle kalktı. Uygulama: yeni vezne ucu `POST /talepler/api/bunny-yukleme-baslat` (PM rolü + üretici şartı; sıra: hazır video talebi ve `hazir_video_url` boş; adı sistem koyar — `urunadi_hazir`); A2'nin TUS istemci mantığı ortak yardımcıya çıktı (`lib/video/bunnyTusIstemci.ts`, iki ekran aynı kodu kullanır); kanonik embed adresini sistem yazar (`PUT hazir-video` artık üretici-PM'e ait, kanonik-adres doğrulamalı; IU'nun URL girme yolu ve talep detayındaki URL alanı kalktı); form yüklemesi yarım kalırsa ya da PM reddederse üretici talep detayından aynı akışla yeniden yükler; yetim telafisi genişledi (`bunny-yukleme-iptal` GUID'i `videolar.video_url` VE `talepler.hazir_video_url` içinde arar — bağlıysa SİLİNMEZ; PM de çağırabilir); PM önizleme kartına A3 encode rozeti geldi (`bunny-durum` artık `talep_id` ile de sorgulanır). PM onay zinciri (onayla → otomatik senaryo/video/soru seti) aynen. Üçlü doğrulama temiz; smoke: `hazirVideoBaslik` mutlu + red. Fiziksel teyit İskender'de.

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
