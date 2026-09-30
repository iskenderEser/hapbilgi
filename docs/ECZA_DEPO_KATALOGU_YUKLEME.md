# Ecza depo kataloğu — kontrol ve Supabase yüklemesi

Kaynak: `/Users/iskendereser/Desktop/Depolar-Subeler.xlsx`, `Ruhsatlı Depolar!A1:F586`.
İnceleme: 29.09.2026. Kaynak dosya değiştirilmedi.
SHA-256: `5cf4871f38828b4d90908bcc220d457764a6cd068bdb998e6197731dfa89027d`.

## Dosya kontrolü

- 1 sayfa, 6 kolon, başlık hariç 585 kayıt. Sıra numaraları 1–585 ve benzersiz.
- Kolonlar: Sıra No, Depo Adı, Şube Adı, İl, İlçe, Adres.
- Depo adı, il, ilçe ve adres alanlarında eksik yok. 57 farklı il var.
- Boşluklar sadeleştirildikten sonra 326 farklı depo unvanı var. Bu sayı tüzel kişilik/ruhsat sayısı olarak yorumlanmamalı; resmi şirket kimliği verilmemiş.
- 296 kayıtta şube adı var, 289 kayıtta boş. Boşlar NULL saklanacak; merkez şube varsayılmayacak.
- Depo+şube+il+ilçe birleşiminde ve bu birleşime adres eklendiğinde mükerrer yok.
- 258 satırda en az bir metin alanının boşluğu sadeleştirildi. Türkçe karakterler ve isimler korundu; benzer unvanlar otomatik birleştirilmedi.
- Dosyada formül, GLN, ruhsat numarası veya resmi listenin yayın tarihi/kaynak bağlantısı bulunmuyor. Kullanıcı bu listeyi ruhsatlı depolar listesi olarak sağlamıştır; güncel ruhsat statüsü bu dosyadan bağımsız doğrulanmamıştır.

## Veri modeli

`ecza_depolari`: 326 farklı depo unvanı, UUID ve uygulama aktiflik alanı.
`ecza_depo_subeleri`: 585 depo/şube konumu; depo FK, nullable şube adı, il, ilçe, adres ve kaynak sıra/dosya bilgisi.

Her kaynak satır bir katalog konumudur. Şube adı olmayanlar da kaybolmaz. Şubeli depoda yalnız adlandırılmış aktif şubeler seçilebilir. Şubesiz depoda yalnız tek konum varsa doğrudan depo seçilir; birden fazla adsız konum adres belirsizliği nedeniyle seçime açılmaz. Ekran etiketi depo adı + varsa şube adı + il/ilçe olarak hazırlanır. Boş şube adı merkez olarak yorumlanmaz.

UUID'ler ilk yükleme için üretilmiş uygulama kimlikleridir; resmi ruhsat kimliği değildir. Aynı hazırlanan SQL tekrar çalıştırılabilir. Gelecek liste sürümlerinde unvan/adres değişiklikleri mevcut UUID'lerle eşleştirilmelidir; dosya sırası kimlik olarak kullanılmamalıdır. Eksik görünen kayıtlar otomatik silinmez/pasife alınmaz.

`aktif_mi` uygulamada seçilebilirliktir; resmi ruhsatın güncel olduğunu belgelemez. Kaynak ilk katalog olarak aktif yüklenir. Sonraki aktiflik kararları ayrıca yönetilir.

## Supabase adımları

1. Doğru HapBilgi projesinde SQL Editor'ı açın.
2. `scripts/sql/ecza_depo_katalogu_sema.sql` dosyasının tamamını yapıştırıp çalıştırın. İki katalog tablosu oluşur. Uygulamanın mevcut eczane/çek tablolarına dokunmaz.
3. `scripts/sql/ecza_depo_katalogu_veri_20260929.sql` dosyasının tamamını yeni sorguya yapıştırıp çalıştırın. Veri yüklemesi tek transaction'dır; hata oluşursa tüm yükleme geri alınır.
4. Sonuçta `yuklenen_konum=585`, `depo_adi_sayisi=326`, `il_sayisi=57`, `sube_adi_bos=289` beklenir. Table Editor'da birkaç depo ve şubesini kontrol edin.

