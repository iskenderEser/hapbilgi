# Öğrenme Araçları Genişletme Proje Faz Planı — Checklist

**Proje:** Öğrenme Araçları Genişletmesi
**Belge tarihi:** 27 Ağustos 2026
**Kapsam:** Podcast, Görsel ve Flip PDF / Dijital İnteraktif Broşür
**Takip durumu:** Aktif
**Teknik referans:** `docs/OGRENIM_ARACI_GENISLETME_PROJESI_PLANI.md`

## Belgenin Kullanım Kuralı

Bu belge, projenin uygulama ve ilerleme takibindeki tek kontrol kaynağıdır. Ayrıntılı teknik gerekçeler ve sistem sözleşmeleri teknik referans belgesinden okunur; yapılan işlerin durumu yalnız bu belgeden takip edilir.

1. Fazlar sırayla yürütülür. Önceki faz tamamlanmadan sonraki faz başlatılmaz.
2. Bir checklist maddesi yalnız geliştirme tamamlanıp ilgili doğrulama yapıldıktan sonra `[x]` olarak işaretlenir.
3. Faz devam ederken **Durum** alanı `Devam Ediyor` olarak güncellenir.
4. Fazdaki bütün checklist ve çıkış ölçütleri tamamlandığında **Yapıldı** alanı `Evet` olarak değiştirilir.
5. Fazın kod ve belge değişiklikleri, **Yapıldı: Evet** işaretini de içeren tek kapanış commit'ine alınır. Bu commit Git geçmişindeki faz kaydıdır.
6. Tamamlanmamış faz `Yapıldı: Evet` olarak işaretlenmez ve sonraki faza geçilmez.
7. Push işlemi yalnız kullanıcı talimatıyla yapılır.

## Değişmeyecek Proje Kararları

- Mevcut üretim ve tüketim süreçleri yeniden tasarlanmaz; yeni araçlar mevcut omurgaya eklenir.
- V1–V4 üretim varyantları korunur. Öğrenme aracı seçimi varyant değildir.
- Her talep bir öğrenme aracı seçer: `video`, `podcast`, `gorsel` veya `flip_pdf`.
- Farklı araçlarla yayımlanan her yayın bağımsız öğrenme ve kazanım fırsatıdır; içerik benzerliği puan engeli değildir.
- Hedef rol, soru, puan, öneri, challenge, dağıtım, rapor, lig ve ödül kuralları korunur.
- Video Bunny Stream'de; podcast, görsel ve flip PDF Bunny Storage Zone + Pull Zone/CDN'de tutulur.
- Medya dosyaları repoya, Next.js `public` klasörüne veya Vercel deployment paketine eklenmez.
- Araçlar **Podcast → Görsel → Flip PDF** sırasıyla uçtan uca tamamlanır.

## Genel İlerleme

| Faz | Ad | Durum | Yapıldı |
|---:|---|---|---|
| 1 | Kararların ve mevcut davranışın sabitlenmesi | Tamamlandı | Evet |
| 2 | Ortak teknik omurganın kurulması | Tamamlandı | Evet |
| 3 | Podcast'in uçtan uca geliştirilmesi | Bekliyor | Hayır |
| 4 | Görselin uçtan uca geliştirilmesi | Bekliyor | Hayır |
| 5 | Flip PDF'nin uçtan uca geliştirilmesi | Bekliyor | Hayır |
| 6 | Ortak sistemlerin birleştirilmesi ve mutabakat | Bekliyor | Hayır |
| 7 | Nihai regresyon, kabul ve dokümantasyon | Bekliyor | Hayır |

---

## Faz 1 — Kararların ve Mevcut Davranışın Sabitlenmesi

**Durum:** Tamamlandı
**Yapıldı:** Evet
**Teknik plan karşılığı:** Bölüm 1, 2 ve kayıtlı U-01–U-09 uyumsuzlukları

### Sözleşmeler

- [x] Öğrenme aracı türleri tek sözleşmede `video | podcast | gorsel | flip_pdf` olarak tanımlandı.
- [x] Öğrenme aracı seçiminin V1–V4 varyant hesabından bağımsız olduğu kesinleştirildi.
- [x] V1–V4 karar tablosu mevcut kod davranışıyla karşılaştırıldı ve hedef davranış kaydedildi.
- [x] Her `yayin_id` için bağımsız öğrenme ve puan fırsatı ilkesi teknik sözleşmeye işlendi.
- [x] Hedef rollerin mevcut rol kaynağından gelmeye devam edeceği doğrulandı.
- [x] Puan, öneri, challenge, dağıtım, rapor, lig ve ödül kurallarının korunacak sınırları kaydedildi.

