# Açık İşler — güncel liste

*29.07.2026 (30.07 güncelleme: B-09 — eski md.3 — kapandı, REDBOOK §7'ye taşındı ve
listeden çıkarıldı; maddeler yeniden numaralandı). Kaynak: redbook §6.4 + bu tarihte
yapılan kod kontrolleri. Bu belge yalnız **yapılacak** işleri taşır; kapanmış işler
redbook Bölüm 7'de, sistemin bugünkü çalışma biçimi redbook Bölüm 1–6'dadır.*

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

**8 · Liste yönetimi cascade görünümü.**
BM/TM'in altındaki UTT'lerin eczane/kişi listelerini görebildiği cascade
kurulmadı. E-Club Ligi'ndeki cascade'den ayrı bir iştir.

---

## E. Ölçek

**9 · HB Ligi ölçeklenmesi. — ✅ ÇÖZÜLDÜ (E9, 31.07.2026).**

Canlı-SUM (`v_hbligi_sirali` her sorguda sıfırdan toplama) yerine kişi × gün
**özet tablosu** (`hb_ligi_ozet_v2`) + 4 besleyen tabloya `AFTER INSERT` trigger +
okuma anında `row_number` sıralaması kuruldu; geçiş canlı-SUM ile birebir
doğrulandı (fark 0). Ayrıca haftalık periyot eklendi, lig arayüzü leaderboard'a
dönüştü (kayıplar görünür), ve öneri kaybı yazımı (`oneri_kaybi_tara`) kurularak
eksik ceza mekanizması tamamlandı. Aynı ölçek + haftalık deseni **CC Ligi'ne** de
uygulandı (`cc_ligi_ozet`). Mimari REDBOOK §2.5'te güncellendi.

*(Bu madde kapandı; numaralandırma cascade'i md.19'un göndermelerini bozmamak için
korundu — tam yeniden numaralandırma ayrı bir temizlik işi.)*

---

## F. Ertelenen işler (bilinçli)

**10 · `tekrar_id` FK kolonu.**
Tüm tekillik sorguları tarih karşılaştırmasıyla çözüldüğünden ertelendi;
raporlama JOIN ihtiyacı doğarsa kolon eklenip geriye doğru doldurulur.

**11 · E-Club kişi tarafı sayacı ve UTT "gönderime hazır" durumları.**
Sayaç UTT gönderim ekranına aittir; o ekran Eczanem geliştirmesiyle şekillenecek.

**12 · Ekstra İzlediklerim'in CC/BM karşılığı.**
BM'in "İzlenecek Videolar" düzleminde aynı bölümün eşik-2 karşılığı; ihtiyaç
doğarsa aynı desen birebir uygulanır.

---

## G. Doğrulama — insan yürütümlü

**13 · U10 — Tekrar Gönderim uçtan uca fiziksel test (push öncesi şart).**
12 senaryo: yayına alma/tur-1, ilk izleme, yeni extra kuralı (UTT ve CC), tur
dönüşü, sayaç rozetleri, BM/CC akışı, öneri, E-Club, durdur/başlat tur
bağımsızlığı, challenge etkilenmezliği, Sistem Ayarları paneli, puansız zaman
penceresi.

**14 · U7 — Ekstra İzlediklerim fiziksel testi (push öncesi şart).**
9 senaryo: liste/sıralama doğruluğu, tur dönüşünde sayaç sıfırlanması,
"extra'ya X kaldı" ile karar birebirliği, ay dönümünde hak yenilenmesi, ileri
sarmalı ve puansız-pencere izlemelerinin sayaca girmemesi, durdurulan yayının
bölümden düşmesi, boş durum, beğeni/favori senkronu. 16 ile birleşik koşulabilir.

**15 · Eczanem U10/U11 — faz sonu ara testler + uçtan uca test.**
Davet→OTP→üyelik, eşik, gönderim teklikleri, izleme→kazanım, dörtlü kilit
sızmazlığı, FIFO/180 gün senaryosu, sipariş→onay→fiş→mükerrer onay reddi, KVKK
silme sonrası toplamların korunumu, görünürlük sınırları, İP-§11 risk tablosunun
satır satır sağlaması.

**16 · Final test.**
Deploy öncesi uçtan uca doğrulama: üç müşteri katmanının kritik akışları
(üretim → tüketim → puan → lig → store) manuel/otomatik test edilir.

**17 · Vercel push/deploy.**
Yukarıdaki doğrulama bloğu + A grubu + C grubu kapanmadan `origin`'e push
yapılmaz. Push, biriken commit serisinin tek hazır durum olarak yayınlanmasıdır.
Eczanem için ayrıca üretim env'inde SMS sağlayıcı anahtarları tanımlanmalıdır.

---

## H. 29.07.2026'da eklenen maddeler

**18 · Admin M4 — modül sekmelerinin içi doldurulacak.**
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

**19 · Admin M5.** Kalan bulgular tek tek maddelere çıkarıldı: B-27 → md.21, B-29 → md.22,
B-38 → md.23, B-34 → md.24, B-35 → md.25, B-37 → md.26.
B-28 silinecek (İskender kararı, 29.07); B-30 iş değil, olması gereken —
REDBOOK Bölüm 7'ye kural olarak yazıldı.

