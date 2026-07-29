# Açık İşler — güncel liste

*29.07.2026. Kaynak: redbook §6.4 + bu tarihte yapılan kod kontrolleri.
Bu belge yalnız **yapılacak** işleri taşır; kapanmış işler redbook Bölüm 7'de,
sistemin bugünkü çalışma biçimi redbook Bölüm 1–6'dadır.*

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

## B. Kalite taraması NOT'ları

**3 · Lint `kayit-tek-kaynak` kapsam genişletme (B-07).**
Korumalı 15 tabloya **yeni kayıt eklemek** denetleniyor, ama **güncelleme,
silme ve üzerine yazma** kuralın gözünden kaçıyor
(`tools/eslint-rules/index.mjs:120`).
*29.07 kontrolü — fiilî kaçak YOK:* 15 tablodaki 19 yazma işleminin tamamı
yetkili klasörlerin içinde (ekleme 14, güncelleme 4, üzerine yazma 1, silme 0).
Bugün zarar vermiyor; yarın dışarıdan yazılacak bir güncellemeyi
engelleyemeyecek olması nedeniyle açık.
*Ek:* kuralın belgedeki muafiyet listesi eskimiş — belgede üç klasör yazılı
(`lib/puan/`, `lib/tur/`, `lib/eczanem/`), kodda dört var (`lib/push/` eklenmiş).

**4 · Hard-coded rol dizileri (B-09) — BÜYÜYOR.**
"Bu rolü kim görebilir" kararı `lib/utils/roller.ts`'ten okunmalıyken dosyalara
elle yazılmış. Yeni bir rol eklendiğinde ya da bir yetki değiştiğinde her yerin
tek tek bulunması gerekir; biri unutulursa hata ekranda görünmez — o rol bir
sayfayı sessizce görür ya da göremez.
*29.07 ölçümü:* **190 karşılaştırma / 98 dosya.** Belgede 12.07'de 125 / ~60
yazıyordu — 17 günde yaklaşık %50 büyümüş.
En yoğun: `app/store/siparisler/_components/SiparisFiltreleri.tsx` (22),
`app/eclub/ligi/page.tsx` (10), `components/Navbar.tsx` (10),
`lib/admin/kullaniciDogrulama.ts` (8).

**5 · Zaman-sınır fonksiyonları yerel saatte (B-12) — DEPLOY ÖNCESİ MECBURİ.**
`lib/zaman/kontrol.ts` içindeki `haftaBaslangici`, `ayBaslangici`,
`yilBaslangici`, `isGunuEkle` ve `aktifDonem` sunucunun **yerel** saatiyle
çalışır.
*29.07 kontrolü:* Bugün sorun yok — makine Türkiye saatinde, fonksiyonlar doğru
sonuç veriyor. Vercel'e (UTC) çıkıldığı gün ay/hafta/yıl/çeyrek sınırları 3 saat
kayar: ayın ilk günü 00:00–03:00 arasında yapılan işlem bir önceki ayın
penceresine düşer ve extra hakkı yanlış sayılır.
Doğrusu aynı dosyada duruyor: `puanKazanilabilirMi` 12.07'de
`Intl.DateTimeFormat` + `Europe/Istanbul` ile sabitlendi; beş fonksiyon aynı
desene geçirilecek. **Düzeltme deploy'dan hemen önce yapılır** — bugün yapılırsa
çalışan davranış bozulur. (Bkz. 21 numaralı madde: aynı işin önkoşulu.)

---

## C. Eczanem — canlıya çıkış ön koşulları

**6 · K-E1 — SMS sağlayıcısı (tek gerçek blokör).**
Sağlayıcı kararı kapalı: **Turkcell** (10.07). Açık kalan sözleşme ve
entegrasyondur. Entegrasyon noktası hazır (`lib/sms/gonderici.ts`
sağlayıcı-bağımsız); canlı-dışı ortamlar K-E8 test moduyla sağlayıcısız çalışır.
Entegrasyon tamamlanmadan Eczanem canlıya çıkamaz.

**7 · K-E2 — davet temizliği.**
24 saati dolan davet verisinin KVKK gereği kalıcı tutulmaması. Sorgu-anı
geçersiz sayma kurulu; kalıcı silme stratejisi kararı açık.

**8 · KVKK aydınlatma metni.**
`app/eczanem/davet/page.tsx` içindeki `KVKK_METNI` yer tutucudur; gerçek metin
İskender'den gelince değişecek.

