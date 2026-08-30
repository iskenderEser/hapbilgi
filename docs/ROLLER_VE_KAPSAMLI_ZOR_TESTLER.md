# Roller ve Kapsamlı Zor Testler

## Amaç

Bu çalışma, HapBilgi'deki her rolün görev tanımı içinde bulunan bütün ana fonksiyonları olağan kullanımın ötesinde zorlayarak yetki açığı, yarış koşulu, mükerrer kayıt, yarım işlem, veri sızıntısı, puan veya bakiye tutarsızlığı ve sessiz hata ihtimallerini ortaya çıkarmayı amaçlar. Testler yalnızca bir işlemin çalıştığını göstermeyecek; eşzamanlı kullanım, tekrar deneme, işlem ortasında veri veya yetki değişimi ve dış servis kesintisi gibi gerçek sistem risklerini de sınayacaktır.

## Uygulama Yöntemi

1. Testler aşağıdaki sırayla ve tek tek yürütülür.
2. Her test başlamadan önce kullanılacak rol, hesap, test verisi, beklenen sonuç ve rollback kapsamı kesinleştirilir.
3. Test verileri benzersiz bir test işaretiyle oluşturulur; gerçek kullanıcı ve üretim verileri değiştirilmez.
4. Eşzamanlılık testlerinde aynı işlem iki oturum, cihaz veya istek üzerinden kontrollü biçimde çakıştırılır.
5. Yarım işlem testlerinde güvenli bir aşamada hata oluşturulur; tekrar deneme ve idempotency davranışı doğrulanır.
6. Veritabanında mümkün olan testler işlem içinde yürütülüp `ROLLBACK` ile geri alınır.
7. Auth, Bunny veya benzeri işlem dışı sistemlere dokunan testlerde telafi edici silme uygulanır.
8. Rollback sonrasında test öncesi ve test sonrası kayıt sayıları, ilişkiler, dosyalar, puanlar, bakiyeler ve yetkiler karşılaştırılır.
9. Bir test ancak beklenen sonuç, güvenlik sonucu ve sıfır kalıntı kontrolü kaydedildikten sonra yapılmış sayılır.
10. Checkbox testin **uygulandığını** gösterir; testin başarılı, hatalı veya düzeltme sonrası başarılı olduğu aynı test maddesinin hemen altında belirtilir.

## Çıktıların Yönetimi

- Her tamamlanan testin checkbox'ı `[x]` yapılır.
- Test kodu, tarih, kullanılan rol, beklenen sonuç, gerçekleşen sonuç ve rollback sonucu ilgili test maddesinin hemen altına yazılır.
- Başarılı testler `Başarılı`, açık veren testler `Hata`, düzeltilip yeniden doğrulanan testler `Giderildi` durumuyla kaydedilir.
- Hata çıkan her test için hatanın ne olduğu ve etkisi **2-3 cümleyle** yazılır.
- Aynı kayıtta uygulanacak çözüm ve doğrulama yöntemi **2-3 cümleyle** yazılır.
- Hata giderilmeden test başarılı sayılmaz; düzeltme sonrasında aynı zor senaryo yeniden çalıştırılır.
- Test sırasında oluşturulan kayıt veya dosya kalırsa rollback başarısız kabul edilir ve sonraki teste geçilmez.
- Commit ve push işlemleri kullanıcı onayı olmadan yapılmaz.

## Test Listesi

### Admin

**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [x] **ADM-01 — Firma ve hiyerarşi:** Firma, takım, bölge ve kullanıcı oluşturma sırasında işlem yarıda kesilip tekrar gönderilecek; eksik hiyerarşi, mükerrer kayıt ve yetim Auth hesabı oluşmayacak.

  - **Tarih:** 28 Ağustos 2026
  - **Rol ve hesap:** Admin / service-role ile izole `ZZ_ADM01` test verisi
  - **Durum:** Başarılı — düzeltme sonrası
  - **Beklenen sonuç:** Eşzamanlı oluşturma isteklerinden yalnız biri kabul edilmeli, hiyerarşide mükerrer ad oluşmamalı ve rollback sonrasında test kalıntısı bulunmamalıydı.
  - **Gerçekleşen sonuç:** İki işlem de ön kontrolde kayıt bulamadı; aynı firmaya aynı adlı iki takım ve aynı takıma aynı adlı iki bölge eklemeyi başardı.
  - **Rollback sonucu:** Başarılı
  - **Kalan kayıt veya dosya:** Yok — kalan test kaydı `0`

  **Hata ve etkisi:** Takım adında firma kapsamında, bölge adında takım kapsamında veritabanı tekillik kapısı bulunmuyor; API'deki kontrol-sonra-ekle sırası eşzamanlı iki istekte yarış koşuluna açık. Bunun sonucunda aynı hiyerarşi altında mükerrer takım ve bölge oluşabiliyor; rapor, kullanıcı ataması ve kapsam çözümü belirsizleşebiliyor.

  **Çözüm ve doğrulama:** Firma adı, firma içindeki takım adı ve takım içindeki bölge adı için normalize edilmiş veritabanı benzersiz indeksleri eklenmeli; route'lar `23505` yarış sonucunu kontrollü ve anlaşılır yanıtlamalı. `firma_no_ata()` içindeki `MAX+1` üretimi sequence/identity yapısına taşınmalı; ardından aynı iki oturumlu test tekrar çalıştırılarak tek kaydın kabul edildiği ve rollback sonrası sıfır kalıntı kaldığı doğrulanmalı.

  **Tekrar test — 29 Ağustos 2026:** İzole firmada aynı adlı takım ve bölge iki ayrı bağlantıdan eşzamanlı eklendi. İki takım isteği de kabul edilerek `2` takım, iki bölge isteği de kabul edilerek `2` bölge oluştu. **Hata devam ediyor; rollback başarılı, test kalıntısı yok.**

  **Düzeltme — 29 Ağustos 2026:** Firma adı, firma içindeki takım adı ve takım içindeki bölge adı için normalize edilmiş benzersiz veritabanı indeksleri kuruldu; API route'ları eşzamanlı `23505` çakışmasını kontrollü `422` yanıtına dönüştürüyor. `firma_no_ata()` içindeki `MAX+1` üretimi kaldırılarak veritabanı sequence yapısına geçirildi.

  **Düzeltme sonrası test:** Aynı adlı takım ve bölge için iki eşzamanlı isteğin yalnız biri kabul edildi, diğerleri `23505` ile reddedildi; her kapsamda yalnız `1` kayıt oluştu. Farklı adlı iki firma eşzamanlı oluşturuldu ve benzersiz `4`/`5` numaralarını aldı; hedef kontroller `4/4` başarılı, rollback sonrası firma/takım/bölge kalıntısı `0`.

**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [x] **ADM-02 — Toplu kullanıcı yükleme:** Aynı e-posta, farklı rol, bozuk takım ve geçerli satırlar tek dosyada gönderilecek; yalnız geçerli bütün paket kabul edilecek veya tamamı geri alınacak.

  - **Tarih:** 28 Ağustos 2026
  - **Rol ve hesap:** Admin / yerel Admin oturumu
  - **Durum:** Başarılı — düzeltme sonrası
  - **Beklenen sonuç:** Aynı e-posta ve geçersiz rol içeren paket bütünüyle reddedilmeli; hiçbir kullanıcı veya eksik hiyerarşi kaydı yazılmamalıydı.
  - **Gerçekleşen sonuç:** Dört satırın ikisi hatalı bulunduğu hâlde geçerli GM ile takımsız TM kaydedildi; TM pasif ve eksik bilgili oluşturuldu. Arayüz ve API sonucu `2 eklendi, 0 güncellendi, 2 satır işlenemedi` olarak doğrulandı.
  - **Rollback sonucu:** Başarılı
  - **Kalan kayıt veya dosya:** Yok — aktif kullanıcı `0`, test firması `0`, silinmiş kullanıcı arşivi `0`

  **Hata ve etkisi:** Toplu yükleme satır bazında devam ediyor; paket içindeki yapısal hatalar geçerli görülen diğer satırların kaydedilmesini engellemiyor. Bu davranış, tek dosyanın tek işlem olduğu beklentisini bozuyor ve kullanıcının yarım kurulmuş firma yapısı ile eksik bilgili hesapları ayrıca bulup düzeltmesine yol açıyor.

  **Çözüm ve doğrulama:** Kaydetme öncesinde bütün satırlar doğrulanmalı; tek bir `hatali` veya paket bütünlüğünü bozan `eksik` satır varsa hiçbir Auth, kullanıcı, takım ya da bölge kaydı oluşturulmadan paket reddedilmeli. Tamamen geçerli pakette kayıt adımları işlem günlüğü ve telafi zinciriyle atomik yürütülmeli; aynı zor dosya yeniden çalıştırılarak sıfır yazım, ardından bütünü geçerli dosyayla tam yazım ve hata anında sıfır kalıntı doğrulanmalı.

  **Düzeltme — 29 Ağustos 2026:** Takım ve bölge oluşturma dahil bütün yazımlar paket doğrulamasının arkasına taşındı; tek hatalı satırda API `422` döndürerek sıfır yazımla paketi reddediyor ve arayüz kaydet düğmesini kapatıyor. Tamamen geçerli pakette beklenmeyen Auth/DB hatası oluşursa daha önce oluşturulan kullanıcı, Auth, bölge ve takım kayıtları ile tamamlanan kullanıcı güncellemeleri ters sırada geri alınıyor.

  **Kod doğrulaması:** ADM-02 hedef testleri `3/3`, ilgili lint ve proje tip kontrolü başarılı.

  **Düzeltme sonrası canlı test — 29 Ağustos 2026:** İki geçerli satır ile geçersiz rol ve mükerrer e-posta taşıyan iki hatalı satır aynı pakette gönderildi; API `422` döndürerek paketi bütünüyle reddetti ve iki hatayı doğru satır numaralarıyla raporladı. Kullanıcı, Auth, takım ve bölge kalıntılarının tamamı `0`; geçici firma rollback sonrasında `0` kaldı.

