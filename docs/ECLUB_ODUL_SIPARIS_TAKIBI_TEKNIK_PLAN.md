# E-Club ödül sipariş takibi — teknik plan

İlk plan: 28.09.2026. Güncelleme: 29.09.2026. Bu belge geliştirme planıdır; sipariş takibi uygulaması henüz geliştirilmemiştir. Depo katalog SQL'leri hazırlanmıştır; kullanıcı yükleme sonucunu 585 konum, 326 depo unvanı, 57 il ve 289 boş şube adı olarak paylaşmıştır. Canlı veritabanı bu incelemede doğrudan sorgulanmamıştır.

## 1. Kesinleşen iş akışı

- UTT eczacı/eczane kaydını tamamlarken en az 1, en fazla 3 depo tercihi kaydeder. Depo kataloğu kullanıcının sağladığı listeden yüklenmiştir (kullanıcının paylaştığı sonuç).
- Depoda adlandırılmış şube varsa depo ve şube seçimi zorunludur. Şube yoksa doğrudan depo seçilir.
- Seçilen konumun il, ilçe ve adresi otomatik ve salt okunur gösterilir.
- **Düzeltme/Ekleme Talebi** butonu sistemde tanımlanan `info@mill.gen.tr` adresine hazırlanmış e-postayı cihazın varsayılan e-posta uygulamasında açar. Gönderimi kullanıcı yapar.
- Eczacı siparişli çek talebi oluştururken ek depo seçimi veya form doldurma yapmaz.
- Ana/alternatif depo sıralaması yoktur. UTT siparişi okurken ürünün bulunduğu, eczanenin kayıtlı 1–3 tercihinden hedef depo/konumu seçer; hedef seçimi ve Okundu kaydı tek işlemde tamamlanır.
- Siparişli çek talebine çek kodu teslim edilebilmesi için siparişin Okundu olması zorunludur. Siparişsiz çek taleplerinde bu şart aranmaz.
- Düzeltme/Ekleme Talebi alıcı adresi şimdilik `info@mill.gen.tr` olarak sistemde tanımlanır.
- Siparişli çek talepleri UTT, BM ve TM'nin yetkili kapsamlarında **Ödül Sipariş Takibi** ekranında görünür.
- UTT siparişi uygulama dışından ilgili depoya iletir ve **Okundu** olarak işaretler. Bu jargon depoya iletildi anlamındadır; sayfayı görüntülemek bu durumu değiştirmez.
- İşlem yapan UTT ve işlem zamanı kaydedilir. BM/TM aynı kaydı görür.
- Talebi oluşturan eczacıya uygulama içi bildirim, push ve e-posta gönderilir.
- Bu geliştirme depoya otomatik sipariş gönderimi veya depo entegrasyonu içermez.

## 2. Mevcut yapıda bulunanlar

- `app/(panel)/eclub/store/page.tsx`: satış şartlı ve serbest sipariş seçenekleri mevcut; depo seçimi yok.
- `app/(panel)/eclub/store/_hooks/useEclubStore.ts`: talep oluştururken yalnız `yayin_id` ve `siparis_verilsin_mi` gönderiliyor.
- `app/(panel)/eclub/api/cek-talepleri/route.ts`: ana eczacı/üyelik/takvim kontrolü sonrasında `eclub_store_cek_talebi_olustur` RPC'sini çağırıyor.
- `eclub_store_cek_talepleri`: sipariş türü, verilip verilmediği, adet, MF ve çek onay durumu mevcut. İncelenen kaynaklarda depo kataloğu ve siparişin okunma kaydı yok.
- `app/(panel)/eclub/cek-onay-takip`: çek taleplerini ürün, eczane, adet/MF ve yönetim kapsamıyla gösteriyor. Ayrı ödül sipariş takip ekranı yok.
- `lib/eclub/yonetimKapsami.ts`: UTT'nin kendisini, BM'nin bölgesini ve TM'nin takımını kapsayan ortak yapı kullanılabilir.
- `eclub_cek_teslimat_outbox` ve çalışanları: Resend/push, yeniden deneme ve iş sahiplenme altyapısı mevcut. Kuyruk tamamlanınca çek talebini `cek_kodlari_gonderildi` durumuna geçiriyor; yeni olaylar bu kuyruğa doğrudan eklenmemeli.

## 3. Veri modeli

