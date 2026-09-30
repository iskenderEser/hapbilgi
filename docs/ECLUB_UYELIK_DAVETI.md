# E-Club üyelik daveti

UTT yeni kişiye şifre atamaz. Yeni/Auth bağı eksik kişi şifresiz, e-postası doğrulanmamış ve Auth girişine kapalı oluşturulur. Mevcut hazır hesaplara şifre/davet müdahalesi yapılmaz. Eczanem müşterisinin mevcut kontrollü geçişi korunur.

## Kurulum

`scripts/sql/eclub_uyelik_daveti.sql` Supabase'e uygulanır. 29 Eylül 2026 oturumunda tablo, kişi provizyon tetikleyicisi ve üç RPC doğrudan kurulmuştur. Eski üyelerde güncelleme yapılmamıştır.

Yerel `.env.local` ve Vercel ortamında:

- `RESEND_API_KEY`: Resend anahtarı. Kaynak koda/sohbete eklenmez.
- `ECLUB_DAVET_EMAIL_FROM`: Resend'de doğrulanmış gönderici; boşsa `ECLUB_CEK_EMAIL_FROM` kullanılır.
- `HAPBILGI_SITE_URL`: Üretimin HTTPS kök adresi. Üretimde zorunlu; geliştirmede mevcut localhost adresi kullanılabilir.

Bu oturumda yerel Resend ayarları bulunmadığı için gerçek e-posta teslimatı doğrulanmamıştır. Ayarlar yoksa kişi kaydı korunur, kişi satırında gönderim bekliyor durumu ve yeniden gönderme işlemi görünür.

## Akış

1. UTT kişi bilgilerini kaydeder. DB provizyonuyla aynı transaction'da bekleyen davet satırı oluşur.
2. 256 bit rastgele bağlantı üretilir; yalnız SHA-256 özeti DB'de tutulur. E-posta doğrudan Resend'e gönderilir. Link UTT/API yanıtına verilmez.
3. `/sifre-olustur?token=…` ortak iki şifre alanlı kartı açar; GET/önizleme daveti tüketmez. URL tarayıcı geçmişinden temizlenir; Referrer gönderilmez.
4. Kaydet, şifreyi iki kez doğrular (6–128 karakter). Service-role RPC, süresi dolmamış token için tek işlem kilidi alır. Pasife alınmış üyelik ve değişen e-posta reddedilir.
5. Şifre, e-posta doğrulaması ve Auth giriş kilidinin kaldırılması aynı Auth güncellemesinde yapılır. Davet tamamlanır. Davet tarayıcıda Auth oturumu üretmez; başarılı kayıtta mevcut tarayıcı oturumu temizlenir ve `/login` açılır.
6. Üye e-posta veya mevcut telefon giriş mekanizmasıyla kendi şifresini kullanır.

Davet 24 saat geçerlidir. Yeniden gönderme eski bağlantıyı geçersiz kılar. Başarılı gönderimden sonra 60 saniye beklenir. Kaydediliyor durumunda yeni davet üretilmez. Gönderim kesintisi kişi kaydını geri almaz. Gönderim otomatik cron kuyruğu kullanmaz; UTT yeniden gönderir.

Auth ve uygulama DB'si ortak transaction paylaşmaz. Auth başarısızsa kilit bırakılır ve aynı davet yeniden denenebilir. Auth başarılı fakat DB sonlandırması başarısızsa 2 dakikalık lease sonrası tekrar deneme DB'yi tamamlar; şifre ikinci kez yazılmaz. Tamamlanan davet tekrar kullanılamaz.

## Kontroller

- `node --import ./tests/_alias.mjs --test tests/eclubUyelikDaveti.hedef.test.ts`
- `HAPBILGI_PGLITE_ROOT=/tmp/hapbilgi-odul-pgtest node tests/eclubUyelikDaveti.postgres.mjs`
- `npm run test:eclub`
- `npm run typecheck:build`

Çek teslimatı davetten bağımsızdır: çek e-postası eczacıya, uygulama/push bildirimi aktif eczane kadrosuna gider. Bu değişiklik o dağıtım işlevlerini değiştirmez; mevcut PostgreSQL çek teslimatı testinde eczacı e-postası ve kadro bildirim alıcıları ayrıca doğrulanır. Bu oturumda gerçek çek e-postası/push gönderimi yapılmamıştır.