Excel'i doğrudan yeni tablo olarak yüklemek yerine hazırlanmış SQL önerilir: iki tablo arasındaki FK'ler, nullable şube adları, kimlikler ve UTF-8 metinler tek işlemle korunur. Supabase küçük veri kümeleri için CSV yüklemeyi de destekler: https://supabase.com/docs/guides/database/import-data

RLS açık; anon/authenticated doğrudan erişimi kapalıdır. Uygulama katalogları E-Club yetkisi denetlenen sunucu API'sinden service-role ile okur. Kayıt ve sipariş entegrasyonu için aşağıdaki ek migration gerekir.

## Yapılan doğrulama ve sınır

Yerelde tüm kaynak satırlar okundu; zorunlu alan, sıra, mükerrer, depo/şube UUID tekilliği ve FK eşleştirmesi kontrol edildi. Kullanıcının Supabase yükleme sonucu `585 / 326 / 57 / 289` olarak alınmıştır. Katalog SQL'i ve yeni sipariş migration'ı ayrıca yerel PostgreSQL ortamında yürütülmüştür. Bu kontrol canlı Supabase şemasına bağlantı veya canlı bildirim teslimatı doğrulaması değildir.

## Ödül sipariş takibini devreye alma

1. Katalog yüklemesi tamamlandıktan sonra `scripts/sql/eclub_odul_siparis_takibi.sql` dosyasının **tamamını** aynı Supabase projesinin SQL Editor'ında çalıştırın. Tek transaction içinde tercihler, sipariş alanları, RPC'ler, bildirim kuyruğu ve teslimat kapısı kurulur. Script tekrar uygulanabilir; mevcut puan hesaplama RPC'lerini değiştirmez.
2. `sistem_ayarlari.eclub_depo_info_eposta` değeri ilk kurulumda `info@mill.gen.tr` olur; mevcut değer varsa korunur.
3. UTT, mevcut eczanelerin Takımım detayındaki bar üzerinde **Depo ekle** aramalı listesinden 1–3 tercih kaydeder. En az üç karakterle kısa/resmi ad, şube, il veya ilçe aranır. Seçim otomatik kaydedilince ayrı tercih stat kartı oluşur; hatada kart eklenmez. Üç kayıtta liste gizlenir; karttaki × ile kaldırılınca yeniden görünür. Son tercih kaldırılamaz. Yeni kayıt formunda 1–3 seçim zorunluluğu korunur. Eski tercihsiz eczaneler silinmez; tercihleri tamamlanana kadar yeni siparişli talep ve yeni ana eczacı kaydı engellenir. Siparişsiz talep etkilenmez.
4. UTT **Ödül Sipariş Takibi** ekranında kayıtlı tercihlerden hedef seçer ve dışarıda depoya ilettiği siparişi **Okundu** işaretler. BM/TM kapsamlarında görüntüler. Siparişli çeklerin yeni kod teslimi Okundu olmadan ilerlemez; daha önce teslim edilmiş çekler geri alınmaz.
5. Mevcut korumalı `/api/cron/eclub-cek-eposta` endpoint'i iki yeni bildirim kuyruğunu da tüketir. Zamanlayıcının bu endpoint'i `CRON_SECRET` ile düzenli çağırdığını doğrulayın; yeni cron adresi gerekmez. E-posta için mevcut `RESEND_API_KEY` ve `ECLUB_CEK_EMAIL_FROM`, push için mevcut VAPID ayarları kullanılır.
6. Kontrollü bir siparişte UTT/BM/TM kapsamını, hedef/adres kaydını, ana eczacının uygulama içi bildirimi/e-postası/push'unu ve siparişli/siparişsiz çek teslimini canlı doğrulayın. Yeni sipariş olayı ana eczacıya gider; mevcut çek kodu teslimatı e-posta ana eczacıya, push uygun tüm E-Club çalışanlarına gider.
7. Kuyrukta `eclub_odul_siparis_outbox.durum`, `son_hata_kodu`, `deneme_sayisi` izlenebilir; takip ekranı kanal durumlarını gösterir. En fazla 5 deneme, 120 saniyelik lease ve token ile eski çalışanın sonucu yazmasını engelleme uygulanır. Kalıcı hata halinde kök neden giderilmeden başarılı teslimat varsayılmaz.

Canlı yeni migration, zamanlayıcı ve gerçek e-posta/push teslimatı bu geliştirme oturumunda uygulanıp doğrulanmadı. Kodun yayına alınmasından önce migration tamamlanmalıdır. Push yapılmadı.
