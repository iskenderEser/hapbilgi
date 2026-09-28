# E-Club Canlı Doğrulama Takibi

Faz 3B ve 3C için kod, SQL ve hedef test doğrulaması tamamlanmıştır. Faz 6 otomatik E-Club regresyonu 28 Eylül 2026 tarihinde hatasız tamamlanmıştır (`5571c7d`). Gerçek Resend ve web push teslimatı ise HapBilgi canlı olmadığı ve gerçek kullanıcı barındırmadığı için kullanıcının kararıyla geliştirme fazlarından ayrılmış, canlıya çıkış öncesi operasyon kapısı olarak bırakılmıştır.

Bu liste otomatik Faz 6 sonucunu geçersiz kılmaz; Production ortam değişkenleri ve kontrollü gerçek alıcı hazır olduğunda uygulanacak dış servis doğrulamasıdır.

- [ ] Vercel Production ortamında ana eczacıya gerçek çek e-postası teslimini doğrula.
- [ ] Aynı eczanedeki bütün aktif E-Club çalışanlarının aktif aboneliklerine gerçek push teslimini doğrula.
- [ ] E-posta ve bütün push işleri tamamlanmadan çek talebinin `cek_kodlari_gonderildi` durumuna geçmediğini doğrula.
- [ ] Başarısız teslimatın outbox durumunda ve firma takip tablosunda görünür olduğunu doğrula.

Bu maddeler başarıyla tamamlanmadan E-Club çek teslimatı canlı kullanıma açılmaz. Uygulama sırası ve hata yönetimi `ECLUB_CEK_OPERASYON_REHBERI.md` belgesindedir.
