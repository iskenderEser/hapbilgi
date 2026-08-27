# Öğrenme Araçları Genişletmesi

## AI Öğrenme Aşaması

### 1. Öğrenme — Üretici Rollerinin Talep Oluşturma Süreci

**Durum:** Tamamlandı
**Tarih:** 27 Ağustos 2026

Bu aşamada Bluebook ile üretici talep arayüzü, rol/yetenek sözleşmeleri, talep API'si, üretim RPC'leri ve ilgili smoke testleri birlikte incelendi. Bu bölümdeki maddeler henüz çözüm kararı veya geliştirme kapsamı değildir; mevcut sistemde doğrulanan ve geliştirme öncesinde ele alınması gereken uyumsuzluk kayıtlarıdır.

#### U-01 — Referans dosyası alanı ile rol yetkisi uyuşmuyor

- Ortak talep formu referans dosyası ekleme alanını 13 üretici rolün tamamına gösteriyor.
- `POST /talepler/api/dosyalar` ve `DELETE /talepler/api/dosyalar` yalnız PM ailesini (`pm`, `jr_pm`, `kd_pm`) kabul ediyor.
- PM dışındaki üretici, arayüzde sunulan işlemi sunucu tarafında tamamlayamıyor.
- İstemci, dosya metadata isteğinin HTTP sonucunu ayrıca denetlemediği için storage yüklemesi başarılı, talebe bağlama işlemi başarısız olduğunda kullanıcıya yanıltıcı başarı durumu oluşabilir.

**Durum:** Karara bağlandı — referans dosyası bütün talep açabilen üretici rollere açılacak; yazma/silme talep sahipliğiyle, okuma ise talep sahipliği veya atanmış İÜ göreviyle korunacak. Metadata kaydı başarısızsa yükleme başarılı sayılmayacak.

#### U-02 — V2 bilgilendirme metni seçilen varyantı doğru anlatmıyor

- V2'de hazır video seçili, hazır soru seti seçili değildir.
- Formdaki bilgilendirme metni buna rağmen kullanıcıya “hazır soru setinizle devam edebilirsiniz” diyor.
- Gerçek akışta hazır videodan sonra soru seti İçerik Üreticisinden talep edilir.

**Durum:** Karara bağlandı — V2 metni hazır aracın ardından soru setinin İçerik Üreticisinden talep edileceğini söyleyecek.

#### U-03 — V4 onay düğmesi yanlış alıcıyı gösteriyor

- V4'te video ve soru seti hazırdır; İçerik Üreticisine görev açılmaz.
- Onay penceresindeki düğme bütün varyantlarda sabit olarak “Onayla ve İçerik Üreticisine Gönder” yazıyor.
- V4'ün gerçek sonraki adımı Yayın Yönetimidir.

**Durum:** Karara bağlandı — V1–V3 İçerik Üreticisine, V4 doğrudan Yayın Yönetimine gönderim metni gösterecek.

#### U-04 — İçerik Üreticisi unvanında dokümantasyon sapması var

- Güncel kod sözleşmesinde `iu` rolünün ekranda kullanılan adı **İçerik Üreticisi** olarak tanımlanıyor.
- Bluebook'un bazı bölümlerinde eski **İçerik Uzmanı** ifadesi bulunuyor.

**Durum:** Karara bağlandı — kullanıcıya ve dokümantasyona yansıyan tek unvan **İçerik Üreticisi** olacak.

### Geliştirme İçin Korunacak Kavramsal Ayrım

V1–V4, öğrenme aracı türünü değil; video ile soru setinin talep anında hazır olup olmadığını ve kalan üretim işinin kime ait olduğunu belirler. Video, broşür, PDF veya podcast gibi **öğrenme aracı** seçimi bu üretim varyantlarından bağımsız bir eksendir.

Mevcut talep formundaki PDF, DOCX, PPTX, XLSX, TXT, PNG ve JPG dosyaları yayınlanacak öğrenme araçları değil, talebi destekleyen referans dosyalarıdır.

