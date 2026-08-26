# hapbi — Faz 2: kişiye ve role uygun rehberlik

26 Ağustos 2026. Salt okunur; veritabanı şema değişikliği veya veri yazımı yoktur.

## Akış

Oturum → yetkili kimlik/kapsam → imzalı sohbet kontrolü → Gemini araç seçimi → sunucuda araç/yetki/parametre denetimi → mevcut veri servisi → kaynaklı cevap → yanıt denetimi → arayüz.

Model kullanıcı/firma kimliği, tablo, SQL veya URL seçemez. Yalnız konusu ve dönem parametreleri doğrulanmış araçları kullanır. Kaynak ve eylem linkleri sunucuda üretilir. Kişisel sayılar için önceki sohbet yerine güncel veri okunur.

## Faz 2 kapsamı

- **Gelişim rehberi:** UTT/KD_UTT kişisel T-Club raporu, BM kişisel C-Club verisi veya bölgesinin T-Club raporu, TM/üretici/yönetici kendi ekip kapsamı. Ekip performansı kişinin öğrenme eksikliği diye sunulmaz. Üretici için mevcut üretim özeti, yönetici için mevcut katılım verisi de değerlendirilir.
- **Gerekçeli eğitim önerisi:** Güncel katalogdaki tüm adaylar sunucuda değerlendirilir; en çok üç öneri gösterilir. Önce gelen challenge ve yarım kalan eğitim; öğrenme hedefinde kategori yanlış cevap kaybı ve tur katılımı, açık puan hedefinde video puanı dikkate alınır. Tamamlanan eğitim, yalnız yanlış cevap kaybı olan kategoride yeniden çalışma adayıdır; aynı kategoride önce tamamlanmamış eğitim seçilir. Tamamlananlar puan hedefinde yeni kazanım adayı sayılmaz. Kullanıcının kategori tercihi filtrelenir. Bu bir mesleki yetkinlik puanlaması veya başarı tahmini değildir. Öneri gerekçesi bağlantının altında sunucudan gelen metinle gösterilir.
- **Açık tekrar isteği:** `calisma=tekrar`, genel önceliklendirmeden ayrı olarak yalnız bu turda tamamlanan eğitimleri değerlendirir. Kategori kaybı yoksa gerekçe kullanıcının tekrar isteğidir; öğrenme eksiği uydurulmaz. Bu seçenek yalnız kişisel öğrenme kapsamındadır; extra/tekrar puanı hesabı yerine kullanılamaz.
- **Yayına bağlı içerik:** Model yalnız aynı istekte katalog/rehberden aldığı eğitim kimliğiyle senaryo okuyabilir. Yayın durumu ve rol/firma/takım görünürlüğü yeniden doğrulanır. `v_yayin_detay` ilgili videoya bağlı senaryoyu sağlar; taslaklar arasında arama yapılmaz. Metin en çok 10.000 karakterdir; kesilme ve boş içerik açıkça belirtilir. Senaryo video transkripti diye sunulmaz; soru/cevap anahtarı okunmaz.
- **Takip sorusunda eğitim arama:** Ad/teknik ve kategori filtresi tüm güncel yayınlarda çalışır; `tamamlama=kalan/tamamlanan/tumu` filtresiyle tekrar çalışma/içerik soruları da desteklenir. Aynı adın farklı yayınları kategori/puanla ayrılır; belirsizlikte netleştirme istenir. İçerik okuması önceki cevabın bayat kimliğine güvenmez, güncel sonuçtan kimlik seçer.
- **Dönem karşılaştırması:** Varsayılan `esit_sure`, iki dönemin başından eşit sayıda tamamlanmış TR günü alır; bugün dahil değildir. Ay/çeyrek/yıl uzunlukları farklıysa kısa dönemin gün sayısı ortak sınırdır. Henüz tamamlanmış gün yoksa kıyas yapılmaz. `takvim` yöntemi tam takvim dönemlerinin mevcut toplamlarını karşılaştırır. T-Club mevcut rapor RPC’lerini, BM kişisel karşılaştırması mevcut `_cc_ligi_aralik` günlük motorunu yalnız kendi kişi/firma süzgeciyle kullanır. Fark/yüzde sunucuda hesaplanır; sıfır/negatif baz veya eksik kayıt için yüzde `null` olur. Eşit süreli puan farkı da mesleki yetkinlik veya satış başarısı ölçümü değildir.