### Kayıtlı Uyumsuzluk Kararları

- [x] U-01 için mevcut üretici talep davranışı ve uygulanacak karar kesinleştirildi.
- [x] U-02 için mevcut üretici talep davranışı ve uygulanacak karar kesinleştirildi.
- [x] U-03 için mevcut üretici talep davranışı ve uygulanacak karar kesinleştirildi.
- [x] U-04 için mevcut üretici talep davranışı ve uygulanacak karar kesinleştirildi.
- [x] U-05 için C-Club challenge davranışı tek sözleşmeye bağlandı.
- [x] U-06 için C-Club challenge yaşam döngüsü tek sözleşmeye bağlandı.
- [x] U-07 için tüketici davranışı ve uygulanacak karar kesinleştirildi.
- [x] U-08 için tüketici davranışı ve uygulanacak karar kesinleştirildi.
- [x] U-09 için tüketici davranışı ve uygulanacak karar kesinleştirildi.

### Başlangıç Kaydı ve Güvenlik Sınırı

- [x] Mevcut video üretim akışının başlangıç davranışı kaydedildi.
- [x] UTT/KD_UTT video tüketim ve puan davranışı kaydedildi.
- [x] BM video tüketim ve puan davranışı kaydedildi.
- [x] Eczacı ve teknisyen video tüketim ve puan davranışı kaydedildi.
- [x] Müşteri video tüketim ve puan davranışı kaydedildi.
- [x] Mevcut kritik video testleri ve eksik test alanları belirlendi.
- [x] Firma, takım, bölge, eczane ve kullanıcı sahiplik sınırları doğrulama listesine işlendi.

### Faz 1 Doğrulama Kaydı

- [x] Faz odaklı smoke testleri: 19/19 başarılı.
- [x] Tam smoke test paketi: 173/173 başarılı.
- [x] Build typecheck: başarılı.
- [x] Değiştirilen dosyalarda ESLint: 0 hata; mevcut 3 uyarı.
- [x] Proje geneli lint başlangıç borcu kaydedildi: faz dışı dosyalarda 44 hata ve 132 uyarı.
- [x] Yerel production build gözlemi kaydedildi: derleme 5 dakika çıktı vermeden sürdüğü için durduruldu; başarı sonucu yazılmadı.

### Faz 1 Çıkış Ölçütleri

- [x] Açık sözleşme veya kararsız uyumsuzluk kalmadı.
- [x] Uygulama sırasında değişmeyecek mevcut davranışlar ölçülebilir biçimde kaydedildi.
- [x] Faz kapsamındaki kontroller tamamlandı.
- [x] **Yapıldı** alanı `Evet` olarak güncellendi.
- [x] Faz kapanış commit kapsamı hazırlandı.

---

## Faz 2 — Ortak Teknik Omurganın Kurulması

**Durum:** Tamamlandı
**Yapıldı:** Evet
**Teknik plan karşılığı:** Bölüm 3, 4, 7, 8 ve 13.4

### Veri Modeli ve Geriye Dönük Uyumluluk

- [x] `ogrenme_araclari` ana veri modeli eklemeli migration ile oluşturuldu.
- [x] Araç durum geçmişi araçtan bağımsız yapıda tanımlandı.
- [x] Öğrenme aracı puanı araçtan bağımsız yapıda tanımlandı.
- [x] `talepler` kaydı öğrenme aracı türünü taşıyacak biçimde genişletildi.
- [x] Soru seti, üretim görevi ve yayın bağlantıları yeni araç kimliklerini taşıyacak biçimde genişletildi.
- [x] Yayın detay kaynağı araç türü ve doğrulanmış metadata döndürecek biçimde genişletildi.
- [x] Mevcut videolar `arac_turu=video` kabulüyle geri dolduruldu.
- [x] Eski video kimlikleri uyumluluk süresince korundu.
- [x] Migration ve puan yazma işlemlerinin idempotentliği doğrulandı.

### Bunny Depolama ve Erişim

