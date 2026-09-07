# HapBi Değişim Planı

## Değişmez sınırlar

- HapBi maskotu korunacak.
- Maskota tıklanınca açılan sohbet alanı korunacak.
- Sohbet alanının tasarımı, boyutları, konumu, açılma ve kapanma davranışı değiştirilmeyecek.
- Mesaj alanı, hazır soruların görsel alanı ve mevcut sohbet görünümü yeniden tasarlanmayacak.
- HapBilgi’nin kullanıcı, firma, takım, bölge, ürün, yayın, puan, izleme, üretim ve rapor verileri silinmeyecek.
- Plan yeni deterministik motorun kurulmasını kapsamayacak.
- Her fazdan ve değiştirilecek veya silinecek her dosyadan önce ayrı onay alınacak.
- Veritabanı komutları tarafımdan yazılacak, sizin tarafınızdan çalıştırılacak.

---

## - [x] Faz 1 — HapBi sınırlarının çıkarılması ✅

### Amaç

Silinecek HapBi motoru ile korunacak HapBi arayüzünü kesin olarak ayırmak.

### Yapılacak işler

1. HapBi’ye ait bütün dosyalar salt okunur biçimde listelenecek.
2. HapBi dosyalarını kullanan uygulama dosyaları bulunacak.
3. Dosyalar şu gruplara ayrılacak:

   - Korunacak maskot ve sohbet arayüzü
   - Arayüzün açılma ve kapanma yönetimi
   - Mevcut soru gönderme bağlantısı
   - Mevcut soru çözümleme motoru
   - Sabit tarifler
   - Veri sorgulama ve araç katmanı
   - Gemini yorum katmanı
   - HapBi’ye özel sınamalar
   - HapBi’ye özel SQL dosyaları
4. Her dosyanın başka bir HapBilgi bölümü tarafından kullanılıp kullanılmadığı belirlenecek.
5. Veritabanındaki HapBi adlı işlev ve nesneler salt okunur SQL komutlarıyla listelenecek.
6. Hiçbir dosya veya veritabanı nesnesi değiştirilmeyecek.

### Faz çıkışı

Dosya ve veritabanı nesnesi bazında kesin bir:

- Korunacaklar
- Değiştirilecekler
- Silinecekler
- Ortak kullanıldığı için dokunulmayacaklar

listesi hazırlanmış olacak.

### Faz 1 İş Sonuçları

- Faz 1 tamamlandı.
- Hiçbir dosya veya veritabanı nesnesi değiştirilmedi.

#### Korunacaklar

- `components/hapbi/HapbiMaskot.tsx`
- `components/hapbi/HapbiChatModal.tsx`
- `components/hapbi/HapbiSpotlight.tsx`
- `lib/hapbi/hapbiBilgiTabani.ts`
- `public/hapbi.png`
- `public/hapbi-wink.png`
- `tests/hapbiCanliTurMetinleri.smoke.test.ts`

#### Daha sonra yalnız motor bağlantıları çıkarılarak değiştirilecekler

- `components/hapbi/HapbiProvider.tsx`
- `app/api/hapbi/sor/route.ts`
- `lib/hapbi/hizliSorgu.ts`
- `lib/hapbi/sozlesme.ts`
- `package.json`

#### Silinecek eski motor

- `lib/hapbi/analitik/` altındaki 11 dosya
- `lib/hapbi/aracMotorlari/` altındaki 8 dosya
- `lib/hapbi/kapsam/` altındaki 3 dosya
- `lib/hapbi/niyet/` altındaki 7 dosya
- `lib/hapbi/yanit/` altındaki 5 dosya
- `lib/hapbi/` kökündeki 14 motor dosyası
- Eski motoru sınayan 21 HapBi sınama dosyası
- `scripts/hapbi-pilot/` altındaki 5 dosya
- `scripts/test-hapbi-eclub-live.ts`

#### Veritabanında bulunan HapBi işlevleri

- `get_hapbi_cclub_analitik_v1`
- `get_hapbi_eclub_analitik_v1`
- `get_hapbi_tclub_analitik_v1`
- `get_hapbi_uretim_analitik_v1`

Adı `hapbilgi` ile başlayan üç Eczanem işlevi HapBi’ye ait değildir ve kesinlikle korunacaktır.

#### Ortak kullanıldığı için dokunulmayacaklar

- `lib/tclub/hbligi/getSahaLig.ts`
- Oturum, rol, zaman, rapor, üretim, E-Club, yayın ve öğrenme aracı dosyaları
- HapBilgi sayfaları, logoları ve ortak veritabanı nesneleri

---

## - [x] Faz 2 — Maskot ve sohbet arayüzünün korunması ✅

### Amaç

HapBi’nin görünen yüzünü mevcut hâliyle sabitlemek.

