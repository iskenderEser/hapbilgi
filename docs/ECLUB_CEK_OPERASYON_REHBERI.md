# E-Club Hediye Çeki Operasyon Rehberi

Bu belge E-Club hediye çeki akışının kurulum, izleme, doğrulama ve hata yönetimi kaydıdır. HapBilgi henüz canlı değildir; gerçek kullanıcı ve nitelikli canlı veri bulunmamaktadır. Veritabanı SQL'leri yalnız proje sahibi tarafından çalıştırılır.

## 1. İş akışı

| Durum | Sorumlu | Sonraki işlem |
| --- | --- | --- |
| `beklemede` | UTT/KD_UTT | Kendi kapsamındaki talebi BM onayına gönderir. |
| `bm_onayinda` | BM | Kendi firma ve bölge kapsamındaki talebi TM son onayına gönderir. |
| `tm_onayinda` | TM | Kendi takım kapsamındaki talebe son onayı verir. |
| `onaylandi` | Admin | Çek kodunu girer; teslimat transaction'ını başlatır. |
| `teslimat_bekliyor` | Worker'lar | E-posta ve bütün push işlerini tamamlar. |
| `cek_kodlari_gonderildi` | Sistem | Bütün outbox işleri tamamlanmıştır. |
| `iptal` | Yetkili kullanıcı | Talep kapatılmıştır. |

Firma rolleri `/eclub/siparisler` tablosunda yalnız yetkili oldukları kapsamı görür. Aynı satırda talep, UTT/BM/TM zinciri, e-posta ve toplu push teslimat durumu izlenir. Admin kod işlemi `/admin/eclub-store` ekranındadır.

## 2. Teslimat sözleşmesi

- E-posta yalnız ilgili eczanenin tek aktif ana eczacısına gönderilir.
- Push, ilgili eczanede aktif çalışan ve HapBilgi hesabı bulunan bütün E-Club üyelerinin aktif cihaz aboneliklerine gönderilir.
- Uygulama içi bildirim aynı aktif çalışan grubuna yazılır; kullanıcı çek kodunu `Çek Taleplerim` ekranından görür.
- Push aboneliği bulunmaması ayrı bir çalışan türü değildir; ilgili hesabın henüz bildirim izni verilmiş aktif bir tarayıcı/cihaz kaydı olmadığı anlamına gelen teslimat hatasıdır.
- E-posta veya push işlerinden biri dahi tamamlanmamışsa talep tamamlandı sayılmaz.

## 3. Ortam değişkenleri

Vercel Production ortamında aşağıdaki değerler bulunmalıdır:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `ECLUB_CEK_EMAIL_FROM`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `CRON_SECRET`

`ECLUB_CEK_EMAIL_FROM`, Resend üzerinde doğrulanmış gönderici alan adı/adresi olmalıdır. Gizli değerler repoya veya bu belgeye yazılmaz. Supabase Vault içindeki `hapbilgi_cron_secret`, Vercel `CRON_SECRET` ile aynı olmalıdır.

## 4. SQL uygulama sırası

Aşağıdaki dosyalar proje sahibi tarafından Supabase SQL Editor'da sırayla ve her biri tek parça çalıştırılır:

1. `scripts/sql/eclub_puan_eczane_sabitleme.sql`
2. `scripts/sql/eclub_puan_yazma_fonksiyonlari_eczane.sql`
3. `scripts/sql/eclub_store_rapor_lig_eczane_snapshot.sql`
4. `scripts/sql/eclub_cek_talebi_ana_eczaci.sql`
5. `scripts/sql/eclub_fiziksel_store_kapatma.sql`
6. `scripts/sql/eclub_store_tm_son_onay.sql`
7. `scripts/sql/eclub_cek_teslimat_outbox.sql`
8. `scripts/sql/eclub_cek_eposta_worker.sql`
9. `scripts/sql/eclub_cek_push_worker.sql`
10. `scripts/sql/eclub_cek_uygulama_bildirimleri.sql`

Zamanlayıcı kurulumu veya yenilenmesi gerekiyorsa ortam değişkenleri ve Supabase Vault hazırlandıktan sonra `scripts/sql/kuyruk_cronlarini_supabase_tasima.sql` çalıştırılır. Bu iş her beş dakikada bir korumalı `/api/cron/eclub-cek-eposta` rotasını çağırır; rota adına rağmen e-posta ve push kuyruklarını birlikte tüketir.

## 5. Dağıtım ve canlıya çıkış kapısı

1. `npm run test:eclub` hatasız tamamlanır.
2. Vercel Production ortam değişkenleri doğrulanır.
3. Uygulama deploy edilir; SQL'ler proje sahibi tarafından uygulanır.
4. Kontrollü bir eczane, ana eczacı ve aktif çalışan test grubu hazırlanır.
5. Ana eczacı talep oluşturur; UTT, BM ve TM sırayla onaylar; admin çek kodunu girer.
6. Ana eczacı e-postayı, bütün aktif çalışanlar push ve uygulama içi bildirimi doğrular.
7. `/eclub/siparisler` tablosunda e-posta ve push durumları `Tamamlandı`, talep durumu `Çek Kodu Gönderildi` görülür.

Bu dış servis kontrolü tamamlanana kadar E-Club çek teslimatı canlı kullanıcıya açılmaz. Açık maddeler `docs/ECLUB_CANLI_DOGRULAMA_TAKIBI.md` içinde işaretlenir.

## 6. Hata yönetimi

- Outbox durumları `bekliyor`, `isleniyor`, `tamamlandi` ve `basarisiz` değerleridir.
- Başarısız iş artan bekleme süresiyle yeniden denenir; en fazla beş deneme yapılır ve bekleme süresi en fazla bir saattir.
- E-posta hatasında önce Resend anahtarı, doğrulanmış gönderici ve ana eczacı e-postası kontrol edilir.
- Push hatasında VAPID değerleri, olay ayarı, kullanıcı hesabı ve aktif cihaz aboneliği kontrol edilir.
- Sorun giderilmeden outbox kaydı elle `tamamlandi` yapılmaz ve talep durumu elle ileri taşınmaz.
- Çek kodu loglara, hata metinlerine veya destek ekran görüntülerine açık biçimde alınmaz.

## 7. Otomatik doğrulama kaydı

28 Eylül 2026 tarihinde tam E-Club regresyon paketi ve Faz 6 güvenlik testleri hatasız tamamlandı. Sabit test verisi gerçek e-posta, kullanıcı veya çek kodu içermez. Gerçek Resend ve web push doğrulaması ayrı canlıya çıkış kapısıdır.
