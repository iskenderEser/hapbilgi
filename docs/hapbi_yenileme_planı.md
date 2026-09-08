# HapBi Yenileme Planı

## Değişmez sınırlar

- HapBi maskotu ve mevcut sohbet alanı korunacak.
- Sohbet alanı yeniden tasarlanmayacak.
- İçerik Üreticisi, Admin ve Eczanem üyesi HapBi geliştirme kapsamına alınmayacak.
- HapBilgi’nin mevcut veri üretme, yetkilendirme ve iş süreçleri değiştirilmeyecek.
- Gemini veritabanını sorgulamayacak, sorgu planlamayacak ve çalıştırılacak sorguya karar vermeyecek.
- Sayısal sonuçlar yalnız deterministik kod ve veritabanı işlemleriyle üretilecek.
- Sayısal sorularda Gemini çağrısı `0` olacak.
- Yorum gereken sorularda Gemini en fazla `1` kez çağrılacak.
- Sabit soru tarifleri oluşturulmayacak.
- Temel sorgu yapısı şu olacak:

> **Rol kapsamı + zaman + ölçüt + kırılım + sorgu işlem kategorisi + sıralama/filtre koşulu**

- Her faz ve her alt iş için başlamadan önce ayrı onay alınacak.
- Her faz sonunda yapılan işler belgeye yazılacak, tamamlanma işareti konulacak ve commit için ayrıca onay istenecek.

---

## - [x] Faz 1 — Gerçek veri kaynaklarının çıkarılması

### Amaç

HapBi’nin kullanacağı gerçek HapBilgi verilerini ve bunların teknik anlamlarını kesinleştirmek.

### Yapılacak işler

1. İlgili veritabanı tabloları, görünümleri ve mevcut ortak işlevler belirlenecek.
2. Her veri kaynağı için şu bilgiler çıkarılacak:

   - Kaynağın adı
   - Ürettiği veri
   - Ana kimlik alanı
   - İlişki kurduğu diğer kaynaklar
   - Kullanılacak zaman alanı
   - Boş bırakılabilen alanlar
   - Toplanabilir ve sayılamaz alanlar
   - Veriyi üreten kullanıcı veya olay
3. Ürün, yayın, izleme, beğeni, favori, soru-cevap ve puan kayıtlarının birbirleriyle ilişkisi çıkarılacak.
4. Aynı ürünün farklı yayınlarının ayrı yayın kimlikleri taşıdığı kesin biçimde korunacak.
5. Kullanılabilir veriler ile henüz üretilemeyen veriler ayrılacak.
6. Salt okunur SQL komutları hazırlanacak; komutları kullanıcı çalıştıracak.
7. Sonuçlar bir veri kaynakları tablosuna dönüştürülecek.

### Çıkış koşulu

HapBi’nin hangi sonucu hangi gerçek kaynaktan üreteceği belirsiz kalmayacak.

### Faz 1 İş Sonuçları

#### Alt İş 1–2–3 — Birleşik Veri ve İlişki Tablosu

| Veri alanı | Kaynak | Ürettiği veri | Ana kimlik | İlişki kurduğu kaynak | Bağlantı alanı | Kullanılacak zaman | Boş kalabilen alanlar | Toplanabilir / sayılamaz | Veriyi üreten | Organizasyon ve yayın hattı kuralı |
|---|---|---|---|---|---|---|---|---|---|---|
| Firma çalışanı | kullanicilar | Kimlik, rol, aktiflik ve organizasyon bağları | kullanici_id | firmalar, takimlar, bolgeler | firma_id, takim_id, bolge_id | created_at | Rolün düzeyine göre takım ve bölge boş olabilir | Kullanıcı sayısı sayılabilir; kimlik ve rol toplanamaz | Firma kullanıcı kaydı | UTT/KD_UTT ve BM firma–takım–bölge; PM/KD_PM ve TM firma–takım; üst roller firma düzeyindedir |
| Firma | firmalar | Firma kimliği, adı ve modül durumları | firma_id | takimlar, urunler, kullanicilar, talepler | firma_id | created_at | Oluşturma zamanı boş olabilir | Firma sayısı sayılabilir; ad ve kimlik toplanamaz | Sistem/yönetim kaydı | Firma organizasyon ağacının köküdür |
| Takım | takimlar | Takım kimliği ve adı | takim_id | firmalar, bolgeler, kullanicilar, urunler | firma_id | created_at | Oluşturma zamanı boş olabilir | Takım sayısı sayılabilir; ad ve kimlik toplanamaz | Sistem/yönetim kaydı | Takım yalnız bir firmaya bağlıdır |
| Bölge | bolgeler | Bölge kimliği ve adı | bolge_id | takimlar, kullanicilar | takim_id | created_at | Oluşturma zamanı boş olabilir | Bölge sayısı sayılabilir; ad ve kimlik toplanamaz | Sistem/yönetim kaydı | Bölge yalnız bir takıma, takım da bir firmaya bağlıdır |
| Ürün | urunler | Ürün kimliği, adı, firma ve takım bağı | urun_id | firmalar, takimlar, talepler, v_yayin_kunye | firma_id, takim_id, urun_id | created_at | Takım, barkod ve oluşturma zamanı boş olabilir | Ürün sayısı sayılabilir; ad ve kimlik toplanamaz | Ürün kaydı | Ürün tekildir; aynı ürünün farklı yayınları ayrı yayin_id taşır |
| Talep | talepler | Ürün/eğitim talebi, araç tercihleri ve hedef roller | talep_id | urunler, firmalar, takimlar, ogrenme_araclari, uretim_gorevleri | urun_id, firma_id, takim_id | created_at | Ürün bağı gerektirmeyen eğitimlerde urun_id boş olabilir | Talep sayısı sayılabilir; kimlik ve metin alanları toplanamaz | Firma çalışanının talebi | Ürünlü veya ürün bağımsız yayın hattını başlatır |
| Öğrenme aracı | ogrenme_araclari | Araç türü, dosya, süre, sayfa ve teknik üst veriler | arac_id | talepler, yayin_yonetimi, v_yayin_kunye | talep_id, arac_id, arac_turu | created_at, updated_at | Aracın türüne göre süre, sayfa ve görsel alanlar boş olabilir | Süre, sayfa ve boyut uygun bağlamda toplanabilir; kimlik ve tür toplanamaz | Üretim süreci | Ortak yayın kimliği yayin_id + arac_id + arac_turu ile korunur |
| Soru seti | soru_setleri | Yayına bağlı soru kümesi | soru_seti_id | talepler, ogrenme_araclari, soru_seti_puanlari | talep_id, arac_durum_id | created_at | Eski kayıtlarda talep/araç durum bağı boş olabilir | Soru sayısı sayılabilir; soru metni toplanamaz | Üretim süreci | Soru kümesi tüketim sırasında izleme kimliğine sabitlenir |
| Soru puanı | soru_seti_puanlari | Her soru sırasına atanmış puan | soru_seti_puan_id | Soru seti durumu | soru_seti_durum_id, soru_index | created_at | Oluşturma zamanı boş olabilir | soru_puani toplanabilir; soru sırası toplanamaz | Yayın öncesi puan ataması | Doğru cevap kazanımının ve ilgili kanallardaki yanlış cevap kaybının kaynağıdır |
| Yayın | yayin_yonetimi | Yayın durumu, tarihi, hedef roller, Extra puan ve tekrar süresi | yayin_id | Soru seti durumu, araç durumu, v_yayin_kunye | soru_seti_durum_id, arac_durum_id | yayin_tarihi, created_at, durdurma_tarihi | Yayın/durdurma tarihi, Extra puan ve tekrar süresi duruma göre boş olabilir | Puan ve tekrar günü uygun bağlamda toplanabilir; kimlik/durum toplanamaz | Yayınlama işlemi | Her yayın ayrı yayin_id taşır |
| Yayın künyesi | v_yayin_kunye | Talep, ürün, firma, takım ve araç kimliklerinin ortak görünümü | yayin_id | Talep, ürün, araç ve yayın kaynakları | talep_id, urun_id, arac_id, arac_turu | Kaynak tablolardan gelir | Ürün bağımsız eğitimde urun_id boştur | Kimlikler toplanamaz; yayınlar sayılabilir | Birleşik görünüm | Ürün–yayın ayrımının temel kaynağıdır |
| Yayın ayrıntısı | v_yayin_detay | Yayın, ürün/eğitim, araç, soru ve atanmış puan ayrıntıları | yayin_id | Yayın hattının tüm temel kaynakları | yayin_id, arac_id, soru_seti_id | yayin_tarihi | Aracın ve eğitimin türüne göre alanlar boş olabilir | Puan/süre alanları uygun bağlamda toplanabilir; metinler toplanamaz | Birleşik görünüm | Ürün adı tek başına yayın kimliği yerine kullanılmaz |
| T-Club izleme | izleme_kayitlari | Oturum, gerçek oynatma, tamamlama ve ilerleme | izleme_id | kullanicilar, yayin_yonetimi, oneri_kayitlari | kullanici_id, yayin_id, oneri_id | izleme_baslangic, izleme_bitis, created_at | Bitiş, öneri ve bazı soru alanları boş olabilir | Oturum/oynatma/tamamlama ayrı sayılır; kimlikler toplanamaz | UTT/KD_UTT izleme olayı | Kullanıcı → BM sorumluluğu/bölge → takım → firma olarak toplanabilir |
| T-Club cevap | soru_cevaplari | Verilen cevap ve doğruluk | soru_cevap_id | izleme_kayitlari, kullanicilar | izleme_id, kullanici_id, soru_index | created_at | Oluşturma zamanı boş olabilir | Doğru/yanlış cevap sayılabilir; cevap metni toplanamaz | UTT/KD_UTT cevap olayı | İzleme üzerinden yayın ve ürüne bağlanır |
| T-Club kazanım | kazanilan_puanlar | İzleme, cevaplama, öneri ve oluştuğunda Extra puan | kazanilan_puan_id | Kullanıcı, izleme, yayın ve ürün | kullanici_id, izleme_id, yayin_id, urun_id | created_at | Genel eğitimde veya eski kayıtta urun_id boş olabilir | puan toplanabilir; puan_turu ayrı gruplandırılır | Puan kazanım olayı | Yayın bazında hesaplanır; ürün ve organizasyon kırılımlarına taşınabilir |
| T-Club ileri sarma | ileri_sarma_kayitlari | Atlanan süre ve doğrudan puan kaybı | kayit_id | Kullanıcı, izleme, yayın ve ürün | kullanici_id, izleme_id, yayin_id, urun_id | created_at | Ürün bağı boş olabilir | atlanan_sure ve kaybedilen_puan toplanabilir | İleri sarma olayı | Kaydedilmiş kayıptır; kaçırılmış olası soru puanı ayrıca varsayılmaz |
| T-Club yanlış cevap kaybı | yanlis_cevap_kayitlari | Soru sırası ve kaybedilen puan | kayit_id | Kullanıcı, izleme, yayın ve ürün | kullanici_id, izleme_id, yayin_id, urun_id | created_at | Ürün bağı boş olabilir | Kayıt sayısı ve kaybedilen_puan toplanabilir | Yanlış cevap olayı | Soru cevabıyla aynı izleme ve kullanıcıya bağlıdır |
| T-Club öneri | oneri_kayitlari | BM tarafından gönderilen öneri ve izlenme durumu | oneri_id | Yayın, öneren BM ve alıcı UTT/KD_UTT | yayin_id, oneren_id, kullanici_id | created_at, oneri_baslangic, oneri_bitis | izlendi_mi boş olabilir | Öneri ve izlenen öneri sayılabilir; kimlikler toplanamaz | BM öneri olayı | BM → bölgesindeki UTT/KD_UTT hattıdır |
| T-Club öneri kaybı | oneri_kayip_kayitlari | Zamanında tüketilmeyen önerinin puan kaybı | kayit_id | Kullanıcı, öneri, yayın ve ürün | kullanici_id, oneri_id, yayin_id, urun_id | created_at | Ürün bağı boş olabilir | kaybedilen_puan toplanabilir | Öneri süresi olayı | Kayıp öneri ve alıcıyla birlikte doğrulanır |
| T-Club tekrar | yayin_tekrar_kayitlari | Yayın turu ve başlangıcı | tekrar_id | yayin_yonetimi | yayin_id, tur_no | baslangic_tarihi | Yok | Tekrar sayısı sayılabilir; tur numarası toplam puan değildir | Yayın turu olayı | Extra puan uygunluğunun veri hattında kullanılır |
| T-Club beğeni/favori | video_begeniler, video_favoriler | Yayın beğenisi ve favorisi | begeni_id, favori_id | Kullanıcı ve yayın | kullanici_id, yayin_id | created_at | Oluşturma zamanı boş olabilir | Ayrı sayılabilir; performans puanına eklenmez | Kullanıcı etkileşimi | Yayın üzerinden ürüne veya ürün bağımsız eğitime bağlanır |
| C-Club challenge | challenge_kayitlari | BM’ler arası challenge ve tamamlanma durumu | challenge_id | Gönderen BM, alan BM, yayın ve araç | gonderen_id, alan_id, yayin_id, arac_id | created_at, son_tarih | Oluşturma zamanı boş olabilir | Challenge/tamamlanma sayılabilir | BM challenge olayı | Yalnız aktif ve aynı firmadaki BM’ler arasındadır |
| C-Club izleme | cc_izleme_kayitlari | BM izleme ve tamamlama olayı | izleme_id | BM, challenge, yayın ve araç | bm_id, challenge_id, yayin_id, arac_id | izleme_baslangic, izleme_bitis, created_at | Challenge ve bitiş alanları boş olabilir | İzleme/tamamlama ayrı sayılır | BM tüketim olayı | C-Club sonucu BM’nin kişisel firma kapsamında kalır |
| C-Club kazanım | cc_kazanilan_puanlar | İzleme, cevap, Extra, gönderme ve yönlendirme puanları | puan_id | BM, yayın, izleme ve challenge | bm_id, yayin_id, izleme_id, challenge_id | created_at | İzleme ve challenge bağı puan türüne göre boş olabilir | puan tür bazında toplanabilir | C-Club puan olayı | T-Club bölge/takım toplamına karıştırılmaz |
| C-Club kayıpları | cc_ileri_sarma_kayitlari, cc_yanlis_cevap_kayitlari | İleri sarma ve yanlış cevap kaybı | kayit_id | BM, izleme ve yayın | bm_id, izleme_id, yayin_id | created_at | Yok | kaybedilen_puan toplanabilir | C-Club kayıp olayı | Kişisel BM sonucu içinde kullanılır |
| C-Club lig özeti | cc_ligi_ozet | Günlük puan bileşenleri ve kayıplar | kullanici_id + tarih | BM ve firma | kullanici_id | tarih, guncellenme | Yok | Bileşenler uygun zaman aralığında toplanabilir | Lig birleştirme işlemi | Firma içi BM sıralamasına kaynak olur |
| E-Club öneri | eclub_oneri_kayitlari | UTT/KD_UTT’nin E-Club kişisine önerisi | oneri_id | İç kullanıcı, E-Club kişisi, yayın ve araç | oneren_id, kisi_id, yayin_id, arac_id | created_at, öneri başlangıç/bitişi | izlendi_mi boş olabilir | Öneri ve tüketim durumu sayılabilir | UTT/KD_UTT öneri olayı | E-Club kişisi HapBi kullanmaz; veri yetkili firma çalışanının raporuna kaynak olur |
| E-Club izleme | eclub_izleme_kayitlari | E-Club izleme ve tamamlama | izleme_id | Kişi, öneri ve yayın | kisi_id, oneri_id, yayin_id | izleme_baslangic, izleme_bitis, created_at | Bitiş ve bazı soru alanları boş olabilir | İzleme ve tamamlama ayrı sayılır | E-Club kişisinin tüketimi | Firma/takım/bölge yetki kapsamında raporlanır |
| E-Club kazanım/kayıp | E-Club puan ve kayıp tabloları | Kazanım, cevap ve kayıp olayları | Her tablonun kayıt/puan kimliği | Kişi, izleme, öneri, yayın ve ürün | kisi_id, izleme_id, oneri_id, yayin_id, urun_id | created_at | Genel eğitimde ürün bağı boş olabilir | Puan/kayıp toplanabilir; yanlış cevap E-Club’da puan kaybı üretmez | E-Club tüketim olayları | Yalnız yetkili firma çalışanına rapor verisi olur |
| E-Club UTT katkısı | eclub_utt_puanlari | UTT’nin öneriden doğan katkı puanı | utt_puan_id | UTT, kişi, öneri, izleme, yayın ve ürün | utt_id, kisi_id, oneri_id, izleme_id, yayin_id, urun_id | created_at | Genel eğitimde ürün bağı boş olabilir | puan toplanabilir | E-Club tüketiminin UTT katkı olayı | UTT/takım/bölge/firma kırılımlarına kaynak olur |
| E-Club etkileşim | eclub_video_begeniler, eclub_video_favoriler | Beğeni ve favori | begeni_id, favori_id | E-Club kişisi ve yayın | kisi_id, yayin_id | created_at | Oluşturma zamanı boş olabilir | Ayrı sayılabilir; performans puanına eklenmez | E-Club kişisinin etkileşimi | Yetkili firma çalışanına rapor verisi olur |
| Üretim | uretim_gorevleri | Talebe bağlı aşama, durum, atama ve tamamlanma | gorev_id | Talep, araç ve soru seti | talep_id, arac_id, soru_seti_id | created_at ve aşamaya özgü tarihler | Aşamaya göre atama/başlama/tamamlama alanları boş olabilir | Görevler durum/aşama bazında sayılabilir; kimlikler toplanamaz | Üretim iş akışı | Talep → görev → araç/soru seti → yayın hattını tamamlar |