Rehberlik yanıtı, okunmuş `gelisim_rehberi` kaynağı gerektirir. Model gözlem → gerekçe → adım şeklinde kısa açıklama üretir. Kaynak/rol/parametre hatasında hazır öneriye veya uydurma eksiklik teşhisine geçilmez. Eczane/Eczanem ve İÜ için kişisel canlı veri araçları bu kapsamda eklenmemiştir; bu roller genel platform rehberliği alır.

Eğitim kaynağı kullanıcıya **Eğitim Yayınları** adıyla gösterilir. UTT kategori menüsünün `/videolarim` kök sayfası yoktur; bu kaynak etiketi tıklanabilir değildir. Önerilen eğitimler ayrı bağlantılardır: UTT/KD_UTT için mevcut kategori sayfası + `yayin_id`, BM için C-Club izleme sayfası + varsa güncel gelen `challenge_id`. Model yalnız bu istekte okunmuş ve kaynak gösterilmiş eğitim kimliklerini seçebilir; başlık ve adres sunucudan gelir. Etikette eğitim adı, varsa teknik ve kategori bulunur.

## Kaynak matrisi

| Araç | Kaynak | Erişim / sınır |
|---|---|---|
| `platform_bilgisi` | `bilgiKaynaklari.ts` | Sürüm/dayanak içeren, kodla karşılaştırılmış kullanıcı rehberi; tüm roller |
| `lig_durumu` / HB | `getUttLig`, `getSahaLig` | Mevcut bölge/takım/firma karşılaştırma kapsamı; admin sistem kapsamı |
| `lig_durumu` / CC | `get_cc_ligi_*` | CC rolü + etkin modül + doğrulanmış firma; eksik firma kapalı |
| `performans_raporu` / UTT, BM, TM | `get_kullanici_ozet`, `get_kullanici_kategori_dagilimi`, mevcut rapor toplama fonksiyonları | Sırasıyla kişi, bölge, takım; BM kişisel CC puanı değildir |
| `performans_raporu` / üretici | Aynı saha RPC'leri + `get_uretici_rapor_ozet_v3` | `ureticiYetenegi.raporScope`; üretim kaynağı oturum kimliği |
| `performans_raporu` / yönetici | `get_yonetici_rapor_ana_ozet_v2`, `get_yonetici_hiyerarsi_v2` | Yönetici raporunun kendi RPC'leri; challenge kaybı/güncel tur ayrımı korunur |
| `eclub_raporu` | `eclubYonetimKapsaminiGetir`, `get_eclub_utt_rapor`, `eclubRaporunuTopla` | Etkin modül ve mevcut E-Club yönetim kapsamı |
| `egitimleri_getir` | Yetkili yayın kataloğu + T/CC izleme kayıtları + `gecerliTurBaslangiclari` | UTT/KD_UTT ve BM; KD_UTT hedef kitlesi `utt`; BM gelen challenge kilidi korunur |
| `gelisim_rehberi` | Mevcut rol raporu / BM kişisel CC ligi + güncel eğitim kataloğu; `rehberlik.ts` | Kişisel/ekip kapsamı ayrı; en çok üç gerekçeli eğitim; ekip kapsamına kişisel eğitim listesi verilmez |
| `donem_karsilastir` | Aynı rol ve kapsamın iki dönem raporu; BM kişisel eşit süre için `_cc_ligi_aralik`; ortak TR takvim yardımcıları | Eşit tamamlanmış günler veya takvim toplamları; fark/yüzde sunucuda, eksik ölçüm korunur |
| `egitim_icerigi` | `v_yayin_detay.senaryo_metni` | Yalnız bu istekte erişilmiş eğitim; tekrar görünürlük kontrolü; boş/kesilmiş metin açık |

Lig/rapor dönemi hafta, ay, çeyrek veya yıldır; mevcut Türkiye takvim yardımcıları kullanılır. Araç çıktısı tarih aralığını taşır. Ekran bağlantısı filtreyi otomatik seçmez. Rapor ekranları güncel dönemi şimdiye kadar gösterebilir; araç tam takvim aralığını kullanır ve bunu sonuçta belirtir.

