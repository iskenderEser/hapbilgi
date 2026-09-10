# 📘 HapBilgi — BLUEBOOK
### İş Modeli, Mimari, İş Kuralları ve Teknik Envanter Anayasası
*Son genel inceleme: 6 Eylül 2026 | Asistan bölümü ve ilgili envanter güncellemesi: 9 Eylül 2026*

---

## 🏛️ Giriş ve Metodoloji
**HapBilgi BLUEBOOK**, platformun iş modelini, kullanıcı alanlarını, rol ve yetki yapısını, üretim ve yayın akışlarını, öğrenme ve işlem kurallarını, veri mimarisini, arayüz sözleşmelerini ve dosya–tür–işlev envanterini tek kaynakta tanımlayan ana başvuru belgesidir.

HapBilgi; firmalar tarafından sağlanan veya yayımlanması sağlanan içerikleri yetkili kullanıcı gruplarına ulaştıran, bu kapsamdaki üretim, yayın, öğrenme, ölçüm ve platform işlemlerini rol temelli olarak yürüten dijital bir platformdur. HapBilgi; firma ile çalışanı, firma ile eczane veya eczane ile Eczanem uygulaması üyesi arasındaki ticari ya da mesleki ilişkinin tarafı değildir.

BLUEBOOK kayıtları aşağıdaki doğrulama kaynakları birlikte değerlendirilerek güncellenir:
1. **İş Modeli ve İşlevsel Kararlar:** Onaylanmış platform modeli, rol sınırları, kullanıcı akışları ve iş kuralları.
2. **Kaynak Kod ve Teknik Envanter:** Güncel uygulama kodu, API rotaları, ortak iş mantığı motorları, yapılandırmalar ve dosya–tür–işlev kayıtları.
3. **Veri Katmanı:** SQL ve migration dosyaları, şema anlık görüntüleri, tablo, view, trigger ve RPC sözleşmeleri. Bir değişiklik, ayrıca doğrulanmadıkça canlı veritabanına uygulanmış kabul edilmez.
4. **Doğrulama Kayıtları:** Commit geçmişi, otomatik testler, tip ve mimari denetimler, üretim derlemesi ile gerçekleştirildiği açıkça belirtilen canlı veya fiziksel kontroller.

Bluebook'taki güncellik ve doğrulama ifadeleri son incelenen sürüm ve belirtilen kontrol tarihi için geçerlidir. Tarihsel test sonuçları güncel sonuç gibi kullanılmaz; canlı ortamda doğrulanmamış bir durum canlıda tamamlanmış veya üretime hazır olarak kaydedilmez.

### Kanonik Zaman Değerleri
HapBilgi'nin bütün modüllerinde ve HapBi sorgularında geçerli zaman değerleri yalnızca aşağıdakilerdir. Bütün başlangıç ve bitişler Türkiye saatine göre değerlendirilir:

* **Gün:** 00:00–23:59.
* **Hafta:** Pazartesi–Pazar.
* **Ay:** 01–28/29/30/31.
* **Dönem:** Ocak–Şubat–Mart, Nisan–Mayıs–Haziran, Temmuz–Ağustos–Eylül veya Ekim–Kasım–Aralık.
* **Yıl:** 01.01.yyyy–31.12.yyyy.

**Mevcut Kod Uyum Durumu:** Kod tabanındaki bazı dosyalar yukarıdaki sabit takvim aralıklarından farklı olarak çalıştırıldığı ana göre kayan hareketli tarih aralıkları kullanmaktadır. Sabit takvim aralığı kullanan dosyalar ile hareketli tarih aralığı kullanan dosyalar ayrıca belirlenip birbirinden ayrılmadan kodun bu sözleşmeyle bütünüyle uyumlu olduğu kabul edilmez.

---

# 0. BÖLÜM: GENEL SİSTEM MİMARİSİ, KİMLİK, ROLLER VE GÜVENLİK ANAYASASI
*Platformun Temel Felsefesi, Kullanıcı Alanları, Kimlik Düzlemleri, Rol Hiyerarşisi ve Güvenlik İlkeleri*

### 1. Üç Kimlik Düzlemi, Kullanıcı Alanları ve Öğrenme Zinciri
HapBilgi, ilaç ve sağlık sektörüne özgü; rol ve iş kurallarıyla korunan üretim, yayın, öğrenme, ölçüm ve platform işlemlerini tek yapıda birleştiren dijital bir platformdur. Kullanıcı alanları ticari müşteri sınıfları değil, uygulamanın teknik kimlik ve yetki düzlemleridir:
1. **İç Platform Kullanıcıları:** Firma çalışanları, İçerik Üreticisi ve platform yöneticisi teknik olarak `kullanicilar` düzleminde yaşar. Firma kullanıcılarının erişimi firma $\rightarrow$ takım $\rightarrow$ bölge hiyerarşisi ile rol ve yetenek profillerine göre belirlenir.
2. **E-Club Kullanıcıları:** Eczacı, ikinci eczacı, yardımcı eczacı ve eczane teknisyeni `eclub_kisiler` düzleminde yaşar. Kişinin eczane ve firma bağlantıları ayrı üyelik ilişkileri üzerinden kurulur; yapı çok firmalı kullanımı destekler.
3. **Eczanem Uygulaması Üyeleri:** Eczanenin müşterisi veya müşteri adayı olabilen üyeler `eczanem_musteriler` düzleminde yaşar. Üyelik, öğrenme ve platform işlemleri eczane bazındaki aktif üyelik ilişkisi üzerinden yürür.

Platform **Video** (`video`), **Podcast** (`podcast`), **Dijital Broşür** (`gorsel`) ve **Literatür** (`flip_pdf`) öğrenme araçlarını destekler. Yayın ile gerçek öğrenme aracı arasındaki ortak kimlik `yayin_id + arac_id + arac_turu` bileşimidir; rol bazlı puan, soru ve işlem kuralları ilgili kullanıcı alanının kendi motorunda uygulanır.

* **Öğrenme Zinciri:** `Talep` $\rightarrow$ `Üretim veya Hazır Araç` $\rightarrow$ `İnceleme` $\rightarrow$ `Yayın` $\rightarrow$ `Rol Temelli Dağıtım ve Tüketim` $\rightarrow$ `Ölçüm` $\rightarrow$ `İlgiliyse Puan ve Platform İşlemi`.

### 2. Kimlik ve Organizasyon Hiyerarşisi
* **Firma İçi Organizasyon Omurgası:** `firmalar` (Kök) $\rightarrow$ `takimlar` (Takım) $\rightarrow$ `bolgeler` (Saha Bölgesi) zinciri firma içi kullanıcıların kapsamını belirler; E-Club ve Eczanem kimlikleri bu ağacın doğrudan personel düğümleri değildir.
* **3 Kimlik Düzlemi:** İç platform kullanıcıları `kullanicilar`, eczane kullanıcıları `eclub_kisiler`, Eczanem uygulaması üyeleri `eczanem_musteriler` tablosunda saklanır. E-Club'ın eczane ve firma ilişkileri `eclub_eczane_master`, `eclub_eczaneler`, `eclub_eczane_firma`, `eclub_utt_eczane` ve `eclub_kisi_eczane`; Eczanem üyeliği ise `eczanem_uyelikler` üzerinden kurulur.
* **Ortak Giriş:** Üç kimlik düzlemi de `/login` üzerinden e-posta veya cep telefonu ve şifreyle giriş yapabilir. Başarılı girişten sonra kullanıcı, çözümlenen kimlik türü ve rolüne uygun alana yönlendirilir.
* **Yetkili Kimlik Çözücü (`v_auth_kimlik_admin` & `rolCozucu`):** Uygulama katmanında oturum açan kullanıcının rolü asla istemci metadata'sından değil; `lib/utils/rolCozucu.ts` aracılığıyla `v_auth_kimlik_admin` view'ından (service_role SELECT yetkili) tek kaynaktan çözülür.

### 3. Rol ve Yetki Anayasası (`lib/utils/roller.ts`)
* **Temel Rol Grupları:**
  * `URETICI_ROLLER` (13 Rol): `pm`, `jr_pm`, `kd_pm`, `med_md`, `egt_md`, `egt_yrd_md`, `egt_yon`, `egt_uz`, `ik_drk`, `ik_md`, `ik_yrd_md`, `ik_uz`, `ik_per` (Yetenek profillerine göre talep, inceleme ve onay akışlarını yürütür).
  * `YONETICI_ROLLER` (7 Rol): `gm`, `gm_yrd`, `drk`, `paz_md`, `blm_md`, `grp_pm`, `sm` (Firma seviyesinde konsolide rapor ve gözlem erişimi kullanır).
  * `ADMIN_ROLLER`: `admin` (Firmalar üstü platform yönetimini yürütür).
  * `YONLENDIRICI_ROLLER`: `tm` (Takım görünümü), `bm` (Bölge öneri ve koçluk yetkisi).
  * `TUKETICI_ROLLER`: `utt`, `kd_utt` (Bölge seviyesinde öğrenme aracı tüketimi, soru, lig ve ilgili mağaza işlemlerini yürütür).
  * `IU_ROLU`: `iu` (İçerik Üreticisi — talebe göre senaryo, seçilen öğrenme aracı ve soru seti üretir).
  * `ECLUB_TUKETICI_ROLLERI`: `eczaci`, `ikinci_eczaci`, `yardimci_eczaci`, `eczane_teknisyeni` (E-Club öğrenme araçlarını tüketen eczane unvanlarıdır).
  * `MUSTERI_ROLU`: `musteri` teknik kimlik değeridir; kullanıcıya dönük karşılığı Eczanem uygulaması üyesidir.
* **E-Club Yönetim Grupları:** `ECLUB_GOREN_ROLLER`, E-Club liste yönetimini kullanan UTT/KD_UTT rollerini; `ECLUB_YONETIM_ROLLERI` ve bundan türeyen `ECLUB_LIGI_GOREN_ROLLER` ise UTT/KD_UTT, BM/TM, üretici ve yönetici rollerinin kendi hiyerarşik kapsamlarındaki rapor ve lig erişimini tanımlar.
* **HBStore Satın Alma Yetki Ayrımı:**
  * `STORE_ALABILEN_ROLLER`: `[utt, kd_utt, bm]` — Yalnız bu roller kendi harcanabilir puanlarıyla HBStore siparişi oluşturabilir ve kendi siparişlerini görebilir.
  * `STORE_GORENLERLER`: Sipariş veren roller ile hiyerarşik gözlem yetkisi bulunan TM, üretici, yönetici ve admin rollerini kapsar.
  * `STORE_GENEL_GOREN_ROLLER`: BM'nin bölgesindeki, TM'nin takımındaki, üretici ve yöneticilerin firmasındaki, adminin ise tüm firmalardaki siparişleri `/store/siparisler` üzerinden görme sınırını tanımlar.
* **Hedef Roller (`talepler.hedef_roller`):** Kişi rolü değil, içeriğin hedef kitlesidir: `utt`, `bm`, `eczaci`, `eczane_teknisyeni`, `eczanem`. Eczacı, ikinci eczacı ve yardımcı eczacı unvanları `eczaci`; eczane teknisyeni `eczane_teknisyeni` hedef kitlesine eşlenir. Yalnız `eczaci` ve `eczane_teknisyeni` hedefleri birlikte seçilebilir. Eczanem hedefli talebi yalnız `PM_AILESI_ROLLER` ile aynı kaynağı kullanan `ECZANEM_TALEP_ACAN_ROLLER` açabilir.

### 4. Erişim ve Güvenlik Mimarisi (`proxy.ts` Middleware)
* **Merkezi Güvenlik Kapısı:** Statik varlıklar hariç tüm istekler kök `proxy.ts` (Next.js Node.js runtime) katmanından geçer.
* **Merkezi Erişim Kapıları:**
  1. **Admin API:** `/admin/api/*` rotaları `ADMIN_ROLLER` ile korunur.
  2. **Kullanıcı Yönetimi:** `/kullanicilar/*` sayfa ve API'leri yalnız admin rolüne açıktır.
  3. **Challenge Club:** `/challenge-club/*` ve `/cc-ligi/*` rotaları oturum, rol ve `cc_aktif` firma bayrağıyla korunur.
  4. **Yayındaki İçerikler:** Tarihsel rota adını koruyan `/yayindaki-videolar/*`, `YAYINDAKI_VIDEO_GORENLER` rol grubuyla korunur.
  5. **Üretici Yayın Katalogları:** `/sizin-yayinlariniz` ve `/tum-yayinlar` yalnız `URETICI_ROLLER` kapsamındadır.
  6. **HBStore:** `/store/*` rotaları rol kapsamı ve `hbstore_aktif` firma bayrağıyla korunur.
  7. **E-Club Store:** `/eclub/store/*` ve `/eclub/siparisler/*`, iç kullanıcıda firma; E-Club kullanıcısında aktif eczane–firma ilişkileri ve `eclub_store_aktif` üzerinden korunur.
  8. **E-Club:** `/eclub/*`, kimlik türüne göre firma veya aktif eczane–firma ilişkileri ve `eclub_aktif` üzerinden korunur.
  9. **Eczanem:** `/eczanem/*`, UTT/KD_UTT, E-Club kullanıcısı ve Eczanem uygulaması üyesi dallarını rol ile ilişki zincirine göre ayırır; ilgili firmaların `eczanem_aktif` bayrağını doğrular.
* **Firma Modül Bayrakları:** `cc_aktif`, `hbstore_aktif`, `eclub_aktif`, `eclub_store_aktif` ve `eczanem_aktif` yalnız arayüz görünürlüğünü değil, ilgili sayfa ve API erişimini de sınırlar.
* **Katmanlı Savunma:** Proxy kapısından sonra hassas route handler'ları kimlik, rol, firma, takım, bölge, eczane ve kayıt sahipliği kontrollerini kendi işlem kapsamlarında tekrarlar. `rolCozucu`, `eclubKisiErisimi` ve `eczanemRolErisimi` ortak erişim kaynaklarıdır; atomik RPC'ler ile veritabanı kısıtları yazma bütünlüğünün son katmanını oluşturur.

### 5. İçerik Üretim Hattı ve Servis Soyutlamaları
* **Dört Öğrenme Aracı:** Üretim hattı Video, Podcast, Dijital Broşür ve Literatür araçlarını ortak üretim sözleşmesi altında, araca özgü dosya, metadata, ilerleme ve tamamlama kurallarıyla yönetir.
* **4 Üretim Varyantı:** V1 (Tam Üretim), V2 (Hazır Öğrenme Aracı), V3 (Hazır Soru Seti), V4 (Hazır Öğrenme Aracı ve Hazır Soru Seti). Varyant ve durum pilleri seçilen aracın gerçek adını gösterir; örneğin hazır kaynak bir podcast ise “Hazır Podcast” yazılır.
* **Tarihsel Teknik Anahtarlar:** Veritabanındaki `video` üretim aşaması ile `hazir_video` alanı geriye dönük uyumluluk için ortak teknik anahtar olarak korunur; kullanıcı arayüzüne doğrudan basılmaz.
* **Bunny Medya Hattı:** Video Bunny Stream TUS hattıyla; Podcast, Dijital Broşür ve Literatür ise süreli imzalı Bunny Storage hattıyla doğrudan yüklenir. Gizli servis anahtarları istemciye açılmaz; dosya türü, boyut, imza, özet ve araca özgü metadata sunucuda doğrulanır.
* **Çoklu İÜ Görev Modeli:** Görevler `atama_bekliyor` $\rightarrow$ `hazirlaniyor` $\rightarrow$ `inceleme_bekliyor` $\rightarrow$ `revizyon_bekliyor` $\rightarrow$ `tamamlandi` / `iptal` durum makinesinde ilerler. Atama kaynağı `otomatik`, `manuel`, `devir` veya `gecis` olabilir; otomatik atamada uygun İÜ yük ve yetkinlik kurallarıyla seçilir.

---

# 1. BÖLÜM: T-CLUB (Saha & Temsilci Kulübü)
*İç Kullanıcı Katmanı — Saha Ekibi (UTT, KD_UTT, BM, TM)*

### 1. Aşama: Rol ve Görev Tanımları
* **UTT / KD_UTT (Uzman Tıbbi Tanıtım Temsilcisi):** Video, Podcast, Dijital Broşür ve Literatür öğrenme araçlarını altı eğitim kategorisinde tüketir (`/videolarim/[urun|medikal|urun-medikal|satis|yonetim|ik]`). Yayın ile gerçek öğrenme aracı bağı `yayin_id`, `arac_id` ve `arac_turu` kimlikleriyle korunur.
* **Puanlı Öğrenme:** Hafta içi 07.00–20.29 arasındaki ilk uygun tamamlamada içerik puanı verilir. Doğru cevap ilgili soru puanını kazandırır; yanlış cevap aynı puan kadar kayıp üretir. Video ileri sarma kaybı, atlanan sürenin içerik puanındaki oransal karşılığıdır. Puan dışı zamanda kazanım veya kayıp oluşmaz. İlk izleme hariç, takvim ayı ile geçerli turun kesişimindeki üçüncü temiz tam tekrarda bir kez Extra puan verilir.
* **Soru Hakkı:** Soru kümesi izleme kimliğine sabitlenir. Tamamlamadan sonra sorular yanıtlanmadan akış terk edilir ve yeni oturum başlatılırsa önceki oturumun soru hakkı kapanır ve yeniden açılamaz.
* **Rapor, Lig ve Mağaza:** UTT/KD_UTT kişisel raporunu (`/raporlar/utt`) ve HB Ligi'ni (`/hb-ligi`) izler; firma için HBStore açıksa kendi harcanabilir puanıyla sipariş oluşturabilir (`/store`).
* **BM ve TM:** BM, bölgesindeki aktif UTT/KD_UTT kullanıcılarına UTT hedefli öğrenme içerikleri önerir. Bir alıcı haftada en fazla üç öneri alabilir; BM'nin aylık gönderim kotası bölgesindeki aktif UTT/KD_UTT sayısının on iki katıdır. BM kendi bölgesinin, TM ise kendi takımındaki BM–UTT öneri ve performans sonuçlarının hiyerarşik görünümünü izler; öneri oluşturma yetkisi yalnız BM'dedir.

### 2. Aşama: Kod Taraması ve Görev İlişki Matrisi
* **Tüketim ve Puan:** `app/(panel)/videolarim/`, `components/izle/VideoOynatici.tsx`, `app/izle/api/`, `lib/tclub/puan/`, `lib/tclub/tur/`, `lib/izleme/`, `lib/ogrenmeAraci/`.
* **Öneri, Rapor ve Lig:** `app/(panel)/oneriler/`, `app/(panel)/yayindaki-videolar/`, `app/(panel)/raporlar/utt/`, `app/(panel)/raporlar/bm/`, `app/(panel)/raporlar/tm/`, `lib/tclub/oneri/`, `lib/tclub/hbligi/`.
* **HBStore:** `app/(panel)/store/` ve `lib/tclub/store/`. Stok, bakiye, sipariş ve harcama yarışları `store_siparis_olustur`, `store_siparis_iptal` ve `store_teslim_aldim` RPC'leriyle atomik olarak yönetilir.
* **Güvenlik Kapıları:** Gerçek oynatma başlamadan izleme oturumu oluşturulmaz; yayın, rol, firma, takım, geçerli tur, puan zamanı, soru erişimi ve öğrenme aracı kimliği sunucuda yeniden doğrulanır.

**Doğrulama kaydı — 3 Eylül 2026:** T-Club tüketim, puan, soru, kategori, lig, mağaza ve ortak öğrenme aracı sözleşmelerine yönelik seçili otomatik testlerin **18 / 18'i başarılıdır**.

### 3. Aşama: Depo Şema ve DDL Kaydı
Bu kayıt canlı veritabanı doğrulaması değildir. `scripts/denetim/sema.json` içindeki **31 Ağustos 2026 tarihli depo şema anlık görüntüsü** ile kaynak SQL sözleşmelerini ifade eder.

* **Tüketim ve Puan Tabloları:** `izleme_kayitlari`, `kazanilan_puanlar`, `ileri_sarma_kayitlari`, `yanlis_cevap_kayitlari`, `soru_cevaplari`, `oneri_kayip_kayitlari`, `oneri_kayitlari`, `yayin_tekrar_kayitlari`.
* **HBStore Tabloları:** `store_urunler`, `store_urun_firma_ayarlari`, `store_siparisler`, `store_puan_harcamalari`, `store_adresler`.
* **Rapor, Lig ve İşlem RPC'leri:** `get_hb_ligi_haftalik_v2`, `get_hb_ligi_aylik_v2`, `get_hb_ligi_donemlik_v2`, `get_hb_ligi_yillik_v2`, `get_harcama_bakiyesi`, `get_oneri_listesi`, `store_siparis_olustur`, `store_siparis_iptal`, `store_teslim_aldim`.

---

# 2. BÖLÜM: C-CLUB (Challenge Club — Yönetici Öğrenmesi)
*Bölge Müdürleri Arası Yarışma ve Öğrenme Katmanı*

### 1. Aşama: Rol ve Görev Tanımları
* **BM $\rightarrow$ BM Challenge:** C-Club yalnız aktif ve aynı firmadaki BM kullanıcıları arasında çalışır. BM kendisine challenge gönderemez ve yalnız geçerli turda önce kendisinin tamamladığı Video, Podcast, Dijital Broşür veya Literatür aracını challenge'a dönüştürebilir. Yayın–araç bağı `yayin_id`, `arac_id` ve `arac_turu` ile korunur.
* **Gönderim Sınırları:** Bir BM ayda en fazla üç challenge gönderir. Aynı gönderenden aynı alıcıya takvim ayında yalnız bir challenge gönderilebilir. Aynı öğrenme aracı aynı alıcıya aynı turda yeniden gönderilemez; aracı geçerli turda tamamlamış veya aynı araç için bekleyen challenge'ı bulunan alıcı seçilemez. İki BM'nin aynı ay birbirine karşılıklı challenge göndermesi serbesttir.
* **Puan ve Tamamlama:** Challenge oluşturulunca gönderene `sistem_ayarlari.cc_gonderme_puani`, alıcı öğrenme aracını ve sorularını tamamlayınca gönderene bir kez `sistem_ayarlari.cc_referral_puani` yazılır; ayar bulunmazsa her iki değer için de 10 puan kullanılır. Alıcı uygun ilk tamamlamada içerik ve doğru cevap puanlarını kazanır; ileri sarma ve yanlış cevap ilgili kayıp kayıtlarını üretir. İlk izleme hariç, takvim ayı ile geçerli turun kesişimindeki ikinci temiz tam tekrarda bir kez Extra puan verilir.
* **Süresiz Bekleme:** Challenge için süre sonu veya süre aşımı kaybı bulunmaz; kayıt tamamlanana kadar bekler. Tarihsel `son_tarih` alanı geriye dönük uyumluluk için korunur ve `challenge_kaybi_tara` cron'u kapalıdır.
* **Soru Hakkı:** Soru kümesi izleme kimliğine sabitlenir. Tamamlamadan sonra sorular yanıtlanmadan akış terk edilir ve yeni oturum başlatılırsa önceki soru hakkı kapanır. Challenge'ın tamamlanma durumu ve referral puanı yalnız geçerli cevap akışıyla sonuçlandırılır.
* **Lig ve Mağaza:** BM, C-Club Ligi'nde (`/cc-ligi`) yarışır ve C-Club harcanabilir puanını firma için HBStore açıksa mağazada kullanabilir.

### 2. Aşama: Kod Taraması ve Görev İlişki Matrisi
* **Challenge ve Katalog:** `app/(panel)/challenge-club/`, `components/challenge-club/CcVideoOynatici.tsx`, `lib/cclub/kayit.ts`, `lib/cclub/kotaKontrol.ts`, `lib/cclub/uygunAliciListesi.ts`, `lib/cclub/uygunVideoListesi.ts`.
* **Tüketim ve Puan:** `app/(panel)/challenge-club/izle/api/`, `lib/cclub/izleme/`, `lib/cclub/puan/`, `lib/cclub/tekrarIzlemeKontrol.ts`.
* **Güvenlik Kapıları:** Gönderici, alıcı, firma, modül, yayın, tur ve araç kimliği sunucuda doğrulanır. Challenge ile gönderme puanı `cc_challenge_gonder`; tamamlama ve cevaplar `cc_izleme_tamamla` ile `cc_cevaplari_kaydet` üzerinden atomik yürür. Mükerrer gönderim, cevap ve referral kayıtları yapısal olarak engellenir.

**Doğrulama kaydı — 3 Eylül 2026:** C-Club challenge, tüketim, puan, soru, lig, yetki ve ortak öğrenme aracı sözleşmelerine yönelik seçili otomatik testlerin **18 / 18'i başarılıdır**.

### 3. Aşama: Depo Şema ve DDL Kaydı
Bu kayıt canlı veritabanı doğrulaması değildir. `scripts/denetim/sema.json` içindeki **31 Ağustos 2026 tarihli depo şema anlık görüntüsü** ile kaynak SQL sözleşmelerini ifade eder.

* **Çekirdek Tablolar ve Görünüm:** `challenge_kayitlari`, `cc_izleme_kayitlari`, `cc_kazanilan_puanlar`, `cc_ileri_sarma_kayitlari`, `cc_yanlis_cevap_kayitlari`, `cc_ligi_ozet`, `v_cc_challenge_listesi`.
* **Çekirdek RPC'ler:** `cc_arac_kimligi_dogrula`, `cc_challenge_gonder`, `cc_izleme_tamamla`, `cc_cevaplari_kaydet`, `cc_challenge_tamamlaninca_bildirim_kapat`, `_cc_ligi_aralik` ve dönemsel `get_cc_ligi_*` ailesi.

---

# 3. BÖLÜM: E-CLUB (Eczane Kulübü)
*Eczane Kullanıcı Katmanı — Çok Firmalı Öğrenme, Takım, Lig, Rapor ve Ödül Yapısı*

### 1. Aşama: Rol ve Görev Tanımları
* **E-Club Kullanıcıları:** `eczaci`, `ikinci_eczaci`, `yardimci_eczaci` ve `eczane_teknisyeni` ayrı unvanlardır. İlk üç unvan yayın hedeflemesinde `eczaci`, teknisyen ise `eczane_teknisyeni` hedef grubuna bağlanır. Eczanede bir aktif ana `eczaci` kaydı bulunabilir; ikinci ve yardımcı eczacı ayrı unvanlarla yaşar.
* **E-Club Takımım (`/eclub/eczanelerim`):** UTT/KD_UTT, takımına ad verir (`eclub_takim_adlari`), onaylı GLN üzerinden eczaneleri kendi listesine bağlar, eczane kullanıcılarını yönetir ve öğrenme aracı önerilerini oluşturur.
* **E-Club Ligi (`/eclub/ligi`):** Firma genelindeki UTT takımlarının dönemsel yarışmasını, ilk üç takım podyumunu, genel sıralamayı ve kullanıcının kendi takımını gösterir.
* **E-Club Takım Raporları (`/eclub/raporlar`):** Eczane ve kişi düzeyinde gönderim, tamamlama, doğru cevap ve puan sonuçlarını gösterir. UTT, BM, TM, üretici ve yönetici rollerinin lig, rapor ve sipariş kapsamı kendi firma–takım–bölge hiyerarşilerine göre çözülür.
* **Kurumsal Eczane ve Liste Üyeliği:** `eclub_eczane_master` onaylı GLN kaynağıdır; `eclub_eczaneler` platform eczanesini, `eclub_eczane_firma` firma–eczane kurumsal bağını tutar. Bu bağdan `eclub_utt_eczane` ile UTT'nin kişisel liste üyeliği, `eclub_kisi_eczane` ile eczane kullanıcısının eczane ilişkisi ayrılır. Aynı firmanın birden fazla UTT'si aynı kurumsal eczane bağında ayrı üyelikler kurabilir. Bir UTT'nin listeden çıkması diğer UTT üyeliklerini bozmaz; son aktif UTT de çıktığında firma–eczane bağı pasife alınır.
* **Öneri ve Tüketim:** UTT, kendi firma ve takım kapsamındaki Video, Podcast, Dijital Broşür veya Literatür aracını bir veya birden fazla eczane kullanıcısına önerir. Öneri `yayin_id`, `arac_id` ve `arac_turu` kimlikleriyle saklanır. Önerinin puanlı ve sorulu geçerlilik süresi ayarlanabilir; varsayılan 7 gündür. Aynı UTT'nin aynı kişiye aynı aracı yeniden göndermesi için önceki önerinin bitişinden sonra ayarlanabilir bir süre beklenir; varsayılan 21 gündür. Süresi geçmiş öneri izlenebilir ancak puan ve soru hakkı vermez.
* **Puan Kuralları:** Aktif öneride uygun tamamlama ve doğru cevaplar puan kazandırır. İleri sarma, atlanan sürenin araç puanındaki oransal karşılığını ilgili firma bakiyesinden düşürür; yanlış cevap kayıp üretmez. Soru kümesi izleme kimliğine sabitlenir ve tamamlamadan sonra terk edilen soru hakkı yeni oturumda yeniden açılmaz.
* **E-Club Store:** Kişinin aktif firma bağlarından kazandığı puanlar firma bazında izlenir ve uygun ürün için tek siparişte birleştirilebilir. Ürün görünürlüğü global katalog ile firma ayarlarının kesişimidir. Sipariş yalnız aktif E-Club üyeliğiyle açılır; puanlar ürüne izin veren firmalar arasında en yüksek bakiyeden başlayarak kademeli düşülür ve `eclub_store_siparis_firma_puan` ile kaynak firmalara dağıtılır.

### 2. Aşama: Kod Taraması ve Görev İlişki Matrisi
* **Eczane, UTT ve Kişi Bağları:** `app/(panel)/eclub/listem/`, `lib/eclub/uttEczane.ts`, `lib/eclub/kisiErisim.ts`, `eclub_utt_eczaneye_bagla`, `eclub_utt_eczaneden_cikar`, `eclub_yeni_kisi_provizyonu`, `eclub_mevcut_kisi_provizyonu`.
* **Öneri ve Tüketim:** `app/(panel)/eclub/oneriler/`, `app/(panel)/eclub/videolarim/`, `app/(panel)/eclub/panel/`, `lib/eclub/oneriLimit.ts`, `lib/eclub/oneriKapsam.ts`, `lib/eclub/izlemeKurali.ts`, `lib/eclub/aktifYayinYetkisi.ts`.
* **Lig, Rapor ve Sipariş:** `app/(panel)/eclub/ligi/`, `app/(panel)/eclub/raporlar/`, `app/(panel)/eclub/siparisler/`, `lib/eclub/rapor.ts`, `lib/eclub/yonetimKapsami.ts`.
* **E-Club Store:** `app/(panel)/eclub/store/`, `lib/eclub/store/`, `scripts/sql/eclub_store_firma_urun_gorunurlugu.sql`, `scripts/sql/eclub_store_aktif_uyelik_siparis_kapisi.sql`.
* **Güvenlik Kapıları:** UTT liste üyeliği, kişi–eczane bağı, firma modül bayrakları, yayın kapsamı, araç kimliği, öneri süresi ve aktif üyelik sunucuda doğrulanır. Öneri, tamamlama, cevap ve sipariş yazımları korumalı RPC'lerden geçer.

**Doğrulama kaydı — 3 Eylül 2026:** E-Club unvan, üyelik, çoklu UTT, öneri, tüketim, lig, rapor, Store ve ortak öğrenme aracı sözleşmelerine yönelik seçili otomatik testlerin **38 / 38'i başarılıdır**.

### 3. Aşama: Depo Şema ve DDL Kaydı
Bu kayıt canlı veritabanı doğrulaması değildir. `scripts/denetim/sema.json` içindeki **31 Ağustos 2026 tarihli depo şema anlık görüntüsü** ile kaynak SQL sözleşmelerini ifade eder.

* **Eczane ve Üyelik Tabloları:** `eclub_eczane_master`, `eclub_eczaneler`, `eclub_eczane_firma`, `eclub_utt_eczane`, `eclub_kisiler`, `eclub_kisi_eczane`, `eclub_takim_adlari`.
* **Öneri, Tüketim ve Puan Tabloları:** `eclub_oneri_kayitlari`, `eclub_izleme_kayitlari`, `eclub_kazanilan_puanlar`, `eclub_ileri_sarma_kayitlari`, `eclub_dogru_cevap_kayitlari`, `eclub_yanlis_cevap_kayitlari`, `eclub_oneri_kayip_kayitlari`, `eclub_utt_puanlari`.
* **E-Club Store Tabloları:** `eclub_store_urunler`, `eclub_store_urun_firma_ayarlari`, `eclub_store_siparisler`, `eclub_store_siparis_firma_puan`, `eclub_store_adresler`.
* **Çekirdek RPC'ler:** `eclub_utt_eczaneye_bagla`, `eclub_utt_eczaneden_cikar`, `eclub_oneri_atomik_kaydet`, `eclub_izleme_tamamla`, `eclub_cevaplari_kaydet`, `eclub_ileri_sarma_kaydet`, `get_eclub_utt_rapor`, dönemsel `get_eclub_ligi_*` ailesi, `get_eclub_store_firma_bakiye`, `eclub_store_siparis_olustur`, `eclub_store_siparis_iptal`, `eclub_store_teslim_aldim`.

---

# 4. BÖLÜM: ECZANEM (Üye Öğrenme, Puan ve Eczane İşlem Katmanı)
*Eczanem Uygulaması Üyeleri İçin Öğrenme İçeriği ve Eczane Bağlantılı Platform İşlemleri*

### 1. Aşama: Rol ve Görev Tanımları
* **Kimlik ve Giriş:** Eczanem uygulaması üyesi `eczanem_musteriler` kimlik düzleminde yaşar ve `/login` üzerinden e-posta veya cep telefonu ile şifresini kullanarak giriş yapar. SMS bağlantısıyla giriş kullanılmaz; başarılı giriş üyeyi `/eczanem` alanına yönlendirir.
* **Eczane Bazlı Üyelik:** Aynı kişi birden fazla eczaneye ayrı `eczanem_uyelikler` bağlarıyla üye olabilir. Öğrenme, ilerleme, soru ve yeni puan kazanımı ilgili eczanedeki aktif üyeliğe bağlıdır. Eczane üyeliği pasife alındığında yeni öğrenme ve puan kazanımı durur; mevcut puanlar varsayılan 30 günlük geçiş süresinde görülebilir ve kullanılabilir, süre sonunda kullanım da kapanır.
* **İki Kademeli Öğrenme İçeriği Dağıtımı:** UTT/KD_UTT, kendi firma ve takım kapsamındaki Eczanem hedefli Video, Podcast, Dijital Broşür veya Literatür aracını yalnız kişisel listesinde bulunan ve aktif üye eşiğini karşılayan eczaneye gönderebilir. Eşik `sistem_ayarlari.eczanem_aktif_uye_esigi` üzerinden belirlenir; varsayılan 10'dur. Yetkili eczane personeli yalnız eczaneye ulaşmış içeriği o eczanenin aktif Eczanem uygulaması üyelerine dağıtabilir. Aynı yayın–eczane ve yayın–üye–eczane birleşimleri mükerrer gönderimi yapısal olarak engeller.
* **Bildirim ve İçerik Rafı:** Başarılı dağıtım, tarayıcı bildirim izni bulunan üyeye Web Push ile bildirilebilir; SMS veya e-posta bildirim kanalı kullanılmaz. Üye içerikleri yeni, yarım bırakılan, son tamamlanan, en çok beğenilen, favorilenen ve izlenen raflarında görür. Yayın–araç bağı `yayin_id`, `arac_id` ve `arac_turu` kimlikleriyle korunur.
* **Kayıpsız Öğrenme Modeli:** İleri sarma kapalıdır ve oynatıcı kullanıcıyı son doğrulanmış konuma döndürür; ileri sarma kaybı oluşmaz. Yanlış cevap puan kaybı üretmez, doğru cevaplar ilgili soru puanını kazandırabilir. Soru kümesi izleme kimliğine sabitlenir; tamamlamadan sonra sorular yanıtlanmadan akış terk edilir ve yeni oturum başlatılırsa önceki soru hakkı yeniden açılamaz.
* **Puan Kaynağı ve Ömrü:** Puan `musteri_id + eczane_id + firma_id + urun_id` bağıyla kaynağından ayrılmadan saklanır. Puan ömrü `sistem_ayarlari.eczanem_puan_omru_gun` üzerinden belirlenir; varsayılan 180 gündür. Kullanım, geçerli puan kayıtlarından FIFO sırasıyla yapılır.
* **Barkodlu Talep ve Eczane Onayı:** Üye barkod üzerinden bir indirim talebi oluşturur; talep aşamasında puan düşmez ve geçerli tarifenin anlık görüntüsü siparişe yazılır. Yetkili eczane personelinin onayında puan atomik FIFO işlemiyle düşer; ret veya üyenin vazgeçmesi puan düşürmez. HapBilgi puan veya indirimi tek taraflı belirlemez; yetkili kullanıcıların yayın ve tarife kapsamında girdiği parametreleri kaydeder ve hesaplar. HapBilgi, eczane ile Eczanem uygulaması üyesi arasındaki ticari ilişkinin tarafı değildir.
* **Kimlik Geçişi ve Silme:** Eczanem uygulaması üyesinin E-Club unvanına alınması çift kimlik oluşturmayan kontrollü karar akışıyla ve aynı giriş hesabı korunarak yapılır. Üye, şifresini yeniden doğrulayarak kendi uygulama ve Auth kimliğini `eczanem_musteri_kendini_tam_sil` üzerinden atomik olarak silebilir.