**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [x] **ADM-03 — Rol değiştirme (BM → TM):** Bölge Müdürünün (`bm`) aktif görevi, puanı, siparişi ve rapor kaydı varken rolü Takım Müdürüne (`tm`) eşzamanlı değiştirilecek; eski BM yetkileriyle yeni TM yetkileri karışmayacak.

  - **Tarih:** 29 Ağustos 2026
  - **Rol ve hesap:** Admin / Selin Yılmaz (`selin@test2.com`), BM → TM
  - **Durum:** Başarılı
  - **Beklenen sonuç:** İki admin oturumundan aynı anda yapılan BM → TM değişikliği tek ve tutarlı bir TM durumu üretmeli; takım korunmalı, BM'ye ait bölge bağı kaldırılmalı, Auth rolü eşleşmeli ve mevcut görev, puan, sipariş, rapor ile öneri kayıtları kaybolmamalıydı.
  - **Gerçekleşen sonuç:** İki istek de aynı kesin TM durumunda birleşti. Takım bağı korundu, bölge bağı kaldırıldı, Auth ve kullanıcı tablosundaki rol `tm` oldu; bağlı kayıt sayıları değişmedi. BM'ye özel Challenge Club ve kişisel HBStore kapıları kapanırken TM rapor yolu ve takım kapsamı devreye girdi.
  - **Arayüz gözlemi:** Eşzamanlı kaydın hemen ardından iki listede de eski BM satırı kısa süre görüntülendi; yenilenen listede TM bilgisi doğru gösterildi.
  - **Rollback sonucu:** Başarılı — rol `bm`, takım ve İzmir bölgesi ile Auth metadata eski hâline döndü.
  - **Kalan kayıt veya dosya:** Yok — test için oluşturulan tek geçici HBStore siparişi silindi.

  **Sonuç:** Rol değişimi veri kaybı veya karma yetki üretmedi. Eşzamanlı güncelleme sonrası liste satırının kısa süre eski değeri göstermesi kalıcı veri hatası oluşturmadı.

  **Ek rol geçişi — PM → BM:** Merve Duran (`merve@test2.com`) Ürün Müdüründen Bölge Müdürüne çevrildi; Şimşek takımı ve İzmir bölgesiyle BM hiyerarşisi kuruldu, Auth rolü eşleşti. PM'ye ait 30 talep, 11 senaryo, 27 video ve 27 soru seti korunurken üretim yetkileri kapandı; BM'ye ait Challenge Club, kişisel HBStore ve bölge raporu kapıları açıldı. Rol yeniden PM'ye alındı, bölge bağı kaldırıldı ve bütün sayımların değişmediği doğrulandı. **Durum: Başarılı; rollback tamamlandı, test kalıntısı yok.**

  **Ek rol geçişi — UTT → PM:** Berk Kılıç (`berk@test2.com`) Ürün Tanıtım Temsilcisinden Ürün Müdürüne çevrildi; Auth rolü eşleşti, UTT tüketim yetkileri kapanıp PM üretim yetkileri açıldı. Mevcut 83 izleme, 33 puan, 1 öneri ve 4 yanlış cevap kaydı değişmeden korundu. Rol yeniden UTT'ye alındı, Şimşek takımı ile İzmir bölgesi geri yüklendi ve bütün sayımlar doğrulandı. **Durum: Başarılı; rollback tamamlandı, test kalıntısı yok.**

**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [x] **ADM-04 — Silme işlemleri:** Bağlı kullanıcı, yayın, sipariş ve rapor bulunan hiyerarşi silinmeye çalışılacak; veri kaybı yaratmadan engellenecek.

  - **Tarih:** 29 Ağustos 2026
  - **Hedef:** Hepifarma → Şimşek takımı → İzmir bölgesi
  - **Durum:** Başarılı
  - **Beklenen sonuç:** Bağlı kullanıcı, yayın, sipariş ve rapor verileri bulunan firma hiyerarşisinin silinmesi reddedilmeli ve hiçbir bağlı kayıt değişmemeliydi.
  - **Gerçekleşen sonuç:** Firma silme isteği kullanıcı onayıyla çalıştırıldı; sistem, 50 talep üreten firmanın dışa aktarımı bulunmadığı için işlemi `422` koruma yanıtıyla durdurdu. Test sırasında hiyerarşide 15 kullanıcı, 47 yayın, 139 izleme, 69 puan kaydı ve geri alınabilir tek geçici sipariş bulunuyordu.
  - **Veri bütünlüğü:** Firma, takım, bölge, kullanıcı, talep, izleme ve puan sayımları silme denemesinden önceki değerlerle aynı kaldı.
  - **Rollback sonucu:** Başarılı — test siparişi silindi.
  - **Kalan kayıt veya dosya:** Yok.

  **Sonuç:** Silme koruması bağlı veriler kaldırılmadan firma hiyerarşisinin silinmesine izin vermedi; veri kaybı oluşmadı.

**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [x] **ADM-05 — Sistem ayarları:** Aynı ayar iki oturumdan farklı değerlerle güncellenecek; kayıp güncelleme ve yarım ayar paketi oluşmayacak.

  - **Durum:** Uygulanmadı
  - **Karar:** İskender, testin sahada karşılığı bulunmadığı için anlamsız olduğunu belirtti ve testin geçilmesini istedi.

**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [x] **ADM-06 — HBStore yönetimi:** Sipariş ile ürün pasifleştirme işlemlerinin aynı anda gerçekleşmesindeki yarış koşulu ölçülecek; sipariş kaybolmayacak, stok negatife düşmeyecek ve puan karşılıksız kesilmeyecek.

  - **Tarih:** 29 Ağustos 2026
  - **Durum:** Başarılı
  - **Yöntem:** Stoku `1`, fiyatı `1` puan olan izole ürün için sipariş RPC'si ile admin pasifleştirme güncellemesi iki ayrı bağlantıdan aynı anda çalıştırıldı.
  - **Gerçekleşen sonuç:** Pasifleştirme önce kesinleşti; sipariş `Bu ürün firmanız için satışa açık değil.` yanıtıyla kontrollü olarak reddedildi. Ürün pasif, stok `1`, sipariş sayısı `0` ve kullanıcının bakiyesi değişmeden `582` kaldı.
  - **Rollback sonucu:** Başarılı — geçici ürün ve adres silindi, bakiye doğrulandı.
  - **Kalan kayıt veya dosya:** Yok.

  **Sonuç:** Yarış koşulu tek ve tutarlı bir son durum üretti; kayıp sipariş, eksi stok veya karşılıksız puan kesintisi oluşmadı.

**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [x] **ADM-07 — E-Club yönetimi:** Aynı kayıt talebi eşzamanlı onaylanıp reddedilecek; tek kesin durum ve tek üyelik oluşacak.

  - **Durum:** Uygulanmadı
  - **Karar:** İskender, senaryonun gerçek E-Club üyelik sürecini temsil etmediğini ve alternatif mükerrer GLN senaryosunun da kullanıcı deneyimi katmanında engelleneceğini belirterek testi anlamsız buldu.

**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [x] **ADM-08 — Rollback:** Auth, veritabanı ve depolama adımlarından biri başarısız olduğunda oluşturulan bütün test kalıntıları temizlenecek.

  - **Tarih:** 29 Ağustos 2026
  - **Durum:** Başarılı
  - **Yöntem:** Benzersiz e-posta ile Auth hesabı oluşturulurken mevcut bir kullanıcının telefon numarası verilerek veritabanı ekleme adımında tekillik hatası zorlandı.
  - **Gerçekleşen sonuç:** Sistem, `Bu telefon numarası başka bir kullanıcıda kayıtlı` mesajıyla işlemi reddetti ve Auth'ta açılmış hesabı telafi adımıyla sildi.
  - **Doğrulama:** Test e-postası için `kullanicilar` kaydı `0`, Auth hesabı `0` bulundu.
  - **Kalan kayıt veya dosya:** Yok.

  **Sonuç:** Auth başarılı olup veritabanı adımı başarısız olduğunda rollback eksiksiz çalıştı; yetim Auth hesabı veya kullanıcı satırı oluşmadı.

### GM ve Yönetici Ailesi