Alt İş 4’teki tek ürünün farklı yayın kimlikleri taşıması kuralı bu tabloda urun_id ile yayin_id ayrımıyla korunmuş ve canlı veride doğrulanmıştır.

#### Alt İş 5 — Veri Üretilebilirlik Tablosu

| Sonuç veya ölçüt | Durum | Kanıt kaynağı | Hesaplama biçimi | Canlı doğrulama veya sınır |
|---|---|---|---|---|
| Ürün sayısı | Doğrudan üretilebilir | urunler | urun_id sayılır | 8 ürün var |
| Ürün başına yayın sayısı | Hesaplanarak üretilebilir | v_yayin_kunye | urun_id altındaki ayrı yayin_id değerleri sayılır | 5 ürünün birden fazla yayını var |
| Yayını olmayan ürün | Hesaplanarak üretilebilir | urunler, v_yayin_kunye | Yayın künyesinde bulunmayan ürünler seçilir | Mill firmasında 3 ürün var |
| Ürün bağımsız eğitim yayını | Doğrudan ayrılabilir | v_yayin_kunye, talepler | urun_id boş ve eğitim türü dolu yayınlar seçilir | 11 yayın var; boş ürün kimliği hata değil |
| Talep sayısı | Doğrudan üretilebilir | talepler | Talep kayıtları sayılır | 50 talep var |
| Öğrenme aracı sayısı | Doğrudan üretilebilir | ogrenme_araclari | Araç kayıtları sayılır | 47 araç var |
| Araç türü dağılımı | Doğrudan üretilebilir | ogrenme_araclari | arac_turu bazında gruplanır | Canlı kayıtların tamamı video; diğer türler canlı veriyle henüz doğrulanmadı |
| Soru seti ve soru puanı | Doğrudan üretilebilir | soru_setleri, soru_seti_puanlari | Soru seti ve soru sırası bazında okunur | 47 soru seti var |
| Yayın tarihi ve durumu | Doğrudan üretilebilir | yayin_yonetimi | Yayın kaydından okunur | 47 yayının tamamı yayında |
| Atanmış izleme/araç puanı | Doğrudan üretilebilir | v_yayin_detay | Yayın kimliğiyle okunur | Puan alanları yayın hattında mevcut |
| Atanmış Extra puan | Doğrudan üretilebilir | yayin_yonetimi, v_yayin_detay | Yayın kimliğiyle okunur | Atama ile gerçekleşen kazanım ayrı tutulur |
| Tekrar periyodu ve yayın turu | Doğrudan üretilebilir | yayin_yonetimi, yayin_tekrar_kayitlari | Yayın ve tur bazında okunur | 38 tekrar kaydı, 36 yayın ve en yüksek 3. tur var |
| T-Club izleme oturumu | Doğrudan üretilebilir | izleme_kayitlari | Tüm izleme kayıtları sayılır | 140 oturum var; gerçek oynatma/tamamlama değildir |
| T-Club gerçek oynatma | Doğrudan üretilebilir | izleme_kayitlari | gercek_oynatma_mi doğru olanlar sayılır | 39 gerçek oynatma var |
| T-Club tamamlanan izleme | Doğrudan üretilebilir | izleme_kayitlari | tamamlandi_mi doğru olanlar sayılır | 37 tamamlanan izleme var |
| T-Club benzersiz izleyici | Hesaplanarak üretilebilir | izleme_kayitlari | Ayrı kullanici_id değerleri sayılır | Canlıda 3 kullanıcı var |
| T-Club doğru cevap sayısı | Doğrudan üretilebilir | soru_cevaplari | dogru_mu doğru olanlar sayılır | 41 doğru cevap var |
| T-Club yanlış cevap sayısı | Doğrudan üretilebilir | soru_cevaplari | dogru_mu yanlış olanlar sayılır | 10 yanlış cevap var |
| T-Club izleme puanı | Doğrudan üretilebilir | kazanilan_puanlar | İzleme türündeki puanlar toplanır | 28 kayıtta 1.265 puan var |
| T-Club cevaplama puanı | Doğrudan üretilebilir | kazanilan_puanlar | Cevaplama türündeki puanlar toplanır | 41 kayıtta 168 puan var |
| T-Club öneri puanı | Doğrudan üretilebilir | kazanilan_puanlar | Öneri türündeki puanlar toplanır | 1 kayıtta 10 puan var |
| T-Club Extra kazanımı | Kaynak mevcut, canlı örnek yok | kazanilan_puanlar, yayin_tekrar_kayitlari | Extra kaydı oluştuğunda toplanır | Canlı veride Extra kazanım kaydı yok |
| T-Club ileri sarılan süre | Doğrudan üretilebilir | ileri_sarma_kayitlari | atlanan_sure toplanır | 5 kayıtta 542 saniye var |
| T-Club ileri sarma kaybı | Doğrudan üretilebilir | ileri_sarma_kayitlari | kaybedilen_puan toplanır | Toplam 140 puan kaybı var |
| T-Club yanlış cevap kaybı | Doğrudan üretilebilir | yanlis_cevap_kayitlari | kaybedilen_puan toplanır | 10 kayıtta 43 puan kaybı var |
| T-Club öneri sayısı ve durumu | Doğrudan üretilebilir | oneri_kayitlari | Kayıtlar ve izlendi_mi durumu sayılır | 5 önerinin 1’i izlenmiş, 4’ü izlenmemiş |
| T-Club öneri kaybı | Doğrudan üretilebilir | oneri_kayip_kayitlari | kaybedilen_puan toplanır | 4 kayıtta 40 puan kaybı var |
| T-Club beğeni | Doğrudan üretilebilir | video_begeniler | Kayıtlar sayılır | 1 beğeni var; puana katılmaz |
| T-Club favori | Doğrudan üretilebilir | video_favoriler | Kayıtlar sayılır | 3 favori var; puana katılmaz |
| T-Club toplam kazanım | Hesaplanarak üretilebilir | kazanilan_puanlar | Aynı zaman ve kapsam içindeki puanlar toplanır | Canlı toplam 1.443 puan |
| T-Club toplam kayıp | Hesaplanarak üretilebilir | Üç kayıp tablosu | Aynı zaman ve kapsam içindeki kayıplar toplanır | Üç kaynak da doğrulandı; formül sonraki fazda kesinleştirilecek |
| T-Club net puan | Hesaplanarak üretilebilir | Kazanım ve kayıp tabloları | Doğrulanmış kazanımlar eksi doğrulanmış kayıplar | Bileşenler mevcut; kesin formül sonraki fazda kurulacak |
| T-Club sıralama, fark, katkı ve pay | Hesaplanarak üretilebilir | Olay ve organizasyon tabloları | Doğrulanmış değerler kırılıma göre işlenir | Kaynak ve ilişki hattı mevcut; işlem kuralları sonraki fazlarda kurulacak |
| C-Club challenge sayısı/tamamlanması | Doğrudan üretilebilir | challenge_kayitlari | Kayıtlar ve izlendi_mi durumu sayılır | 1 challenge var ve tamamlanmış |
| C-Club izleme/tamamlama | Doğrudan üretilebilir | cc_izleme_kayitlari | İzleme ve tamamlanma ayrı sayılır | 8 izlemenin 6’sı tamamlanmış |
| C-Club kazanılan puan | Doğrudan üretilebilir | cc_kazanilan_puanlar | puan tür bazında toplanır | 8 kayıtta toplam 140 puan var |
| C-Club ileri sarma kaybı | Kaynak mevcut, canlı kayıt yok | cc_ileri_sarma_kayitlari | Kayıt oluştuğunda kayıp toplanır | Canlı toplam boş değerdir; kendiliğinden sıfıra çevrilmez |
| C-Club yanlış cevap/kayıp | Kaynak mevcut, canlı kayıt yok | cc_yanlis_cevap_kayitlari | Kayıt ve kayıp ayrı hesaplanır | Canlı yanlış cevap kaydı yok |
| C-Club doğru cevap sayısı | Henüz kesin üretilemez | Ayrı doğru cevap olay kaynağı doğrulanmadı | Puan kaydı doğrudan cevap olayı yerine kullanılmaz | Ayrı kaynak gerekir |
| C-Club lig sonucu/sıralaması | Hesaplanarak üretilebilir | cc_ligi_ozet | Tarih aralığında bileşenler toplanır ve sıralanır | 4 lig özeti satırı var |
| E-Club öneri sayısı | Doğrudan üretilebilir | eclub_oneri_kayitlari | Kayıtlar sayılır | 50 öneri var |
| E-Club izleme/tamamlama | Doğrudan üretilebilir | eclub_izleme_kayitlari | İzleme ve tamamlanma ayrı sayılır | 38 izlemenin 35’i tamamlanmış |
| E-Club toplam kazanılan puan | Doğrudan üretilebilir | eclub_kazanilan_puanlar | puan toplanır | Toplam 2.145 puan var |
| E-Club doğru cevap/puan | Doğrudan üretilebilir | eclub_dogru_cevap_kayitlari | Kayıt ve kazanilan_puan ayrı hesaplanır | 46 cevap ve 230 puan var |
| E-Club yanlış cevap | Doğrudan üretilebilir | eclub_yanlis_cevap_kayitlari | Kayıtlar sayılır | 14 yanlış cevap var; puan kaybı yok |
| E-Club ileri sarma kaybı | Doğrudan üretilebilir | eclub_ileri_sarma_kayitlari | kaybedilen_puan toplanır | Toplam 198 puan kaybı var |
| E-Club öneri kaybı | Kaynak mevcut, canlı kayıt yok | eclub_oneri_kayip_kayitlari | Kayıt oluştuğunda kayıp toplanır | Canlı toplam boş değerdir; kendiliğinden sıfıra çevrilmez |
| E-Club UTT katkı puanı | Doğrudan üretilebilir | eclub_utt_puanlari | puan toplanır | Toplam 350 puan var |
| E-Club beğeni/favori | Doğrudan üretilebilir | eclub_video_begeniler, eclub_video_favoriler | Ayrı ayrı sayılır | 14 beğeni ve 10 favori var; performans puanına katılmaz |
| Üretim talebi | Doğrudan üretilebilir | talepler | Kayıtlar sayılır | 50 talep var |
| Üretim görevi | Doğrudan üretilebilir | uretim_gorevleri | Durum ve aşama bazında sayılır | 57 görev var; 1 atama bekliyor, 2 hazırlanıyor |
| Yayına dönüşen talep | Hesaplanarak üretilebilir | Talep, araç ve yayın kaynakları | Talep → araç → yayın zinciri sayılır | 47 araç ve 47 yayın var |
| Olayların zaman kırılımı | Hesaplanarak üretilebilir | Her olayın kendi zaman alanı | Seçilen aralık olay zamanına uygulanır | Denetlenen olay kaynaklarında boş zaman alanı yok |
| İleri sarma nedeniyle kaçırılmış olası cevap puanı | Üretilemez | Doğrulanmış doğrudan kaynak yok | Varsayım yapılmaz | Kayıtlı ileri sarma kaybıyla karıştırılmaz |
| İçeriğin neden izlenmediği | Üretilemez | Doğrulanmış neden kaydı yok | Varsayım yapılmaz | Yalnız izlenme durumu söylenebilir |
| Satış başarısı veya mesleki yeterlilik | Üretilemez | Öğrenme ve puan kayıtları bu sonucu kanıtlamaz | Çıkarım yapılmaz | Puan bu anlamlarda yorumlanmaz |
| Kesin kişisel davranış nedeni | Üretilemez | Doğrulanmış neden kaydı yok | Çıkarım yapılmaz | Yapay zekâ tarafından da kanıtsız üretilmez |

