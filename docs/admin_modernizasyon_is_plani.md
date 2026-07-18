# Admin Modernizasyon İş Planı

*HapBilgi'nin yönetim beyni: firma bağlamlı, dört modülü de yöneten, güvenilir tek admin paneli*

*Sürüm: Taslak v1 — 17.07.2026. Tetikleyici: admin tam kalite taraması (kalite_bulgu_raporu.md §5, B-17..B-38) + İskender'in yapısal tespiti: "mevcut tespitler eksiklik değil; HapBilgi modüler olarak genişlerken admin geride kalmıştır — gerçek anlamda ortada bir admin yoktur." Fiziksel testler bu tespitle durdurulmuştur; öncelikli iş bu plandır. Bulgu raporu MEVCUT DURUM tespiti olarak aynen kalır; bu plan hem o bulguların düzeltilmesini hem panelin modernizasyonunu kapsar.*

---

## A. Mevcut Teknik Durum

### A.1 Yönetim yüzeyi parçalı ve kısmen kopuk

Bugün "admin" tek bir panel değil, dört ayrı ve birbirinden habersiz yüzeydir:

| Yüzey | Erişim | Kapsam |
|---|---|---|
| `/admin` | Navbar | Firma listesi/aç-kapa bayrakları + kullanıcı (tekil/toplu/liste) + takım-bölge + ürün-teknik + sistem ayarları + test-verisi-sil |
| `/admin/eclub` | Navbar ("E-Club Admin") | Eczane onayları + kayıtlı firma/eczane/kişi görünümü |
| `/admin/eclub-store` | Navbar ("E-Club Store Admin") | E-Club Store ürün/kategori/sipariş |
| `/admin/store` | **HİÇBİR YERDEN BAĞLANTISIZ — yetim sayfa** | HBStore ürün/kategori/sipariş (kod tam, UI erişilemez) |

