# Açık İşler — güncel liste

*29.07.2026 (30.07 güncelleme: B-09 — eski md.3 — kapandı, REDBOOK §7'ye taşındı ve
listeden çıkarıldı; maddeler yeniden numaralandı. 31.07 güncelleme: E9 — HB Ligi
ölçeklenmesi (eski md.9) — kapandı, REDBOOK Bölüm 7'ye taşındı; ayrıca `tekrar_id` FK
kolonu (eski md.9/F) sınırlı kaynak önceliklendirmesiyle listeden çıkarıldı — yatırım
bugün için gerekçesiz görüldü. Kalan maddeler yeniden numaralandı. 01.08 güncelleme:
B-35 — admin takım ekleme N+1 (eski md.23/H) — kod incelemesiyle tespit teyit edildi
ama düşük öncelik/zararsız görülerek sınırlı kaynak önceliklendirmesiyle listeden
çıkarıldı; kalan maddeler yeniden numaralandı. Ayrıca H grubu yeniden
yapılandırıldı: Admin M5 (md.17) şemsiye madde olarak tanımlandı, dağıttığı
bulgular 17.1–17.5 alt maddelerine toplandı, B-39 (M5 dışı) md.18 olarak
ayrıldı). Kaynak: redbook §6.4 +
bu tarihte yapılan kod kontrolleri. Bu belge yalnız **yapılacak** işleri taşır; kapanmış
işler redbook Bölüm 7'de, sistemin bugünkü çalışma biçimi redbook Bölüm 1–6'dadır.*

**Numaralandırma:** maddeler belgedeki sırayla 1'den başlar, boşluk bırakılmaz.
Bir madde çıkarılırsa kalanlar yeniden numaralanır; belge içindeki göndermeler
de o anda güncellenir.

---

## A. Güvenlik — deploy öncesi mecburi

**1 · Test endpoint'lerinin kaldırılması.**
`admin/api/test-verileri-sil` ve `app/admin/test-temizlik/` test araçlarıdır.
12.07'de girişsiz olmaktan çıkarılıp admin bekçisinin arkasına alındılar; deploy
öncesi araç bütünüyle (buton + modal + sayfa + endpoint) kaldırılmalı.

**2 · Bunny video erişim güvenliği — A5 fazı.**
Bunny embed token authentication ve CDN token kurulmadı. Bugün Bunny
panelindeki güvenlik anahtarları KAPALI; bir videoya erişimin tek engeli
adresteki tahmin edilemez GUID. Adresi eline geçiren herkes videoyu izler —
oturum, rol ya da firma kontrolü yoktur.

Bu, 19.07.2026'da bilinçli alınmış bir karardır: test dönemi için kabul edilen
risk (İskender). Canlıya çıkmadan kapatılması gerekir.

*Düzeltme:* izleme istekleri sunucu imzalı hâle getirilir, Bunny panelindeki
token doğrulaması açılır. Bunny doğrudan yükleme işinin A5 fazıdır; A0–A4
tamamlandı, A5 hiç başlanmadı.

---

## C. Eczanem — canlıya çıkış ön koşulları

**3 · K-E1 — SMS sağlayıcısı (tek gerçek blokör).**
Sağlayıcı kararı kapalı: **Turkcell** (10.07). Açık kalan sözleşme ve
entegrasyondur. Entegrasyon noktası hazır (`lib/sms/gonderici.ts`
sağlayıcı-bağımsız); canlı-dışı ortamlar K-E8 test moduyla sağlayıcısız çalışır.
Entegrasyon tamamlanmadan Eczanem canlıya çıkamaz.

**4 · K-E2 — davet temizliği.**
24 saati dolan davet verisinin KVKK gereği kalıcı tutulmaması. Sorgu-anı
geçersiz sayma kurulu; kalıcı silme stratejisi kararı açık.

**5 · KVKK aydınlatma metni.**
`app/eczanem/davet/page.tsx` içindeki `KVKK_METNI` yer tutucudur; gerçek metin
İskender'den gelince değişecek.

---

## D. E-Club — kimlik ve bildirim

**6 · OTP girişi.**
Şu anki geçici model UTT'nin belirlediği e-posta + şifredir. Altyapı hazır:
Eczanem'in OTP + oturum mekanizması paylaşılabilir kuruldu; E-Club'ın buna
bağlanması ayrı iş.

**7 · Bildirim gösterimi.**
`eclub_bildirimler` tablosuna yazım çalışıyor, kişi tarafında gösterilmiyor.
Okundu işaretleme mekanizması ve harici kanal (WhatsApp/SMS) bildirimi yok.

---

## F. Ertelenen işler (bilinçli)

**8 · E-Club kişi tarafı sayacı ve UTT "gönderime hazır" durumları.**
Sayaç UTT gönderim ekranına aittir; o ekran Eczanem geliştirmesiyle şekillenecek.

---

## G. Doğrulama — insan yürütümlü

