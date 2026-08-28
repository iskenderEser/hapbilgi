# Öğrenme Araçları Genişletmesi – Tamamlama Faz Planı

Bu plan mevcut geliştirmeyi yeniden tasarlamaz. Yapılmış kodu düzelterek Podcast, Görsel ve Flip PDF zincirlerini proje planındaki seviyeye getirir.

## Çalışma ve Onay Kuralları

- [ ] Her geliştirme adımı tamamlandığında yalnız ilgili kutu `[x]` olarak işaretlenecek.
- [ ] Bir fazın bütün geliştirme adımları bitmeden faz hedef testlerine geçilmeyecek.
- [ ] Her fazın hedef testleri yalnız kullanıcının açık onayıyla başlatılacak.
- [ ] Smoke testler geliştirme sonunda ve yalnız kullanıcının açık onayıyla başlatılacak.
- [ ] Testlerden sonra commit yalnız kullanıcının açık onayıyla oluşturulacak.
- [ ] Push yalnız kullanıcının açık onayıyla yapılacak.
- [ ] Dış sistem bağlantıları yalnız kullanıcının açık talimatıyla gerçekleştirilecek.

## Faz 1 — Derleme ve Kod Sağlığı

**Amaç:** Kodun production build alabilecek teknik seviyeye gelmesi.

### Adımlar

- [x] Öğrenme aracı erişim API’sindeki null güvenliği hataları giderilecek.
- [x] PDF.js yaşam döngüsü mevcut `pdfjs-dist` sürümüne uygun düzeltilecek.
- [x] Yeni öğrenme aracı dosyalarındaki TypeScript tipleri ortak modellerle uyumlu hale getirilecek.
- [x] Yeni RPC’ler repo şema kaydına eklenecek veya şema kaydı güncellenecek.
- [x] Yoğun biçimde tek satıra yazılmış oynatıcı ve API kodları okunabilir hale getirilecek.
- [x] Sabit kalmış `video` adlandırmalarından yalnız teknik olarak değiştirilmesi gerekenler `ogrenme_araci` diline taşınacak.

- [x] **Faz çıkış koşulu:** Yeni kodda bilinen TypeScript, ESLint ve mimari sözleşme hatası kalmaması.


### Faz Kapanış Kontrolleri

- [x] Faz 1 hedef test sayısının 0 olduğu doğrulandı.
- [x] Faz 1 için çalıştırılacak hedef test bulunmadığı kaydedildi.
- [x] Smoke test kapsamının proje sonuna ertelenmesi kullanıcı tarafından onaylandı.
- [ ] Proje sonu smoke testleri kullanıcı onayıyla tamamlandı.
- [x] Commit için kullanıcı onayı alındı.
- [x] Kullanıcının onayladığı commit oluşturuldu.
- [ ] Push için kullanıcı onayı alındı.
- [ ] Kullanıcının onayladığı push tamamlandı.

---

## Faz 2 — Bunny Yükleme Güvenliği ve Dosya Bütünlüğü

**Amaç:** Yüklenen dosyanın gerçekten kullanıcının seçtiği dosya olduğunu güvenilir biçimde doğrulamak.

### Adımlar

- [x] Bunny checksum değeri bulunmadığında dosya Bunny tarafından doğrulanmış kabul edilmeyecek.
- [x] `checksum_bunny_tarafindan_dogrulandi` yalnız gerçek karşılaştırma yapıldığında `true` olacak.
- [x] Bunny checksum başlığı yoksa Edge’in Bunny kabulünden sonra ürettiği imzalı yükleme makbuzu kullanılacak.
- [x] Dosya boyutu, dosya imzası, MIME türü ve checksum kontrollerinin sonuçları ayrı metadata alanlarında tutulacak.
- [x] Eksik veya çelişkili doğrulamada araç `dogrulama_bekliyor` durumundan ilerlemeyecek.
- [x] Başarısız yüklemelerde Bunny’de kalan sahipsiz dosyaların temizlenmesi için kayıt yapısı hazırlanacak.
- [x] Yükleme tokenının kullanıcı, araç, dosya yolu, boyut, MIME ve süre bilgisine bağlı olması korunacak.
- [x] Aynı yükleme tamamlama isteğinin tekrar gönderilmesi idempotent çalışacak.

- [x] **Faz çıkış koşulu:** Doğrulanmamış veya değiştirilmiş dosya üretim zincirine giremeyecek.


### Faz Kapanış Kontrolleri

