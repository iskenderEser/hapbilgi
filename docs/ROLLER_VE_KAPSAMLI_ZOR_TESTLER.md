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

- [ ] **YON-01 — Yönetici raporu:** Yayın, puan, cevap ve sipariş yazılırken rapor alınacak; aynı rapor içinde farklı zamanlara ait tutarsız toplamlar oluşmayacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **YON-02 — Firma izolasyonu:** Başka firmanın takım, bölge, kullanıcı ve yayın kimlikleri API isteklerine yerleştirilecek; hiçbir ayrıntı sızmayacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **YON-03 — Üretim raporu:** Talep aynı anda onay, revizyon ve iptal edilirken üretim raporu yalnız geçerli son durumu sayacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **YON-04 — Yayın kataloğu:** Pasifleştirilen veya hedefi değiştirilen yayın açık sekmede tutulurken yeniden çağrılacak; eski yetkiyle görüntülenemeyecek.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **YON-05 — Ligler:** Puan düzeltmesi ve dönem kapanışı eşzamanlı çalıştırılacak; sıralama, bakiye ve dönem toplamları ayrışmayacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **YON-06 — HBStore siparişleri:** Firma genelindeki siparişler görüntülenirken başka firmaya ait sipariş kimliği doğrudan çağrılacak; erişim reddedilecek.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **YON-07 — E-Club/Eczanem raporları:** Aynı kişinin farklı eczane ve gönderim bağları varken raporlar doğru firma ve takım kapsamına ayrılacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **YON-08 — Hapbi:** Firma dışı kullanıcı, yayın ve performans bilgisi sorulacak; cevap yalnız yetkili firma verisinden üretilecek.

### PM Ailesi

**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **PM-01 — Talep varyantları:** V1-V4 talepleri aynı içerik ve tekrar gönderimlerle oluşturulacak; her varyant yalnız gereken görevleri üretecek.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **PM-02 — Hedef seçimi:** UTT, BM, Eczacı, Teknisyen, ortak E-Club ve Eczanem hedefleri değiştirilmiş API gövdeleriyle sınanacak; geçersiz birleşimler reddedilecek.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **PM-03 — Ürün ve teknik:** Ürün veya teknik talep gönderilirken pasifleştirilecek; bozuk ilişkiyle talep oluşmayacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **PM-04 — Dosya yükleme:** Bunny yüklemesi tamamlanıp veritabanı doğrulaması kesilecek; tekrar denemede mükerrer araç veya sahipsiz dosya oluşmayacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **PM-05 — Üretim başlatma:** Aynı talep iki sekmede eşzamanlı başlatılacak; yalnız tek görev zinciri oluşacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **PM-06 — Onay ve revizyon:** Aynı teslim eşzamanlı onaylanıp revizyona gönderilecek; yalnız tek geçerli karar kalacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **PM-07 — Yayın yönetimi:** Puan tanımlama, yayınlama, silme ve iptal işlemleri eşzamanlı yürütülecek; puansız, sorusuz veya yarım yayın oluşmayacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **PM-08 — Kataloglar:** Başka üreticinin talep ve dosya kimlikleri kullanılarak değiştirme ve silme denenecek; yalnız kendi üretimi değiştirilebilecek.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **PM-09 — Eczanem üretimi:** Eczanem yayını dağıtılırken yayın geri çekilecek; yeni gönderimler engellenecek, mevcut kayıtlar bozulmayacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **PM-10 — Rapor ve Hapbi:** Takım dışı ürün, yayın ve performans bilgisi istenecek; yalnız PM'in takım kapsamı dönecek.

### Medikal Müdür

**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **MED-01 — Talep türleri:** Medikal ve ürün medikal taleplere satış tekniği veya İK türü enjekte edilecek; yetkisiz türler reddedilecek.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **MED-02 — Ürün zorunluluğu:** Ürün medikal talebin ürünü üretim sırasında pasifleştirilecek; yayın güvenli biçimde engellenecek.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **MED-03 — Teknik yasağı:** Teknik kimliği doğrudan API gövdesine eklenerek medikal talep oluşturulacak; teknik ilişkisi kaydedilmeyecek.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **MED-04 — Üretim zinciri:** Aynı medikal teslim iki oturumdan onay ve revizyona sokulacak; tek sürüm ve tek karar kalacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **MED-05 — Firma kapsamı:** Başka firmanın ürün, talep, yayın ve rapor kimlikleri çağrılacak; erişim reddedilecek.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **MED-06 — Rapor ve Hapbi:** Firma verisi eşzamanlı değişirken medikal sonuçlar tutarlı kalacak ve başka firma verisi kullanılmayacak.

### Eğitim Rolleri