**Depo kataloğu:** `ecza_depolari` ve `ecza_depo_subeleri` tabloları önerilir. Depo/şube kimliği, ad, il/ilçe ve aktiflik tutulur. Şube depo FK'si taşır. UTT serbest metin yerine aktif katalogdan seçim yapar. Gerçek liste kullanıcı tarafından sağlanır; depo/şube yapısı ve tekrar kayıtları kontrol edilerek yüklenir. Sonraki katalog güncellemelerinin sorumlusu ayrıca belirlenir.

Katalog ve ilk yükleme ayrıntıları `docs/ECZA_DEPO_KATALOGU_YUKLEME.md` içindedir. Her kaynak satır bir konumdur; `ecza_depo_subeleri` tablosundaki şube adı olmayan satırlar da geçerli konumlardır. Tek bir satırın şube adının boşluğu üzerinden deponun şubesiz olduğu sonucu çıkarılmaz; deponun bütün konumları değerlendirilir. Adlandırılmış şubesi olup aktif şubesi kalmayan depoda zorunlu şube seçimi atlanmaz; katalog düzeltmesi istenir. Adsız kayıtlar otomatik “Merkez” diye adlandırılmaz. Şubesi olmayan depoda tek geçerli konum varsa depo seçimi bu konum kimliğini sunucuda çözer. Birden fazla adsız konum varsa adres seçimini belirsiz bırakmak yerine katalog eşleştirmesi tamamlanır; rastgele ilk satır kullanılmaz.

Tercihlerde ve siparişlerde `depo_sube_id`, kullanıcıya ayrıca şube seçimi gösterilmese de seçilen konumun FK'si olarak tutulabilir. İl/ilçe/adres bu konumdan alınır; kayıt API'si istemcinin gönderdiği adresi esas almaz. Okundu işlemi sırasında talebe il/ilçe/adres snapshot'ları da yazılarak geçmiş hedef konum bilgisi korunur.

**Kayıt tercihleri:** `eclub_eczane_depo_tercihleri` ilişkisi önerilir. Tercihler eczacı hesabına veya firmaya değil, eczaneye (`eczane_id`) bağlanır; aynı eczanenin firmalar arasında ortak tercihleri vardır. Şube/konum FK'si, kaydeden/güncelleyen UTT ve zaman tutulur. Liste sırası gösterim amaçlı olabilir; ana depo veya öncelik anlamına gelmez. Aynı konum tekrar seçilemez. En az 1/en fazla 3 kuralı tercihleri tek transaction içinde değiştiren yetkili RPC ile, eşzamanlı işlemlerde kilit altında uygulanır. UTT yalnız aktif bağlı olduğu eczanenin tercihlerini değiştirebilir. Değişiklik eczanenin diğer yetkili UTT'lerine de yansır; önceki tercihler ve işlem yapan kullanıcı denetim kaydında korunur.

**Talep alanları:** `eclub_store_cek_talepleri` üzerine `depo_sube_id`, `depo_adi_snapshot`, `depo_sube_adi_snapshot`, `siparis_okundu_at` ve `siparis_okuyan_utt_id` eklenir. Ürün/firma adı ile sipariş şartları da bildirim olayında sabitlenir. Katalog adları sonradan değişse bile geçmiş sipariş ve gönderilen mesaj korunur.

Okunma durumu iki alanla türetilir: zaman ve UTT yoksa **Okunmadı**, ikisi de varsa **Okundu**. Alanların birlikte dolu/boş olması veritabanı kısıtıyla korunur. Mevcut çek `durum` alanına `okundu` eklenmez.

Yeni siparişli taleplerde hedef depo henüz seçilmez. Talep oluşturulurken eczanenin kayıtlı tercihlerinin mevcut ve kullanılabilir olduğu sunucuda doğrulanır. UTT'nin Okundu işleminde seçtiği hedef konum ve depo/şube/il/ilçe/adres snapshot'ları kaydedilir. Siparişsiz taleplerde hedef konum atanmaz. Tercihler sonradan değişse bile okunmuş siparişin hedefi değişmez.

Eski siparişler için sahte depo ataması yapılmaz. Henüz okunmamış eski siparişler, eczanenin tercihleri UTT tarafından tamamlandıktan sonra aynı hedef seçimi ve Okundu işlemine dahil edilebilir. Daha önce teslim edilmiş çekler geriye dönük engellenmez ve sahte okunma bilgisi üretilmez; eski kayıt olarak korunur. Yeni çek teslimat kapısı devreye alındıktan sonra siparişli, henüz kod teslim edilmemiş taleplerde Okundu şartı uygulanır.

