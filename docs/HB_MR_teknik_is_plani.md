# HB_MR (HapBilgi MR) — Bütünsel Teknik İnceleme ve Tutarlılık İş Planı

Bu iş planı, HapBilgi platformunda yer alan her rol ve rol grubunun teknik yapı tutarlılığını (Frontend $\rightarrow$ Backend $\rightarrow$ Veritabanı) uçtan uca denetlemek, yüzeyde görünmeyen sessiz hataları (silent failures), yetki açıklarını ve veri modeli uyumsuzluklarını ortaya çıkarmak için hazırlanmıştır.

İnceleme, sistemin dağılmasını önlemek amacıyla **4 Kulüp (T-Club, C-Club, E-Club, Eczanem) ve Üretim/Yönetim Omurgası** başlıkları altında, her başlık için **3 Aşamalı Zorunlu Çalışma Disiplini** ile yürütülecektir.

---

## 🏛️ HB_MR İnceleme Metodolojisi ve 3 Aşamalı Disiplin

Her kulüp başlığı altında sırasıyla şu 3 adım icra edilecektir:

* **1. Aşama — Rol Tanımları ve Görevlerin Belirlenmesi:**
  * Rolün platformdaki asıl misyonu ve iş mantığı.
  * **Tek Boyutlu Görevler:** Rolün tek başına, izole yürüttüğü işlemler.
  * **Çok Boyutlu Görevler:** Diğer rollerle el sıkışma (onay, devir, öneri, sipariş, raporlama) içeren zincirleme görevler.

* **2. Aşama — Frontend ve Backend Kod Taraması (Sessiz Hata Tespiti):**
  * Görevleri icra eden sayfalar (`page.tsx`), bileşenler (`components/`), API route'ları (`route.ts`) ve iş mantığı motorları (`lib/`).
  * `try/catch` bloklarında sessizce yutulan ve kullanıcıya bildirilmeyen hatalar.
  * İstemciye (client) bırakılmış yetkisiz veri manipülasyon riskleri.
  * Yanıtsız kalan veya yarışma durumuna (race condition) açık asenkron akışlar.

* **3. Aşama — Veritabanı Dokusu ve Tutarlılık Denetimi:**
  * Görevlerin temas ettiği PostgreSQL tabloları, view'lar, index'ler.
  * `AFTER INSERT` / `AFTER UPDATE` trigger'larının çalışma tutarlılığı.
  * Atomik RPC fonksiyonları ve güvenlik politikaları (`SECURITY DEFINER` / `INVOKER`).
  * Ölü kalmış, hiçbir yere bağlanmayan veya veri kirliliği üreten atıl tabloların tespiti.

---

## 1. BÖLÜM: T-CLUB (Saha & Temsilci Kulübü)

T-Club; firmanın kendi saha gücünü (UTT, KD_UTT, BM, TM) barındıran ana öğrenme ve temsil katmanıdır.

### 1.1 UTT & KD_UTT (Uzman Tıbbi Tanıtım Temsilcisi)

#### 1. Aşama: Rol Tanımı ve Görevleri
* **Tanım:** Firmanın sahadaki tıbbi temsilcisi, E-Club'ın kanal kurucusu ve Eczanem'in dağıtım elçisidir.
* **Tek Boyutlu Görevler:**
  * 5 kategoride eğitim yayını tüketimi (`/videolarim/[urun|medikal|urun-medikal|satis|ik]`).
  * Hafta içi 07:00–20:29 puanlı izleme, temiz tamamlamada video sonu soru çözümü.
  * İleri sarma tespiti ve puan kaybı oluşumu.
  * Tur/tekrar izleme ve ayda 3. tam tekrarda tek seferlik extra puan kazanımı.
  * Kişisel performans karnesi (`/raporlar/utt`) ve lig takibi (`/hb-ligi`).
  * HBStore bakiye takibi, adres yönetimi (`/store/adreslerim`) ve ürün siparişi (`/store`).
* **Çok Boyutlu Görevler:**
  * **BM ile Bağlantı:** BM'den gelen video izleme önerilerini süresi içinde tamamlama (`/oneriler`) $\rightarrow$ puan kazanımı veya süre aşımında öneri kaybı yazımı $\rightarrow$ BM/TM bölge tamamlama raporlarına etki.
  * **E-Club ile Bağlantı:** Sahadaki eczaneleri GLN ile bağlama, eczacı/teknisyen kaydı açma, onlara video önerme.
  * **Eczanem ile Bağlantı:** PM'lerin OTC videolarını aktif üye eşiğini aşmış eczanelere iletme (`/eczanem/utt`), kasa mutabakatlarını izleme (`/eczanem/utt/mutabakat`).

