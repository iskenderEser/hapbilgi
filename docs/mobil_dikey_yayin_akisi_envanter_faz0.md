# FAZ 0 — Mobil Dikey Yayın Akışı Kapsam ve Kullanım Noktaları Envanteri

## 1. Başlangıç Durumu ve Çalışma Ağacı
- **Başlangıç Commit:** `a874ae957108c71fe0c06171a548a70b943e49e1`
- **Çalışma Ağacı:** Temiz (`working tree clean`).
- **Doğrulama Sonuçları:**
  - `npm run typecheck:build`: Başarılı (Next.js route types üretildi, 0 TypeScript hatası).
  - `npm run test:smoke`: Başarılı (427 test geçti, 0 hata, 0 atlanan).
- **AGENTS.md Uyumu:**
  - KVKK yurt dışı aktarımı, E-Club çek teslimat kuralı, TUS & Bunny Stream ayrımı ve veritabanında salt GUID saklama standartları okundu ve tam uyum taahhüt edildi.

---

## 2. Kapsama Alınan Yayın Yüzeyleri ve Rol–Rota–Bileşen Geçiş Matrisi

Aşağıdaki tablo, HapBilgi platformunda yayın/video kartı gösteren 11 ana kullanım yüzeyinin teknik envanterini içerir.