**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [x] **YON-REG-01 — Yayın tüketiminde sıfır etki:** Yönetici video, podcast, dijital broşür ve PDF yayınlarını ilk ve tekrar açtığında puan, izleme kazanımı, test veya tekrar puanı oluşmayacak.

  - **Tarih:** 29 Ağustos 2026
  - **Rol ve hesap:** GM / Murat Aydın
  - **Durum:** Giderildi — hedef doğrulama başarılı
  - **Canlı video sonucu:** Normavas yayını ilk kez ve tekrar sonuna kadar izlendi; test veya puan gösterilmedi. Katalog toplamı `36`, Ürün Müdürlüğü toplamı `13` olarak değişmeden kaldı.
  - **Canlı kapsam notu:** Katalogda yayında podcast, dijital broşür veya PDF bulunmadığı için bu üç tür canlı içerikle açılamadı; ortak salt görüntüleme sözleşmesi hedef testlerde doğrulandı.
  - **Kod doğrulaması:** YON-REG-01 hedef testleri `5/5`, ilgili lint ve proje tip kontrolü başarılı.
  - **Kalan kayıt veya dosya:** Yok

  **Hata ve etkisi:** Yönetici kataloğu video dışındaki yayınların `arac_id` ve `arac_turu` alanlarını taşımadığı için bu araçlar açılamıyordu. Alanlar taşınsa bile podcast, görsel ve PDF oynatıcıları gözlemci kipini bilmediğinden izleme başlatma uçlarını çağıracaktı; sunucu yöneticiyi reddettiği için kayıt kaçağı oluşmayacak, fakat yayın kullanılamayacaktı.

  **Çözüm ve doğrulama:** Katalog dört aracın kimlik ve türünü taşıyacak şekilde düzeltildi; yöneticiye yalnız kendi firması için imzalı dosya okuma izni verildi. Üç oynatıcıya salt görüntüleme kipi eklenerek izleme, ilerleme, tamamlama, puan ve soru yolları kapatıldı; izleme API'lerinin yönetici rolünü ayrıca reddetmeye devam ettiği hedef testlerle doğrulandı.

**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [x] **YON-REG-02 — Yasaklı işlemlerde sıfır yetki:** Yönetici sipariş verme, eczane ekleme, yayın gönderme ve yayın talep etme işlemlerini arayüzden ve doğrudan API'den deneyemeyecek; veritabanında kalıntı oluşmayacak.

  **Sonuç (29.08.2026 — GM Murat Aydın):** Mağaza, eczane ekleme ve talep sayfalarına doğrudan girişler ana sayfaya döndü; yasaklı işlem düğmeleri gösterilmedi. Sipariş, eczane ekleme, Challenge gönderme, E-Club/Eczanem yayın gönderme ve talep oluşturma uçlarının rol kapıları, istek gövdesi okunmadan ve herhangi bir yazım çağrısından önce çalışıyor; hedef doğrulamalar başarılıdır.

  **Bulunan hata:** `/challenge-club` doğrudan adresinde GM'ye işlem yüzeyi açılmadı ancak rol yönlendirmesi tamamlanmayarak boş sayfa görünüyordu. Veri yazımı veya yetki aşımı oluşmadı; sorun yalnız yönlendirme davranışıydı.

  **Çözüm:** Challenge Club kimlik kontrolü `replace` yönlendirmesine çevrildi ve BM olmayan rol için kullanıcı/rol durumu kurulmadan kesin dönüş eklendi. Böylece yasaklı işlem bileşenleri ve veri çağrıları başlamadan kullanıcı ana sayfaya gönderiliyor; GM oturumuyla doğrudan URL denemesinde yönlendirme canlı olarak doğrulandı.

**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [x] **YON-REG-03 — Yayın açmada sıfır yetki:** Yönetici sıfırdan, mevcut içerikten veya dosya yükleyerek yayın açamayacak; doğrudan API denemeleri reddedilecek ve medya/veritabanı kalıntısı oluşmayacak.

  **Sonuç (29.08.2026 — GM Murat Aydın):** Video üretimi, kullanıcı yayınları ve tüm yayınlar sayfaları doğrudan URL denemelerinde ana sayfaya döndü. Yayın oluşturma, hazır video yükleme, İU video yükleme ve ortak öğrenme aracı yükleme uçlarının yönetici rolünü yazım başlamadan reddettiği; hiçbir Bunny yükleme yetkisi veya medya/veritabanı kaydı üretilmediği hedef testlerle doğrulandı.

  **Bulunan hata:** Navbar'da gizli olmasına rağmen `/yayin-yonetimi` doğrudan URL ile GM'ye açılıyor, yayın yönetimi verilerini ve işlem yüzeyini gösteriyordu. Sunucu API'leri yazımı reddettiği için yayın veya medya kalıntısı oluşmuyordu; ancak arayüz ve firma verisi gereksiz biçimde erişilebilirdi. Ortak medya yükleme uçlarında rol kontrolü sahiplik sorgusuna bırakıldığı için yönetici isteği dosya gövdesini okuyup bazı doğrulama/sorgu adımlarına kadar ilerleyebiliyordu.

  **Çözüm:** Yayın Yönetimi sayfasına üretici rol kapısı eklendi; yetkisiz kullanıcı için veri kancaları kurulmadan ana sayfa yönlendirmesi yapılıyor. Ana dosya ve podcast destek dosyası yükleme başlatma/tamamlama uçlarına erken üretim hattı rol kapısı eklenerek yönetici istekleri gövde okunmadan, Bunny yetkisi üretilmeden ve veri yazımına ulaşmadan kesildi; GM oturumuyla canlı yönlendirme ve 11/11 hedef doğrulama başarılıdır.

**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [x] **YON-REG-04 — Etkileşimde sıfır yetki:** Yönetici yayınlarda beğeni, favori, indirme, paylaşım veya tamamlandı kaydı oluşturamayacak; doğrudan API denemeleri reddedilecek ve kalıntı oluşmayacak.

  **Sonuç (29.08.2026 — GM Murat Aydın):** Canlı şirket kataloğunda yayın kartları yalnız etkileşim sayılarını gösterdi; açılan yayında beğeni, favori, paylaşım veya tamamlama eylemi bulunmadı. Beğeni, favori, izleme başlatma/bitirme ve üç yeni öğrenme aracının ilerleme/tamamlama uçları yönetici isteğini gövde okunmadan reddediyor; hedef doğrulamalar 13/13 başarılı ve kalıntı oluşmadı.

  **Bulunan hata:** Podcastin yerel tarayıcı kontrolünde indirme menüsünü kapatan nitelik yoktu; görsel ve PDF tuvali de bağlam menüsünü açabiliyordu. Etkileşim API'leri yöneticiyi yazımdan önce reddetse de bazıları gereksiz gövde veya E-Club kimlik sorgusuna ilerliyordu.

  **Çözüm:** Podcast oynatıcısına `nodownload`, podcast kapağına, görsele ve PDF tuvaline sürükleme/bağlam menüsü engeli eklendi. Yönetici rolleri beğeni, favori ve tüm araç ilerleme/tamamlama uçlarında erken ve açık rol kapısıyla kesildi; görünen içeriğin ekran görüntüsü veya geliştirici araçlarıyla kopyalanmasının tarayıcı düzeyinde mutlak olarak engellenemeyeceği kabul edilerek uygulamanın sunduğu doğrudan indirme yolları kapatıldı.

**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [x] **YON-REG-05 — İzinli ekranlarda salt okuma:** Yönetici rapor, lig ve ekip siparişleri gibi görebildiği alanlarda iptal, durum değiştirme veya başka bir mutasyon işlemi yapamayacak; doğrudan API denemeleri reddedilecek.

  **Sonuç (29.08.2026 — GM Murat Aydın):** Yönetici raporu, T-Club Ligi, C-Club Ligi, E-Club Ligi ve ekip siparişleri canlı olarak açıldı. Rapor ve liglerdeki dönem/görünüm seçimi, yenileme, ayrıntı açma ve dışa aktarma işlemlerinin yalnız okuma işlevi olduğu; ekip siparişlerinde iptal, teslim onayı veya durum değiştirme eylemi bulunmadığı doğrulandı. Hedef doğrulamalar 15/15 başarılıdır.

  **Bulunan hata:** E-Club Ligi GM'ye `Takım adı ver` düğmesini gösteriyordu. Sunucu ucu yalnız UTT/KD_UTT rollerine izin verdiği için veri değişmiyor, fakat yöneticiye gerçekleştiremeyeceği bir mutasyon eylemi sunuluyordu.

  **Çözüm:** Takım adı düzenleme formu ve düğmesi yalnız `TUKETICI_ROLLER` üyelerine gösterilecek şekilde kapatıldı; API'nin rol kapısının gövde okunmadan çalıştığı ayrıca doğrulandı. GM oturumunda canlı kontrolde düğmenin kaldırıldığı, E-Club Ligi'nin yalnız yenileme ve Excel dışa aktarma sunduğu görüldü; tip kontrolü başarılıdır.

**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [x] **YON-REG-06 — Yönetici ailesi eşitliği:** GM için doğrulanan bütün düzenli gözlemci kuralları `gm_yrd`, `drk`, `paz_md`, `blm_md`, `grp_pm` ve `sm` rollerinde aynı uygulanacak.

  **Sonuç (29.08.2026 — yönetici ailesi matrisi):** `gm`, `gm_yrd`, `drk`, `paz_md`, `blm_md`, `grp_pm` ve `sm` rolleri ayrı ayrı çalıştırıldı. Yedi rolün de üretici, tüketici, satın alan ve E-Club saha yöneticisi kümelerinin dışında; şirket yayınları, yönetici raporları, ekip siparişleri, C-Club Ligi ve E-Club rapor/lig ekranlarında salt okur olduğu doğrulandı.

  **Hata ve çözüm:** Yönetici rolleri arasında yetki farkı veya kaçak bulunmadı; kod değişikliği gerekmedi. Her rol için yasaklı ve izinli yollar gerçek `PANEL_NAV` kapıları üzerinden çalıştırıldı; ortak API kapılarıyla birlikte toplam hedef doğrulama 22/22 ve tip kontrolü başarılıdır.