#### 2. Aşama: Kod Dosyaları ve Taranacak Noktalar
* **Frontend:** `app/(panel)/videolarim/`, `components/ana-sayfa/UttAnaSayfa.tsx`, `components/izle/VideoOynatici.tsx`, `app/(panel)/oneriler/page.tsx`, `app/(panel)/raporlar/utt/page.tsx`, `app/(panel)/hb-ligi/page.tsx`, `app/(panel)/store/`.
* **Backend & Lib:** `app/izle/api/baslat`, `bitir`, `cevap`, `ileri-sarma`, `sorular`, `begeni`, `favori`; `lib/puan/`, `lib/tur/`, `lib/zaman/`, `lib/soru/`, `lib/rapor/utt/`, `lib/store/`.
* **Aranacak Kusurlar:** Video oynatıcıda ilk oynatma tetiklenmeden `baslat` çağrılması, video bitişinde puanın yazılamayıp izlemenin tamamlandı işaretlenmesi riski, soru hakkının turlarda yanlış sıfırlanması, store sepetinde bakiye/stok yarışma durumları.

#### 3. Aşama: Veritabanı Tabloları ve Tutarlılık
* **Tablolar:** `izleme_kayitlari`, `kazanilan_puanlar`, `ileri_sarma_kayitlari`, `yanlis_cevap_kayitlari`, `oneri_kayip_kayitlari`, `oneri_kayitlari`, `yayin_tekrar_kayitlari`, `hb_ligi_ozet_v2`, `store_siparisler`, `store_puan_harcamalari`, `store_adresler`.
* **Denetim:** `AFTER INSERT` lig trigger'ı veri atlıyor mu? `oneri_kaybi_tara` cron'u geciken izlemeleri doğru yakalıyor mu? Bakiye RPC'si (`get_harcama_bakiyesi`) çeyrek sınırına sadık mı?

---

### 1.2 BM (Bölge Müdürü)

#### 1. Aşama: Rol Tanımı ve Görevleri
* **Tanım:** Bölgesindeki UTT ekibinin yöneticisi, saha yönlendiricisi ve C-Club yarışmacısıdır.
* **Tek Boyutlu Görevler:**
  * Bölge performans raporunu izleme (`/raporlar/bm` — Bölge puanı, UTT ortalaması, izlenme oranı, aktif UTT oranı).
  * Bölgesindeki UTT'lerin sipariş ve lig hareketlerini izleme.
* **Çok Boyutlu Görevler:**
  * **UTT'ye Öneri Gönderme:** Kendi bölgesindeki UTT'lere hedef video önerisi açma (`/oneriler` $\rightarrow$ `oneri_kayitlari`) ve tamamlama oranlarını takip etme.
  * **TM ile Bağlantı:** Kendi bölge verilerinin TM takım raporuna ve şirket toplamına konsolidasyonu.

#### 2. Aşama: Kod Dosyaları ve Taranacak Noktalar
* **Frontend:** `app/(panel)/oneriler/page.tsx`, `components/oneriler/_components/BmOneriTakibi.tsx`, `app/(panel)/raporlar/bm/page.tsx`, `components/rapor/bm/`.
* **Backend & Lib:** `app/(panel)/oneriler/api/`, `app/(panel)/raporlar/api/bm/`, `lib/oneri/limitKontrol.ts`, `tarihKurali.ts`, `pencereKontrol.ts`, `lib/rapor/bm/getBmData.ts`, `aggregateUtt.ts`.
* **Aranacak Kusurlar:** BM öneri limitlerinin (haftalık/aylık kotalar) aşılması, UTT silindiğinde veya pasife alındığında BM tamamlama oranının sıfıra bölme hatası vermesi, tarih aralığı filtrelerinde saat dilimi (UTC vs TR) kayması.

#### 3. Aşama: Veritabanı Tabloları ve Tutarlılık
* **Tablolar & RPC:** `oneri_kayitlari`, `kullanicilar`, `bolgeler`, `takimlar`, `get_analiz_bm`, `get_oneri_listesi`.
* **Denetim:** BM öneri RPC'sinde bölge dışı UTT'ye öneri sızması engelli mi?

---