| # | Rol / Kimlik | Rota (URL) | Liste Bileşeni | Kart Bileşeni | Mevcut Mobil Düzen | Mevcut Masaüstü Düzen | Filtreler | Veri Kaynağı | Kayıt Anahtarı | Özel Aksiyonlar | Mevcut Sayfalama | Boş Durum Davranışı |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **1** | UTT, KD_UTT | `/ana-sayfa` | `UttAnaSayfa` -> `UttKayanVideoRafi` (KayanRaf) | `UttVideoKarti` -> `YayinKarti` | Dikey tek sütun (`grid-cols-1 gap-4`) | Yatay kayan raf (`overflow-x-auto`) | Yayın türü (tümü/video/podcast/gorsel/flip_pdf), Tanbur odak bölümü | `/ana-sayfa/api` | `yayin_id` | Beğeni, Favori, Tam Sayfa İzleme, Ekstra sayaç | Başlangıçta 2, "Daha Fazla Göster" ile +5 | Bölüm boşsa raf gizlenir |
| **2** | UTT, KD_UTT | `/videolarim/[kategori]` | `UttAnaSayfa` -> `KategoriYayinlariGoster` | `UttVideoKarti` -> `YayinKarti` | Dikey tek sütun (`grid-cols-1 gap-4`) | Çok sütunlu ızgara (`sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`) | Yayın türü filtresi, Metin arama | `/ana-sayfa/api` (kategoriye göre filtrelenmiş) | `yayin_id` | Beğeni, Favori, Tam Sayfa İzleme | Sayfalama yok (`adim: Infinity`, tüm liste tek seferde) | Boş durum kutusu ("Filtre kriterlerinize uygun içerik bulunamadı") |
| **3** | UTT, KD_UTT | `/ana-sayfa?durum=...` | `UttAnaSayfa` (aktifDurumVideolari) | `UttVideoKarti` -> `YayinKarti` | **2 sütunlu ızgara** (`grid-cols-2 gap-3`) *(Dikey kuralına aykırı)* | Çok sütunlu ızgara (`sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5`) | Durum filtresi (yeni/devam/tamamlanan), Yayın türü, Metin arama | `/ana-sayfa/api` | `yayin_id` | Beğeni, Favori, Tam Sayfa İzleme | Sayfalama yok (`adim: Infinity`) | Metin mesajı ("Bu filtrelere uygun içerik bulunamadı") |
| **4** | UTT, KD_UTT | `/oneriler`, `/oneriler/tamamlanan` | `UyeOnerilerGorunumu` | `YayinKarti` | Dikey tek sütun (`grid-cols-1 gap-4`) | Çok sütunlu ızgara (`sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`) | Durum filtresi (tümü/izlenecek/tamamlanan/suresi_dolan), Yayın türü, Metin arama | `/oneriler/api` | `oneri_id` | Beğeni, Favori, Öneri detaylı oynatıcıya yönlendirme, +10 Puan rozeti, Öneren/Tarih alt şeridi | Sayfalama yok (`adim: Infinity`) | Boş durum ikonu ve temizle butonu |
| **5** | BM, TM | `/ana-sayfa` | `SahaVideoRaflari` (`KayanRaf` ve `SabitBolum`) | `SahaVideoKarti` -> `YayinKarti` | Dikey tek sütun (`grid-cols-1 gap-4`) | `KayanRaf`: Yatay kayan (`overflow-x-auto`), `SabitBolum`: Izgara (`sm:grid-cols-2 ... xl:grid-cols-5`) | Yayın türü filtresi, Tanbur odak bölümü | `/ana-sayfa/api` | `yayin_id` | Tam sayfa salt izleme (puan/soru yok) | Başlangıçta 2, "Daha Fazla Göster" ile +5 (SabitBölüm mobilde akordiyon kutulu) | Bölüm boşsa gizlenir |
| **6** | Yönetici (YONETICI_ROLLER) | `/ana-sayfa` | `VideoBolumu` | **Özel Kart İşaretlemesi** (AracVarsayilanKapak + doğrudan HTML kartı) *(Önemli Bulgu)* | Dikey tek sütun (`grid-cols-1 gap-2.5`) | Izgara (`md:grid-cols-2 lg:grid-cols-3 gap-2.5`) | Filtre yok | `/ana-sayfa/api` | `yayin_id` | Tam sayfa salt izleme | Sayfalama yok (tüm videolar basılır) | `videolar.length === 0` ise null döner |
| **7** | YAYINDAKI_VIDEO_GORENLER (BM, TM, Yönetici) | `/yayindaki-videolar` | `KlasorGrid` -> `YayindakiVideoBolumu` | `YayinKarti` | Dikey tek sütun (`grid-cols-1 gap-4`) | Çok sütunlu ızgara (`sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`) | Departman seçimi (URL/state), Öneri modu filtresi, Metin arama | `/yayindaki-videolar/api` | `yayin_id` | BM için video önerme seçimi (+3 video limiti), Salt izleme | Sayfalama yok (`adim: Infinity`) | Boş klasör gizlenir / "Görüntülenecek yayında video yok" |
| **8** | Üretici Roller (URETICI_ROLLER) | `/sizin-yayinlariniz`, `/tum-yayinlar` | `UreticiYayinKatalogu` (`YayinRaflari` -> `KayanYayinRafi` -> `YayindakiVideoBolumu`) | `YayinKarti` | **Yatay kayan raf** (`overflow-x-auto`) *(Dikey kuralına aykırı)* | Yatay kayan raf (`overflow-x-auto` + butonlar) | Kapsam (benim/digerleri), Hedef kitle kartları, Departman kartları, Yayın türü, Metin arama | `/yayindaki-videolar/api?kapsam=...` | `yayin_id` | Tam sayfa izleme, Üreten kişi meta bilgisi | Sayfalama yok (yatay kaydırılır) | Boş durum metni ("Henüz yayında bir içeriğiniz yok") |
| **9** | BM | `/challenge-club` | `ChallengeClubPage` (`CcRaf` + `KartSarici`) | `UttVideoKarti` -> `YayinKarti` | **Yatay kayan raf** (`overflow-x-auto`) *(Dikey kuralına aykırı)* | Yatay kayan raf (`overflow-x-auto` + butonlar) | Sekmeler (İzlenecek, Gelenler, Gönderilenler) | `/challenge-club/api` | `yayin_id` / `challenge_id` | Challenge video izleme, Beğeni, Favori, Kilit durumu gösterimi, Gönderen/Alıcı meta şeridi | Sayfalama yok (yatay kaydırılır) | Özel ikonlu boş durum ("Henüz yayında olan CC videosu yok") |
| **10** | E-Club Kişisi (Eczacı, Eczane Teknisyeni) | `/eclub/panel` | `EclubFirmaVideoKatalogu` (`VideoRafi`) | `VideoKarti` -> `YayinKarti` | **Yatay kayan raf** (`overflow-x-auto`) *(Dikey kuralına aykırı)* | Yatay kayan raf (`overflow-x-auto` + butonlar) | Firma seçici, Bölümleme (Tüm İçerikler, En Çok Beğenilenler, En Çok Favorilenenler) | `/eclub/panel/api` | `oneri_id` | E-Club video oynatıcıda izleme, Beğeni, Favori, Kalan gün / Tamamlandı rozeti | Sayfalama yok (yatay kaydırılır) | Boş raf kesikli çizgi kutusu |
| **11** | Eczanem Müşterisi | `/eczanem` | `EczanemVideoRafi` | `YayinKarti` | **Yatay kayan raf** (`overflow-x-auto`) *(Dikey kuralına aykırı)* | Yatay kayan raf (`overflow-x-auto` + butonlar) | Bölümleme (Tüm İçerikler, En Çok Beğenilenler, En Çok Favorilenenler) | `/eczanem/api` | `video_id` / `yayin_id` | Eczanem video oynatıcıda izleme, Beğeni, Favori, Devam Et / Yeni rozetleri | Sayfalama yok (yatay kaydırılır) | Kesikli kenarlı boş durum mesajı |

---

## 3. Önemli Bulgular ve Sapmalar

1. **Önemli Bulgu 1: `VideoBolumu` Kart İşaretlemesi**
   - Yönetici ana sayfasında kullanılan `components/ana-sayfa/VideoBolumu.tsx`, ortak `YayinKarti` bileşenini kullanmamaktadır. Kendi inline Tailwind sınıfları, `AracVarsayilanKapak` ve bağımsız HTML markup'ı barındırmaktadır.
   - Merkezi bileşene geçildiğinde bu kart işaretlemesi standarda kavuşturulmalı veya kontrollü şekilde bağlanmalıdır.