**9 · U10 — Tekrar Gönderim uçtan uca fiziksel test (push öncesi şart).**
12 senaryo: yayına alma/tur-1, ilk izleme, yeni extra kuralı (UTT ve CC), tur
dönüşü, sayaç rozetleri, BM/CC akışı, öneri, E-Club, durdur/başlat tur
bağımsızlığı, challenge etkilenmezliği, Sistem Ayarları paneli, puansız zaman
penceresi.

**10 · Eczanem U10/U11 — faz sonu ara testler + uçtan uca test.**
Davet→OTP→üyelik, eşik, gönderim teklikleri, izleme→kazanım, dörtlü kilit
sızmazlığı, FIFO/180 gün senaryosu, sipariş→onay→fiş→mükerrer onay reddi, KVKK
silme sonrası toplamların korunumu, görünürlük sınırları, İP-§11 risk tablosunun
satır satır sağlaması.

**11 · Final test.**
Deploy öncesi uçtan uca doğrulama: üç müşteri katmanının kritik akışları
(üretim → tüketim → puan → lig → store) manuel/otomatik test edilir.

**12 · Vercel push/deploy.**
Yukarıdaki doğrulama bloğu + A grubu + C grubu kapanmadan `origin`'e push
yapılmaz. Push, biriken commit serisinin tek hazır durum olarak yayınlanmasıdır.
Eczanem için ayrıca üretim env'inde SMS sağlayıcı anahtarları tanımlanmalıdır.

---

## H. 29.07.2026'da eklenen maddeler

**13 · Admin M4 — modül sekmelerinin içi doldurulacak.**
Bugün admin dört modülü açıp kapatabiliyor, içeriğini göremiyor (REDBOOK §6.1).
M4 her sekmeye iki katman ekler.

**Katman 1 — görünürlük (salt okuma).** Mevcut tabloların okunması; yeni iş
kuralı gerektirmez.

