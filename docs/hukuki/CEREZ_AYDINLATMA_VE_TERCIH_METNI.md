# HAPBİLGİ ÇEREZ VE TARAYICI DEPOLAMA AYDINLATMA METNİ

**Metin tarihi:** 3 Eylül 2026  
**Sürüm:** 1.0 Taslak

## 1. Veri sorumlusu

HapBilgi internet sitesi ve kapalı platformunun ortak teknik çerez ve tarayıcı depolama işlemleri bakımından veri sorumlusu:

**Mill Danışmanlık Organizasyon ve Eğitim Hizmetleri Ltd. Şti.**  
**VKN:** 6210464784  
**MERSİS No:** 62104647840013  
**Adres:** Göktürk Merkez Mah., İstanbul Cad., Üstküme Sok., No: 52/51, Göktürk, Eyüp/İstanbul  
**Telefon:** +90 532 433 31 45  
**E-posta:** info@mill.tr  
**KEP:** milldadismanlik@hs01.kep.tr

## 2. Çerez ve benzeri teknolojiler

Çerezler, internet sitesinin ziyaret edildiği cihazda saklanan küçük veri dosyalarıdır. HapBilgi ayrıca localStorage ve sessionStorage gibi tarayıcı depolama alanlarını kullanır. Bu alanlar teknik olarak çerez olmasa da kullanıcı cihazında bilgi sakladıkları için bu metinde birlikte açıklanmıştır.

HapBilgi'nin mevcut sürümünde reklam, davranışsal hedefleme veya üçüncü taraf ziyaretçi analitiği amacıyla çerez kullanılmamaktadır. Kullanılan kayıtlar; güvenli oturum açma, kullanıcının açıkça seçtiği tercihleri hatırlama, işlem bütünlüğü, taslak koruma ve bildirim iznini yönetme amaçlarıyla sınırlıdır.

## 3. Kullanılan çerezler

| Ad | Tür/sağlayıcı | Amaç | Süre | Hukuki sebep |
|---|---|---|---|---|
| `sb-ssdbgvxergowbzgjtbjp-auth-token` ve gerektiğinde `.0`, `.1` şeklindeki parçaları | Birinci taraf; Supabase kimlik altyapısı | Kullanıcının güvenli biçimde oturum açması, oturumun doğrulanması ve yenilenmesi | Oturum yenilendikçe güncellenir; teknik üst sınır 400 gün, çıkışta silinir | Kullanıcının talep ettiği kapalı platform hizmetinin sunulması ve bilgi güvenliğine ilişkin meşru menfaat |
| `sb-ssdbgvxergowbzgjtbjp-auth-token-code-verifier` | Birinci taraf; Supabase kimlik altyapısı | Parola yenileme/kimlik doğrulama akışının güvenliği | İlgili doğrulama akışı tamamlanana kadar | Hizmetin ve hesap güvenliğinin sağlanması |
| `hb_oturum_isareti` | Birinci taraf | "Beni hatırla" seçilmediğinde oturumun tarayıcı kapanınca sonlandırılmasını sağlamak | Tarayıcı oturumu boyunca | Kullanıcının açıkça talep ettiği oturum tercihinin uygulanması |

Bu çerezler kapalı platformun giriş ve güvenlik işlevleri için kesinlikle gereklidir. Engellenmeleri halinde kullanıcı girişi, parola yenileme veya güvenli oturum özellikleri çalışmayabilir.

## 4. Yerel tarayıcı depolaması

| Anahtar/kategori | Depolama | Amaç | Süre |
|---|---|---|---|
| `hb_beni_hatirla` | localStorage | Kullanıcının "Beni hatırla" tercihini uygulamak | Çıkış yapılana, tercih değiştirilene veya tarayıcı verileri silinene kadar |
| `hb_push_onay_[kullanıcı kimliği]` | localStorage | İlgili hesabın Web Push bildirimine izin verdiğini hatırlamak | İzin geri alınana veya tarayıcı verileri silinene kadar |
| `hb_push_erteleme_[kullanıcı kimliği]` | localStorage | Bildirim izin kartında "Daha sonra" seçimini hatırlamak | 7 gün |
| `hapbilgi:talep-islem:[kullanıcı kimliği]` | sessionStorage | Aynı içerik talebinin teknik olarak mükerrer gönderilmesini önlemek | Tarayıcı sekmesi/oturumu boyunca veya işlem tamamlanana kadar |
| `hapbilgi:talep-onay-modalini-atla:[kullanıcı kimliği]` | localStorage | Yetkili içerik üreticisinin "bir daha hatırlatma" tercihini uygulamak | Tercih kaldırılana veya tarayıcı verileri silinene kadar |
| Senaryo revizyon taslağı anahtarları | localStorage | İçerik üreticisinin henüz göndermediği revizyon taslağını cihazında korumak | Taslak gönderilene, temel metin değişene veya tarayıcı verileri silinene kadar |