### 2. Öğrenme — Tüketici Rollerinin Yayınları Öğrenme Amaçlı Kullanımı

**Durum:** Tamamlandı
**Tarih:** 27 Ağustos 2026

Bu aşamada Bluebook ile UTT/KD_UTT, BM, eczacı, eczane teknisyeni ve Eczanem müşterisinin yayın erişimi; oynatıcıları, izleme ve soru API'leri, puan motorları, dağıtım zincirleri, SQL/RPC sözleşmeleri ve ilgili smoke testleri birlikte incelendi. Aşağıdaki maddeler geliştirme kararı değil, mevcut dokümantasyon ile güncel kod sözleşmesi arasında doğrulanan uyumsuzluk kayıtlarıdır.

#### U-05 — C-Club challenge yaşam süresi üç farklı sözleşme taşıyor

- Bluebook, challenge'ın 15 gün içinde tamamlanmaması hâlinde süresinin dolduğunu ve kayıp doğurduğunu söylüyor.
- Eski kod sabitleri ve yorumları 5 iş günü süresini tarif ediyor.
- Güncel `cc_yeni_puanlama_modeli.sql` ve yaşam döngüsü testi ise challenge süresini ve süre aşımı kaybını kaldırıyor; cron görevini kapatıyor ve `son_tarih` alanını geriye dönük uyumluluk için fiilen 100 yıl sonrasına yazıyor.
- C-Club arayüzü buna rağmen `son_tarih` üzerinden “kalan gün / süresi doldu” bilgisi üretmeye devam ediyor.

**Durum:** Karara bağlandı — güncel süresiz model korunacak; challenge tamamlanana kadar bekleyecek, süre aşımı kaybı ve cron yeniden açılmayacak. `son_tarih` yalnız geriye dönük şema uyumluluğudur.

#### U-06 — C-Club referral puanı Bluebook ile güncel ayar modelinde uyuşmuyor

- Bluebook, challenge tamamlandığında gönderene sabit **+40 referral puanı** yazıldığını belirtiyor.
- Güncel kod bu değeri `sistem_ayarlari.cc_referral_puani` kaydından okuyor; ayar bulunamazsa **10 puan** kullanıyor.
- Bu nedenle canlı veritabanındaki ayar görülmeden +40 sistemin güncel ve sabit değeri olarak kabul edilemez.

**Durum:** Karara bağlandı — referral puanı `sistem_ayarlari.cc_referral_puani` değerinden okunacak; ayar yoksa 10 kullanılacak. Bluebook sabit +40 anlatmayacak.

#### U-07 — UTT kategori navigasyonu içerik türü sözleşmesinin tamamını taşımıyor

- Bluebook ve `UTT_VIDEO_KATEGORILERI` UTT için beş kategori tanımlıyor: ürün, medikal, ürün-medikal, satış ve İK.
- Ortak içerik türü sözleşmesinde bunlara ek olarak `yonetim` türü bulunuyor.
- UTT ana yayın sorgusu `yonetim` türünü dışlamadığı için bu yayınlar genel raflarda görünebilir; ancak UTT navigasyonunda Yönetim Eğitimleri kategorisi bulunmuyor.

**Durum:** Karara bağlandı — Yönetim Eğitimleri UTT hedefli yayınlarda korunacak ve UTT navigasyonuna altıncı kategori olarak eklenecek.

#### U-08 — E-Club tüketimi “açık katalog” değil, UTT önerisi üzerinden çalışıyor

- Bluebook, eczacı ve teknisyen tüketimini “firma bazlı katalogdan önerilen/açık videoları izleme” şeklinde tanımlıyor.
- Güncel puanlı tüketim akışında kişi yayına doğrudan katalog kaydıyla değil, kendisine UTT tarafından oluşturulmuş `eclub_oneri_kayitlari` kaydıyla erişiyor.
- İzleme, geçerlilik penceresi, puan ve soru hakkı `oneri_id` ekseninde doğrulanıyor; süresi geçmiş öneri izlenebilse de puan ve soru üretmiyor.

