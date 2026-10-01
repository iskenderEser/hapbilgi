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