**20 · Kalite raporu §9 — B-39 teyidi.**
Ara evrede `iu_id`'ye üreticinin yazılması tespiti. 22.07 refactoring'inde
kabuklar `iu_id = null` doğar hâle geldi; maddenin fiilen kapanıp kapanmadığı
teyit edilmedi.

**21 · B-27 — E-Club Store sipariş durumu serbest atlıyor.**
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

**22 · B-29 — ürün/teknik silmede engelin sebebi söylenmiyor.**
Admin bir ürünü ya da tekniği silmeye kalkınca sistem "bu kullanımda mı" diye
bakmıyor. Silme isteği doğrudan veritabanına gidiyor; kayıt kullanımdaysa FK
kısıtı silmeyi düşürüyor ve ekrana "Ürün silinemedi." + ham veritabanı hata
metni (`23503`) çıkıyor. Admin neden silinemediğini, hangi kayda bağlı
olduğunu öğrenemiyor.

Bağlılık: ürün 9 tabloya bağlı (talepler, kazanılan puanlar, ileri sarma,
öneri kaybı, challenge kaybı, Eczanem tarifeleri, E-Club tabloları); teknik
yalnız taleplere.

*Risk sınırı:* veri kaybı YOK — FK zaten koruyor, silme fiilen engelleniyor.
Kusur tamamen anlatım katmanında.

*Düzeltme:* silmeden önce bağlılık sayılır; kullanımdaysa silme denenmez,
"bu ürün N talepte ve M puan kaydında kullanılıyor, silinemez" denir.
Kanıt: `app/admin/api/firmalar/[firma_id]/urunler/route.ts` ve
`.../teknikler/route.ts` DELETE blokları — bağlılık kontrolü yok.

**23 · B-38 — store ürününde kategori kontrolü yarım.**
Yeni ürün eklenirken kategorinin gerçekten var olduğu doğrulanıyor; aynı ürün
sonradan düzenlenirken doğrulanmıyor. Geçersiz kategori yazılırsa yine ham
veritabanı hatası çıkıyor.

*Düzeltme:* POST'taki kategori varlık kontrolü PATCH'e de konur.
Kanıt: `app/admin/store/api/urun/route.ts` — POST kontrol ediyor, PATCH etmiyor.

**24 · B-34 — silme fonksiyonları push kayıtlarını bırakıyor.**
Ne toplu test silme ne de tekil talep silme `push_gonderim_kayitlari` tablosuna
dokunuyor. Bir talebi ya da tüm test verisini silsen bile "kime hangi push
gitti" kayıtları duruyor.

*Kanıt tazelendi (29.07):* bulgu ilk yazıldığında `test-verileri-sil/route.ts`
içindeki `SILINECEK_TABLOLAR` listesini gösteriyordu — o kod artık YOK, silme
24.07'de atomik RPC'ye taşındı. Düzeltme yeri bugün `scripts/sql/toplu_test_sil.sql`
(48 tablo) ve `scripts/sql/tekil_talep_sil.sql` (39 tablo); ikisinde de push
tablosu geçmiyor.

*Toplu tarafın düzeltmesi basit:* `DELETE FROM push_gonderim_kayitlari;` satırı
eklenir — orası zaten "test verisini süpür" işidir.

*Tekil taraf düzeltilemiyor — KARAR GEREKİYOR.* `push_gonderim_kayitlari`
kolonları: `gonderim_id`, `auth_user_id`, `olay_turu`, `alici_rol`, `created_at`,
`durum`. **Talep ya da yayın bağı YOK.** Bu yüzden tekil silmede "bu talebin
push'ları" diye süzülemez; oraya koşulsuz DELETE yazmak tek talep silerken tüm
sistemin push geçmişini uçurur. Seçenekler: (a) tekil silmede push'a hiç
dokunulmaz, (b) tabloya `yayin_id` eklenir (şema değişikliği).

*Ağırlık:* düşük; ayrıca test aracının kendisi deploy
öncesi tümüyle kaldırılacak (md.1) — o zaman toplu taraf kendiliğinden düşer,
tekil taraf kalır.

**25 · Admin takım ekleme düzeltmesi (N+1 hatası) — B-35.**
Admin panelinde Organizasyon sekmesi açıldığında sistem önce takımları çekiyor,
sonra **her takım için ayrı ayrı** bölge isteği atıyor. 5 takım varsa 6 istek,
20 takım varsa 21 istek.

*Düzeltme:* bölgeleri tek istekte döndüren uca geçilir.
Kanıt: `app/admin/_hooks/useAdminPanel.ts` — takım döngüsü içinde bölge fetch'i.

*Ağırlık:* düşük, bugünkü ölçekte zararsız; firma
başına takım sayısı büyüdükçe sekme açılışı yavaşlar. Aynı sınıf hata daha ağır
bir yerde kapatılmıştı: üretici ana sayfasında 43 sorgu → 2 (27.07).

**26 · E-Club Store admin iptalinde alan anlamları kayıyor — B-37.**
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