#### Alt İş 7 — Nihai Veri Kaynakları Tablosu

| Veri alanı | Üretilecek sonuç veya ölçüt | Veri kaynağı | Ana kimlik | İlişki ve kırılım yolu | Üreten kullanıcı veya olay | Zaman alanı | Üretim biçimi | Canlı doğrulama ve sınır |
|---|---|---|---|---|---|---|---|---|
| Organizasyon | Firma çalışanı kimliği ve rolü | kullanicilar | kullanici_id | Kullanıcı → firma → takım → bölge | Firma kullanıcı kaydı | created_at | Doğrudan okunabilir | Organizasyon bağlarında uyumsuzluk yok; Admin ve İçerik Üreticisi kapsam dışı |
| Organizasyon | Firma, takım ve bölge | firmalar, takimlar, bolgeler | firma_id, takim_id, bolge_id | Bölge → takım → firma | Sistem/yönetim kaydı | created_at | Doğrudan okunabilir | Yedi hiyerarşi denetiminin tamamı 0 hata verdi |
| Organizasyon | Ürün | urunler | urun_id | Ürün → takım/firma | Ürün kaydı | created_at | Doğrudan okunabilir | 8 ürün var; 5’inin birden fazla yayını, 3’ünün henüz yayını yok |
| Yayın hattı | Talep | talepler | talep_id | Ürün/eğitim → talep | Firma çalışanının talebi | created_at | Doğrudan sayılabilir | 50 talep var |
| Yayın hattı | Öğrenme aracı | ogrenme_araclari | arac_id | Talep → araç | Üretim süreci | created_at | Doğrudan sayılabilir | 47 araç var; canlıda tamamı video |
| Yayın hattı | Soru seti ve soru puanı | soru_setleri, soru_seti_puanlari | soru_seti_id | Talep/araç → soru seti → soru puanı | Üretim süreci | created_at | Doğrudan okunabilir | 47 soru seti var |
| Yayın hattı | Yayın ve yayın ayrıntıları | yayin_yonetimi, v_yayin_kunye, v_yayin_detay | yayin_id | Ürün/eğitim → talep → araç → yayın | Yayınlama işlemi | yayin_tarihi, created_at | Doğrudan okunabilir | 47 yayının tamamında talep, araç ve araç türü var; hiçbir yayın birden fazla ürüne bağlı değil |
| Yayın hattı | Ürün bağımsız eğitim | v_yayin_kunye, talepler | yayin_id | Eğitim talebi → yayın | Yayınlama işlemi | Yayın zamanı | Doğrudan ayrılabilir | 11 medikal, insan kaynakları veya yönetim eğitimi yayını var |
| T-Club | İzleme oturumu | izleme_kayitlari | izleme_id | Kullanıcı → yayın → ürün/eğitim | İzleme oturumunun açılması | izleme_baslangic | Sayılarak üretilebilir | 140 kayıt; gerçek oynatma ve tamamlamadan ayrıdır |
| T-Club | Gerçek oynatma | izleme_kayitlari | izleme_id | Kullanıcı → yayın | Gerçek oynatma | izleme_baslangic | gercek_oynatma_mi ile sayılır | 39 kayıt |
| T-Club | Tamamlanan izleme | izleme_kayitlari | izleme_id | Kullanıcı → yayın | Tamamlama olayı | izleme_bitis | tamamlandi_mi ile sayılır | 37 kayıt |
| T-Club | Doğru ve yanlış cevap | soru_cevaplari | soru_cevap_id | Cevap → izleme → yayın → ürün/eğitim | Kullanıcı cevabı | created_at | Doğruluk durumuna göre sayılır | 41 doğru, 10 yanlış cevap; ilişkiler tutarlı |
| T-Club | İzleme, cevaplama, öneri ve Extra kazanımı | kazanilan_puanlar | kazanilan_puan_id | Puan → kullanıcı/izleme/yayın/ürün | Puan olayı | created_at | puan_turu bazında toplanır | Canlıda 1.443 toplam puan; Extra kaydı henüz yok |
| T-Club | İleri sarılan süre ve kayıp | ileri_sarma_kayitlari | kayit_id | Kayıp → izleme → yayın → ürün | İleri sarma olayı | created_at | Süre ve kayıp ayrı toplanır | 542 saniye ve 140 puan kaybı |
| T-Club | Yanlış cevap kaybı | yanlis_cevap_kayitlari | kayit_id | Kayıp → izleme → yayın → ürün | Yanlış cevap olayı | created_at | Sayı ve kayıp ayrı hesaplanır | 10 kayıtta 43 puan kaybı |
| T-Club | Öneri ve öneri kaybı | oneri_kayitlari, oneri_kayip_kayitlari | oneri_id, kayit_id | BM → UTT/KD_UTT → yayın → ürün/eğitim | Öneri ve süre olayı | Öneri tarihleri, created_at | Sayı ve kayıp ayrı hesaplanır | 5 öneri; 4 kayıtta 40 puan kaybı |
| T-Club | Beğeni ve favori | video_begeniler, video_favoriler | begeni_id, favori_id | Kullanıcı → yayın → ürün/eğitim | Kullanıcı etkileşimi | created_at | Ayrı ayrı sayılır | 1 beğeni, 3 favori; performans puanına katılmaz |
| T-Club | Tekrar | yayin_tekrar_kayitlari | tekrar_id | Tekrar → yayın | Yayın turu | baslangic_tarihi | Yayın/tur bazında sayılır | 38 kayıt, 36 yayın, en yüksek 3. tur |
| T-Club | Toplam, net, sıralama, fark, katkı ve pay | T-Club olay ve organizasyon kaynakları | Seçilen kırılım kimliği | Kişi/ürün → bölge → takım → firma | Doğrulanmış olaylar | Aynı zaman aralığı | Hesaplanarak üretilebilir | Kaynak ve ilişki yolu doğrulandı; kesin formül ve işlem kuralları sonraki fazlarda kurulacak |
| C-Club | Challenge | challenge_kayitlari | challenge_id | Gönderen BM → alan BM → yayın | BM challenge olayı | created_at | Sayılabilir | 1 challenge var ve tamamlanmış; 14 ilişki denetiminin tamamı 0 hata verdi |
| C-Club | İzleme ve tamamlama | cc_izleme_kayitlari | izleme_id | BM → challenge → yayın | BM tüketimi | İzleme başlangıç/bitişi | Ayrı sayılabilir | 8 izlemenin 6’sı tamamlanmış |
| C-Club | Kazanım ve kayıplar | cc_kazanilan_puanlar, cc_ileri_sarma_kayitlari, cc_yanlis_cevap_kayitlari | Puan/kayıt kimlikleri | BM → izleme/challenge → yayın | C-Club puan olayları | created_at | Tür bazında toplanır | 140 kazanım puanı var; canlı ileri sarma ve yanlış cevap kaybı kaydı yok |
| C-Club | Doğru cevap sayısı | Ayrı doğru cevap kaynağı yok | — | — | — | — | Henüz kesin üretilemez | Puan kaydı cevap olayı sayılmayacak |
| C-Club | Lig sonucu | cc_ligi_ozet | kullanici_id + tarih | BM → firma | Lig birleştirme işlemi | tarih | Toplanıp sıralanabilir | 4 özet satırı var |
| E-Club raporu | Öneri | eclub_oneri_kayitlari | oneri_id | UTT/KD_UTT → E-Club kişisi → yayın | Firma çalışanının önerisi | Öneri tarihleri, created_at | Sayılabilir | 50 öneri; kişi, yayın ve araç bağları tutarlı |
| E-Club raporu | İzleme ve tamamlama | eclub_izleme_kayitlari | izleme_id | Kişi → öneri → yayın | E-Club tüketimi | İzleme başlangıç/bitişi | Ayrı sayılabilir | 38 izlemenin 35’i tamamlanmış |
| E-Club raporu | Kazanım, doğru/yanlış cevap ve kayıp | E-Club puan ve kayıp kaynakları | Kayıt/puan kimlikleri | Kişi → izleme → yayın → ürün/eğitim | E-Club olayları | created_at | Sayı ve puan ayrı hesaplanır | 2.145 kazanım, 46 doğru, 14 yanlış cevap, 198 ileri sarma kaybı; yanlış cevap kaybı yok |
| E-Club raporu | UTT katkısı | eclub_utt_puanlari | utt_puan_id | UTT → kişi → öneri → izleme → yayın | E-Club tüketimi | created_at | Toplanabilir | 350 puan; ilişkiler tutarlı |
| E-Club raporu | Beğeni ve favori | eclub_video_begeniler, eclub_video_favoriler | Etkileşim kimliği | Kişi → yayın → ürün/eğitim | E-Club etkileşimi | created_at | Ayrı sayılabilir | 14 beğeni, 10 favori; performans puanına katılmaz |
| E-Club erişimi | Rapor verisinin kullanımı | E-Club ve organizasyon kaynakları | Firma/takım/bölge kimliği | Yetkili firma çalışanı → E-Club raporu | E-Club olayları | Seçilen olay zamanı | Yetki kapsamında okunur | E-Club kişileri HapBi kullanıcısı değildir |
| Üretim | Görev, aşama ve durum | uretim_gorevleri | gorev_id | Görev → talep → araç/soru seti | Üretim iş akışı | created_at ve aşama tarihleri | Sayılıp gruplanabilir | 57 görev; 1 atama bekliyor, 2 hazırlanıyor; ilişki kopukluğu yok |
| Üretim | Yayına dönüşen talep | Talep, araç ve yayın kaynakları | talep_id + arac_id + yayin_id | Talep → araç → yayın | Üretim ve yayınlama | Oluşturma/yayın zamanı | İlişki üzerinden sayılır | 50 talep, 47 araç ve 47 yayın |
| Genel | Zaman kırılımı | İlgili olay kaynağı | Olay kimliği | Ölçüt → kendi olay zamanı | İlgili olay | Ölçüte özgü zaman alanı | Aralık uygulanarak üretilebilir | Denetlenen T-Club, C-Club, E-Club ve üretim zaman alanlarında boş kayıt yok |
| Üretilemeyen | İleri sarma nedeniyle kaçırılmış olası cevap puanı | Doğrulanmış kaynak yok | — | — | Varsayımsal sonuç | — | Üretilemez | Kayıtlı ileri sarma kaybıyla karıştırılmaz |
| Üretilemeyen | İçeriğin neden izlenmediği | Doğrulanmış neden kaydı yok | — | — | Bilinmeyen kullanıcı nedeni | — | Üretilemez | Yalnız izlenme durumu söylenebilir |
| Üretilemeyen | Satış başarısı, mesleki yeterlilik veya kesin kişisel neden | Öğrenme kayıtları bu sonuçları kanıtlamaz | — | — | — | — | Üretilemez | Yapay zekâ tarafından da kanıtsız üretilmeyecek |