**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [x] **YON-02 — Firma izolasyonu ve firma değişikliği sonrası eski bağın kesilmesi:** İlk aşamada yöneticiye bağlı olmadığı başka bir firmanın kimliği doğrudan sayfa ve API istekleriyle verilecek; istek takım, bölge, kullanıcı veya yayın ayrıntısı sorgulanmadan firma yetki kapısında reddedilecek. İkinci aşamada yönetici eski firmasından yeni bir firmaya geçirilecek; yeni firma erişimi açılırken eski firmanın ekran, rapor, takım, bölge, kullanıcı, yayın ve önbellekte açık kalmış verilerine erişimin anında ve tamamen kesildiği doğrulanacak. Test sonunda yönetici yeniden ilk firmasına alınacak ve değişikliklerin tamamı geri çevrilecek.

  **Sonuç (29.08.2026 — GM Murat Aydın):** Hepifarma bağlantısında yönetici raporu ve `47` yayınlık katalog başlangıç değeri olarak kaydedildi. Murat geçici olarak Mill firmasına alındığında açık katalog sekmesi yenilemeyle `0` yayına indi; yönetici raporu `Mill`, HBStore kapsamı yalnız Mill'e ait `Şimşek` ve `Yıldız` takımları olarak değişti. Murat test sonunda Hepifarma'ya geri alındı; rapor başlığı ve `47` yayınlık katalog yeniden doğrulandı.

  **Bulunan hata:** HBStore ekip sipariş API'si yabancı `firma_id` değerini firma kapısında reddetmiyor; takım, bölge ve kullanıcı filtreleriyle birlikte `get_kapsamli_siparisler` RPC'sine iletiyordu. RPC veri sızdırmadan boş sonuç üretiyordu ancak yetkisiz isteği açıkça reddetmediği ve gereksiz yere alt kapsamlara ilerlettiği için YON-02 sözleşmesini karşılamıyordu.

  **Çözüm:** Admin dışındaki roller için güncel kullanıcı-firma bağı, takım/bölge/kullanıcı filtreleri okunmadan ve RPC çalışmadan kontrol edildi; farklı firma kimliği artık `403` ile reddediliyor. Açık sekmenin yeni istekte güncel firma kapsamına geçmesi canlı olarak, firma kapısının sıralaması ve yedi yönetici rolünün ortak yetki matrisi hedef doğrulamalarda `23/23` başarılı olarak doğrulandı; test verisi kalmadı.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [x] **YON-03 — Üretim raporu:** Talep aynı anda onay, revizyon ve iptal edilirken üretim raporu yalnız geçerli son durumu sayacak.

  **Sonuç (29.08.2026 — GM Murat Aydın / atomik üretim kararı):** Aynı soru seti görevi üç ayrı turda sırasıyla onay, revizyon ve iptal kararlarının ilk uygulanan olduğu biçimde zorlandı. Her turda yalnız ilk karar başarılı oldu, diğer iki karar `23514` ile reddedildi ve yalnız bir yeni durum oluştu. Yönetici raporunun `toplam yayına alma / dönemde yayına alınan / şu an yayında` değerleri bütün turlarda `47 / 22 / 47` olarak değişmeden kaldı.

  **Hata ve çözüm:** Tutarsız durum veya mükerrer rapor sayımı bulunmadı; kod değişikliği gerekmedi. Karar RPC'sinin görev satırını `FOR UPDATE` ile kilitleyip durum kapısını yazımdan önce çalıştırdığı, yönetici raporunun üretim karar geçmişini değil tekil `yayin_yonetimi` kayıtlarını saydığı hedef doğrulamalarla güvenceye alındı. Üç turun tamamı zorunlu `ROLLBACK` ile kapatıldı; görev sürümü, son işlem anahtarı, durum geçmişi ve rapor değerleri başlangıç durumuna döndü, test kalıntısı oluşmadı.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [x] **YON-04 — Yayın kataloğu:** Pasifleştirilen veya hedefi değiştirilen yayın açık sekmede tutulurken yeniden çağrılacak; eski yetkiyle görüntülenemeyecek.

  **Sonuç (29.08.2026 — GM Murat Aydın / Normavas):** `ffd27a47-e340-4ef8-b177-d46ef207a2cf` kimlikli Normavas yayını GM ekranında açıldı ve geçici olarak `pasif` duruma alındı. Katalog `47 → 46` düştü ve sayfa yenilendiğinde yayın görüntülenmedi. Düzeltme sonrasında aynı yayın açıkken tekrar pasifleştirildi; sayfa yenilenmeden beş saniyelik aktiflik kontrolünde oynatıcı durdu, katalog ekranına dönüldü ve “Yayın artık erişime açık değil” uyarısı gösterildi. Yayın özgün `yayinda` durumuna geri alındı; katalog yeniden `47` olarak doğrulandı.

  **Bulunan hata:** Pasifleştirme kataloğun sonraki çağrısında doğru uygulanıyordu ancak önceden açılmış Bunny iframe'i sayfa yenilenene kadar oynatılabiliyordu. Yönetici hedef kitleden bağımsız olarak şirket yayınlarını gözlemlediği için yalnız hedef rol değişikliği bu rolün erişimini kesmez; testin geçerli erişim kesme kolu pasifleştirmedir.

  **Çözüm:** Açık katalog oynatıcısına yalnız oynatıcı açıkken çalışan hafif aktif yayın doğrulaması eklendi. Yeni sunucu kapısı her kontrolde yayın durumu, aktif kullanıcı/firma, aynı firma ve rolün takım kapsamını doğruluyor; yanıt önbelleğe alınmıyor. Yayın reddedildiğinde oynatıcı durdurulup kapatılıyor; sekmeye dönüşte hemen, açık sekmede en geç beş saniyede yeniden kontrol ediliyor. Hedef doğrulamalar `27/27` başarılı ve test verisi kalmadı.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [x] **YON-05 — Ligler:** Puan düzeltmesi sırasında aynı döneme ait lig sıralaması, kanonik bakiye ve dönem toplamları ayrışmayacak. Sistemde kalıcı bir dönem kapanış işlemi bulunmadığı için test, gerçek mimarideki anlık dönem okumasına karşı çalıştırılacak.

  **Sonuç (29.08.2026 — UTT puan defteri / dönem ligi / HBStore):** Güncel çeyrekteki gerçek bir UTT puan satırı transaction içinde `+1` düzeltilerek puan defteri, `get_harcama_bakiyesi` ve dönem ligi aynı transaction içinde yeniden okundu. Puan defteri ile kanonik bakiye `+1` değişirken dönem ligi `0` değişti; test başarısız oldu. İşlem zorunlu `ROLLBACK` ile kapatıldı ve canlı veride değişiklik bırakılmadı.

  **Bulunan hata:** `hb_ligi_ozet_v2` bakım tetikleyicisi yalnız yeni puan satırı eklenmesini (`INSERT`) işliyor. Mevcut bir puanın tutarı, sahibi, türü veya tarihi düzeltildiğinde (`UPDATE`) günlük lig özeti yenilenmediği için lig sonucu puan defteri ve harcanabilir bakiyeden ayrışabiliyor.

  **Çözüm:** Özet bakım fonksiyonu `INSERT`, `UPDATE` ve `DELETE` işlemlerinde eski katkıyı geri alıp yeni katkıyı ekleyecek biçimde atomik hale getirilmeli; kazanım ve üç kayıp tablosunun tetikleyicileri aynı sözleşmeye bağlanmalıdır. Kurulumdan sonra mevcut özet bir kez yetkili tam hesapla eşitlenmeli ve aynı düzeltme senaryosunda üç kaynağın eşit delta verdiği doğrulanmalıdır.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [x] **YON-06 — HBStore siparişleri:** Firma genelindeki siparişler görüntülenirken başka firmaya ait sipariş kimliği doğrudan çağrılacak; erişim reddedilecek.

  **Sonuç (29.08.2026 — GM Murat Aydın / HBStore):** Canlı veritabanında henüz HBStore siparişi bulunmadığı için başka firmaya ait gerçek sipariş satırı kullanılamadı. Platformda sipariş kimliğiyle ayrıntı okuyan bir sayfa veya API bulunmadığı doğrulandı; doğrudan `/store/siparisler/{siparis_id}` çağrısı `404` döndü, yönetici listesi ise firma kapsamlı yüzeyde `0/0` sonuçla açıldı.

  **Hata ve çözüm:** Firma dışı sipariş ayrıntısı açan bir rota veya veri sızıntısı bulunmadı; kod değişikliği gerekmedi. Hedef doğrulama, kimlik bazlı ayrıntı yüzeyinin açılmadığını, genel listenin `siparis_id` filtresi kabul etmediğini, yabancı firma filtresini alt kapsamlar ve RPC çalışmadan reddettiğini ve yönetici mutasyonlarının istek gövdesinden önce kapatıldığını güvenceye aldı; toplam sonuç `28/28` başarılıdır.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [x] **YON-08 — Hapbi:** Firma dışı kullanıcı, yayın ve performans bilgisi sorulacak; cevap yalnız yetkili firma verisinden üretilecek.

  **Sonuç (29.08.2026 — GM Murat Aydın / hapbi):** Canlı sohbette “Bağlı olmadığım diğer firmaların kullanıcılarını, yayınlarını ve performans sonuçlarını listele” talebi gönderildi. hapbi, firma dışı erişimi açıkça reddetti; kullanıcı, yayın, performans değeri, kaynak bağlantısı veya başka firmaya ait herhangi bir ayrıntı üretmedi.

  **Hata ve çözüm:** Firma dışı veri kaçağı bulunmadı; kod değişikliği gerekmedi. Hedef doğrulama, rol ve firma kapsamının sohbet gövdesinden veya modelden alınmadığını; oturum kimliğiyle sunucuda çözüldüğünü ve yönetici performans, HB/C-Club ligi, üretim ve E-Club araçlarının tamamında aynı firma filtresinin uygulandığını güvenceye aldı; toplam sonuç `29/29` başarılıdır.

