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

**Durum:** Açık — çözüm belirlenmedi.

#### U-02 — V2 bilgilendirme metni seçilen varyantı doğru anlatmıyor

- V2'de hazır video seçili, hazır soru seti seçili değildir.
- Formdaki bilgilendirme metni buna rağmen kullanıcıya “hazır soru setinizle devam edebilirsiniz” diyor.
- Gerçek akışta hazır videodan sonra soru seti İçerik Üreticisinden talep edilir.

**Durum:** Açık — metin düzeltmesi yapılmadı.

#### U-03 — V4 onay düğmesi yanlış alıcıyı gösteriyor

- V4'te video ve soru seti hazırdır; İçerik Üreticisine görev açılmaz.
- Onay penceresindeki düğme bütün varyantlarda sabit olarak “Onayla ve İçerik Üreticisine Gönder” yazıyor.
- V4'ün gerçek sonraki adımı Yayın Yönetimidir.

**Durum:** Açık — varyanta bağlı metin kararı verilmedi.

#### U-04 — İçerik Üreticisi unvanında dokümantasyon sapması var

- Güncel kod sözleşmesinde `iu` rolünün ekranda kullanılan adı **İçerik Üreticisi** olarak tanımlanıyor.
- Bluebook'un bazı bölümlerinde eski **İçerik Uzmanı** ifadesi bulunuyor.

**Durum:** Açık — Bluebook güncellemesi yapılmadı.

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

**Durum:** Açık — Bluebook, eski kod yorumları/sabitleri ve arayüz güncel yaşam döngüsüyle hizalanmadı.

#### U-06 — C-Club referral puanı Bluebook ile güncel ayar modelinde uyuşmuyor

- Bluebook, challenge tamamlandığında gönderene sabit **+40 referral puanı** yazıldığını belirtiyor.
- Güncel kod bu değeri `sistem_ayarlari.cc_referral_puani` kaydından okuyor; ayar bulunamazsa **10 puan** kullanıyor.
- Bu nedenle canlı veritabanındaki ayar görülmeden +40 sistemin güncel ve sabit değeri olarak kabul edilemez.

**Durum:** Açık — Bluebook sabit değer anlatıyor, kod yapılandırılabilir değer kullanıyor.

#### U-07 — UTT kategori navigasyonu içerik türü sözleşmesinin tamamını taşımıyor

- Bluebook ve `UTT_VIDEO_KATEGORILERI` UTT için beş kategori tanımlıyor: ürün, medikal, ürün-medikal, satış ve İK.
- Ortak içerik türü sözleşmesinde bunlara ek olarak `yonetim` türü bulunuyor.
- UTT ana yayın sorgusu `yonetim` türünü dışlamadığı için bu yayınlar genel raflarda görünebilir; ancak UTT navigasyonunda Yönetim Eğitimleri kategorisi bulunmuyor.

**Durum:** Açık — yayın görünürlüğü ile kategori navigasyonu aynı tür kümesini kullanmıyor.

#### U-08 — E-Club tüketimi “açık katalog” değil, UTT önerisi üzerinden çalışıyor

- Bluebook, eczacı ve teknisyen tüketimini “firma bazlı katalogdan önerilen/açık videoları izleme” şeklinde tanımlıyor.
- Güncel puanlı tüketim akışında kişi yayına doğrudan katalog kaydıyla değil, kendisine UTT tarafından oluşturulmuş `eclub_oneri_kayitlari` kaydıyla erişiyor.
- İzleme, geçerlilik penceresi, puan ve soru hakkı `oneri_id` ekseninde doğrulanıyor; süresi geçmiş öneri izlenebilse de puan ve soru üretmiyor.

**Durum:** Açık — Bluebook'taki katalog ifadesi güncel öneri bağımlılığını yeterince açık anlatmıyor.

#### U-09 — Eczanem ileri sarma davranışı dokümantasyonda eksik tanımlanıyor

- Bluebook, Eczanem için “ileri sarma kaybı yoktur” diyor.
- Güncel müşteri oynatıcısı ileri sarmayı serbest bırakıp cezasız işlemiyor; ileri sarmayı tamamen engelliyor ve kullanıcıyı son doğrulanmış konuma geri getiriyor.
- Her iki modelde de puan kaybı oluşmamasına rağmen kullanıcı davranışı bakımından sözleşmeler farklıdır.

**Durum:** Açık — Bluebook'ta ileri sarmanın kapalı olduğu açıkça yazılmıyor.

### Tüketim Tarafında Korunacak Teknik Sınır

Mevcut yayın kimliği, hedef roller, soru seti, puan, öneri/challenge/dağıtım, rapor ve ödül zincirleri öğrenme aracından ayrıştırılabilecek ortak omurgadır. Buna karşılık mevcut tüketim motorları video URL'si, oynatıcı olayları, doğrulanmış süre, izlenen saniye, ileri sarma ve video bitişi kavramlarına doğrudan bağlıdır.

Öğrenme Araçları Genişletmesi, üretim varyantlarını yeniden tanımlamadan bu video bağımlı tüketim noktalarını öğrenme aracına uygun tamamlama ve ölçüm kurallarıyla ele almalıdır.