### Yapılacak işler

1. Maskotu oluşturan bileşenler belirlenecek.
2. Sohbet alanını oluşturan bileşenler belirlenecek.
3. Şu davranışlar korunacak:

   - Maskotun görünmesi
   - Maskota tıklanınca sohbet alanının açılması
   - Sohbet alanının kapatılması
   - Sohbet geçmişinin ekranda gösterilmesi
   - Metin giriş alanının görünmesi
   - Gönderme düğmesinin görünmesi
   - Hazır soru alanının mevcut görünümü
4. Arayüz dosyalarının eski motora yaptığı çağrılar ayrı olarak işaretlenecek.
5. Görsel bileşenler silme listesinden çıkarılacak.
6. Arayüzün görünümü ve açılma–kapanma davranışı kayıt altına alınacak.

### Faz çıkışı

Eski motor kaldırıldığında dahi maskotun ve sohbet alanının hangi dosyalarla korunacağı kesinleşmiş olacak.

### Faz 2 İş Sonuçları

- Hiçbir dosya değiştirilmeden maskot ve sohbet arayüzünün mevcut yapısı incelendi.
- Maskotun `components/hapbi/HapbiMaskot.tsx` dosyasında oluşturulduğu belirlendi.
- Maskotun 57 × 57 piksel boyutunda, ekranın sağ altında bulunduğu ve tıklanınca sohbet alanını açıp kapattığı doğrulandı.
- Sohbet alanının `components/hapbi/HapbiChatModal.tsx` dosyasında oluşturulduğu belirlendi.
- Sohbet alanının 390 × 560 piksel boyutunda ve ekranın sağ altında açıldığı doğrulandı.
- Mesaj geçmişi, hazır sorular, metin alanı, gönderme düğmesi, yenileme düğmesi ve kapatma düğmesi korunacak arayüz bölümleri olarak belirlendi.
- Açılma, kapanma ve sohbet durumunun `components/hapbi/HapbiProvider.tsx` tarafından yönetildiği belirlendi.
- `public/hapbi.png` ve `public/hapbi-wink.png` maskot görselleri koruma listesine alındı.
- `components/hapbi/HapbiSpotlight.tsx` ve `lib/hapbi/hapbiBilgiTabani.ts` canlı rehberlik arayüzü olduğu için koruma listesine alındı.
- Eski motora giden bağlantının `components/hapbi/HapbiProvider.tsx` içindeki `/api/hapbi/sor` çağrısı olduğu belirlendi.
- `app/(panel)/layout.tsx` dosyasının yalnız HapBi bileşenlerini ekrana yerleştirdiği ve ortak dosya olduğu için silinmeyeceği doğrulandı.
- Arayüz dosyaları eski motorun silme listesinden çıkarıldı.
- Mevcut, henüz commit edilmemiş arayüz değişikliklerine dokunulmadı.

---

## - [x] Faz 3 — Mevcut motorun arayüzden ayrılması ✅

### Amaç

Korunacak sohbet arayüzünün eski HapBi motoruna olan bağımlılığını kaldırmak.

### Yapılacak işler

1. Sohbet arayüzünün soru gönderdiği uygulama programlama arayüzü bağlantısı belirlenecek.
2. Ortak arayüz dosyalarındaki eski motor aktarımları çıkarılacak.
3. Eski motoru başlatan çağrılar kaldırılacak.

### Faz çıkışı

Maskot ve sohbet alanı çalışır biçimde açılacak; fakat eski HapBi motoruna hiçbir çağrı yapmayacak.

### Faz 3 İş Sonuçları

- Sohbet arayüzünün soru gönderdiği bağlantının `components/hapbi/HapbiProvider.tsx` içindeki `/api/hapbi/sor` adresine yapılan `POST` isteği olduğu belirlendi.
- İsteği karşılayan bağlantı dosyasının `app/api/hapbi/sor/route.ts` olduğu belirlendi.
- `components/hapbi/HapbiProvider.tsx` içindeki eski motor sözleşmesi aktarımı kaldırıldı.
- Arayüzün ihtiyaç duyduğu kaynak ve eğitim bağlantısı veri yapıları `components/hapbi/HapbiProvider.tsx` içinde tanımlandı.
- `app/api/hapbi/sor/route.ts` içindeki eski HapBi motorunu, araçlarını, kullanıcı kapsamını ve sohbet motorunu başlatan çağrılar kaldırıldı.
- `app/api/hapbi/sor/route.ts` silinmedi; eski motor kapalıyken açık hata cevabı veren bağlantı sınırı olarak korundu.
- Maskotun ve sohbet alanının görünümü ile açılma ve kapanma davranışı değiştirilmedi.
- Ortak HapBilgi dosyalarına müdahale edilmedi.

---