2. **Önemli Bulgu 2: Mobilde Halen Yatay Kayan veya Çok Sütunlu Kalan Yüzeyler**
   - Üretici Katalogları (`/sizin-yayinlariniz`, `/tum-yayinlar`), Challenge Club (`/challenge-club`), E-Club Firma Kataloğu (`/eclub/panel`) ve Eczanem Müşteri Rafı (`/eczanem`) mobilde halen `overflow-x-auto` yatay kaydırma kullanmaktadır.
   - UTT Ana Sayfası durum filtreleme listesi (`aktifDurumVideolari`) mobilde `grid-cols-2` kullanmaktadır (tek sütun dikey kuralına aykırıdır).
3. **Önemli Bulgu 3: Sayfalama Uyumsuzluğu**
   - Referans UTT ve BM/TM ana sayfaları mobilde "başlangıçta 2, sonra +5" kuralını uygularken; Kategori Sayfaları, Öneriler, Klasör Detayları ve Yönetici Ana Sayfası tüm içerikleri tek seferde render etmektedir (`adim: Infinity`).

---

## 4. Yayın Kataloğu Olmayan Operasyonel Yüzeylerin Gerekçeli Ayrımı

Sistemde yayın verisi (başlık, teknik adı, thumbnail, talep no) taşıdığı halde **yayın kataloğu olmayan**, operasyonel iş akışı ve yönetim amaçlı olan yüzeyler ortak mobil yayın akışı kapsamı dışına alınmıştır:

1. **Yayın Yönetimi (`/yayin-yonetimi`):**
   - *Kullanılan Bileşenler:* `YayinSatir.tsx`, `BekleyenSatir.tsx`, `YayinKumandaPaneli.tsx`.
   - *Gerekçe:* Burası bir tüketim/keşif kataloğu değildir. Yayını durdurma, yayına alma, tarih planlama, soru seti inceleme ve onay operasyonlarının yapıldığı yönetim tablosudur.
2. **E-Club Video Gönderimi (`/eclub/videolarim`):**
   - *Kullanılan Bileşenler:* `VideoGonderimSatiri.tsx`, `DagitimIcerikOzeti.tsx`.
   - *Gerekçe:* Temsilcinin eczane çalışanlarına video atadığı, alıcı onay kutuları ve gönderim limitleri içeren bir dağıtım formudur.
3. **E-Club Gönderilen Videolar Geçmişi (`/eclub/gonderilen-videolar`):**
   - *Gerekçe:* Gönderilen önerilerin hangi tarihte kime gittiğini ve açılıp açılmadığını gösteren denetim akordiyonudur.
4. **BM ve TM Öneri Takibi (`/oneriler` - BM ve TM rolleri):**
   - *Kullanılan Bileşenler:* `BmOneriTakibi.tsx`, `TmOneriTakibi.tsx`.
   - *Gerekçe:* Bölgedeki UTT'lerin kendilerine atanan önerileri izleyip izlemediğini takip eden filtreli yönetim/denetim tablosudur.
5. **Talep Yönetimi ve Üretim Takibi (`/talepler`, `/yayin-takip`):**
   - *Gerekçe:* İçerik üretim süreçlerinin aşama ve durumlarını takip eden iş listeleridir.
6. **Store ve Sipariş Takibi (`/store`, `/eclub/store`):**
   - *Gerekçe:* Fiziksel ürün sipariş kataloğu ve sepet arayüzleridir.
7. **Raporlar (`/raporlar/...`):**
   - *Gerekçe:* İstatistiksel izlenme, tamamlama ve puan analiz tablolarıdır.

---

## 5. Kapsam Sınırları ve Mimari Taahhütler

1. **Tanbur İzolasyonu:**
   - UTT dışındaki sayfalara tanbur **kesinlikle eklenmeyecektir**.
   - UTT’deki mevcut tanbur **asla değiştirilmeyecektir**.
   - Merkezi yayın bileşeni içerisine tanbur, tanbur state'i veya tanbur bağımlılığı **kesinlikle konulmayacaktır**.
   - BM/TM ana sayfasında mevcut bulunan tanbur bağlantısı envantere işlenmiş olup bu iş kapsamında dokunulmayacaktır.
2. **İş Kuralları Bütünlüğü:**
   - Rol yetkileri, veri erişim sınırları, puan kazanımları, soru setleri, öneri mekanizmaları, challenge akışı ve oynatma izinleri korunacaktır.
3. **Masaüstü/Tablet Bütünlüğü:**
   - Mevcut `sm:` ve üzeri (tablet/masaüstü) ızgara ve kayan raf düzenleri aynen muhafaza edilecektir.
4. **Bu Fazın Sınırı:**
   - Faz 0 kapsamında hiçbir uygulama kodu veya davranışı değiştirilmemiş, sadece tespit ve envanter dokümantasyonu yapılmıştır.