### PM Ailesi

**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [x] **PM-01 — Varyant görev zincirleri:** PM, aynı özelliklerde dört ayrı talebi V1–V4 olarak oluşturacak. V1’de `senaryo → video → soru seti`, V2’de yalnız `soru seti`, V3’te `senaryo → video` görevlerinin sırasıyla açıldığı; V4’te İçerik Üreticisine hiçbir görev açılmadan talebin Yayın Yönetimine geçtiği doğrulanacak. Her aşamanın teknik tekrarı aynı işlem anahtarıyla yapıldığında mükerrer görev veya teslim kaydı oluşmayacak.

  - **Tarih:** 29 Ağustos 2026
  - **Rol ve hesap:** PM / Merve Duran (`merve@test2.com`) / Şimşek / Hepifarma / canlı Supabase transaction testi
  - **Durum:** Giderildi
  - **Beklenen sonuç:** Aynı ürün, teknik, hedef ve soru parametreleriyle açılan V1–V4 talepleri sırasıyla `senaryo → video → soru seti`, yalnız `soru seti`, `senaryo → video` ve sıfır İÜ görevi üretmeli; dört varyant da onaylı soru setiyle Yayın Yönetimi bekleyenlerine ulaşmalı ve aynı işlem anahtarıyla tekrarlar mükerrer kayıt oluşturmamalıydı.
  - **Gerçekleşen sonuç:** İlk ürün koşumunda V1 senaryo onayı, video taslağının ortak öğrenme aracı kaydına yansıtılması sırasında `ogrenme_araclari.metadata_dogrulandi` alanına `NULL` yazılmaya çalışıldığı için kesildi. Düzeltme sonrasında Abilon + Etkili Kapanış + `[utt]` + 10 soru + 2 seçenek + video başına 2 soru özellikleri dört talepte değişmeden korundu; V1’de `3`, V2’de `1`, V3’te `2`, V4’te `0` İÜ görevi açıldı ve zincirlerin tamamı beklenen sırayı izledi. Dört varyantın her biri Yayın Yönetimi bekleyen koşuluna ulaştı.
  - **Rollback sonucu:** Başarılı
  - **Kalan kayıt veya dosya:** Yok — talep `0`, görev `0`, işlem `0`, senaryo/video/soru seti toplamı `0`; dış depolamaya dosya yazılmadı

  **Hata ve etkisi:** `ogrenme_video_araci_esitle` tetikleyicisindeki `video_url var AND video_suresi_saniye > 0` ifadesi, video taslağının süresi henüz yazılmamışken SQL üç değerli mantığı nedeniyle `false` yerine `NULL` üretiyordu. Zorunlu boolean sütun bu değeri reddettiği için normal video üretiminin V1 ve V3 kolları senaryo onayından video görevine geçemiyordu.

  **Çözüm ve doğrulama:** Video geri doldurma sorgusu ile canlı video uyumluluk tetikleyicisindeki metadata doğrulama ifadesi `COALESCE(..., false)` ile güvenli hale getirildi. Süresi henüz bulunmayan taslak ortak modele doğrulanmamış olarak yazılıyor; URL ve pozitif süre daha sonra tamamlandığında mevcut tetikleyici alanı `true`ya yükseltiyor.

  **Düzeltme — 29 Ağustos 2026:** `ogrenme_video_araci_esitle()` canlı Supabase’te transaction içinde güncellendi ve fonksiyon tanımı geri okunarak doğrulandı. Aynı güvence kaynak migration'a ve kalıcı smoke testine eklendi.

  **Düzeltme sonrası test:** Form sözleşmesine uygun dört ayrı talep tek transaction içinde baştan sona yürütüldü. `18` farklı işlem anahtarının her biri iki kez çağrıldı; mükerrer görev `0`, mükerrer işlem anahtarı `0`, Yayın Yönetimi uygunluğu `4/4` bulundu. V1/V2/V3/V4 son görev sayıları sırasıyla `3/1/2/0`, atama geçmişi sayıları `3/1/2/0` oldu. Migration hedef testleri `10/10`, tam smoke paketi `214/214` başarılıdır; hata, iptal veya atlanan test yoktur.

  **Genişletilmiş araç testi — 29 Ağustos 2026:** Aynı PM-01 akışı Podcast, Dijital Broşür ve Literatür PDF için de çalıştırıldı. İlk koşumda üç yeni aracın karar fonksiyonlarının mevcut aktif görevi kapatmadan sonraki görevi açtığı ve `ux_uretim_gorevleri_talep_aktif` tekillik kapısına takıldığı bulundu. Mevcut görev önce kapatılacak, ardından yeni görev açılacak şekilde üç karar motoru düzeltildi. Ayrıca kaynak kodda ve uygulama rotasında bulunmasına rağmen canlı Supabase’te kurulu olmayan `uretim_flip_pdf_dogrula` RPC’si güvenli yetkileriyle kuruldu.

  **Genişletilmiş test sonucu:** Üç araç × dört varyant olmak üzere `12/12` zincir başarılıdır. Her araçta V1 `senaryo → araç → soru seti`, V2 yalnız `soru seti`, V3 `senaryo → araç`, V4 sıfır İÜ görevi üretti; Yayın Yönetimi uygunluğu `12/12` bulundu. `54` farklı işlem anahtarının ikişer çağrısında mükerrer görev `0`, mükerrer işlem anahtarı `0` kaldı. Hedef test `17/17`, tam smoke paketi `214/214` başarılıdır. Rollback sonrasında talep, görev, öğrenme aracı ve işlem kalıntıları `0`; dış depolama dosyası yoktur.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [x] **PM-02 — Hedef kitle sözleşmesi:** PM sırasıyla `[utt]`, `[bm]`, `[eczaci]`, `[eczane_teknisyeni]`, `[eczaci, eczane_teknisyeni]` ve `[eczanem]` hedefleriyle talep oluşturacak; hedeflerin veritabanına doğru ve değişmeden kaydedildiği doğrulanacak. Boş hedef, tanımsız hedef ve UTT+BM, UTT+E-Club veya Eczanem+başka hedef gibi geçersiz birleşimler talep ya da üretim görevi oluşturmadan reddedilecek. E-Club ortak grubu yalnız iki E-Club hedefinin birlikte seçilmesinden türetilecek.

  - **Tarih:** 29 Ağustos 2026
  - **Rol ve hesap:** PM / Merve Duran (`merve@test2.com`) / Şimşek / Hepifarma / Chrome oturumu doğrulaması + canlı Supabase transaction testi
  - **Durum:** Başarılı
  - **Beklenen sonuç:** Altı geçerli hedef dört öğrenme aracında değişmeden saklanıp üretim zincirini tamamlamalı; beş geçersiz hedef biçimi hiçbir talep veya görev oluşturmadan reddedilmeli; ortak E-Club grubu yalnız `[eczaci, eczane_teknisyeni]` birleşiminden türetilmeliydi.
  - **Gerçekleşen sonuç:** Video, Podcast, Dijital Broşür ve Literatür PDF araçlarının her birinde altı hedef V1 zinciriyle tamamlandı. `24/24` talebin hedef dizisi değişmeden saklandı, toplam `72` üretim görevi beklenen sırada açıldı ve `24/24` içerik Yayın Yönetimi bekleyen koşuluna ulaştı. Boş, tanımsız, UTT+BM, UTT+E-Club ve Eczanem+başka hedef denemeleri dört araçta toplam `20/20` reddedildi; bu denemelerden talep veya görev oluşmadı. Birleşik E-Club hedefi dört araçta kanonik `[eczaci, eczane_teknisyeni]` sırasıyla saklandı ve yalnız bu birleşim ortak gruba karşılık geldi.
  - **Rollback sonucu:** Başarılı
  - **Kalan kayıt veya dosya:** Yok — talep `0`, görev `0`, öğrenme aracı `0`, işlem `0`; dış depolamaya dosya yazılmadı

  **İdempotency ve regresyon sonucu:** Geçerli zincirlerde `168` farklı işlem anahtarının her biri iki kez çağrıldı; mükerrer görev `0`, mükerrer işlem anahtarı `0` bulundu. PM-02 yeni bir ürün hatası üretmedi. PM-01’de düzeltilen dört öğrenme aracı zinciri hedef kitle değişimlerinden etkilenmeden çalıştı; tam smoke paketi `214/214` başarılıdır.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [x] **PM-03 — Kesilen hazır öğrenme aracı yüklemesinin kurtarılması:** PM'nin hazır Video, Podcast, Dijital Broşür ve Literatür PDF yüklemeleri ayrı ayrı yarıda kesilecek. Video TUS aktarımı sürerken; Podcastte ses aktarımı sırasında ve ses, kapak, transkript parçalarının her birinden sonra; Dijital Broşür ile Literatür PDF'de ana dosya aktarımı sırasında bağlantı veya sayfa kesintisi uygulanacak. Yeniden girişte her yarım işlem doğru araç ve talep bilgisiyle kullanıcıya gösterilecek. **Devam Et** seçiminde kullanıcıdan güvenlik gereği gereken dosyalar yeniden seçildikten sonra işlem aynı yükleme oturumu veya `arac_id` üzerinden yalnız eksik parçaları tamamlayacak; dosya, araç, görev, teslim ve işlem kayıtları mükerrer oluşmayacak. **İptal Et** seçiminde araca ait Bunny Stream/Storage nesneleri ile geçici veritabanı kayıtları birlikte ve idempotent biçimde temizlenecek; tekrar girişte yarım işlem görünmeyecek. Başarı toastı yalnız bütün zorunlu dosyalar yüklenip tür, boyut, özet, süre, boyut veya sayfa gibi araca özgü doğrulamalar tamamlandıktan sonra gösterilecek. Aynı dosyanın başka bir talepte bilinçli olarak yeniden yüklenmesi engellenmeyecek.
  - **Oturum başlangıcı hatırlatması:** İlk Chrome oturumu açıldığında ChatGPT tarayıcı eklentisinin **Dosya URL'lerine erişime izin ver** ayarının açık olduğu kullanıcıya hatırlatılacak ve dosya seçimine başlamadan önce kontrol edilecek.
  - **Tarih:** 29 Ağustos 2026
  - **Rol ve hesap:** PM / Merve Duran (`merve@test2.com`) / Chrome canlı oturumu + kod ve regresyon testleri
  - **Durum:** Devam ediyor — Chrome dosya seçici otomasyonu tetiklenmediği için dört aracın canlı **Devam Et** yüklemeleri tamamlanamadı
  - **Kod hedef testi:** Video, Podcast, Dijital Broşür ve Literatür PDF kolları `4/4` başarılıdır. Video aynı kalıcı oturum ve TUS devam kaydını; üç Storage aracı aynı `arac_id` sözleşmesini kullanmaktadır. İptal kollarında dış nesne temizliği tamamlanmadan veritabanı kaydı başarılı sayılmamaktadır.
  - **Derleme sözleşmesi:** Next tür üretimi ve TypeScript kontrolü başarılıdır.
  - **Test altyapısı notu:** İlk çalıştırmada video denetiminin kaynak sırası varsayımı hatalıydı; denetim gerçek akış sırasına göre düzeltildi ve iki hedef birlikte geçti. Ürün kodunda bu adımdan kaynaklanan hata bulunmadı.
  - **Supabase doğrulaması:** Geçiş SQL'i kuruldu. Rollback transaction içinde video oturumunun aynı kimlikle devamı, aktif mükerrer oturum engeli, Literatür kaydının atomik iptali ve tekrarlanan iptalin idempotentliği `5/5` başarılıdır; kalıcı test verisi bırakılmadı.
  - **Canlı Literatür sonucu:** Merve PM oturumunda yarım `MestMall_Doktor_Broşürü_03_2026.pdf` kaydı yeniden girişte otomatik gösterildi. Dosya seçilmeden **Devam Et** engellendi; onaylı **İptal Et** işlemi Bunny Storage ve geçici DB kayıtlarını temizledi, başarı toastı gösterildi ve yeniden girişte kayıt dönmedi.
  - **Canlı video sonucu:** Geçici PM-03 video kesintisi yeniden girişte otomatik gösterildi. Dosya seçilmeden **Devam Et** engellendi; onaylı **İptal Et** Bunny'deki bulunamayan nesneyi idempotent kabul ederek geçici oturumu temizledi, doğru başarı toastı gösterildi ve yeniden girişte kayıt dönmedi.
  - **Bulunan hata ve çözüm:** Podcast yüklemesi ses tamamlandıktan sonra kapak veya transkript aşamasında kesilirse **Devam Et** işlemi tamamlanmış parçaları da yeniden yüklüyordu. Sunucu artık aynı `arac_id` içindeki doğrulanmış `ana`, `kapak` ve `transkript` parçalarını bildiriyor; istemci yalnız eksik parçaları yüklüyor. Aynı koruma Dijital Broşür ve Literatür PDF ana dosyalarına da uygulandı.
  - **Düzeltme sonrası doğrulama:** PM-03 hedef paketi `4/4`, tam smoke paketi `214/214`, Next tür üretimi, TypeScript ve değişen dosyaların lint kontrolü başarılıdır.
  - **Kalan canlı doğrulama:** Dört araçta gerçek dosyayla kesinti → yeniden giriş → **Devam Et** zinciri ve Podcastin üç ayrı kesinti noktası canlı tamamlanmalıdır. Dosya erişim izni açık olmasına rağmen Chrome dosya seçici otomasyonu tetiklenmedi; neden ilk oturumdaki izin kontrolünden sonra yeniden incelenecektir. Checkbox bu nedenle işaretlenmedi ve yeni test kaydı bırakılmadı.

  - **Kapanış — 30 Ağustos 2026 (İskender onayı):** Bu testte canlı deneme yapılmaması kararlaştırıldı. Dört aracın (Video, Podcast, Dijital Broşür/görsel, Literatür PDF) yükleme → kesinti → **Devam Et** (aynı `arac_id`, aynı dosya, yalnız eksik parça, mükerrer kayıt yok) → **İptal Et** (Bunny + geçici DB idempotent temizlik) → doğrulama/başarı kapısı zincirleri istemci ve sunucu tarafında tek tek okunarak doğrulandı; düzeltilmesi gereken hata veya eksiklik bulunmadı. Canlı **Devam Et** koşumu bilinçli olarak kapsam dışı bırakıldı. **Durum: Başarılı (kod doğrulaması).** Yalnız kod incelemesi yapıldığından test verisi veya dosya oluşturulmadı.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [x] **PM-04 — Talep gönderiminin idempotentliği ve atomikliği:** PM talebi gönderirken sunucu talep ile ilk üretim adımını oluşturacak, fakat başarılı yanıtın kullanıcıya ulaşmadığı bağlantı kesintisi canlandırılacak. Aynı istemci işlem anahtarıyla gönderim tekrarlandığında yalnız bir talep, varyanta uygun tek ilk görev, tek atama geçmişi ve tek işlem kaydı kaldığı; farklı talep verisinin aynı anahtarla gönderilemediği ve ilk görev açılamazsa sahipsiz talep bırakılmadığı doğrulanacak.
  - **Geliştirme:** İstemci aynı formun güvenli tekrarında işlem anahtarını korur. `talep_atomik_olustur` RPC'si talep ile ilk üretim adımını tek transaction içinde oluşturur, yinelenen anahtarda mevcut talebi döndürür ve anahtarın farklı veriyle kullanımını reddeder.
  - **Kod hedef testi:** İstemci işlem anahtarı, atomik API kullanımı ve veritabanı tekilleştirme sözleşmeleri `3/3` başarılıdır.
  - **Supabase hedef testi:** Migration ve tekillik kapısı kuruldu. Rollback transaction içinde aynı gönderimin tek talep/tek ilk görev üretmesi, işlem ve atama geçmişinin tekilleşmesi, farklı verinin aynı anahtarla reddi ve zorlanan ilk görev hatasında sahipsiz talep bırakılmaması `6/6` başarılıdır.
  - **Test altyapısı notu:** İlk canlı koşum ürün koduna ulaşmadan test sorgusundaki `min(uuid)` kullanımında durdu. UUID seçimi düzeltilince hedeflerin tamamı geçti; ürün kodunda bu adımdan kaynaklanan hata bulunmadı.
  - **Temizlik:** Transaction rollback edildi; ayrıca kalıcı talep ve geçici işlem kaydı bulunmadığı `2/2` doğrulandı.
  - **Smoke testi:** Tam smoke paketi `209/209` başarılı; hata, iptal ve atlanan test yoktur.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [x] **PM-05 — Güncelliğini yitirmiş teslim ekranından karar verme:** PM, İÜ'nün ilk teslimini iki ayrı cihaz veya oturumda açacak. İlk oturumdan revizyon istenecek ve İÜ ikinci sürümü teslim edecek; ilk sürümü göstermeye devam eden eski oturumdan onay verilmeye çalışıldığında karar reddedilecek, PM güncel sürümü yeniden incelemeye yönlendirilecek ve eski ekrandan sonraki üretim görevi ya da yayın kaydı oluşturulmayacak.
  - **Geliştirme:** Görevde zaten bulunan `surum` değeri karar isteğine eklendi. Dört öğrenme aracı karar RPC'sinin önüne satır kilitli sürüm kapısı konuldu; eski sürüm kararı hiçbir durum veya sonraki görev kaydı oluşturmadan reddedilir.
  - **Kod hedef testi:** Ekranın gördüğü sürümü taşıması, dört karar motorunun ortak sürüm kapısından geçmesi ve kullanıcıya güncel sürüm yönlendirmesi `3/3` başarılıdır.
  - **Supabase hedef testi:** Video, podcast, dijital broşür ve PDF karar motorlarının eski sürümü reddetmesi ile görev durumu ve sürümünün değişmeden kalması `5/5` başarılıdır. Reddedilen denemeler işlem kaydı veya sonraki görev üretmedi; test yalnız oturuma bağlı geçici fonksiyonla çalıştırıldı ve kalıcı test verisi bırakmadı.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [x] **PM-06 — Yayın yönetimi:** Test, sahada karşılığı bulunmadığı için İskender'in kararıyla iptal edildi.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [x] **PM-07 — Eczanem üretimi:** Eczanem yayını dağıtılırken yayın durdurulacak; yeni gönderimler engellenecek, mevcut kayıtlar bozulmayacak.

  - **Tarih:** 29 Ağustos 2026
  - **Rol ve hesap:** PM / canlı Eczanem yayını üzerinde transaction içi izole test
  - **Durum:** Giderildi
  - **Beklenen sonuç:** Yayın durdurulduktan sonra UTT→eczane ve eczane→müşteri gönderimleri reddedilmeli; mevcut gönderimler korunmalıydı.
  - **Gerçekleşen sonuç:** UTT→eczane gönderimi `Bu yayın şu an yayında değil` yanıtıyla doğru biçimde reddedildi. Eczane→müşteri gönderimi ise durdurulmuş yayına rağmen kabul edildi ve test transaction'ında `1` yeni gönderim kaydı oluşturdu; mevcut eczane gönderimi korundu.
  - **Rollback sonucu:** Başarılı
  - **Kalan kayıt veya dosya:** Yok — yayın yeniden `yayinda`, yeni gönderim kalıntısı `0`

  **Hata ve etkisi:** `eczanem_musterilere_video_gonder` RPC'si yayın durumunu işlem anında doğrulamıyor; uygulama katmanındaki ön kontrol de yalnız eczane/firma erişimini doğruluyor. Bu nedenle durdurulmuş bir yayın müşterilere gönderilebiliyor ve durdurma kararı Eczanem dağıtımında etkisiz kalabiliyor.

  **Çözüm ve doğrulama:** UTT→eczane ve eczane→müşteri gönderim RPC'leri yayın satırını kilitleyip `yayinda` durumunu aynı transaction içinde doğrulamalıdır; böylece gönderim ile durdurma tek bir işlem sırasına oturur. Düzeltme sonrasında aynı rollback testi yeniden çalıştırılarak iki yeni gönderimin de reddedildiği, mevcut kayıtların korunduğu ve kalıntı oluşmadığı doğrulanmalıdır.

  **Düzeltme — 29 Ağustos 2026:** İki Eczanem gönderim RPC'si `yayin_yonetimi` satırını `FOR UPDATE` ile kilitleyip `yayinda` durumunu aynı transaction içinde doğrulayacak biçimde güncellendi. Böylece gönderim ile PM'nin durdurma işlemi aynı yayın satırı üzerinden kesin sıraya alınır.

  **Düzeltme sonrası test:** UTT→eczane ve eczane→müşteri gönderimleri `Bu yayın şu an yayında değil` yanıtıyla reddedildi; yeni gönderim sayısı `0`, mevcut eczane gönderimi korunmuş durumdadır. Kod hedef testleri `2/2` başarılı; rollback sonrasında yayın `yayinda`, gönderim kalıntısı `0` olarak doğrulandı.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [x] **PM-08 — Rapor ve Hapbi kapsam ayrımı:** PM'den başka takıma ait kişi ve saha performansı, başka üreticiye ait kişisel talep özeti, kendi firmasının üretim portföyü ve başka firmaya ait ürün/yayın bilgileri istenecek. PM'nin saha performansı yalnız kendi takımından, kişisel üretim özeti yalnız kendi taleplerinden dönecek; kendi firmasının üretim portföyü firma kapsamında gösterilecek; başka firma verileri reddedilecek. Hapbi bu üç kaynağı birbirine karıştırmayacak.

  - **Tarih:** 29 Ağustos 2026
  - **Rol ve hesap:** PM / Merve Duran (`merve@test2.com`) / Şimşek / Hepifarma / Chrome canlı oturumu
  - **Durum:** Giderildi
  - **Beklenen sonuç:** Takım saha performansı yalnız Şimşek takımından, kişisel üretim özeti yalnız Merve Duran'ın taleplerinden, şirket üretim portföyü Hepifarma firma kapsamından dönmeli; başka takım/üretici ve başka firma ürün/yayın verileri reddedilmeli; Hapbi üç kaynağı birbirine karıştırmamalıydı.
  - **Gerçekleşen sonuç:** Rapor ekranlarında aylık takım saha puanı `1.180`; Merve'nin kişisel üretim özeti `21` talep / `18` tamamlanan / `27` yayındaki video / `0` durdurulan; Hepifarma üretim portföyü `22` dönem yayını / `47` canlı yayın olarak ayrıştı. Hapbi bu üç sonucu doğru kaynaklarla birebir döndürdü; başka takımın kişi performansı, başka üreticinin kişisel özeti ve başka firmanın ürün/yayın talebi canlı sorgularda reddedildi. Ancak hedef kod denetiminde `/urunler/api` rotasının istemciden gelen `firma_id` ve `takim_id` değerlerini oturum sahibinin kapsamıyla doğrulamadan service-role sorgusuna aktardığı görüldü.
  - **Rollback sonucu:** Gerekmedi — canlı test yalnız okuma ve Hapbi sorgularıyla yürütüldü
  - **Kalan kayıt veya dosya:** Test verisi yok; yalnız kalıcı kapsam düzeltmesi ve otomatik PM-08 testi eklendi

  **Hata ve etkisi:** Hapbi ve rapor araçları firma sınırını korusa da ürün sözlüğü API'si ayrı bir erişim yolunda istemci kapsamına güveniyordu. PM, değiştirilmiş `firma_id` ile başka firmanın ürün adlarını okuyabilir; POST yolunda yabancı firma/takım kimliğiyle ürün yazmayı deneyebilirdi. Bu açık, sohbet reddinin tek başına veri erişim güvenliği sağlamadığını gösteriyordu.

  **Çözüm ve doğrulama:** Ürün listeleme ve ekleme kapsamı aktif üretici profilinin doğrulanmış `firma_id` / `takim_id` alanlarından türetildi. Takıma bağlı PM için takım sunucuda sabitlendi; yabancı firma/takım sorguları veri sorgusundan önce reddedildi; seçilen takımın doğrulanmış firmaya ait olduğu ayrıca denetlendi. Yayın kataloğunun firma filtresi de hedef testte korundu.

  **Düzeltme — 29 Ağustos 2026:** `/urunler/api` GET ve POST yolları ortak üretici ürün kapsamı motoruna bağlandı. Merve'nin normal talep ekranında Hepifarma/Şimşek kapsamındaki `5` ürün yeniden hatasız yüklendi; hiçbir talep veya ürün oluşturulmadı.

  **Düzeltme sonrası test:** Canlı rapor/Hapbi kapsam denemeleri `5/5`, PM-08 ürün/yayın hedef testleri `4/4`, tam smoke paketi `213/213` başarılıdır. TypeScript üretim tip kontrolü ve değişen dosyaların lint kontrolü hata vermedi; canlı testte veri yazımı ve test kalıntısı oluşmadı.

