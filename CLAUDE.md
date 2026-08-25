# Çalışma Kuralları (her oturumda geçerli)

### Kural 1. İnisiyatif Almama, Sadakat ve Kesin Emir İtaati

a. **Sınırlar ve Kesin Emir İtaati:** Kendiliğinden araç çalıştırma, dosya değiştirme, seçenek sunma veya kapsam genişletme kesinlikle yasaktır; yalnızca emredilen iş yapılır, eksik veya anlamsız talimatlarda yorum yapmak yerine doğrudan soru sorulur.
b. **Onaysız Müdahale Yasağı:** Proje/rol kısıtları kapsamında "daha iyi olur" düşüncesiyle hareket edilmez, plan dışı veya sessiz müdahalelerde bulunulmaz, kurallar iş içinde esnetilmez.
c. **Tespite ve Talimata Birebir Sadakat:** Tespit ve emirler kesin talimattır; kök neden teşhisi bahanesiyle daraltılamaz, üzerine risk azaltma refleksi dahil hiçbir kişisel yöntem eklenemez. Sapma gerekiyorsa açıkça yazılır ve onay istenir.

---

### Kural 2. Proje Dokümantasyonu, Genel Kaynaklar ve Bilgi Notları

a. **Referans Belgeler ve Kaynak Disiplini:** Sistem geneline ilişkin konularda ana referans docs/BLUEBOOK.md belgesidir; docs/ altındaki belgeler kesin kararları içerir, kararlar yeniden sorgulanmaz ve çalışma kuralları (Claude.md) her oturumda eksiksiz uygulanır.
b. **Modül Ön İnceleme Zorunluluğu:** Talepler sayfasına ilişkin her çalışma öncesinde; 21 dosya, form alanları, sıralama, doğrulama kuralları, detay sayfası bölümleri ve API uçlarını içeren tam künye eksiksiz okunur.
c. **Proje Çekirdeği ve Kod Bütünlüğü:** Çekirdeğin (UTT izler-puan-lig, BM önerir-puan) zamanla genişlemesiyle ortaya çıkan dosya asimetrilerine dikkat edilir; kodun sadece "çalışıyor" görünmesi yeterli sayılmayıp mimari yapı korunur.

---

### Kural 3. Keşif, Soru Sorma ve Geliştirme Akışı

a. **Keşif ve Kodlama Disiplini:** Şema ve olgu keşif aşamasında tek seferde toplanır, kod tek oturuşta yazılır; yazım sürecinde parça parça kontrol turları açılmaz.
b. **Kaynak Kontrolü ve Hazır Şablon Yasağı:** Soru sormadan önce cevabın planda veya mevcut malzemede olup olmadığı kontrol edilir; örnek yapıların biçimi kopyalanmaz, her vaka için olay sırası koddan teyit edilerek baştan kurulur.
c. **İşlev Odaklı Yöntem ve Kapsamlı Tarama:** Veritabanı yöntemleri (RPC/View) sayfanın işlevine göre seçilir; kısıtlar henüz veri girdisi aşamasında engellenir, taramalarda yalnızca ekranlarla yetinilmeyip bildirim ve dosya adı gibi kalıcı iz bırakan tüm bileşenler kontrol edilir. Görsel düzeltmeler ölçülerek yapılır.

---

### Kural 4. Onay Disiplini ve Önceden Haber Verme

a. **Teşhis Fazı Disiplini:** Teşhis kapatılmadan çözüm veya onay seçeneği sunulmaz; sürecin aşamaları ve ilerlemesi tamamen İskender'in kontrolündedir.
b. **Önceden Haber Verme ve Onay:** Sistemi doğrudan veya dolaylı etkileyen her eylem öncesinde (kod commit'i, dosya silme vb.) yapılacaklar madde madde listelenip onay alınır; yalnızca onay gerekmeyen işler ve "onaya gerek yok" denilen durumlar istisnadır.
c. **Çalışma Düzeni:** Veritabanı (SQL) işlemleri yalnızca İskender tarafından yürütülür; commit atılır ancak izinsiz push yapılmaz.

---

### Kural 5. Veritabanı (DB) Güvenliği ve Müdahale Kuralları

a. **Mutlak DB Yazım Yasağı:** Veritabanı erişimi (okuma dahil) her seferinde açık izin gerektirir; veritabanına veri yazan veya yapıyı değiştiren hiçbir komut doğrudan çalıştırılmaz, gerekli SQL kodları İskender'e iletilir.
b. **Adım Adım Müdahale:** Canlı veritabanındaki riskli işlemlerde toplu komut veya fonksiyon yürütülmez; komutlar tek tek verilir, İskender koşar ve sonuca göre sıradaki adıma geçilir.
c. **Geçiş Durumu ve Teyit:** Davranış değişikliklerinde yarıda kalan canlı kayıtlar incelenir ve doğrulama/teyit SQL'leri İskender'e sunulur.

---

### Kural 6. Kalite, Test, Doğrulama ve Sınırlar (Frenler)

a. **Kalite İlkeleri ve Test Felsefesi:** Çözümler iş yüküne bakılmaksızın ideal, kaliteli, sürdürülebilir ve verimli 4 değer ilkesine göre kalıcı olarak kurgulanır, semptom yamaları yasaktır; testler bitirilmesi gereken bir amaç değil, iyileştirme ihtiyacını ve asıl sorunu ortaya çıkaran bir araç olarak yürütülür.
b. **Doğrulama Tavanı ve Takılma Kuralı:** Her iş adımında en fazla 1 mutlu yol ve 1 red senaryosundan oluşan tek bir smoke test koşulur, rol matrisi taramaları yapılmaz; teknik denetim üçlüsü (tsc, denetim, lint:mimari) sağlandığında adım kapatılır; aynı işte 2 başarısız denemede veya 2 dakikayı aşan döngülerde derhal durularak durum 3 cümleyle özetlenip talimat beklenir.
c. **Kalite Taraması Frenleri:** Tarama aşamasında sıfır değişiklik kuralı uygulanır, hiçbir dosya değiştirilmez ve veritabanına yazım yapılmaz; bulgular standart formatta (B-##, kategori, kanıt, önem, öneri) derinleşmeden raporlanıp geçilir; tarama maddeleri tek tek koşulur ve bir maddede 2 takılmada durup sorulur.
d. **Düzeltme Disiplini ve Veri Temizliği:** Q2 onayı sonrası yalnızca İskender'in KRİTİK veya ORTA olarak onayladığı bulgular için işlem yapılır; her bulgu tek commit olacak şekilde üçlü doğrulamadan geçirilir, davranış değiştiren düzeltmelerde önce/sonra kanıtı rapora eklenir ve oluşturulan test verileri iş sonunda mutlaka temizlenir.

---

### Kural 7. İletişim, Terminoloji ve Mesaj Kuralları

a. **Doğrudan İletişim ve Terminoloji:** Sorulara benzetme ve gereksiz detaylardan kaçınılarak doğrudan yanıt verilir; "kart" sayfanın dış kapsayıcısını, "iç kart" ise içteki beyaz kutuları ifade eder.
b. **Kamusal Alan Kısıtları:** Kamuya açık alanlarda ve modül içeriklerinde eczane lehine açık kazanç vaadi içeren ifadelere yer verilemez.
c. **Sistem Mesajları ve Asistan Stratejisi:** Toast ve durum mesajları kullanıcı yönlendirmesinde ve AI asistan prompt kaynağında kritik rol oynadığından kodlama kadar önceliklidir.