## 4. UTT kayıt ekranı ve eczacının talep oluşturması

- `app/(panel)/eclub/eczanelerim/page.tsx` kayıt akışına 1–3 depo/konum tercihi eklenir. Ana depo seçimi veya öncelik sırası istenmez.
- Mevcut `useEclubListem`, eczane/kişi tipleri ve `/eclub/listem/api/eczaneler` kayıt/güncelleme yolu tercihleri taşıyacak şekilde genişletilir. Eczane bağlama ve zorunlu tercih kaydı birlikte başarılı olmalıdır; eksik tercihli yarım kayıt bırakılmaz. Havuzdan mevcut eczane bağlama ve sonradan ana eczacı ekleme akışları da kapsanır.
- Aktif depo şubelerini döndüren UTT erişimi korumalı bir GET uç noktası eklenir. Tercih güncellemesinde UTT'nin eczaneyle aktif bağı sunucuda doğrulanır; tercih kaydı eczane genelinde ortaktır.
- Depo seçimine göre şube alanı gösterilir: adlandırılmış şube varsa zorunlu, yoksa ayrı şube alanı olmadan doğrudan depo seçimi. Depo değişince önceki şube ve konum alanları temizlenir. Aynı doğrulama API/RPC katmanında da yapılır.
- İl, ilçe ve adres seçilen konumdan doldurulur, salt okunur gösterilir. Eksik veya belirsiz konum sessizce tamamlanmaz.
- **Düzeltme/Ekleme Talebi** için alıcı adresi `info@mill.gen.tr` olarak sistem ayarında tutulur; katalog depo e-posta adresiyle karıştırılmaz. `mailto:` konusu ve gövdesi UTF-8 URI kodlamasıyla hazırlanır. İçerikte talep türü, seçilen depo/şube, il/ilçe/adres, kayıt kimliği ve kullanıcının ekleyeceği açıklama alanı bulunur. Yeni depo isteği için seçim yapmadan da buton kullanılabilir. Kişi/eczane özel bilgileri gereksiz yere gövdeye eklenmez.
- `mailto:` uygulamada talep kaydı oluşturmaz ve otomatik gönderim yapmaz; ekranda “gönderildi” sonucu gösterilmez. Varsayılan e-posta uygulaması olmayan cihazlar için info adresi ve talep metni kopyalanabilir sunulur. Gerçek info adresi tanımlanmadan buton sahte bir alıcıya yönlendirilmez.
- Eczacı tarafındaki mevcut siparişli/siparişsiz buton akışı korunur; ek depo formu açılmaz. Hook mevcut `yayin_id` ve `siparis_verilsin_mi` gövdesini göndermeye devam eder.
- Talep RPC'si ilgili eczanenin kayıtlı depo tercihlerinin kullanılabilir olduğunu doğrular, hedef depo atamaz. Tercih bulunamazsa siparişli talep anlaşılır hata ile reddedilir ve UTT'nin kaydı tamamlaması istenir; eczacıdan depo girişi istenmez. Hedef seçimi UTT'nin Okundu işlemine aittir.
- Talep RPC'sinin mevcut üç parametreli imzası korunabilir; snapshot/puan/devreden puan hesapları korunarak gövdesi güncellenir. Yeni tercih yönetim RPC'lerinin izinleri açıkça tanımlanır.
- Çek Taleplerim ekranında Okundu sonrası seçilmiş depo/konum ve okunma bilgisi gösterilir; öncesinde hedef henüz seçilmedi olarak gösterilir; bildirim hedefi bu kaydın detayı olur.

## 5. Ödül Sipariş Takibi ekranı

Önerilen yol: `/eclub/odul-siparis-takibi`. E-Club menüsünde UTT/KD_UTT, BM ve TM için görünür. Çek Onay ve Takip ekranı ayrı kalır.

Liste yalnız `siparis_verildi_mi=true` kayıtlarını içerir; serbest sipariş yayınında isteğe bağlı verilmiş siparişler de dahildir. Siparişsiz çek talepleri burada görünmez.