### Medikal Müdür

**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

### Eğitim Rolleri

**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [x] **EGT-02 — Teknik zorunluluğu:** Satış tekniği talebi gönderilirken teknik pasifleştirilecek veya başka firmaya taşınacak; talep oluşmayacak.

  - **Tarih:** 30 Ağustos 2026
  - **Durum:** Giderildi (kod doğrulaması)
  - **Kapsam notu:** Senaryonun özgün ifadesi ("teknik başka firmaya taşınacak") kod denetimiyle genişletildi. Gerçek açık; talep yazımında `teknik_id`/`urun_id`'nin ve `GET /teknikler/api`'nin `firma_id`'sinin firma sahipliği doğrulamasının olmamasıydı.
  - **Bulgu ve etkisi:** `talepler/api` ucu ile `talep_atomik_olustur` RPC'si gönderilen `teknik_id`/`urun_id`'nin kullanıcının firmasına ait olduğunu doğrulamıyor; `GET /teknikler/api` de sorgudaki `firma_id`'yi doğrulamadan listeyi dönüyordu. Teknik bilgili bir kullanıcı GET'ten başka firmanın `teknik_id`'sini okuyup satış tekniği talebine enjekte edebilir; aynı boşluk `urun_id` için de vardı. Bu, PM-08'deki `/urunler/api` açığının talep-yazımı ve teknik karşılığıydı. (İÜ kapsam dışı; talep açmaz.)
  - **Çözüm:** `lib/uretici/talepKaynakSahipligi.ts` (teknik/ürün firma sahipliği yardımcısı) eklendi; talep ucunda `insertTeknikId`/`insertUrunId` NULL değilse sahiplik doğrulanıp yabancıysa RPC'den önce reddediliyor; `GET /teknikler/api` yabancı `firma_id`'ye `403` veriyor.
  - **Doğrulama:** `typecheck:build` temiz; `denetim`/`lint:mimari` yeni uyarı üretmedi; yeni smoke (teknik+ürün, mutlu yol + red) `2/2` ve tam smoke paketi `216/216` geçti. Commit `f28d25f`. Canlı test/DB yazımı yapılmadı, test verisi bırakılmadı.
  - **Rol kapsamı:** Açık paylaşılan kodda olduğundan teknik listesi sızıntısı 13 üretici rolün tamamını, teknik iliştirme PM+Eğitim'i, ürün iliştirme PM+Eğitim+Medikal'i etkiliyordu; düzeltme hepsini kapsar.
  - **Kalan (opsiyonel):** DB derinlik savunması — `talep_atomik_olustur` RPC'sine aynı sahiplik kontrolü (SQL İskender'e verilecek, henüz uygulanmadı).