### 2. Aşama: Kod Taraması ve Görev İlişki Matrisi
* **Üye Yüzeyi ve Kimlik:** `app/login/`, `app/eczanem/`, `app/eczanem/api/giris/sifre/route.ts`, `lib/eczanem/oturum.ts`, `lib/eczanem/telefon.ts`, `lib/eczanem/aktifUyelik.ts`, `lib/eczanem/erisim.ts`.
* **Dağıtım ve Öğrenme:** `app/(panel)/eczanem/utt/`, `app/(panel)/eczanem/eczane/`, `app/eczanem/api/izleme/`, `lib/eczanem/gonderim.ts`, `components/ogrenme-araci/`.
* **Puan, Tarife ve İşlem:** `app/eczanem/api/puanlar/`, `app/eczanem/api/siparis/`, `lib/eczanem/kasa.ts`, `lib/eczanem/tarife.ts`, `lib/eczanem/dokum.ts`.
* **Geçiş ve Silme:** `app/eczanem/api/eclub-gecisi/route.ts`, `app/eczanem/api/hesabimi-sil/route.ts`, `lib/eczanem/silme.ts`, `eczanem_eclub_gecis_karar_ver`, `eczanem_musteri_kendini_tam_sil`.
* **Güvenlik Kapıları:** Üye kimliği, eczane üyeliği, firma modül bayrağı, UTT liste bağı, yayın kapsamı, araç kimliği, aktif üye eşiği, tarife ve sipariş sahipliği sunucuda yeniden doğrulanır. Dağıtım, tamamlama, cevap, üyelik ve sipariş kararları korumalı RPC'lerden geçer.

**Doğrulama kaydı — 3 Eylül 2026:** Eczanem kimlik, çoklu üyelik, dağıtım, tüketim, puan, tarife, sipariş, kontrollü geçiş, hesap silme ve ortak öğrenme aracı sözleşmelerine yönelik seçili otomatik testlerin **41 / 41'i başarılıdır**.

### 3. Aşama: Depo Şema ve DDL Kaydı
Bu kayıt canlı veritabanı doğrulaması değildir. `scripts/denetim/sema.json` içindeki **31 Ağustos 2026 tarihli depo şema anlık görüntüsü** ile kaynak SQL sözleşmelerini ifade eder.

* **Kimlik ve Üyelik Tabloları:** `eczanem_musteriler`, `eczanem_uyelikler`, `eczanem_silinen_musteriler`, `eczanem_personel_islemleri`.
* **Dağıtım ve Tüketim Tabloları:** `eczanem_eczane_gonderimleri`, `eczanem_gonderimler`, `eczanem_izleme_kayitlari`, `eczanem_cevap_kayitlari`, `eczanem_video_begeniler`, `eczanem_video_favoriler`.
* **Puan ve İşlem Tabloları:** `eczanem_puan_kayitlari`, `eczanem_harcama_kayitlari`, `eczanem_siparisler`, `eczanem_urun_tarifeleri`.
* **Kontrollü Geçiş Tabloları:** `eczanem_eclub_gecis_talepleri`, `eczanem_eclub_gecis_kayitlari`, `eczanem_eclub_puan_kapanislari`.
* **Dağıtım ve Tüketim RPC'leri:** `eczanem_utt_eczaneye_gonder`, `eczanem_musterilere_video_gonder`, `eczanem_gonderim_arac_kimligi_dogrula`, `eczanem_izleme_aktif_uyelik_kapisi`, `eczanem_izleme_tamamla`, `eczanem_cevaplari_kaydet`.
* **Üyelik, İşlem ve Kimlik RPC'leri:** `eczanem_musteri_bagla_atomik`, `eczanem_musteri_durum_degistir`, `eczanem_uyelik_listeden_sil`, `eczanem_siparis_personel_islemi`, `eczanem_eclub_gecis_talebi_olustur`, `eczanem_eclub_gecis_karar_ver`, `eczanem_musteri_kendini_tam_sil`.

---

# 5. BÖLÜM: ÜRETİM & YÖNETİM OMURGASI
*İlk kayıt: 24 Ağustos 2026 | Güncelleme: 3 Eylül 2026 | Kapsam: İçerik Fabrikası, Dört Öğrenme Aracı, Çoklu İÜ Görev Modeli, Yayın Yönetimi ve Üretim Raporları*

### 1. Aşama: Rol, Talep ve Görev Tanımları
* **13 Üretici Rolünün Yetenek Profilleri (`lib/uretici/yetenekler.ts`):**
  * **Ürün Ailesi (`pm`, `jr_pm`, `kd_pm`):** Takım zorunludur; `urun_egitimi` açar, ürün zorunlu ve teknik tercihlidir. Eczanem hedefli ürün talebi açabilen tek üretici ailesidir (`ECZANEM_TALEP_ACAN_ROLLER`).
  * **Medikal Ailesi (`med_md`):** Firma seviyesindedir; `medikal_egitim` ve `urun_medikal_egitim` açar.
  * **Eğitim Ailesi (`egt_*`):** Firma seviyesindedir; `satis_teknikleri` ve `yonetim_egitimi` açar. Satış teknikleri talebinde teknik zorunludur.
  * **İK Ailesi (`ik_*`):** Firma seviyesindedir; `ik_egitimi` ve `yonetim_egitimi` açar; E-Club hedefli talep oluşturamaz.
* **Talep Sahipliği ve Hedef Sözleşmesi:** Her üretici yalnız kendi açtığı talepleri görür. Talebe bağlanan ürün ve teknik üreticinin firmasına ait olmalıdır. Hedef kitle `utt`, `bm`, `eczaci`, `eczane_teknisyeni` veya `eczanem` değerlerinden biridir; yalnız `eczaci` ile `eczane_teknisyeni` birlikte seçilebilir. Talep türünden türetilen içerik türü ile seçilen öğrenme aracı türü talep oluşturulduğunda sabitlenir.
* **Öğrenme Araçları:** Üretim omurgası **Video** (`video`), **Podcast** (`podcast`), **Dijital Broşür** (`gorsel`) ve **Literatür** (`flip_pdf`) araçlarını destekler. Her araç ayrı özellik bayrağıyla açılıp kapatılabilir. Tarihsel `video` aşaması ve `hazir_video` alanı ortak üretim anahtarı olarak korunur; kullanıcı arayüzünde seçilen aracın gerçek adı gösterilir.
* **4 Üretim Varyantı:**

| Varyant | Hazır Gelen | İÜ Görev Zinciri |
|---|---|---|
| **V1 — Tam Üretim** | Yok | Senaryo $\rightarrow$ seçilen öğrenme aracı $\rightarrow$ soru seti |
| **V2 — Hazır Öğrenme Aracı** | Seçilen öğrenme aracı | Soru seti |
| **V3 — Hazır Soru Seti** | Soru seti | Senaryo $\rightarrow$ seçilen öğrenme aracı |
| **V4 — İkisi Hazır** | Seçilen öğrenme aracı ve soru seti | İÜ görevi açılmaz; yayın yönetimine geçilir |

* **Atomik Talep Oluşturma:** Talep ve varyanta uygun ilk görev `talep_atomik_olustur` ile aynı işlem içinde oluşturulur. Aynı istemci işlem anahtarının tekrarı mükerrer talep, görev veya işlem kaydı üretmez; aynı anahtarla değiştirilmiş talep verisi kabul edilmez.
* **Çoklu İÜ Görev Modeli:** Görev durumları `atama_bekliyor` $\rightarrow$ `hazirlaniyor` $\rightarrow$ `inceleme_bekliyor` $\rightarrow$ `revizyon_bekliyor` $\rightarrow$ `tamamlandi` / `iptal` akışındadır. Atama kaynağı `otomatik`, `manuel`, `devir` veya `gecis` olabilir. Bir talepte sonraki görev açılmadan önce mevcut aktif görev kapatılır; otomatik aday seçimini `uretim_iu_adayi_sec` yürütür.
* **Revizyon ve Sürüm Güvenliği:** Senaryo fark görünümü `SenaryoDuzeltmeEditoru` ile korunur. Senaryo ve seçilen öğrenme aracı için en fazla iki revizyon istenebilir ve revizyon notu zorunludur. Karar isteği incelenen görev sürümünü taşır; güncelliğini yitirmiş ekrandan gönderilen karar yeni görev veya durum kaydı oluşturmadan reddedilir.
* **Medya Yükleme ve Kurtarma:** Video, Bunny Stream TUS hattıyla doğrudan yüklenir ve beş dakikalık işleme takibi kullanır. Podcast, Dijital Broşür ve Literatür dosyaları süreli imza üzerinden Bunny Storage hattına aktarılır; uzantı, MIME, boyut, gerçek dosya imzası, SHA-256 özeti ve araca özgü metadata doğrulanır. Kesilen yükleme aynı kayıt üzerinden yalnız eksik parçalarla sürdürülebilir veya dış depolama nesneleriyle geçici veritabanı kayıtları birlikte temizlenerek iptal edilebilir.
* **Yayın Kapısı ve Puanlama:** Öğrenme aracı onaylanmadan, metadata doğrulaması tamamlanmadan, araç puanı ve bütün soru puanları tanımlanmadan yayın açılamaz. Saha yayınında Extra puan 5–10 arasındadır; E-Club ve Eczanem yayınında Extra puan bulunmaz. Eczanem hedefinde barkod, Karşılık ve satış fiyatı zorunludur. Hemen yayın Tur-1'i açar; ileri tarihli yayın `planlandi` durumunda bekler. Depodaki pg_cron sözleşmesi tarihi gelen yayınları Türkiye saatiyle 07.00'de, güvenlik tekrarı olarak 07.10'da aktive eder.

### 2. Aşama: Operasyonel Kod ve İş Akışı Kaydı
1. **Rol, Talep ve Hedef Doğrulaması:** `app/(panel)/talepler/api/route.ts`, `lib/uretici/yetenekler.ts`, `lib/utils/roller.ts`, `lib/uretici/talepKaynakSahipligi.ts`.
2. **Atomik Talep Oluşturma:** `talep_atomik_olustur`, `lib/uretim/parametreKontrol.ts` ve istemci işlem anahtarıyla talep–ilk görev bütünlüğü.
3. **İÜ Atama ve Görev Yönetimi:** `lib/uretim/gorevSozlesmesi.ts`, `app/(panel)/uretim/api/gorevler/route.ts`, `uretim_talep_ilk_gorevini_ac`, `uretim_iu_adayi_sec`, `uretim_gorev_devret`.
4. **Dört Araçlı Üretim ve Revizyon:** `lib/ogrenmeAraci/uretimAkisi.ts`, `app/(panel)/uretim/gorevler/[gorev_id]/page.tsx`, araç türüne özgü doğrulama ve karar RPC'leri ile ortak sürüm kapısı.
5. **Yükleme, Kurtarma ve Temizlik:** `lib/video/bunnyYukleme.ts`, `lib/ogrenmeAraci/bunnyStorage.ts`, `lib/ogrenmeAraci/bunnyYuklemeIstemci.ts`, `app/api/ogrenme-araclari/` ve yarım yükleme temizleme akışı.
6. **Soru Seti Üretimi:** `lib/soru/taslak.ts`, `components/SoruIceAktar.tsx`, `uretim_soru_seti_dogrula`, soru seti büyüklüğü ve hazır set parametre kilidi.
7. **Yayın Yönetimi:** `app/(panel)/yayin-yonetimi/`, `yayin_arac_kapisini_dogrula`, yayın öncesi kilitli silme zinciri, Tur-1 ve `scripts/sql/yayin_aktivasyon.sql`.
8. **Üretim ve Yönetici Raporları:** `app/(panel)/raporlar/api/uretim/route.ts`, `app/(panel)/raporlar/api/yonetici/route.ts`, `lib/rapor/uretim/getUretimData.ts`, `lib/rapor/paylasilan/aracTuruDagilimi.ts`. Üretim raporu kişisel talep listesi değil, kullanıcının yetkili olduğu firmanın üretim portföyüdür; eğitim türü, varyant ve öğrenme aracı dağılımları ile tüketim olaylarını ayrı eksenlerde gösterir.

**Doğrulama kaydı — 3 Eylül 2026:** Bölüm 5 kapsamındaki rol, hedef, talep, varyant, görev, revizyon, sürüm, yükleme, yayın, silme, raporlama ve veri sözleşmelerine yönelik seçili otomatik testlerin **87 / 87'si başarılıdır**.

### 3. Aşama: Depo Şema ve DDL Kaydı
Bu kayıt canlı veritabanı doğrulaması değildir. `scripts/denetim/sema.json` içindeki **31 Ağustos 2026 tarihli depo şema anlık görüntüsü** ile kaynak SQL sözleşmelerini ifade eder.

* **Talep ve Görev Omurgası:** `talepler`, `uretim_gorevleri`, `uretim_gorev_atama_gecmisi`, `uretim_islem_kayitlari`, `iu_urun_atamalari`, `iu_genel_atamalari`.
* **Sürümlü İçerik Kayıtları:** `senaryolar`, `senaryo_durumu`, `soru_setleri`, `soru_seti_durumu`, `soru_seti_puanlari`.
* **Ortak Öğrenme Aracı Kayıtları:** `ogrenme_araclari`, `ogrenme_araci_durumu`, `ogrenme_araci_puanlari`, `ogrenme_araci_video_yukleme_oturumlari`, `ogrenme_araci_depolama_temizleme_kuyrugu`.
* **Video Uyumluluk Kayıtları:** `videolar`, `video_durumu`, `video_puanlari`. Ortak öğrenme aracı modeli mevcut video zincirini kaldırmadan ve kimlikleri eşleyerek çalışır.
* **Yayın ve Tur Kayıtları:** `yayin_yonetimi`, `yayin_tekrar_kayitlari`.
* **Üretim ve Rapor Görünümleri:** `v_yayin_detay`, `v_uretici_icerik_takip`, `v_rapor_arac_turu_ozet`, `v_rapor_arac_turu_olaylari`. `v_uretim_detay` kaldırılmıştır; üretim ilişkileri doğrudan `talep_id` üzerinden kurulur.
* **Talep ve Görev RPC Ailesi:** `talep_atomik_olustur`, `uretim_talep_ilk_gorevini_ac`, `uretim_iu_adayi_sec`, `uretim_gorev_devret`, `uretim_senaryo_teslim_et`, `uretim_video_teslim_et`, `uretim_soru_seti_teslim_et`, `uretim_uretici_karar_ver`, `uretim_karar_surum_kapisi`.
* **Araç Türüne Özgü Üretim RPC'leri:** `uretim_podcast_dogrula`, `uretim_podcast_uretici_karar_ver`, `uretim_podcast_soru_zinciri_ac`, `uretim_gorsel_dogrula`, `uretim_gorsel_uretici_karar_ver`, `uretim_flip_pdf_dogrula`, `uretim_flip_pdf_uretici_karar_ver`.
* **Yükleme ve Yayın RPC Ailesi:** `ogrenme_araci_yukleme_baslat`, `ogrenme_araci_yukleme_dogrulama_kaydet`, `ogrenme_araci_yarim_yukleme_iptal`, `yayin_arac_kapisini_dogrula`, `yayin_oncesi_silme_baslat`, `yayin_oncesi_silme_hata`, `yayin_oncesi_silme_tamamla`, `yayin_oncesi_silme_yayin_kapisi`, `yayin_planlananlari_aktive`.
* **Yönetim ve Rapor RPC'leri:** `get_yonetici_hiyerarsi_v2`, `get_yonetici_rapor_ana_ozet_v2`, `get_yonetici_egitim_turu_etkisi_v3`.

---

# 6. BÖLÜM: BÜTÜNSEL MİMARİ REFACTORİNG, DRY VE TEMİZLİK SİCİLİ
*İlk kayıt: 24 Ağustos 2026 | Güncelleme: 3 Eylül 2026 | Kapsam: Kulüp Modülleri ve Ortak Platform Katmanları, DRY Tek-Kaynak Konsolidasyonu ve Ölü Kod Tasfiyesi*

### 1. Amaç ve İcra Kapsamı
23 Ağustos 2026 denetiminin ardından, sistem genelindeki dağınık kütüphane motorları, geçmiş sürümlerden kalan sürüm takıları (`hbligi_v2`), kod tekrarları (DRY ihlalleri) ve atomik RPC mimarisine geçiş sonrası atıl kalan ölü kodlar kapsamlı bir refactoring operasyonuyla temizlenmiştir.

### 2. Modüler Dizin İzolasyonu ve Sorumluluk Sınırları (`lib/`)
Kulüp motorları ve ortak platform katmanları, ortak mimari ilkeler içinde kendi işlevsel sorumluluk sınırlarına ayrılmıştır:
* **T-Club:** `lib/puan/`, `lib/tur/`, `lib/oneri/`, `lib/hbligi_v2/`, `lib/store/` dağınık kök dizinleri toplanarak **`lib/tclub/`** altına taşınmış; `hbligi_v2` takısı standart `hbligi` olarak sadeleştirilmiştir.
* **C-Club:** `lib/cc/` kısaltması tam modüler standart için **`lib/cclub/`** olarak adlandırılmıştır.
* **E-Club:** `lib/eclub/` (17 dosya) modüler sınırları korunmuştur.
* **Eczanem:** `lib/eczanem/` (11 dosya) B2C ve B2B ayrımıyla korunmuştur.
* **Üretim & Ortak:** `lib/uretim/`, `lib/uretici/`, `lib/video/`, `lib/rapor/` ve `lib/utils/` bağımsız katmanlar olarak tescillenmiştir.
* **Ortak Çekirdek Hizmetler:** `lib/ogrenmeAraci/`, `lib/push/`, `lib/auth/`, `lib/admin/`, `lib/kimlik/` ve `lib/izleme/` öğrenme araçları, bildirim, kimlik doğrulama, yönetim, kimlik çözümleme ve izleme sorumluluklarını ayrı modüllerde yürütür.

### 3. DRY (Don't Repeat Yourself) Tek-Kaynak Konsolidasyonu
1. **Yayın $\rightarrow$ Ürün Çözümleyici:** Proje genelinde 3 farklı yerde elle çağrılan `get_urun_from_yayin` RPC'si, `@/lib/utils/yayinUrun.ts` (`yayindanUrunId`) altında tekilleştirilmiştir.
2. **Tohumlu Fisher-Yates Soru Seçimi:** E-Club içindeki mükerrer 35 satırlık rastgele soru algoritması silinip `@/lib/soru/secim` (`sabitSoruIndeksleri`) merkezine bağlanmıştır.
3. **Cevap Kümesi Doğrulama:** E-Club içindeki 23 satırlık cevap doğrulama fonksiyonu silinip `@/lib/soru/kontrol` (`cevaplarAtananSorularlaEslesiyorMu`) merkezine bağlanmıştır.