Alt İş 6 kapsamında kullanıcı tarafından Supabase’de çalıştırılan salt okunur SQL komutlarıyla 41 kaynağın varlığı; yayın ilişkileri; T-Club, C-Club, E-Club ve üretim veri hatları ile olay zamanları doğrulanmıştır. Kayıt bulunmayan toplamlar kendiliğinden 0 kabul edilmeyecektir.

---

## - [x] Faz 2 — Rol ve kapsam haritasının kurulması

### Amaç

Her kullanıcının hangi kişi, takım, bölge, firma, ürün ve yayın verilerini görebileceğini belirlemek.

### Yapılacak işler

1. Rol ve yetkiler için tek geçerli kaynak olarak Bluebook kullanılacak.
2. Gerçek oturum ve rol çözümleme kodları Bluebook ile karşılaştırılacak.
3. Her kapsam içindeki izinli kimlikler sunucuda çözülecek:

   - Kullanıcının kendi kimliği
   - Bağlı olduğu takım
   - Bağlı olduğu bölge
   - Bağlı olduğu firma
   - Sorumlu olduğu ürünler
   - Görebileceği yayınlar
4. Kullanıcının yazdığı firma, takım, bölge veya kişi kimliği doğrudan güvenilir kabul edilmeyecek.
5. Kapsam dışı kimlikler sorguya eklenmeden reddedilecek.
6. İçerik Üreticisi, Admin, Eczanem üyesi ve E-Club üyesi bu haritaya dahil edilmeyecek; HapBi E-Club üyelerinin ekranlarında gösterilmeyecek.
7. Rol × görülebilir kırılım tablosu hazırlanacak.

### Planlanan kod alanı

- `lib/hapbi/kapsam.ts`
- `lib/hapbi/roller.ts`

### Çıkış koşulu