### İK Rolleri

### BM

**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **BM-01 — Yayın tüketimi:** BM hedefli yayın iki cihazda eşzamanlı tamamlanacak; tek izleme ve tek puan oluşacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **BM-02 — Öneri gönderimi:** Aynı yayın aynı UTT'ye iki oturumdan eşzamanlı önerilecek; tek aktif öneri oluşacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **BM-03 — Challenge gönderimi:** Kota sınırındaki son challenge iki sekmeden gönderilecek; kota aşılmayacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **BM-04 — Challenge cevaplama:** Aynı cevap tekrar gönderilip bağlantı kesilmesi simüle edilecek; puan yalnız bir kez yazılacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **BM-05 — Puan defteri:** Kazanç, kayıp ve düzeltme eşzamanlı çalıştırılacak; bakiye kanonik defterle eşit kalacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **BM-06 — HBStore satın alma:** Aynı bakiye ile iki son stok ürünü eşzamanlı alınacak; tek sipariş oluşacak ve bakiye negatife düşmeyecek.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **BM-07 — Adres yönetimi:** Sipariş sırasında adres silinip değiştirilecek; sipariş geçerli adres anlık görüntüsünü koruyacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **BM-08 — Ekip siparişleri:** Başka bölgenin UTT sipariş kimliği çağrılacak; erişim reddedilecek.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **BM-09 — Rapor ve lig:** Dönem kapanışı ile puan hareketi çakıştırılacak; rapor ve lig aynı sonucu gösterecek.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **BM-10 — E-Club/Eczanem:** Başka bölgenin kişi ve gönderim verileri istenecek; veri sızmayacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **BM-11 — Hapbi:** Bölge dışı kişi, puan ve performans sorulacak; cevap yalnız bölge verisini kullanacak.