### 1.3 TM (Takım Müdürü)

#### 1. Aşama: Rol Tanımı ve Görevleri
* **Tanım:** Birden fazla bölgeyi kapsayan takımın lideridir.
* **Tek Boyutlu Görevler:** Takım performans raporunu (`/raporlar/tm`) izleme, takımlar arası lig rekabetini görme.
* **Çok Boyutlu Görevler:** Takımındaki BM'lerin UTT'lere açtığı önerileri salt-okur izleme (`/oneriler`), bölgeler arası katkı oranlarını analiz etme.

#### 2. Aşama: Kod Dosyaları ve Taranacak Noktalar
* **Frontend & Backend:** `app/(panel)/raporlar/tm/page.tsx`, `app/(panel)/raporlar/api/tm/route.ts`, `lib/rapor/tm/getTmData.ts`, `app/(panel)/oneriler/_components/TmOneriTakibi.tsx`.
* **Aranacak Kusurlar:** TM'nin yetkisiz öneri açma butonuna erişebilme açığı, başka takımların verisinin payload'a karışması.

#### 3. Aşama: Veritabanı Tabloları ve Tutarlılık
* **Tablolar:** `takimlar`, `bolgeler`, `kullanicilar`, `v_rapor_takim`.

---

## 2. BÖLÜM: C-CLUB (Challenge Club — Yönetici Öğrenmesi)

C-Club; Bölge Müdürlerinin (BM) "Önce ben öğrenirim, sonra öğretirim" felsefesiyle birbiriyle yarıştığı ve öğrendiği izole alandır.

#### 1. Aşama: Rol Tanımı ve Görevleri (BM)
* **Tek Boyutlu Görevler:** "İzlenecek Videolar" sekmesinden doğrudan video izleme, soru çözme, extra puan kazanma.
* **Çok Boyutlu Görevler (BM $\rightarrow$ BM):**
  * Başka bir BM'e meydan okuma (Challenge) gönderme (`/challenge-club` — aylık 3 kota, gönderme puanı kazanımı).
  * Gelen challenge'ı izleyip sorularını tamamlama $\rightarrow$ alıcının video/cevap puanı alması, gönderene referral puanı gitmesi.
  * C-Club Ligi (`/cc-ligi`) takibi ve C-Club puanlarıyla HBStore'dan alışveriş (`/store`).

#### 2. Aşama: Kod Dosyaları ve Taranacak Noktalar
* **Frontend:** `app/(panel)/challenge-club/`, `components/challenge-club/CcVideoOynatici.tsx`, `ChallengeGonderPaneli.tsx`, `app/(panel)/cc-ligi/`.
* **Backend & Lib:** `app/(panel)/challenge-club/api/`, `izle/api/baslat`, `bitir`, `cevap`, `lib/cc/`, `lib/cc/kotaKontrol.ts`, `uygunAliciListesi.ts`.
* **Aranacak Kusurlar:** Bekleyen challenge varken kendi kendine izleme kilidinin delinmesi, referral puanının mükerrer yazılması, soru gönderiminde indeks uyuşmazlığı.

#### 3. Aşama: Veritabanı Tabloları ve Tutarlılık
* **Tablolar:** `challenge_kayitlari`, `cc_izleme_kayitlari`, `cc_kazanilan_puanlar`, `cc_ileri_sarma_kayitlari`, `cc_yanlis_cevap_kayitlari`, `cc_ligi_ozet`, `v_cc_challenge_listesi`.
* **Denetim:** `cc_challenge_gonder`, `cc_izleme_tamamla`, `cc_cevaplari_kaydet` RPC atomikliği ve trigger doğrulaması.

---

## 3. BÖLÜM: E-CLUB (Eczane Kulübü — Dış Müşteri Katmanı)

E-Club; firmanın sahadaki dış müşterilere (Eczacı ve Eczane Teknisyenleri) ulaştığı çok-firmalı ve izole kulüptür.

### 3.1 UTT'nin E-Club Görevleri
* **1. Aşama (Görev):** GLN ile Eczane bağlama (`/eclub/eczanelerim`), Eczacı/Teknisyen ekleme, Gönderilecek Videolar (`/eclub/videolarim`) üzerinden kişiye video önerme, Gönderilen Videolar (`/eclub/gonderilen-videolar`) takibi, E-Club Raporları, E-Club Ligi ve E-Club Sipariş takibi.
* **2. Aşama (Kod):** `app/(panel)/eclub/`, `lib/eclub/`, `lib/eclub/oneriLimit.ts`, `gonderiAyarlari.ts`.
* **3. Aşama (DB):** `eclub_eczane_master`, `eclub_eczaneler`, `eclub_eczane_firma`, `eclub_kisiler`, `eclub_kisi_eczane`, `eclub_oneri_kayitlari`, `eclub_oneri_atomik_kaydet`.