Her desteklenen rol için görülebilir veri kapsamı sunucu tarafından kesin olarak üretilecek.

### Faz 2 İş Sonuçları

| Veri alanı | Kaynak | Veri ve ilişki | Görebilen roller ve kapsamları |
|---|---|---|---|
| Firma çalışanı | `kullanicilar` | Kullanıcı → firma → takım → bölge | **UTT/KD_UTT:** kendisi. **BM:** kendisi ve bölgesindeki UTT/KD_UTT’ler. **TM:** takımındaki BM, UTT ve KD_UTT’ler. **Ürün ailesi:** takım kapsamındaki rapor sonuçları. **Diğer üretici ve yönetici rolleri:** firma kapsamındaki yetkili rapor sonuçları. |
| Firma | `firmalar` | Organizasyonun kökü | Bütün desteklenen roller yalnız kendi firmalarını görür. Başka firma kimliği kabul edilmez. |
| Takım | `takimlar` | Takım → firma | **UTT/KD_UTT, BM, TM ve ürün ailesi:** kendi takımı. **Firma düzeyindeki üretici ve yönetici rolleri:** kendi firmalarındaki takımlar. |
| Bölge | `bolgeler` | Bölge → takım → firma | **UTT/KD_UTT ve BM:** kendi bölgesi. **TM ve ürün ailesi:** kendi takımlarındaki bölgeler. **Firma düzeyindeki üretici ve yönetici rolleri:** kendi firmalarındaki bölgeler. |
| Ürün | `urunler` | Ürün → takım/firma | **UTT/KD_UTT:** kendisine açık yayınların ürünleri. **BM:** bölgesindeki T-Club ve kişisel C-Club sonuçlarındaki ürünler. **TM:** takımındaki ürünler. **Ürün ailesi:** yetkili takımındaki ürünler. **Diğer üreticiler:** yetenek profiline uygun firma içerikleri. **Yöneticiler:** firma ürünleri. |
| Talep | `talepler` | Ürün/eğitim → talep | **Üretici rolleri:** kendi açtıkları talepler. **Ürün ailesi:** takım üretim raporu. **Firma düzeyindeki üreticiler ve yöneticiler:** yetkili firma üretim raporu. **UTT/KD_UTT, BM ve TM:** doğrudan talep kaydı göremez. |
| Öğrenme aracı | `ogrenme_araclari` | Talep → araç | **UTT/KD_UTT:** kendisine açık T-Club araçları. **BM:** kişisel C-Club araçları ve bölgesine önerilebilen T-Club araçları. **TM:** takım raporundaki araç sonuçları. **Ürün ailesi:** takım/ürün araçları. **Diğer üreticiler:** yetenek profiline uygun araçlar. **Yöneticiler:** firma araçları. |
| Soru seti | `soru_setleri` | Araç/yayın → soru seti | Roller yalnız kendi kapsamlarındaki soru sonuçlarını görür. Ham cevap anahtarı açılmaz. Üretici, kendi talebine bağlı inceleme verisini görebilir. |
| Soru puanı | `soru_seti_puanlari` | Soru sırası → puan | **UTT/KD_UTT ve BM:** kişisel tüketim puanı. **BM:** ayrıca bölgesindeki UTT/KD_UTT sonuçları. **TM:** takım sonuçları. **Ürün ailesi:** takım/ürün sonuçları. **Diğer üreticiler ve yöneticiler:** yetkili firma raporu. |
| Yayın | `yayin_yonetimi` | Talep/araç/soru seti → yayın | **UTT/KD_UTT:** hedef rolüne ve organizasyonuna açık yayınlar. **BM:** kişisel C-Club ve bölgesine önerilebilen T-Club yayınları. **TM:** takım yayın sonuçları. **Ürün ailesi:** takım/ürün yayınları. **Diğer üreticiler:** yetenek profiline uygun yayınlar. **Yöneticiler:** firma yayınları. |
| Yayın künyesi | `v_yayin_kunye` | Yayın → talep, ürün, firma, takım ve araç | Görülebilir `yayin_id`, `urun_id`, `takim_id` ve `firma_id` değerleri kullanıcının rol kapsamından sunucuda üretilecek. Kullanıcının yazdığı kimlikler yetki kanıtı sayılmayacak. |
| Yayın ayrıntısı | `v_yayin_detay` | Yayın → ürün/eğitim, araç, soru ve puan | Yalnız rol kapsamında doğrulanmış yayınlar okunabilecek. Ürün ailesi takım/ürün; diğer üreticiler yetenek profili; yöneticiler firma; saha rolleri kendi T-Club/C-Club kapsamlarıyla sınırlı olacak. |
| T-Club izleme | `izleme_kayitlari` | Kullanıcı → yayın → ürün/eğitim | **UTT/KD_UTT:** kendi izlemesi. **BM:** bölgesindeki UTT/KD_UTT izlemeleri. **TM:** takımındaki UTT/KD_UTT izlemeleri. **Ürün ailesi:** takım/ürün sonuçları. **Diğer üreticiler:** ilgili firma yayınlarının rapor sonuçları. **Yöneticiler:** firma sonuçları. |
| T-Club cevap | `soru_cevaplari` | Cevap → izleme → kullanıcı → yayın | T-Club izleme kapsamıyla aynı sınır uygulanır. Ham cevap anahtarı gösterilmez. |
| T-Club kazanım | `kazanilan_puanlar` | Kullanıcı → izleme → yayın → ürün | **UTT/KD_UTT:** kişisel puan. **BM:** bölgesindeki UTT/KD_UTT puanları. **TM:** takım puanları. **Ürün ailesi:** takım/ürün puanları. **Diğer üreticiler:** ilgili yayınların firma sonuçları. **Yöneticiler:** firma toplamları. |
| T-Club ileri sarma | `ileri_sarma_kayitlari` | Kullanıcı → izleme → yayın → ürün kaybı | T-Club kazanım kapsamıyla aynı sınır uygulanır. Yalnız kaydedilmiş süre ve kayıp gösterilir. |
| T-Club yanlış cevap kaybı | `yanlis_cevap_kayitlari` | Kullanıcı → izleme → yayın → ürün kaybı | T-Club kazanım kapsamıyla aynı sınır uygulanır. Kapsam dışındaki kişi sorguya alınmaz. |
| T-Club öneri | `oneri_kayitlari` | BM → UTT/KD_UTT → yayın | **UTT/KD_UTT:** yalnız kendisine gelen öneriler. **BM:** bölgesindeki alıcılara yaptığı öneriler. **TM:** takımındaki BM–UTT öneri akışı. **Üretici ve yöneticiler:** yalnız yetkili toplu rapor sonuçları. |
| T-Club öneri kaybı | `oneri_kayip_kayitlari` | Öneri → alıcı → yayın → ürün | **UTT/KD_UTT:** kendi kaybı. **BM:** bölge kayıpları. **TM:** takım kayıpları. **Ürün ailesi:** takım/ürün sonuçları. **Diğer üretici ve yönetici rolleri:** yetkili firma raporu. |
| T-Club tekrar | `yayin_tekrar_kayitlari` | Yayın → tur | Yalnız kullanıcının görebildiği yayınların tur bilgisi okunur. Tur kaydı tek başına kullanıcı performansı sayılmaz. |
| T-Club beğeni/favori | `video_begeniler`, `video_favoriler` | Kullanıcı → yayın → ürün/eğitim | **UTT/KD_UTT:** kendi etkileşimi. **BM:** bölge sonuçları. **TM:** takım sonuçları. **Ürün ailesi:** takım/ürün sonuçları. **Diğer üreticiler ve yöneticiler:** yetkili firma raporu. |
| C-Club challenge | `challenge_kayitlari` | Gönderen BM → alan BM → yayın | **BM:** kendi gönderdiği veya aldığı challenge kayıtları. **TM:** kişisel C-Club hesabı olmadan takımındaki BM sonuçlarının rapor görünümü. **Üretici rolleri:** yetkili yayın/ürün gözlem kapsamı. **Yöneticiler:** firma raporu. **UTT/KD_UTT:** erişim yok. |
| C-Club izleme | `cc_izleme_kayitlari` | BM → challenge → yayın | **BM:** kendi izlemesi. **TM:** takımındaki BM sonuçlarının rapor görünümü; kişisel C-Club sonucu yok. **Üretici rolleri:** yetkili yayın/ürün gözlem kapsamı. **Yöneticiler:** firma raporu. |
| C-Club kazanım/kayıp | C-Club puan ve kayıp tabloları | BM → izleme/challenge → yayın | **BM:** kişisel C-Club sonucu. **TM:** kişisel erişim yok; takımındaki BM’lerin rapor sonuçları. **Üretici rolleri:** yetkili yayın/ürün sonuçları. **Yöneticiler:** firma sonuçları. |
| C-Club lig özeti | `cc_ligi_ozet` | BM → firma → tarih | **BM:** kendi puanı ve firma sırası. **TM:** takımındaki BM sonuçları; kendisine ait C-Club puanı yok. **Üretici rolleri:** yetkili gözlem kapsamı. **Yöneticiler:** firma sonuçları. |
| E-Club öneri | `eclub_oneri_kayitlari` | UTT/KD_UTT → E-Club kişisi → yayın | **UTT/KD_UTT:** kendi eczane listesi ve önerileri. **BM:** bölgesindeki UTT/KD_UTT önerileri. **TM:** takım önerileri. **Ürün ailesi:** takım/ürün sonuçları. **Diğer üretici ve yönetici rolleri:** yetkili firma raporu. |
| E-Club izleme | `eclub_izleme_kayitlari` | E-Club kişisi → öneri → yayın | **UTT/KD_UTT:** kendi eczane portföyü. **BM:** bölgesi. **TM:** takımı. **Ürün ailesi:** takım/ürün. **Diğer üreticiler:** ilgili firma yayınları. **Yöneticiler:** firma sonuçları. |
| E-Club kazanım/kayıp | E-Club puan ve kayıp tabloları | Kişi → izleme → yayın → ürün/eğitim | E-Club izleme kapsamıyla aynı iç kullanıcı sınırı uygulanır. E-Club üyeleri bu verileri HapBi üzerinden sorgulayamaz. |
| E-Club UTT katkısı | `eclub_utt_puanlari` | UTT → kişi → öneri → izleme → yayın | **UTT/KD_UTT:** kendi katkısı. **BM:** bölgesindeki katkılar. **TM:** takım katkıları. **Ürün ailesi:** takım/ürün katkıları. **Diğer üretici ve yönetici rolleri:** yetkili firma raporu. |
| E-Club beğeni/favori | `eclub_video_begeniler`, `eclub_video_favoriler` | E-Club kişisi → yayın | **UTT/KD_UTT:** kendi eczane portföyü. **BM:** bölge. **TM:** takım. **Ürün ailesi:** takım/ürün. **Diğer üretici ve yönetici rolleri:** yetkili firma raporu. |
| Üretim görevi | `uretim_gorevleri` | Görev → talep → araç/soru seti | **Üretici rolleri:** kendi taleplerine bağlı üretim durumları. **Ürün ailesi:** takım üretim raporu. **Firma düzeyindeki üreticiler:** firma/yetenek profili raporu. **Yöneticiler:** firma üretim portföyü. **UTT/KD_UTT, BM ve TM:** doğrudan üretim görevi erişimi yok. |