Kolonlar: talep tarihi, eczane/eczacı, ürün, adet, MF, depo/şube, UTT, çek onay durumu, sipariş durumu, okuyan UTT, okunma zamanı ve işlem. Eczane, şube, UTT, tarih ve Okundu/Okunmadı filtreleri; mobil kartlar ve sayfalama planlanır. İptal edilmiş kayıtlar geçmişte gösterilir, işlem yapılamaz.

UTT/KD_UTT yalnız kendisine atanmış siparişe **Okundu** işlemi yapabilir. İşlem formunda eczanenin kayıtlı, aktif 1–3 tercihinden ürünün bulunduğu hedef konumu seçer; seçimin il/ilçe/adresi salt okunur gösterilir. Seçim olmadan işlem tamamlanmaz. BM/TM kendi kapsamlarında görüntüler; bu işlemi yapamaz. GET ve işlem uç noktaları firma/kapsam doğrulaması yapar; boş yetki kapsamı hiçbir kayıt döndürmez. İstemciden gelen UTT/firma kimliği yetki kaynağı olarak kullanılmaz.

Sipariş oluşturulunca listede görünmesi ve iptal edilmemiş siparişlerin Okundu yapılabilmesi esas alınır. Çek için BM/TM onayı bekleme şartı bu plana eklenmemiştir; böyle bir iş kuralı istenirse açıkça tanımlanmalıdır. BM/TM ekranı açılışında, yenilemede ve sekmeye dönüşte güncel durum alınır.

## 6. Okundu işlemi ve bildirim güvencesi

Yeni bir RPC talebi `FOR UPDATE` ile kilitler; aktif UTT, firma, talebin atanmış UTT'si, sipariş varlığı, seçilen konumun eczanenin kayıtlı tercihlerine üyeliği, depo/konum aktifliği ve iptal durumunu kontrol eder. Tercih güncellemesiyle eşzamanlı işlem aynı eczane kilidi altında yönetilir. Hedef konum ve ad/adres snapshot'ları işlemle birlikte kaydedilir. Sunucu zamanı ve oturumdan çözülen UTT kimliği kaydedilir. Tekrarlanan/eşzamanlı çağrı aynı hedefle gelirse ikinci olay oluşturmaz; daha önce okunmuş siparişe farklı hedef gönderilirse reddedilir. Bu geliştirmede Okundu sonrası hedef değiştirme veya geri alma işlemi yoktur.

Aynı transaction içinde uygulama içi bildirim ve ayrı **ödül sipariş bildirim outbox** kayıtları yazılır. Kanal/alıcı/olay için benzersizlik sağlanır. İşlem başarılı olup kuyruk kaydı oluşmaması mümkün olmamalıdır. Sonradan gönderim hatası oluşursa sipariş Okundu kalır; bildirim yeniden denenir.

Mevcut Resend ve push altyapısı kullanılır; yeni olay türü `eclub_odul_siparis_okundu` olur. Ayrı çalışanlar ve korumalı cron uç noktası planlanır. İş sahiplenme/lease, yeniden deneme, hata kaydı ve e-posta idempotency anahtarı uygulanır. Cron'un gerçekten zamanlandığı ve teslimat izleme ekranı/logları yayına geçmeden doğrulanır. Push aboneliği bulunmaması uygulama içi bildirim ve e-postayı engellemez.

Yeni olayın alıcısı talebi oluşturan ana eczacıdır. E-posta adresi ve push hesabı sunucuda doğrulanır; eksik alıcı teslimat sorunu olarak izlenir. Kişinin sonradan başka eczaneye geçmesi halinde güncel eczane ilişkisi tekrar kontrol edilir.

**Mevcut çek kodu teslimatı ayrıca korunur:** kod e-postası ana eczacıya; push ilgili eczanede çalışan, E-Club üyesi ve HapBilgi hesabı bulunan tüm uygun kişilere gider. Yeni sipariş olayı bu alıcı kuralını veya çek teslimat durumunu değiştirmez.

Mesaj şablonu:

> HapBilgi'de kazandığınız puanların hediye çekine dönmesi için [Adet] adet + [MF] mal fazlası şartıyla [Ürün Adı] için onayladığınız sipariş, [Firma Adı] ürün tanıtım temsilcisi [Ad Soyad] tarafından tercih ettiğiniz [Depo Adı / Şube Adı] şubesine okunmuştur.