**Durum:** Karara bağlandı — E-Club puanlı tüketimi `eclub_oneri_kayitlari.oneri_id` bağıyla tanımlanacak; açık katalog puanlı öğrenme kaynağı sayılmayacak.

#### U-09 — Eczanem ileri sarma davranışı dokümantasyonda eksik tanımlanıyor

- Bluebook, Eczanem için “ileri sarma kaybı yoktur” diyor.
- Güncel müşteri oynatıcısı ileri sarmayı serbest bırakıp cezasız işlemiyor; ileri sarmayı tamamen engelliyor ve kullanıcıyı son doğrulanmış konuma geri getiriyor.
- Her iki modelde de puan kaybı oluşmamasına rağmen kullanıcı davranışı bakımından sözleşmeler farklıdır.

**Durum:** Karara bağlandı — Eczanem'de ileri sarma kapalıdır; kullanıcı son doğrulanmış konuma döndürülür ve ileri sarma kaybı oluşmaz.

### Tüketim Tarafında Korunacak Teknik Sınır

Mevcut yayın kimliği, hedef roller, soru seti, puan, öneri/challenge/dağıtım, rapor ve ödül zincirleri öğrenme aracından ayrıştırılabilecek ortak omurgadır. Buna karşılık mevcut tüketim motorları video URL'si, oynatıcı olayları, doğrulanmış süre, izlenen saniye, ileri sarma ve video bitişi kavramlarına doğrudan bağlıdır.

Öğrenme Araçları Genişletmesi, üretim varyantlarını yeniden tanımlamadan bu video bağımlı tüketim noktalarını öğrenme aracına uygun tamamlama ve ölçüm kurallarıyla ele almalıdır.

## Faz 1 — Karar ve Başlangıç Sözleşmesi

**Tarih:** 27 Ağustos 2026
**Amaç:** Yeni öğrenme araçları eklenmeden önce mevcut video üretim/tüketim omurgasının korunacak davranışlarını ve düzeltilecek sapmalarını sabitlemek.

### Araç, Varyant, Yayın ve Puan Sözleşmesi

- Öğrenme aracı türlerinin kanonik kümesi `video | podcast | gorsel | flip_pdf` olacaktır.
- Öğrenme aracı seçimi V1–V4 hesabından bağımsızdır.
- V1: Araç ve soru setini HapBilgi üretir.
- V2: Üretici hazır aracı sağlar; soru setini HapBilgi üretir.
- V3: Aracı HapBilgi üretir; üretici hazır soru setini sağlar.
- V4: Üretici hazır aracı ve hazır soru setini sağlar; akış doğrudan Yayın Yönetimine geçer.
- Her `yayin_id` bağımsız öğrenme ve puan fırsatıdır. Aynı eğitim ailesindeki araç benzerliği puanı engellemez.
- Hedef roller `lib/utils/roller.ts`, üretici yetenekleri ve eğitim türleri `lib/uretici/yetenekler.ts` kaynaklarından gelmeye devam eder.

### Üretim Başlangıç Davranışı

| Konu | Sabitlenen davranış |
|---|---|
| Talep sahibi | 13 üretici rol yalnız kendi talebini oluşturur ve yönetir. |
| İçerik Üreticisi | `iu`, kendisine atanmış üretim görevi üzerinden senaryo, araç ve soru seti teslim eder. |
| Referans dosyası | Bütün talep açabilen üretici roller ekleyebilir; üretici sahipliği ve atanmış İÜ görevi dışında okunamaz. |
| V1 ilk iş | Senaryo üretimi için İçerik Üreticisine gider. |
| V2 ilk iş | Hazır video doğrulandıktan sonra soru seti için İçerik Üreticisine gider. |
| V3 ilk iş | Video/senaryo üretimi için İçerik Üreticisine gider. |
| V4 ilk iş | İçerik Üreticisi görevi açmadan Yayın Yönetimine gider. |
| Onay/revizyon | Mevcut görev ve durum makinesi korunur; yeni araç için yeni bir onay zinciri kurulmaz. |

