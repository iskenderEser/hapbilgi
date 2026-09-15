# Vercel Git Entegrasyonu

## 15 Eylül 2026 olayı

Vercel, 12 Eylül 2026 sonrasındaki `main` push'ları için otomatik deployment oluşturmamıştı. GitHub üzerindeki Vercel GitHub App kurulumunda bekleyen izin güncellemesi bulundu.

Sorun şu adımlarla giderildi:

1. Vercel GitHub App için bekleyen yeni izinler GitHub'da kabul edildi.
2. Uygulamanın checks, commit statuses, deployments, repository hooks ve workflows erişimleri doğrulandı.
3. Vercel projesindeki `iskenderEser/hapbilgi` Git bağlantısı, izin güncellemesinden sonra yeniden kuruldu.
4. Gerçek dosya değişikliği içeren bu commit ile otomatik deployment tetikleyicisi doğrulandı.

Deploy Hook, normal GitHub push deployment'ları için gerekli değildir. Bu projede otomatik deployment, Vercel GitHub App entegrasyonu üzerinden çalışır.