---

## D. E-Club — kimlik ve bildirim

**9 · OTP girişi.**
Şu anki geçici model UTT'nin belirlediği e-posta + şifredir. Altyapı hazır:
Eczanem'in OTP + oturum mekanizması paylaşılabilir kuruldu; E-Club'ın buna
bağlanması ayrı iş.

**10 · Bildirim gösterimi.**
`eclub_bildirimler` tablosuna yazım çalışıyor, kişi tarafında gösterilmiyor.
Okundu işaretleme mekanizması ve harici kanal (WhatsApp/SMS) bildirimi yok.

**11 · Liste yönetimi cascade görünümü.**
BM/TM'in altındaki UTT'lerin eczane/kişi listelerini görebildiği cascade
kurulmadı. E-Club Ligi'ndeki cascade'den ayrı bir iştir.

---

## E. Ölçek

**12 · HB Ligi ölçeklenmesi.**

**Şu demek: lig sıralaması hiçbir yerde saklanmıyor, her açılışta sıfırdan hesaplanıyor.**

**Bir kullanıcı lige ya da profiline her baktığında sistem tüm puan ve kayıp kayıtlarını toplayıp herkesi baştan sıralıyor. Bugün az kullanıcı olduğu için hızlı; kullanıcı sayısı arttıkça bu hesap her seferinde biraz daha uzar ve bir noktada sayfa yavaşlar.**

**Karşılığında bir kazanç var ve bilinçli seçilmiş: sıralama her zaman anlıktır, hiçbir yerde bayat bir kopya durmaz. Yani bu bir hata değil, ölçek büyüyünce ödenecek bir bedel.**

*Teknik ayrıntı (29.07 kontrolü):* `v_hbligi_sirali` materialized değil, canlı
hesap yapan bir görünüm; ayrı sıralama tablosu tutulmuyor. Dört yerde kullanılıyor
(`app/profil/api/route.ts:101` ve `lib/rapor/utt/getUttData.ts` ×3). Üç sıra kolonu
(`firma_sirasi`, `bolge_sirasi`, `takim_sirasi`) her sorguda yeniden hesaplanıyor.
Yapı iki katmanlı: alttaki `hb_ligi` 10 puan kolonunu toplar, `v_hbligi_sirali`
üstüne kimlik ve sıra kolonlarını ekler — yani her sorguda önce toplama sonra
sıralama koşar. `hb_ligi` doğrudan hiçbir yerden okunmuyor.
**Ölçülemeyen:** kaç UTT olduğu ve sorgunun bugün ne kadar sürdüğü — canlı
veritabanı sorusu, eşiğin (500–1000 UTT) aşılıp aşılmadığı ancak o sayıyla bilinir.

---

## F. Ertelenen işler (bilinçli)

**13 · `tekrar_id` FK kolonu.**
Tüm tekillik sorguları tarih karşılaştırmasıyla çözüldüğünden ertelendi;
raporlama JOIN ihtiyacı doğarsa kolon eklenip geriye doğru doldurulur.

**14 · E-Club kişi tarafı sayacı ve UTT "gönderime hazır" durumları.**
Sayaç UTT gönderim ekranına aittir; o ekran Eczanem geliştirmesiyle şekillenecek.

**15 · Ekstra İzlediklerim'in CC/BM karşılığı.**
BM'in "İzlenecek Videolar" düzleminde aynı bölümün eşik-2 karşılığı; ihtiyaç
doğarsa aynı desen birebir uygulanır.

---

## G. Doğrulama — insan yürütümlü

**16 · U10 — Tekrar Gönderim uçtan uca fiziksel test (push öncesi şart).**
12 senaryo: yayına alma/tur-1, ilk izleme, yeni extra kuralı (UTT ve CC), tur
dönüşü, sayaç rozetleri, BM/CC akışı, öneri, E-Club, durdur/başlat tur
bağımsızlığı, challenge etkilenmezliği, Sistem Ayarları paneli, puansız zaman
penceresi.

**17 · U7 — Ekstra İzlediklerim fiziksel testi (push öncesi şart).**
9 senaryo: liste/sıralama doğruluğu, tur dönüşünde sayaç sıfırlanması,
"extra'ya X kaldı" ile karar birebirliği, ay dönümünde hak yenilenmesi, ileri
sarmalı ve puansız-pencere izlemelerinin sayaca girmemesi, durdurulan yayının
bölümden düşmesi, boş durum, beğeni/favori senkronu. 19 ile birleşik koşulabilir.