### 4. Tasfiye Edilen Ölü ve Yetim Kodlar
* 🗑️ `lib/cc/izleme/bitir.ts` (Silindi — `cc_izleme_tamamla` RPC'si ile değiştirildi)
* 🗑️ `lib/cc/soru/cevapIsle.ts` (Silindi — `cc_cevaplari_kaydet` RPC'si ile değiştirildi)
* 🗑️ `lib/cc/puan/netHesap.ts` (Silindi — `get_cc_ligi_*` RPC ve view ile değiştirildi)
* 🗑️ `lib/cc/izleme/extraKontrol.ts` içindeki `extraPuanHakEdildiMi` (Silindi — RPC içi sayaç ile değiştirildi)
* 🗑️ `lib/eczanem/kazanim.ts` (Silindi — `eczanem_izleme_tamamla` & `eczanem_cevaplari_kaydet` RPC'leri ile değiştirildi)
* 🗑️ `lib/utils/randomSoruSec.ts` (Silindi — Güvensiz eski soru seçici; `lib/soru/secim` ile değiştirildi)

### 5. Güncel Doğrulama Kaydı
*Kontrol tarihi: 3 Eylül 2026*

* **TypeScript Derleme Denetimi (`npm run typecheck:build`):** ✅ **BAŞARILI (Exit code 0)**.
* **Bütünsel Duman Testleri (`npm run test:smoke`):** ✅ **244 / 244 TEST BAŞARILI (%100 PASS)**.
* **Mimari Lint Kural Denetimi (`npm run lint:mimari`):** ✅ **MİMARİ KURAL İHLALİ YOK**.

---

# 7. BÖLÜM: ADMİN MODÜLÜ, SAHNE ARKASI TEMİZLİĞİ VE VERİTABANI ŞEMA KAYDI
*İlk kayıt: 25 Ağustos 2026 | Güncelleme: 3 Eylül 2026 | Kapsam: Admin M2 Kabuğu, 31 API Rotası, Yönetim Kuralları, Sahne Arkası Orphan Tasfiyesi ve Veritabanı Şema Anlık Görüntüsü*

### 1. Admin Yönetim Mimarisi (`app/admin/`)
* **M2 Orkestrasyon Kabuğu:** `app/admin/page.tsx` şişkinlikten arındırılmış; iş mantığı `_hooks/` (`useAdminPanel`, `useTekilForm`, `useTopluForm`, `useTakimBolgeForm`, `useUrunTeknik`, `useKullaniciListesi`), görsel parçalar `_components/` altında modülerleştirilmiştir.
* **Global Yönetim Panelleri:** HBStore (`app/admin/_components/global/HbStorePaneli.tsx`), E-Club Store (`app/admin/_components/global/EclubStorePaneli.tsx`) ve Üretim Atama (`app/admin/_components/global/UretimAtamaPaneli.tsx`) merkezi admin çatısına entegre edilmiştir. E-Club Yönetim paneli kendi modül sınırı içindeki `app/admin/eclub/_components/EclubYonetimPaneli.tsx` konumundadır.

### 2. Admin API Güvenlik ve Hata Kaydı
Toplam 31 admin API rotası bulunmaktadır. Açık giriş rotası (`/admin/api/giris`) dışındaki 30 operasyonel rotanın kaynak taramasında kimlik veya rol yetki denetimi ile merkezi hata işleme standartları doğrulanmıştır:
* **Firma & Organizasyon:** `/admin/api/firmalar` (ve takımlar, bölgeler, kullanıcılar, ürünler, teknikler, export, toplu-yükle alt rotaları).
* **Sistem & Operasyon:** `/admin/api/sistem-ayarlari`, `/admin/api/mesai-bypass`, `/admin/api/veri-sil`, `/admin/api/uretim/atamalar`, `/admin/api/uretim/gorev-devret`.
* **E-Club Yönetimi:** `/admin/api/eclub/*` altında 4 rota.
* **Mağaza & E-Club Store:** `/admin/store/api/*` (5 rota) ve `/admin/eclub-store/api/*` (5 rota).

### 3. Firma, Kullanıcı ve Organizasyon Yönetim Kuralları
Firma kaydı aktif veya pasif durumda yönetilir; pasif firmaya bağlı kullanıcıların girişi engellenir ve firmaya açık platform modülleri ayrı ayrı belirlenebilir. Bir firmanın silinmesinden önce verilerinin dışa aktarılması gerekir; takımı bulunan firma doğrudan silinemez.

Takım, bölge veya telefon bilgisi eksik olan kullanıcı pasif durumda tutulur ve admin ekranında görünmeye devam eder. Eksik bilgileri tamamlanan kullanıcı etkinleştirilebilir. Eksik bilgili kullanıcısı bulunan firmanın etkinleştirilmesi engellenir.

Toplu kullanıcı yükleme işlemi insan tarafından okunabilir rol ve organizasyon adlarını kabul eder ve ekleme veya güncelleme işlemi olarak çalışır. Mevcut kullanıcının parolası değiştirilmez; dosyada bulunmayan takım veya bölge bilgisi gereksiz yere ezilmez. Organizasyon yapısı yüklenen dosyadan kurulabilir, takımsız bölge oluşturulmaz; hiyerarşi tekilliği ve toplu işlem paket bütünlüğü korunur.

### 4. Sahne Arkası (Backstage) ve Orphan Dosya Tasfiyesi
* **Atıl Kodlar & Bileşenler Silindi:** `useStoreAdminPanel.ts`, `useEclubStoreAdminPanel.ts`, `TalepTuruTablari.tsx`, `accordion.tsx`, `separator.tsx`, `SectionTitle.tsx`, `StatCard.tsx`, `StatGrid.tsx`, `agregasyon.ts`, `ligSira.ts`.
* **Atıl Doküman ve Dökümler Silindi:** `talep-dosyalari.txt` (106 KB), `RAPOR-METRIKLERI.md` (13 KB), 6 eski iş planı ve `public/` altındaki 5 starter SVG.

### 5. Veritabanı Tasfiye Geçmişi ve Şema Kaydı
* 25 Ağustos 2026 tarihli tasfiye çalışmasında Supabase canlı veritabanından 9 adet Kuşak-1 eski rapor view'ı (`v_rapor_bolge`, `v_rapor_sirket`, `v_rapor_takim`, `v_rapor_utt`, `v_rapor_urun_izlenme`, `v_izleme_ozet`, `v_senaryo_son_durum`, `v_soru_seti_son_durum`, `v_video_son_durum`) ve atıl `egitimler` tablosu kaldırılmıştır.
* `scripts/denetim/sema.json`, canlı veritabanı doğrulaması değil, **31 Ağustos 2026 tarihli depo şema anlık görüntüsüdür**. Bu kayıtta **111 tablo** ve **155 RPC** bulunmaktadır.

### 6. Güncel Doğrulama Kaydı
*Kontrol tarihi: 3 Eylül 2026*

* **TypeScript:** ✅ `npm run typecheck:build` $\rightarrow$ **BAŞARILI (Exit code 0)**.
* **Duman Testleri:** ✅ `npm run test:smoke` $\rightarrow$ **244 / 244 TEST BAŞARILI (%100 PASS)**.
* **Mimari ESLint:** ✅ `npm run lint:mimari` $\rightarrow$ **MİMARİ KURAL İHLALİ YOK**.

---

# 8. BÖLÜM: ROL, GÖREV, BİLDİRİM VE HAPBI ETKİLEŞİM MİMARİSİ
*İlk kayıt: 25 Ağustos 2026 | Güncelleme: 6 Eylül 2026 | Kapsam: Platform Rolleri, Görev Devirleri, Ortak Bildirim Sözleşmesi, Çift Şapkalı Saha Yönetim Protokolleri ve Deterministik AI Asistanı*

### 1. Ortak Bildirim Mimarisi ve Dil Sözleşmesi
* **Ortak Bileşen:** `components/HataMesaji.tsx`, platformdaki `hata`, `basari`, `uyari` ve `bilgi` bildirimlerinin ortak görsel ve davranış sözleşmesidir. `useHataMesaji` kullanan her yüzey kendi mesaj state'ini yönetir; bileşen ortaktır, uygulama genelinde tek bir global toast state'i bulunmaz.
* **Yerleşim ve Süre:** `HataMesajiContainer` bildirimleri sağ üstte `top:24`, `right:24`, en fazla 380 piksel genişlik ve `zIndex:9999` ile gösterir. Varsayılan görünme süresi 12 saniyedir; kaybolmaması gereken uyarılar kullanıcı kapatana kadar kalıcı olabilir.
* **Kurumsal Dil:** Kullanıcıya dönük metinlerde kurumsal “siz” dili kullanılır. Teknik rol kodları, altyapı sağlayıcılarının adları ve iç sistem ayrıntıları kullanıcı mesajlarına taşınmaz; hata, yapılan işlem ve kullanıcının atabileceği sonraki adım açık dille anlatılır.
* **Üretim Devir Bildirimi:** `lib/uretim/toastMesaj.ts`, üretim hattındaki işlem bildirimlerinin ortak sözlüğüdür. Bir aşamayı kapatan mesaj, tamamlanan işi ve sıradaki işin sahibini birlikte bildirir. Sıradaki işlem aynı kullanıcıdaysa ilgili yönetim ekranına yönlendirir; revizyon mesajı revizyon talebinin kime iletildiğini belirtir.
* **Öğrenme Aracı Adı:** Kullanıcıya gösterilen varyant, aşama, durum ve bildirim metinleri seçilen aracın gerçek adını kullanır: **Video**, **Podcast**, **Dijital Broşür** veya **Literatür**. `video` ve `hazir_video` gibi tarihsel teknik anahtarlar yalnız geriye dönük uyumluluk içindir.

### 2. Üretici Rolleri ve Görev Devir Matrisi

| Rol grubu | Yetki ve kapsam | Üretim görevi |
|---|---|---|
| **Ürün ailesi** (`pm`, `jr_pm`, `kd_pm`) | Takım kapsamında ürün eğitimi oluşturur; ürün zorunlu, teknik tercihlidir. Eczanem hedefli ürün talebi açabilen tek üretici ailesidir. | Dört üretim varyantında talep açar, teslimleri inceler, onay veya revizyon kararı verir ve yayını yönetir. |
| **Medikal** (`med_md`) | Firma kapsamında medikal eğitim ve ürün medikal eğitimi oluşturur. | Kendi talebine bağlı senaryo, öğrenme aracı ve soru setini inceler. |
| **Eğitim** (`egt_md`, `egt_yrd_md`, `egt_yon`, `egt_uz`) | Firma kapsamında satış teknikleri ve yönetim eğitimi oluşturur; satış tekniklerinde teknik seçimi zorunludur. | Kendi yetenek profiline uygun talep ve inceleme akışını yürütür. |
| **İnsan Kaynakları** (`ik_drk`, `ik_md`, `ik_yrd_md`, `ik_uz`, `ik_per`) | Firma kapsamında İK ve yönetim eğitimi oluşturur. | Kendi yetenek profiline uygun talep ve inceleme akışını yürütür. |
| **İçerik Üreticisi** (`iu`) | Firmalardan bağımsız ortak içerik fabrikasında yalnız kendisine atanmış işleri görür. | Senaryo, seçilen öğrenme aracı ve soru seti görevlerini üretir, teslim eder ve istenen revizyonları tamamlar. |

| Olay | Kapanan iş | Yeni iş ve sorumlusu |
|---|---|---|
| **V1 — Tam Üretim talebi** | Talep oluşturuldu. | Senaryo üretimi İçerik Üreticisindedir. |
| **V2 — Hazır Öğrenme Aracı talebi** | Hazır araç doğrulandı ve talep oluşturuldu. | Soru seti üretimi İçerik Üreticisindedir. |
| **V3 — Hazır Soru Seti talebi** | Hazır soru seti doğrulandı ve talep oluşturuldu. | Senaryo üretimi İçerik Üreticisindedir. |
| **V4 — Hazır Araç ve Hazır Soru Seti talebi** | Hazır bileşenler doğrulandı ve talep oluşturuldu. | Yayın yönetimi talep sahibindedir; İÜ görevi açılmaz. |
| **Senaryo teslimi** | İÜ senaryo görevini tamamladı. | İnceleme talep sahibindedir. |
| **Senaryo onayı** | Senaryo incelemesi tamamlandı. | Seçilen öğrenme aracının üretimi İçerik Üreticisindedir. |
| **Öğrenme aracı teslimi** | İÜ araç üretimini tamamladı. | İnceleme talep sahibindedir. |
| **Öğrenme aracı onayı** | Araç incelemesi tamamlandı. | Hazır soru seti yoksa soru seti İÜ'dedir; varsa yayın yönetimi talep sahibindedir. |
| **Soru seti teslimi** | İÜ soru setini tamamladı. | İnceleme talep sahibindedir. |
| **Soru seti onayı** | Üretim zinciri tamamlandı. | Yayın yönetimi talep sahibindedir. |
| **Revizyon talebi** | İnceleme kararı kaydedildi. | İlgili aşamanın revizyonu İçerik Üreticisindedir. |

Bildirimler seçilen öğrenme aracının adını ve talebi açan kullanıcının gerçek unvanını kullanır. Form doğrulamaları hedef rol, ürün, teknik, içerik adı, hazır dosya ve soru seti gerekliliklerini ilgili üretici yeteneğine ve varyanta göre bildirir.

### 3. Saha, Yönlendirme, Yönetim ve Admin Rolleri

| Rol grubu | Temel görev ve kapsam | Başlıca işlem bildirimi |
|---|---|---|
| **UTT / KD_UTT** (`utt`, `kd_utt`) | Dört öğrenme aracını T-Club'da tüketir; soru ve puan akışını yürütür, eczane portföyünü yönetir, E-Club önerisi ve Eczanem eczane dağıtımı yapar, yetkisi açıksa HBStore kullanır. | Puan zamanı, tamamlama, cevap, öneri, eczaneye gönderim, üye eşiği, sipariş ve bakiye sonucu. |
| **Bölge Müdürü** (`bm`) | Bölgesindeki UTT/KD_UTT kullanıcılarını ve raporları izler, T-Club önerisi oluşturur, C-Club'da uygun BM'lere challenge gönderir ve yetkisi açıksa HBStore kullanır. | Öneri, challenge, bekleyen challenge, rapor, lig ve sipariş sonucu. |
| **Takım Müdürü** (`tm`) | Takımındaki BM ve UTT sonuçlarını, öneri akışını, raporları ve yetkili sipariş görünümünü izler; öneri veya mağaza siparişi oluşturmaz. | Rapor, öneri takibi, takım ligi ve bölge sıralaması. |
| **Yöneticiler** (`gm`, `gm_yrd`, `drk`, `paz_md`, `blm_md`, `grp_pm`, `sm`) | Firma kapsamındaki üretim, T-Club, C-Club, E-Club, Eczanem ve sipariş raporlarını rol yetkisine göre izler; rapor erişimi işlem oluşturma yetkisi doğurmaz. | Firma raporu, üretim portföyü ve kapsamındaki operasyon kayıtlarının yükleme sonucu. |
| **Admin** (`admin`) | Firma, kullanıcı, organizasyon, modül, sistem ayarı, Store ve üretim atamalarını merkezi yönetim kapsamıyla yürütür. | Doğrulama, oluşturma, güncelleme, dışa aktarma ve yönetim işlemlerinin sonucu. |

T-Club ve C-Club'da soru hakkı izleme kimliğine bağlıdır. Öğrenme tamamlandıktan sonra cevaplanmamış soru akışının terk edilmesi önceki soru hakkını kapatır. Video ileri sarma davranışı sabit bir “tüm puanı iptal etme” kuralı değildir; puanlı zamanda atlanan sürenin araç puanındaki oransal karşılığı kayıp olarak uygulanır. Araç türüne özgü ilerleme ve tamamlama kuralları Bölüm 1–3'teki kulüp sözleşmeleriyle birlikte değerlendirilir.

### 4. E-Club ve Eczanem Rolleri

| Rol grubu | Temel görev ve kapsam | Başlıca işlem bildirimi |
|---|---|---|
| **E-Club eczacı unvanları** (`eczaci`, `ikinci_eczaci`, `yardimci_eczaci`) | Eczane ilişkisi kapsamında öğrenme araçlarını tüketir, soru ve puan akışına katılır, E-Club Store'u kullanır; yetkili olduğu eczanede Eczanem üyelik, dağıtım ve işlem kararlarını yürütür. | Eğitim, tamamlama, sipariş, Eczanem uygulaması üyesi bağlama, içerik dağıtma ve işlem kararı sonucu. |
| **Eczane teknisyeni** (`eczane_teknisyeni`) | Kendi unvanıyla E-Club'a katılır; yetkili eczane ilişkisi kapsamında öğrenme, Store ve Eczanem operasyonlarını yürütür. | Eczacı unvanlarıyla aynı işlem ailesindeki, kendi yetkisine uygun sonuçlar. |
| **Eczanem uygulaması üyesi** (tarihsel teknik rol: `musteri`) | Bağlı olduğu eczaneden gelen dört öğrenme aracını kullanır, uygun puanları kazanır ve eczaneye işlem talebi iletebilir. Üye, eczanenin müşterisi veya müşteri adayı olabilir; bu sıfatı HapBilgi belirlemez. | İçerik tamamlama, soru, puan, talep oluşturma veya vazgeçme sonucu. |

UTT/KD_UTT'nin Eczanem hedefli öğrenme içeriğini eczaneye göndermesi ile yetkili eczane personelinin bu içeriği Eczanem uygulaması üyelerine dağıtması iki ayrı aşamadır. HapBilgi, eczane ile Eczanem uygulaması üyesi arasındaki ticari ilişkinin tarafı değildir; platform yetkili kullanıcıların girdiği bilgileri, dağıtım kararlarını ve işlem durumlarını kaydeder ve uygular.

HBStore ve E-Club Store işlemlerinde bildirim, siparişin alınması veya iptali ile stok, adres ve harcanabilir bakiye doğrulamalarının sonucunu açıklar. Bildirimde sistemde bulunmayan “mağaza yöneticisi” gibi bir rol oluşturulmaz; sonraki durum işlem akışı veya gerçek yetkili rol üzerinden ifade edilir.


### 5. bi — Platform İçi Yardım Asistanı

**Güncel geliştirme — 9 Eylül 2026:** bi iki soru ailesini kullanır. NEDİR onaylı sabit tanımları verir. KAÇ sorularında Gemini yalnız ölçüt, takvim aralığı, karşılaştırma ve varsa TM hedefini çıkarır; puan hesabını sunucu mevcut veri kaynaklarından yapar. AI yorumlama veya konuşmadan öğrenme bulunmaz.

UTT/KD_UTT için beş kazanım, üç kayıp ve üç toplam olmak üzere 11 puan türü; BM'nin kişisel C-Club öğrenmesi için beş kazanım, iki kayıp ve üç toplam olmak üzere 10 puan türü desteklenir. UTT toplam kazanımına E-Club öneri tamamlama kazanımı da katılır. “Puan” veya “toplam puan” toplam net puandır.

TM'nin NEDİR kataloğu UTT ve BM tanımlarının birleşimidir. KAÇ kapsamı kendi takımındaki UTT → bölge → takım zinciridir: bölge puanı bağlı aktif UTT/KD_UTT puanlarının, takım puanı bu bölgelerin UTT puanlarının toplamıdır. BM'nin kişisel C-Club puanı bu toplama katılmaz; tek BM veya takımdaki BM'lerin kişisel puan toplamı olarak ayrıca sorgulanır. Kişi ve bölge adları sunucuda oturumdaki TM'nin firma ve takım sınırında çözülür. Aynı adla birden fazla kayıt varsa tam ad istenir; eşleşmeyen hedefte puan üretilmez.

Hafta, ay, dönem ve yıl Türkiye takvimiyle hesaplanır. İçinde bulunulan dönem çeyrek başından dünün sonuna; mevcut hafta, ay ve yıl aralıkları başlangıçtan sorgu anına kadardır. Önceki aralıklar tam takvim aralığıdır. Ardışık aynı tür iki aralık karşılaştırılabilir. Başarılı sorgunun ölçüt, zaman ve TM hedefi sohbet bağlamında korunur; istemciden gelen bağlam her istekte doğrulanır ve yetki kaynağı sayılmaz.

Gerçek sıfır gösterilir; kaynak hatası, kayıt yokluğu ve eksik sayısal değer sıfır kabul edilmez. TM toplamları mevcut UTT ve BM puan okuyucularını kullanır; üyeler sayfalanarak okunur. Büyük takımlarda kişi başına veri okuması nedeniyle yanıt süresi artabilir.

`HapbiProvider.tsx` mesajları, sorgu bağlamını ve iptali; `HapbiChatModal.tsx` soru-cevap görünümünü yönetir. Erişim `lib/bi/erisim.ts` ve her istekte sunucu kimlik doğrulamasıyla korunur.

**TM doğrulaması:** Yerel hesap, kapsam, hedef çözümleme ve API karşılaştırma testleri başarılıdır. Kredi sorunu giderildikten sonra dört örnek soru ve dört takip sorusu gerçek Gemini bağlantısıyla doğru çözümlenmiştir; bu kontrol ekran doğrulaması değildir.

**İK üretici başlangıcı — 9 Eylül 2026:** Beş İK rolünde kendi İK eğitimi/bilgilendirme ve yönetim eğitimi talepleri ile yayınları sorgulanır. Talep, inceleme, revizyon, planlanan yayın ve dört üretim biçimi için NEDİR tanımları eklenmiştir. Ortak üretici sorgu sözleşmesi sonraki rol ailelerine genişletilebilir; bu aşamada yalnız İK ailesine açıktır.

KAÇ ölçütleri: toplam talep, zaman aralığında açılan talep, üretimdeki talep, onay bekleyen talep, revizyondaki talep, yayına alınmayı bekleyen araç, yayındaki araç, planlanan yayın, durdurulan yayın ve zaman aralığında ilk kez yayımlanan araç. Eğitim türü ve dört öğrenme aracı türüyle filtrelenebilir. Her kayıt oturumdaki üreticinin kimliği ve firmasıyla sınırlandırılır; firma portföyü veya başka üreticinin işleri dahil edilmez.

Mevcut durum sorularında tarih istenmez; durumlar geçmişe dönük tahmin edilmez. Olay sayıları hafta/ay/dönem/yıl aralığıyla ve önceki eş aralıkla karşılaştırılabilir. Açılan talepler `talepler.created_at`, ilk yayınlar `yayin_tekrar_kayitlari` içindeki Tur-1 başlangıcıyla sayılır. Plan oluşturma tarihi ve yeniden açılış, ilk yayın yerine kullanılmaz. Üretim durumu mevcut görev kaydı ve ortak üretim zinciriyle çözülür; bir talep tek sayılır.

**Eğitim üretici genişlemesi — 10 Eylül 2026:** `egt_md`, `egt_yrd_md`, `egt_yon`, `egt_uz` ortak üretici NEDİR/KAÇ ve yönlendirme hattını kullanır. Talep türleri yetenek kaynağından `satis_teknikleri` ve `yonetim_egitimi` olarak alınır. Satış teknikleri tanımı teknik seçiminin zorunlu, ürünün isteğe bağlı olduğunu açıklar. İK tanımı eğitim kataloğuna eklenmez. On sayım, zaman aralıkları, takip ve karşılaştırma aynı okuyucuyu kullanır; yalnız oturumdaki üreticinin talepleri/yayınları sayılır. Ürün veya tek teknik bazında daraltılmış sorgular ilgili rapora yönlendirilir.

**İK doğrulaması:** 29 seçili bi testi, tip kontrolü ve lint başarılıdır. Gerçek Gemini ile 12 soru ve 3 takip doğru çözümlenmiş; bir aktif İK test hesabında 10 sayım salt okunur veritabanı sorgularıyla çalıştırılmıştır. Ekran testi ayrıca yapılır.

**Hazır yanıt paketi ve yönlendirme — 9 Eylül 2026:** Hazır NEDİR/KAÇ yanıtının yetmediği platform sorularında mevcut Gemini çağrısı ayrıca konu seçer; ikinci AI çağrısı yapılmaz. `lib/bi/yonlendirme.ts` bağlantıları rol ve konuya göre sabit listeden seçer. C-Club/E-Club için firma modül durumu doğrulanır. BM kişisel C-Club ve bölgesinin UTT performansı ayrıdır. Üretici kişisel raporu, firma üretim raporu ve saha raporu ayrıdır; talep/yayın işlerine doğrudan ilgili sayfa önerilir. Öneriler sohbet içinde tıklanabilir bağlantılardır, okunmuş veri kaynağı olarak sunulmaz. Platform dışı soruda kullanıcının onayladığı esprili metin aynen gösterilir; ilgisiz rapor eklenmez. Hazır puan yanıtları ve deterministik hesaplar korunur. Bağlantı hatasında konu bilinmediğinden rolün genel raporları önerilir. Gerçek Gemini ile altı saha/İK örneği yönlendirme bakımından doğrulandı.


---

# 9. BÖLÜM: BÜTÜNSEL DOSYA VE DİZİN ENVANTERİ (CANONICAL FILE MANIFEST)
*Güncelleme: 6 Eylül 2026 | Kapsam: Projenin çalıştırılabilir kaynakları, yapılandırmaları, testleri, altyapısı, görselleri ve kurumsal belgeleri*

Bu envanter; bağımlılıkları (`node_modules`), derleme ve önbellek çıktılarını (`.next`, `coverage`, `tsconfig.tsbuildinfo`), işletim sistemi artıklarını ve kullanıcıya özel yerel araç ayarlarını kapsamaz. `.env.local` yalnız dosya adı ve işleviyle kaydedilir; gizli içeriği BLUEBOOK'a alınmaz.

## 1. KÖK DİZİN (ROOT & CONFIG)

### 📁 / (Kök Dizin)

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `.env.local` | Yapılandırma | Yerel çalışma ortamının gizli servis adresleri ve anahtarlarını taşır; içeriği sürüm kontrolüne veya dokümana alınmaz. |
| `.gitignore` | Yapılandırma | Sürüm kontrolüne alınmayacak bağımlılık, derleme, ortam ve yerel çalışma çıktılarını tanımlar. |
| `.vercelignore` | Yapılandırma | Vercel dağıtım paketine gönderilmeyecek medya, doküman, denetim ve yerel geliştirme varlıklarını sınırlar. |
| `AGENTS.md` | Dokümantasyon | Bu depoda çalışan yapay zekâ ajanlarının Next.js dokümantasyonu ve KVKK takip süreci dâhil zorunlu çalışma kurallarını tanımlar. |
| `CLAUDE.md` | Dokümantasyon | Claude tabanlı geliştirme araçları için projeye özgü çalışma bağlamı ve yönlendirmeleri taşır. |
| `components.json` | JSON / Yapılandırma | shadcn/ui bileşen üretimi için stil, alias ve dosya konumu tercihlerini tanımlar. |
| `eslint.config.mjs` | Yapılandırma | Next.js ve TypeScript lint ayarlarıyla HapBilgi’ye özgü mimari bağımlılık kurallarını etkinleştirir. |
| `next-env.d.ts` | TypeScript / Lib | Next.js tarafından üretilen TypeScript ortam ve tip başvurularını projeye tanıtır; elle düzenlenmez. |
| `next.config.ts` | TypeScript / Lib | React Compiler ayarını ve üretim derlemesindeki tip kontrolü davranışını yapılandırır. |
| `package-lock.json` | Bağımlılık Kilidi | NPM bağımlılık ağının kesin sürümlerini ve bütünlük özetlerini kilitler. |
| `package.json` | JSON / Yapılandırma | Uygulamanın bağımlılıklarını ve geliştirme, test, tip kontrolü, derleme ile denetim komutlarını tanımlar. |
| `postcss.config.mjs` | Yapılandırma | Tailwind CSS dönüşümünü Next.js derleme hattına bağlayan PostCSS yapılandırmasıdır. |
| `proxy.ts` | TypeScript / Lib | İstekleri kimlik, rol ve firma modül bayraklarına göre koruyan merkezi Next.js proxy katmanıdır; admin, kulüp, Store ve Eczanem rotalarının erişim kapılarını uygular. |
| `README.md` | Dokümantasyon | Projenin geliştirme ortamını başlatma ve temel Next.js komutlarını açıklayan başlangıç belgesidir. |
| `tsconfig.build.json` | JSON / Yapılandırma | Üretim kaynaklarını testlerden ayırarak bağımsız ve artımsız tip kontrolüne tabi tutar. |
| `tsconfig.json` | JSON / Yapılandırma | Projenin strict TypeScript, modül çözümleme ve yol alias kurallarını tanımlar. |

## 2. APP ORTAK ROTALAR, SAĞLAYICILAR VE SERVİS UÇLARI

### 📁 app/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `favicon.ico` | Görsel / İkon | Tarayıcı sekmesinde kullanılan HapBilgi site simgesidir. |
| `globals.css` | Stil / CSS | Tailwind CSS katmanlarını, ortak tema değişkenlerini ve uygulama genelindeki temel stilleri tanımlar. |
| `layout.tsx` | UI / React | Uygulamanın kök HTML iskeletini, global stilleri ve kimlik sağlayıcısını kuran Next.js yerleşimidir. |
| `page.tsx` | UI / React | Kök isteği giriş ekranına yönlendiren başlangıç sayfasıdır. |

### 📁 app/api/bunny/webhook/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | Medya sağlayıcısından gelen video işleme bildirimini imzayla doğrular; video ve ortak öğrenme aracı durumlarını eşzamanlı günceller. |

### 📁 app/api/hapbi/sor/

| Dosya Adı | Türü | İşlevi |
|---|:---:|---|
| `route.ts` | API / TypeScript | Oturum ve kapsam kontrolünden sonra rehber veya deterministik sayısal yanıt döndürür. |

### 📁 app/api/ogrenme-araclari/[arac_id]/destek-yukleme-baslat/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/api/ogrenme-araclari/[arac_id]/destek-yukleme-baslat` uç noktasında POST isteklerini işler; HapBilgi için öğrenme araçları destek yükleme başlatma sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/api/ogrenme-araclari/[arac_id]/destek-yukleme-tamamla/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/api/ogrenme-araclari/[arac_id]/destek-yukleme-tamamla` uç noktasında POST isteklerini işler; HapBilgi için öğrenme araçları destek yükleme tamamlama sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/api/ogrenme-araclari/[arac_id]/durum/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/api/ogrenme-araclari/[arac_id]/durum` uç noktasında GET isteklerini işler; HapBilgi için öğrenme araçları durum sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/api/ogrenme-araclari/[arac_id]/erisim/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/api/ogrenme-araclari/[arac_id]/erisim` uç noktasında GET isteklerini işler; HapBilgi için öğrenme araçları erişim sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/api/ogrenme-araclari/[arac_id]/flip-pdf-dogrula/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/api/ogrenme-araclari/[arac_id]/flip-pdf-dogrula` uç noktasında POST isteklerini işler; HapBilgi için öğrenme araçları flip pdf doğrulama sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/api/ogrenme-araclari/[arac_id]/gorsel-dogrula/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/api/ogrenme-araclari/[arac_id]/gorsel-dogrula` uç noktasında POST isteklerini işler; HapBilgi için öğrenme araçları Dijital Broşür doğrulama sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/api/ogrenme-araclari/[arac_id]/podcast-dogrula/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/api/ogrenme-araclari/[arac_id]/podcast-dogrula` uç noktasında POST isteklerini işler; HapBilgi için öğrenme araçları Podcast doğrulama sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/api/ogrenme-araclari/bayraklar/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/api/ogrenme-araclari/bayraklar` uç noktasında GET isteklerini işler; HapBilgi için öğrenme araçları bayraklar sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/api/ogrenme-araclari/flip-pdf-ilerleme/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/api/ogrenme-araclari/flip-pdf-ilerleme` uç noktasında POST isteklerini işler; HapBilgi için öğrenme araçları flip pdf ilerleme sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/api/ogrenme-araclari/gorsel-tamamla/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/api/ogrenme-araclari/gorsel-tamamla` uç noktasında POST isteklerini işler; HapBilgi için öğrenme araçları Dijital Broşür tamamlama sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/api/ogrenme-araclari/podcast-ilerleme/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/api/ogrenme-araclari/podcast-ilerleme` uç noktasında POST isteklerini işler; HapBilgi için öğrenme araçları Podcast ilerleme sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/api/ogrenme-araclari/yarim-yuklemeler/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/api/ogrenme-araclari/yarim-yuklemeler` uç noktasında GET, DELETE, POST isteklerini işler; HapBilgi için öğrenme araçları yarım yüklemeler sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/api/ogrenme-araclari/yukleme-baslat/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/api/ogrenme-araclari/yukleme-baslat` uç noktasında POST isteklerini işler; HapBilgi için öğrenme araçları yükleme başlatma sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/api/ogrenme-araclari/yukleme-local/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/api/ogrenme-araclari/yukleme-local` uç noktasında PUT isteklerini işler; HapBilgi için öğrenme araçları yükleme yerel sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/api/ogrenme-araclari/yukleme-tamamla/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/api/ogrenme-araclari/yukleme-tamamla` uç noktasında POST isteklerini işler; HapBilgi için öğrenme araçları yükleme tamamlama sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/api/push/abonelik/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/api/push/abonelik` uç noktasında POST, DELETE isteklerini işler; Web Push bildirimleri için Web Push abonelik sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/api/uretim/hazir-video-mutabakat/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/api/uretim/hazir-video-mutabakat` uç noktasında POST isteklerini işler; üretim için üretim hazır video mutabakat sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/bildirimler/api/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/bildirimler/api` uç noktasında GET, PUT isteklerini işler; bildirim için bildirimler sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/login/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | Kullanıcıların e-posta ve şifre ile sisteme giriş yaptığı, hata durumlarını yöneten kimlik doğrulama arayüzü. |

### 📁 app/login/_components/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `GirisAltBilgileri.tsx` | UI / React | Giriş formunun altında kullanım koşulları, KVKK ve çerez metinlerini modal olarak açar; şirket bağlantısı ile iletişim adresini gösterir. |
| `yasalMetinler.ts` | TypeScript / Lib | Login sayfasında gösterilen Platform Kullanım Koşulları, KVKK Aydınlatma Metni ve Çerez Aydınlatma Metni içeriklerinin kanonik veri kaynağıdır. |

### 📁 app/providers/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `AuthProvider.tsx` | UI / React | Kullanıcının Supabase oturumunu, yetkili kimliğini (v_auth_kimlik_admin) ve rolünü tüm arayüze dağıtan React Context sağlayıcısı. |
| `PushAbonelik.tsx` | UI / React | Oturum açan kullanıcı için tarayıcı bildirim desteğini ve izin tercihini yönetir; abonelik kaydını sunucu API'siyle eşleştirir. |

### 📁 app/sifre-yenile/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | Kullanıcıların güvenli e-posta bağlantısıyla şifrelerini sıfırladığı ve yeni şifre belirlediği arayüz. |

### 📁 app/takimlar/api/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/takimlar/api` uç noktasında GET isteklerini işler; HapBilgi için takimlar sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/teknikler/api/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/teknikler/api` uç noktasında GET, POST isteklerini işler; HapBilgi için teknikler sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/urunler/api/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/urunler/api` uç noktasında GET, POST isteklerini işler; HapBilgi için ürünler sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

## 3. APP PANEL MODÜLLERİ (B2B SAHA & YÖNETİM)

### 📁 app/(panel)/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `layout.tsx` | UI / React | HapBilgi alt rotalarının ortak yerleşimini, sağlayıcılarını ve gezinme kabuğunu kuran Next.js layout bileşenidir. |

### 📁 app/(panel)/ana-sayfa/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | Kullanıcının rolüne göre (Üretici, UTT, BM, TM, Yönetici) özelleşmiş karşılama ve operasyonel hızlı eylem paneli. |

### 📁 app/(panel)/ana-sayfa/api/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/ana-sayfa/api` uç noktasında GET isteklerini işler; HapBilgi için ana sayfa sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/cc-ligi/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | Bölge Müdürlerinin Challenge Club kapsamında topladıkları meydan okuma puanlarıyla yarıştığı yönetici ligi sayfası. |

### 📁 app/(panel)/cc-ligi/api/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/cc-ligi/api` uç noktasında GET isteklerini işler; C-Club için cc ligi sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/challenge-club/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | Bölge Müdürleri arasındaki meydan okuma yarışmasının, gelen ve giden davetlerin yönetildiği ana C-Club sayfası. |

### 📁 app/(panel)/challenge-club/api/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/challenge-club/api` uç noktasında GET, POST isteklerini işler; C-Club için challenge club sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/challenge-club/api/uygun-aliciler/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/challenge-club/api/uygun-aliciler` uç noktasında GET isteklerini işler; C-Club için challenge club uygun aliciler sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/challenge-club/api/uygun-videolar/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/challenge-club/api/uygun-videolar` uç noktasında GET isteklerini işler; C-Club için challenge club uygun videolar sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/challenge-club/izle/[yayin_id]/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | `/challenge-club/izle/[yayin_id]` rotasında C-Club kapsamındaki [yayin id] arayüzünü sunan Next.js sayfa bileşenidir. |

### 📁 app/(panel)/challenge-club/izle/api/baslat/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/challenge-club/izle/api/baslat` uç noktasında POST isteklerini işler; C-Club için izleme başlatma sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/challenge-club/izle/api/bitir/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/challenge-club/izle/api/bitir` uç noktasında PUT isteklerini işler; C-Club için izleme tamamlama sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/challenge-club/izle/api/cevap/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/challenge-club/izle/api/cevap` uç noktasında POST isteklerini işler; C-Club için izleme cevap sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/challenge-club/izle/api/ileri-sarma/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/challenge-club/izle/api/ileri-sarma` uç noktasında POST isteklerini işler; C-Club için izleme ileri sarma sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/challenge-club/izle/api/sorular/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/challenge-club/izle/api/sorular` uç noktasında GET isteklerini işler; C-Club için izleme sorular sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/eclub/eczanelerim/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | UTT'nin takımına özel isim verdiği, GLN ile eczane bağladığı, eczacı ve teknisyen kadrosunu yönettiği E-Club Takımım sayfası. |

### 📁 app/(panel)/eclub/gonderilen-videolar/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | `/eclub/gonderilen-videolar` rotasında E-Club kapsamındaki gonderilen videolar arayüzünü sunan Next.js sayfa bileşenidir. |

### 📁 app/(panel)/eclub/ligi/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `eclub-league.module.css` | Stil / CSS | E-Club görünümünün yerleşim, renk, tipografi ve responsive davranışlarını tanımlayan stil dosyasıdır. |
| `page.tsx` | UI / React | Firma genelindeki tüm UTT takımlarının dönemlik şampiyonluk podyumunu ve puan sıralamasını sunan büyük E-Club Takımlar Ligi sayfası. |

### 📁 app/(panel)/eclub/ligi/api/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/eclub/ligi/api` uç noktasında GET isteklerini işler; E-Club için E-Club ligi sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/eclub/ligi/api/export/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/eclub/ligi/api/export` uç noktasında GET isteklerini işler; E-Club için ligi dışa aktarma sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/eclub/ligi/api/takim-adi/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/eclub/ligi/api/takim-adi` uç noktasında GET, PUT isteklerini işler; E-Club için ligi takım adi sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/eclub/listem/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `_types.ts` | TypeScript / Lib | E-Club alanında kullanılan `Eczane`, `Kisi`, `EclubGecisTalebi`, `GlnKisi` veri tiplerini ve modüller arası sözleşmeleri tanımlar. |
| `page.tsx` | UI / React | `/eclub/listem` rotasında E-Club kapsamındaki listem arayüzünü sunan Next.js sayfa bileşenidir. |

### 📁 app/(panel)/eclub/listem/_components/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `EczaneBlogu.tsx` | UI / React | eczane Blogu, E-Club ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |

### 📁 app/(panel)/eclub/listem/_hooks/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `useEclubListem.ts` | TypeScript / Lib | use E-Club listem hook'u, E-Club ekranlarının veri yükleme, durum ve kullanıcı eylemlerini ortaklaştırır. |

### 📁 app/(panel)/eclub/listem/api/eczaneler/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/eclub/listem/api/eczaneler` uç noktasında GET, POST, PUT isteklerini işler; E-Club için listem eczaneler sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/eclub/listem/api/kisiler/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/eclub/listem/api/kisiler` uç noktasında GET, POST, PUT isteklerini işler; E-Club için listem kişiler sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/eclub/oneriler/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `_types.ts` | TypeScript / Lib | E-Club alanında kullanılan `EclubHedefRol`, `OneriYayin`, `OneriKisi`, `OneriLimitler` veri tiplerini ve modüller arası sözleşmeleri tanımlar. |
| `page.tsx` | UI / React | `/eclub/oneriler` rotasında E-Club kapsamındaki öneriler arayüzünü sunan Next.js sayfa bileşenidir. |

### 📁 app/(panel)/eclub/oneriler/_hooks/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `useEclubOneriler.ts` | TypeScript / Lib | use E-Club öneriler hook'u, E-Club ekranlarının veri yükleme, durum ve kullanıcı eylemlerini ortaklaştırır. |

### 📁 app/(panel)/eclub/oneriler/api/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/eclub/oneriler/api` uç noktasında GET, POST isteklerini işler; E-Club için E-Club öneriler sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/eclub/oneriler/api/yayinlar/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/eclub/oneriler/api/yayinlar` uç noktasında GET isteklerini işler; E-Club için öneriler yayınlar sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/eclub/panel/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | `/eclub/panel` rotasında E-Club kapsamındaki panel arayüzünü sunan Next.js sayfa bileşenidir. |

### 📁 app/(panel)/eclub/panel/_components/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `EclubFirmaVideoKatalogu.tsx` | UI / React | E-Club firma video Katalogu, E-Club ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `EclubVideoOynatici.tsx` | UI / React | E-Club video Oynatici, ilgili öğrenme aracını gösteren ve E-Club ilerleme/tamamlama akışına bağlayan oynatıcı bileşenidir. |

### 📁 app/(panel)/eclub/panel/_hooks/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `useEclubPanel.ts` | TypeScript / Lib | use E-Club panel hook'u, E-Club ekranlarının veri yükleme, durum ve kullanıcı eylemlerini ortaklaştırır. |

### 📁 app/(panel)/eclub/panel/api/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/eclub/panel/api` uç noktasında GET isteklerini işler; E-Club için E-Club panel sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/eclub/panel/api/baslat/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/eclub/panel/api/baslat` uç noktasında POST isteklerini işler; E-Club için panel başlatma sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/eclub/panel/api/bitir/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/eclub/panel/api/bitir` uç noktasında PUT isteklerini işler; E-Club için panel tamamlama sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/eclub/panel/api/cevapla/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/eclub/panel/api/cevapla` uç noktasında POST isteklerini işler; E-Club için panel cevaplama sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/eclub/panel/api/ileri-sarma/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/eclub/panel/api/ileri-sarma` uç noktasında POST isteklerini işler; E-Club için panel ileri sarma sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/eclub/panel/api/sorular/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/eclub/panel/api/sorular` uç noktasında GET isteklerini işler; E-Club için panel sorular sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/eclub/panel/firma/[firma_id]/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | `/eclub/panel/firma/[firma_id]` rotasında E-Club kapsamındaki [firma id] arayüzünü sunan Next.js sayfa bileşenidir. |

### 📁 app/(panel)/eclub/raporlar/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `eclub-report.module.css` | Stil / CSS | E-Club görünümünün yerleşim, renk, tipografi ve responsive davranışlarını tanımlayan stil dosyasıdır. |
| `page.tsx` | UI / React | UTT'ler ve yöneticiler için E-Club takımındaki eczacı ve teknisyenlerin izleme, doğru cevap ve puan katkı karnesini sunan E-Club Takım Raporlarım sayfası. |

### 📁 app/(panel)/eclub/raporlar/api/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/eclub/raporlar/api` uç noktasında GET isteklerini işler; E-Club için E-Club raporlar sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/eclub/siparisler/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | `/eclub/siparisler` rotasında E-Club kapsamındaki siparişler arayüzünü sunan Next.js sayfa bileşenidir. |

### 📁 app/(panel)/eclub/siparisler/api/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/eclub/siparisler/api` uç noktasında GET isteklerini işler; E-Club için E-Club siparişler sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/eclub/store/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | Eczacı ve teknisyenlerin biriken puanlarıyla ürün siparişi verdiği çok-firmalı E-Club mağazası. |

### 📁 app/(panel)/eclub/store/_hooks/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `useEclubStore.ts` | TypeScript / Lib | use E-Club Store hook'u, E-Club Store ekranlarının veri yükleme, durum ve kullanıcı eylemlerini ortaklaştırır. |

### 📁 app/(panel)/eclub/store/adreslerim/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | `/eclub/store/adreslerim` rotasında E-Club Store kapsamındaki adreslerim arayüzünü sunan Next.js sayfa bileşenidir. |

### 📁 app/(panel)/eclub/store/api/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/eclub/store/api` uç noktasında GET isteklerini işler; E-Club Store için E-Club Store sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/eclub/store/api/adres/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/eclub/store/api/adres` uç noktasında GET, POST, DELETE isteklerini işler; E-Club Store için Store adres sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/eclub/store/api/siparis/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/eclub/store/api/siparis` uç noktasında GET, POST, PATCH isteklerini işler; E-Club Store için Store sipariş sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/eclub/store/rapor/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | `/eclub/store/rapor` rotasında E-Club Store kapsamındaki rapor arayüzünü sunan Next.js sayfa bileşenidir. |

### 📁 app/(panel)/eclub/store/rapor/api/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/eclub/store/rapor/api` uç noktasında HTTP isteklerini işler; E-Club Store için Store rapor sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/eclub/store/siparislerim/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | `/eclub/store/siparislerim` rotasında E-Club Store kapsamındaki siparislerim arayüzünü sunan Next.js sayfa bileşenidir. |

### 📁 app/(panel)/eclub/videolarim/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | `/eclub/videolarim` rotasında E-Club kapsamındaki öğrenme yayınları arayüzünü sunan Next.js sayfa bileşenidir. |

### 📁 app/(panel)/eclub/videolarim/_components/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `VideoGonderimSatiri.tsx` | UI / React | video gönderim Satiri, E-Club listesindeki bir video gönderim kaydını durumu ve izinli eylemleriyle gösterir. |

### 📁 app/(panel)/eczanem/eczane/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | Eczane personelinin Eczanem OTC müşteri programını, video dağıtımlarını ve kasa indirim kuyruğunu yönettiği ana panel. |

### 📁 app/(panel)/eczanem/eczane/_components/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `EczanemDokum.tsx` | UI / React | Eczanem döküm, Eczanem ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `EczanemEczaneArayuz.tsx` | UI / React | Eczanem eczane Arayuz, Eczanem ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `EczanemSiparisKuyrugu.tsx` | UI / React | Eczanem sipariş Kuyrugu, Eczanem ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `EczanemVideoGonderimSatiri.tsx` | UI / React | Eczanem video gönderim Satiri, Eczanem listesindeki bir eczanem video gönderim kaydını durumu ve izinli eylemleriyle gösterir. |

### 📁 app/(panel)/eczanem/eczane/api/dokum/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/eczanem/eczane/api/dokum` uç noktasında GET isteklerini işler; Eczanem için eczane döküm sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/eczanem/eczane/api/gonderim/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/eczanem/eczane/api/gonderim` uç noktasında GET, POST isteklerini işler; Eczanem için eczane gönderim sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/eczanem/eczane/api/musteri-ekle/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/eczanem/eczane/api/musteri-ekle` uç noktasında POST isteklerini işler; Eczanem için eczane üye ekle sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/eczanem/eczane/api/musteriler/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/eczanem/eczane/api/musteriler` uç noktasında GET, PUT, DELETE isteklerini işler; Eczanem için eczane üyeler sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/eczanem/eczane/api/rozet/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/eczanem/eczane/api/rozet` uç noktasında GET isteklerini işler; Eczanem için eczane rozet sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/eczanem/eczane/api/siparisler/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/eczanem/eczane/api/siparisler` uç noktasında GET, POST isteklerini işler; Eczanem için eczane siparişler sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/eczanem/eczane/dagitim/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | `/eczanem/eczane/dagitim` rotasında Eczanem kapsamındaki dağıtım arayüzünü sunan Next.js sayfa bileşenidir. |

### 📁 app/(panel)/eczanem/eczane/dokum/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | `/eczanem/eczane/dokum` rotasında Eczanem kapsamındaki döküm arayüzünü sunan Next.js sayfa bileşenidir. |

### 📁 app/(panel)/eczanem/eczane/musterilerim/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | Eczaneye bağlı kayıtlı müşterilerin listelendiği, yeni müşteri eklendiği veya SMS daveti gönderildiği müşteri sayfası. |

### 📁 app/(panel)/eczanem/eczane/siparisler/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | Müşterinin kasada talep ettiği barkodlu OTC indirimlerinin eczacı tarafından onaylandığı sipariş kuyruğu. |

### 📁 app/(panel)/eczanem/utt/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `_types.ts` | TypeScript / Lib | Eczanem alanında kullanılan `UttEczanemYayin`, `UttEczanemEczane`, `UttEczanemGonderim`, `UttEczanemVeri` veri tiplerini ve modüller arası sözleşmeleri tanımlar. |
| `page.tsx` | UI / React | UTT'nin portföyündeki uygun eczanelere OTC tüketici videoları dağıttığı temsilci operasyon sayfası. |

### 📁 app/(panel)/eczanem/utt/_components/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `UttEczanemDokum.tsx` | UI / React | UTT Eczanem döküm, Eczanem ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `UttVideoGonderimSatiri.tsx` | UI / React | UTT video gönderim Satiri, Eczanem listesindeki bir utt video gönderim kaydını durumu ve izinli eylemleriyle gösterir. |

### 📁 app/(panel)/eczanem/utt/mutabakat/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | `/eczanem/utt/mutabakat` rotasında Eczanem kapsamındaki mutabakat arayüzünü sunan Next.js sayfa bileşenidir. |

### 📁 app/(panel)/hapbilgi-nedir/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | `/hapbilgi-nedir` rotasında HapBilgi kapsamındaki hapbilgi nedir arayüzünü sunan Next.js sayfa bileşenidir. |

### 📁 app/(panel)/hbligi/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | `/hbligi` rotasında T-Club kapsamındaki hbligi arayüzünü sunan Next.js sayfa bileşenidir. |

### 📁 app/(panel)/hbligi/api/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/hbligi/api` uç noktasında GET isteklerini işler; T-Club için hbligi sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/iletisim/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | `/iletisim` rotasında HapBilgi kapsamındaki iletişim arayüzünü sunan Next.js sayfa bileşenidir. |

### 📁 app/(panel)/kullanicilar/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | `/kullanicilar` rotasında HapBilgi kapsamındaki kullanıcılar arayüzünü sunan Next.js sayfa bileşenidir. |

### 📁 app/(panel)/kullanicilar/api/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/kullanicilar/api` uç noktasında GET isteklerini işler; HapBilgi için kullanıcılar sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/kullanicilar/api/[kullanici_id]/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/kullanicilar/api/[kullanici_id]` uç noktasında GET, PUT, DELETE isteklerini işler; HapBilgi için kullanıcılar sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/nasil-calisir/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | `/nasil-calisir` rotasında HapBilgi kapsamındaki nasil calisir arayüzünü sunan Next.js sayfa bileşenidir. |

### 📁 app/(panel)/onaylanan-talepler/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | `/onaylanan-talepler` rotasında HapBilgi kapsamındaki onaylanan talepler arayüzünü sunan Next.js sayfa bileşenidir. |

### 📁 app/(panel)/oneriler/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | UTT için gelen önerileri, BM için gönderdiği önerileri, TM için takım takip dökümünü sunan öneri merkezi. |

### 📁 app/(panel)/oneriler/_components/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `BmOneriTakibi.tsx` | UI / React | Bm öneri Takibi, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `TmOneriTakibi.tsx` | UI / React | Tm öneri Takibi, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |

### 📁 app/(panel)/oneriler/api/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/oneriler/api` uç noktasında GET, POST isteklerini işler; HapBilgi için öneriler sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/oneriler/api/[oneri_id]/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/oneriler/api/[oneri_id]` uç noktasında PUT isteklerini işler; HapBilgi için öneriler sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/oneriler/api/kullanicilar/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/oneriler/api/kullanicilar` uç noktasında GET isteklerini işler; HapBilgi için öneriler kullanıcılar sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/oneriler/api/yayinlar/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/oneriler/api/yayinlar` uç noktasında GET isteklerini işler; HapBilgi için öneriler yayınlar sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/profil/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | `/profil` rotasında HapBilgi kapsamındaki profil arayüzünü sunan Next.js sayfa bileşenidir. |

### 📁 app/(panel)/profil/api/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/profil/api` uç noktasında GET, PUT isteklerini işler; HapBilgi için profil sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/raporlar/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | `/raporlar` rotasında raporlama kapsamındaki raporlar arayüzünü sunan Next.js sayfa bileşenidir. |

### 📁 app/(panel)/raporlar/api/bm/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/raporlar/api/bm` uç noktasında GET isteklerini işler; raporlama için raporlar bm sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/raporlar/api/eczanem/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/raporlar/api/eczanem` uç noktasında GET isteklerini işler; Eczanem için raporlar Eczanem sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/raporlar/api/tclub-uretici/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/raporlar/api/tclub-uretici` uç noktasında GET isteklerini işler; raporlama için raporlar tclub üretici sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/raporlar/api/tm/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/raporlar/api/tm` uç noktasında GET isteklerini işler; raporlama için raporlar tm sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/raporlar/api/uretici/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/raporlar/api/uretici` uç noktasında GET isteklerini işler; üretim için raporlar üretici sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/raporlar/api/uretim/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/raporlar/api/uretim` uç noktasında GET isteklerini işler; üretim için raporlar üretim sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/raporlar/api/utt/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/raporlar/api/utt` uç noktasında GET isteklerini işler; raporlama için raporlar UTT sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/raporlar/api/yonetici/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/raporlar/api/yonetici` uç noktasında GET isteklerini işler; raporlama için raporlar yönetici sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/raporlar/api/yonetici/akordeon/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/raporlar/api/yonetici/akordeon` uç noktasında GET isteklerini işler; raporlama için yönetici akordeon sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/raporlar/bm/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `bm-report.module.css` | Stil / CSS | raporlama görünümünün yerleşim, renk, tipografi ve responsive davranışlarını tanımlayan stil dosyasıdır. |
| `page.tsx` | UI / React | Bölge Müdürünün bölgesine bağlı UTT'lerin eğitim ve öneri tamamlama performansını analiz ettiği bölge raporu. |

### 📁 app/(panel)/raporlar/eczanem/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | `/raporlar/eczanem` rotasında Eczanem kapsamındaki Eczanem arayüzünü sunan Next.js sayfa bileşenidir. |

### 📁 app/(panel)/raporlar/tclub-uretici/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | `/raporlar/tclub-uretici` rotasında raporlama kapsamındaki tclub üretici arayüzünü sunan Next.js sayfa bileşenidir. |

### 📁 app/(panel)/raporlar/tm/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | Takım Müdürünün takımındaki bölgelerin ve BM'lerin genel başarı oranlarını karşılaştırdığı takım raporu. |
| `tm-report.module.css` | Stil / CSS | raporlama görünümünün yerleşim, renk, tipografi ve responsive davranışlarını tanımlayan stil dosyasıdır. |

### 📁 app/(panel)/raporlar/uretici/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | Ürün ve Eğitim Müdürlerinin ürettikleri eğitimlerin izlenme oranlarını ve eğitim türü etkisini izlediği üretici raporu. |
| `uretici-report.module.css` | Stil / CSS | üretim görünümünün yerleşim, renk, tipografi ve responsive davranışlarını tanımlayan stil dosyasıdır. |

### 📁 app/(panel)/raporlar/uretim/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | `/raporlar/uretim` rotasında üretim kapsamındaki üretim arayüzünü sunan Next.js sayfa bileşenidir. |

### 📁 app/(panel)/raporlar/utt/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | Tıbbi Tanıtım Temsilcisinin kişisel izlenme, soru başarısı ve puan kazanım grafiklerini sunan bireysel rapor sayfası. |
| `utt-report.module.css` | Stil / CSS | raporlama görünümünün yerleşim, renk, tipografi ve responsive davranışlarını tanımlayan stil dosyasıdır. |

### 📁 app/(panel)/raporlar/yonetici/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | Üst Yönetimin (GM, Direktörler) firma genelindeki tüm hiyerarşik başarı dökümlerini incelediği konsolide yönetici raporu. |
| `yonetici-report.module.css` | Stil / CSS | raporlama görünümünün yerleşim, renk, tipografi ve responsive davranışlarını tanımlayan stil dosyasıdır. |

### 📁 app/(panel)/raporlar/yonetici/_components/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `TakimBolgeUttAkordeon.tsx` | UI / React | takım bölge UTT Akordeon, raporlama ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |

### 📁 app/(panel)/senaryolar/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | İçerik Üreticisinden gelen senaryoların canlı görsel diff editörüyle incelendiği ve onaylandığı senaryo karar sayfası. |

### 📁 app/(panel)/senaryolar/[talep_id]/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | `/senaryolar/[talep_id]` rotasında HapBilgi kapsamındaki [talep id] arayüzünü sunan Next.js sayfa bileşenidir. |

### 📁 app/(panel)/sizin-yayinlariniz/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | `/sizin-yayinlariniz` rotasında HapBilgi kapsamındaki sizin yayinlariniz arayüzünü sunan Next.js sayfa bileşenidir. |

### 📁 app/(panel)/soru-setleri/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | `/soru-setleri` rotasında HapBilgi kapsamındaki soru setleri arayüzünü sunan Next.js sayfa bileşenidir. |

### 📁 app/(panel)/soru-setleri/[video_durum_id]/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | `/soru-setleri/[video_durum_id]` rotasında HapBilgi kapsamındaki [video durum id] arayüzünü sunan Next.js sayfa bileşenidir. |

### 📁 app/(panel)/sozlesmeler/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | `/sozlesmeler` rotasında HapBilgi kapsamındaki sozlesmeler arayüzünü sunan Next.js sayfa bileşenidir. |

### 📁 app/(panel)/store/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | UTT ve BM'lerin kazandıkları puanlarla ürün seçip sepete eklediği HBStore ana vitrin sayfası. |

### 📁 app/(panel)/store/[urun_id]/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | HBStore ürününün puan bedelinin incelendiği ve teslimat adresi seçilerek sipariş verildiği ürün detay sayfası. |

### 📁 app/(panel)/store/adreslerim/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | Kullanıcının mağaza teslimat adreslerini eklediği, güncellediği veya sildiği adres yönetim sayfası. |

### 📁 app/(panel)/store/api/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/store/api` uç noktasında GET isteklerini işler; HBStore için Store sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/store/api/adres/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/store/api/adres` uç noktasında GET, POST, PATCH, DELETE isteklerini işler; HBStore için Store adres sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/store/api/siparis/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/store/api/siparis` uç noktasında GET, POST, PATCH isteklerini işler; HBStore için Store sipariş sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/store/siparisler/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `_types.ts` | TypeScript / Lib | HBStore alanında kullanılan `SiparisSatiri`, `HiyerarsiKullanici`, `HiyerarsiBolge`, `HiyerarsiTakim` veri tiplerini ve modüller arası sözleşmeleri tanımlar. |
| `page.tsx` | UI / React | `/store/siparisler` rotasında HBStore kapsamındaki siparişler arayüzünü sunan Next.js sayfa bileşenidir. |

### 📁 app/(panel)/store/siparisler/_components/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `SiparisFiltreleri.tsx` | UI / React | sipariş Filtreleri, HBStore ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `SiparisTablosu.tsx` | UI / React | sipariş Tablosu, HBStore verilerini sıralı tablo görünümünde ve ilgili kullanıcı eylemleriyle sunar. |

### 📁 app/(panel)/store/siparisler/_hooks/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `useHiyerarsi.ts` | TypeScript / Lib | use hiyerarşi hook'u, HBStore ekranlarının veri yükleme, durum ve kullanıcı eylemlerini ortaklaştırır. |
| `useSiparisListe.ts` | TypeScript / Lib | use sipariş liste hook'u, HBStore ekranlarının veri yükleme, durum ve kullanıcı eylemlerini ortaklaştırır. |

### 📁 app/(panel)/store/siparisler/api/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/store/siparisler/api` uç noktasında GET isteklerini işler; HBStore için Store siparişler sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/store/siparisler/api/hiyerarsi/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/store/siparisler/api/hiyerarsi` uç noktasında GET isteklerini işler; HBStore için siparişler hiyerarşi sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/store/siparislerim/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | Kullanıcının geçmiş mağaza siparişlerini, kargo durumlarını takip ettiği ve sipariş iptali yapabildiği geçmiş sayfası. |

### 📁 app/(panel)/talepler/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `_types.ts` | TypeScript / Lib | HapBilgi alanında kullanılan `Talep`, `Urun`, `Teknik`, `Takim` veri tiplerini ve modüller arası sözleşmeleri tanımlar. |
| `_ureticiRolTypes.ts` | TypeScript / Lib | HapBilgi alanında kullanılan `TalepSatiri`, `RevizyonNotu`, `SenaryoBlogu`, `VideoBlogu` veri tiplerini ve modüller arası sözleşmeleri tanımlar. |
| `page.tsx` | UI / React | Ürün Müdürleri ve üretici rollerin yeni eğitim talebi oluşturduğu ve geçmiş talepleri listelediği talep yönetim arayüzü. |

### 📁 app/(panel)/talepler/_components/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `AdimIcerigi.tsx` | UI / React | Adim Icerigi, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `AksiyonSeridi.tsx` | UI / React | Aksiyon Seridi, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `EkDosyaYukleme.tsx` | UI / React | Ek Dosya yükleme, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `FlipPdfTalepAlanlari.tsx` | UI / React | Flip Pdf talep alanları, HapBilgi işleminde gerekli flip pdf talep alanları girdilerini toplar ve kullanıcı doğrulamalarını görünür kılar. |
| `GorselTalepAlanlari.tsx` | UI / React | Dijital Broşür talep alanları, HapBilgi işleminde gerekli dijital broşür talep alanları girdilerini toplar ve kullanıcı doğrulamalarını görünür kılar. |
| `HazirSoruSetiBlogu.tsx` | UI / React | hazır soru Seti Blogu, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `HazirVideoYukleme.tsx` | UI / React | hazır video yükleme, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `IptalAkordiyonu.tsx` | UI / React | Iptal Akordiyonu, HapBilgi kapsamındaki ıptal içeriğini açılır-kapanır bölümde gösterir. |
| `IsListesi.tsx` | UI / React | Is Listesi, HapBilgi kayıtlarını listeleyip yükleme, seçim veya filtreleme etkileşimlerini yönetir. |
| `PodcastTalepAlanlari.tsx` | UI / React | Podcast talep alanları, HapBilgi işleminde gerekli podcast talep alanları girdilerini toplar ve kullanıcı doğrulamalarını görünür kılar. |
| `SoruSetiAyarlari.tsx` | UI / React | soru Seti Ayarlari, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `TalepDetayi.tsx` | UI / React | talep Detayi, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `TalepOnayModal.tsx` | UI / React | talep onay Modal, HapBilgi kapsamındaki talep onay işlemini açılır pencerede yöneten React bileşenidir. |
| `UreticiRolGorunum.tsx` | UI / React | üretici rol Gorunum, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `UretimSeridi.tsx` | UI / React | üretim Seridi, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `UrunTeknikSecici.tsx` | UI / React | ürün teknik Secici, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `VideoYukleme.tsx` | UI / React | video yükleme, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `YeniTalepAkordiyonu.tsx` | UI / React | Yeni talep Akordiyonu, HapBilgi kapsamındaki yeni talep içeriğini açılır-kapanır bölümde gösterir. |
| `YeniTalepFormV2.tsx` | UI / React | Yeni talep Form V2, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |

### 📁 app/(panel)/talepler/_hooks/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `useTalepFormu.ts` | TypeScript / Lib | Talep formundaki girdi validasyonlarını, hedef rol kurallarını ve dosya yükleme işlemlerini yöneten React hook'u. |
| `useTalepMerkezi.ts` | TypeScript / Lib | Üreticinin geçmiş talep listelerini filtreleyen, sayfalayan ve durum geçişlerini koordine eden React hook'u. |

### 📁 app/(panel)/talepler/[talep_id]/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | `/talepler/[talep_id]` rotasında HapBilgi kapsamındaki [talep id] arayüzünü sunan Next.js sayfa bileşenidir. |

### 📁 app/(panel)/talepler/api/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/talepler/api` uç noktasında POST isteklerini işler; HapBilgi için talepler sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/talepler/api/bunny-yukleme-baslat/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/talepler/api/bunny-yukleme-baslat` uç noktasında POST isteklerini işler; HapBilgi için talepler Bunny yükleme başlatma sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/talepler/api/detay/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/talepler/api/detay` uç noktasında GET isteklerini işler; HapBilgi için talepler detay sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/talepler/api/dosyalar/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/talepler/api/dosyalar` uç noktasında GET, POST, DELETE isteklerini işler; HapBilgi için talepler dosyalar sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/talepler/api/kunye/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/talepler/api/kunye` uç noktasında GET isteklerini işler; HapBilgi için talepler künye sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/talepler/api/uretici-rol/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/talepler/api/uretici-rol` uç noktasında GET isteklerini işler; HapBilgi için talepler üretici rol sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/tum-yayinlar/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | `/tum-yayinlar` rotasında HapBilgi kapsamındaki tum yayınlar arayüzünü sunan Next.js sayfa bileşenidir. |

### 📁 app/(panel)/uretim/api/gorevler/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/uretim/api/gorevler` uç noktasında GET isteklerini işler; üretim için üretim gorevler sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/uretim/api/hazir-video/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/uretim/api/hazir-video` uç noktasında PUT isteklerini işler; üretim için üretim hazır video sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/uretim/api/karar/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/uretim/api/karar` uç noktasında POST isteklerini işler; üretim için üretim karar sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/uretim/api/talep-baslat/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/uretim/api/talep-baslat` uç noktasında POST isteklerini işler; üretim için üretim talep başlatma sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/uretim/api/teslim/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/uretim/api/teslim` uç noktasında POST isteklerini işler; üretim için üretim teslim sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/uretim/gorevler/[gorev_id]/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | `/uretim/gorevler/[gorev_id]` rotasında üretim kapsamındaki [gorev id] arayüzünü sunan Next.js sayfa bileşenidir. |

### 📁 app/(panel)/videolar/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | `/videolar` rotasında HapBilgi kapsamındaki videolar arayüzünü sunan Next.js sayfa bileşenidir. |

### 📁 app/(panel)/videolar/[senaryo_durum_id]/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | `/videolar/[senaryo_durum_id]` rotasında HapBilgi kapsamındaki [senaryo durum id] arayüzünü sunan Next.js sayfa bileşenidir. |

### 📁 app/(panel)/videolar/api/bunny-durum/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/videolar/api/bunny-durum` uç noktasında GET isteklerini işler; HapBilgi için videolar Bunny durum sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/videolar/api/bunny-yukleme-baslat/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/videolar/api/bunny-yukleme-baslat` uç noktasında POST isteklerini işler; HapBilgi için videolar Bunny yükleme başlatma sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/videolar/api/bunny-yukleme-iptal/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/videolar/api/bunny-yukleme-iptal` uç noktasında POST isteklerini işler; HapBilgi için videolar Bunny yükleme iptal sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/videolarim/[kategori]/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | `/videolarim/[kategori]` rotasında HapBilgi kapsamındaki [kategori] arayüzünü sunan Next.js sayfa bileşenidir. |

### 📁 app/(panel)/yayin-yonetimi/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `_types.ts` | TypeScript / Lib | HapBilgi alanında kullanılan `Bekleyen`, `Yayin`, `AltSekme`, `BekleyenHedefSayilari` veri tiplerini ve modüller arası sözleşmeleri tanımlar. |
| `page.tsx` | UI / React | Onaylanan içeriklerin puanlarının belirlendiği, hedef kitleye açıldığı ve yayına alındığı yayın operasyon merkezi. |

### 📁 app/(panel)/yayin-yonetimi/_components/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `BekleyenSatir.tsx` | UI / React | bekleyen Satir, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `Modallar.tsx` | UI / React | Modallar, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `SoruListesi.tsx` | UI / React | soru Listesi, HapBilgi kayıtlarını listeleyip yükleme, seçim veya filtreleme etkileşimlerini yönetir. |
| `Yardimcilar.tsx` | UI / React | Yardimcilar, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `YayinKumandaPaneli.tsx` | UI / React | yayın Kumanda Paneli, HapBilgi kapsamındaki yayın kumanda verilerini ve işlemlerini tek panelde birleştirir. |
| `YayinSatir.tsx` | UI / React | yayın Satir, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |

### 📁 app/(panel)/yayin-yonetimi/_hooks/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `useYayinYonetimi.ts` | TypeScript / Lib | Yayın havuzundaki aday içerikleri, puan formunu ve yayına alma/durdurma süreçlerini yöneten React hook'u. |

### 📁 app/(panel)/yayin-yonetimi/api/bekleyenler/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/yayin-yonetimi/api/bekleyenler` uç noktasında GET isteklerini işler; HapBilgi için yayın yonetimi bekleyenler sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/yayin-yonetimi/api/bekleyenler/sil/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/yayin-yonetimi/api/bekleyenler/sil` uç noktasında DELETE isteklerini işler; HapBilgi için bekleyenler silme sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/yayin-yonetimi/api/puan/sorular/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/yayin-yonetimi/api/puan/sorular` uç noktasında POST isteklerini işler; HapBilgi için puan sorular sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/yayin-yonetimi/api/puan/video/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/yayin-yonetimi/api/puan/video` uç noktasında POST isteklerini işler; video altyapısı için puan video sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/yayin-yonetimi/api/tekrar-secenekleri/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/yayin-yonetimi/api/tekrar-secenekleri` uç noktasında GET isteklerini işler; HapBilgi için yayın yonetimi tekrar secenekleri sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/yayin-yonetimi/api/yayinlar/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/yayin-yonetimi/api/yayinlar` uç noktasında GET, POST isteklerini işler; HapBilgi için yayın yonetimi yayınlar sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/yayin-yonetimi/api/yayinlar/[yayin_id]/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/yayin-yonetimi/api/yayinlar/[yayin_id]` uç noktasında PUT isteklerini işler; HapBilgi için yayın yonetimi yayınlar sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/yayindaki-videolar/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | `/yayindaki-videolar` rotasında HapBilgi kapsamındaki yayindaki videolar arayüzünü sunan Next.js sayfa bileşenidir. |

### 📁 app/(panel)/yayindaki-videolar/_components/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `BmOneriPaneli.tsx` | UI / React | Bm öneri Paneli, HapBilgi kapsamındaki bm öneri verilerini ve işlemlerini tek panelde birleştirir. |
| `KlasorGrid.tsx` | UI / React | Klasor Grid, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `UreticiYayinKatalogu.tsx` | UI / React | üretici yayın Katalogu, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `YayindakiVideoBolumu.tsx` | UI / React | Yayindaki video Bolumu, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |

### 📁 app/(panel)/yayindaki-videolar/api/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/yayindaki-videolar/api` uç noktasında GET isteklerini işler; HapBilgi için yayindaki videolar sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/(panel)/yayindaki-videolar/api/[yayin_id]/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/yayindaki-videolar/api/[yayin_id]` uç noktasında GET isteklerini işler; HapBilgi için yayindaki videolar sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

## 4. APP ADMİN MODÜLÜ

### 📁 app/admin/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `_constants.ts` | TypeScript / Lib | admin yönetimi kapsamında `ROLLER`, `RENK_GRI`, `RENK_BORDO`, `RENK_CIZGI` işlev ve sabitlerini sağlar; constants iş kurallarını tek modülde toplar. |
| `_types.ts` | TypeScript / Lib | admin yönetimi alanında kullanılan `Firma`, `Kullanici`, `OnizlemeSatir`, `OnizlemeKurulum` veri tiplerini ve modüller arası sözleşmeleri tanımlar. |
| `page.tsx` | UI / React | Sistem yöneticilerinin (Admin) firma, kullanıcı, organizasyon ve mağaza operasyonlarını yönettiği M2 modüler orkestrasyon kabuğu. |

### 📁 app/admin/_components/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `AdminUstBar.tsx` | UI / React | admin Ust Bar, admin yönetimi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `FirmaSidebar.tsx` | UI / React | firma Sidebar, admin yönetimi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `FirmaVeriSilModal.tsx` | UI / React | firma veri silme Modal, admin yönetimi kapsamındaki firma veri silme işlemini açılır pencerede yöneten React bileşenidir. |
| `KullaniciDuzenleModal.tsx` | UI / React | kullanıcı düzenleme Modal, admin yönetimi kapsamındaki kullanıcı düzenleme işlemini açılır pencerede yöneten React bileşenidir. |
| `KullaniciListesi.tsx` | UI / React | kullanıcı Listesi, admin yönetimi kayıtlarını listeleyip yükleme, seçim veya filtreleme etkileşimlerini yönetir. |
| `ModulDurumKarti.tsx` | UI / React | modül durum Karti, admin yönetimi içindeki modül durum bilgisini kart görünümü ve ilgili eylemlerle sunar. |
| `ModulSekmeBari.tsx` | UI / React | modül Sekme Bari, admin yönetimi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `SekmeBari.tsx` | UI / React | Sekme Bari, admin yönetimi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `SistemAyarlari.tsx` | UI / React | Sistem Ayarlari, admin yönetimi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `TakimBolgeFormu.tsx` | UI / React | takım bölge Formu, admin yönetimi işleminde gerekli takım bölge girdilerini toplar ve kullanıcı doğrulamalarını görünür kılar. |
| `TekilGirisFormu.tsx` | UI / React | Tekil Giris Formu, admin yönetimi işleminde gerekli tekil giris girdilerini toplar ve kullanıcı doğrulamalarını görünür kılar. |
| `TopluGirisFormu.tsx` | UI / React | toplu Giris Formu, admin yönetimi işleminde gerekli toplu giris girdilerini toplar ve kullanıcı doğrulamalarını görünür kılar. |
| `TopluTekilSilModal.tsx` | UI / React | toplu Tekil silme Modal, admin yönetimi kapsamındaki toplu tekil silme işlemini açılır pencerede yöneten React bileşenidir. |
| `UrunTeknikYonetimi.tsx` | UI / React | ürün teknik Yonetimi, admin yönetimi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |

### 📁 app/admin/_components/global/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `EclubStorePaneli.tsx` | UI / React | E-Club Store Paneli, admin yönetimi kapsamındaki e-club store verilerini ve işlemlerini tek panelde birleştirir. |
| `HbStorePaneli.tsx` | UI / React | Hb Store Paneli, admin yönetimi kapsamındaki hb store verilerini ve işlemlerini tek panelde birleştirir. |
| `UretimAtamaPaneli.tsx` | UI / React | üretim atama Paneli, admin yönetimi kapsamındaki üretim atama verilerini ve işlemlerini tek panelde birleştirir. |

### 📁 app/admin/_hooks/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `useAdminPanel.ts` | TypeScript / Lib | use admin panel hook'u, admin yönetimi ekranlarının veri yükleme, durum ve kullanıcı eylemlerini ortaklaştırır. |
| `useKullaniciListesi.ts` | TypeScript / Lib | use kullanıcı Listesi hook'u, admin yönetimi ekranlarının veri yükleme, durum ve kullanıcı eylemlerini ortaklaştırır. |
| `useTakimBolgeForm.ts` | TypeScript / Lib | use takım bölge Form hook'u, admin yönetimi ekranlarının veri yükleme, durum ve kullanıcı eylemlerini ortaklaştırır. |
| `useTekilForm.ts` | TypeScript / Lib | use Tekil Form hook'u, admin yönetimi ekranlarının veri yükleme, durum ve kullanıcı eylemlerini ortaklaştırır. |
| `useTopluForm.ts` | TypeScript / Lib | use toplu Form hook'u, admin yönetimi ekranlarının veri yükleme, durum ve kullanıcı eylemlerini ortaklaştırır. |
| `useUrunTeknik.ts` | TypeScript / Lib | use ürün teknik hook'u, admin yönetimi ekranlarının veri yükleme, durum ve kullanıcı eylemlerini ortaklaştırır. |

### 📁 app/admin/api/eclub/kayitli/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/admin/api/eclub/kayitli` uç noktasında GET, PUT isteklerini işler; E-Club için E-Club kayitli sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/admin/api/eclub/onaylar/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/admin/api/eclub/onaylar` uç noktasında GET, PUT isteklerini işler; E-Club için E-Club onaylar sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/admin/api/eclub/test-eczaneler/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/admin/api/eclub/test-eczaneler` uç noktasında GET, POST, DELETE isteklerini işler; E-Club için E-Club test eczaneler sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/admin/api/eclub/test-temizlik/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/admin/api/eclub/test-temizlik` uç noktasında GET, DELETE isteklerini işler; E-Club için E-Club test temizlik sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/admin/api/firmalar/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/admin/api/firmalar` uç noktasında GET, POST isteklerini işler; admin yönetimi için admin firmalar sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/admin/api/firmalar/[firma_id]/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/admin/api/firmalar/[firma_id]` uç noktasında GET, PUT, PATCH, DELETE isteklerini işler; admin yönetimi için admin firmalar sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/admin/api/firmalar/[firma_id]/export/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/admin/api/firmalar/[firma_id]/export` uç noktasında GET isteklerini işler; admin yönetimi için firmalar dışa aktarma sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/admin/api/firmalar/[firma_id]/kullanicilar/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/admin/api/firmalar/[firma_id]/kullanicilar` uç noktasında GET, POST, PUT, DELETE isteklerini işler; admin yönetimi için firmalar kullanıcılar sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/admin/api/firmalar/[firma_id]/takimlar/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/admin/api/firmalar/[firma_id]/takimlar` uç noktasında GET, POST isteklerini işler; admin yönetimi için firmalar takimlar sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/admin/api/firmalar/[firma_id]/takimlar/[takim_id]/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/admin/api/firmalar/[firma_id]/takimlar/[takim_id]` uç noktasında GET, PUT, DELETE isteklerini işler; admin yönetimi için firmalar takimlar sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/admin/api/firmalar/[firma_id]/takimlar/[takim_id]/bolgeler/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/admin/api/firmalar/[firma_id]/takimlar/[takim_id]/bolgeler` uç noktasında GET, POST isteklerini işler; admin yönetimi için takimlar bolgeler sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/admin/api/firmalar/[firma_id]/takimlar/[takim_id]/bolgeler/[bolge_id]/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/admin/api/firmalar/[firma_id]/takimlar/[takim_id]/bolgeler/[bolge_id]` uç noktasında GET, PUT, DELETE isteklerini işler; admin yönetimi için takimlar bolgeler sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/admin/api/firmalar/[firma_id]/teknikler/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/admin/api/firmalar/[firma_id]/teknikler` uç noktasında GET, POST, DELETE isteklerini işler; admin yönetimi için firmalar teknikler sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/admin/api/firmalar/[firma_id]/toplu-yukle/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/admin/api/firmalar/[firma_id]/toplu-yukle` uç noktasında POST isteklerini işler; admin yönetimi için firmalar toplu yukle sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/admin/api/firmalar/[firma_id]/urunler/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/admin/api/firmalar/[firma_id]/urunler` uç noktasında GET, POST, DELETE isteklerini işler; admin yönetimi için firmalar ürünler sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/admin/api/giris/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/admin/api/giris` uç noktasında POST isteklerini işler; admin yönetimi için admin giris sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/admin/api/mesai-bypass/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/admin/api/mesai-bypass` uç noktasında GET, PUT isteklerini işler; admin yönetimi için admin mesai bypass sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/admin/api/sistem-ayarlari/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/admin/api/sistem-ayarlari` uç noktasında GET, PUT isteklerini işler; admin yönetimi için admin sistem ayarlari sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/admin/api/uretim/atamalar/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/admin/api/uretim/atamalar` uç noktasında GET, POST isteklerini işler; üretim için üretim atamalar sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/admin/api/uretim/gorev-devret/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/admin/api/uretim/gorev-devret` uç noktasında POST isteklerini işler; üretim için üretim görev devret sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/admin/api/veri-sil/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/admin/api/veri-sil` uç noktasında POST isteklerini işler; admin yönetimi için admin veri silme sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/admin/eclub/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | `/admin/eclub` rotasında E-Club kapsamındaki E-Club arayüzünü sunan Next.js sayfa bileşenidir. |

### 📁 app/admin/eclub-store/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `_types.ts` | TypeScript / Lib | E-Club Store alanında kullanılan `EclubStoreSekme` veri tiplerini ve modüller arası sözleşmeleri tanımlar. |
| `page.tsx` | UI / React | UTT ve BM'lerin kazandıkları puanlarla ürün seçip sepete eklediği HBStore ana vitrin sayfası. |

### 📁 app/admin/eclub-store/_components/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `EclubStoreFirmaErisimModal.tsx` | UI / React | E-Club Store firma erişim Modal, E-Club Store kapsamındaki e-club store firma erişim işlemini açılır pencerede yöneten React bileşenidir. |
| `EclubStoreKategorilerSekmesi.tsx` | UI / React | E-Club Store Kategoriler Sekmesi, E-Club Store yönetimindeki e-club store kategoriler kayıtlarını ve eylemlerini sunar. |
| `EclubStoreKategoriModal.tsx` | UI / React | E-Club Store kategori Modal, E-Club Store kapsamındaki e-club store kategori işlemini açılır pencerede yöneten React bileşenidir. |
| `EclubStoreSekmeBari.tsx` | UI / React | E-Club Store Sekme Bari, E-Club Store ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `EclubStoreSiparislerSekmesi.tsx` | UI / React | E-Club Store siparişler Sekmesi, E-Club Store yönetimindeki e-club store siparişler kayıtlarını ve eylemlerini sunar. |
| `EclubStoreSiparisYonetimModal.tsx` | UI / React | E-Club Store sipariş yönetim Modal, E-Club Store kapsamındaki e-club store sipariş yönetim işlemini açılır pencerede yöneten React bileşenidir. |
| `EclubStoreUrunlerSekmesi.tsx` | UI / React | E-Club Store ürünler Sekmesi, E-Club Store yönetimindeki e-club store ürünler kayıtlarını ve eylemlerini sunar. |
| `EclubStoreUrunModal.tsx` | UI / React | E-Club Store ürün Modal, E-Club Store kapsamındaki e-club store ürün işlemini açılır pencerede yöneten React bileşenidir. |

### 📁 app/admin/eclub-store/_hooks/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `useEclubStoreKategori.ts` | TypeScript / Lib | use E-Club Store kategori hook'u, E-Club Store ekranlarının veri yükleme, durum ve kullanıcı eylemlerini ortaklaştırır. |
| `useEclubStoreSiparis.ts` | TypeScript / Lib | use E-Club Store sipariş hook'u, E-Club Store ekranlarının veri yükleme, durum ve kullanıcı eylemlerini ortaklaştırır. |
| `useEclubStoreUrun.ts` | TypeScript / Lib | use E-Club Store ürün hook'u, E-Club Store ekranlarının veri yükleme, durum ve kullanıcı eylemlerini ortaklaştırır. |

### 📁 app/admin/eclub-store/api/kategori/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/admin/eclub-store/api/kategori` uç noktasında GET, POST, PUT, DELETE isteklerini işler; E-Club Store için E-Club Store kategori sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/admin/eclub-store/api/siparis/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/admin/eclub-store/api/siparis` uç noktasında GET, PATCH isteklerini işler; E-Club Store için E-Club Store sipariş sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/admin/eclub-store/api/upload/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/admin/eclub-store/api/upload` uç noktasında POST isteklerini işler; E-Club Store için E-Club Store upload sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/admin/eclub-store/api/urun/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/admin/eclub-store/api/urun` uç noktasında GET, POST, PUT, DELETE isteklerini işler; E-Club Store için E-Club Store ürün sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/admin/eclub-store/api/urun-firma/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/admin/eclub-store/api/urun-firma` uç noktasında GET, PATCH isteklerini işler; E-Club Store için E-Club Store ürün firma sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/admin/eclub/_components/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `EclubYonetimPaneli.tsx` | UI / React | E-Club yönetim Paneli, E-Club kapsamındaki e-club yönetim verilerini ve işlemlerini tek panelde birleştirir. |

### 📁 app/admin/eclub/_hooks/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `useEclubKayitli.ts` | TypeScript / Lib | use E-Club Kayitli hook'u, E-Club ekranlarının veri yükleme, durum ve kullanıcı eylemlerini ortaklaştırır. |
| `useEclubOnaylar.ts` | TypeScript / Lib | use E-Club onaylar hook'u, E-Club ekranlarının veri yükleme, durum ve kullanıcı eylemlerini ortaklaştırır. |
| `useEclubTestEczaneler.ts` | TypeScript / Lib | use E-Club test Eczaneler hook'u, E-Club ekranlarının veri yükleme, durum ve kullanıcı eylemlerini ortaklaştırır. |
| `useEclubTestTemizlik.ts` | TypeScript / Lib | use E-Club test Temizlik hook'u, E-Club ekranlarının veri yükleme, durum ve kullanıcı eylemlerini ortaklaştırır. |

### 📁 app/admin/store/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `_types.ts` | TypeScript / Lib | HBStore alanında kullanılan `UrunGosterim`, `SiparisGosterim`, `Sekme` veri tiplerini ve modüller arası sözleşmeleri tanımlar. |
| `page.tsx` | UI / React | UTT ve BM'lerin kazandıkları puanlarla ürün seçip sepete eklediği HBStore ana vitrin sayfası. |

### 📁 app/admin/store/_components/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `FirmaErisimModal.tsx` | UI / React | firma erişim Modal, HBStore kapsamındaki firma erişim işlemini açılır pencerede yöneten React bileşenidir. |
| `KategorilerSekmesi.tsx` | UI / React | Kategoriler Sekmesi, HBStore yönetimindeki kategoriler kayıtlarını ve eylemlerini sunar. |
| `KategoriModal.tsx` | UI / React | kategori Modal, HBStore kapsamındaki kategori işlemini açılır pencerede yöneten React bileşenidir. |
| `SekmeBari.tsx` | UI / React | Sekme Bari, HBStore ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `SiparislerSekmesi.tsx` | UI / React | siparişler Sekmesi, HBStore yönetimindeki siparişler kayıtlarını ve eylemlerini sunar. |
| `SiparisYonetimModal.tsx` | UI / React | sipariş yönetim Modal, HBStore kapsamındaki sipariş yönetim işlemini açılır pencerede yöneten React bileşenidir. |
| `UrunlerSekmesi.tsx` | UI / React | ürünler Sekmesi, HBStore yönetimindeki ürünler kayıtlarını ve eylemlerini sunar. |
| `UrunModal.tsx` | UI / React | ürün Modal, HBStore kapsamındaki ürün işlemini açılır pencerede yöneten React bileşenidir. |

### 📁 app/admin/store/_hooks/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `useKategoriYonetimi.ts` | TypeScript / Lib | use kategori Yonetimi hook'u, HBStore ekranlarının veri yükleme, durum ve kullanıcı eylemlerini ortaklaştırır. |
| `useSiparisYonetimi.ts` | TypeScript / Lib | use sipariş Yonetimi hook'u, HBStore ekranlarının veri yükleme, durum ve kullanıcı eylemlerini ortaklaştırır. |
| `useUrunYonetimi.ts` | TypeScript / Lib | use ürün Yonetimi hook'u, HBStore ekranlarının veri yükleme, durum ve kullanıcı eylemlerini ortaklaştırır. |

### 📁 app/admin/store/api/kategori/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/admin/store/api/kategori` uç noktasında GET, POST, PATCH, DELETE isteklerini işler; HBStore için Store kategori sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/admin/store/api/siparis/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/admin/store/api/siparis` uç noktasında GET, PATCH isteklerini işler; HBStore için Store sipariş sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/admin/store/api/upload/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/admin/store/api/upload` uç noktasında POST isteklerini işler; HBStore için Store upload sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/admin/store/api/urun/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/admin/store/api/urun` uç noktasında GET, POST, PATCH, DELETE isteklerini işler; HBStore için Store ürün sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/admin/store/api/urun-firma/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/admin/store/api/urun-firma` uç noktasında GET, PATCH isteklerini işler; HBStore için Store ürün firma sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

## 5. APP ECZANEM ÜYE PORTALI

### 📁 app/eczanem/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `_types.ts` | TypeScript / Lib | Eczanem alanında kullanılan `EczanemMusteriVideo`, `EczanemVideoRaflari` veri tiplerini ve modüller arası sözleşmeleri tanımlar. |
| `page.tsx` | UI / React | `/eczanem` rotasında Eczanem kapsamındaki Eczanem arayüzünü sunan Next.js sayfa bileşenidir. |

### 📁 app/eczanem/_components/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `EclubGecisKarti.tsx` | UI / React | E-Club Gecis Karti, Eczanem içindeki e-club gecis bilgisini kart görünümü ve ilgili eylemlerle sunar. |
| `EczanemMusteriNavbar.tsx` | UI / React | Eczanem üye Navbar, Eczanem ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `EczanemPuanlarim.tsx` | UI / React | Eczanem Puanlarim, Eczanem ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `EczanemVideoOynatici.tsx` | UI / React | Eczanem video Oynatici, ilgili öğrenme aracını gösteren ve Eczanem ilerleme/tamamlama akışına bağlayan oynatıcı bileşenidir. |
| `EczanemVideoRafi.tsx` | UI / React | Eczanem video Rafi, Eczanem içeriklerini yatay raf düzeninde listeler ve seçilen kaydı ilgili ayrıntı/oynatıcı akışına taşır. |

### 📁 app/eczanem/api/eclub-gecisi/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/eczanem/api/eclub-gecisi` uç noktasında GET, POST isteklerini işler; Eczanem için Eczanem E-Club gecisi sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/eczanem/api/etkilesim/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/eczanem/api/etkilesim` uç noktasında POST isteklerini işler; Eczanem için Eczanem etkileşim sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/eczanem/api/giris/sifre/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/eczanem/api/giris/sifre` uç noktasında POST isteklerini işler; Eczanem için giris sifre sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/eczanem/api/hesabimi-sil/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/eczanem/api/hesabimi-sil` uç noktasında POST isteklerini işler; Eczanem için Eczanem hesabimi silme sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/eczanem/api/izleme/baslat/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/eczanem/api/izleme/baslat` uç noktasında POST isteklerini işler; Eczanem için izleme başlatma sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/eczanem/api/izleme/bitir/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/eczanem/api/izleme/bitir` uç noktasında PUT isteklerini işler; Eczanem için izleme tamamlama sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/eczanem/api/izleme/cevapla/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/eczanem/api/izleme/cevapla` uç noktasında POST isteklerini işler; Eczanem için izleme cevaplama sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/eczanem/api/izleme/ilerleme/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/eczanem/api/izleme/ilerleme` uç noktasında POST isteklerini işler; Eczanem için izleme ilerleme sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/eczanem/api/izleme/sorular/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/eczanem/api/izleme/sorular` uç noktasında GET isteklerini işler; Eczanem için izleme sorular sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/eczanem/api/puanlar/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/eczanem/api/puanlar` uç noktasında GET isteklerini işler; Eczanem için Eczanem puanlar sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/eczanem/api/siparis/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/eczanem/api/siparis` uç noktasında GET, POST isteklerini işler; Eczanem için Eczanem sipariş sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/eczanem/api/siparis/hesap/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/eczanem/api/siparis/hesap` uç noktasında POST isteklerini işler; Eczanem için sipariş hesap sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/eczanem/api/siparis/vazgec/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/eczanem/api/siparis/vazgec` uç noktasında POST isteklerini işler; Eczanem için sipariş vazgec sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/eczanem/api/videolar/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/eczanem/api/videolar` uç noktasında GET isteklerini işler; Eczanem için Eczanem videolar sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/eczanem/kapali/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | `/eczanem/kapali` rotasında Eczanem kapsamındaki kapali arayüzünü sunan Next.js sayfa bileşenidir. |

### 📁 app/eczanem/puanlarim/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `page.tsx` | UI / React | Müşterinin kazandığı puanları gördüğü ve anlaşmalı eczane kasasında indirim barkodu oluşturduğu kasa cüzdan sayfası. |

### 📁 app/eczanem/utt/api/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/eczanem/utt/api` uç noktasında GET, POST isteklerini işler; Eczanem için Eczanem UTT sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/eczanem/utt/api/dokum/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/eczanem/utt/api/dokum` uç noktasında GET isteklerini işler; Eczanem için UTT döküm sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

## 6. APP ORTAK ÖĞRENME TAKİP ROTALARI

### 📁 app/izle/api/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/izle/api` uç noktasında GET isteklerini işler; HapBilgi için izleme sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/izle/api/[yayin_id]/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/izle/api/[yayin_id]` uç noktasında GET isteklerini işler; HapBilgi için izleme sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/izle/api/baslat/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/izle/api/baslat` uç noktasında POST isteklerini işler; HapBilgi için izleme başlatma sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/izle/api/begeni/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/izle/api/begeni` uç noktasında POST isteklerini işler; HapBilgi için izleme beğeni sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/izle/api/bitir/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/izle/api/bitir` uç noktasında PUT isteklerini işler; HapBilgi için izleme tamamlama sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/izle/api/cevap/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/izle/api/cevap` uç noktasında POST isteklerini işler; HapBilgi için izleme cevap sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/izle/api/favori/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/izle/api/favori` uç noktasında POST isteklerini işler; HapBilgi için izleme favori sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/izle/api/ileri-sarma/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/izle/api/ileri-sarma` uç noktasında POST isteklerini işler; HapBilgi için izleme ileri sarma sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

### 📁 app/izle/api/sorular/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `route.ts` | API / Route Handler | `/izle/api/sorular` uç noktasında GET isteklerini işler; HapBilgi için izleme sorular sürecini gerekli kimlik, yetki ve girdi doğrulamalarıyla yürütür. |

## 7. LİB ÇEKİRDEK İŞ MANTIĞI VE MOTORLAR

### 📁 lib/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `utils.ts` | TypeScript / Lib | HapBilgi kapsamında `cn` işlev ve sabitlerini sağlar; utils iş kurallarını tek modülde toplar. |

### 📁 lib/admin/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `hiyerarsiTekillik.ts` | TypeScript / Lib | admin yönetimi kapsamında `hiyerarsiAdiBicimle`, `tekillikIhlaliMi` işlev ve sabitlerini sağlar; hiyerarşi Tekillik iş kurallarını tek modülde toplar. |
| `kullaniciDogrulama.ts` | TypeScript / Lib | admin yönetimi kapsamında `turkceKatla`, `rolCoz`, `telefonNormalize` işlev ve sabitlerini ve `FirmaYapisi`, `KullaniciGirdisi`, `DogrulanmisKullanici` veri sözleşmelerini sağlar; kullanıcı Dogrulama iş kurallarını tek modülde toplar. |
| `telefonBicim.ts` | TypeScript / Lib | admin yönetimi kapsamında `telefonRakam`, `telefonBicimle` işlev ve sabitlerini sağlar; telefon Bicim iş kurallarını tek modülde toplar. |
| `topluPaketButunlugu.ts` | TypeScript / Lib | admin yönetimi kapsamında `topluPaketHatalari` işlev ve sabitlerini ve `TopluPaketSatiri` veri sözleşmelerini sağlar; toplu paket Butunlugu iş kurallarını tek modülde toplar. |

### 📁 lib/auth/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `guvenliCikis.ts` | TypeScript / Lib | kimlik ve oturum kapsamında `supabaseAuthCookieOnEki`, `guvenliCikisYap` işlev ve sabitlerini sağlar; guvenli Cikis iş kurallarını tek modülde toplar. |
| `mobilKarsilama.ts` | TypeScript / Lib | kimlik ve oturum kapsamında `mobilKarsilamaYonlendiricisiOlustur` işlev ve sabitlerini sağlar; mobil Karsilama iş kurallarını tek modülde toplar. |

### 📁 lib/bildirimler/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `rozet.ts` | TypeScript / Lib | bildirim kapsamında `BILDIRIM_ROZETLERI_DEGISTI`, `bildirimRozetleriniYenile` işlev ve sabitlerini sağlar; rozet iş kurallarını tek modülde toplar. |

### 📁 lib/cclub/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `bildirimMesajlari.ts` | TypeScript / Lib | C-Club kapsamında `challengeGeldiMesaji`, `challengeIzlendiMesaji` işlev ve sabitlerini sağlar; bildirim Mesajlari iş kurallarını tek modülde toplar. |
| `kartDetaylari.ts` | TypeScript / Lib | C-Club kapsamında `ccKartMetrikleri` işlev ve sabitlerini ve `CcKartMetrik` veri sözleşmelerini sağlar; kart Detaylari iş kurallarını tek modülde toplar. |
| `kayit.ts` | TypeScript / Lib | C-Club kapsamında `challengeOlustur`, `referralPuaniKaydet` işlev ve sabitlerini sağlar; kayıt iş kurallarını tek modülde toplar. |
| `kotaKontrol.ts` | TypeScript / Lib | C-Club kapsamında `aylikKotaKontrol`, `aliciAylikKontrol`, `karsiliklilikKilidi` işlev ve sabitlerini sağlar; kota Kontrol iş kurallarını tek modülde toplar. |
| `sabitler.ts` | TypeScript / Lib | C-Club kapsamında `AYLIK_MAX_GONDERIM`, `ccGondermePuani`, `ccReferralPuani`, `ccPuanSabitleri` işlev ve sabitlerini sağlar; sabitler iş kurallarını tek modülde toplar. |
| `tekrarIzlemeKontrol.ts` | TypeScript / Lib | C-Club kapsamında `tekrarIzlemeKontrol` işlev ve sabitlerini sağlar; tekrar Izleme Kontrol iş kurallarını tek modülde toplar. |
| `tipler.ts` | TypeScript / Lib | C-Club kapsamında `ChallengeOlusturParams`, `ReferralPuaniParams`, `KotaSonuc` veri sözleşmelerini sağlar; tipler iş kurallarını tek modülde toplar. |
| `uygunAliciListesi.ts` | TypeScript / Lib | C-Club kapsamında `uygunAliciListesi` işlev ve sabitlerini sağlar; uygun Alici Listesi iş kurallarını tek modülde toplar. |
| `uygunVideoListesi.ts` | TypeScript / Lib | C-Club kapsamında `uygunVideoListesi` işlev ve sabitlerini sağlar; uygun video Listesi iş kurallarını tek modülde toplar. |

### 📁 lib/cclub/izleme/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `baslat.ts` | TypeScript / Lib | C-Club kapsamında `izlemeBaslat` işlev ve sabitlerini sağlar; başlatma iş kurallarını tek modülde toplar. |
| `extraKontrol.ts` | TypeScript / Lib | C-Club kapsamında `CC_EXTRA_TEKRAR_ESIGI`, `dahaOnceTamamlandiMi` işlev ve sabitlerini sağlar; extra Kontrol iş kurallarını tek modülde toplar. |

### 📁 lib/cclub/puan/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `kayip.ts` | TypeScript / Lib | C-Club kapsamında `ileriSarmaKaybiKaydet`, `yanlisCevapKaybiKaydet` işlev ve sabitlerini sağlar; kayip iş kurallarını tek modülde toplar. |
| `kazanim.ts` | TypeScript / Lib | C-Club kapsamında `izlemePuaniKaydet`, `cevapPuaniKaydet`, `extraPuaniKaydet`, `ccGondermePuaniKaydet` işlev ve sabitlerini sağlar; kazanim iş kurallarını tek modülde toplar. |

### 📁 lib/eclub/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `aktifYayinYetkisi.ts` | TypeScript / Lib | E-Club kapsamında `eclubAktifYayinYetkisi` işlev ve sabitlerini sağlar; aktif yayın Yetkisi iş kurallarını tek modülde toplar. |
| `gonderiAyarlari.ts` | TypeScript / Lib | E-Club kapsamında `ECLUB_GONDERI_AYARLARI`, `ECLUB_GONDERI_AYAR_ANAHTARLARI`, `eclubGonderiAyariMi`, `eclubGonderiAyariVarsayilani` işlev ve sabitlerini ve `EclubGonderiAyariAnahtari` veri sözleşmelerini sağlar; gonderi Ayarlari iş kurallarını tek modülde toplar. |
| `ileriSarma.ts` | TypeScript / Lib | E-Club kapsamında `eclubIleriSarmaKonumuDogrula`, `eclubIleriSarmaKaybiHesapla` işlev ve sabitlerini ve `EclubIleriSarmaKonumu` veri sözleşmelerini sağlar; ileri Sarma iş kurallarını tek modülde toplar. |
| `izlemeKurali.ts` | TypeScript / Lib | E-Club kapsamında `eclubOneriDurumu`, `eclubIzlemeHaklari`, `eclubSoruIndeksleri` işlev ve sabitlerini ve `EclubOneriDurumu` veri sözleşmelerini sağlar; izleme Kurali iş kurallarını tek modülde toplar. |
| `kisiErisim.ts` | TypeScript / Lib | E-Club kapsamında `eclubKisiModulDurumu`, `eclubKisiErisimi` işlev ve sabitlerini ve `EclubKisiErisimSonucu` veri sözleşmelerini sağlar; kişi erişim iş kurallarını tek modülde toplar. |
| `ligPeriyot.ts` | TypeScript / Lib | E-Club kapsamında `eclubLigPeriyoduParse` işlev ve sabitlerini sağlar; lig Periyot iş kurallarını tek modülde toplar. |
| `oneriKapsam.ts` | TypeScript / Lib | E-Club kapsamında `eclubYayinKapsamindaMi` işlev ve sabitlerini ve `EclubUttYayinKapsami`, `EclubYayinKapsami` veri sözleşmelerini sağlar; öneri Kapsam iş kurallarını tek modülde toplar. |
| `oneriLimit.ts` | TypeScript / Lib | E-Club kapsamında `eclubOneriGecerlilikGun`, `eclubAyniVideoTekrarBeklemeGun`, `oneriBitisHesapla`, `ayniAracTekrarAcikZamani` işlev ve sabitlerini ve `AyniAracTekrarEngeli`, `AyniAracTekrarSonuc` veri sözleşmelerini sağlar; öneri Limit iş kurallarını tek modülde toplar. |
| `rapor.ts` | TypeScript / Lib | E-Club lig sıralamalarını, eczane bazlı izlenme dökümlerini ve ciro etki metriklerini derleyen rapor motoru. |
| `testGln.ts` | TypeScript / Lib | E-Club kapsamında `TEST_GLN_PREFIX`, `TEST_GLN_UZUNLUK`, `TEST_GLN_TEK_SEFER_UST_SINIR`, `TEST_TEMIZLIK_ONAYI` işlev ve sabitlerini sağlar; test Gln iş kurallarını tek modülde toplar. |
| `uttEczane.ts` | TypeScript / Lib | E-Club kapsamında `uttEczaneFirmaBaglari`, `uttEczaneYetkisiVarMi` işlev ve sabitlerini sağlar; UTT eczane iş kurallarını tek modülde toplar. |
| `yonetimKapsami.ts` | TypeScript / Lib | UTT, BM, TM ve yöneticilerin E-Club hiyerarşik görme yetkilerini belirleyen kapsam motoru. |

### 📁 lib/eclub/store/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `eclubStoreBakiye.ts` | TypeScript / Lib | E-Club Store kapsamında `eclubStoreFirmaBakiye`, `eclubStoreToplamBakiye` işlev ve sabitlerini sağlar; E-Club Store Bakiye iş kurallarını tek modülde toplar. |
| `eclubStoreSiparis.ts` | TypeScript / Lib | Çok-firmalı E-Club puan birleştirme algoritmasını işleten ve kademeli firma puanı düşümünü yöneten sipariş motoru. |
| `eclubStoreStorage.ts` | TypeScript / Lib | E-Club Store kapsamında `eclubStoreGorselYukle`, `eclubStoreGorselSil` işlev ve sabitlerini sağlar; E-Club Store Storage iş kurallarını tek modülde toplar. |
| `eclubStoreTipler.ts` | TypeScript / Lib | E-Club Store kapsamında `EclubStoreKategori`, `EclubStoreUrun`, `EclubStoreAdres` veri sözleşmelerini sağlar; E-Club Store Tipler iş kurallarını tek modülde toplar. |
| `ekipSiparis.ts` | TypeScript / Lib | E-Club Store kapsamında `ECLUB_SIPARIS_DURUMLARI`, `ECLUB_SIPARIS_DURUM_ETIKETLERI`, `ECLUB_SIPARIS_DURUM_RENKLERI` işlev ve sabitlerini ve `EclubSiparisDurum`, `EclubSiparisAdresSnapshot`, `EclubEkipSiparisSatiri` veri sözleşmelerini sağlar; ekip sipariş iş kurallarını tek modülde toplar. |

### 📁 lib/eczanem/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `aktifUyelik.ts` | TypeScript / Lib | Eczanem kapsamında `aktifEczaneUyeliginiDogrula`, `aktifGonderimUyeliginiDogrula` işlev ve sabitlerini ve `AktifUyelikSonucu` veri sözleşmelerini sağlar; aktif Uyelik iş kurallarını tek modülde toplar. |
| `dokum.ts` | TypeScript / Lib | Eczanem kapsamında `UrunToplam`, `EczaneDokum`, `EczaneUrunSatir` veri sözleşmelerini sağlar; döküm iş kurallarını tek modülde toplar. |
| `eclubUyesiKontrol.ts` | TypeScript / Lib | Eczanem kapsamında `ECLUB_UYESI_MUSTERI_OLAMAZ_MESAJI`, `ECZANEM_MUSTERISI_ECLUB_UYESI_OLAMAZ_MESAJI`, `eclubTelefonVaryantlari`, `eclubUyesiTelefonMu` işlev ve sabitlerini sağlar; E-Club Uyesi Kontrol iş kurallarını tek modülde toplar. |
| `eczaci.ts` | TypeScript / Lib | Eczanem kapsamında `eczaciAktifEczanesi` işlev ve sabitlerini sağlar; eczaci iş kurallarını tek modülde toplar. |
| `erisim.ts` | TypeScript / Lib | Eczanem kapsamında `ECZANEM_KAPALI_MESAJI`, `PASIFE_PUAN_KULLANIM_GUN`, `eczaneEczanemFirmaIdleri`, `uttEczanemErisimi` işlev ve sabitlerini ve `EczanemErisimSonucu` veri sözleşmelerini sağlar; erişim iş kurallarını tek modülde toplar. |
| `gonderim.ts` | TypeScript / Lib | Eczanem kapsamında `AKTIF_UYE_ESIGI_VARSAYILAN`, `aktifUyeEsigi`, `eczaneAdMap` işlev ve sabitlerini ve `UttEczanemYayin`, `UttEczanemEczane`, `UttEczanemVeri` veri sözleşmelerini sağlar; gönderim iş kurallarını tek modülde toplar. |
| `kasa.ts` | TypeScript / Lib | Eczane kasasında indirim tutarını ve barkod karşılığını hesaplayan, atomik onayda puanı düşen kasa motoru. |
| `oturum.ts` | TypeScript / Lib | Eczanem kapsamında `musteriKimligi` işlev ve sabitlerini sağlar; oturum iş kurallarını tek modülde toplar. |
| `silme.ts` | TypeScript / Lib | KVKK uyumlu müşteri tam silme (Right to be Forgotten) ve hesap kapatma işlemlerini atomik yürüten motor. |
| `tarife.ts` | TypeScript / Lib | Eczanem kapsamında `guncelTarife`, `tarifeVeBarkodYaz` işlev ve sabitlerini ve `TarifeGiris`, `TarifeSonuc`, `GuncelTarife` veri sözleşmelerini sağlar; tarife iş kurallarını tek modülde toplar. |
| `telefon.ts` | TypeScript / Lib | Eczanem kapsamında `telefonNormalize` işlev ve sabitlerini sağlar; telefon iş kurallarını tek modülde toplar. |

### 📁 lib/etkilesim/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `yayinYetkisi.ts` | TypeScript / Lib | HapBilgi kapsamında `etkilesimYayinYetkisi` işlev ve sabitlerini sağlar; yayın Yetkisi iş kurallarını tek modülde toplar. |

### 📁 lib/firma/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `kolonlar.ts` | TypeScript / Lib | HapBilgi kapsamında `FIRMA_KOLONLARI` işlev ve sabitlerini sağlar; kolonlar iş kurallarını tek modülde toplar. |

### 📁 lib/bi/

| Dosya Adı | Türü | İşlevi |
|---|:---:|---|
| `erisim.ts` | TypeScript | bi'nin kullanılabildiği kimlik türünü ve iç rol gruplarını tanımlar. |
| `normalizasyon.ts` | TypeScript | Soru metnini Türkçe küçük harf, noktalama ve boşluk kurallarıyla ortak biçime getirir. |
| `nedir.ts` | TypeScript | Onaylı kavram kataloğunu ve kesin NEDİR soru kalıplarını tanımlar. |
| `kac.ts` | TypeScript | Kişisel T-Club net puanı için kesin KAÇ kalıplarını, Türkiye dönemini ve kanonik veri okumasını tanımlar. |
| `geminiJson.ts` | TypeScript | Puan ve üretici sorgularının ortak yapılandırılmış Gemini bağlantısını yürütür. |
| `geminiUretici.ts` | TypeScript | Üretici sayı sorularını ölçüt, eğitim, araç ve zaman alanlarına çözümler. |
| `ureticiSozlesmesi.ts` | TypeScript | Üretici ölçütlerini, İK başlangıç kapsamını ve bağlam doğrulamasını tanımlar. |
| `ureticiVeri.ts` | TypeScript | Kişisel talep, üretim durumu ve yayın sayılarını yetkili kayıtlardan okur. |
| `ureticiYanit.ts` | TypeScript | Üretici sayımlarını tarih, filtre ve karşılaştırmayla yanıtlar. |
| `cevapKatalogu.ts` | TypeScript | Ortak ve farklı onaylı metinlerin tek kaynağı; ortak yönlendirme metni. |
| `rolCevaplari.ts` | TypeScript | Rol ailelerinin kullanacağı cevap kimlikleri. |
| `sayfalar.ts` | TypeScript | Tanım ve yönlendirme bağlantıları ile rol erişim seçimi. |

### 📁 lib/izleme/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `baslat.ts` | TypeScript / Lib | öğrenme takibi kapsamında `olayIdGecerliMi`, `baslatOlayIdGecerliMi`, `izlemeTuruBelirle`, `oynatmaBaslatilmaliMi` işlev ve sabitlerini ve `IzlemeTuru` veri sözleşmelerini sağlar; başlatma iş kurallarını tek modülde toplar. |
| `karar.ts` | TypeScript / Lib | öğrenme takibi kapsamında `soruHakkiBelirle`, `izlemeKazanimKarariBelirle`, `ileriSarmaKaybiHesapla`, `tamamlamaYeterliMi` işlev ve sabitlerini sağlar; karar iş kurallarını tek modülde toplar. |
| `puanZamani.ts` | TypeScript / Lib | öğrenme takibi kapsamında `izlemePuanZamaniAktifMi` işlev ve sabitlerini sağlar; puan Zamani iş kurallarını tek modülde toplar. |
| `tipler.ts` | TypeScript / Lib | öğrenme takibi kapsamında `SoruHakkiNedeni`, `SoruHakkiGirdisi`, `IzlemeKazanimGirdisi` veri sözleşmelerini sağlar; tipler iş kurallarını tek modülde toplar. |

### 📁 lib/kimlik/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `provizyon.ts` | TypeScript / Lib | kimlik ve oturum kapsamında `provizyonBaslat`, `provizyonDurumuYaz`, `authTelafisiYap` işlev ve sabitlerini ve `ProvizyonHedefi` veri sözleşmelerini sağlar; provizyon iş kurallarını tek modülde toplar. |

### 📁 lib/ogrenmeAraci/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `bayraklar.ts` | TypeScript / Lib | ortak öğrenme aracı kapsamında `ogrenmeAraciAcikMi`, `yayinAraciKullanimaAcikMi`, `ogrenmeAraciBayraklari` işlev ve sabitlerini sağlar; bayraklar iş kurallarını tek modülde toplar. |
| `bunnyStorage.ts` | TypeScript / Lib | ortak öğrenme aracı kapsamında `bunnyStorageOrtami`, `bunnyNesneYoluOlustur`, `bunnyPodcastDestekYoluOlustur`, `yuklemeYetkisiOlustur` işlev ve sabitlerini ve `YuklemeYetkisi` veri sözleşmelerini sağlar; Bunny Storage iş kurallarını tek modülde toplar. |
| `bunnyYuklemeIstemci.ts` | TypeScript / Lib | ortak öğrenme aracı kapsamında `hazirPodcastYukle`, `hazirGorselYukle`, `hazirFlipPdfYukle` işlev ve sabitlerini ve `YuklemeAsamasi`, `OgrenmeAraciYuklemeKontrolu` veri sözleşmelerini sağlar; Bunny yükleme Istemci iş kurallarını tek modülde toplar. |
| `etiketler.ts` | TypeScript / Lib | ortak öğrenme aracı kapsamında `OGRENME_ARACI_METINLERI`, `ogrenmeAraciMetinleri` işlev ve sabitlerini ve `OgrenmeAraciMetinleri` veri sözleşmelerini sağlar; etiketler iş kurallarını tek modülde toplar. |
| `izlemeSahibi.ts` | TypeScript / Lib | ortak öğrenme aracı kapsamında `ogrenmeAraciIzlemeSahibiniCoz` işlev ve sabitlerini ve `OgrenmeAraciIzlemeTablosu`, `OgrenmeAraciIzlemeSahibi` veri sözleşmelerini sağlar; izleme Sahibi iş kurallarını tek modülde toplar. |
| `oynatici.ts` | TypeScript / Lib | ortak öğrenme aracı kapsamında `OgrenmeAraciOynaticisi` veri sözleşmelerini sağlar; oynatici iş kurallarını tek modülde toplar. |
| `sha256Istemci.ts` | TypeScript / Lib | ortak öğrenme aracı kapsamında `dosyaSha256Parcali` işlev ve sabitlerini sağlar; sha256 Istemci iş kurallarını tek modülde toplar. |
| `sozlesme.ts` | TypeScript / Lib | ortak öğrenme aracı alanında kullanılan `ARAC_DOSYA_POLITIKASI`, `ogrenmeAraciTuruMu`, `yeniOgrenmeAraciTuruMu`, `dosyaBeyaniDogrula` veri tiplerini ve modüller arası sözleşmeleri tanımlar. |
| `sunucu.ts` | TypeScript / Lib | ortak öğrenme aracı kapsamında `VIDEO_ARACI`, `PODCAST_ARACI`, `GORSEL_ARACI` işlev ve sabitlerini ve `SureliAracIlerlemesi`, `GorselIlerlemesi`, `FlipPdfIlerlemesi` veri sözleşmelerini sağlar; sunucu iş kurallarını tek modülde toplar. |
| `tipler.ts` | TypeScript / Lib | ortak öğrenme aracı kapsamında `OGRENME_ARACI_TURLERI`, `YENI_OGRENME_ARACI_TURLERI` işlev ve sabitlerini ve `OgrenmeAraciTuru`, `YeniOgrenmeAraciTuru`, `OgrenmeAraciKaynagi` veri sözleşmelerini sağlar; tipler iş kurallarını tek modülde toplar. |
| `uretimAkisi.ts` | TypeScript / Lib | ortak öğrenme aracı kapsamında `ogrenmeAraciUretimAkisi` işlev ve sabitlerini ve `OgrenmeAraciUretimVaryanti`, `OgrenmeAraciUretimAkisi` veri sözleşmelerini sağlar; üretim Akisi iş kurallarını tek modülde toplar. |
| `yetki.ts` | TypeScript / Lib | ortak öğrenme aracı kapsamında `uretimAraciYetkisiniDogrula` işlev ve sabitlerini ve `UretimAraciYetkisi` veri sözleşmelerini sağlar; yetki iş kurallarını tek modülde toplar. |

### 📁 lib/push/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `abonelik.ts` | TypeScript / Lib | Web Push bildirimleri kapsamında `abonelikUpsert`, `abonelikPasifle`, `aktifAbonelikleriGetir` işlev ve sabitlerini sağlar; abonelik iş kurallarını tek modülde toplar. |
| `gonderici.ts` | TypeScript / Lib | Web Push bildirimleri kapsamında `pushGonder` işlev ve sabitlerini ve `PushHedefi` veri sözleşmelerini sağlar; gonderici iş kurallarını tek modülde toplar. |
| `icerik.ts` | TypeScript / Lib | Web Push bildirimleri kapsamında `icerikUret` işlev ve sabitlerini sağlar; icerik iş kurallarını tek modülde toplar. |
| `istemci.ts` | TypeScript / Lib | Web Push bildirimleri kapsamında `pushDestekliMi`, `mevcutIzin`, `aboneOlVeKaydet`, `aboneligiTazele` işlev ve sabitlerini ve `PushIzinDurumu` veri sözleşmelerini sağlar; istemci iş kurallarını tek modülde toplar. |
| `orkestrasyon.ts` | TypeScript / Lib | Web Push bildirimleri kapsamında `pushYayinla`, `pushYayinlaArkada`, `pushYayinlaEclubKisilereArkada`, `pushYayinlaEczanemMusterilereArkada` işlev ve sabitlerini sağlar; orkestrasyon iş kurallarını tek modülde toplar. |
| `tipler.ts` | TypeScript / Lib | Web Push bildirimleri kapsamında `TarayiciAboneligi`, `PushAbonelikKaydi`, `PushOlayTuru` veri sözleşmelerini sağlar; tipler iş kurallarını tek modülde toplar. |

### 📁 lib/rapor/bm/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `getBmData.ts` | TypeScript / Lib | raporlama kapsamında `getBmData` işlev ve sabitlerini ve `BmUttPerformans`, `KullaniciOzetSatiri`, `KullaniciUrunDagilimi` veri sözleşmelerini sağlar; get Bm Data iş kurallarını tek modülde toplar. |
| `toplamlar.ts` | TypeScript / Lib | raporlama kapsamında `bosPuanToplami`, `ozetToplami`, `kategorileriTopla`, `urunleriTopla` işlev ve sabitlerini ve `PuanToplami` veri sözleşmelerini sağlar; toplamlar iş kurallarını tek modülde toplar. |

### 📁 lib/rapor/paylasilan/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `aracTuruDagilimi.ts` | TypeScript / Lib | raporlama kapsamında `aracTuruDagilimi` işlev ve sabitlerini ve `AracTuruRaporSatiri` veri sözleşmelerini sağlar; araç Turu Dagilimi iş kurallarını tek modülde toplar. |
| `bmPerformansTipleri.ts` | TypeScript / Lib | raporlama kapsamında `BmPerformans`, `BmUttPerformans`, `BmPerformansDetay` veri sözleşmelerini sağlar; bm Performans Tipleri iş kurallarını tek modülde toplar. |
| `oran.ts` | TypeScript / Lib | raporlama kapsamında `katkiYuzdesi`, `izlenmeOrani`, `tamamlanmaOrani` işlev ve sabitlerini sağlar; oran iş kurallarını tek modülde toplar. |

### 📁 lib/rapor/tm/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `getTmData.ts` | TypeScript / Lib | raporlama kapsamında `getTmData` işlev ve sabitlerini ve `TmEtkilesim` veri sözleşmelerini sağlar; get Tm Data iş kurallarını tek modülde toplar. |

### 📁 lib/rapor/uretici/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `getUreticiData.ts` | TypeScript / Lib | üretim kapsamında `getUreticiData` işlev ve sabitlerini ve `UreticiSahaOzetSatiri`, `UreticiRaporOzet`, `UreticiData` veri sözleşmelerini sağlar; get üretici Data iş kurallarını tek modülde toplar. |

### 📁 lib/rapor/uretim/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `getUretimData.ts` | TypeScript / Lib | üretim kapsamında `uretimRaporunuGorebilir`, `getUretimData` işlev ve sabitlerini sağlar; get üretim Data iş kurallarını tek modülde toplar. |

### 📁 lib/rapor/utt/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `getUttData.ts` | TypeScript / Lib | raporlama kapsamında `getUttData` işlev ve sabitlerini sağlar; get UTT Data iş kurallarını tek modülde toplar. |

### 📁 lib/rapor/yonetici/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `getYoneticiData.ts` | TypeScript / Lib | raporlama kapsamında `getYoneticiData` işlev ve sabitlerini sağlar; get yönetici Data iş kurallarını tek modülde toplar. |

### 📁 lib/rehber/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `sayfaRehberi.ts` | TypeScript / Lib | HapBilgi kapsamında `VARYANT_ALT_MODAL`, `SAYFA_REHBERLERI` işlev ve sabitlerini ve `AltModalKart`, `AltModalBilgisi`, `RehberMadde` veri sözleşmelerini sağlar; sayfa Rehberi iş kurallarını tek modülde toplar. |

### 📁 lib/soru/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `dosyadanGetir.ts` | TypeScript / Lib | soru seti kapsamında `DESTEKLENEN_UZANTILAR`, `dosyadanTaslaklar` işlev ve sabitlerini ve `DosyaGetirmeSonucu` veri sözleşmelerini sağlar; dosyadan Getir iş kurallarını tek modülde toplar. |
| `kontrol.ts` | TypeScript / Lib | Kullanıcının gönderdiği cevap anahtarlarının atanan sorularla uyuşup uyuşmadığını doğrulayan güvenlik kontrolü. |
| `parse.ts` | TypeScript / Lib | soru seti kapsamında `parseSoruSeti`, `parseSoruSetiEsnek` işlev ve sabitlerini ve `Soru` veri sözleşmelerini sağlar; parse iş kurallarını tek modülde toplar. |
| `secim.ts` | TypeScript / Lib | İçerik havuzundan tohumlu Fisher-Yates algoritmasıyla deterministik ve adil soru seçimi yapan çekirdek kütüphane. |
| `taslak.ts` | TypeScript / Lib | soru seti kapsamında `SECENEK_HARF`, `harfBul`, `bosSoruTaslagi`, `taslaklariDogrula` işlev ve sabitlerini ve `SoruTaslagi` veri sözleşmelerini sağlar; taslak iş kurallarını tek modülde toplar. |

### 📁 lib/supabase/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `client.ts` | TypeScript / Lib | İstemci tarafında (tarayıcı) çalışan Supabase anonim bağlantı istemcisi. |
| `server.ts` | TypeScript / Lib | Next.js Server Component ve Route Handler'lar için çerez tabanlı güvenli Supabase istemcisi. |

### 📁 lib/tclub/hbligi/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `getBmPerformans.ts` | TypeScript / Lib | T-Club kapsamında `getBmPerformans` işlev ve sabitlerini sağlar; get Bm Performans iş kurallarını tek modülde toplar. |
| `getSahaLig.ts` | TypeScript / Lib | T-Club kapsamında `getSahaLig` işlev ve sabitlerini ve `SahaGorunumu`, `SahaBirimTuru`, `SahaLigKullanici` veri sözleşmelerini sağlar; get Saha lig iş kurallarını tek modülde toplar. |
| `getUttLig.ts` | TypeScript / Lib | T-Club kapsamında `getUttLig` işlev ve sabitlerini ve `UttLigSatiri`, `UttLigSonuc` veri sözleşmelerini sağlar; get UTT lig iş kurallarını tek modülde toplar. |
| `ligRpcCagir.ts` | TypeScript / Lib | T-Club kapsamında `ligRpcCagir` işlev ve sabitlerini ve `Periyot`, `LigPeriyot`, `HbLigiHamSatir` veri sözleşmelerini sağlar; lig Rpc Cagir iş kurallarını tek modülde toplar. |
| `siralama.ts` | TypeScript / Lib | T-Club kapsamında `esitPuanEsitSira` işlev ve sabitlerini sağlar; siralama iş kurallarını tek modülde toplar. |

### 📁 lib/tclub/oneri/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `limitKontrol.ts` | TypeScript / Lib | T-Club kapsamında `MAKS_ALICI_HAFTA`, `AYLIK_KOTA_KATSAYI`, `haftalikLimitKontrol`, `aylikKotaKontrol` işlev ve sabitlerini ve `HaftalikLimitSonuc`, `AylikKotaSonuc` veri sözleşmelerini sağlar; limit Kontrol iş kurallarını tek modülde toplar. |
| `pencereKontrol.ts` | TypeScript / Lib | T-Club kapsamında `oneriPenceresiAcik` işlev ve sabitlerini ve `OneriPencereSonuc` veri sözleşmelerini sağlar; pencere Kontrol iş kurallarını tek modülde toplar. |
| `tarihKurali.ts` | TypeScript / Lib | T-Club kapsamında `ONERI_BASLANGIC_SAAT`, `ONERI_BITIS_SAAT`, `oneriTarihKurali` işlev ve sabitlerini ve `TarihKuraliSonuc` veri sözleşmelerini sağlar; tarih Kurali iş kurallarını tek modülde toplar. |

### 📁 lib/tclub/puan/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `kayit.ts` | TypeScript / Lib | T-Club kapsamında `kazanilanPuanKaydet`, `yanlisCevapKaybiKaydet`, `ileriSarmaKaybiKaydet`, `oneriKaybiKaydet` işlev ve sabitlerini sağlar; kayıt iş kurallarını tek modülde toplar. |
| `strateji.ts` | TypeScript / Lib | T-Club kapsamında `izlemeKarariBelirle`, `EXTRA_PUAN_TEKRAR_ESIGI`, `extraPuanEsikKarsilandi` işlev ve sabitlerini ve `IzlemeKarari` veri sözleşmelerini sağlar; strateji iş kurallarını tek modülde toplar. |
| `tekrarSayim.ts` | TypeScript / Lib | T-Club kapsamında `tamTekrarSayisi`, `tamTekrarSayilari` işlev ve sabitlerini sağlar; tekrar Sayim iş kurallarını tek modülde toplar. |
| `tipler.ts` | TypeScript / Lib | T-Club kapsamında `PuanTuru`, `KazanilanPuanParams`, `YanlisCevapKayipParams` veri sözleşmelerini sağlar; tipler iş kurallarını tek modülde toplar. |

### 📁 lib/tclub/store/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `adres.ts` | TypeScript / Lib | T-Club kapsamında `adresleriListele`, `adresEkle`, `adresGuncelle`, `adresSil` işlev ve sabitlerini sağlar; adres iş kurallarını tek modülde toplar. |
| `bakiye.ts` | TypeScript / Lib | T-Club kapsamında `harcamaBakiyesi` işlev ve sabitlerini sağlar; bakiye iş kurallarını tek modülde toplar. |
| `firmaUrun.ts` | TypeScript / Lib | T-Club kapsamında `firmaIcinUrunAktifMi`, `hbstoreFirmaBaglami`, `firmaKapaliUrunIdleri` işlev ve sabitlerini ve `HbstoreFirmaBaglami` veri sözleşmelerini sağlar; firma ürün iş kurallarını tek modülde toplar. |
| `kargo.ts` | TypeScript / Lib | T-Club kapsamında `KARGO_FIRMALARI`, `KARGO_FIRMA_ADLARI`, `kargoTakipUrl` işlev ve sabitlerini sağlar; kargo iş kurallarını tek modülde toplar. |
| `olay.ts` | TypeScript / Lib | T-Club kapsamında `HBSTORE_BAKIYE_DEGISTI`, `hbstoreBakiyesiDegistiBildir` işlev ve sabitlerini sağlar; olay iş kurallarını tek modülde toplar. |
| `sabitler.ts` | TypeScript / Lib | T-Club kapsamında `IPTAL_SURE_SAATI`, `STOK_AZ_ESIK`, `DURUM_ETIKETLERI`, `DURUM_RENKLERI` işlev ve sabitlerini sağlar; sabitler iş kurallarını tek modülde toplar. |
| `siparis.ts` | TypeScript / Lib | T-Club kapsamında `siparisOlustur`, `siparisIptal`, `teslimAldim` işlev ve sabitlerini sağlar; sipariş iş kurallarını tek modülde toplar. |
| `storage.ts` | TypeScript / Lib | T-Club kapsamında `gorselYukle`, `gorselSil`, `urlDenYolCikar` işlev ve sabitlerini ve `YuklemeSonuc`, `SilmeSonuc` veri sözleşmelerini sağlar; storage iş kurallarını tek modülde toplar. |
| `tipler.ts` | TypeScript / Lib | T-Club kapsamında `KayitSonuc`, `SiparisDurum`, `HarcamaTuru` veri sözleşmelerini sağlar; tipler iş kurallarını tek modülde toplar. |

### 📁 lib/tclub/tur/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `ayarlar.ts` | TypeScript / Lib | T-Club kapsamında `tekrarPeriyotSecenekleri` işlev ve sabitlerini sağlar; ayarlar iş kurallarını tek modülde toplar. |
| `kayit.ts` | TypeScript / Lib | T-Club kapsamında `TurAcilisTuru`, `TurKaydiParams`, `TurKaydiSonuc` veri sözleşmelerini sağlar; kayıt iş kurallarını tek modülde toplar. |

### 📁 lib/types/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `rapor.ts` | TypeScript / Lib | raporlama kapsamında `Bolge`, `Takim`, `UrunIzleme` veri sözleşmelerini sağlar; rapor iş kurallarını tek modülde toplar. |

### 📁 lib/uretici/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `talepKaynakSahipligi.ts` | TypeScript / Lib | üretim kapsamında `teknikFirmayaAitMi`, `urunFirmayaAitMi` işlev ve sabitlerini sağlar; talep kaynak Sahipligi iş kurallarını tek modülde toplar. |
| `urunKapsami.ts` | TypeScript / Lib | üretim kapsamında `ureticiUrunListeKapsami`, `ureticiUrunYazmaKapsami` işlev ve sabitlerini ve `UreticiUrunProfili`, `UreticiUrunKapsami` veri sözleşmelerini sağlar; ürün Kapsami iş kurallarını tek modülde toplar. |
| `yetenekler.ts` | TypeScript / Lib | 13 üretici rolün içerik türü yetkilerini, ürün/teknik zorunluluklarını ve form kısıtlarını denetleyen anayasal kural motoru. |

### 📁 lib/uretim/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `gorevSozlesmesi.ts` | TypeScript / Lib | üretim alanında kullanılan `URETIM_GOREV_ASAMALARI`, `UretimGorevAsamasi`, `URETIM_GOREV_DURUMLARI`, `UretimGorevDurumu` veri tiplerini ve modüller arası sözleşmeleri tanımlar. |
| `gorevTipleri.ts` | TypeScript / Lib | üretim kapsamında `UretimGorevAsamasi`, `UretimGorevDurumu`, `UretimGorevTalebi` veri sözleşmelerini sağlar; görev Tipleri iş kurallarını tek modülde toplar. |
| `parametreKontrol.ts` | TypeScript / Lib | üretim kapsamında `hazirParametreKontrol` işlev ve sabitlerini sağlar; parametre Kontrol iş kurallarını tek modülde toplar. |
| `rpc.ts` | TypeScript / Lib | Üretim durum makinesini canlı Supabase RPC'lerine bağlayan çekirdek köprü. |
| `rpcTemel.ts` | TypeScript / Lib | üretim kapsamında `uuidGecerliMi`, `uretimRpcHttpDurumu` işlev ve sabitlerini sağlar; rpc Temel iş kurallarını tek modülde toplar. |
| `toastMesaj.ts` | TypeScript / Lib | 5 üretim aşamasındaki tüm onay ve devir işlemlerinde unvanlı ve iki parçalı toast mesajlarını üreten merkezi motor. |

### 📁 lib/utils/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `adminGirisKontrol.ts` | TypeScript / Lib | HapBilgi kapsamında `adminGirisKontrol` işlev ve sabitlerini sağlar; admin Giris Kontrol iş kurallarını tek modülde toplar. |
| `adSoyadBicimle.ts` | TypeScript / Lib | HapBilgi kapsamında `adSoyadBicimle`, `adSoyadCanliBicimle` işlev ve sabitlerini sağlar; ad Soyad Bicimle iş kurallarını tek modülde toplar. |
| `beniHatirla.ts` | TypeScript / Lib | HapBilgi kapsamında `beniHatirlaKaydet`, `oturumDusurulmeliMi`, `beniHatirlaTemizle` işlev ve sabitlerini sağlar; beni Hatirla iş kurallarını tek modülde toplar. |
| `bildirimOlustur.ts` | TypeScript / Lib | bildirim kapsamında `gonderenBildirimleriOkunduIsaretle`, `bildirimOlustur`, `cokluBildirimOlustur` işlev ve sabitlerini ve `BildirimSonucu` veri sözleşmelerini sağlar; bildirim Olustur iş kurallarını tek modülde toplar. |
| `eclubBildirim.ts` | TypeScript / Lib | HapBilgi kapsamında `eclubBildirimOlustur`, `eclubCokluBildirimOlustur` işlev ve sabitlerini sağlar; E-Club bildirim iş kurallarını tek modülde toplar. |
| `firmaAdiBicimle.ts` | TypeScript / Lib | HapBilgi kapsamında `firmaAdiBicimle` işlev ve sabitlerini sağlar; firma Adi Bicimle iş kurallarını tek modülde toplar. |
| `guvenliDosyaAdi.ts` | TypeScript / Lib | HapBilgi kapsamında `guvenliDosyaAdi` işlev ve sabitlerini sağlar; guvenli Dosya Adi iş kurallarını tek modülde toplar. |
| `hataIsle.ts` | TypeScript / Lib | Tüm API route handler'larında standart JSON hata formatı (sunucuHatasi, yetkiHatasi, validasyonHatasi) üreten merkezi hata yöneticisi. |
| `ortam.ts` | TypeScript / Lib | HapBilgi kapsamında `canliOrtamMi` işlev ve sabitlerini sağlar; ortam iş kurallarını tek modülde toplar. |
| `periyotAltKirilim.ts` | TypeScript / Lib | HapBilgi kapsamında `periyotAltKirilim` işlev ve sabitlerini ve `Dilim` veri sözleşmelerini sağlar; periyot Alt Kirilim iş kurallarını tek modülde toplar. |
| `raporUtils.ts` | TypeScript / Lib | Raporlama sayfalarında kullanılan puan formatlama, dönem etiketleri ve yüzde hesaplama fonksiyonları. |
| `rolCozucu.ts` | TypeScript / Lib | Oturum açan kullanıcının gerçek rolünü v_auth_kimlik_admin view'ı üzerinden tek kaynakta çözen yetkili fonksiyon. |
| `roller.ts` | TypeScript / Lib | Platformdaki tüm rol gruplarını (URETICI_ROLLER, STORE_ALABILEN_ROLLER, YONETICI_ROLLER vb.) tanımlayan tek anayasal kaynak. |
| `talepId.ts` | TypeScript / Lib | HapBilgi kapsamında `talepIdGoster` işlev ve sabitlerini sağlar; talep Id iş kurallarını tek modülde toplar. |
| `talepZinciri.ts` | TypeScript / Lib | HapBilgi kapsamında `TALEP_ALANLARI`, `haritalaTalep`, `talepBilgisiSenaryo`, `talepBilgisiVideo` işlev ve sabitlerini ve `TalepBilgisi`, `HamTalepKaydi` veri sözleşmelerini sağlar; talep Zinciri iş kurallarını tek modülde toplar. |
| `tarihAraligi.ts` | TypeScript / Lib | HapBilgi kapsamında `tarihAraligi` işlev ve sabitlerini sağlar; tarih Araligi iş kurallarını tek modülde toplar. |
| `uretimSeridi.ts` | TypeScript / Lib | HapBilgi kapsamında `adimlariCoz` işlev ve sabitlerini ve `AdimAnahtari`, `AdimHal`, `Adim` veri sözleşmelerini sağlar; üretim Seridi iş kurallarını tek modülde toplar. |
| `uretimZinciri.ts` | TypeScript / Lib | HapBilgi kapsamında `zincirHaritasi`, `asamaCoz` işlev ve sabitlerini ve `ZincirAsama`, `ZincirSatiri`, `ZincirDurumu` veri sözleşmelerini sağlar; üretim Zinciri iş kurallarını tek modülde toplar. |
| `yayinUrun.ts` | TypeScript / Lib | Yayın kaydından ürün ID'sini çözen ve tekilleştiren DRY yardımcı fonksiyonu. |

### 📁 lib/utils/anaSayfa/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `bm.ts` | TypeScript / Lib | HapBilgi kapsamında `getBmAnaSayfaVeri` işlev ve sabitlerini sağlar; bm iş kurallarını tek modülde toplar. |
| `iu.ts` | TypeScript / Lib | HapBilgi kapsamında `getIuAnaSayfaVeri` işlev ve sabitlerini ve `IsSatiri`, `IuAnaSayfaVeri` veri sözleşmelerini sağlar; iu iş kurallarını tek modülde toplar. |
| `iuDurumEsle.ts` | TypeScript / Lib | HapBilgi kapsamında `talepBazindaTekillestir` işlev ve sabitlerini ve `IuKategori` veri sözleşmelerini sağlar; iu durum Esle iş kurallarını tek modülde toplar. |
| `tm.ts` | TypeScript / Lib | HapBilgi kapsamında `getTmAnaSayfaVeri` işlev ve sabitlerini sağlar; tm iş kurallarını tek modülde toplar. |
| `uretici.ts` | TypeScript / Lib | HapBilgi kapsamında `getUreticiAnaSayfaVeri` işlev ve sabitlerini sağlar; üretici iş kurallarını tek modülde toplar. |
| `utt.ts` | TypeScript / Lib | HapBilgi kapsamında `getUttAnaSayfaVeri` işlev ve sabitlerini ve `VYayinSatiri` veri sözleşmelerini sağlar; UTT iş kurallarını tek modülde toplar. |
| `yonetici.ts` | TypeScript / Lib | HapBilgi kapsamında `getYoneticiAnaSayfaVeri` işlev ve sabitlerini sağlar; yönetici iş kurallarını tek modülde toplar. |

### 📁 lib/utils/durum/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `filtre.ts` | TypeScript / Lib | HapBilgi kapsamında `uretimDurumSirasi`, `ilkUretimDurumu`, `aktifUretimDurumuCoz` işlev ve sabitlerini ve `DurumSayimi` veri sözleşmelerini sağlar; filtre iş kurallarını tek modülde toplar. |
| `mesaj.ts` | TypeScript / Lib | HapBilgi kapsamında `DurumTopu`, `DurumRenk`, `DurumMesaji` veri sözleşmelerini sağlar; mesaj iş kurallarını tek modülde toplar. |

### 📁 lib/utils/senaryo/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `diffHesapla.ts` | TypeScript / Lib | HapBilgi kapsamında `senaryoDiffHesapla` işlev ve sabitlerini ve `SenaryoDiffTuru`, `SenaryoDiffParcasi` veri sözleşmelerini sağlar; diff Hesapla iş kurallarını tek modülde toplar. |
| `duzeltmeModeli.ts` | TypeScript / Lib | HapBilgi kapsamında `modelOlustur`, `yaziEkle`, `geriSil` işlev ve sabitlerini ve `DuzeltmeTur`, `DuzeltmeKarakter`, `DuzeltmeRun` veri sözleşmelerini sağlar; duzeltme Modeli iş kurallarını tek modülde toplar. |
| `gonderimKarari.ts` | TypeScript / Lib | HapBilgi kapsamında `gonderimKarari` işlev ve sabitlerini ve `SonSatirBilgisi`, `GonderimKarari` veri sözleşmelerini sağlar; gönderim Karari iş kurallarını tek modülde toplar. |

### 📁 lib/video/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `anaSayfaRaflari.ts` | TypeScript / Lib | video altyapısı kapsamında `RAF_LIMIT`, `anaSayfaRaflari` işlev ve sabitlerini ve `RafVideo` veri sözleşmelerini sağlar; ana sayfa Raflari iş kurallarını tek modülde toplar. |
| `anaSayfaVideolari.ts` | TypeScript / Lib | video altyapısı kapsamında `getAnaSayfaVideolari`, `getSahaAnaSayfaVideolari` işlev ve sabitlerini ve `AnaSayfaVideo`, `SahaAnaSayfaVideo` veri sözleşmelerini sağlar; ana sayfa Videolari iş kurallarını tek modülde toplar. |
| `bunnyTusIstemci.ts` | TypeScript / Lib | video altyapısı kapsamında `videoYuklemeOturumuGuncelle`, `bunnyTusYukle` işlev ve sabitlerini ve `BunnyVezneIzni` veri sözleşmelerini sağlar; Bunny Tus Istemci iş kurallarını tek modülde toplar. |
| `bunnyYukleme.ts` | TypeScript / Lib | Bunny Stream TUS API vezne modelini işleten; API anahtarı ifşa olmadan doğrudan CDN yükleme token'ı üreten video motoru. |
| `departman.ts` | TypeScript / Lib | video altyapısı kapsamında `DEPARTMAN_SIRA`, `DEPARTMAN_ETIKET`, `DEPARTMAN_RENK`, `departmanKey` işlev ve sabitlerini ve `DepartmanKey` veri sözleşmelerini sağlar; departman iş kurallarını tek modülde toplar. |
| `enBoyOrani.ts` | TypeScript / Lib | video altyapısı kapsamında `VARSAYILAN_ORAN`, `DIKEY_ESIGI`, `enBoyOrani`, `dikeyMi` işlev ve sabitlerini sağlar; en Boy Orani iş kurallarını tek modülde toplar. |
| `gorunurluk.ts` | TypeScript / Lib | video altyapısı kapsamında `gorunenTurler`, `kapsamGenisMi`, `tuketiciMi`, `videoBolumuVarMi` işlev ve sabitlerini sağlar; gorunurluk iş kurallarını tek modülde toplar. |
| `icerikTuru.ts` | TypeScript / Lib | video altyapısı kapsamında `TUR_BASLIK`, `TUR_SIRA`, `TUR_RAPOR_ADI`, `isIcerikTuru` işlev ve sabitlerini sağlar; icerik Turu iş kurallarını tek modülde toplar. |
| `islemeDurumu.ts` | TypeScript / Lib | video altyapısı kapsamında `SORGU_ARALIGI_SANIYE`, `SORGU_ARALIGI_MS`, `TAVAN_SANIYE` işlev ve sabitlerini ve `BunnySorguSonucu`, `IslemeDurumu`, `PollingKarari` veri sözleşmelerini sağlar; işleme Durumu iş kurallarını tek modülde toplar. |
| `thumbnail.ts` | TypeScript / Lib | video altyapısı kapsamında `thumbnailUrlUret` işlev ve sabitlerini sağlar; thumbnail iş kurallarını tek modülde toplar. |
| `uttVideoKategorileri.ts` | TypeScript / Lib | video altyapısı kapsamında `UTT_VIDEO_KATEGORILERI`, `uttVideoKategorisiBul` işlev ve sabitlerini sağlar; UTT video Kategorileri iş kurallarını tek modülde toplar. |
| `videoPlayer.ts` | TypeScript / Lib | video altyapısı kapsamında `detectProvider`, `bunnyEmbedUrl` işlev ve sabitlerini ve `VideoPlayer`, `Provider`, `PlayerJsInstance` veri sözleşmelerini sağlar; video Player iş kurallarını tek modülde toplar. |
| `yayindakiVideolar.ts` | TypeScript / Lib | video altyapısı kapsamında `getYayindakiVideolar` işlev ve sabitlerini ve `YayindakiVideo` veri sözleşmelerini sağlar; yayindaki videolar iş kurallarını tek modülde toplar. |

### 📁 lib/zaman/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `kontrol.ts` | TypeScript / Lib | Sistem genelindeki Gün, Hafta, Ay, Dönem ve Yıl başlangıç ve bitişlerini Kanonik Zaman Değerleri sözleşmesine ve Türkiye saat dilimine göre hesaplayan zaman motoru. |

## 8. COMPONENTS, HOOKS, TYPES VE YEREL ARAÇLAR

### 📁 components/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `DosyaGoruntuleListesi.tsx` | UI / React | Dosya Goruntule Listesi, HapBilgi kayıtlarını listeleyip yükleme, seçim veya filtreleme etkileşimlerini yönetir. |
| `DurumAnahtari.tsx` | UI / React | durum Anahtari, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `HataMesaji.tsx` | UI / React | Hata Mesaji, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `SenaryoDuzeltmeEditoru.tsx` | UI / React | senaryo Duzeltme Editoru, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `SenaryoMetniGoster.tsx` | UI / React | senaryo Metni Goster, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `SoruIceAktar.tsx` | UI / React | soru Ice Aktar, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `SoruSetiFormu.tsx` | UI / React | soru Seti Formu, HapBilgi işleminde gerekli soru seti girdilerini toplar ve kullanıcı doğrulamalarını görünür kılar. |

### 📁 components/ana-sayfa/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `BmAnaSayfa.tsx` | UI / React | Bm Ana sayfa, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `IuAnaSayfa.tsx` | UI / React | Iu Ana sayfa, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `SahaVideoRaflari.tsx` | UI / React | Saha video Raflari, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `TmAnaSayfa.tsx` | UI / React | Tm Ana sayfa, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `UreticiAnaSayfa.tsx` | UI / React | üretici Ana sayfa, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `UttAnaSayfa.tsx` | UI / React | UTT Ana sayfa, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `VideoBolumu.tsx` | UI / React | video Bolumu, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `YoneticiAnaSayfa.tsx` | UI / React | yönetici Ana sayfa, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |

### 📁 components/cc-ligi/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `CcChallengeListesi.tsx` | UI / React | Cc Challenge Listesi, C-Club kayıtlarını listeleyip yükleme, seçim veya filtreleme etkileşimlerini yönetir. |
| `CcLigiBanner.tsx` | UI / React | Cc Ligi Banner, C-Club ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `CcLigiPeriyotSecici.tsx` | UI / React | Cc Ligi Periyot Secici, C-Club ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `CcLigiTablosu.tsx` | UI / React | Cc Ligi Tablosu, C-Club verilerini sıralı tablo görünümünde ve ilgili kullanıcı eylemleriyle sunar. |
| `CcTakimLigAkordeonu.tsx` | UI / React | Cc takım lig Akordeonu, C-Club ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |

### 📁 components/challenge-club/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `CcVideoOynatici.tsx` | UI / React | Cc video Oynatici, ilgili öğrenme aracını gösteren ve C-Club ilerleme/tamamlama akışına bağlayan oynatıcı bileşenidir. |
| `ChallengeGonderPaneli.tsx` | UI / React | Challenge Gonder Paneli, C-Club kapsamındaki challenge gonder verilerini ve işlemlerini tek panelde birleştirir. |

### 📁 components/eclub/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `EclubKisiSayfa.tsx` | UI / React | E-Club kişi sayfa, E-Club ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `EclubYonetimHiyerarsisi.tsx` | UI / React | E-Club yönetim Hiyerarsisi, E-Club ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |

### 📁 components/grafik/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `EChart.tsx` | UI / React | EChart, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |

### 📁 components/hapbi/

| Dosya Adı | Türü | İşlevi |
|---|:---:|---|
| `HapbiChatModal.tsx` | UI / React | bi soru-cevap, kaynak ve sayfa bağlantılarını gösterir. |
| `HapbiMaskot.tsx` | UI / React | Yetkili kullanıcılara turuncu bi düğmesini gösterir. |
| `HapbiProvider.tsx` | UI / React | Mesaj listesini, sohbet açma/kapatma ve istek iptalini yönetir. |

### 📁 components/hbligi/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `HbLigiPeriyotSecici.tsx` | UI / React | Hb Ligi Periyot Secici, T-Club ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |

### 📁 components/hbligi/field/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `field.module.css` | Stil / CSS | T-Club görünümünün yerleşim, renk, tipografi ve responsive davranışlarını tanımlayan stil dosyasıdır. |
| `FieldLeaguePage.tsx` | UI / React | Field League Page, T-Club ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `TakimLigAkordeonu.tsx` | UI / React | takım lig Akordeonu, T-Club ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |

### 📁 components/hbligi/league/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `CompetitorComparison.tsx` | UI / React | Competitor Comparison, T-Club ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `LeadershipInsight.tsx` | UI / React | Leadership Insight, T-Club ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `LeadershipPath.tsx` | UI / React | Leadership Path, T-Club ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `LeadershipProfile.tsx` | UI / React | Leadership Profile, T-Club ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `LeadershipScore.tsx` | UI / React | Leadership Score, T-Club ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `league.module.css` | Stil / CSS | T-Club görünümünün yerleşim, renk, tipografi ve responsive davranışlarını tanımlayan stil dosyasıdır. |
| `LeagueHeader.tsx` | UI / React | League Header, T-Club ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `LeaguePage.tsx` | UI / React | League Page, T-Club ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `LeaguePodium.tsx` | UI / React | League Podium, T-Club ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `LeaguePosition.tsx` | UI / React | League Position, T-Club ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `ScoreComposition.tsx` | UI / React | Score Composition, T-Club ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `types.ts` | TypeScript / Lib | types, T-Club ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `util.ts` | TypeScript / Lib | util, T-Club ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |

### 📁 components/izle/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `VideoOynatici.tsx` | UI / React | video Oynatici, ilgili öğrenme aracını gösteren ve HapBilgi ilerleme/tamamlama akışına bağlayan oynatıcı bileşenidir. |

### 📁 components/liste/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `DahaFazlaGoster.tsx` | UI / React | Daha Fazla Goster, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `index.ts` | TypeScript / Lib | index, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `ListeArama.tsx` | UI / React | liste Arama, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `useListe.ts` | TypeScript / Lib | use liste, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |

### 📁 components/ogrenme-araci/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `FlipPdfOynatici.tsx` | UI / React | Flip Pdf Oynatici, ilgili öğrenme aracını gösteren ve ortak öğrenme aracı ilerleme/tamamlama akışına bağlayan oynatıcı bileşenidir. |
| `GorselOynatici.tsx` | UI / React | Dijital Broşür Oynatici, ilgili öğrenme aracını gösteren ve ortak öğrenme aracı ilerleme/tamamlama akışına bağlayan oynatıcı bileşenidir. |
| `OgrenmeAraciOnizleme.tsx` | UI / React | öğrenme Araci Onizleme, ortak öğrenme aracı ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `PodcastOynatici.tsx` | UI / React | Podcast Oynatici, ilgili öğrenme aracını gösteren ve ortak öğrenme aracı ilerleme/tamamlama akışına bağlayan oynatıcı bileşenidir. |
| `YarimYuklemeBildirimi.tsx` | UI / React | yarım yükleme Bildirimi, ortak öğrenme aracı ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |

### 📁 components/panel/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `BilgiSayfa.tsx` | UI / React | bilgi sayfa, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `MobilDrawer.tsx` | UI / React | mobil Drawer, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `panelNav.config.ts` | TypeScript / Lib | panel Nav, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `PanelNavbar.tsx` | UI / React | panel Navbar, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `SolListe.tsx` | UI / React | Sol liste, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |

### 📁 components/panel/bilgi/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `bilgi.module.css` | Stil / CSS | HapBilgi görünümünün yerleşim, renk, tipografi ve responsive davranışlarını tanımlayan stil dosyasıdır. |
| `BilgiSayfaCercevesi.tsx` | UI / React | bilgi sayfa Cercevesi, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `icerikler.ts` | TypeScript / Lib | icerikler, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `OgrenmeDongusu.tsx` | UI / React | öğrenme Dongusu, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `OgrenmeZinciri.tsx` | UI / React | öğrenme Zinciri, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |

### 📁 components/pill/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `AsamaPill.tsx` | UI / React | Asama Pill, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `DurumPill.tsx` | UI / React | durum Pill, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `HedefRolPill.tsx` | UI / React | Hedef rol Pill, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `index.ts` | TypeScript / Lib | index, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `Pill.tsx` | UI / React | Pill, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `TeknikPill.tsx` | UI / React | teknik Pill, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `VaryantPill.tsx` | UI / React | Varyant Pill, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |

### 📁 components/raporlar/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `BegeniFavoriListesi.tsx` | UI / React | beğeni favori Listesi, raporlama kayıtlarını listeleyip yükleme, seçim veya filtreleme etkileşimlerini yönetir. |
| `BmPerformansGorunumu.tsx` | UI / React | Bm Performans Gorunumu, raporlama ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `DagilimGrafik.tsx` | UI / React | Dagilim Grafik, raporlama ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `EczanemDokumBolumu.tsx` | UI / React | Eczanem döküm Bolumu, raporlama ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `OgrenmeAraciPerformansi.tsx` | UI / React | öğrenme Araci Performansi, raporlama ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `UrunKirilimPaneli.tsx` | UI / React | ürün Kirilim Paneli, raporlama kapsamındaki ürün kirilim verilerini ve işlemlerini tek panelde birleştirir. |

### 📁 components/rehber/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `SayfaRehberi.tsx` | UI / React | sayfa Rehberi, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |

### 📁 components/store/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `AdresModal.tsx` | UI / React | Adres Modal, HBStore kapsamındaki adres işlemini açılır pencerede yöneten React bileşenidir. |

### 📁 components/talep/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `TalepKlasorleri.tsx` | UI / React | talep Klasorleri, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |

### 📁 components/ui/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `alert-dialog.tsx` | UI / React | alert dialog, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `avatar.tsx` | UI / React | avatar, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `badge.tsx` | UI / React | badge, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `button.tsx` | UI / React | button, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `card.tsx` | UI / React | card, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `collapsible.tsx` | UI / React | collapsible, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `input.tsx` | UI / React | input, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `label.tsx` | UI / React | label, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `progress.tsx` | UI / React | progress, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `select.tsx` | UI / React | select, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `table.tsx` | UI / React | table, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `tooltip.tsx` | UI / React | tooltip, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `yenile-butonu.tsx` | UI / React | yenileme butonu, HapBilgi ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |

### 📁 components/uretim/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `UretimGorevListesi.tsx` | UI / React | üretim görev Listesi, üretim kayıtlarını listeleyip yükleme, seçim veya filtreleme etkileşimlerini yönetir. |

### 📁 components/video/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `useVideoEtkilesimKatmani.ts` | TypeScript / Lib | use video etkileşim Katmani, video altyapısı ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `UttVideoKarti.tsx` | UI / React | UTT video Karti, video altyapısı içindeki utt video bilgisini kart görünümü ve ilgili eylemlerle sunar. |
| `VideoCercevesi.tsx` | UI / React | video Cercevesi, video altyapısı ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |
| `VideoOnizleme.tsx` | UI / React | video Onizleme, video altyapısı ekranındaki ilgili bilgileri ve kullanıcı eylemlerini sunan React bileşenidir. |

### 📁 hooks/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `useBunnyIslemeDurumu.ts` | TypeScript / Lib | use Bunny Isleme Durumu hook'u, HapBilgi ekranlarının veri yükleme, durum ve kullanıcı eylemlerini ortaklaştırır. |
| `useOkunmamisIdler.ts` | TypeScript / Lib | use Okunmamis Idler hook'u, HapBilgi ekranlarının veri yükleme, durum ve kullanıcı eylemlerini ortaklaştırır. |
| `useRapor.ts` | TypeScript / Lib | use rapor hook'u, HapBilgi ekranlarının veri yükleme, durum ve kullanıcı eylemlerini ortaklaştırır. |
| `useUretimDurumFiltresi.ts` | TypeScript / Lib | use üretim durum Filtresi hook'u, HapBilgi ekranlarının veri yükleme, durum ve kullanıcı eylemlerini ortaklaştırır. |

### 📁 tools/eslint-rules/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `index.mjs` | Script / Node.js | index denetimini veya bakım işlemini komut satırından yürüten Node.js betiğidir. |

### 📁 types/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `auth.ts` | TypeScript / Lib | HapBilgi kapsamında `KimlikTuru`, `AuthKullanici` veri sözleşmelerini sağlar; kimlik doğrulama iş kurallarını tek modülde toplar. |

## 9. SCRİPTS, TEST VE ALTYAPI KATMANI

### 📁 infra/bunny/ogrenme-araci-upload/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `index.ts` | TypeScript / Lib | ortak öğrenme aracı kapsamında index iş akışının dahili yardımcılarını ve kurallarını uygular. |
| `package-lock.json` | Bağımlılık Kilidi | Bu alt projenin NPM bağımlılık ağını kesin sürüm ve bütünlük özetleriyle kilitler. |
| `package.json` | JSON / Yapılandırma | Bu alt projenin bağımlılıklarını ve çalıştırma/derleme komutlarını tanımlar. |
| `README.md` | Dokümantasyon | “Öğrenme Aracı Upload Edge Script” kapsamındaki kararları, planı veya doğrulama kayıtlarını tutan proje belgesidir. |
| `tsconfig.json` | JSON / Yapılandırma | Bu alt projenin TypeScript derleme ve modül çözümleme kurallarını tanımlar. |

### 📁 scripts/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `backfill-video-suresi.mjs` | Script / Node.js | backfill video suresi denetimini veya bakım işlemini komut satırından yürüten Node.js betiğidir. |
| `repair-eczanem-test-musteri-auth.mjs` | Script / Node.js | repair Eczanem test üye kimlik doğrulama denetimini veya bakım işlemini komut satırından yürüten Node.js betiğidir. |

### 📁 scripts/denetim/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `denetim-sonuc.json` | JSON / Yapılandırma | denetim sonuc için yapılandırma veya veri kaydıdır. |
| `denetle.cjs` | Script / Node.js | denetle denetimini veya bakım işlemini komut satırından yürüten Node.js betiğidir. |
| `hedef-roller-dogrula.cjs` | Script / Node.js | hedef roller doğrulama denetimini veya bakım işlemini komut satırından yürüten Node.js betiğidir. |
| `kod-tara.cjs` | Script / Node.js | kod tara denetimini veya bakım işlemini komut satırından yürüten Node.js betiğidir. |
| `kullanim.json` | JSON / Yapılandırma | kullanim için yapılandırma veya veri kaydıdır. |
| `ogrenme-araclari-bunny-canli-dogrula.mjs` | Script / Node.js | öğrenme araçları Bunny canli doğrulama denetimini veya bakım işlemini komut satırından yürüten Node.js betiğidir. |
| `ogrenme-araclari-faz2-dogrula.cjs` | Script / Node.js | öğrenme araçları faz2 doğrulama denetimini veya bakım işlemini komut satırından yürüten Node.js betiğidir. |
| `sema-cek.cjs` | Script / Node.js | sema cek denetimini veya bakım işlemini komut satırından yürüten Node.js betiğidir. |
| `sema.json` | JSON / Yapılandırma | sema için yapılandırma veya veri kaydıdır. |

### 📁 scripts/denetim/tutarlilik/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `calistir.cjs` | Script / Node.js | calistir denetimini veya bakım işlemini komut satırından yürüten Node.js betiğidir. |
| `td01-uretim-zinciri.sql` | SQL / Denetim | HapBilgi kapsamında td01 üretim zinciri için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar. |
| `td02-hedef-rol-gecerlilik.sql` | SQL / Denetim | HapBilgi kapsamında td02 hedef rol gecerlilik için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar. |
| `td03-rol-izleme-uyumu.sql` | SQL / Denetim | HapBilgi kapsamında td03 rol izleme uyumu için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar. |
| `td04-tur-tutarliligi.sql` | SQL / Denetim | HapBilgi kapsamında td04 tur tutarliligi için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar. |
| `td05-extra-tekligi.sql` | SQL / Denetim | HapBilgi kapsamında td05 extra tekligi için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar. |
| `td06-puansiz-pencere.sql` | SQL / Denetim | HapBilgi kapsamında td06 puansiz pencere için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar. |
| `td07-kazanim-kayip-simetrisi.sql` | SQL / Denetim | HapBilgi kapsamında td07 kazanim kayip simetrisi için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar. |
| `td08-eczanem-ledger.sql` | SQL / Denetim | HapBilgi kapsamında td08 Eczanem ledger için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar. |
| `td09-teklikler.sql` | SQL / Denetim | HapBilgi kapsamında td09 teklikler için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar. |
| `td10-kimlik-duzlemleri.sql` | SQL / Denetim | HapBilgi kapsamında td10 kimlik duzlemleri için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar. |
| `td11-rapor-lig-birebirligi.sql` | SQL / Denetim | HapBilgi kapsamında td11 rapor lig birebirligi için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar. |
| `td12-eczanem-grant-deseni.sql` | SQL / Denetim | HapBilgi kapsamında td12 Eczanem grant deseni için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar. |

### 📁 scripts/sql/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `admin_hiyerarsi_tekillik.sql` | SQL / DDL | HapBilgi kapsamında admin hiyerarşi tekillik için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `hiyerarsi_adi_anahtari`, `firmalar`, `firma_no_ata` veritabanı nesnelerini ele alır. |
| `cc_challenge_gonderim_guvenligi.sql` | SQL / DDL | HapBilgi kapsamında cc challenge gönderim guvenligi için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `cc_challenge_gonder` veritabanı nesnelerini ele alır. |
| `cc_izleme_cevap_guvenligi.sql` | SQL / DDL | HapBilgi kapsamında cc izleme cevap guvenligi için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `cc_izleme_kayitlari`, `cc_izleme_tamamla`, `cc_cevaplari_kaydet` veritabanı nesnelerini ele alır. |
| `cc_ligi_backfill.sql` | SQL / DDL | HapBilgi kapsamında cc ligi backfill için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar. |
| `cc_ligi_okuma.sql` | SQL / DDL | HapBilgi kapsamında cc ligi okuma için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `_cc_ligi_aralik`, `get_cc_ligi_aylik`, `get_cc_ligi_donemlik` veritabanı nesnelerini ele alır. |
| `cc_ligi_ozet.sql` | SQL / DDL | HapBilgi kapsamında cc ligi ozet için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `cc_ligi_ozet`, `cc_ligi_ozet_guncelle`, `trg_cc_ozet_kazanim` veritabanı nesnelerini ele alır. |
| `cc_ogrenme_araci_tamamlama.sql` | SQL / DDL | C-Club tamamlamasını dört araç türü için ortak kanıt, puan ve soru sözleşmesine geçirir. |
| `cc_ogrenme_araci_yayin_kimligi.sql` | SQL / DDL | C-Club challenge ve BM izleme kayıtlarına ortak yayın/araç kimliğini ekler. |
| `cc_yeni_puanlama_modeli.sql` | SQL / DDL | HapBilgi kapsamında cc yeni puanlama modeli için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `cc_challenge_gonder`, `cc_challenge_tamamlaninca_bildirim_kapat`, `trg_cc_challenge_tamamlaninca_bildirim_kapat` veritabanı nesnelerini ele alır. |
| `cc_yetkilendirme_guvenligi.sql` | SQL / DDL | HapBilgi kapsamında cc yetkilendirme guvenligi için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `cc_izleme_kayitlari`, `cc_kazanilan_puanlar`, `cc_ileri_sarma_kayitlari` veritabanı nesnelerini ele alır. |
| `challenge_kaybi_tara.sql` | SQL / DDL | HapBilgi kapsamında challenge kaybi tara için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `cc_challenge_tamamlaninca_bildirim_kapat`, `trg_cc_challenge_tamamlaninca_bildirim_kapat`, `challenge_kaybi_tara` veritabanı nesnelerini ele alır. |
| `eclub_ayni_video_tekrar_ayari.sql` | SQL / DDL | HapBilgi kapsamında E-Club ayni video tekrar ayari için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar. |
| `eclub_gonderi_limit_ayarlari.sql` | SQL / DDL | HapBilgi kapsamında E-Club gonderi limit ayarlari için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar. |
| `eclub_ileri_sarma_kurali.sql` | SQL / DDL | HapBilgi kapsamında E-Club ileri sarma kurali için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `eclub_ileri_sarma_kayitlari`, `eclub_ileri_sarma_kaydet`, `eclub_izleme_tamamla` veritabanı nesnelerini ele alır. |
| `eclub_izleme_suresi_snapshot.sql` | SQL / DDL | HapBilgi kapsamında E-Club izleme suresi snapshot için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `eclub_izleme_kayitlari`, `eclub_izleme_tamamla` veritabanı nesnelerini ele alır. |
| `eclub_izleme_tekillik.sql` | SQL / DDL | HapBilgi kapsamında E-Club izleme tekillik için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `eclub_izleme_kayitlari`, `eclub_yanlis_cevap_kayitlari`, `eclub_izleme_tamamla` veritabanı nesnelerini ele alır. |
| `eclub_kisi_unvanlari.sql` | SQL / DDL | HapBilgi kapsamında E-Club kişi unvanlari için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `eclub_kisiler` veritabanı nesnelerini ele alır. |
| `eclub_ogrenme_araci_tamamlama.sql` | SQL / DDL | E-Club tamamlamasını video, podcast, görsel ve Flip PDF kanıtlarına göre ortak yayın/arac kimliğiyle doğrular. |
| `eclub_ogrenme_araci_yayin_kimligi.sql` | SQL / DDL | E-Club önerilerini `yayin_id`, `arac_id` ve `arac_turu` ortak öğrenme aracı kimliğine geçirir. |
| `eclub_oneri_atomik_kaydet.sql` | SQL / DDL | HapBilgi kapsamında E-Club öneri atomik kaydet için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `eclub_oneri_atomik_kaydet` veritabanı nesnelerini ele alır. |
| `eclub_oneri_video_kimligi.sql` | SQL / DDL | HapBilgi kapsamında E-Club öneri video kimligi için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `eclub_oneri_kayitlari` veritabanı nesnelerini ele alır. |
| `eclub_store_aktif_uyelik_siparis_kapisi.sql` | SQL / DDL | HapBilgi kapsamında E-Club Store aktif uyelik sipariş kapisi için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `eclub_store_siparis_olustur` veritabanı nesnelerini ele alır. |
| `eclub_store_firma_urun_gorunurlugu.sql` | SQL / DDL | HapBilgi kapsamında E-Club Store firma ürün gorunurlugu için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `eclub_store_urun_firma_ayarlari`, `eclub_store_siparis_olustur` veritabanı nesnelerini ele alır. |
| `eclub_test_gln_kaynak.sql` | SQL / DDL | HapBilgi kapsamında E-Club test gln kaynak için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `eclub_eczane_master` veritabanı nesnelerini ele alır. |
| `eclub_test_veri_temizle.sql` | SQL / DDL | HapBilgi kapsamında E-Club test veri temizle için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `eclub_test_veri_islem` veritabanı nesnelerini ele alır. |
| `eclub_utt_eczane_uyeligi.sql` | SQL / DDL | HapBilgi kapsamında E-Club UTT eczane uyeligi için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `eclub_utt_eczane`, `eclub_utt_eczaneye_bagla`, `eclub_utt_eczaneden_cikar` veritabanı nesnelerini ele alır. |
| `eclub_video_begeni_favori.sql` | SQL / DDL | HapBilgi kapsamında E-Club video beğeni favori için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `eclub_video_begeniler`, `eclub_video_favoriler` veritabanı nesnelerini ele alır. |
| `eczanem_butunluk_paketi_on_kontrol.sql` | SQL / Denetim | HapBilgi kapsamında Eczanem butunluk paketi on kontrol için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar. |
| `eczanem_butunluk_paketi.sql` | SQL / DDL | HapBilgi kapsamında Eczanem butunluk paketi için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `hapbilgi_telefon_normalize`, `hapbilgi_kimlik_telefon_ayir_trg`, `trg_eclub_kisiler_telefon_ayir` veritabanı nesnelerini ele alır. |
| `eczanem_coklu_eczane_aktif_uyelik.sql` | SQL / DDL | HapBilgi kapsamında Eczanem coklu eczane aktif uyelik için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `eczanem_gonderimler`, `eczanem_izleme_aktif_uyelik_kapisi`, `eczanem_izleme_aktif_uyelik_trg` veritabanı nesnelerini ele alır. |
| `eczanem_eclub_kontrollu_gecis.sql` | SQL / DDL | HapBilgi kapsamında Eczanem E-Club kontrollu gecis için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `eczanem_eclub_gecis_talepleri`, `eczanem_eclub_gecis_kayitlari`, `eczanem_eclub_puan_kapanislari` veritabanı nesnelerini ele alır. |
| `eczanem_eczane_yonetim_paketi.sql` | SQL / DDL | HapBilgi kapsamında Eczanem eczane yönetim paketi için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `eczanem_personel_islemleri`, `eczanem_uyelikler`, `eczanem_siparisler` veritabanı nesnelerini ele alır. |
| `eczanem_izleme_cevap_guvenligi.sql` | SQL / DDL | HapBilgi kapsamında Eczanem izleme cevap guvenligi için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `eczanem_izleme_kayitlari`, `eczanem_izleme_tamamla`, `eczanem_cevaplari_kaydet` veritabanı nesnelerini ele alır. |
| `eczanem_musteri_auth_kapisi.sql` | SQL / DDL | HapBilgi kapsamında Eczanem üye kimlik doğrulama kapisi için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `eczanem_yeni_musteri_provizyonu_izli` veritabanı nesnelerini ele alır. |
| `eczanem_musteri_kendini_atomik_sil.sql` | SQL / DDL | HapBilgi kapsamında Eczanem üye kendini atomik silme için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `eczanem_musteri_kendini_tam_sil` veritabanı nesnelerini ele alır. |
| `eczanem_musteri_video_etkilesimleri.sql` | SQL / DDL | HapBilgi kapsamında Eczanem üye video etkilesimleri için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `eczanem_izleme_kayitlari`, `eczanem_video_begeniler`, `eczanem_video_favoriler` veritabanı nesnelerini ele alır. |
| `eczanem_ogrenme_araci_tamamlama.sql` | SQL / DDL | Eczanem müşteri tamamlamasını dört araç türü için ortak kanıt ve puan sözleşmesine geçirir. |
| `eczanem_ogrenme_araci_yayin_kimligi.sql` | SQL / DDL | UTT→eczane ve eczane→müşteri dağıtımlarına ortak yayın/araç kimliğini ekler. |
| `eczanem_utt_gonderim_atomik_on_kontrol.sql` | SQL / Denetim | HapBilgi kapsamında Eczanem UTT gönderim atomik on kontrol için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar. |
| `eczanem_utt_gonderim_atomik.sql` | SQL / DDL | HapBilgi kapsamında Eczanem UTT gönderim atomik için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `eczanem_utt_eczaneye_gonder` veritabanı nesnelerini ele alır. |
| `eczanem_uyelik_listeden_sil_atomik.sql` | SQL / DDL | HapBilgi kapsamında Eczanem uyelik listeden silme atomik için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `eczanem_uyelik_listeden_sil` veritabanı nesnelerini ele alır. |
| `get_bm_oneri_durumu_v1.sql` | SQL / DDL | HapBilgi kapsamında get bm öneri durumu v1 için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `get_bm_oneri_durumu_v1` veritabanı nesnelerini ele alır. |
| `get_bm_rapor_v2.sql` | SQL / DDL | HapBilgi kapsamında get bm rapor v2 için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `get_bm_rapor_ana_ozet_v2`, `get_bm_utt_performans_v2`, `get_bm_etkilesim_v2` veritabanı nesnelerini ele alır. |
| `get_bolge_bazli_grup.sql` | SQL / DDL | HapBilgi kapsamında get bölge bazli grup için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `get_bolge_bazli_grup` veritabanı nesnelerini ele alır. |
| `get_eclub_ligi_detay_aylik.sql` | SQL / DDL | HapBilgi kapsamında get E-Club ligi detay aylik için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `get_eclub_ligi_detay_aylik` veritabanı nesnelerini ele alır. |
| `get_eclub_ligi_detay_donemlik.sql` | SQL / DDL | HapBilgi kapsamında get E-Club ligi detay donemlik için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `get_eclub_ligi_detay_donemlik` veritabanı nesnelerini ele alır. |
| `get_eclub_ligi_detay_yillik.sql` | SQL / DDL | HapBilgi kapsamında get E-Club ligi detay yillik için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `get_eclub_ligi_detay_yillik` veritabanı nesnelerini ele alır. |
| `get_eclub_store_firma_bakiye.sql` | SQL / DDL | HapBilgi kapsamında get E-Club Store firma bakiye için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `get_eclub_store_firma_bakiye` veritabanı nesnelerini ele alır. |
| `get_eclub_utt_rapor.sql` | SQL / DDL | HapBilgi kapsamında get E-Club UTT rapor için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `get_eclub_utt_rapor` veritabanı nesnelerini ele alır. |
| `get_eclub_utt_siparisler.sql` | SQL / DDL | HapBilgi kapsamında get E-Club UTT siparişler için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `get_eclub_utt_siparisler` veritabanı nesnelerini ele alır. |
| `get_izle_videolari_firma.sql` | SQL / DDL | HapBilgi kapsamında get izleme videolari firma için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `get_izle_videolari` veritabanı nesnelerini ele alır. |
| `get_kullanici_kategori_dagilimi.sql` | SQL / DDL | HapBilgi kapsamında get kullanıcı kategori dagilimi için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `get_kullanici_kategori_dagilimi` veritabanı nesnelerini ele alır. |
| `get_kullanici_urun_dagilimi.sql` | SQL / DDL | HapBilgi kapsamında get kullanıcı ürün dagilimi için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `get_kullanici_urun_dagilimi` veritabanı nesnelerini ele alır. |
| `get_tm_bm_performans_v1.sql` | SQL / DDL | HapBilgi kapsamında get tm bm performans v1 için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `get_tm_bm_performans_v1` veritabanı nesnelerini ele alır. |
| `get_tm_oneri_durumu_v1.sql` | SQL / DDL | HapBilgi kapsamında get tm öneri durumu v1 için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `get_tm_oneri_durumu_v1` veritabanı nesnelerini ele alır. |
| `get_tm_rapor_v2.sql` | SQL / DDL | HapBilgi kapsamında get tm rapor v2 için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `get_tm_etkilesim_v2` veritabanı nesnelerini ele alır. |
| `get_uretici_rapor_ozet_v3.sql` | SQL / DDL | HapBilgi kapsamında get üretici rapor ozet v3 için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `get_uretici_rapor_ozet_v3` veritabanı nesnelerini ele alır. |
| `get_urun_from_yayin.sql` | SQL / DDL | HapBilgi kapsamında get ürün from yayın için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `get_urun_from_yayin` veritabanı nesnelerini ele alır. |
| `get_yonetici_egitim_turu_etkisi_v3.sql` | SQL / DDL | HapBilgi kapsamında get yönetici egitim turu etkisi v3 için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `get_yonetici_egitim_turu_etkisi_v3` veritabanı nesnelerini ele alır. |
| `get_yonetici_rapor_v2.sql` | SQL / DDL | HapBilgi kapsamında get yönetici rapor v2 için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `get_yonetici_rapor_ana_ozet_v2`, `get_yonetici_hiyerarsi_v2`, `get_yonetici_icerik_etkisi_v2` veritabanı nesnelerini ele alır. |
| `hapbi_analitik_cclub_v1.sql` | SQL / DDL | C-Club kişisel, takım ve firma kapsamını kişi×yayın ayrıntısında, ürün ve öğrenme aracı bağıyla tek yetki kontrollü analitik kaynaktan sunar. |
| `hapbi_analitik_eclub_v1.sql` | SQL / DDL | E-Club iç yönetim kapsamını UTT→eczane→kişi ve ürün zincirinde tek sorguda toplar; ileri sarma kaybını kazanımdan ayırarak gerçek net puanı üretir. |
| `hapbi_analitik_tclub_v1.sql` | SQL / DDL | T-Club kapsamını rol temelinde sunucuda çözüp puan defterlerini kişi×yayın ayrıntısında firma, takım, BM sorumluluğu ve ürün bağlarıyla döndürür. |
| `hapbi_analitik_uretim_v1.sql` | SQL / DDL | PM ailesi için takım, diğer üretici ve yönetici roller için firma kapsamında talep, üretim görevi ve yayın olaylarını tek analitik kaynaktan sunar. |
| `hbligi_v1_kaldir.sql` | SQL / DDL | HapBilgi kapsamında hbligi v1 kaldir için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar. |
| `hbligi_v2_backfill.sql` | SQL / DDL | HapBilgi kapsamında hbligi v2 backfill için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar. |
| `hbligi_v2_kopya.sql` | SQL / DDL | HapBilgi kapsamında hbligi v2 kopya için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `hb_ligi_v2`, `v_hbligi_sirali_v2`, `get_hb_ligi_aylik_v2` veritabanı nesnelerini ele alır. |
| `hbligi_v2_okuma.sql` | SQL / DDL | HapBilgi kapsamında hbligi v2 okuma için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `hb_ligi_v2`, `v_hbligi_sirali_v2`, `_hb_ligi_v2_aralik` veritabanı nesnelerini ele alır. |
| `hbligi_v2_ozet.sql` | SQL / DDL | HapBilgi kapsamında hbligi v2 ozet için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `hb_ligi_ozet_v2`, `hb_ligi_ozet_v2_guncelle` veritabanı nesnelerini ele alır. |
| `hbstore_bm_ekip_siparis_kapsami.sql` | SQL / DDL | HapBilgi kapsamında hbstore bm ekip sipariş kapsami için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `get_kapsamli_siparisler` veritabanı nesnelerini ele alır. |
| `hbstore_firma_urun_gorunurlugu.sql` | SQL / DDL | HapBilgi kapsamında hbstore firma ürün gorunurlugu için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `store_urun_firma_ayarlari`, `store_siparis_olustur` veritabanı nesnelerini ele alır. |
| `iu_coklu_atama_gorev_modeli.sql` | SQL / DDL | HapBilgi kapsamında iu coklu atama görev modeli için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `iu_urun_atamalari`, `iu_genel_atamalari`, `uretim_gorevleri` veritabanı nesnelerini ele alır. |
| `iu_coklu_atama_on_kontrol.sql` | SQL / Denetim | HapBilgi kapsamında iu coklu atama on kontrol için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar. |
| `iu_coklu_atama_rpc.sql` | SQL / DDL | HapBilgi kapsamında iu coklu atama rpc için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `uretim_islem_kayitlari`, `uretim_aktif_iu_dogrula`, `uretim_iu_talep_icin_uygun` veritabanı nesnelerini ele alır. |
| `ogrenme_araclari_faz2_on_kontrol.sql` | SQL / Denetim | HapBilgi kapsamında öğrenme araçları faz2 on kontrol için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar. |
| `ogrenme_araclari_faz2_ortak_omurga.sql` | SQL / DDL | HapBilgi kapsamında öğrenme araçları faz2 ortak omurga için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `ogrenme_araclari`, `ogrenme_araci_durumu`, `ogrenme_araci_puanlari` veritabanı nesnelerini ele alır. |
| `ogrenme_araclari_faz2_yayin_gorunumu.sql` | SQL / DDL | HapBilgi kapsamında öğrenme araçları faz2 yayın gorunumu için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `v_yayin_detay`, `v_yayin_kunye` veritabanı nesnelerini ele alır. |
| `ogrenme_araclari_faz2_yukleme_dogrulama_idempotent.sql` | SQL / DDL | HapBilgi kapsamında öğrenme araçları faz2 yükleme dogrulama idempotent için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `ogrenme_araci_depolama_temizleme_kuyrugu`, `ogrenme_araci_yukleme_dogrulama_kaydet` veritabanı nesnelerini ele alır. |
| `ogrenme_araclari_faz3_podcast_talep.sql` | SQL / DDL | HapBilgi kapsamında öğrenme araçları faz3 Podcast talep için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `talepler` veritabanı nesnelerini ele alır. |
| `ogrenme_araclari_faz3_podcast_uretim.sql` | SQL / DDL | HapBilgi kapsamında öğrenme araçları faz3 Podcast üretim için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `ogrenme_araclari`, `uretim_podcast_soru_zinciri_ac`, `uretim_podcast_dogrula` veritabanı nesnelerini ele alır. |
| `ogrenme_araclari_faz4_gorsel_uretim.sql` | SQL / DDL | HapBilgi kapsamında öğrenme araçları faz4 Dijital Broşür üretim için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `uretim_gorsel_dogrula`, `uretim_gorsel_uretici_karar_ver` veritabanı nesnelerini ele alır. |
| `ogrenme_araclari_faz5_flip_pdf_uretim.sql` | SQL / DDL | HapBilgi kapsamında öğrenme araçları faz5 flip pdf üretim için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `uretim_flip_pdf_dogrula`, `uretim_flip_pdf_uretici_karar_ver` veritabanı nesnelerini ele alır. |
| `ogrenme_araclari_faz6_rapor_arac_turu.sql` | SQL / DDL | HapBilgi kapsamında öğrenme araçları faz6 rapor araç turu için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `v_rapor_arac_turu_ozet` veritabanı nesnelerini ele alır. |
| `ogrenme_araclari_tamamlama_faz4_uretim_hatti.sql` | SQL / DDL | HapBilgi kapsamında öğrenme araçları tamamlama faz4 üretim hatti için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `uretim_gorevi_arac_esitle`, `uretim_talep_ilk_gorevini_ac`, `uretim_podcast_soru_zinciri_ac` veritabanı nesnelerini ele alır. |
| `ogrenme_araclari_tamamlama_faz6_hbstore_fonksiyon_teshis.sql` | SQL / Denetim | HapBilgi kapsamında öğrenme araçları tamamlama faz6 hbstore fonksiyon teshis için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar. |
| `ogrenme_araclari_tamamlama_faz6_hbstore_teshis.sql` | SQL / Denetim | HapBilgi kapsamında öğrenme araçları tamamlama faz6 hbstore teshis için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar. |
| `ogrenme_araclari_tamamlama_faz6_mutabakat.sql` | SQL / DDL | HapBilgi kapsamında öğrenme araçları tamamlama faz6 mutabakat için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar. |
| `ogrenme_araclari_tamamlama_faz6_puan_bagi_teshis.sql` | SQL / Denetim | HapBilgi kapsamında öğrenme araçları tamamlama faz6 puan bagi teshis için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar. |
| `ogrenme_araclari_tamamlama_faz6_puan_butunlugu.sql` | SQL / DDL | HapBilgi kapsamında öğrenme araçları tamamlama faz6 puan butunlugu için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `get_harcama_bakiyesi`, `ogrenme_puani_izleme_bagini_dogrula`, `trg_ogrenme_puani_bag_utt` veritabanı nesnelerini ele alır. |
| `ogrenme_araclari_tamamlama_faz6_puan_tekillik_mutabakat.sql` | SQL / DDL | HapBilgi kapsamında öğrenme araçları tamamlama faz6 puan tekillik mutabakat için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar. |
| `ogrenme_araclari_tamamlama_faz7_raporlama.sql` | SQL / DDL | HapBilgi kapsamında öğrenme araçları tamamlama faz7 raporlama için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `eczanem_cevap_kayitlari`, `eczanem_cevaplari_kaydet`, `v_rapor_arac_turu_ozet` veritabanı nesnelerini ele alır. |
| `oneri_kaybi_tara.sql` | SQL / DDL | HapBilgi kapsamında öneri kaybi tara için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `oneri_kaybi_tara` veritabanı nesnelerini ele alır. |
| `pm09_eczanem_yayin_durdurma_kapisi.sql` | SQL / DDL | HapBilgi kapsamında pm09 Eczanem yayın durdurma kapisi için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `eczanem_utt_eczaneye_gonder`, `eczanem_musterilere_video_gonder` veritabanı nesnelerini ele alır. |
| `puan_urun_opsiyonel.sql` | SQL / DDL | HapBilgi kapsamında puan ürün opsiyonel için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `kazanilan_puanlar`, `yanlis_cevap_kayitlari`, `ileri_sarma_kayitlari` veritabanı nesnelerini ele alır. |
| `push_tablolar.sql` | SQL / DDL | HapBilgi kapsamında Web Push tablolar için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `push_abonelikleri`, `push_gonderim_kayitlari` veritabanı nesnelerini ele alır. |
| `soru_kesinti_faz2_tamamla.sql` | SQL / DDL | HapBilgi kapsamında soru kesinti faz2 tamamlama için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `utt_izleme_tamamla`, `cc_izleme_tamamla`, `eclub_izleme_tamamla` veritabanı nesnelerini ele alır. |
| `soru_kesinti_faz5_cevap.sql` | SQL / DDL | HapBilgi kapsamında soru kesinti faz5 cevap için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `cc_cevaplari_kaydet`, `eclub_cevaplari_kaydet`, `eczanem_cevaplari_kaydet_cekirdek` veritabanı nesnelerini ele alır. |
| `soru_kesinti_kurali.sql` | SQL / DDL | HapBilgi kapsamında soru kesinti kurali için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `izleme_kayitlari`, `cc_izleme_kayitlari`, `eclub_izleme_kayitlari` veritabanı nesnelerini ele alır. |
| `talep_olusturma_idempotent.sql` | SQL / DDL | HapBilgi kapsamında talep olusturma idempotent için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `talepler`, `talep_atomik_olustur` veritabanı nesnelerini ele alır. |
| `talepler_hedef_rol_temizle.sql` | SQL / DDL | HapBilgi kapsamında talepler hedef rol temizle için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `talepler`, `v_yayin_detay`, `v_yayin_kunye` veritabanı nesnelerini ele alır. |
| `talepler_hedef_roller.sql` | SQL / DDL | HapBilgi kapsamında talepler hedef roller için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `talepler`, `talepler_hedef_roller_esitle`, `talepler_hedef_roller_esitle_trg` veritabanı nesnelerini ele alır. |
| `talepler_icerik_turu_urun_medikal.sql` | SQL / DDL | HapBilgi kapsamında talepler icerik turu ürün medikal için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `talepler` veritabanı nesnelerini ele alır. |
| `test_veri_sayim.sql` | SQL / DDL | HapBilgi kapsamında test veri sayim için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `test_veri_sayim` veritabanı nesnelerini ele alır. |
| `test_veri_temizle.sql` | SQL / DDL | HapBilgi kapsamında test veri temizle için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `test_veri_temizle` veritabanı nesnelerini ele alır. |
| `tm_bm_toplam_dogrulama.sql` | SQL / DDL | HapBilgi kapsamında tm bm toplam dogrulama için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar. |
| `tm_eski_rpc_bagimlilik_taramasi.sql` | SQL / DDL | HapBilgi kapsamında tm eski rpc bagimlilik taramasi için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar. |
| `tm_eski_rpc_kaldir.sql` | SQL / DDL | HapBilgi kapsamında tm eski rpc kaldir için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar. |
| `uretici_eski_nesne_bagimlilik_taramasi.sql` | SQL / DDL | HapBilgi kapsamında üretici eski nesne bagimlilik taramasi için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar. |
| `uretici_eski_nesne_kaldir.sql` | SQL / DDL | HapBilgi kapsamında üretici eski nesne kaldir için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar. |
| `uretici_rapor_v3_dogrulama.sql` | SQL / DDL | HapBilgi kapsamında üretici rapor v3 dogrulama için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar. |
| `uretim_atomik_rpc.sql` | SQL / DDL | HapBilgi kapsamında üretim atomik rpc için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `uretim_soru_seti_dogrula`, `uretim_senaryo_teslim_et`, `uretim_video_teslim_et` veritabanı nesnelerini ele alır. |
| `uretim_bildirim_guvenlik.sql` | SQL / DDL | HapBilgi kapsamında üretim bildirim güvenlik için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `bildirimler`, `uretim_gorevleri`, `uretim_gorev_atama_gecmisi` veritabanı nesnelerini ele alır. |
| `uretim_gorevleri_canli_gecis.sql` | SQL / DDL | HapBilgi kapsamında üretim gorevleri canli gecis için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `uretim_gorevleri` veritabanı nesnelerini ele alır. |
| `uretim_karar_surum_kapisi.sql` | SQL / DDL | HapBilgi kapsamında üretim karar surum kapisi için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `uretim_karar_surum_kapisi`, `uretim_uretici_karar_ver`, `uretim_podcast_uretici_karar_ver` veritabanı nesnelerini ele alır. |
| `utt_izleme_oturum_modeli_on_kontrol.sql` | SQL / Denetim | HapBilgi kapsamında UTT izleme oturum modeli on kontrol için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar. |
| `utt_izleme_oturum_modeli.sql` | SQL / DDL | HapBilgi kapsamında UTT izleme oturum modeli için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `izleme_kayitlari`, `ileri_sarma_kayitlari`, `videolar` veritabanı nesnelerini ele alır. |
| `utt_izleme_tamamla_rpc.sql` | SQL / DDL | HapBilgi kapsamında UTT izleme tamamlama rpc için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `utt_izleme_tamamla` veritabanı nesnelerini ele alır. |
| `v_rapor_begeni_favori_v3.sql` | SQL / DDL | HapBilgi kapsamında v rapor beğeni favori v3 için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `v_rapor_begeni_favori_v3` veritabanı nesnelerini ele alır. |
| `v_uretici_icerik_takip.sql` | SQL / DDL | HapBilgi kapsamında v üretici icerik takip için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `v_uretici_icerik_takip` veritabanı nesnelerini ele alır. |
| `v_yayin_detay_firma_id.sql` | SQL / DDL | HapBilgi kapsamında v yayın detay firma id için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `v_yayin_detay` veritabanı nesnelerini ele alır. |
| `v_yayin_detay_urun_adi_fallback.sql` | SQL / DDL | HapBilgi kapsamında v yayın detay ürün adi fallback için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `v_yayin_detay` veritabanı nesnelerini ele alır. |
| `v_yayin_detay_video_suresi.sql` | SQL / DDL | HapBilgi kapsamında v yayın detay video suresi için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `v_yayin_detay` veritabanı nesnelerini ele alır. |
| `v_yayin_kunye.sql` | SQL / DDL | HapBilgi kapsamında v yayın künye için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `v_yayin_kunye` veritabanı nesnelerini ele alır. |
| `yarim_ogrenme_araci_yuklemeleri.sql` | SQL / DDL | HapBilgi kapsamında yarım öğrenme araci yuklemeleri için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `ogrenme_araci_video_yukleme_oturumlari`, `ogrenme_araci_yarim_yukleme_iptal` veritabanı nesnelerini ele alır. |
| `yayin_aktivasyon.sql` | SQL / DDL | HapBilgi kapsamında yayın aktivasyon için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `yayin_planlananlari_aktive` veritabanı nesnelerini ele alır. |
| `yayin_oncesi_silme.sql` | SQL / DDL | HapBilgi kapsamında yayın oncesi silme için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `talepler`, `yayin_oncesi_silme_yayin_kapisi`, `trg_yayin_oncesi_silme_yayin_kapisi` veritabanı nesnelerini ele alır. |
| `yonetim_egitimleri_icerik_turu.sql` | SQL / DDL | HapBilgi kapsamında yönetim egitimleri icerik turu için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar; başlıca `talepler`, `iu_genel_atamalari`, `iu_genel_atamasi_ayarla` veritabanı nesnelerini ele alır. |

### 📁 scripts/sql/utt_izleme_on_kontrol/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `01_gecis_kapsami.sql` | SQL / Denetim | HapBilgi kapsamında 01 gecis kapsami için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar. |
| `02_kazanim_mukerrerleri.sql` | SQL / Denetim | HapBilgi kapsamında 02 kazanim mukerrerleri için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar. |
| `03_cevap_mukerrerleri.sql` | SQL / Denetim | HapBilgi kapsamında 03 cevap mukerrerleri için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar. |
| `04_kayip_mukerrerleri.sql` | SQL / Denetim | HapBilgi kapsamında 04 kayip mukerrerleri için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar. |
| `05_cevaplanmis_tamamlanmis.sql` | SQL / Denetim | HapBilgi kapsamında 05 cevaplanmis tamamlanmis için şema, veri bütünlüğü veya atomik işlem kurallarını tanımlar. |

### 📁 tests/

9 Eylül 2026 eklemesi: `biTemizlik.smoke.test.ts`, asistan temizliği için yerel API, yetki ve deterministik yanıt kontrollerini içerir.

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `_alias-hooks.mjs` | Test / Node.js | Node test çalıştırıcısında `@/` proje kökü alias'ını çözen ESM resolve ve load hook'larını tanımlar. |
| `_alias.mjs` | Test / Node.js | Smoke testler başlamadan önce TypeScript dönüşümünü ve `@/` alias çözümleyicisini kaydeden ön yükleme betiğidir. |
| `adminHiyerarsiTekillik.hedef.test.ts` | Test / TypeScript | “hiyerarşi adı yinelenen boşluklardan arındırılır” davranışını otomatik olarak doğrulayan hedef testidir. |
| `adminTopluPaketButunlugu.hedef.test.ts` | Test / TypeScript | “tek hatalı satır bütün paketi engeller” davranışını otomatik olarak doğrulayan hedef testidir. |
| `bmRaporToplamlari.smoke.test.ts` | Test / TypeScript | “mutlu: UTT özetleri ile aynı kategori ve ürün satırları bölge toplamına dönüşür” davranışını otomatik olarak doğrulayan smoke testidir. |
| `bunnyVideoSuresi.smoke.test.ts` | Test / TypeScript | “Bunny video süresi pozitif tam saniye olarak çözülür” davranışını otomatik olarak doğrulayan smoke testidir. |
| `ccChallengeGonderimGuvenligi.smoke.test.ts` | Test / TypeScript | “mutlu: challenge ile gönderme puanı tek atomik RPC içinde oluşturulur” davranışını otomatik olarak doğrulayan smoke testidir. |
| `ccChallengeYasamDongusu.smoke.test.ts` | Test / TypeScript | “mutlu: alıcı ve gönderici aynı challenge durumunu kullanır” davranışını otomatik olarak doğrulayan smoke testidir. |
| `ccIzlemeCevapGuvenligi.smoke.test.ts` | Test / TypeScript | “mutlu: C-Club tamamlama, soru, puan ve challenge sonucu atomik sözleşmeye bağlıdır” davranışını otomatik olarak doğrulayan smoke testidir. |
| `ccOgrenmeAraciYayinKimligi.smoke.test.ts` | Test / TypeScript | “C-Club challenge ve izleme kayıtları ortak araç kimliğini taşır” davranışını otomatik olarak doğrulayan smoke testidir. |
| `ccVeriKaynaklari.smoke.test.ts` | Test / TypeScript | “mutlu: CC özet ve backfill yalnız C-Club puan/kayıp tablolarını kullanır” davranışını otomatik olarak doğrulayan smoke testidir. |
| `ccYayinGirisi.smoke.test.ts` | Test / TypeScript | “mutlu: başlangıç videosu BM hedefi, firma ve geçerli yayın tarihleriyle süzülür” davranışını otomatik olarak doğrulayan smoke testidir. |
| `ccYetkilendirmeGuvenligi.smoke.test.ts` | Test / TypeScript | “mutlu: CC izleme kimliği oturumdan alınır ve firma erişimi doğrulanır” davranışını otomatik olarak doğrulayan smoke testidir. |
| `diffHesapla.smoke.test.ts` | Test / TypeScript | “mutlu: degisen kelime cikar+ekle, kalan ayni olarak ayristirilir” davranışını otomatik olarak doğrulayan smoke testidir. |
| `duzeltmeModeli.smoke.test.ts` | Test / TypeScript | “mutlu: silinen ustu cizili kalir, yazilan ekle olur, temiz metin dogru” davranışını otomatik olarak doğrulayan smoke testidir. |
| `eclubCokluUttUyelik.smoke.test.ts` | Test / TypeScript | “mutlu: aynı firmanın farklı UTT'leri tek kurumsal eczane bağında ayrı liste üyelikleri kurar” davranışını otomatik olarak doğrulayan smoke testidir. |
| `eclubGonderiAyarlari.smoke.test.ts` | Test / TypeScript | “E-Club gönderi ayarları iki pozitif tam sayı kuralını tek kaynaktan tanımlar” davranışını otomatik olarak doğrulayan smoke testidir. |
| `eclubGonderilecekVideolar.smoke.test.ts` | Test / TypeScript | “mutlu: öğrenme aracı önizlemesi dört araç türünü salt görüntüler” davranışını otomatik olarak doğrulayan smoke testidir. |
| `eclubIzlemeKurali.smoke.test.ts` | Test / TypeScript | “mutlu: aktif öneri puan ve soru hakkı verir; soru kümesi sabittir” davranışını otomatik olarak doğrulayan smoke testidir. |
| `eclubKisiErisim.smoke.test.ts` | Test / TypeScript | “mutlu: en az bir aktif bağlı firma E-Club, Store ve Eczanem erişimini açar” davranışını otomatik olarak doğrulayan smoke testidir. |
| `eclubKisiUnvanlari.smoke.test.ts` | Test / TypeScript | “E-Club eczacı unvanları eczacı hedef kitlesine bağlanır” davranışını otomatik olarak doğrulayan smoke testidir. |
| `eclubLigPeriyot.smoke.test.ts` | Test / TypeScript | “mutlu: haftalık ve dönemlik lig seçimlerini doğrular” davranışını otomatik olarak doğrulayan smoke testidir. |
| `eclubNav.smoke.test.ts` | Test / TypeScript | “UTT E-Club altında kararlaştırılan yönetim alanlarını doğru sırada görür” davranışını otomatik olarak doğrulayan smoke testidir. |
| `eclubOgrenmeAraciYayinKimligi.smoke.test.ts` | Test / TypeScript | “E-Club öneri kataloğu legacy video zinciri olmadan ortak araç kimliğini döndürür” davranışını otomatik olarak doğrulayan smoke testidir. |
| `eclubOneriKapsam.smoke.test.ts` | Test / TypeScript | “mutlu: UTT kendi takımının ve firma-geneli E-Club yayınını kullanabilir” davranışını otomatik olarak doğrulayan smoke testidir. |
| `eclubRapor.smoke.test.ts` | Test / TypeScript | “mutlu: içerik satırlarını eczane ve kişi düzeyinde kayıpsız toplar” davranışını otomatik olarak doğrulayan smoke testidir. |
| `eclubSiparis.smoke.test.ts` | Test / TypeScript | “mutlu: sipariş filtrelerini ve sayfalamayı doğrular” davranışını otomatik olarak doğrulayan smoke testidir. |
| `eclubStoreAktifUyelikSiparis.smoke.test.ts` | Test / TypeScript | “E-Club Store sipariş API'si pasif kişinin yeni siparişini reddeder” davranışını otomatik olarak doğrulayan smoke testidir. |
| `eclubTestGln.smoke.test.ts` | Test / TypeScript | “30 test GLN benzersiz, 13 haneli ve 111 önekli üretilir” davranışını otomatik olarak doğrulayan smoke testidir. |
| `eczanemAktifUyelikGonderim.smoke.test.ts` | Test / TypeScript | “mutlu: aynı yayın gönderim ve ilerleme durumunu eczane/gönderim ekseninde ayırır” davranışını otomatik olarak doğrulayan smoke testidir. |
| `eczanemButunlukPaketi.smoke.test.ts` | Test / TypeScript | “mutlu: firma kapısı, atomik provizyon, sipariş tekilliği ve tek-sorgu liste birlikte kurulur” davranışını otomatik olarak doğrulayan smoke testidir. |
| `eczanemCokluUyelik.smoke.test.ts` | Test / TypeScript | “mutlu: kayıtlı müşteri kimliği değiştirilmeden ikinci eczaneye bağlanır” davranışını otomatik olarak doğrulayan smoke testidir. |
| `eczanemEclubKontrolluGecis.smoke.test.ts` | Test / TypeScript | “mutlu: müşteri kararı ve aynı Auth hesabıyla atomik E-Club geçişi birlikte kurulur” davranışını otomatik olarak doğrulayan smoke testidir. |
| `eczanemEclubUyesiEngeli.smoke.test.ts` | Test / TypeScript | “mutlu: global E-Club kontrolü kanonik ve mevcut telefon biçimlerini kapsar” davranışını otomatik olarak doğrulayan smoke testidir. |
| `eczanemEczaciVideoDagitimi.smoke.test.ts` | Test / TypeScript | “mutlu: eczacı dağıtımı UTT ile aynı satır içi yönetim ve önizleme akışını kullanır” davranışını otomatik olarak doğrulayan smoke testidir. |
| `eczanemEczaneIslemKapsami.smoke.test.ts` | Test / TypeScript | “eczacı müşteri ve gönderim listeleri yalnız çözümlenen eczane bağlamını kullanır” davranışını otomatik olarak doğrulayan smoke testidir. |
| `eczanemEczaneYonetim.smoke.test.ts` | Test / TypeScript | “mutlu: personel izi, ayrılmış sipariş kuyruğu ve DB toplamları ortak arayüzle kurulur” davranışını otomatik olarak doğrulayan smoke testidir. |
| `eczanemIzlemeCevapGuvenligi.smoke.test.ts` | Test / TypeScript | “mutlu: izleme ve cevap akışı sabit soru kümesiyle atomik RPC'leri kullanır” davranışını otomatik olarak doğrulayan smoke testidir. |
| `eczanemMusteriAuthKapisi.smoke.test.ts` | Test / TypeScript | “müşteri provizyonu geçerli Auth hesabı olmadan aktif müşteri oluşturmaz” davranışını otomatik olarak doğrulayan smoke testidir. |
| `eczanemMusteriTamSilme.smoke.test.ts` | Test / TypeScript | “mutlu: müşteri modal ve şifre teyidiyle bütün hesap zincirini siler” davranışını otomatik olarak doğrulayan smoke testidir. |
| `eczanemMusteriYuzeyi.smoke.test.ts` | Test / TypeScript | “mutlu: müşteri ana sayfası belirlenen altı dijital kanal rafını ve ayrı Puanlarım sayfasını sunar” davranışını otomatik olarak doğrulayan smoke testidir. |
| `eczanemOgrenmeAraciYayinKimligi.smoke.test.ts` | Test / TypeScript | “Eczanem iki dağıtım katmanında ortak araç kimliğini taşır ve doğrular” davranışını otomatik olarak doğrulayan smoke testidir. |
| `eczanemSiparisMutabakat.smoke.test.ts` | Test / TypeScript | “mutlu: yetkili personel kararı aynı firma kapsamındaki UTT mutabakatına girer” davranışını otomatik olarak doğrulayan smoke testidir. |
| `eczanemUttYonetim.smoke.test.ts` | Test / TypeScript | “mutlu: UTT yüzeyi panel kabuğunda, shadcn deseninde ve atomik gönderimle çalışır” davranışını otomatik olarak doğrulayan smoke testidir. |
| `eczanemUyelikDurumu.smoke.test.ts` | Test / TypeScript | “mutlu: müşteri durumu eczaneye özel üyelik bağında okunur ve yazılır” davranışını otomatik olarak doğrulayan smoke testidir. |
| `eczanemUyelikListedenSilme.smoke.test.ts` | Test / TypeScript | “mutlu: eczacı liste silmesini tek atomik RPC ile yapar” davranışını otomatik olarak doğrulayan smoke testidir. |
| `eczanemVideoDagitimRozeti.smoke.test.ts` | Test / TypeScript | “mutlu: gönderilebilir videosu olan eczanenin Video Dağıtımı rozeti güncellenir” davranışını otomatik olarak doğrulayan smoke testidir. |
| `egitimTuruSozlesmesi.smoke.test.ts` | Test / TypeScript | “eğitim türü sözleşmesi altı kanonik türü ve üretici rol yetkilerini doğru tutar” davranışını otomatik olarak doğrulayan smoke testidir. |
| `gonderimKarari.smoke.test.ts` | Test / TypeScript | “mutlu: beklemedeki id ya da kendi durumsuz satiri -> guncelle + dogru id” davranışını otomatik olarak doğrulayan smoke testidir. |
| `hbligiKapsam.smoke.test.ts` | Test / TypeScript | “HBLigi üst rol kapsamları firma ve takım sınırını korur” davranışını otomatik olarak doğrulayan smoke testidir. |
| `hbstoreFirmaUrun.smoke.test.ts` | Test / TypeScript | “mutlu: global aktif ürün varsayılan veya açık firma ayarında görünür” davranışını otomatik olarak doğrulayan smoke testidir. |
| `hedefRoller.smoke.test.ts` | Test / TypeScript | “hedef kitle sözleşmesi Eczacı ve Teknisyeni tekil ya da birlikte kabul eder” davranışını otomatik olarak doğrulayan smoke testidir. |
| `icMusteriTelefonGirisi.smoke.test.ts` | Test / TypeScript | “mutlu: aktif iç müşteri kayıtlı cep telefonuyla aynı Auth hesabına giriş yapar” davranışını otomatik olarak doğrulayan smoke testidir. |
| `izlemeBaslat.smoke.test.ts` | Test / TypeScript | “ilk gerçek oynatma tek bir sunucu oturumu ister” davranışını otomatik olarak doğrulayan smoke testidir. |
| `izlemeKarari.smoke.test.ts` | Test / TypeScript | “ilk gerçek temiz tam izleme tam puan ve soru hakkı üretir” davranışını otomatik olarak doğrulayan smoke testidir. |
| `mobilKarsilama.smoke.test.ts` | Test / TypeScript | “ilk mobil giriş tanıtımı, sonraki giriş başka tarayıcıda da Ana Sayfa'yı açar” davranışını otomatik olarak doğrulayan smoke testidir. |
| `ogrenmeAraciFaz2Guvenlik.smoke.test.ts` | Test / TypeScript | “tamamlanan öğrenme araçları varsayılan açıktır” davranışını otomatik olarak doğrulayan smoke testidir. |
| `ogrenmeAraciFaz2Migration.smoke.test.ts` | Test / TypeScript | “migration eklemelidir ve eski video tablolarını kaldırmaz” davranışını otomatik olarak doğrulayan smoke testidir. |
| `ogrenmeAraciFaz2Sozlesme.smoke.test.ts` | Test / TypeScript | “kanonik araç sözleşmesi video ile üç yeni aracı birbirinden ayırır” davranışını otomatik olarak doğrulayan smoke testidir. |
| `ogrenmeAraciFaz3Talep.smoke.test.ts` | Test / TypeScript | “talep formu Video ve Podcast arasında tek öğrenme aracı seçer” davranışını otomatik olarak doğrulayan smoke testidir. |
| `ogrenmeAraciFaz6Kritik.smoke.test.ts` | Test / TypeScript | “dört tüketici kanalında sahiplik ve bağ kimliği sunucuda doğrulanır” davranışını otomatik olarak doğrulayan smoke testidir. |
| `ogrenmeAraciPillEtiketleri.smoke.test.ts` | Test / TypeScript | “değişken durum: varyant, aşama ve durum metinleri seçilen aracı gösterir” davranışını otomatik olarak doğrulayan smoke testidir. |
| `ogrenmeAraciRolYayinKimligi.smoke.test.ts` | Test / TypeScript | “UTT yayın sözleşmesi öğrenme aracı kimliği ve türünü oynatıcıya taşır” davranışını otomatik olarak doğrulayan smoke testidir. |
| `ogrenmeAraciTamamlamaFaz3.hedef.test.ts` | Test / TypeScript | “boş ve küçük dosyanın parçalı SHA-256 özeti doğrudur” davranışını otomatik olarak doğrulayan hedef testidir. |
| `ogrenmeAraciTamamlamaFaz4.hedef.test.ts` | Test / TypeScript | “değişken durum değişken durum üretim akışı doğrudur” davranışını otomatik olarak doğrulayan hedef testidir. |
| `ogrenmeAraciTamamlamaFaz5.hedef.test.ts` | Test / TypeScript | “UTT ve KD_UTT erişimi aktif kullanıcı, firma, takım, hedef rol ve öneri bağıyla sınırlıdır” davranışını otomatik olarak doğrulayan hedef testidir. |
| `ogrenmeAraciTamamlamaFaz6.hbstore.canli.cjs` | Test / Node.js | HapBilgi kapsamındaki öğrenme Araci Tamamlama Faz6.hbstore.canli sözleşmesini otomatik olarak doğrular. |
| `ogrenmeAraciTamamlamaFaz6.hedef.test.ts` | Test / TypeScript | “araç türleri mevcut yayın ve ortak tamamlama puanı omurgasını kullanır” davranışını otomatik olarak doğrulayan hedef testidir. |
| `ogrenmeAraciTamamlamaFaz7.hedef.test.ts` | Test / TypeScript | “araç bazında dönemsel yayın sayısı dört araç için üretilir” davranışını otomatik olarak doğrulayan hedef testidir. |
| `ogrenmeAraciTamamlamaFaz8.hedef.test.ts` | Test / TypeScript | Bildirim, Eczanem, ortak etkileşim ve öğrenme içeriği yüzeyi kontrollerini içerir. |
| `oneri.tarih.smoke.test.ts` | Test / TypeScript | “mutlu: yarindan itibaren oneri kabul edilir” davranışını otomatik olarak doğrulayan smoke testidir. |
| `operasyonelYenileme.smoke.test.ts` | Test / TypeScript | “mutlu: operasyon sayfaları ortak, pasiflenebilir ve durum koruyan yenileme kullanır” davranışını otomatik olarak doğrulayan smoke testidir. |
| `periyotAltKirilim.smoke.test.ts` | Test / TypeScript | “mutlu: bu_gun dilimleri TR 6'sar saatlik ve etiketle uyumlu” davranışını otomatik olarak doğrulayan smoke testidir. |
| `pm04YarimYukleme.hedef.test.ts` | Test / TypeScript | “PM-03/A video kesintisi aynı oturum ve TUS aktarımıyla sürer; iptal tam temizlikten sonra bildirilir” davranışını otomatik olarak doğrulayan hedef testidir. |
| `pm05TalepIdempotency.hedef.test.ts` | Test / TypeScript | “PM-05 istemci, yanıt kaybında aynı form için aynı işlem anahtarını korur” davranışını otomatik olarak doğrulayan hedef testidir. |
| `pm06GuncelSurum.hedef.test.ts` | Test / TypeScript | “PM-06: karar isteği ekranda incelenen görev sürümünü taşır” davranışını otomatik olarak doğrulayan hedef testidir. |
| `pm09EczanemYayinDurdurmaKapisi.hedef.test.ts` | Test / TypeScript | “iki Eczanem gönderim RPC'si yayın satırını kilitleyip aktifliği doğrular” davranışını otomatik olarak doğrulayan hedef testidir. |
| `pm10Kapsam.smoke.test.ts` | Test / TypeScript | “PM-10: PM ürün sözlüğünde yalnız kendi firma ve takım kapsamını kullanır” davranışını otomatik olarak doğrulayan smoke testidir. |
| `raporLigKatalogYenileme.smoke.test.ts` | Test / TypeScript | “mutlu: rapor, lig ve katalog yüzeyleri ortak yenileme sözleşmesini kullanır” davranışını otomatik olarak doğrulayan smoke testidir. |
| `talepFormuUyumu.smoke.test.ts` | Test / TypeScript | “mutlu: referans dosyası bütün üretici rollerinde sahiplik ve görev bağıyla korunur” davranışını otomatik olarak doğrulayan smoke testidir. |
| `talepKaynakSahipligi.smoke.test.ts` | Test / TypeScript | “teknik firma sahipliği: kendi firmasının tekniği kabul, başka firmanınki reddedilir” davranışını otomatik olarak doğrulayan smoke testidir. |
| `tedarikciGizliligi.smoke.test.ts` | Test / TypeScript | “kullanıcıya ulaşan arayüz ve API metinleri altyapı sağlayıcısının adını göstermez” davranışını otomatik olarak doğrulayan smoke testidir. |
| `uretimDurumFiltresi.smoke.test.ts` | Test / TypeScript | “mutlu: içerik üreticisi revizyonu ve yeni işi üretici incelemesinden önce görür” davranışını otomatik olarak doğrulayan smoke testidir. |
| `uretimEskiYolTemizligi.smoke.test.ts` | Test / TypeScript | “mutlu: üretim yazıları yalnız kanonik görev API'lerinde yaşar” davranışını otomatik olarak doğrulayan smoke testidir. |
| `uretimGorevArayuzu.smoke.test.ts` | Test / TypeScript | “mutlu: görev durumları ortak arayüz durumlarına eksiksiz çevrilir” davranışını otomatik olarak doğrulayan smoke testidir. |
| `uretimGorevSozlesmesi.smoke.test.ts` | Test / TypeScript | “mutlu: atanan görev hazırlanır, incelemeye gider, revizyondan yeniden teslim edilir” davranışını otomatik olarak doğrulayan smoke testidir. |
| `uretimRpc.smoke.test.ts` | Test / TypeScript | “üretim RPC yardımcıları bilinen girdileri doğru sınıflandırır” davranışını otomatik olarak doğrulayan smoke testidir. |
| `yayinOncesiSilme.smoke.test.ts` | Test / TypeScript | “mutlu: yayın adayı kilitlenir, Bunny ve varyanta uygun DB silmesi tamamlanır” davranışını otomatik olarak doğrulayan smoke testidir. |
| `yoneticiGozlemYetkisi.hedef.test.ts` | Test / TypeScript | “yönetici kataloğu dört öğrenme aracının kimliğini ve türünü taşır” davranışını otomatik olarak doğrulayan hedef testidir. |
| `yonetimYenileme.smoke.test.ts` | Test / TypeScript | “mutlu: üretim, yönetim ve sipariş takip yüzeyleri ortak YenileButonu kullanır” davranışını otomatik olarak doğrulayan smoke testidir. |
| `zaman.sinir.smoke.test.ts` | Test / TypeScript | “mutlu: gun ici bir an dogru TR gunune ve periyoda cozulur” davranışını otomatik olarak doğrulayan smoke testidir. |

## 10. PUBLIC VE DOCS VARLIKLARI

### 📁 docs/

9 Eylül 2026 eklemesi: `BI_TEMIZLIK_PLANI.md`, deterministik bi kararı, uygulanan temizlik ve sonraki iyileştirmelerin kaydıdır.

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `BLUEBOOK.md` | Dokümantasyon | HapBilgi’nin iş modelini, rol ve iş kurallarını, mimarisini ve kanonik dosya envanterini tanımlayan ana başvuru belgesidir. |
| `OGRENIM_ARACI_GENISLETME_PROJESI_PLANI.md` | Dokümantasyon | “Öğrenim Aracı Genişletme Projesi Planı” kapsamındaki kararları, planı veya doğrulama kayıtlarını tutan proje belgesidir. |
| `OGRENME_ARACLARI_GENISLETME_PROJE_FAZ_PLANI_CHECKLIST.md` | Dokümantasyon | “Öğrenme Araçları Genişletme Proje Faz Planı — Checklist” kapsamındaki kararları, planı veya doğrulama kayıtlarını tutan proje belgesidir. |
| `OGRENME_ARACLARI_GENISLETMESI_TAMLAMA_FAZ_PLANI.md` | Dokümantasyon | “Öğrenme Araçları Genişletmesi – Tamamlama Faz Planı” kapsamındaki kararları, planı veya doğrulama kayıtlarını tutan proje belgesidir. |
| `OGRENME_ARACLARI_GENISLETMESI.md` | Dokümantasyon | “Öğrenme Araçları Genişletmesi” kapsamındaki kararları, planı veya doğrulama kayıtlarını tutan proje belgesidir. |
| `REDBOOK.MD` | Dokümantasyon | Bilinen teknik borçları, riskleri ve tamamlanması gereken iyileştirmeleri izleyen teknik takip belgesidir. |
| `ROLLER_VE_KAPSAMLI_ZOR_TESTLER.md` | Dokümantasyon | “Roller ve Kapsamlı Zor Testler” kapsamındaki kararları, planı veya doğrulama kayıtlarını tutan proje belgesidir. |

### 📁 docs/hukuki/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `CEREZ_AYDINLATMA_VE_TERCIH_METNI.md` | Dokümantasyon | “HAPBİLGİ ÇEREZ VE TARAYICI DEPOLAMA AYDINLATMA METNİ” kapsamındaki kararları, planı veya doğrulama kayıtlarını tutan proje belgesidir. |
| `KVKK_AYDINLATMA_METNI.md` | Dokümantasyon | “HAPBİLGİ KİŞİSEL VERİLERİN İŞLENMESİNE İLİŞKİN AYDINLATMA METNİ” kapsamındaki kararları, planı veya doğrulama kayıtlarını tutan proje belgesidir. |
| `KVKK_YURTDISI_VERI_AKTARIMI_TAKIP.md` | Dokümantasyon | Supabase ile KVKK Standart Sözleşme-2 ve Kurum bildirimi sürecinin durumunu, kanıtlarını ve sonraki adımlarını izler. |
| `PUAN_VE_ODUL_PROGRAMI_KURALLARI.md` | Dokümantasyon | “HAPBİLGİ PUAN VE ÖDÜL PROGRAMI KURALLARI” kapsamındaki kararları, planı veya doğrulama kayıtlarını tutan proje belgesidir. |
| `TICARI_ELEKTRONIK_ILETI_IZNI.md` | Dokümantasyon | “HAPBİLGİ TİCARİ ELEKTRONİK İLETİ İZNİ” kapsamındaki kararları, planı veya doğrulama kayıtlarını tutan proje belgesidir. |

### 📁 public/

| Dosya Adı | Türü | İşlevi ve Fonksiyonel Görevi (1-2 Cümle) |
|---|:---:|---|
| `hapbilgi-dikey-TM-1-logo.png` | Görsel / Varlık | hapbilgi dikey TM 1 logo için uygulamada kullanılan görsel varlıktır. |
| `hapbilgi-yatay-TM-1-logo.png` | Görsel / Varlık | hapbilgi yatay TM 1 logo için uygulamada kullanılan görsel varlıktır. |
| `icon-192.png` | Görsel / Varlık | PWA ve mobil cihazlar için 192x192 uygulama ikonu. |
| `icon-512.png` | Görsel / Varlık | PWA ve mobil cihazlar için 512x512 yüksek çözünürlüklü uygulama ikonu. |
| `logo-download.png` | Görsel / Varlık | logo download için uygulamada kullanılan görsel varlıktır. |
| `manifest.json` | JSON / Yapılandırma | Web uygulaması manifest ve PWA yapılandırma dosyası. |
| `sw.js` | Yapılandırma | Çevrimdışı önbellekleme ve servis işçisi (Service Worker) betiği. |

## 11. SIFIR `ANY` VE KESİN TİP GÜVENLİĞİ SÖZLEŞMESİ (STRICT TYPE-SAFETY)

HapBilgi kod tabanında tip güvenliği, sistem dayanıklılığı ve bakım kolaylığının temel taşıdır. Kod kalitesini en üst düzeye çıkarmak amacıyla **Sıfır `any` Prensibi** hayata geçirilmiş ve kurumsal olarak kilitlenmiştir:

1. **Tam Tip Kapsamı (0 `any`):** Projedeki 618 adet `.ts` ve `.tsx` dosyasının tamamı taranmış; önceki sürümlerden kalan tüm serbest `any` kullanımları tasfiye edilerek yerlerine kanonik Supabase row arayüzleri, jenerik haritalar (`Record<string, unknown>`), typed UI prop'ları (`AuthKullanici`, `Soru`, vb.) ve güvenli hata yakalama modelleri (`catch (err: unknown)`) entegre edilmiştir.
2. **ESLint Kalite Kilidi:** `eslint.config.mjs` yapılandırmasında `@typescript-eslint/no-explicit-any: "error"` kuralı aktif hale getirilmiştir. Kod tabanına yeni bir `any` tipi eklenmesi derleme ve CI/CD pipeline aşamasında otomatik olarak engellenir.
3. **Type Narrowing & Unknown Disiplini:** Belirsiz API girdileri veya harici JSON verileri asla `any` olarak işaretlenmez; `unknown` tipi ve `instanceof Error`, `typeof` ya da type guard yardımcıları ile sıkı tip daraltma (type narrowing) yapılarak güvenli alana taşınır.
4. **Veri ve Panel Uyumu:** Panel ana sayfa bileşenleri (`BmAnaSayfa`, `IuAnaSayfa`, `TmAnaSayfa`, `UreticiAnaSayfa`, `YoneticiAnaSayfa`) doğrudan `AuthKullanici` sözleşmesine; yayın ve talep hatları ise `HamTalepKaydi` ve `Soru` standartlarına bağlanmıştır.

---

## 12. SORU ERİŞİMİ KESİNTİ KURALI (TÜM İZLEYİCİ ROLLER)
*Tarih: 30 Ağustos 2026 | Kapsam: UTT/KD_UTT, BM (Challenge), E-Club, Eczanem müşteri*

Video tamamlanıp izleme puanı ve soru indeksleri yazıldıktan sonra kullanıcı soruları cevaplamadan çıkarsa, soru hakkının sunucuda açık kalması ve bazı akışlarda (BM challenge, E-Club, müşteri) yeniden girişte soruların tekrar açılması sorunu; dört izleme tablosuna eklenen tek tip `soru_erisimi_acik_mi` kapısıyla köke kapatıldı.

* **Alan (`soru_erisimi_acik_mi boolean NOT NULL DEFAULT false`):** `izleme_kayitlari`, `cc_izleme_kayitlari`, `eclub_izleme_kayitlari`, `eczanem_izleme_kayitlari`.
* **Durum geçişleri (tüm rollerde aynı):** ilk uygun video tamamlandı → `true` (tamamlama RPC'lerinde); cevaplar gönderildi → `false`; yayın yeniden başlatıldı → `false` (`baslat` uçlarında). Eski tamamlanmış-cevaplanmamış kayıtlar `false` kalır; geçmiş sorular açılmaz.
* **Kilit:** dört `/sorular` ve dört cevap yolu bu kapıyı denetler; kapalıysa eski `izleme_id` ile soru alınamaz veya cevap yazılamaz (atomik; eşzamanlı ikinci isteği keser).
* **BM challenge:** `challenge_kayitlari.izlendi_mi` artık video tamamlanınca açılır; referral yalnız cevap başarıyla kaydedilince verilir.
* **Not:** Mevcut `soru_hakki_var_mi` (UTT/E-Club) ve `cevaplandi_mi` (BM/müşteri) alanları korunur; tek-kaynağa indirgeme teknik borcu REDBOOK §6.4 TB-01'de.

---

## 🎯 GENEL SONUÇ VE KALİTE SİCİLİ

**6 Eylül 2026** tarihi itibarıyla BLUEBOOK; HapBilgi’nin iş modelini, kullanıcı rollerini, yetki sınırlarını, T-Club, C-Club, E-Club, Eczanem, Store, üretim, yönetim, raporlama, HapBi ve öğrenme araçları süreçlerini güncel uygulama yapısıyla birlikte tanımlar.

Platformun iş kuralları; rol ve firma kapsamı, veri bütünlüğü, erişim denetimi, öğrenme takibi ve üretim akışları esas alınarak kod, veritabanı ve kullanıcı arayüzü katmanlarında uygulanır. Video, Podcast, Dijital Broşür ve Flip PDF ortak öğrenme aracı yapısı içinde yönetilir.

Kod kalitesi; TypeScript tip denetimi, mimari kurallar, otomatik testler, SQL denetimleri ve kanonik dosya envanteriyle korunur. BLUEBOOK güncel ve bağlayıcı sistem kaydını, REDBOOK açık teknik borçları, hukuki takip belgeleri ise tamamlanması gereken veri ve mevzuat süreçlerini gösterir.

Bu kayıt, doğrulanmış mevcut durumu ifade eder; mutlak kusursuzluk veya tamamlanmışlık iddiası taşımaz.

**10 Eylül 2026 — bi hazır cevap mimarisi:** Metinler `cevapKatalogu.ts`, rol seçimleri `rolCevaplari.ts`, sayfa adresleri ve rol bağlantı seçimleri `sayfalar.ts` içinde toplanmıştır. `nedir.ts` yalnız seçilen kataloğu çözer. Eğitim ailesinin 17 tanımı ve dört ayrı onaylı kısa metni korunur; İK metinleri değişmez. Eski `ureticiNedir.ts` kaldırılmıştır. Konusu belirsiz, uygun bağlantısı olmayan veya katalogda tanımı bulunmayan soruda ortak esprili mesaj gösterilir; genel rapor otomatik önerilmez. KAÇ hesapları değişmemiştir.

**10 Eylül 2026 — medikal rol:** `med_md` ortak üretici KAÇ hattına bağlandı. İzinli türler yetenek kaynağından `medikal_egitim` ve `urun_medikal_egitim` olarak alınır. Sayımlar kendi talep ve yayınlarıyla sınırlıdır. Ürün-medikal eğitim türü seçilebilir; belirli ürün filtresi mevcut rapora yönlendirilir. NEDİR seçiminde eğitimle aynı 17 ortak/sade onaylı yanıt kullanılır; yeni cevap metni kopyalanmaz.

**10 Eylül 2026 — PM ailesi:** `pm`, `jr_pm`, `kd_pm` ortak üretici NEDİR/KAÇ hattına bağlandı. Eğitim ve medikal ile aynı 17 ortak/sade cevap kimliğini kullanır; metin kopyalanmaz. İzinli talep türü yetenek kaynağındaki `urun_egitimi`dir. On sayım yalnız kullanıcının kendi talep/yayınlarını kapsar; takım toplamı değildir. Ürün/teknik bazındaki ayrıntılar ve saha sonuçları ilgili mevcut raporlara yönlendirilir. Böylece 13 üretici rolünün tamamı ortak üretici hattına bağlanmıştır.

**10 Eylül 2026 — yayın adedi / araç türü ayrımı:** Ortak üretici hattında `yayinda` yayın adedidir. `yayinda_arac_turu` yayındaki farklı öğrenme aracı türlerini sayar; `yayin_arac_dagilimi` video/podcast/gorsel/flip_pdf başına yayın adedini verir. “Yayında kaç öğrenme aracım var?” tür sayısıdır; “Yayında kaç yayınım var?” yayın adedidir. 27 videodan oluşan yayındaki portföy sırasıyla 1 tür ve 27 yayındır. Dağılım mevcut kişisel yayın filtreleriyle, sayfalar arasında benzersiz yayın kimlikleri üzerinden hesaplanır; eksik/tanımsız araç türü sıfır kabul edilmez. Üç ölçüt mevcut durum içindir, geçmiş durum fotoğrafı üretmez.

**10 Eylül 2026 — yönetici başlangıcı:** Yedi `YONETICI_ROLLER` unvanı ortak 17 sade üretim/platform tanımı ve üç saha yönetimi tanımını katalogdan seçer. İşlem sayfası bağlantıları üretim raporuna yönlenir. `yoneticiYanit.ts` firma geneli sekiz ölçütü mevcut `get_yonetici_rapor_ana_ozet_v2` kaynağından okur: güncel takım/bölge/UTT/yayındaki yayın sayısı; zaman aralığında tamamlanan izleme ve kazanılan/kaybedilen/net saha puanı. Kimlik/firma oturumdan doğrulanır. Tarihler ortak hafta/ay/çeyrek/yıl sözleşmesidir; geçmiş anlık durum hesaplanmaz. Takip ve önceki eş dönem karşılaştırması vardır. Belirli kişi/takım/bölge/ürün/eğitim/araç filtresi, tür sayısı, dağılım ve kişisel C-Club soruları mevcut ilgili rapor veya lige yönlendirilir; firma toplamı yerine geçirilmez. Bu ilk adım tüm yönetici rapor ayrıntılarını sohbet içinde hesaplama iddiası taşımaz.

**10 Eylül 2026 — yönetici ayrıntıları (GM dahil):** `yoneticiDetay.ts` yedi yönetici rolünün firma içi ayrıntılarını aynı Gemini çağrısından çıkan doğrulanmış sorguyla hesaplar. Takım/bölge/UTT sonuçları sayfalı `get_yonetici_hiyerarsi_v2`, BM kişisel sonuçları mevcut C-Club okuyucusundan gelir. Üretim, üretici/eğitim türü/ürün gruplarında ortak üretici sayım okuyucusunu kullanır; yönetici filtresi firma eşitliğini doğrular ve tarihsel üretici kayıtlarını korur. Ürün filtresi taleplere uygulanır. Yayındaki tür sayısı tüm seçili üreticilerdeki türlerin birleşimidir; tür sayıları birbirine eklenmez. Dağılım dört türde yayın adetlerini verir. Aynı grupta adlarla kıyaslama, büyükten küçüğe sıralama (eşitlik aynı sıra), önceki eş takvim dönemi karşılaştırması desteklenir. Ayrıntı yanında rapor/lig bağlantısı sunulur. Üretim takım/bölge filtresi, saha ürün/eğitim/araç filtresi, çapraz grup kıyası ve geçmiş anlık durum bu sözleşmede yoktur; filtre atılarak toplam verilmez. Kullanıcı isteği doğrultusunda otomatik/ekran testleri çalıştırılmadı; ekran doğrulaması kullanıcıda.