Web Push aboneliği açıldığında ayrıca bildirim hizmetinin teknik olarak çalışması için tarayıcı tarafından üretilen abonelik adresi, açık anahtarlar ve kullanıcı aracısı sunucuda saklanır. Tarayıcı bildirimi yalnız kullanıcı "İzin ver" seçeneğine bastıktan ve tarayıcı iznini verdikten sonra açılır.

## 5. Kişisel verilerin toplanması, amacı ve aktarılması

Çerez ve tarayıcı depolama verileri, kullanıcının HapBilgi'yi ziyaret etmesi, oturum açması, bir tercih yapması veya ilgili özelliği kullanması sırasında elektronik ortamda otomatik olarak toplanır.

Bu bilgiler KVKK'nın 5/2-c maddesindeki sözleşmenin kurulması veya ifası, 5/2-ç maddesindeki hukuki yükümlülük ve 5/2-f maddesindeki ilgili kişinin temel haklarına zarar vermemek kaydıyla veri sorumlusunun meşru menfaati hukuki sebeplerinden ilgili faaliyete uygun olanına dayanılarak işlenir.

Oturum ve kimlik doğrulama verileri bulut kimlik ve veri tabanı hizmet sağlayıcısı Supabase ile; Web Push verileri kullanıcının tercih ettiği tarayıcının bildirim altyapısı ve gerekli teknik hizmet sağlayıcılarıyla paylaşılabilir. Yurt dışı aktarım gerçekleşmesi halinde KVKK'nın 9. maddesinde düzenlenen uygun aktarım mekanizması kullanılır.

## 6. Tercihler ve çerezlerin yönetimi

Mevcut HapBilgi sürümünde açık rıza gerektiren reklam, pazarlama veya üçüncü taraf analitik çerezi bulunmadığından, "tümünü kabul et" biçiminde genel bir çerez rızası alınmaz. Kullanıcıya bu metne erişim sağlanır ve yalnız kesinlikle gerekli kayıtlar kullanılır.

Tarayıcı ayarlarından çerezler ve site verileri görüntülenebilir, silinebilir veya engellenebilir. Zorunlu oturum çerezlerinin silinmesi kullanıcının hesabından çıkmasına; localStorage veya sessionStorage kayıtlarının silinmesi ise hatırlama, bildirim erteleme, taslak ve mükerrer işlem önleme tercihlerinin kaybolmasına neden olabilir.

HapBilgi'ye ileride reklam, davranışsal hedefleme veya açık rıza gerektiren analitik çerez eklenirse:

- bu metin ve çerez tablosu kullanılmadan önce güncellenir,
- söz konusu çerezler varsayılan olarak kapalı tutulur,
- "Kabul et", "Reddet" ve "Tercihler" seçenekleri eşit görünürlükte sunulur,
- kullanıcı olumlu seçim yapmadan ilgili çerezler çalıştırılmaz,
- verilen tercih daha sonra değiştirilebilir.

## 7. İlgili kişinin hakları ve başvuru

Kullanıcı, KVKK'nın 11. maddesindeki haklarını kullanmak için **info@mill.tr** adresine, **milldadismanlik@hs01.kep.tr** KEP adresine veya şirketin yukarıdaki merkez adresine başvurabilir.

## 8. Kullanıcıya gösterilecek kısa metin

Mevcut teknik yapı için önerilen kısa bildirim:

> HapBilgi, güvenli oturum açma ve seçtiğiniz teknik tercihleri hatırlama amacıyla yalnız zorunlu çerezler ve tarayıcı depolama kayıtları kullanır. Reklam veya davranışsal analiz çerezi kullanılmaz. Ayrıntılar için Çerez ve Tarayıcı Depolama Aydınlatma Metni'ni inceleyebilirsiniz.

Zorunlu çerezler için "kabul ediyorum" kutusu kullanılmaz. Web Push bildirimi ayrıca ve yalnız kullanıcının aktif seçimiyle açılır.