MF sıfırsa ilgili bölüm çıkarılır. Şubesiz konumda mesajdaki “şubesine” yerine “deposuna” kullanılır. E-posta içeriği kaçış uygulanarak üretilir. Ürün bilgisi sipariş kaydından, hedef konum ve işlemi yapan UTT/firma Okundu olayının snapshot'ından alınır; güncel katalog değişiklikleri eski siparişin hedefini değiştirmez.

### Siparişli çek teslimat kapısı

`eclub_store_admin_kod_teslim` RPC'sine mevcut TM son onay kontrolünün yanında siparişli talepler için `siparis_okundu_at`, `siparis_okuyan_utt_id` ve hedef konum/snapshot tutarlılığı kontrolü eklenir. API veya arayüz üzerinden bu şart atlanamaz. Admin teslimat ekranı okunmamış siparişli talebi gösterir ancak kod teslimini engeller ve gerekçeyi açıklar. Siparişsiz talepler mevcut TM onayı ve teslimat akışını izler. BM/TM onay sırası korunur; Okundu bu onayların yerine geçmez. Okundu bildirimlerinin gönderim başarısı çek teslimatına ek önkoşul yapılmaz.

## 7. Uygulama sırası ve doğrulama

1. Canlı şema/migrasyonlar doğrulanır; yüklenmiş depo/şube kataloğu ve belirsiz konumlar doğrulanır; eski sipariş sayısı ve eksik alanlar çıkarılır.
2. Katalog, talep alanları, Okundu RPC'si ve ayrı outbox migrasyonu hazırlanır. Veri erişim izinleri/RLS ve service-role RPC yetkileri tanımlanır.
3. UTT kayıt/güncelleme ekranında 1–3 şube tercihi ve talep oluştururken hedef atamadan tercih doğrulaması tamamlanır. Mevcut eczanelerin tercihleri UTT tarafından tamamlanır.
4. UTT/BM/TM ekranı, menü, kapsamlı GET ve hedef seçimiyle atomik Okundu işlemi eklenir. Admin kod teslim RPC/API/ekranında siparişli çekler için Okundu şartı eklenir.
5. Bildirim çalışanları, mesajlar, cron ve hata izleme tamamlanır.
6. Geçici demo satırları kaldırılır; kontrollü gerçek test hesaplarıyla uçtan uca doğrulama yapılır. Bluebook ve operasyon rehberi güncellenir.

Kabul testleri: UTT kaydında 0/4 şube, tekrarlı veya inaktif şube reddi; 1–3 şubeyle atomik kayıt; yetkisiz tercih güncelleme reddi; eczacıya ek form açılmadan talep oluşması; UTT'nin yalnız eczanenin kayıtlı tercihlerinden hedef seçebilmesi; Okundu ile hedef snapshot'ının atomik kaydı; tercih değişikliğinde eski sipariş snapshot'ının korunması; siparişli talepte kullanılabilir tercih yoksa kayıt reddi; siparişsiz talebin takip listesine girmemesi; adet/MF/puan hesaplarının değişmemesi; firma/UTT/BM/TM kapsam dışı erişim reddi; BM/TM'nin Okundu işlemi yapamaması; iptal edilmiş talebin işlenememesi; eşzamanlı Okundu çağrısında tek olay; BM/TM ve eczacı ekranlarında aynı durum; e-posta/push hatasında yeniden deneme ve uygulama içi bildirimin görünmesi; mevcut çek teslimatında alıcılar ve durum geçişlerinin korunması. Mevcut `test:eclub`, TypeScript kontrolü ve ilgili SQL entegrasyon testleri çalıştırılır.

## 8. Kesinleşen kararlar ve uygulama hazırlığı

- Hedef depo seçimini UTT, siparişi Okundu yaparken ürün bulunurluğuna göre yapar. Ana depo sıralaması yoktur.
- 1–3 depo tercihi firmadan bağımsız eczaneye aittir.
- Siparişli çek kodu teslimatında Okundu zorunludur; siparişsiz talepler bu şarttan muaftır.
- Düzeltme/Ekleme Talebi alıcısı şimdilik `info@mill.gen.tr`; sistem ayarından değiştirilebilir.
- Kullanıcının depo kataloğu yükleme sonucu alınmıştır. Uygulama öncesinde canlı şema ve belirsiz adsız konumlar doğrulanır, mevcut eczanelerin tercihleri UTT tarafından tamamlanır.