### 3.2 E-Club Kişisi (Eczacı & Teknisyen) Görevleri
* **1. Aşama (Görev):** Firma bazlı katalogdan (`/eclub/panel/firma/[firma_id]`) UTT'nin önerdiği veya açık videoları izleme, soru çözme, puan toplama, E-Club Store'dan alışveriş (`/eclub/store`), sipariş takibi.
* **2. Aşama (Kod):** `app/(panel)/eclub/panel/`, `_components/EclubVideoOynatici.tsx`, `app/(panel)/eclub/store/`.
* **3. Aşama (DB):** `eclub_izleme_kayitlari`, `eclub_kazanilan_puanlar`, `eclub_ileri_sarma_kayitlari`, `eclub_yanlis_cevap_kayitlari`, `eclub_store_*`.

---

## 4. BÖLÜM: ECZANEM (Nihai Tüketici & Dağıtım Katmanı)

Eczanem; eczane müşterisinin OTC videoları izleyerek kasada TL indirimi kazandığı 3. müşteri katmanıdır.

### 4.1 UTT & PM Dağıtım ve Mutabakat Rolü
* **1. Aşama (Görev):** PM'in Eczanem yayını açması (Barkod + Karşılık tanımı), UTT'nin aktif üye eşiğini aşan eczanelerine video dağıtması (`/eczanem/utt`), mutabakat dökümü (`/eczanem/utt/mutabakat`) ve Eczanem raporlarını (`/raporlar/eczanem`) izleme.
* **2. Aşama (Kod):** `app/(panel)/eczanem/utt/`, `app/(panel)/raporlar/eczanem/`, `lib/eczanem/`.
* **3. Aşama (DB):** `eczanem_yayin_detay`, `eczanem_video_dagitim`, `eczanem_siparisler`, `eczanem_mutabakat`.

### 4.2 Eczane (Eczacı) ve Müşteri Kasa Akışı
* **1. Aşama (Görev):** Müşteri daveti (SMS/OTP), müşterinin video izleyip puan biriktirmesi (180 gün FIFO), kasada barkod okutma $\rightarrow$ sipariş $\rightarrow$ eczacı onayı $\rightarrow$ atomik puan düşüşü ve TL indirimi.
* **2. Aşama (Kod):** `app/eczanem/musteri/`, `app/eczanem/eczane/`, `EczanemVideoOynatici.tsx`.
* **3. Aşama (DB):** `eczanem_musteriler`, `eczanem_musteri_kazanimlar`, `eczanem_kasa_islemleri`, Dörtlü kilit doğrulaması (`kisi + eczane + firma + urun`).

---

## 5. BÖLÜM: ÜRETİM & YÖNETİM OMURGASI (İçerik Fabrikası ve Üst Yönetim)

* **1. Aşama (Görev):** PM/Üretici rollerin Talep açması (`/talepler`), İçerik Üreticisinin (İÜ) görev tabanlı senaryo/video/soru seti üretimi (`/senaryolar`, `/videolar`, `/soru-setleri`), yayın yönetimi (`/yayin-yonetimi`) ve firma geneli üst yönetici rapor akordeonları (`/raporlar/yonetici`).
* **2. Aşama (Kod):** `app/(panel)/uretim/`, `app/(panel)/talepler/`, `app/(panel)/yayin-yonetimi/`, `lib/uretim/`, `lib/rapor/yonetici/`.
* **3. Aşama (DB):** `talepler`, `talep_durum_gecmisi`, `senaryolar`, `videolar`, `soru_setleri`, `yayin_yonetimi`, `uretim_gorevler`.

---

## 🎯 Doğrulama ve Teslimat Planı

* Her kulüp ve rol tamamlandığında tespit edilen:
  1. **Kritik Hatalar (Puan, Yetki, Kayıp Kaçakları),**
  2. **Sessiz Kod Hataları (`catch` blokları, kırık API rotaları),**
  3. **Veritabanı / DDL Tutarsızlıkları**
  raporlanacak, testleri yazılacak ve onayınızla düzeltilecektir.