- `lib/hapbi/roller.ts` yazıldı.
- `lib/hapbi/kapsam.ts` yazıldı.

---

## - [x] Faz 3 — Zaman modelinin kurulması

### Amaç

Kullanıcının zaman ifadelerini HapBilgi zaman kurallarına göre kesin başlangıç ve bitiş aralığına çevirmek.

### Yapılacak işler

1. HapBi kapsamında şu zaman birimleri desteklenecek:

   - Hafta
   - Ay
   - Dönem
   - Yıl

2. Gün, HapBi deterministik sorgu kapsamına alınmayacak.
3. Zaman sınırları Türkiye saatine göre hesaplanacak.
4. Hafta pazartesi başlayıp pazar günü bitecek.
5. Ay, takvim ayının ilk ve son gününü kapsayacak.
6. Dönemler şöyle hesaplanacak:

   - Ocak–şubat–mart
   - Nisan–mayıs–haziran
   - Temmuz–ağustos–eylül
   - Ekim–kasım–aralık

7. Yıl, 1 Ocak ile 31 Aralık arasını kapsayacak.
8. “Son” ifadesi en son tamamlanmış zaman aralığını gösterecek.
9. `dönem`, `çeyrek`, `kuartır` ve `quarter` aynı zaman türüne bağlanacak.
10. `3 ay` ifadesi dönem eş anlamlısı olarak kullanılmayacak.
11. Veritabanı sorgularında başlangıç dahil, bitiş hariç zaman aralığı kullanılacak.
12. Bağımsız yeni soru, önceki sorunun zamanını kendiliğinden devralmayacak.
13. Yalnız devam sorusu olduğu kesinleşen ifadeler önceki zaman bilgisini kullanabilecek.

### Planlanan kod alanı

- `lib/hapbi/zaman.ts`
- `lib/hapbi/zamanSozlesmesi.ts`

### Çıkış koşulu

Desteklenen bütün zaman ifadeleri kesin başlangıç ve bitiş değerine dönüşecek.

### Faz 3 İş Sonuçları

- `lib/hapbi/zamanSozlesmesi.ts` dosyasında hafta, ay, dönem ve yıl zaman türleri ile “bu” ve “son” yönelimleri tanımlandı.
- Gün, HapBi deterministik sorgu kapsamının dışında bırakıldı.
- Hafta, ay, dönem ve yıl sınırlarının Türkiye saatine göre hesaplanması sağlandı.
- Haftanın pazartesi başlayıp sonraki pazartesiye kadar; ayın takvim ayı sınırlarında; dönemin üç aylık sabit takvim aralıklarında; yılın 1 Ocak’tan sonraki 1 Ocak’a kadar hesaplanması sağlandı.
- “Son” ifadesi, ilgili türün en son tamamlanmış zaman aralığına bağlandı.
- `dönem`, `çeyrek`, `kuartır` ve `quarter` ifadeleri aynı zaman türüne bağlandı.
- `3 ay` ifadesinin dönem eş anlamlısı olarak kullanılmaması sağlandı.
- Üretilen aralıklar başlangıç dahil, bitiş hariç olacak şekilde tanımlandı.
- Önceki zaman bilgisinin yalnız kesin devam sorularında kullanılmasına izin verildi; bağımsız soruların zamanı kendiliğinden devralması engellendi.
- `lib/hapbi/zaman.ts` ve `lib/hapbi/zamanSozlesmesi.ts` dosyalarının kod ve tür denetimleri hatasız tamamlandı.

---

## - [x] Faz 4 — Ölçüt kataloğunun oluşturulması

### Amaç

HapBi’nin hesaplayabileceği değerleri tek ve denetlenebilir bir katalogda toplamak.

### Başlangıç ölçütleri

- Net puan
- Kazanılan puan
- Kaybedilen puan
- İzleme sayısı
- Tamamlanan izleme sayısı
- Beğeni sayısı
- Favori sayısı
- Doğru cevap sayısı
- Yanlış cevap sayısı
- İleri sarılan süre
- Katkı değeri

### Her ölçüt için tanımlanacak bilgiler

1. Ölçütün ortak adı
2. Kullanıcının kullanabileceği eş anlamlı ifadeler
3. Gerçek veri kaynağı
4. Hesaplamada kullanılacak alan
5. Sayma, toplama veya başka hesaplama yöntemi
6. Kullanılacak zaman alanı
7. Kullanılabileceği kırılımlar
8. Kullanılabileceği roller
9. Boş değerin anlamı
10. Sıfır değerin anlamı
11. Sıralama yönü
12. Sonuca dahil edilmeyecek kayıtlar

### Kurallar

- Eksik değer kendiliğinden `0` yapılmayacak.
- Olay sayısı ile farklı yayın sayısı birbirine karıştırılmayacak.
- Ürün toplamı ile tek yayın değeri birbirine karıştırılmayacak.
- Aynı adlı ürünlerin farklı yayınları kimlikleri üzerinden korunacak.

### Planlanan kod alanı

- `lib/hapbi/olcutler.ts`
- `lib/hapbi/olcutSozlesmesi.ts`

### Çıkış koşulu

Her ölçütün nereden ve nasıl hesaplandığı kesin olarak tanımlanacak.

### Faz 4 İş Sonuçları

- `lib/hapbi/olcutSozlesmesi.ts` dosyasında 11 başlangıç ölçütü ile ölçüt kaynağı, hesaplama, zaman, kırılım, rol, boş değer, sıfır değer ve sıralama sözleşmeleri tanımlandı.
- `lib/hapbi/olcutler.ts` dosyasında net puan, kazanılan puan, kaybedilen puan, izleme sayısı, tamamlanan izleme sayısı, beğeni sayısı, favori sayısı, doğru cevap sayısı, yanlış cevap sayısı, ileri sarılan süre ve katkı değeri kataloğa işlendi.
- Her ölçütün kullanıcı ifadeleri, gerçek T-Club, C-Club ve E-Club kaynakları, hesaplama alanları, hesaplama yöntemi ve olay zamanı belirlendi.
- Ölçütlerin kullanılabileceği kırılımlar ve roller, Faz 2 rol ve kapsam kurallarıyla ilişkilendirildi.
- Eksik değerlerin sıfıra çevrilmemesi ile doğrulanmış sıfır değerin anlamı ayrı ayrı tanımlandı.
- Olay sayısı ile farklı yayın sayısının; ürün toplamı ile tek yayın değerinin karıştırılmaması için yayın ve ürün kimlikleri kaynak ilişkilerinde ayrı tutuldu.
- C-Club doğru cevap sayısı için doğrulanmış olay kaynağı bulunmadığından C-Club puan kayıtları doğru cevap olayı olarak kullanılmadı.
- E-Club yanlış cevap kayıtları yanlış cevap sayısına dahil edildi; puan kaybı olarak değerlendirilmedi.
- İki dosyanın kod ve tür denetimleri hatasız tamamlandı.

---

## - [x] Faz 5 — Kırılım kataloğunun oluşturulması

### Amaç

Sonuçların hangi varlıklar üzerinden gruplanabileceğini belirlemek.

### Başlangıç kırılımları

- Kullanıcı
- UTT
- Ürün
- Yayın
- Takım
- Bölge
- Firma

### Yapılacak işler

1. Her kırılımın ortak kimliği belirlenecek.
2. Görüntülenecek ad alanı belirlenecek.
3. Diğer veri kaynaklarına bağlantı alanları belirlenecek.
4. Her kırılımın kullanılabileceği roller tanımlanacak.
5. Her kırılımın kullanılabileceği ölçütler tanımlanacak.
6. Ürün ile yayın ayrı kırılımlar olarak korunacak.
7. Takım, bölge ve firma ilişkisi Bluebook’a göre kurulacak.
8. Kapsam dışında kalan kırılım birleşimleri açıkça reddedilecek.

### Planlanan kod alanı

- `lib/hapbi/kirilimlar.ts`
- `lib/hapbi/kirilimSozlesmesi.ts`

### Çıkış koşulu

Her ölçütün hangi varlıklar üzerinden gruplanabileceği kesinleşecek.

### Faz 5 İş Sonuçları

- `lib/hapbi/kirilimSozlesmesi.ts` dosyasında kullanıcı, UTT, ürün, yayın, takım, bölge ve firma kırılımları ile bağlantı ve doğrulama sözleşmeleri tanımlandı.
- `lib/hapbi/kirilimlar.ts` dosyasında her kırılımın ortak kimliği, görüntülenecek ad alanı, sabit süzme koşulları ve diğer veri kaynaklarına bağlantıları kataloğa işlendi.
- Her kırılımın kullanılabileceği veri alanları, roller ve Faz 4 ölçütleri belirlendi.
- Kullanıcı ile UTT aynı kimlik kaynağını kullanan ayrı kırılımlar olarak tanımlandı; UTT kırılımı yalnız UTT ve KD_UTT rolleriyle sınırlandı.
- Ürün ile yayın ayrı kimlikler ve ayrı kırılımlar olarak korundu; bir ürünün birden fazla yayına bağlanabilmesi `urun_id` ve `yayin_id` üzerinden tanımlandı.
- Takım, bölge ve firma bağlantıları Bluebook’taki bölge → takım → firma hiyerarşisine göre kuruldu.
- Yinelenen kırılımlar, kullanıcı ile UTT’nin birlikte kullanılması, rolün erişemediği veri alanları ve ölçütle kullanılamayan kırılımlar için açık reddetme nedenleri tanımlandı.
- İki dosyanın kod ve tür denetimleri hatasız tamamlandı.

---

## - [x] Faz 6 — Sorgu işlem kategorilerinin kurulması

### Amaç

Kullanıcının veri üzerinde yapmak istediği işlemi ortak kurallara bağlamak.

### İşlem kategorileri