## - [x] Faz 4 — Mevcut HapBi kod motorunun kaldırılması ✅

### Amaç

Eski soru çözümleme ve cevap üretme yapısını kod tabanından kaldırmak.

### Yapılacak işler

Aşağıdaki mevcut HapBi bölümleri dosya bazında incelenerek kaldırılacak:

1. Soru normalleştirme kuralları
2. Ölçüt, kırılım, zaman ve işlem sözlükleri
3. Doğal dil derleyicisi
4. Sabit 14 sorgu tarifi
5. Tarif seçici
6. Mevcut soru planı
7. Hızlı soru planları
8. Takip sorusu ve önceki konuşma devralma kuralları
9. Mevcut HapBi motoru
10. Doğrudan cevap şablonları
11. Mevcut araç seçme yapısı
12. Analitik sorgu yürütme katmanı
13. HapBi’ye özel veri okuyucuları
14. Kanıt paketi ve kanıt doğrulama katmanı
15. Gemini’ye bağlı mevcut yorum katmanı
16. Eski motorun kullandığı yardımcı tür ve sözleşmeler

Her dosya için:

- Tam dosya yolu
- Silme gerekçesi
- Başka dosyalardaki kullanımları
- Silmeden önce kaldırılması gereken bağlantılar

ayrı ayrı bildirilecek ve onay alınacak.

### Faz çıkışı

Kod tabanında eski HapBi motorunu çalıştıran soru çözümleme, tarif seçme, veri sorgulama veya cevap üretme yolu kalmayacak.

### Faz 4 İş Sonuçları

- Eski HapBi kod motorunu oluşturan 16 işlev grubu dosya bazında eşleştirildi.
- `lib/hapbi/` altındaki soru normalleştirme, sözlük, dönem çözümleme, doğal dil derleme, sabit tarifler ve tarif seçme dosyaları silindi.
- Mevcut soru planı, hızlı soru planı, takip sorusu ve konuşma devralma dosyaları silindi.
- Mevcut HapBi motoru ile doğrudan cevap üretme ve cevap şablonu dosyaları silindi.
- Araç tanımları, araç seçme yapısı ve `lib/hapbi/aracMotorlari/` altındaki dosyalar silindi.
- Analitik sorgu yürütme, istek önbelleği, toplama, tarif yürütme ve HapBi veri okuyucu dosyaları silindi.
- Kanıt üretme, kanıt doğrulama, kanıt paketi ve Gemini yorum katmanı dosyaları silindi.
- Eski motorun yardımcı tür, kapsam, rol matrisi, yetki, kullanıcı bağlamı ve bilgi kaynağı dosyaları silindi.
- Başlangıçta kısmen silinmesi planlanan `lib/hapbi/hizliSorgu.ts`, hazır soruların kaldırılması yönündeki kullanıcı kararı üzerine tamamen silindi.
- Canlı tur tanımlarını içeren `lib/hapbi/hapbiBilgiTabani.ts`, kullanıcı kararı üzerine bağlantılarıyla birlikte silindi.
- Canlı tur bileşeni `components/hapbi/HapbiSpotlight.tsx` ve ona ait `tests/hapbiCanliTurMetinleri.smoke.test.ts` dosyası silindi.
- `components/hapbi/HapbiProvider.tsx`, `components/hapbi/HapbiMaskot.tsx`, `components/hapbi/HapbiChatModal.tsx` ve `app/(panel)/layout.tsx` içindeki canlı tur bağlantıları kaldırıldı.
- Maskot ve sohbet alanı korundu.
- Hazır soru alanı ve hazır soru gönderme bilgisi sohbet arayüzünden kaldırıldı.
- `lib/hapbi/` altında eski motor dosyası kalmadığı doğrulandı.
- Uygulama kodunda eski HapBi motoruna kalan bağlantı bulunmadığı doğrulandı.
- HapBilgi’nin ortak rol, zaman, lig, rapor, üretim, yayın ve E-Club dosyaları silinmedi.
- Veritabanı nesnelerine bu fazda dokunulmadı.

---

## - [ ] Faz 5 — Eski HapBi sınamalarının kaldırılması

### Amaç

Silinen motoru sınayan ve artık geçerliliği kalmayan sınama dosyalarını kaldırmak.

### Yapılacak işler

1. Yalnız eski HapBi motorunu sınayan dosyalar belirlenecek.
2. Maskot ve sohbet arayüzünü sınayan dosyalar korunacak.
3. HapBilgi’nin rol, zaman, veri, rapor ve öğrenme kurallarını sınayan ortak dosyalar korunacak.
4. Birden fazla sistemi sınayan dosyalarda yalnız HapBi’ye ait bölümün çıkarılması gerekiyorsa dosya için ayrıca değişiklik izni istenecek.
5. Yalnız HapBi’ye ait sınama dosyaları ayrı ayrı onay alınarak silinecek.
6. Silinen dosyalara yapılan sınama komutu bağlantıları temizlenecek.