Bu kararlarla teknik planın iş akışı netleşmiştir. Katalog güncellemelerinin işletim sorumlusu ve mevcut kayıtların tamamlanması yayına hazırlıkta ele alınır. Bu plan güncellemesi push veya canlı SQL uygulaması içermez.

Ek kabul testleri: şubeli depoda şubesiz kayıt reddi; şubesiz depoda tek konumun otomatik çözülmesi; birden fazla adsız konumda yanlış adres atanmaması; depo değişince eski şubenin temizlenmesi; il/ilçe/adresin salt okunur olması ve istemci değişikliklerinin sunucuda kabul edilmemesi; `mailto:` alıcı/konu/gövdesinin Türkçe karakterlerle doğru açılması; seçim yapmadan ekleme talebi hazırlanabilmesi; e-posta istemcisi olmayan cihazda kopyalama seçeneği; butonun DB kaydı veya otomatik e-posta oluşturmaması.

Son kararların kabul testleri: eczanenin iki farklı firmaya bağlı UTT ekranında aynı tercihleri görmesi; bağı olmayan UTT'nin tercihleri değiştirememesi; tercih dışı hedefin reddi; farklı hedefle ikinci Okundu çağrısının reddi; siparişli çekin Okundu öncesi admin teslim RPC'sinde reddi ve Okundu sonrası mevcut TM onay şartıyla teslimi; siparişsiz çekin Okundu olmadan mevcut akışla teslimi; daha önce teslim edilmiş çeklerin geçmişinin korunması.

## 9. Uygulama durumu — 29 Eylül 2026

Kod entegrasyonu tamamlandı. Katalog ve tercih API'si `/eclub/depolar/api`; takip ekranı ve GET/POST API'si `/eclub/odul-siparis-takibi` altındadır. Tercihler yeni eczane kayıt formuna ve Takımım detayına bağlandı. Eczacı sipariş aşamasında depo seçmez. BM/TM yalnız mevcut hiyerarşi kapsamında görüntüler. Filtreler eczane adı, okunan hedef konum, UTT, tarih ve okunma durumudur; sayfa başına 30 kayıt gösterilir.

Planın uygulama karşılıkları:

- Yeni kayıt ve tercihler `eclub_utt_eczaneye_depolar_ile_bagla` ile tek transaction'dır. Tercih kaydı, Okundu ve sipariş oluşturma aynı eczane satırını kilitler. Kayıtlı ana eczacılar migration ile geriye dönük silinmez; yeni ana eczacı bağları kullanılabilir tercih gerektirir.
- Puan ve mevcut admin teslimat RPC'leri yeniden yazılmadı. `eclub_siparis_depo_kapisi_trg` yeni siparişli talepte kullanılabilir tercih ve kod teslimatındaki `teslimat_bekliyor` geçişinde Okundu şartını uygular. Mevcut TM onayı RPC'de korunur. Eski teslimatlar geri alınmaz.
- Okundu, hedef konum/adres snapshot'ı, ana eczacıya uygulama içi bildirim ve iki kanal outbox kaydı atomiktir. Kanal çalışanları ayrı kalır; mevcut `/api/cron/eclub-cek-eposta` ikisini de çağırır. 120 saniyelik lease, token kontrolü, artan beklemeli 5 deneme ve e-posta idempotency anahtarı uygulanmıştır.
- Geçici sahte çek listesi satırları kaldırıldı. Yeni ekran gerçek API verisini kullanır.
- `test:eclub`: 240 başarılı test. TypeScript kontrolü başarılı. `tests/eclubOdulSiparis.postgres.mjs`: yerel PostgreSQL'de 36 kontrol başarılı; tüm 585 katalog satırı yüklenerek migration iki kez uygulandı. Eski çek kodu outbox'ında e-posta ana eczacıya ve push tüm uygun çalışanlara gittiği doğrulandı. Bu test ortamı canlı DB ve gerçek e-posta/push gönderimi değildir.

**Kalan devreye alma adımı:** `scripts/sql/eclub_odul_siparis_takibi.sql` canlı Supabase'de uygulanmalıdır. Ardından mevcut eczane tercihleri tamamlanmalı; cron zamanlaması ve gerçek hesaplarda uçtan uca bildirim teslimatı doğrulanmalıdır. Canlı SQL uygulanmadı, push yapılmadı. Adımlar `docs/ECZA_DEPO_KATALOGU_YUKLEME.md` içindedir.