| İşlem kategorisi | Teknik karşılığı |
|---|---|
| Doğrudan değer | Tek ölçütün değerini getirir |
| Toplam | Seçilen kapsamdaki değerleri toplar |
| Bütünleşik | Bir ölçütle seçim yapıp başka ölçütün değerini getirir |
| Karşılaştırma | İki varlığı veya zamanı karşılaştırır |
| Sıralama | Varlıkları seçilen ölçüte göre sıralar |
| Göreli hesaplama | Oran, pay veya dağılım üretir |
| Fark | İki değer arasındaki sayısal farkı hesaplar |
| Katkı | Toplamı oluşturan kaynakları gösterir |
| Eğilim | Değerin zaman içindeki yönünü hesaplar |
| Koşullu seçim | Belirtilen koşulu sağlayan varlıkları getirir |

### Yapılacak işler

1. Her işlem kategorisinin zorunlu alanları tanımlanacak.
2. Kullanılabilecek ölçüt ve kırılım birleşimleri belirlenecek.
3. Sıralama yönü, sonuç sınırı ve filtre koşulları tanımlanacak.
4. Bütünleşik sorgularda seçim ölçütü ile sonuç ölçütü ayrı tutulacak.
5. Karşılaştırmalı sorgularda iki tarafın kapsamı ve zamanı ayrı tanımlanacak.
6. Geçersiz birleşimler veritabanı çalıştırılmadan reddedilecek.

### Planlanan kod alanı

- `lib/hapbi/islemTurleri.ts`
- `lib/hapbi/sozlesme.ts`

### Ortak sorgu yapısı

```ts
type HapbiSorgu = {
  kapsam: RolKapsami;
  zaman: ZamanAraligi;
  olcut: Olcut;
  sonucOlcutu?: Olcut;
  kirilim: Kirilim;
  islem: IslemTuru;
  filtreler: Filtre[];
  siralama?: Siralama;
  sonucSiniri?: number;
};
```

### Çıkış koşulu

Bütün desteklenen veri soruları tek ortak sorgu yapısıyla ifade edilebilecek.

### Faz 6 İş Sonuçları

- `lib/hapbi/islemTurleri.ts` dosyasında doğrudan değer, toplam, bütünleşik, karşılaştırma, sıralama, göreli hesaplama, fark, katkı, eğilim ve koşullu seçim kategorileri tanımlandı.
- Her işlem kategorisinin zorunlu alanları ve kullanılamayacak alanları belirlendi.
- `lib/hapbi/sozlesme.ts` dosyasında kapsam, veri alanı, zaman, ölçüt, sonuç ölçütü, kırılım, işlem, süzme, sıralama, sonuç sınırı ve karşılaştırma alanlarını taşıyan ortak sorgu sözleşmesi kuruldu.
- Bütünleşik sorgularda seçim ölçütü ile sonuç ölçütü birbirinden ayrıldı ve aynı ölçütün iki görevde kullanılmaması sağlandı.
- Karşılaştırma, fark ve eğilim işlemlerinde iki tarafın kapsamı, zamanı ve süzme koşulları ayrı tanımlandı.
- Sıralama yönü, olumlu tam sayı sonuç sınırı, varlık süzme koşulları ve sayısal değer koşulları tanımlandı.
- Rolün erişemediği veri alanı, ölçüt–veri alanı uyumsuzluğu, ölçüt–kırılım uyumsuzluğu ve kapsam dışı varlık kimlikleri veritabanına ulaşmadan reddedilecek şekilde doğrulandı.
- İki dosyanın kod ve tür denetimleri hatasız tamamlandı.

---

## - [x] Faz 7 — Türkçe soru çözümleyicisinin kurulması

### Amaç

Kullanıcının doğal Türkçe sorusunu ortak sorgu yapısına dönüştürmek.

### Yapılacak işler

1. Türkçe büyük-küçük harf dönüşümü uygulanacak.
2. Noktalama ve gereksiz boşluklar temizlenecek.
3. Yaygın yazım farklılıkları ortak biçime çevrilecek.
4. Zaman ifadeleri çıkarılacak.
5. Ölçüt ifadeleri çıkarılacak.
6. Kırılım ifadeleri çıkarılacak.
7. İşlem kategorisi çıkarılacak.
8. Sıralama yönü ve sonuç sınırı çıkarılacak.
9. Açıkça yazılan ürün, yayın, takım veya bölge ifadeleri çözülecek.
10. Birden fazla ifadeyle eşleşen parçalar en özel anlam üzerinden değerlendirilecek.
11. Basit kelime içerme kontrolü yerine tanımlı ifade ve bağlam kuralları kullanılacak.
12. Çözülen parçalar `HapbiSorgu` yapısına dönüştürülecek.
13. Tahmin gerektiren alanlar doldurulmayacak.

### Planlanan kod alanı

- `lib/hapbi/dil/normalizasyon.ts`
- `lib/hapbi/dil/sozluk.ts`
- `lib/hapbi/dil/derleyici.ts`

### Çıkış koşulu

Aynı anlamdaki farklı Türkçe sorular aynı ortak sorgu yapısına dönüşecek.

### Faz 7 İş Sonuçları

- `lib/hapbi/dil/normalizasyon.ts` dosyasında Türkçe büyük-küçük harf dönüşümü, noktalama ve gereksiz boşluk temizliği ile tanımlı yazım farklılıklarının ortak biçime çevrilmesi sağlandı.
- `lib/hapbi/dil/sozluk.ts` dosyasında zaman, ölçüt, kırılım, işlem kategorisi ve sıralama yönü ifadeleri tanımlandı.
- Faz 4 ölçüt kataloğundaki eş anlamlı ifadeler Türkçe ölçüt sözlüğünün kaynağı olarak kullanıldı.
- Açıkça yazılan ürün, yayın, takım ve bölge adlarının yalnız sunucunun sağladığı izinli varlık listesi içinden çözülebilmesi sağlandı.
- Birbiriyle çakışan ifadelerde en uzun ve en özel tanımlı ifadenin seçilmesi; aynı parçanın farklı varlıklara bağlanması durumunda belirsizliğin korunması sağlandı.
- `lib/hapbi/dil/derleyici.ts` dosyasında zaman, ölçüt, sonuç ölçütü, kırılım, işlem, sıralama yönü, sonuç sınırı, varlık süzmesi ve sayısal koşullar çıkarılarak `HapbiSorgu` yapısına dönüştürüldü.
- Bütünleşik sorgularda seçim ölçütü ile sonuç ölçütü; karşılaştırmalı sorgularda iki tarafın zamanı ve varlık süzmesi ayrı tutuldu.
- Eksik veya birden fazla anlama gelen bilgiler tahmin edilmeden eksik ya da belirsiz olarak işaretlendi.
- Derlenen sorguların Faz 6 sözleşmesinden geçmeden kullanılmaması sağlandı.
- Üç dosyanın kod ve tür denetimleri hatasız tamamlandı.

---

## - [x] Faz 8 — Deterministik sorgu motorunun kurulması

### Amaç

Ortak sorgu yapısını güvenli veritabanı işlemine dönüştürmek.

### Yapılacak işler

1. Ölçüt, kırılım, kapsam ve zaman bileşenleri ayrı ayrı doğrulanacak.
2. Sorgular kullanıcı cümlesine göre değil, ortak sorgu yapısına göre oluşturulacak.
3. İzin verilen tablo, görünüm, alan ve bağlantılar beyaz listeyle sınırlandırılacak.
4. Kullanıcı metni doğrudan SQL içine yazılmayacak.
5. Bütün değişken değerler güvenli sorgu parametresi olarak gönderilecek.
6. Rol kapsamı bütün sorgulara zorunlu koşul olarak eklenecek.
7. Zaman aralığı doğru olay alanına uygulanacak.
8. Ölçüte göre toplama, sayma, gruplama ve sıralama işlemleri kurulacak.
9. Her işlem kategorisi aynı bileşenleri kullanacak.
10. Doğal dil sorularına özel sabit sorgu tarifleri oluşturulmayacak.
11. Veri alanları için konu bazlı bağlantı katmanları kullanılacak.
12. Sonuç ortak bir veri yapısında döndürülecek.

### Planlanan kod alanı

- `lib/hapbi/motor/sorguOlustur.ts`
- `lib/hapbi/motor/calistir.ts`
- `lib/hapbi/motor/veriKaynaklari.ts`

### Çıkış koşulu

Geçerli ortak sorgular Gemini kullanılmadan veritabanında çalıştırılabilecek.

### Faz 8 İş Sonuçları

- `lib/hapbi/motor/sorguOlustur.ts` dosyasında ortak sorgunun ölçüt, kırılım, kapsam, zaman, işlem, sıralama ve süzme bileşenleri doğrulanarak güvenli veri kaynağı planına dönüştürüldü.
- Sorguların kullanıcı cümlesinden veya doğal dil sorusuna özel sabit tariflerden değil, doğrulanmış ortak sorgu yapısından oluşturulması sağlandı.
- Rol kapsamının, seçilen zaman aralığının ve değişken süzme değerlerinin veri kaynağı planına zorunlu ve ayrı bileşenler olarak eklenmesi sağlandı.
- `lib/hapbi/motor/veriKaynaklari.ts` dosyasında kullanılabilecek tablo, görünüm, alan, kapsam yolu ve kaynak bağlantıları beyaz listeyle sınırlandırıldı.
- Kullanıcı metninin doğrudan sorguya yazılması engellendi; değişken değerlerin güvenli sorgu parametreleri olarak taşınması sağlandı.
- `lib/hapbi/motor/calistir.ts` dosyasında hazırlanan veri kaynağı planının toplama, sayma, gruplama, sıralama, karşılaştırma ve göreli hesaplama işlemlerine göre çalıştırılması sağlandı.
- Bütün işlem kategorilerinin aynı sorgu, kapsam, zaman ve veri kaynağı bileşenlerini kullanması sağlandı.
- Çalıştırma sonucunun ortak HapBi sonuç yapısında dönmesi sağlandı.
- Üç dosyanın kod ve tür denetimleri hatasız tamamlandı.

---

## - [x] Faz 9 — Veri doğrulama ve kanıt katmanının kurulması

### Amaç

Üretilen sayısal sonuçların kaynağını ve doğruluğunu denetlenebilir hale getirmek.

### Yapılacak işler