- [x] Faz 2 hedef test sayısının 0 olduğu doğrulandı.
- [x] Faz 2 için çalıştırılacak hedef test bulunmadığı kaydedildi.
- [x] Faz 2 smoke testleri proje sonuna ertelendi.
- [ ] Proje sonu smoke testleri kullanıcı onayıyla tamamlandı.
- [x] Commit için kullanıcı onayı alındı.
- [x] Kullanıcının onayladığı commit oluşturuldu.
- [ ] Push için kullanıcı onayı alındı.
- [ ] Kullanıcının onayladığı push tamamlandı.

---

## Faz 3 — Tarayıcı ve Mobil Dosya Performansı

**Amaç:** Büyük PDF ve podcast dosyalarının mobil cihazlarda donma veya bellek taşmasına neden olmasını önlemek.

### Adımlar

- [x] Dosyanın tamamını `arrayBuffer()` ile belleğe alan checksum yöntemi kaldırılacak.
- [x] Podcast ve büyük dosyalar parça bazlı işlenecek.
- [x] PDF’nin checksum ve içerik okuma işlemlerinde aynı dosyanın tekrar tekrar belleğe alınması önlenecek.
- [x] PDF sayfa ve metin çıkarımı kontrollü yapılacak.
- [x] Metin çıkarımı başarısız olsa bile geçerli PDF için anlaşılır hata durumu üretilecek.
- [x] Çok büyük, şifreli veya bozuk PDF yükleme başlamadan mümkün olan en erken noktada reddedilecek.
- [x] Yükleme ilerlemesi, iptal ve tekrar deneme davranışları ortaklaştırılacak.
- [x] Sayfa kapanırken çalışan PDF, ses ve yükleme görevleri temizlenecek.

- [x] **Faz çıkış koşulu:** Desteklenen üst sınırlardaki dosyalar tarayıcıyı kilitlemeden yüklenebilecek.


### Faz Kapanış Kontrolleri

- [x] Hedef testlerin başlatılması için kullanıcı onayı alındı.
- [x] Kullanıcının onayladığı hedef testler tamamlandı.
- [ ] Smoke test kapsamı proje sonu paketine eklendi.
- [ ] Proje sonu smoke testleri kullanıcı onayıyla tamamlandı.
- [ ] Commit için kullanıcı onayı alındı.
- [ ] Kullanıcının onayladığı commit oluşturuldu.
- [ ] Push için kullanıcı onayı alındı.
- [ ] Kullanıcının onayladığı push tamamlandı.

---

## Faz 4 — Üretim Hattının Tamamlanması

**Amaç:** V1–V4 üretim varyantlarında üç yeni aracın mevcut video üretim zinciriyle aynı kuralları izlemesi.

### Adımlar

- [x] Podcast için hazır araç/hazır soru kombinasyonları tamamlanacak.
- [x] Podcast için İçerik Üreticisi araç üretimi ve soru üretimi görevleri tamamlanacak.
- [x] Görsel için aynı dört üretim varyantı tamamlanacak.
- [x] Flip PDF için aynı dört üretim varyantı tamamlanacak.
- [x] `hazir_video` gibi eski DB alanları değiştirilmeden ortak araç anlamına bağlanacak.
- [x] Senaryo gerektiren ve gerektirmeyen araç davranışları açık biçimde ayrılacak.
- [x] İçerik Üreticisi görevlerinde araç kimliği ve talep kimliği birlikte doğrulanacak.
- [x] Üretici onay, revizyon ve iptal kararları her araç için aynı revizyon sınırlarını uygulayacak.
- [x] Onaylanan araç doğru soru seti ve araç puanıyla Yayın Yönetimine aktarılacak.
- [x] Yeni RPC migration dosyaları kullanıcıya çalıştırılmak üzere ayrı ayrı teslim edilecek.

- [x] **Faz çıkış koşulu:** Podcast, Görsel ve Flip PDF’nin on iki üretim senaryosu kod seviyesinde eksiksiz bulunacak.


### Faz Kapanış Kontrolleri

- [x] Hedef testlerin başlatılması için kullanıcı onayı alındı.
- [x] Kullanıcının onayladığı hedef testler tamamlandı.
- [ ] Smoke test kapsamı proje sonu paketine eklendi.
- [ ] Proje sonu smoke testleri kullanıcı onayıyla tamamlandı.
- [ ] Commit için kullanıcı onayı alındı.
- [ ] Kullanıcının onayladığı commit oluşturuldu.
- [ ] Push için kullanıcı onayı alındı.
- [ ] Kullanıcının onayladığı push tamamlandı.

---