- [x] HapBilgi öğrenme araçları için Bunny Storage Zone hazırlandı.
- [x] Bunny Pull Zone/CDN bağlantısı hazırlandı.
- [x] Storage erişim anahtarlarının yalnız sunucu tarafında kalması sağlandı.
- [x] Medya nesne yolu ve dosya adı üretimi sunucu denetimine alındı.
- [x] Süreli/tokenlı medya erişim sözleşmesi uygulandı.
- [x] Medya dosyalarının repo, `public` klasörü ve Vercel çıktısına girmediği doğrulandı.

### Ortak Yükleme ve Güvenlik

- [x] Yüklemeyi başlatma API'si oluşturuldu.
- [x] Yüklemeyi tamamlama API'si oluşturuldu.
- [x] Araç durumunu okuma API'si oluşturuldu.
- [x] Yetkili erişim adresi üretme API'si oluşturuldu.
- [x] MIME türü ve dosya imzası sunucuda doğrulandı.
- [x] Dosya boyutu ve araca özel metadata sunucuda doğrulandı.
- [x] Yükleme tamamlanmadan onaylı araç kaydı oluşması engellendi.
- [x] Başka kullanıcı veya kuruma ait medya yoluna erişim engellendi.

### Ortak Yayın ve Tüketim Çekirdeği

- [x] Yayın kapıları araçtan bağımsız ortak sözleşmeye taşındı.
- [x] Araç onayı, metadata, soru seti ve puan kontrolleri ortaklaştırıldı.
- [x] Araç türünün yayın aşamasında değiştirilmesi engellendi.
- [x] Ortak öğrenme aracı sunucusu/oynatıcı arabirimi oluşturuldu.
- [x] `baslat`, `ilerlemeKaydet`, `tamamlanabilirMi` ve `tamamla` davranışları tanımlandı.
- [x] `soruHakkiKaniti`, `kaldigiYerdenDevam` ve `kapakVeMetadata` davranışları tanımlandı.
- [x] Araç türüne göre tamamlanma kanıtı kabul edecek sunucu sınırı kuruldu.
- [x] Her araç için bağımsız açma/kapama bayrağı eklendi.

### Video Regresyonu

- [x] Eski video talepleri aynı biçimde oluşturulabiliyor.
- [x] Eski video üretim görevleri aynı biçimde tamamlanabiliyor.
- [x] Eski video yayınları aynı biçimde açılabiliyor.
- [x] Beş tüketici rolündeki video erişim ve puan davranışı değişmedi.
- [x] Video rapor, lig ve ödül kayıtları değişmedi.
- [x] Yeni ortak katman deployment paketini kabul edilemez ölçüde büyütmedi.

### Faz 2 Doğrulama Kaydı

- [x] Canlı eklemeli migration tamamlandı: 47 öğrenme aracı, 64 durum kaydı ve 47 puan kaydı doğrulandı.
- [x] Migration dry-run/rollback ve tekrar çalıştırma kontrollerinde eksik veya çoğaltılmış kayıt oluşmadı.
- [x] Bunny `hapbilgi-learning` Storage Zone, `hapbilgilearning` Pull Zone ve `hapbilgi-learning-upload` Edge Script hazırlandı.
- [x] Canlı Bunny zinciri doğrulandı: yükleme `201`, Storage `200`, imzalı CDN `200`, imzasız CDN `403`, geçersiz origin `403`.
- [x] Faz odaklı smoke testleri: 23/23 başarılı.
- [x] Tam smoke test paketi: 196/196 başarılı.
- [x] Uygulama build typecheck ve Bunny Edge SDK typecheck başarılı.
- [x] Medya, Edge SDK bağımlılıkları ve altyapı çalışma klasörleri Git/Vercel paketinin dışında tutuldu.
- [x] Yerel production build denemesi bilinen sessiz bekleme davranışı nedeniyle sonuçlandırılmadı; başarı sonucu yazılmadı.

### Faz 2 Çıkış Ölçütleri

- [x] Ortak omurga yeni araçlar kapalıyken mevcut video sistemini kesintisiz çalıştırıyor.
- [x] Veri, depolama, erişim ve yetkilendirme kontrolleri başarıyla tamamlandı.
- [x] Video regresyon kontrolleri geçti.
- [x] Faz kapsamındaki kontroller tamamlandı.
- [x] **Yapıldı** alanı `Evet` olarak güncellendi.
- [x] Faz kapanış commit kapsamı hazırlandı.