1. Boş değer ile gerçek `0` birbirinden ayrılacak.
2. Tekil kayıt sayısı ile olay sayısı ayrılacak.
3. Ürün, yayın ve kullanıcı kimlikleri üzerinden mükerrer kayıt denetimi yapılacak.
4. Toplamın alt satırlarla uyumu kontrol edilecek.
5. Sıralama sonucunun kullanılan ölçütle uyumu kontrol edilecek.
6. Karşılaştırma ve fark işlemleri iki doğrulanmış değer üzerinden hesaplanacak.
7. Her sonuç için kullanılan veri kaynağı kaydedilecek.
8. Sonucu destekleyen kısa kanıt satırları oluşturulacak.
9. Doğrulanamayan sonuç kullanıcıya kesin bilgi olarak verilmeyecek.

### Planlanan kod alanı

- `lib/hapbi/motor/dogrula.ts`
- `lib/hapbi/motor/kanit.ts`

### Çıkış koşulu

Her sayısal sonuç, kaynağı ve hesaplama bileşenleriyle doğrulanabilir olacak.

### Faz 9 İş Sonuçları

- `lib/hapbi/motor/dogrula.ts` dosyasında boş sonuç, eksik değer ve gerçek `0` birbirinden ayrıldı.
- Olay sayısı ile tekil kayıt, ürün, yayın ve kullanıcı sayılarının ayrı doğrulanması sağlandı.
- Sonuç satırlarında ve kaynak kayıtlarında mükerrer kimlik denetimi kuruldu.
- Beklenen toplamın doğrulanmış alt satırlarla uyumu denetlendi.
- Sıralamanın sorgu planındaki ölçüt ve sıralama yönüyle uyumu doğrulandı.
- Karşılaştırma, fark ve eğilim sonuçlarının iki doğrulanmış değer üzerinden hesaplanması denetlendi.
- Sonuçta bildirilen veri kaynaklarının sorgu planındaki kaynaklarla uyumu doğrulandı.
- `lib/hapbi/motor/kanit.ts` dosyasında yalnız doğrulanmış sonuçlardan veri kaynağı, zaman, hesaplama alanı ve sayısal değer içeren kanıt paketi oluşturulması sağlandı.
- Her doğrulanmış sonuç satırı için kısa kanıt açıklaması üretildi.
- Boş, eksik veya doğrulanmamış sonuçların kesin bilgi sağlayan kanıta dönüştürülmesi engellendi.
- İki dosyanın kod ve tür denetimleri hatasız tamamlandı.

---

## - [x] Faz 10 — Deterministik cevap ve belirsizlik yönetimi

### Amaç

Doğrulanmış sonucu kullanıcıya kısa ve doğru biçimde aktarmak.

### Yapılacak işler

1. Tek değer cevapları hazırlanacak.
2. Toplam cevapları hazırlanacak.
3. Sıralama cevapları hazırlanacak.
4. Karşılaştırma ve fark cevapları hazırlanacak.
5. Dağılım, oran ve katkı cevapları hazırlanacak.
6. Eğilim cevapları hazırlanacak.
7. Sonuç bulunamaması ile sorgunun desteklenmemesi ayrılacak.
8. Yalnız eksik olan bilgi sorulacak.
9. Eksik kırılım için zaman sorulmayacak.
10. Eksik zaman için kırılım sorulmayacak.
11. Bağımsız soru önceki sorgunun bilgilerini devralmayacak.
12. Devam soruları yalnız önceki eksik alanı tamamlayacak.
13. Sayısal cevaplar Gemini’ye gönderilmeyecek.
14. Cevapta kullanılan kapsam ve zaman açıkça belirtilecek.

### Planlanan kod alanı

- `lib/hapbi/yanit/sayisal.ts`
- `lib/hapbi/yanit/belirsizlik.ts`
- `lib/hapbi/yanit/kaynaklar.ts`

### Çıkış koşulu

Desteklenen sayısal sorular doğrudan ve tek anlamlı cevaplanacak.

### Faz 10 İş Sonuçları

- `lib/hapbi/yanit/sayisal.ts` dosyasında doğrulanmış kanıt paketlerinden tek değer, toplam, sıralama, bütünleşik ve koşullu seçim cevapları oluşturuldu.
- Karşılaştırma, fark, dağılım, oran, katkı ve eğilim işlemleri için deterministik cevap biçimleri hazırlandı.
- Sayısal cevaplarda kullanılan kapsam ve zaman bilgilerinin açıkça gösterilmesi zorunlu tutuldu.
- Sayısal cevaplarda Gemini çağrısı `0` olarak sabitlendi.
- `lib/hapbi/yanit/belirsizlik.ts` dosyasında eksik bilgi, sonuç bulunamaması, sorgunun desteklenmemesi, verinin okunamaması ve sonucun doğrulanamaması birbirinden ayrıldı.
- Eksik kırılım için zaman, eksik zaman için kırılım sorulması engellendi; yalnız eksik olan alan için netleştirme sorusu oluşturuldu.
- Bağımsız soruların önceki sorgu bilgisini devralmaması ve devam cevaplarının yalnız beklenen eksik alanı tamamlaması sağlandı.
- `lib/hapbi/yanit/kaynaklar.ts` dosyasında doğrulanmış kaynakların kapsam, zaman aralığı ve veri okuma zamanı ile kullanıcıya gösterilmesi sağlandı.
- Kaynakların beyaz listede bulunması ve ilgili veri alanında kullanılabilmesi doğrulandı.
- Üç dosyanın kod ve tür denetimleri hatasız tamamlandı.

---

## - [ ] Faz 11 — Tek çağrılı yorum katmanının kurulması

### Amaç

Yalnız değerlendirme ve öneri isteyen sorularda Gemini’den yararlanmak.

### Yapılacak işler

1. Önce deterministik sonuç üretilecek.
2. Doğrulanmış kısa bir yapılandırılmış veri paketi hazırlanacak.
3. Pakette yalnız şunlar bulunacak:

   - Kullanıcının sorusu
   - Sunucunun belirlediği kapsam
   - Zaman
   - Doğrulanmış bulgular
   - Seçilmiş kanıtlar
   - Yorum sınırları
4. Gemini’ye şunlar verilmeyecek:

   - SQL erişimi
   - Sorgu oluşturma yetkisi
   - Veri kaynağı seçme yetkisi
   - Rol veya kapsam belirleme yetkisi
   - Büyük ham veri
   - Birden fazla çağrı döngüsü
5. Yorum sorusunda model en fazla bir kez çağrılacak.
6. Modelin yeni sayı üretmesi engellenecek.
7. Kanıtsız neden üretmesi engellenecek.
8. Kapsam dışı kişi, takım, bölge veya firma bilgisi üretmesi engellenecek.
9. Puan satış başarısı veya mesleki yeterlilik olarak yorumlanmayacak.
10. Desteklenmeyen veri sorgusu doğrulanmamış cevap üretmesi için Gemini’ye bırakılmayacak.

### Planlanan kod alanı

- `lib/hapbi/yanit/yorumPaketi.ts`
- `lib/hapbi/yanit/yorum.ts`
- `lib/hapbi/yanit/yorumDogrulama.ts`

### Çıkış koşulu

Sayısal sorularda model çağrısı `0`, yorum sorularında en fazla `1` olacak.

---

## - [ ] Faz 12 — Sunucu ve sohbet bağlantısının kurulması

### Amaç

Yeni motoru korunan HapBi sohbet alanına bağlamak.

### İşlem sırası

1. Oturum doğrulanacak.
2. Rol kapsamı çözülecek.
3. Kullanıcı sorusu ortak sorgu yapısına dönüştürülecek.
4. Zorunlu alanlar doğrulanacak.
5. Deterministik sorgu çalıştırılacak.
6. Sonuç ve kanıtlar doğrulanacak.
7. Sayısal cevap doğrudan üretilecek.
8. Yorum gerekiyorsa tek çağrılı yorum katmanı çalıştırılacak.
9. Cevap sohbet alanına gönderilecek.

### Yapılacak dosya çalışmaları

- `app/api/hapbi/sor/route.ts` yeni motora bağlanacak.
- Korunan HapBi sağlayıcısı yeni cevap sözleşmesine bağlanacak.
- Korunan sohbet alanı yeni cevapları gösterecek.
- Maskotun görünümü ve açılma davranışı değiştirilmeyecek.
- Geçici “motor kapalı” cevabı kaldırılacak.
- Bağımsız soru ve devam sorusu ayrımı uygulanacak.

### Çıkış koşulu

Yeni motor mevcut HapBi maskotu ve sohbet alanı üzerinden kullanılabilir olacak.

---

## - [ ] Faz 13 — Kapsam matrisi, sınamalar ve canlı doğrulama

### Amaç

Sistemin desteklediği bütün birleşimleri görünür ve doğrulanabilir hale getirmek.

### Yapılacak işler

1. Şu birleşimlerin tamamı tabloya dökülecek:

> **Rol × zaman × ölçüt × kırılım × işlem kategorisi**

2. Her birleşim için şu durumlardan biri yazılacak:

   - Destekleniyor
   - Veri kaynağı yok
   - Rol kapsamı dışında
   - Ölçüt ve kırılım uyumsuz
   - Henüz geliştirilmedi
3. Her desteklenen birleşim için en az bir doğru soru hazırlanacak.
4. Aynı sorunun farklı Türkçe yazımları sınanacak.
5. Yetkisiz kapsam sorguları sınanacak.
6. Eksik bilgi soruları sınanacak.
7. Bağımsız soru ile devam sorusu ayrımı sınanacak.
8. Boş değer ve gerçek sıfır ayrımı sınanacak.
9. Ürün ile yayın ayrımı sınanacak.
10. Sayısal sorularda Gemini çağrısının `0` olduğu doğrulanacak.
11. Yorum sorularında model çağrısının en fazla `1` olduğu doğrulanacak.
12. Modelin yeni sayı veya kanıtsız neden üretemediği doğrulanacak.
13. Her desteklenen rol ile canlı soru-cevap denemeleri yapılacak.
14. Sonuçlar doğrudan veritabanı sorgularıyla karşılaştırılacak.
15. Cevap süresi ve model maliyeti ölçülerek raporlanacak.

### Son çıkış koşulu

- Desteklenen bütün sayısal sorular doğrulanmış veriden cevaplanacak.
- Sayısal sorularda Gemini kullanılmayacak.
- Yorum sorularında yalnız doğrulanmış kanıtlar kullanılacak.
- Rol ve veri kapsamı ihlal edilemeyecek.
- Desteklenen ve desteklenmeyen sorgular açık kapsam tablosunda görülebilecek.
- HapBi maskotu ve mevcut sohbet alanı korunmuş olacak.

Bu plan henüz uygulamaya alınmadı.