Ham DB satırları filtrelenmeden modele gönderilmez. Lig listesi en çok 40, normal eğitim listesi en çok 20 satırdır; kapsam toplamı ve kesilme bilgisi ayrı tutulur. Rehber tüm adayları sunucuda sıralayıp en çok üç öneri verir. Eğitim/kendi izleme/challenge sorgusunda 1.000 satıra ulaşılırsa eksik veriyle değerlendirme yapmak yerine hata döner; daha büyük katalog ve geçmiş için sayfalama ayrıca gereklidir. Eğitimlerde medya dosyası URL'si ve cevap anahtarları; E-Club'da GLN ve kişi iletişim bilgileri gönderilmez. Senaryo içeriği ayrı araçla okunabilir; okunmadan başlıktan içerik anlatılamaz.

## Konuşma, hata ve maliyet

- `GEMINI_MODEL` önceliklidir. Tanımlı model hata verirse gizlice başka modele veya hazır cevaba geçilmez.
- `GEMINI_API_KEY` HTTP başlığıyla gönderilir, URL/günlüklere yazılmaz.
- `HAPBI_SOHBET_SECRET` isteğe bağlı ayrı imza anahtarıdır. Yoksa sunucudaki service-role anahtarı amaç ayrımlı HMAC için kullanılır; istemciye anahtar gönderilmez.
- Sohbet token'ı imzalıdır, **şifreli değildir**; yalnız kullanıcının kendi soru/cevapları ve kapsamını taşır. İstemci belleğinde tutulur, kalıcı depolanmaz. Son 12 mesaj / 18.000 karakter / 30 dakika; yeni sohbet veya kapsam değişiminde yenilenir.
- Hata, boş kayıt ve gerçek sıfır farklıdır. Kaynakta olmayan sıra/puan varsayılmaz. Sayı denetimi, seçilen kaynakta bulunmayan rakamları engeller ve sınırlı düzeltme turu açar. Aynı sayının yanlış kişiye/ölçüte atfedilmesini tek başına çözmez; bu anlamsal değerlendirme gerektirir.
- Model: en çok 5 çağrı ve 8 araç seçimi. Gelişim aracı bir rapor + kişisel kapsamda katalog, karşılaştırma aracı iki rapor okur; iç okuma sayısı bu nedenle model araç sayısıyla aynı değildir. İstek: en çok 2.000 karakter soru / 70 KB gövde. Sunucu veri/model akışına zaman aşımı uygular.
- Süreç içi kullanıcı başına tek eşzamanlı istek ve dakikada 8 istek. Çok örnekli üretimde ortak Redis/DB limit deposu ve toplam maliyet alarmı eklenmeden bu sınır küresel kabul edilmemelidir.
- Günlükler yalnız istek kimliği, durum/hata kodu, yapılandırılmış model, araç adları, toplam token kullanımı ve süre içerir. Token sayısı fiyat değildir.

## Doğrulama

`node --import ./tests/_alias.mjs --test tests/hapbi.smoke.test.ts`

Kapsam: yetkili kimlik ve organizasyon uyuşmazlığı; pasif/eksik kullanıcı; haftalık sıfır ve eksik sıra; CC firma/modül sınırı; parametre enjeksiyonu; rol rapor RPC/kapsam seçimi; dönem doğrulama; KD_UTT hedef rolü; T/CC tur/kayıt ayrımı; dış kimlik erişim reddi; sohbet tahrifi/kullanıcı değişimi/süre aşımı; eşzamanlılık; Gemini thought signature ve araç cevap sırası; sahte kaynak/URL/sayı; sağlayıcı hatası ve döngü sınırı.

Gerçek `gemini-3.5-flash` çağrısıyla platform aracı kontrol edildi. Oturum açık UTT tarayıcısında lig, önceki hafta takip sorusu, eğitim, puan raporu ve E-Club raporu sorgulandı. E-Club yanıtı rapor ekranının haftalık görünümüyle karşılaştırıldı; sayfa değişiminde sohbetin korunduğu ve sohbet mesajıyla admin yetkisi istemenin reddedildiği görüldü. Bu, tüm rollerin canlı veritabanında uçtan uca test edildiği anlamına gelmez.

Eğitim bağlantısı düzeltmesinde aynı öneri sorusu canlı UTT oturumunda tekrar soruldu; yanıttaki Semeril, Laropen ve Sosyal Zeka bağlantılarının doğru eğitimleri açtığı, 404 oluşmadığı görüldü. Videolar oynatılmadı. Kategori eşlemesi, sahte/başka kaynağa ait eğitim kimliği reddi ve BM güncel challenge bağlantısı otomatik testlerle kontrol edildi.