---

## Faz 3 — Podcast'in Uçtan Uca Geliştirilmesi

**Durum:** Bekliyor
**Yapıldı:** Hayır
**Teknik plan karşılığı:** Bölüm 5–12.2 ve 13

### Üretici Talebi ve Varyantlar

- [ ] Talep formunda Podcast öğrenme aracı seçilebiliyor.
- [ ] Podcast seçimi talep gönderildikten sonra değiştirilemiyor.
- [ ] Hazır podcast ile referans dosyası alanları birbirinden ayrıldı.
- [ ] Ses, kapak, monolog/diyalog ve transkript alanları tanımlandı.
- [ ] Podcast için V1 talebi doğrulandı.
- [ ] Podcast için V2 talebi doğrulandı.
- [ ] Podcast için V3 talebi doğrulandı.
- [ ] Podcast için V4 talebi doğrulandı.
- [ ] Sunucu rol, sahiplik, araç ve varyant kararını yeniden doğruluyor.

### İçerik Üreticisi, Onay ve Yayın

- [ ] İçerik Üreticisi podcast görevini mevcut görev yaşam döngüsünde alabiliyor.
- [ ] Nihai ses, kapak ve transkript teslimi yapılabiliyor.
- [ ] MP3 ve M4A/AAC gerçek dosya türü doğrulaması yapılıyor.
- [ ] Pozitif ses süresi doğrulanıyor.
- [ ] Podcast dosyası Bunny Storage'a yükleniyor ve CDN üzerinden yetkili sunuluyor.
- [ ] Üretici podcast'i ön izleyip onaylayabiliyor veya revizyona gönderebiliyor.
- [ ] Onaylı podcast soru seti ve araç puanıyla Yayın Yönetimine ulaşabiliyor.
- [ ] Eksik veya oynatılamayan podcast'in yayımlanması engelleniyor.

### Tüketim ve Tamamlanma

- [ ] İlk gerçek Play ile tüketim oturumu açılıyor.
- [ ] Süre ve son dinleme konumu güvenilir biçimde kaydediliyor.
- [ ] Arka sekmede sahte ilerleme yazılması engelleniyor.
- [ ] UTT/KD_UTT ileri atlama ve soru hakkı davranışı doğrulandı.
- [ ] BM ileri atlama ve soru hakkı davranışı doğrulandı.
- [ ] Eczacı için E-Club erişim, dinleme ve tamamlama davranışı doğrulandı.
- [ ] Teknisyen için E-Club erişim, dinleme ve tamamlama davranışı doğrulandı.
- [ ] Müşteri için Eczanem erişim, ileri atlama kısıtı ve tamamlama davranışı doğrulandı.
- [ ] Sesin sonuna ulaşma ve sunucu süre kontrolüyle tamamlanma kanıtı üretiliyor.
- [ ] Yarım bırakılan podcast kaldığı yerden devam ediyor.
- [ ] Aynı podcast tamamlaması iki kez puan yazmıyor.

### Puan, Soru, Rapor ve Canlı Doğrulama

- [ ] Role uygun soru açılma koşulu doğrulandı.
- [ ] Doğru, yanlış, tekrar ve extra puan kuralları role göre doğrulandı.
- [ ] Öneri, challenge ve müşteri gönderimi bağları doğrulandı.
- [ ] Süresi geçmiş E-Club önerisinin puan ve soru üretmediği doğrulandı.
- [ ] Podcast puanı rapor ve lig toplamına doğru yansıyor.
- [ ] HBStore, E-Club Store ve Eczanem ödül/indirim etkisi doğrulandı.
- [ ] Podcast bildirimi, beğeni ve favori davranışı doğrulandı.
- [ ] Hapbi podcast kaynağını okuyup doğru yayına yönlendirebiliyor.
- [ ] UTT/KD_UTT canlı rol doğrulaması tamamlandı.
- [ ] BM canlı rol doğrulaması tamamlandı.
- [ ] Eczacı canlı rol doğrulaması tamamlandı.
- [ ] Teknisyen canlı rol doğrulaması tamamlandı.
- [ ] Müşteri canlı rol doğrulaması tamamlandı.

### Faz 3 Çıkış Ölçütleri