## Faz 5 — Tüketim, Oynatıcı ve Yetki Zinciri

**Amaç:** Beş tüketici rolünün yalnız yetkili olduğu öğrenme aracını doğru bağlamda kullanması.

### Adımlar

- [x] UTT/KD_UTT erişimi firma, takım, hedef rol ve öneri bağında doğrulanacak.
- [x] BM erişimi firma, challenge sahibi ve challenge kaydı üzerinden doğrulanacak.
- [x] Eczacı ve teknisyen erişimi E-Club kişi, firma, hedef rol ve öneri süresi üzerinden doğrulanacak.
- [x] Müşteri erişimi aktif üyelik ve gönderim kimliği üzerinden doğrulanacak.
- [x] Eczanem bağlantılarına yalnız `yayin_id` değil, kesin `gonderim_id` eklenecek.
- [x] Aynı yayın birden fazla gönderimde varsa doğru gönderim açılacak.
- [x] Podcast ileri sarma, tamamlanma ve soru açılma kuralları role göre uygulanacak.
- [x] Görselin tamamlanma şartı ve görüntüleme kanıtı ortaklaştırılacak.
- [x] Flip PDF yakınlaştırma, sayfa ilerleme ve tamamlanma şartı uygulanacak.
- [x] Süresi dolmuş öneri veya pasif üyelik üzerinden soru ve puan üretilemeyecek.
- [x] Devre dışı bırakılan araç formda ve tüketim yüzeylerinde gösterilmeyecek.
- [x] Video davranışına dokunulmadığı kontrol edilecek.

- [x] **Faz çıkış koşulu:** Her rol yalnız kendisine ait aktif kayıt üzerinden aracı açabilecek ve tamamlayabilecek.


### Faz Kapanış Kontrolleri

- [x] Hedef testlerin başlatılması için kullanıcı onayı alındı.
- [x] Kullanıcının onayladığı hedef testler tamamlandı.
- [ ] Smoke test kapsamı proje sonu paketine eklendi.
- [ ] Proje sonu smoke testleri kullanıcı onayıyla tamamlandı.
- [ ] Commit için kullanıcı onayı alındı.
- [ ] Kullanıcının onayladığı commit oluşturuldu.
- [ ] Push için kullanıcı onayı alındı.
- [ ] Kullanıcının onayladığı push tamamlandı.

---

## Faz 6 — Puan, Lig ve Mağaza Ekonomisi

**Amaç:** Her öğrenme aracının bağımsız öğrenme ve kazanım fırsatı olması.

### Adımlar

- [x] Her `yayin_id` bağımsız puan fırsatı olarak korunacak.
- [x] Aynı içeriğin farklı araçlarla yayımlanması ayrı yayın ve ayrı puan oluşturacak.
- [x] Aynı yayın tamamlamasının iki kez puan yazması engellenecek.
- [x] İzleme/tamamlama puanı araç türünden bağımsız ortak kaynağa yazılacak.
- [x] Doğru cevap, yanlış cevap, tekrar ve extra puan kuralları bütün araçlarda korunacak.
- [x] UTT ve BM net lig puanlarına yeni araç puanları katılacak.
- [x] HBStore FIFO/kasa bakiyesiyle puan kayıtları karşılaştırılacak.
- [x] E-Club Store firma bakiyesiyle öğrenme puanları karşılaştırılacak.
- [x] Eczanem puan/TL ve indirim kayıtları gönderim bağında karşılaştırılacak.
- [x] İptal, tekrar veya başarısız işlem sonrasında açık finansal kayıt kalması önlenecek.
- [x] Mutabakat için salt okunur SQL sorguları hazırlanarak kullanıcıya teslim edilecek.

- [x] **Faz çıkış koşulu:** Kazanılan puan ile lig ve mağaza bakiyeleri arasında açıklanamayan fark kalmaması.


### Faz Kapanış Kontrolleri

- [x] Hedef testlerin başlatılması için kullanıcı onayı alındı.
- [x] Kullanıcının onayladığı hedef testler tamamlandı.
- [ ] Smoke test kapsamı proje sonu paketine eklendi.
- [ ] Proje sonu smoke testleri kullanıcı onayıyla tamamlandı.
- [ ] Commit için kullanıcı onayı alındı.
- [ ] Kullanıcının onayladığı commit oluşturuldu.
- [ ] Push için kullanıcı onayı alındı.
- [ ] Kullanıcının onayladığı push tamamlandı.

---

## Faz 7 — Raporlama

**Amaç:** Araç türlerinin gerçek performansını mevcut rapor sayfalarında göstermek.