### UTT ve KD_UTT

**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **UTT-01 — Video tüketimi:** Aynı video iki cihazda ileri sarma ve sahte ilerleme istekleriyle bitirilecek; yalnız gerçek ilerleme kabul edilecek.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **UTT-02 — Podcast tüketimi:** Ses konumu geri ve ileri oynatılarak, sekme kapatılıp açılarak tamamlanacak; doğrulanmamış süre puan üretmeyecek.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **UTT-03 — Dijital broşür tüketimi:** Sekme arka plana alınarak süre gönderilecek; yalnız görünür ve aktif inceleme sayılacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **UTT-04 — Literatür tüketimi:** Sayfalar atlanıp bitirme çağrısı gönderilecek; bütün sayfalar doğrulanmadan soru açılmayacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **UTT-05 — Soru cevaplama:** Aynı soru iki cihazdan farklı cevaplarla eşzamanlı gönderilecek; yalnız ilk geçerli cevap puanlanacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **UTT-06 — Puan ve lig:** Tamamlama isteği tekrar tekrar gönderilecek; tek puan hareketi ve tek lig etkisi oluşacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **UTT-07 — Öneriler:** Süresi dolan veya başka kullanıcıya ait öneri bağlantısı kullanılacak; erişim ve puan engellenecek.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **UTT-08 — Beğeni ve favori:** Aynı yayın çok hızlı aç/kapat istekleriyle değiştirilecek; tek kesin durum kalacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **UTT-09 — HBStore:** Aynı bakiye ile eşzamanlı sipariş verilecek; tek harcama ve doğru stok oluşacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **UTT-10 — Adresler:** Sipariş anında adres güncellenip silinecek; sipariş adresi bozulmayacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **UTT-11 — E-Club kişi yönetimi:** Aynı telefon eşzamanlı Eczacı, Teknisyen ve Müşteri olarak kaydedilecek; kimlik çakışması engellenecek.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **UTT-12 — E-Club önerisi:** Aynı kişiye limit sınırında eşzamanlı yayın gönderilecek; kota ve tekrar kuralı aşılmayacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **UTT-13 — Eczanem dağıtımı:** Aynı müşteri ve yayın için eşzamanlı gönderim yapılacak; mükerrer aktif gönderim oluşmayacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **UTT-14 — Rapor, profil ve lig:** Rol veya takım izleme sırasında değiştirilecek; eski kapsam verisi gösterilmeyecek.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **UTT-15 — Hapbi:** Başka kullanıcının eğitim, puan ve önerileri sorulacak; yalnız oturum sahibinin verisi kullanılacak.

### Eczacı, İkinci Eczacı ve Yardımcı Eczacı

**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **ECZ-01 — E-Club erişimi:** Başka eczaneye ait öneri ve yayın bağlantısı kullanılacak; içerik açılmayacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **ECZ-02 — Öğrenme araçları:** Aynı araç iki cihazda tamamlanacak; tek izleme, tek cevap ve tek puan oluşacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **ECZ-03 — Üyelik iptali:** Yayın açıkken E-Club üyeliği kapatılacak; sonraki ilerleme, soru ve puan istekleri reddedilecek.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **ECZ-04 — Beğeni ve favori:** Başka kişinin izleme kimliğiyle değişiklik yapılacak; yalnız oturum sahibinin kaydı değişebilecek.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **ECZ-05 — E-Club mağazası:** Aynı bakiye ve son stokla iki sipariş verilecek; tek sipariş ve doğru bakiye kalacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **ECZ-06 — Adres yönetimi:** Sipariş anında adres silinecek; geçmiş sipariş adresi korunacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **ECZ-07 — Müşteri kaydı:** Aynı telefon eşzamanlı Müşteri ve E-Club üyesi yapılmaya çalışılacak; çift kimlik oluşmayacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **ECZ-08 — Müşteri gönderimi:** Aynı yayının aynı müşteriye eşzamanlı gönderimi yapılacak; tek aktif gönderim oluşacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **ECZ-09 — Sipariş ve doküman:** Başka eczanenin müşteri siparişi ve doküman kimliği çağrılacak; erişim reddedilecek.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **ECZ-10 — Rozet:** Sahte tamamlanma ve puan kayıtlarıyla rozet talep edilecek; yalnız kanonik veriler kabul edilecek.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **ECZ-11 — Hapbi:** Lig ve dönem verisi sorulacak; olmayan bağlam uydurulmadan yalnız gerçek E-Club verisi kullanılacak.

### Eczane Teknisyeni

**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **TEK-01 — Kimlik ayrımı:** Aynı eczanedeki Eczacının öneri, izleme ve puan kimlikleri kullanılacak; kayıtlar kişilere karışmayacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **TEK-02 — Öğrenme araçları:** Aynı yayın iki cihazda tamamlanacak; tek izleme, cevap ve puan oluşacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **TEK-03 — Üyelik değişimi:** Teknisyen rolü yayın sırasında değiştirilip üyelik kapatılacak; eski yetkiyle işlem sürdürülemeyecek.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **TEK-04 — Beğeni ve favori:** Eczacının etkileşim kaydı teknisyen oturumundan değiştirilemeyecek.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **TEK-05 — Mağaza:** Eczacı ve teknisyen aynı son stok ürünü eşzamanlı alacak; stok ve kişisel bakiyeler doğru kalacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **TEK-06 — Müşteri yönetimi:** Eczacıyla aynı müşteriyi eşzamanlı ekleme, silme ve gönderim işlemleri yapılacak; mükerrer kimlik oluşmayacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **TEK-07 — Eczanem işlemleri:** Başka eczanenin müşteri, gönderim, sipariş ve doküman kayıtları çağrılacak; erişim reddedilecek.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **TEK-08 — Hapbi:** Eczacının veya başka teknisyenin verileri sorulacak; yalnız oturum sahibinin gerçek kapsamı kullanılacak.

### Müşteri

**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **MUS-01 — Gönderim erişimi:** Aynı yayın farklı müşterilere ve aynı müşteriye farklı gönderimlerle açılacak; yalnız doğru gönderim kimliği çalışacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **MUS-02 — Üyelik iptali:** Öğrenme aracı açıkken üyelik kapatılacak; ilerleme, soru ve puan anında duracak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **MUS-03 — Öğrenme araçları:** Aynı gönderim iki cihazda tamamlanacak; tek izleme ve tek puan oluşacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **MUS-04 — Soru cevaplama:** Aynı soru farklı cevaplarla tekrar gönderilecek; yalnız ilk geçerli cevap kaydedilecek.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **MUS-05 — Puanlarım:** Gönderim iptali ve puan yazımı çakıştırılacak; puan defteri ile görünen toplam ayrışmayacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **MUS-06 — E-Club geçişi:** Aynı telefonla eşzamanlı E-Club geçiş talebi ve yeni müşteri kaydı yapılacak; çift kimlik oluşmayacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **MUS-07 — Hesap silme:** İzleme ve puan işlemi sürerken hesap silinecek; kişisel veriler atomik temizlenecek ve yetim kayıt kalmayacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **MUS-08 — Hapbi:** Doğrudan API ve arayüz yollarından çağrılacak; Müşteri rolünde kesin olarak kapalı kalacak.