**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **EGT-01 — Talep türleri:** Satış teknikleri ve yönetim eğitimi dışındaki türler değiştirilmiş API gövdesiyle gönderilecek; reddedilecek.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **EGT-02 — Teknik zorunluluğu:** Satış tekniği talebi gönderilirken teknik pasifleştirilecek veya başka firmaya taşınacak; talep oluşmayacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **EGT-03 — İsteğe bağlı ürün:** Ürün seçili ve ürünsüz iki talep eşzamanlı oluşturulacak; ürün ilişkileri birbirine karışmayacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **EGT-04 — Üretim zinciri:** Podcast teslimi, revizyonu ve onayı iki sekmede çakıştırılacak; tek geçerli sürüm kalacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **EGT-05 — Yayın ve rapor:** Yayın hedefi ve durumu rapor alınırken değiştirilecek; firma toplamları tutarlı kalacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **EGT-06 — Hapbi:** Firma dışındaki eğitim, teknik ve performans verileri sorulacak; yalnız yetkili kapsam kullanılacak.

### İK Rolleri

**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **IK-01 — Talep türleri:** İK ve yönetim eğitimi dışındaki türler doğrudan API üzerinden gönderilecek; kayıt oluşmadan reddedilecek.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **IK-02 — Hedef kısıtı:** Eczacı ve Teknisyen hedefi arayüz atlanarak gönderilecek; talep, görev, dosya ve bildirim oluşmayacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **IK-03 — Ürün ve teknik yasağı:** Ürün ve teknik kimlikleri değiştirilmiş gövdeyle eklenecek; ilişkiler kaydedilmeyecek.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **IK-04 — Üretim zinciri:** İK yayını aynı anda onaylanıp iptal edilecek; tek kesin durum kalacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **IK-05 — Gizlilik kapsamı:** Başka üreticinin İK talebi ve referans dosyası doğrudan çağrılacak; erişim reddedilecek.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **IK-06 — Rapor ve Hapbi:** Kişisel veya firma dışı İK verisi istenecek; yetkisiz ayrıntı cevapta yer almayacak.

### İçerik Üreticisi

**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **IU-01 — Görev erişimi:** Başka İçerik Üreticisine atanmış görev kimliği doğrudan açılacak ve değiştirilmeye çalışılacak; erişim reddedilecek.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **IU-02 — Eşzamanlı görev:** Aynı görev iki sekmede kabul edilip teslim edilecek; yalnız tek aktif teslim oluşacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **IU-03 — Senaryo üretimi:** Aynı senaryonun iki sürümü eşzamanlı gönderilecek; sürümler karışmayacak ve onaysız sürüm ilerlemeyecek.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **IU-04 — Video üretimi:** Bunny yüklemesi kesilip tekrar başlatılacak; sahipsiz video ve mükerrer teslim oluşmayacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **IU-05 — Podcast üretimi:** Ses, kapak ve transkriptin farklı adımları kesilecek; üçü doğrulanmadan teslim tamamlanmayacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **IU-06 — Dijital broşür üretimi:** Bozuk MIME, değiştirilmiş uzantı ve tekrar yükleme kullanılacak; yalnız doğrulanmış dosya kabul edilecek.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **IU-07 — Literatür üretimi:** Şifreli, bozuk ve çok büyük PDF yüklenerek doğrulama zorlanacak; yayın adayı oluşmayacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **IU-08 — Soru seti üretimi:** Aynı soru seti iki sürümle teslim edilip biri revizyona gönderilecek; yalnız onaylı sürüm yayına bağlanacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **IU-09 — Görev geçişleri:** Senaryo, araç ve soru seti adımları sırası atlanarak çağrılacak; geçersiz durum geçişleri reddedilecek.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **IU-10 — Bildirimler:** Aynı teslim tekrarlandığında üreticiye mükerrer bildirim oluşmayacak.

### TM

**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **TM-01 — Takım raporu:** BM ve UTT puanları eşzamanlı değişirken rapor alınacak; tek tutarlı takım görünümü oluşacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **TM-02 — Hiyerarşi izolasyonu:** Başka takımın BM, UTT, sipariş ve yayın kimlikleri doğrudan çağrılacak; veri dönmeyecek.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **TM-03 — Öneri takibi:** Öneri süresi dolarken tamamlanma kaydı yazılacak; rapor tek kesin sonuç gösterecek.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **TM-04 — Challenge takibi:** Aynı challenge iptal ve tamamlanma yarışına sokulacak; tek durum ve doğru puan etkisi kalacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **TM-05 — Ligler:** Dönem kapanışı sırasında puan düzeltmesi yapılacak; sıralama ile puan defteri ayrışmayacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **TM-06 — HBStore ekip siparişleri:** Sipariş kullanıcısı farklı bölgeye taşınırken liste alınacak; yalnız güncel takım kapsamı gösterilecek.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **TM-07 — E-Club rapor ve ligi:** Aynı Eczacı farklı UTT bağlarıyla ilişkilendirilmeye çalışılacak; tek geçerli hiyerarşi raporlanacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **TM-08 — Eczanem raporu:** Aynı müşteri farklı gönderimlerle görünürken gönderimler birbirine karışmayacak.
**TEST ÖNCESİ ZORUNLU: TESTİN AMACI VE UYGULAMA YÖNTEMİ KISA OLARAK KULLANICIYA AÇIKLANACAK, KULLANICI ONAYI ALINMADAN TEST BAŞLATILMAYACAKTIR.**

- [ ] **TM-09 — Hapbi:** Takım dışı performans ve kişi bilgisi istenecek; cevap takım kapsamını aşmayacak.

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