Sonuçlar: (1) HBStore siparişleri fiilen yönetilemiyor (İskender'in "E-Club/E-Club Store için tek fonksiyon aç/kapa" gözleminin sebebi — paneller ya kopuk ya ana panelden görünmez); (2) B-27 bulgusundaki sipariş durum ekranı var ama admin ana akışının parçası değil; (3) her yüzey kendi kabuğunu (auth kapısı, sekme barı, hata sistemi) kopyalamış.

### A.2 Kullanıcı yönetimi güvenilmez

Tam tarama bulguları (kalite_bulgu_raporu.md §5): toplu yükleme/silme/pasifleme sonuç yalanı (B-17, B-19), rol doğrulamasız yazım (B-18), iki ayrı kural seti (B-21), rol değişiminde veri tutarsızlığı (B-23), silmede yarım durum (B-24), insan-format toleranssızlığı (B-25), export'un sessiz eksik yedeği (B-20). Panelin en temel işi olan kullanıcı yönetimi bu haliyle üretim yükü taşıyamaz.

### A.3 Modül içerik yönetimi YOK

Admin, dört modülün hiçbirinin İÇERİĞİNE dokunamıyor:

- **T-Club (üretim hattı + izleme/puan):** yayın listesi, tur durumu, planlanan yayınlar, puan hareketleri — admin görünümü sıfır. Yayın yönetimi üretici rollerin sayfasında (`/yayin-yonetimi`); admin oraya ancak "kullanıcı gibi" girebilir.
- **C-Club:** challenge/CC yayınları, lig durumu — admin tasarrufu yalnız firma bayrağı (`cc_aktif`).
- **E-Club:** kısmi — eczane onayı + kayıtlı görünüm var (`/admin/eclub`), ama firma bağlamından ve ana panelden kopuk; öneri/izleme/puan görünürlüğü yok.
- **Eczanem:** hiçbir admin yüzeyi yok (eczane gönderimleri, üyeler, siparişler, tarifeler — tümü görünmez).

### A.4 Firma bağlamı tutarsız

Yapı çok firmalı (`firma_id` her çekirdek tabloda), `/admin` firma seçimiyle çalışıyor; ama:

- Store panelleri firma bağlamsız — katalog tabloları global (`store_urunler`/`eclub_store_urunler`'de firma kolonu YOK; DB'den doğrulandı), sipariş listeleri "her firmadan". Firma bayrağı yalnız erişimi açıp kapatıyor.
- E-Club admin'i kendi içinde firma seçtiriyor (ikinci, kopuk bir firma navigasyonu).
- Kullanıcı tarafındaki bölge çözümü firma sınırını denetlemiyor (B-22).

### A.5 Güvenlik/altyapı çokbaşlılığı

En az dört savunma deseni; `adminGirisKontrol` ölü kod (B-26). Eski hook'lar try/catch'siz (B-32). Sistem ayarları paneli jsonb-nesne değeri yönetemiyor (B-28 — push ayarı yönetilemez durumda).

---

## B. Hedef Tanımı

### B.1 İlke

**Admin, HapBilgi'nin yönetim beynidir:** bir firma seçilir; o firmanın kullanıcıları, yapısı (takım/bölge/ürün/teknik) ve DÖRT MODÜLÜNÜN işleyişi aynı panelden görünür ve yönetilir. Firma-üstü işler (global store katalogları, sistem ayarları, E-Club eczane onayları) ayrı "Global" bağlamda toplanır. Hiçbir admin işlevi Navbar'a dağılmış yetim sayfalarda yaşamaz.

### B.2 Bilgi mimarisi (öneri)

```
/admin
├── Sol: FirmaSidebar (mevcut — firma seç + bayraklar + export/sil)
├── Üst sekmeler (seçili FİRMA bağlamı):
│   Kullanıcılar | Yapı (takım·bölge·ürün·teknik) | T-Club | C-Club | E-Club | Eczanem
└── Üst sağ (GLOBAL bağlam):
    Store'lar (HBStore + E-Club Store) | Sistem Ayarları | Test Araçları
```

- Mevcut Tekil/Toplu/Takım/Ürün sekmeleri "Kullanıcılar" ve "Yapı" altında toplanır.
- `/admin/eclub`, `/admin/eclub-store`, `/admin/store` içerikleri sekmelere taşınır (kod büyük ölçüde hazır — iş çoğunlukla taşıma/bağlama); Navbar'daki "E-Club Admin"/"E-Club Store Admin" pilleri kalkar.
- Modül sekmeleri, firmanın ilgili bayrağı kapalıysa "modül kapalı" durumunu gösterir (bayrak toggle'ı oradan da erişilir).

### B.3 Modül sekmelerinin fonksiyonel kapsamı

Her modül sekmesi iki katmandır: **görünürlük** (durum/istatistik/liste — salt okuma) ve **müdahale** (yazma aksiyonları). Görünürlük katmanı mevcut tabloların okunmasıdır, yeni iş kuralı gerektirmez; müdahale kapsamları AÇIK KARARLAR bölümünde İskender onayına tabidir.

| Sekme | Görünürlük (v1) | Müdahale adayları (karar ister — C.5) |
|---|---|---|
| T-Club | Yayın listesi (durum/tur/planlı), izleme-puan özetleri, bekleyen üretim zinciri | Yayın durdur/başlat, planlı yayını iptal/tarih değiştir (mevcut `yayin-yonetimi` API'lerinin admin'e açılması) |
| C-Club | CC yayınları, lig özeti, challenge hareketleri | Challenge iptali/geri alma (bugün hiçbir uçta yok — yeni iş) |
| E-Club | Mevcut onay + kayıtlı görünüm (taşınır); öneri/izleme özetleri | Kişi pasife alma (mevcut), eczane-firma bağı müdahalesi |
| Eczanem | Eczane/üye/gönderim/sipariş sayıları, tarife listesi | Tarife pasifleme, üyelik müdahalesi (yeni iş — İP kurallarıyla çelişmemeli) |
| Store'lar | Mevcut iki panel (taşınır) | Sipariş durum matrisi düzeltilmiş hâliyle (B-27) |

### B.4 Güvenlik ve altyapı hedefi

- Tüm admin rotaları tek bekçiden geçer: `adminGirisKontrol` (route-içi) + proxy (ikinci katman) — B-26 kapanır; yerel `adminKontrol` kopyaları silinir.
- Kullanıcı doğrulama kuralları tek lib'de: `lib/admin/kullaniciDogrulama.ts` (tekil + toplu aynı fonksiyonu çağırır) — B-18/B-21/B-22/B-23 kapanır.
- fetch standardı: try/finally + `res.ok` + kısmi-sonuç raporu (B-17/B-19/B-32 sınıfı yapısal olarak kapanır).
- Sistem ayarları jsonb-nesne desteği (B-28): `push_olay_aktif` panelden yönetilebilir olur (push planı B.2-6 gereksinimi).

---

## C. Uygulama Planı — Fazlar (M0–M5)

Her adım üçlü doğrulamadan (tsc + denetim + lint:mimari) temiz çıkar; bulgu düzeltmeleri "bir bulgu = bir commit" disiplinindedir.

**M0 — Güvenilirlik tabanı (mevcut ekran üzerinde, acil bulgular).**
Sıra: B-17 → B-19 (sonuç yalanları) → B-18+B-21 (ortak doğrulama lib'inin ilk hali: rol + takım/bölge çözümü; tekil ve toplu rotalar ona bağlanır) → B-20 (export hata kontrolü + `son_export_at` disiplini) → B-23 → B-22 → B-24. Bu faz bitmeden hiçbir kullanıcı-yönetimi fiziksel testi anlamlı değildir.

**M1 — Ortak çekirdek.**
`adminGirisKontrol` tüm rotalara (B-26); yerel kopyaların silinmesi; fetch try/finally standardı + dosya input reset (B-32); `ADMIN_ROLLER` hardcode temizliği (B-33); şifre politikası (B-36).

**M2 — Bilgi mimarisi.**
Yeni sekme yapısı (B.2); üç kopuk panelin (`store`, `eclub`, `eclub-store`) ana panele firma/global bağlamıyla taşınması; Navbar sadeleşmesi; her sekmede modül-kapalı durumu. Bu faz görsel yeniden düzenlemedir — iş mantığına dokunmaz.

**M3 — Kullanıcı yönetimi modernizasyonu.**
İnsan-format toplu yükleme: esnek başlık eşleme + `ROL_ADLARI` ad→kod çevirisi + görünür hata sütunu + "şablonu indir" (B-25); dropdown'larda insan-adı gösterimi + yerel ROLLER kopyasının kaldırılması (B-31). **Eksik kabul modeli (K-A6):** kimlik çekirdeği tam satırlar takım/bölge eksik olsa da yüklenir ve "eksik bilgili" işaretlenir; kullanıcı listesine eksik rozeti + tamamlama akışı (takım/bölge atama); firma aktivasyonu eksikli kullanıcı varken kilitli (PATCH `aktif=true` yolunda kontrol + FirmaSidebar'da sebepli engel mesajı).

**M4 — Modül sekmeleri.**
Önce görünürlük katmanları (T-Club → Eczanem → C-Club sırası önerilir; E-Club taşıma M2'de biter). Müdahale aksiyonlarının tamamı kapsamda (K-A1) — ileriye dönük "firma admini" kısıtlanabilirliğiyle. Her modül sekmesi ayrı iş adımıdır, kendi smoke testiyle kapanır. **Alt-iş:** Store firma-bazlılık geçiş planı (K-A2 — şema değişikliği; ayrı belge/onay turu ile).

**M5 — Kalanlar ve cila.**
Sistem ayarları jsonb (B-28); store sipariş durum matrisi (B-27); silme korumaları ailesi (B-29, B-30, B-38); test aracı push tabloları (B-34); N+1 (B-35); E-Club Store iptal alanları (B-37).

### C.4 Doğrulama

- Her faz sonunda üçlü doğrulama + faz kapsamına özel 1 smoke test (1 mutlu + 1 red).
- M0 sonrası: toplu yükleme/silme fiziksel testi tekrarlanır (11 kişilik gerçek dosyayla — insan-format M3'te; M0'da doğru başlıklı dosyayla).
- M2 sonrası: tüm panellere ana `/admin`'den erişilebildiğinin, Navbar'da admin yetim linki kalmadığının kontrolü.
- Tam kapanış: kalite raporundaki 22 bulgunun tamamının commit karşılığı işlenmiş olması.

### C.5 Kapalı kararlar (K-A serisi — İskender, 17.07.2026)

**K-A1 — Admin TÜM müdahaleleri yapabilir.** Modül sekmelerindeki müdahale adaylarının tamamı kapsamdadır (yayın durdur/başlat, challenge iptali, Eczanem müdahaleleri...). İleride "firma admini" rolü yaratılacak ve bazı yetkiler o role KAPATILACAK — yetki mimarisi bu geleceğe uygun kurulmalı (aksiyonlar tek yerde tanımlı, rol-bazlı kapatılabilir).

**K-A2 — Store katalogları firma bazlı OLACAK.** Gerekçe: her firma aynı ürün yelpazesini istemez (biri kitap+bilet, öbürü kitap+bilet+telefon...). Bugünkü global şema hedefe uymuyor; firma-bazlı kataloga geçiş şema değişikliği ister ve bu planın alt-işi olarak ayrıca planlanacak (M4 kapsamına "Store firma bazlılık planı" eklendi).

**K-A3 — Yeni tasarım.** Eski stil korunmaz; panel yeni görsel dille (login sayfası neslinden) yeniden tasarlanır.

**K-A4 — Sekme yerleşimi B.2 önerisiyle başlar.** Pratikte görünce gerekirse düzenlenir (yerleşim kararı canlı tutulur).

**K-A6 — Toplu yüklemede eksik kabul modeli (İskender kararı, 17.07.2026).** Kimlik çekirdeği (ad, soyad, e-posta, şifre, rol) TAM olan her satır yüklenir; takım/bölge eksiği ENGEL DEĞİLDİR — kullanıcı "eksik bilgili" işaretlenir, listede uyarıyla görünür, admin peşine düşer. Kimlik çekirdeği eksik satırlar fiziksel olarak yüklenemez (auth hesabı e-posta+şifresiz açılamaz) ama sebebiyle görünür listede kalır. **Firma aktivasyon kilidi:** firmada eksik bilgili kullanıcı varken firma aktifleştirilemez ("önce şu N kullanıcının eksiğini tamamla"). Gerekli ek iş: kullanıcı listesinde eksik rozeti + eksik tamamlama akışı (takım/bölge atama) — M3 kapsamında.

**K-A5 — Geçici çözüm YOK; ideal olan yapılır.** Sistem henüz canlıda tek kullanıcılı (İskender); aciliyet baskısı yoktur. İlke: "ideal, kaliteli, sürdürülebilir ve verimli olan yapılır" — ara yamalar (geçici Navbar linki vb.) atlanır, doğrudan M2 hedefi kurulur.

---

## D. Durum Notları

**M0 — KAPANDI (17.07.2026).** B-17, B-19, B-18+B-21+B-22, B-20, B-23, B-24 — her biri ayrı commit.

**M1 — KAPANDI (17.07.2026).** B-26, B-32, B-33, B-36.

**M3 — KOD TARAFI BİTTİ (18.07.2026); kapanış fiziksel test bekliyor.** Beş adım, beşi ayrı commit: M3-a eksik kabul modeli (K-A6 çekirdeği — eksik tanımı tek kaynak: `kullaniciEksikMi` + `firmaninEksikKullanicilari`, DB kolonu YOK, koddan türetilir); M3-b insan-format toplu yükleme (B-25 — `turkceKatla` başlık eşleme, `rolCoz` ad→kod, görünür hata, XLSX şablon); M3-c eksik rozeti + hücre içi tamamlama (PUT rol değişmeden atama, `rolGecisiCoz` aynı kaynak, "Eksik bilgili" filtresi); M3-d firma aktivasyon kilidi (isim isim sebepli engel); M3-e B-31 (ROLLER türetimi + insan adı gösterimi). Her adım üçlü doğrulama + saf-fonksiyon smoke ile kapandı (M3-d'nin rota+DB smoke'u bilinçli olarak fiziksel teste bırakıldı — canlı DB yazımı Code'a kapalı). **Kapanış koşulu:** İskender'in 11 kişilik gerçek insan-format dosyayla fiziksel toplu yükleme testi — M0 çekirdeğini ve M3 katmanını birlikte doğrular (test sırası kararı: D öncesi tek test, 18.07.2026).

**M2 — KAPANDI (18.07.2026).** M2-a kabuk + M2-b taşımalar + M2-c iki gruplu sekme çubuğu (Firma: Kullanıcılar | Organizasyon | Ürün & Teknik ‖ Modüller: T-Club | C-Club | E-Club | Eczanem; "Yapı" sekmesi ikiye bölündü, ölü alt-sekme kalıntıları temizlendi). Kapanış teyidi: (1) İskender panele girip tüm sekme/bölümlere erişimi ve yeni yerleşimi onayladı (K-A4 ilk bakış — sorun yok); (2) üç eski URL (`/admin/store`, `/admin/eclub`, `/admin/eclub-store`) canlıda doğrulandı — girişsiz ziyaretçi hepsinden `/login`'e düşüyor (redirect + auth kapısı zinciri çalışıyor, red senaryosu); (3) Navbar'da admin'e giden hiçbir link kalmadı (kod taraması temiz). Üçlü doğrulama her commit'te temizdi.

---

*Bu belge canlıdır: kararlar C.5'ten kapatıldıkça K-A serisi (kapalı karar) olarak işlenecek; fazlar ilerledikçe durum notları D bölümüne eklenecektir.*