| Sekme | Admin ne görecek |
|---|---|
| T-Club | Yayın listesi (durum / tur / planlanmış), izleme-puan özetleri, bekleyen üretim zinciri |
| C-Club | Challenge yayınları, lig özeti, challenge hareketleri |
| E-Club | Öneri ve izleme özetleri (eczane onayı M2'de taşındı, sekmede duruyor) |
| Eczanem | Eczane / üye / gönderim / sipariş sayıları, tarife listesi |

**Katman 2 — müdahale (yazma).**

| Sekme | Admin ne yapabilecek |
|---|---|
| T-Club | Yayın durdur/başlat, planlanmış yayının tarihini değiştir ya da iptal et |
| C-Club | Challenge iptali / geri alma — bugün hiçbir uçta yok, yeni iş |
| E-Club | Kişi pasife alma, eczane–firma bağına müdahale |
| Eczanem | Tarife pasifleme, üyelik müdahalesi |

*Bağlı karar (K-A1):* admin bu müdahalelerin tamamını yapabilir. İleride "firma
admini" rolü açılıp bazı yetkiler o role kapatılacağı için aksiyonlar tek yerde
tanımlanmalı — rol bazlı kapatma tek satır olsun.

*Alt-iş (K-A2):* HBStore ve E-Club Store katalogları bugün global; her firma
aynı ürün yelpazesini istemediği için katalog firma bazlı olacak. Şema
değişikliği gerektirir, ayrı planlanır.

*Sıra önerisi:* T-Club → Eczanem → C-Club. Her sekme ayrı iş adımı, kendi
testiyle kapanır.

**14 · Admin M5 — admin kalite taramasından kalan bulgular (şemsiye madde).**
Bu madde kendi başına bir iş değildir; admin kalite taramasında kalan bulguları
aşağıdaki alt maddelere (14.1–14.3) dağıtan bir kayıttır. B-28 silinecek (İskender
kararı, 29.07); B-30 iş değil, olması gereken — REDBOOK Bölüm 7'ye kural olarak
yazıldı.

**14.1 · B-27 — E-Club Store sipariş durumu serbest atlıyor.**
E-Club Store'da bir siparişin durumu yönetim ekranından sıra kuralı olmadan
değiştirilebiliyor; dört durum arasında her yönde geçiş serbest.

Somut zarar: müşteriye teslim edilmiş bir sipariş geri "beklemede"ye çekilip
"iptal" basılabiliyor. İptal RPC'si çalışıyor, puan müşteriye iade ediliyor,
stok geri ekleniyor — ama ürün zaten müşterinin elinde. Yani hem malı almış
hem puanı geri kazanmış oluyor. HBStore'da açık daha dar: orada yalnız
beklemede → kargoda geçişine izin var.

*Düzeltme:* geçiş matrisi tanımlanır — hangi durumdan hangisine geçilebileceği
tek yerde yazılır, geri dönüşler kapatılır.
Kanıt: `app/eclub/store/api/siparis/route.ts` (durum aksiyonu, geçiş matrisi yok).

**14.2 · B-38 — store ürününde kategori kontrolü yarım.**
Yeni ürün eklenirken kategorinin gerçekten var olduğu doğrulanıyor; aynı ürün
sonradan düzenlenirken doğrulanmıyor. Geçersiz kategori yazılırsa yine ham
veritabanı hatası çıkıyor.

*Düzeltme:* POST'taki kategori varlık kontrolü PATCH'e de konur.
Kanıt: `app/admin/store/api/urun/route.ts` — POST kontrol ediyor, PATCH etmiyor.

**14.3 · B-37 — E-Club Store admin iptalinde alan anlamları kayıyor.**
Dört ayrı sorun var:

1. **Alana auth kimliği yazılıyor.** İptal çağrısındaki `iptal_eden_kisi_id`
   alanı eczacı/teknisyen kimliği (`eclub_kisiler.kisi_id`) bekler; admin
   yolunda oraya auth kimliği konuyor.
2. **Eczacı/teknisyen kimliği auth kimliği değildir.** Admin'in `eclub_kisiler`
   kaydı olmadığı için doğru değer üretilemiyor — alan yapısal olarak yanlış
   veri tutuyor.
3. **Nedensiz iptal mümkün.** E-Club Store admin iptalinde sebep zorunlu değil;
   boş gelirse `"Admin tarafından iptal edildi."` varsayılanı basılıyor.
4. **Aynı iş iki mağazada iki kuralla.** HBStore admin iptalinde sebep
   ZORUNLUDUR (boşsa istek reddedilir); E-Club Store'da değildir.

*29.07 kontrolünde ek bulgu (raporda yok):* E-Club tarafında değer
`user?.id ?? ""` ile geçiliyor — kullanıcı çözülemezse alana **boş string**
gidiyor.

*Düzeltmenin yapılabilir yarısı (3 + 4):* E-Club admin iptaline HBStore'daki
zorunluluk bloğu birebir konur; iki mağaza aynı kurala gelir. Tek dosya, yan
etkisi yok.
Kanıt: `app/admin/store/api/siparis/route.ts` (zorunlu) ↔
`app/admin/eclub-store/api/siparis/route.ts` (opsiyonel).

*Düzeltilemeyen yarısı (1 + 2) — ÖN KOŞUL VAR.* Değer
`eclubStoreSiparisIptal` üzerinden `p_iptal_eden_kisi_id` parametresiyle
**RPC'ye** gidiyor. `eclub_store_siparisler` tablosunda "iptal eden" diye bir
kolon YOK ve RPC tanımı repo'da bulunmuyor (`scripts/sql/` içinde store
RPC'leri yok) — canlı DB'de. RPC'nin bu değeri ne yaptığı görülmeden
dokunulmamalı. Ön koşul: RPC tanımının okunması.

**15 · Kalite raporu §9 — B-39 teyidi.**
Ara evrede `iu_id`'ye üreticinin yazılması tespiti. 22.07 refactoring'inde
kabuklar `iu_id = null` doğar hâle geldi; maddenin fiilen kapanıp kapanmadığı
teyit edilmedi.

---

## I. 02.08.2026'da eklenen maddeler

**16 · Genel eslint kalite borcu — `no-explicit-any` + `react-hooks/set-state-in-effect`.**
Kabuk dönüşümünde görüldü: bu kalemler mimari gate'in (lint:mimari) parçası DEĞİL,
genel eslint'te yaygın ve önceden var. Somut örnek `app/(panel)/onaylanan-talepler/page.tsx`:
`veriCek` içinde 4× `(x: any)` (Supabase yanıtları tiplenmemiş) + satır 162 `useEffect`
içinde doğrudan `veriCek()` → setState (kademeli render uyarısı). Kod tabanı genelinde
tarama + ayrı kalite pass'i gerekiyor; kabuk dönüşümü kapsamı dışında.

---

## J. 05.08.2026'da eklenen maddeler

**17 · FK'sı olmayan puan tablolarında yetim kayıt riski — incelenecek.**
"Veri Sil" doğrulaması sırasında görüldü. Sistemde üç tablo, silme zincirinin
bağlandığı kolonlarda FK taşımıyor: `eclub_dogru_cevap_kayitlari` (hiç FK yok),
`eclub_utt_puanlari` (hiç FK yok), `ileri_sarma_kayitlari` (yalnız `urun_id`
FK'sı var; `yayin_id`, `izleme_id`, `kullanici_id` korumasız). FK olmadığı için
ebeveyn silindiğinde bu satırlar veritabanı tarafından engellenmez ya da
temizlenmez — silme kodu onları elle ele almak zorundadır ve atlanırsa sessizce
birikirler. REDBOOK §6.1 bu üçünü "cascade yakalamaz" diye not etmiş, ama
yetim kayıt olup olmadığı hiç ölçülmemiştir.

*İncelenecek:* (a) bu üç tabloda canlıda yetim kayıt var mı, (b) `test_veri_temizle`
ve tekil silme bu tabloları eksiksiz kapsıyor mu, (c) FK eklemek mi yoksa kod
tarafında kapsamayı garanti altına almak mı doğru çözüm.
