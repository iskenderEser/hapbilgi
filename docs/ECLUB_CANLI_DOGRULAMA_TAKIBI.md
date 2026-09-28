# E-Club Canlı Doğrulama Takibi

Faz 3B ve 3C için kod, SQL ve hedef test doğrulaması tamamlanmıştır. Gerçek dış servis doğrulaması, geliştirme fazlarını bölmemek için Faz 6'ya ertelenmiştir.

- [ ] Vercel Production ortamında ana eczacıya gerçek çek e-postası teslimini doğrula.
- [ ] Aynı eczanedeki bütün aktif E-Club çalışanlarının aktif aboneliklerine gerçek push teslimini doğrula.
- [ ] E-posta ve bütün push işleri tamamlanmadan çek talebinin `cek_kodlari_gonderildi` durumuna geçmediğini doğrula.
- [ ] Başarısız teslimatın outbox durumunda ve firma takip tablosunda görünür olduğunu doğrula.

Bu maddeler başarıyla tamamlanmadan Faz 6 tamamlanmış sayılmaz.