- [ ] Podcast V1–V4 üretimden beş tüketici rolündeki ödül sonucuna kadar çalışıyor.
- [ ] Podcast güvenlik, performans ve mobil davranış kontrolleri geçti.
- [ ] Video regresyon kontrolleri geçti.
- [ ] Faz kapsamındaki kontroller tamamlandı.
- [ ] **Yapıldı** alanı `Evet` olarak güncellendi.
- [ ] Faz kapanış commit kapsamı hazırlandı.

---

## Faz 4 — Görselin Uçtan Uca Geliştirilmesi

**Durum:** Bekliyor
**Yapıldı:** Hayır
**Teknik plan karşılığı:** Bölüm 5–12.3 ve 13

### Üretici Talebi ve Varyantlar

- [ ] Talep formunda Görsel öğrenme aracı seçilebiliyor.
- [ ] Görsel seçimi talep gönderildikten sonra değiştirilemiyor.
- [ ] Hazır görsel ile referans dosyası alanları birbirinden ayrıldı.
- [ ] Görsel yükleme ve ön izleme alanları tanımlandı.
- [ ] Görsel için V1 talebi doğrulandı.
- [ ] Görsel için V2 talebi doğrulandı.
- [ ] Görsel için V3 talebi doğrulandı.
- [ ] Görsel için V4 talebi doğrulandı.
- [ ] Sunucu rol, sahiplik, araç ve varyant kararını yeniden doğruluyor.

### İçerik Üreticisi, Onay ve Yayın

- [ ] İçerik Üreticisi görsel görevini mevcut görev yaşam döngüsünde alabiliyor.
- [ ] Nihai görsel ve gerekli metadata teslimi yapılabiliyor.
- [ ] JPEG/JPG ve PNG gerçek dosya türü doğrulaması yapılıyor.
- [ ] Piksel ölçüleri ve dosya boyutu doğrulanıyor.
- [ ] EXIF ve gereksiz metadata temizleniyor.
- [ ] Görsel Bunny Storage'a yükleniyor ve CDN üzerinden yetkili sunuluyor.
- [ ] Üretici görseli ön izleyip onaylayabiliyor veya revizyona gönderebiliyor.
- [ ] Onaylı görsel soru seti ve araç puanıyla Yayın Yönetimine ulaşabiliyor.
- [ ] Bozuk, ölçüsüz veya yüklenemeyen görselin yayımlanması engelleniyor.

### Tüketim ve Tamamlanma

- [ ] Görselin tamamen yüklenmesi tamamlanma ön koşulu olarak uygulanıyor.
- [ ] Görselin görünür olmadığı sürenin ilerlemeye yazılması engelleniyor.
- [ ] Yayına sabitlenmiş asgari aktif inceleme süresi uygulanıyor.
- [ ] “İncelemeyi tamamladım” eylemi yalnız süre koşulu sonrası açılıyor.
- [ ] Tamamlanma koşulu oluşmadan soruların açılması engelleniyor.
- [ ] UTT/KD_UTT görsel erişim ve tamamlama davranışı doğrulandı.
- [ ] BM görsel erişim ve tamamlama davranışı doğrulandı.
- [ ] Eczacı görsel erişim ve tamamlama davranışı doğrulandı.
- [ ] Teknisyen görsel erişim ve tamamlama davranışı doğrulandı.
- [ ] Müşteri görsel erişim ve tamamlama davranışı doğrulandı.
- [ ] Yarım bırakılan görsel incelemesi güvenli biçimde devam ediyor.
- [ ] Aynı görsel tamamlaması iki kez puan yazmıyor.

### Puan, Soru, Rapor ve Canlı Doğrulama

- [ ] Role uygun soru, puan, tekrar ve extra puan kuralları doğrulandı.
- [ ] Öneri, challenge ve müşteri gönderimi bağları doğrulandı.
- [ ] Görsel puanı rapor ve lig toplamına doğru yansıyor.
- [ ] HBStore, E-Club Store ve Eczanem ödül/indirim etkisi doğrulandı.
- [ ] Görsel bildirimi, beğeni ve favori davranışı doğrulandı.
- [ ] Hapbi görsel kaynağını okuyup doğru yayına yönlendirebiliyor.
- [ ] UTT/KD_UTT canlı rol doğrulaması tamamlandı.
- [ ] BM canlı rol doğrulaması tamamlandı.
- [ ] Eczacı canlı rol doğrulaması tamamlandı.
- [ ] Teknisyen canlı rol doğrulaması tamamlandı.
- [ ] Müşteri canlı rol doğrulaması tamamlandı.