Faz 2 otomatik kontrolleri: ilk 20’nin dışındaki adayın önceliklendirilmesi; yarım kalan eğitim/kategori kaybı/puan hedefi ayrımı; kişisel ve ekip rol kapsamları; eksik rapor ve satır sınırı; senaryo kimliği, görünürlük, boş/kesilmiş içerik; kaynaksız rehberlik reddi; sıfır/negatif baz ve TR yıl/hafta sınırları. Canlı UTT oturumunda gerekçeli gelişim önerisi ve dönem karşılaştırması kontrol edildi: güncel 70, önceki 190, fark 120 ve tamamlanmamış hafta uyarısı doğru çıktı. Sosyal Zeka senaryosu boş olduğunda içerik uydurulmadı. BM/TM/üretici/yönetici yeni akışları mock verilerle test edildi; ayrı gerçek hesaplarla uçtan uca test tamamlanmış değildir.

Puan hedefi takip sorusunda öneriler 60/60/55 puanlı yayınlara değişti. Ad/teknik araması eklendikten sonra ilk 20’nin dışındaki 55 puanlı Abilon FAST yayınının senaryosu canlı oturumda okundu; metnin yalnız kısa bir üretim notu olduğu açıkça belirtildi. Bu veri, eğitimin ayrıntılı içeriği hakkında çıkarım yapmaya yeterli değildir. İçerik kalitesi sonraki veri çalışmasının konusudur. Son doğrulamada 158 smoke testi hem UTC hem Pacific/Kiritimati altında geçti; TypeScript ve hedefli lint hata vermedi (sohbet maskotları için mevcut iki `img` uyarısı sürüyor).

Faz 2 devam kontrolünde 162 smoke testi iki saat diliminde geçti; ilk gün/ay uzunluğu/artık yıl sınırları, CC kişi-firma süzgeci ve tamamlananların tekrar/puan hedefinde ayrılması eklendi. Canlı UTT eşit süre testinde iki haftanın ilk iki tamamlanmış günü için 96 ve 70 net puan, %27,1 fark ve bugünün hariç tutulduğu açıklaması görüldü. Açık tekrar isteğinde yalnız tamamlanan Abilon, Semeril ve Enflamasyon Süreçleri listelendi; tekrar gerekçesi kullanıcı isteği olarak gösterildi, ek puan garanti edilmedi. Veri yazımı/izleme başlatma yapılmadı.

## Sonraki kapsam / üretime geçiş kontrolü

1. BM, TM, üretici, yönetici ve E-Club rollerinde yetkili test hesaplarıyla ekran/RPC/yanıt karşılaştırması; eksik kaynak ve istem enjeksiyonu senaryoları.
2. Eczane/Eczanem kullanıcılarının kendi çoklu firma/üyelik bağlarına bağlı kişisel veri araçları; E-Club takım ligi, İÜ üretim görevleri ve sipariş/bakiye sorguları.
3. Sayfa filtreleriyle doğrulanmış bağlam aktarımı. Eşit süreli karşılaştırma tamamlanmış günler düzeyinde çalışır; saat düzeyinde karşılaştırma/gün içi CC dağılımı eklenmemiştir. Aynı sayıda takvim günü, aynı iş günü sayısı veya aynı iş yükü garantisi değildir.
4. Video transkriptleri, katalog genelinde konu/içerik araması ve rol bazında ölçülen öneri kalitesi. Tamamlanan eğitimlerde yeniden çalışma önerisi kategori kaybıyla sınırlıdır; hangi video/soruda hata yapıldığına dair ayrıntı yoktur. Genel sağlık/tedavi danışmanı kapsamı yoktur.
5. Ortak hız sınırı, sağlayıcı veri işleme ayarları, saklama politikası, maliyet takibi ve canlı ortam model doğrulaması.
6. Yazma/iptal/gönderme ancak ayrı yetki, açık önizleme ve kullanıcı onayıyla sonraki sürümde ele alınır.

Mevcut çalışan lig/rapor/puan motorları kaldırılmadı. Eski sabit bilgi istemi, anahtar kelime yönlendirmeleri, anonim devam ve yanıltıcı fallback kaldırıldı. Maskot, sohbet boyutları ve mevcut UTT ekran turları korunmuştur.