### Tüketim ve Puan Başlangıç Davranışı

| Rol | Erişim bağı | Tamamlanma ve soru | Puan/ödül sınırı |
|---|---|---|---|
| UTT/KD_UTT | Hedef role açık doğrudan T-Club kataloğu | Gerçek oynatma, doğrulanmış süre; ileri sarma soru hakkını kapatır | Hafta içi 07:00–20:29 penceresi, oransal ileri sarma kaybı, temiz tekrar extra puanı, HBStore |
| BM | Hedef role açık C-Club yayını ve gelen challenge bağı | Gerçek oynatma, doğrulanmış süre ve challenge soru seti | İleri sarma/yanlış cevap kaybı, ayar tabanlı gönderme/referral puanı, C-Club ligi ve HBStore; challenge süre aşımı yok |
| Eczacı | UTT'nin kişiye gönderdiği `oneri_id` | Öneriye bağlı izleme ve soru | Aktif öneride puan; süresi geçmiş öneride izleme var, puan ve soru yok; E-Club Store |
| Teknisyen | UTT'nin kişiye gönderdiği `oneri_id` | Eczacıyla aynı öneriye bağlı tüketim | Eczacıyla aynı puan ve E-Club Store sözleşmesi |
| Müşteri | UTT → eczane → aktif müşteri gönderimi | Gerçek Play ile başlar; ileri sarma kapalı; tamamlamadan sonra soru | İleri sarma ve yanlış cevap kaybı yok; 180 gün FIFO puanı ve eczane kasa indirimi |

### Yetki ve Sahiplik Sınırı

- İç çalışan, E-Club kişisi ve Eczanem müşterisi üç ayrı kimlik düzleminde kalır.
- Her yayın firma ve hedef rol kapısından geçer.
- T-Club verisi firma, takım, bölge ve kişi kapsamıyla korunur.
- C-Club yalnız aynı firmanın uygun BM kullanıcıları arasında çalışır.
- E-Club önerisi kişi, eczane, firma, hedef rol ve `oneri_id` bağını doğrular.
- Eczanem dağıtımı aktif müşteri–eczane üyeliğini; puan kullanımı müşteri, eczane, firma ve ürün dörtlüsünü doğrular.
- Aynı öğrenme olayı mükerrer tamamlanma veya mükerrer puan üretemez.

### Başlangıç Test Kaydı

Mevcut başlangıç davranışının otomatik güvence kaynakları:

- Üretim: `uretimGorevSozlesmesi`, `uretimGorevArayuzu`, `uretimRpc`, `hedefRoller` ve `talepFormuUyumu` smoke testleri.
- UTT: `izlemeBaslat` ve `izlemeKarari` smoke testleri.
- BM: `ccChallengeGonderimGuvenligi`, `ccChallengeYasamDongusu` ve `ccIzlemeCevapGuvenligi` smoke testleri.
- Eczacı/teknisyen: `eclubIzlemeKurali`, `eclubOneriKapsam` ve `eclubKisiErisim` smoke testleri.
- Müşteri: `eczanemMusteriYuzeyi`, `eczanemIzlemeCevapGuvenligi`, `eczanemAktifUyelikGonderim` ve `eczanemSiparisMutabakat` smoke testleri.

Faz 1 öncesinde U-01–U-03 için doğrudan regresyon testi yoktu; `talepFormuUyumu.smoke.test.ts` ile bu boşluk kapatılmıştır. Yeni araçlarda süre dışı tamamlanma kanıtları, medya erişim tokenları ve araç bazlı mükerrer puan sınırları Faz 2 ve ilgili araç fazlarında ayrıca test edilecektir.