### Faz 4 Çıkış Ölçütleri

- [ ] Görsel V1–V4 üretimden beş tüketici rolündeki ödül sonucuna kadar çalışıyor.
- [ ] Büyük görsel, mobil bellek ve yükleme performansı kontrolleri geçti.
- [ ] Video ve podcast regresyon kontrolleri geçti.
- [ ] Faz kapsamındaki kontroller tamamlandı.
- [ ] **Yapıldı** alanı `Evet` olarak güncellendi.
- [ ] Faz kapanış commit kapsamı hazırlandı.

---

## Faz 5 — Flip PDF'nin Uçtan Uca Geliştirilmesi

**Durum:** Bekliyor
**Yapıldı:** Hayır
**Teknik plan karşılığı:** Bölüm 5–12.4 ve 13

### Üretici Talebi ve Varyantlar

- [ ] Talep formunda Flip PDF öğrenme aracı seçilebiliyor.
- [ ] Flip PDF seçimi talep gönderildikten sonra değiştirilemiyor.
- [ ] Hazır PDF ile referans dosyası alanları birbirinden ayrıldı.
- [ ] PDF yükleme ve ön izleme alanları tanımlandı.
- [ ] Flip PDF için V1 talebi doğrulandı.
- [ ] Flip PDF için V2 talebi doğrulandı.
- [ ] Flip PDF için V3 talebi doğrulandı.
- [ ] Flip PDF için V4 talebi doğrulandı.
- [ ] Sunucu rol, sahiplik, araç ve varyant kararını yeniden doğruluyor.

### İçerik Üreticisi, Onay ve Yayın

- [ ] İçerik Üreticisi Flip PDF görevini mevcut görev yaşam döngüsünde alabiliyor.
- [ ] Nihai PDF ve gerekli metadata teslimi yapılabiliyor.
- [ ] Bozuk veya şifreli PDF sunucuda reddediliyor.
- [ ] Pozitif sayfa sayısı doğrulanıyor.
- [ ] Kapak ilk sayfadan veya ayrı dosyadan üretilebiliyor.
- [ ] PDF Bunny Storage'a yükleniyor ve CDN üzerinden yetkili sunuluyor.
- [ ] Üretici PDF'yi ön izleyip onaylayabiliyor veya revizyona gönderebiliyor.
- [ ] Onaylı PDF soru seti ve araç puanıyla Yayın Yönetimine ulaşabiliyor.
- [ ] Geçersiz veya okunamayan PDF'nin yayımlanması engelleniyor.

### Flip Deneyimi ve Tamamlanma

- [ ] PDF.js motoru dinamik olarak yükleniyor.
- [ ] Masaüstünde çift sayfa düzeni çalışıyor.
- [ ] Mobilde tek sayfa düzeni çalışıyor.
- [ ] Sayfa çevirme çalışıyor.
- [ ] Yakınlaştırma çalışıyor.
- [ ] Küçük sayfa ön izlemeleri çalışıyor.
- [ ] Tam ekran görünüm çalışıyor.
- [ ] Kullanıcı kaldığı sayfadan devam edebiliyor.
- [ ] Zorunlu sayfaların açılması izleniyor.
- [ ] Sayfa görünürken aktif okuma süresi kaydediliyor.
- [ ] Son sayfaya hızlı geçişin tamamlanma sayılması engelleniyor.
- [ ] Atlanan sayfanın sonradan tamamlanmasına izin veriliyor.
- [ ] Bütün sayfa koşulları tamamlanmadan soruların açılması engelleniyor.
- [ ] Oturum başlangıcındaki tamamlanma kuralı snapshot olarak saklanıyor.
- [ ] Aynı PDF tamamlaması iki kez puan yazmıyor.

### Rol, Puan, Rapor ve Canlı Doğrulama