### Faz çıkışı

Eski HapBi motoruna bağlı sınama kalmayacak; HapBilgi’nin ortak sınamaları korunacak.

---

## - [ ] Faz 6 — HapBi’ye özel veritabanı nesnelerinin kaldırılması

### Amaç

Yalnız eski HapBi motoru için oluşturulmuş veritabanı işlevlerini, HapBilgi verilerine dokunmadan kaldırmak.

### Yapılacak işler

1. Aşağıdaki işlevlerin veritabanında bulunup bulunmadığını gösteren salt okunur SQL komutları hazırlanacak:

   - `get_hapbi_tclub_analitik_v1`
   - `get_hapbi_cclub_analitik_v1`
   - `get_hapbi_eclub_analitik_v1`
   - `get_hapbi_uretim_analitik_v1`
2. Bunların dışında `hapbi` adı taşıyan veritabanı nesneleri aranacak.
3. Her nesnenin bağımlılıkları ayrı ayrı sorgulanacak.
4. Başka HapBilgi bölümlerinin kullandığı nesneler silinmeyecek.
5. Yalnız eski HapBi tarafından kullanılan her işlev için ayrı silme komutu hazırlanacak.
6. Her SQL komutu çalıştırılmadan önce size sunulacak.
7. Silme komutlarında bağımlılıkları zorla kaldıran `CASCADE` kullanılmayacak.
8. Komutları siz çalıştıracaksınız.
9. HapBi SQL kurulum dosyaları, ilgili veritabanı işlevleri kaldırıldıktan sonra dosya bazında onay alınarak silinecek.

### Kesinlikle silinmeyecek veriler

- Kullanıcı kayıtları
- Firma kayıtları
- Takım kayıtları
- Bölge kayıtları
- Ürün kayıtları
- Yayın kayıtları
- İzleme kayıtları
- Kazanılan puan kayıtları
- Puan kaybı kayıtları
- Soru ve cevap kayıtları
- Öneri kayıtları
- Challenge kayıtları
- E-Club kayıtları
- Talep kayıtları
- Üretim görevi kayıtları
- HapBilgi’nin ortak görünümleri
- HapBilgi’nin ortak rapor ve lig işlevleri

### Faz çıkışı

Eski HapBi’ye özel veritabanı işlevleri kaldırılmış, HapBilgi’nin veri ve veritabanı yapısı korunmuş olacak.

---

## - [ ] Faz 7 — HapBilgi zarar denetimi

### Amaç

HapBi silindikten sonra HapBilgi’nin diğer bölümlerinde bozulma oluşmadığını doğrulamak.

### Yapılacak işler

1. Kod tabanında silinen HapBi dosyalarına kalan bağlantılar aranacak.
2. Eksik dosya aktarımı bulunup bulunmadığı kontrol edilecek.
3. HapBi dışındaki tip denetimi çalıştırılacak.
4. HapBi dışındaki sınamalar çalıştırılacak.
5. Uygulamanın üretim derlemesi çalıştırılacak.
6. Şu HapBilgi alanları ayrı ayrı kontrol edilecek:

   - Oturum ve rol çözümleme
   - Ana sayfalar
   - T-Club
   - C-Club
   - E-Club
   - Üretim
   - Raporlar
   - Yayınlar
   - Öğrenme araçları
7. Maskotun görünmeye devam ettiği doğrulanacak.
8. Maskota tıklanınca mevcut sohbet alanının açıldığı doğrulanacak.
9. Veritabanında ana tabloların ve ortak işlevlerin korunduğu salt okunur SQL komutlarıyla doğrulanacak.

### Faz çıkışı

HapBi’nin eski motoru kaldırılmış; HapBilgi’nin diğer işlevleri ile HapBi maskotu ve sohbet arayüzü korunmuş olacak.

---

## - [ ] Faz 8 — Silme raporu

### Yapılacak işler

Aşağıdaki sonuçlar madde madde bildirilecek:

1. Korunan maskot ve sohbet dosyaları
2. Değiştirilen bağlantı dosyaları
3. Silinen eski HapBi motor dosyaları
4. Silinen HapBi sınama dosyaları
5. Silinen HapBi SQL dosyaları
6. Veritabanından kaldırılan HapBi işlevleri
7. Korunan HapBilgi verileri ve ortak işlevleri
8. Yapılan denetimler
9. Başarılı ve başarısız sonuçlar
10. Açık kalan herhangi bir HapBi bağlantısı

Bu plan yalnızca mevcut HapBi motorunun silinmesini kapsar. Yeni deterministik sorgu motorunun kurulması bu planın dışındadır.