### Adımlar

- [x] Rapor kaynağına araç bazında yayın sayısı eklenecek.
- [x] Başlatma ve tamamlama sayıları rol ve araç türüne göre ayrılacak.
- [x] Doğru ve yanlış cevap sayıları eklenecek.
- [x] Doğru cevap yüzdesi sıfır cevap durumunu yanlış başarı olarak göstermeyecek.
- [x] Gerçekte kazanılan ve kaybedilen puanlar araç türüne göre eklenecek.
- [x] Öneri performansı araç türüne göre raporlanacak.
- [x] Challenge performansı araç türüne göre raporlanacak.
- [x] E-Club ve Eczanem dağıtım performansı araç türüne göre raporlanacak.
- [x] Aynı eğitim ailesindeki farklı araç yayınları ayrı sonuçlar olarak gösterilecek.
- [x] Kayıtlı araç puanı ile kazanılmış puan birbirinden açıkça ayrılacak.
- [x] Rapor API’leri ortak veri yapısını kullanacak.

- [x] **Faz çıkış koşulu:** Faz 6 checklist’indeki tüm rapor maddelerini karşılayan veri üretilecek.


### Faz Kapanış Kontrolleri

- [x] Hedef testlerin başlatılması için kullanıcı onayı alındı.
- [x] Kullanıcının onayladığı hedef testler tamamlandı.
- [ ] Smoke test kapsamı proje sonu paketine eklendi.
- [ ] Proje sonu smoke testleri kullanıcı onayıyla tamamlandı.
- [ ] Commit için kullanıcı onayı alındı.
- [ ] Kullanıcının onayladığı commit oluşturuldu.
- [ ] Push için kullanıcı onayı alındı.
- [ ] Kullanıcının onayladığı push tamamlandı.

---

## Faz 8 — Hapbi, Bildirim ve Etkileşim

**Amaç:** Hapbi’nin yeni araçları doğru anlaması ve bildirimlerin doğru içeriği açması.

### Adımlar

- [x] Hapbi kaynağı araç türünü, yayını, başlığı ve tamamlanma durumunu taşıyacak.
- [x] Podcast için doğrulanmış transkript öncelikli bilgi kaynağı olacak.
- [x] Flip PDF için doğrulanmış arama metni kullanılacak.
- [x] Görsel için tanımlı açıklama ve eğitim metni kullanılacak.
- [x] Hapbi doğru/yanlış sayılarını yayın turuna veya öneri kaydına göre ayıracak.
- [x] E-Club tekrar önerilerindeki cevap kayıtlarının birbirine karışması engellenecek.
- [x] Hapbi her rol için çalışan ve yetkili bağlantı üretecek.
- [x] UTT bildirimi doğru yayın/öneriyi açacak.
- [x] BM bildirimi doğru challenge kaydını açacak.
- [x] E-Club bildirimi doğru öneriyi açacak.
- [x] Eczanem bildirimi kesin gönderim kimliğini açacak.
- [x] Beğeni ve favori davranışı dört araçta ortaklaştırılacak.
- [x] Kullanıcıya gösterilen sabit “video” ifadeleri “öğrenme içeriği” diline çevrilecek.

- [x] **Faz çıkış koşulu:** Hapbi yanlış araç, yanlış dönem veya yanlış kullanıcı bağlamı üretmeyecek.


### Faz Kapanış Kontrolleri

- [x] Hedef testlerin başlatılması için kullanıcı onayı alındı.
- [x] Kullanıcının onayladığı hedef testler tamamlandı.
- [ ] Smoke test kapsamı proje sonu paketine eklendi.
- [ ] Proje sonu smoke testleri kullanıcı onayıyla tamamlandı.
- [ ] Commit için kullanıcı onayı alındı.
- [ ] Kullanıcının onayladığı commit oluşturuldu.
- [ ] Push için kullanıcı onayı alındı.
- [ ] Kullanıcının onayladığı push tamamlandı.

---

## Faz 9 — Son Doğrulama ve Proje Kapanışı

Bu faz, önceki fazlarda alınan test sonuçları ve kullanıcı onayları korunarak projenin genel kapanışını tamamlar.

### Adımlar

- [x] Production typecheck çalıştırılacak (başarılı).
- [x] Kullanıcı onayıyla tek kapanış commit’i oluşturulacak.
- [ ] Push için ayrıca kullanıcı talimatı beklenecek.

Bu sıralamada ilk yapılması gereken alan **Faz 1: Derleme ve Kod Sağlığıdır**.