- [ ] UTT/KD_UTT Flip PDF erişim, tamamlama ve puan davranışı doğrulandı.
- [ ] BM Flip PDF erişim, tamamlama ve puan davranışı doğrulandı.
- [ ] Eczacı Flip PDF erişim, tamamlama ve puan davranışı doğrulandı.
- [ ] Teknisyen Flip PDF erişim, tamamlama ve puan davranışı doğrulandı.
- [ ] Müşteri Flip PDF erişim, tamamlama ve puan davranışı doğrulandı.
- [ ] Öneri, challenge ve müşteri gönderimi bağları doğrulandı.
- [ ] Flip PDF puanı rapor ve lig toplamına doğru yansıyor.
- [ ] HBStore, E-Club Store ve Eczanem ödül/indirim etkisi doğrulandı.
- [ ] Flip PDF bildirimi, beğeni ve favori davranışı doğrulandı.
- [ ] Hapbi Flip PDF kaynağını okuyup doğru yayına yönlendirebiliyor.
- [ ] Beş tüketici rolünde canlı doğrulama tamamlandı.

### Faz 5 Çıkış Ölçütleri

- [ ] Flip PDF V1–V4 üretimden beş tüketici rolündeki ödül sonucuna kadar çalışıyor.
- [ ] Mobil bellek, büyük PDF ve ilk paket boyutu kontrolleri geçti.
- [ ] Video, podcast ve görsel regresyon kontrolleri geçti.
- [ ] Faz kapsamındaki kontroller tamamlandı.
- [ ] **Yapıldı** alanı `Evet` olarak güncellendi.
- [ ] Faz kapanış commit kapsamı hazırlandı.

---

## Faz 6 — Ortak Sistemlerin Birleştirilmesi ve Mutabakat

**Durum:** Bekliyor
**Yapıldı:** Hayır
**Teknik plan karşılığı:** Bölüm 10, 11 ve 12.5

### Rapor, Lig ve Ödül Ekonomisi

- [ ] Rapor kaynakları `arac_turu` kırılımını eksiksiz taşıyor.
- [ ] Araç türüne göre erişim ve tamamlanma raporlanabiliyor.
- [ ] Araç türüne göre doğru cevap ve puan başarısı raporlanabiliyor.
- [ ] Öneri, challenge ve dağıtım performansı araç türüne göre raporlanabiliyor.
- [ ] Aynı eğitim ailesindeki farklı araç yayınları ayrı sonuçlar üretiyor.
- [ ] Bütün araç puanları mevcut net lig puanına doğru katılıyor.
- [ ] HBStore FIFO/kasa ekonomisiyle mutabakat sağlandı.
- [ ] E-Club Store ekonomisiyle mutabakat sağlandı.
- [ ] Eczanem puan/TL ve indirim ekonomisiyle mutabakat sağlandı.

### Bildirim, Etkileşim ve Hapbi

- [ ] Sabit “video” dili araç türü veya “öğrenme yayını” diliyle güncellendi.
- [ ] Podcast, görsel ve Flip PDF bildirim bağlantıları doğru oynatıcıyı açıyor.
- [ ] Beğeni davranışı dört araçta tutarlı çalışıyor.
- [ ] Favori davranışı dört araçta tutarlı çalışıyor.
- [ ] Hapbi kaynağı araç türü, başlık ve tamamlanma durumunu taşıyor.
- [ ] Hapbi doğru cevap başarısını araç bazında okuyabiliyor.
- [ ] Hapbi role uygun ve çalışan yayın bağlantısı üretiyor.

### Yetki ve Sistem Mutabakatı

- [ ] UTT/KD_UTT rol sözleşmesi dört araçta tutarlı çalışıyor.
- [ ] BM rol sözleşmesi dört araçta tutarlı çalışıyor.
- [ ] Eczacı rol sözleşmesi dört araçta tutarlı çalışıyor.
- [ ] Teknisyen rol sözleşmesi dört araçta tutarlı çalışıyor.
- [ ] Müşteri rol sözleşmesi dört araçta tutarlı çalışıyor.
- [ ] Başka firma, takım, bölge, eczane veya kullanıcı yayınına erişim engelleniyor.
- [ ] Süresi geçmiş ve pasif bağların puan/soru etkisi doğru uygulanıyor.
- [ ] Araçlardan biri kapatıldığında video ve diğer tamamlanmış araçlar etkilenmiyor.

### Faz 6 Çıkış Ölçütleri

- [ ] Dört öğrenme aracı ortak rapor, lig, ödül, bildirim ve Hapbi kaynaklarında tutarlı çalışıyor.
- [ ] Finansal/puan mutabakatında açık kayıt kalmadı.
- [ ] Yetki ve sahiplik kontrolleri geçti.
- [ ] Faz kapsamındaki kontroller tamamlandı.
- [ ] **Yapıldı** alanı `Evet` olarak güncellendi.
- [ ] Faz kapanış commit kapsamı hazırlandı.