**18 · Eczanem U10/U11 — faz sonu ara testler + uçtan uca test.**
Davet→OTP→üyelik, eşik, gönderim teklikleri, izleme→kazanım, dörtlü kilit
sızmazlığı, FIFO/180 gün senaryosu, sipariş→onay→fiş→mükerrer onay reddi, KVKK
silme sonrası toplamların korunumu, görünürlük sınırları, İP-§11 risk tablosunun
satır satır sağlaması.

**19 · Final test.**
Deploy öncesi uçtan uca doğrulama: üç müşteri katmanının kritik akışları
(üretim → tüketim → puan → lig → store) manuel/otomatik test edilir.

**20 · Vercel push/deploy.**
Yukarıdaki doğrulama bloğu + A grubu + C grubu kapanmadan `origin`'e push
yapılmaz. Push, biriken commit serisinin tek hazır durum olarak yayınlanmasıdır.
Eczanem için ayrıca üretim env'inde SMS sağlayıcı anahtarları tanımlanmalıdır.
**5 numaralı maddenin düzeltmesi bu adımdan hemen önce yapılır.**

---

## H. 29.07.2026'da eklenen maddeler

**21 · Ölü zaman modülü kopyası.**
`lib/utils/zamanKontrol.ts` hiçbir dosya tarafından import edilmiyor; gerçek
modül `lib/zaman/kontrol.ts` ve onu 16 dosya kullanıyor. Kopyada
`puanKazanilabilirMi`, `haftaBaslangici` ve `ayniHaftaMi` ayrıca tanımlı.
5 numaralı madde düzeltilirken "hangisini düzelttik" karışıklığı üretir; o işin
önkoşulu olarak silinmelidir. Ayrıca `ayniHaftaMi` hiçbir yerde kullanılmıyor.

**22 · Admin M4 — modül sekmelerinin içi doldurulacak.**
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

**23 · Admin M5.** Kalan bulgular tek tek maddelere çıkarıldı: B-27 → md.25, B-29 → md.26,
B-38 → md.27, B-34 → md.28, B-35 → md.29, B-37 → md.30.
B-28 silinecek (İskender kararı, 29.07); B-30 iş değil, olması gereken —
REDBOOK Bölüm 7'ye kural olarak yazıldı.

**24 · Kalite raporu §9 — B-39 teyidi.**
Ara evrede `iu_id`'ye üreticinin yazılması tespiti. 22.07 refactoring'inde
kabuklar `iu_id = null` doğar hâle geldi; maddenin fiilen kapanıp kapanmadığı
teyit edilmedi.

**25 · B-27 — E-Club Store sipariş durumu serbest atlıyor.**
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

**26 · B-29 — ürün/teknik silmede engelin sebebi söylenmiyor.**
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

**27 · B-38 — store ürününde kategori kontrolü yarım.**
Yeni ürün eklenirken kategorinin gerçekten var olduğu doğrulanıyor; aynı ürün
sonradan düzenlenirken doğrulanmıyor. Geçersiz kategori yazılırsa yine ham
veritabanı hatası çıkıyor.

*Düzeltme:* POST'taki kategori varlık kontrolü PATCH'e de konur.
Kanıt: `app/admin/store/api/urun/route.ts` — POST kontrol ediyor, PATCH etmiyor.

**28 · B-34 — silme fonksiyonları push kayıtlarını bırakıyor.**
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

**29 · Admin takım ekleme düzeltmesi (N+1 hatası) — B-35.**
Admin panelinde Organizasyon sekmesi açıldığında sistem önce takımları çekiyor,
sonra **her takım için ayrı ayrı** bölge isteği atıyor. 5 takım varsa 6 istek,
20 takım varsa 21 istek.

*Düzeltme:* bölgeleri tek istekte döndüren uca geçilir.
Kanıt: `app/admin/_hooks/useAdminPanel.ts` — takım döngüsü içinde bölge fetch'i.

*Ağırlık:* düşük, bugünkü ölçekte zararsız; firma
başına takım sayısı büyüdükçe sekme açılışı yavaşlar. Aynı sınıf hata daha ağır
bir yerde kapatılmıştı: üretici ana sayfasında 43 sorgu → 2 (27.07).

**30 · E-Club Store admin iptalinde alan anlamları kayıyor — B-37.**
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
