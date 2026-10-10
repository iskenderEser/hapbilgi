# E-Club Canlı Doğrulama Takibi

Faz 3B ve 3C için kod, SQL ve hedef test doğrulaması tamamlanmıştır. Faz 6 otomatik E-Club regresyonu 28 Eylül 2026 tarihinde hatasız tamamlanmıştır (`5571c7d`). Gerçek Resend ve web push teslimatı ise HapBilgi canlı olmadığı ve gerçek kullanıcı barındırmadığı için kullanıcının kararıyla geliştirme fazlarından ayrılmış, canlıya çıkış öncesi operasyon kapısı olarak bırakılmıştır.

Bu liste otomatik Faz 6 sonucunu geçersiz kılmaz; Production ortam değişkenleri ve kontrollü gerçek alıcı hazır olduğunda uygulanacak dış servis doğrulamasıdır.

- [ ] Vercel Production ortamında ana eczacıya gerçek çek e-postası teslimini doğrula.
- [ ] Aynı eczanedeki bütün aktif E-Club çalışanlarının aktif aboneliklerine gerçek push teslimini doğrula.
- [ ] E-posta ve bütün push işleri tamamlanmadan çek talebinin `cek_kodlari_gonderildi` durumuna geçmediğini doğrula.
- [ ] Başarısız teslimatın outbox durumunda ve firma takip tablosunda görünür olduğunu doğrula.

Bu maddeler başarıyla tamamlanmadan E-Club çek teslimatı canlı kullanıma açılmaz. Uygulama sırası ve hata yönetimi `ECLUB_CEK_OPERASYON_REHBERI.md` belgesindedir.

## Hediye Takibi uçtan uca testi

**Durum:** BEKLEMEDE — kullanıcı kararıyla fiziksel test şimdilik park edildi (1 Ekim 2026).

**Hatırlatma:** Hediye Takibi uçtan uca testleri yapılacak.

Sipariş Takibi ekranı, UTT sipariş onayı ve ilgili SQL kurulumu hazırlanmıştır. Veritabanı kontrolünde `siparis_verildi_mi = true` olan çek talebi bulunmadığı için canlı liste ve onay işlemi henüz gerçek bir kayıtla doğrulanamamıştır. Kod ve hedef testlerin geçmesi, bu uçtan uca testin yerine geçmez.

Fiziksel test için iki hazırlık gerekir: test ortamında iki aylık kazanım/talep dönemini güvenli ve yalnız test kapsamıyla aşabilmek; düşük puan eşiği olan Çekli Puan yayınını üretim hattından açıp tek tamamlamayla çek hakkı oluşturabilmek. Bu sınırlar şimdilik değiştirilmez. Üretim davranışı test kolaylığı için kalıcı biçimde gevşetilmez.

Tamamlanma kapıları:

- [ ] Kontrollü test ortamında satış şartlı sipariş ve isteğe bağlı sipariş için ana eczacıdan gerçek uygulama akışıyla çek talebi oluşturulur.
- [ ] İlgili UTT'nin Sipariş Takibi ekranında eczane, ürün, dönem, satış koşulu, adet + mal fazlası, çek tutarı ve depo tercihi doğrulanır.
- [ ] UTT siparişi onaylar; onay zamanı kalıcı kayda yazılır, yenilemeden sonra görünür ve ikinci onay engellenir.
- [ ] Siparişsiz çek ve sipariş verilmemiş isteğe bağlı çek, Sipariş Takibi listesine girmez; Çek Takibi davranışı bozulmaz.

Bu maddeler gerçek uygulama ve veritabanı akışında doğrulanmadan durum `TAMAMLANDI` yapılmaz. Testi yeniden başlatmak ve test ortamındaki zaman sınırı yöntemini seçmek için kullanıcıdan açık talimat beklenir.

## Hediye Çeki kartları — geçici görünüm verisi

**Durum:** Test verisi eklendi; kartlar Chrome'da doğrulandı. Temizlik bekliyor (9 Ekim 2026).

Kapsam, Adil Güçlü'nün `1110000000003` GLN'li Test Eczanesi 003 hesabında kart tasarımını gerçek veri okumasıyla çalışmaktır. Abilon için 100, Laropen için 300, Forma XL için 650 örnek puan hazırlanmıştır. Yalnız üç işaretli izleme ve üç sabit UUID'li puan kaydı eklenir. Üretim hattı, gönderim, gerçek tüketim, sipariş, onay, çek teslimatı ve iki aylık takvim sınırları bu çalışma kapsamında test edilmez. Çek talep butonları ve uygulamanın talep API'si bu örnek kayıtlar için kapalıdır.

- Ekleme: `scripts/sql/eclub_cek_karti_test_verisi_ekle.sql`.
- Temizlik: `scripts/sql/eclub_cek_karti_test_verisi_temizle.sql`.
- Kimlikler: `lib/eclub/store/gorunumTesti.ts` içindeki `e120...101–103` puan kayıtları; `e120...001–003` izleme kayıtları.
- Sayfanın okuma fonksiyonunda yanlış `k.urun_adi` referansı varsa ekleme SQL'i bunu `urunler` bağıyla düzeltir; bu hata düzeltmesi temizlikte geri alınmaz.
- Kayıtlar kullanıcı açıkça temizlik istediğinde silinecek. Temizlik sonucu kullanıcı tarafından doğrulanmadan silinmiş sayılmayacak.
- Önceki Hediye Takibi (`e110...`) test kayıtları bu iki SQL'in kapsamı dışındadır ve korunur.

Bu görünüm çalışması Hediye Takibi uçtan uca testinin yerine geçmez; onun durumu `BEKLEMEDE` kalır.

**Doğrulama — 9 Ekim 2026:** Kullanıcı SQL sonucunda Abilon 100, Laropen 300 ve Forma XL 650 puanı `2026-P4` döneminde doğruladı. Sayfa yenilendiğinde üç test kartı ve salt okunur etiketleri göründü; Laropen ve Forma XL talep butonları pasif, Abilon ise puan eşiğinin altında. Ekranın toplam puanı 1.050. Henüz düzeltilmeyen mevcut gösterimler: puanı sıfır olan diğer yayınlar da listeleniyor; Abilon'da 200 puan eşiği sağlanmadığı hâlde 20 TL çek tutarı gösteriliyor. Görünüm düzenlemesinde bu iki konu ele alınacak. Test verileri silinmedi.