---

## Faz 7 — Nihai Regresyon, Kabul ve Dokümantasyon

**Durum:** Bekliyor
**Yapıldı:** Hayır
**Teknik plan karşılığı:** Bölüm 13

### Üretim Kabul Matrisi

- [ ] Podcast V1–V4 olmak üzere dört üretim senaryosu geçti.
- [ ] Görsel V1–V4 olmak üzere dört üretim senaryosu geçti.
- [ ] Flip PDF V1–V4 olmak üzere dört üretim senaryosu geçti.
- [ ] On iki senaryoda doğru ilk görev ve İçerik Üreticisi ataması doğrulandı.
- [ ] On iki senaryoda hazır araç ve hazır soru ayrımı doğrulandı.
- [ ] On iki senaryoda onay, revizyon, Yayın Yönetimine geçiş ve sahiplik doğrulandı.

### Tüketim Kabul Matrisi

- [ ] Podcast beş tüketici rolünde kabul edildi.
- [ ] Görsel beş tüketici rolünde kabul edildi.
- [ ] Flip PDF beş tüketici rolünde kabul edildi.
- [ ] Öneri, challenge ve müşteri gönderimi sınır senaryoları geçti.
- [ ] Süre aşımı, yarım bırakma ve kaldığı yerden devam senaryoları geçti.
- [ ] Tekrar, yanlış cevap ve extra puan senaryoları geçti.
- [ ] Aktif üyelik, pasif bağ ve mükerrer tamamlama senaryoları geçti.

### Regresyon, Performans ve Deployment

- [ ] Mevcut video testlerinin tamamı geçti.
- [ ] Eski video yayınları davranış değişmeden açılıyor.
- [ ] Aynı tamamlama iki kez puan yazmıyor.
- [ ] Yetkisiz kurum ve kullanıcı erişim testleri geçti.
- [ ] Puanlar rapor, lig ve ödül bakiyelerine doğru yansıyor.
- [ ] Medya dosyaları Vercel deployment boyutuna girmiyor.
- [ ] PDF motoru ilk sayfa paketini gereksiz büyütmüyor.
- [ ] Mobil podcast arka plan davranışı kabul edildi.
- [ ] Mobil PDF bellek tüketimi kabul edildi.
- [ ] Büyük görsel yükleme performansı kabul edildi.
- [ ] Üretim deployment'ı başarıyla tamamlandı.

### Dokümantasyon ve Proje Kapanışı

- [ ] Bluebook üretim süreci üç yeni aracı kapsayacak biçimde güncellendi.
- [ ] Bluebook tüketim süreci üç yeni aracı ve beş rolü kapsayacak biçimde güncellendi.
- [ ] Veri modeli, Bunny depolama ve erişim sözleşmeleri dokümante edildi.
- [ ] Operasyon, hata izleme ve geri dönüş adımları dokümante edildi.
- [ ] Ayrıntılı teknik plan ile gerçekleşen uygulama arasındaki farklar kaydedildi.
- [ ] Bütün fazların durum ve Yapıldı alanları tamamlandı.

### Faz 7 Çıkış Ölçütleri

- [ ] Proje kabul ölçütlerinin tamamı karşılandı.
- [ ] Açık kritik veya yüksek öncelikli hata kalmadı.
- [ ] Podcast, görsel ve Flip PDF canlı kullanıma hazırlandı.
- [ ] Mevcut video sistemi kesintisiz çalışıyor.
- [ ] Faz kapsamındaki kontroller tamamlandı.
- [ ] **Yapıldı** alanı `Evet` olarak güncellendi.
- [ ] Faz kapanış commit kapsamı hazırlandı.

---

## Proje Kabulü

Proje; Podcast, Görsel ve Flip PDF araçlarının V1–V4 üretim, onay, yayın, UTT/KD_UTT, BM, eczacı, teknisyen ve müşteri tüketimi, soru, puan, rapor, lig ve ödül zincirlerinde doğrulanmasıyla tamamlanır. Mevcut video sistemi aynı kontroller altında kesintisiz çalışmaya devam etmelidir.

**Proje yapıldı:** Hayır
**Son kabul tarihi:** —
**Son kabul commit'i:** —
