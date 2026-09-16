# Vercel Git Entegrasyonu

## 15–16 Eylül 2026 olayı

Vercel, `main` dalına gönderilen yeni commitler için otomatik deployment oluşturmuyordu. GitHub App izinleri ve Vercel proje bağlantısı kontrol edilip yeniden kurulmasına rağmen yeni push’lar deployment başlatmadı.

### Kök neden

Projede Vercel Hobby planının kabul etmediği iki sık cron tanımı bulunuyordu:

- Podcast transkript kuyruğu: her dakika
- E-Club çek e-posta kuyruğu: her beş dakika

Son otomatik Git deployment, bu cronlar eklenmeden önceki `69fe370` commitiydi. Vercel’de 12 Eylül tarihli görünen iki kayıt yeni Git deployment’ı değil, aynı commitin manuel yeniden dağıtımlarıydı. Cron tanımları kaldırılıp kuyruklar Supabase Cron’a taşındıktan sonra `88a6c85` commitinin Git push’u otomatik olarak Production deployment oluşturdu ve başarıyla tamamlandı. Bu davranış kök nedeni doğruladı.

### Güncel yapı

- GitHub `main` push’ları Vercel Production deployment’ını otomatik başlatır.
- Kuyruk zamanlamaları Vercel tarafından değil, Supabase `pg_cron` tarafından yürütülür.
- Supabase `pg_net`, uygulamadaki korumalı cron route’larını çağırır.
- Supabase Vault ve Vercel Production ortamında aynı `CRON_SECRET` kullanılır.
- Podcast kuyruğu her dakika, E-Club çek e-posta kuyruğu her beş dakika tetiklenir.

Deploy Hook normal GitHub push deployment’ları için gerekli değildir. GitHub App izinlerinin kabul edilmesi ve bağlantının yeniden kurulması doğru bakım adımlarıydı; ancak bu olayda deployment kesintisinin nedeni değildi.
