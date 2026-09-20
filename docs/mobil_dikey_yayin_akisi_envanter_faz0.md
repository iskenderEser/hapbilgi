# FAZ 0 — Mobil Dikey Yayın Akışı Kapsam ve Kullanım Noktaları Envanteri (Revize)

## 1. Başlangıç Durumu ve Çalışma Ağacı
- **Başlangıç Commit:** `a874ae957108c71fe0c06171a548a70b943e49e1`
- **İlk Envanter Commiti:** `89a7c523caf71a2f11fd65fe4f863f766ccfc4fd`
- **Çalışma Ağacı:** Temiz (`working tree clean`).
- **Doğrulama Sonuçları:**
  - `npm run typecheck:build`: Başarılı (Next.js route types eksiksiz üretildi, 0 TypeScript hatası).
  - `npm run test:smoke`: Başarılı (427 test geçti, 0 hata, 0 atlanan).
- **AGENTS.md Uyumu:**
  - KVKK yurt dışı aktarımı, E-Club çek teslimat kuralı, TUS & Bunny Stream ayrımı ve veritabanında salt GUID saklama standartları doğrulandı ve tam uyum sağlandı. Uygulama koduna dokunulmadı.

---

## 2. Kapsama Alınan Yayın Yüzeyleri ve Rol–Rota–Bileşen Geçiş Matrisi

Aşağıdaki tablo, HapBilgi platformunda yayın/video kartı gösteren tüm kullanım yüzeylerinin güncel ve kaynak kodla doğrulanmış teknik envanterini içerir.

| # | Rol / Kimlik | Rota (URL) | Liste Bileşeni | Kart Bileşeni | Mevcut Mobil Düzen | Mevcut Masaüstü Düzen | Filtreler | Veri Kaynağı | Kayıt Anahtarı | Özel Aksiyonlar | Mevcut Sayfalama | Boş Durum Davranışı | Kaynak Dosya ve Satır |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **1** | UTT, KD_UTT | `/ana-sayfa` | `UttAnaSayfa` -> `UttKayanVideoRafi` (KayanRaf) | `UttVideoKarti` -> `YayinKarti` | Dikey tek sütun (`grid-cols-1 gap-4`) | Yatay kayan raf (`overflow-x-auto`) | Yayın türü (tümü/video/podcast/gorsel/flip_pdf), Tanbur odak bölümü | `/ana-sayfa/api` | `yayin_id` | Beğeni, Favori, Tam Sayfa İzleme, Ekstra sayaç | Başlangıçta 2, "Daha Fazla Göster" ile +5 | Bölüm boşsa raf gizlenir | `components/ana-sayfa/UttAnaSayfa.tsx` (L485-L569), `components/video/UttVideoKarti.tsx` (L118-L186) |
| **2** | UTT, KD_UTT | `/videolarim/[kategori]` | `UttAnaSayfa` -> `KategoriYayinlariGoster` | `UttVideoKarti` -> `YayinKarti` | Dikey tek sütun (`grid-cols-1 gap-4`) | Izgara (`sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`) | Yayın türü filtresi, Metin arama | `/ana-sayfa/api` (kategoriye göre filtrelenmiş) | `yayin_id` | Beğeni, Favori, Tam Sayfa İzleme | Sayfalama yok (`adim: Infinity`, tüm liste tek seferde) | Boş durum kutusu ("Filtre kriterlerinize uygun içerik bulunamadı") | `app/(panel)/videolarim/[kategori]/page.tsx` (L19-L27), `components/ana-sayfa/UttAnaSayfa.tsx` (L103-L121) |
| **3** | UTT, KD_UTT | `/ana-sayfa` (aktifDurumFiltresi) | `UttAnaSayfa` (aktifDurumVideolari) | `UttVideoKarti` -> `YayinKarti` | Dikey tek sütun (`grid-cols-1 gap-4`) | Çok sütunlu ızgara (`sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`) | `aktifDurumFiltresi` state (yeni/devam/tamamlanan) *(URL parametresi veya arama yok)* | `/ana-sayfa/api` (`durumListeleri[aktifDurumFiltresi]`) | `yayin_id` | Beğeni, Favori, Tam Sayfa İzleme | Sayfalama yok (tüm durum listesi tek seferde basılır) | Boş durum kutusu ("Bu durumda öğrenme içeriği bulunmuyor") | `components/ana-sayfa/UttAnaSayfa.tsx` (L464-L480) |
| **4** | UTT, KD_UTT | `/oneriler`, `/oneriler/tamamlanan` | `UyeOnerilerGorunumu` | `YayinKarti` | Dikey tek sütun (`grid-cols-1 gap-4`) | Çok sütunlu ızgara (`sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`) | Durum filtresi (tümü/izlenecek/tamamlanan/suresi_dolan), Yayın türü, Metin arama | `/oneriler/api` | `oneri_id` | Beğeni, Favori, Öneri detaylı oynatıcıya yönlendirme, +10 Puan rozeti, Öneren/Tarih alt şeridi | Sayfalama yok (`adim: Infinity`) | Boş durum ikonu ve temizle butonu | `app/(panel)/oneriler/_components/UyeOnerilerGorunumu.tsx` (L297-L391) |
| **5** | BM, TM | `/ana-sayfa` | `SahaVideoRaflari` (`KayanRaf` ve `SabitBolum`) | `SahaVideoKarti` -> `YayinKarti` | Dikey tek sütun (`grid-cols-1 gap-4`) | `KayanRaf`: Yatay kayan (`overflow-x-auto`), `SabitBolum`: Izgara (`sm:grid-cols-2 ... xl:grid-cols-5`) | Yayın türü filtresi, Tanbur odak bölümü | `/ana-sayfa/api` | `yayin_id` | Tam sayfa salt izleme (puan/soru yok) | Başlangıçta 2, "Daha Fazla Göster" ile +5 (SabitBölüm mobilde akordiyon kutulu) | Bölüm boşsa gizlenir | `components/ana-sayfa/SahaVideoRaflari.tsx` (L69-L111, L162-L186) |
| **6** | Yönetici (YONETICI_ROLLER) | `/ana-sayfa` | `VideoBolumu` | **Özel Kart İşaretlemesi** (AracVarsayilanKapak + doğrudan HTML kartı) *(Önemli Bulgu)* | Dikey tek sütun (`grid-cols-1 gap-2.5`) | Izgara (`md:grid-cols-2 lg:grid-cols-3 gap-2.5`) | Filtre yok | `/ana-sayfa/api` | `yayin_id` | Tam sayfa salt izleme | Sayfalama yok (tüm videolar basılır) | `videolar.length === 0` ise null döner | `components/ana-sayfa/VideoBolumu.tsx` (L34-L83), `components/ana-sayfa/YoneticiAnaSayfa.tsx` (L200-L203) |
| **7** | YAYINDAKI_VIDEO_GORENLER (BM, TM, Yönetici) | `/yayindaki-videolar` | `KlasorGrid` -> `YayindakiVideoBolumu` | `YayinKarti` | Dikey tek sütun (`grid-cols-1 gap-4`) | Çok sütunlu ızgara (`sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`) | Departman seçimi (URL/state), Öneri modu filtresi, Metin arama | `/yayindaki-videolar/api` | `yayin_id` | BM için video önerme seçimi (+3 video limiti), Salt izleme | Sayfalama yok (`adim: Infinity`) | Boş klasör gizlenir / "Görüntülenecek yayında video yok" | `app/(panel)/yayindaki-videolar/_components/KlasorGrid.tsx` (L81-L100), `YayindakiVideoBolumu.tsx` (L53-L113) |
| **8** | Üretici Roller (URETICI_ROLLER) | `/sizin-yayinlariniz`, `/tum-yayinlar` | `UreticiYayinKatalogu` (`YayinRaflari` -> `KayanYayinRafi` -> `YayindakiVideoBolumu`) | `YayinKarti` | **Yatay kayan raf** (`overflow-x-auto`) *(Dikey kuralına aykırı)* | Yatay kayan raf (`overflow-x-auto` + butonlar) | Kapsam (benim/digerleri), Hedef kitle kartları, Departman kartları, Yayın türü, Metin arama | `/yayindaki-videolar/api?kapsam=...` | `yayin_id` | Tam sayfa izleme, Üreten kişi meta bilgisi | Sayfalama yok (yatay kaydırılır) | Boş durum metni ("Henüz yayında bir içeriğiniz yok") | `app/(panel)/yayindaki-videolar/_components/UreticiYayinKatalogu.tsx` (L54-L75, L103-L116) |
| **9** | BM | `/challenge-club` | `ChallengeClubPage` (`CcRaf` + `KartSarici`) | `UttVideoKarti` -> `YayinKarti` | **Yatay kayan raf** (`overflow-x-auto`) *(Dikey kuralına aykırı)* | Yatay kayan raf (`overflow-x-auto` + butonlar) | Sekmeler (İzlenecek, Gelenler, Gönderilenler) | `/challenge-club/api` | `yayin_id` / `challenge_id` | Challenge video izleme, Beğeni, Favori, Kilit durumu gösterimi, Gönderen/Alıcı meta şeridi | Sayfalama yok (yatay kaydırılır) | Özel ikonlu boş durum ("Henüz yayında olan CC videosu yok") | `app/(panel)/challenge-club/page.tsx` (L509-L525, L604-L710) |
| **10** | E-Club Kişisi (Eczacı, Eczane Teknisyeni) | `/eclub/panel` ve `/eclub/panel/firma/[firma_id]` | `EclubFirmaVideoKatalogu` (`VideoRafi`) | `VideoKarti` -> `YayinKarti` | **Yatay kayan raf** (`overflow-x-auto`) *(Dikey kuralına aykırı)* | Yatay kayan raf (`overflow-x-auto` + butonlar) | Firma seçici, Bölümleme (Tüm İçerikler, En Çok Beğenilenler, En Çok Favorilenenler) | `/eclub/panel/api` | `oneri_id` | E-Club video oynatıcıda izleme, Beğeni, Favori, Kalan gün / Tamamlandı rozeti | Sayfalama yok (yatay kaydırılır) | Boş raf kesikli çizgi kutusu | `app/(panel)/eclub/panel/_components/EclubFirmaVideoKatalogu.tsx` (L79-L89), `app/(panel)/eclub/panel/firma/[firma_id]/page.tsx` (L1) |
| **11** | Eczanem Müşterisi | `/eczanem` | `EczanemVideoRafi` | `YayinKarti` | **Yatay kayan raf** (`overflow-x-auto`) *(Dikey kuralına aykırı)* | Yatay kayan raf (`overflow-x-auto` + butonlar) | Ağaç kapsamı (`tum`, `eczane`, `firma`, `urun`, `arac`), Yayın türü filtresi, 6 Ayrı Raf | `/eczanem/api/videolar` | `${baslik}-${video.gonderim_id}` *(gonderim_id korunmalıdır)* | Eczanem video oynatıcıda izleme, Beğeni/Favori toggle (`/eczanem/api/etkilesim`), Devam Et / Yeni rozeti | Sayfalama yok (yatay kaydırılır) | Kesikli kenarlı boş durum kutusu | `app/eczanem/_components/EczanemVideoRafi.tsx` (L137-L165), `app/eczanem/page.tsx` (L70, L95-L141, L268-L276) |
| **12** | Üretici ve Yönetici Roller | `/yayin-yonetimi` (Aktif Yayınlar Sekmesi) | `YayinYonetimiPage` | `YayinSatir` (`kartGorunumu={true}`) | Dikey tek sütun (`grid-cols-1 items-start gap-3`) | Çok sütunlu ızgara (`sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5`) | Hedef kitle filtresi (utt/kd_utt/bm/tm/eczaci/vb.), Durum filtresi (sekme), Metin arama | `/yayin-yonetimi/api` | `yayin_id` | Yayını durdurma (`onDurumDegistir`), Planlama tarihi/tekrar düzenleme (`onPlanIslem`), Önizleme/video açma (`onVideoAc`, `onOnizle`) | `useListe` ve `DahaFazlaGoster` ile kademeli | Boş liste mesajı ("Bu hedef kitle için aktif yayın yok") | `app/(panel)/yayin-yonetimi/page.tsx` (L245-L278), `app/(panel)/yayin-yonetimi/_components/YayinSatir.tsx` |

---

## 3. Önemli Bulgular

1. **`VideoBolumu` Kart İşaretlemesi:**
   - Yönetici ana sayfasında kullanılan `components/ana-sayfa/VideoBolumu.tsx`, ortak `YayinKarti` bileşenini kullanmamaktadır. Kendi inline Tailwind sınıfları, `AracVarsayilanKapak` ve bağımsız HTML markup'ı barındırmaktadır. Merkezi bileşene geçişte bu kart işaretlemesi standarda kavuşturulacaktır.
2. **Mobilde Halen Yatay Kayan Yüzeyler:**
   - Üretici Yayın Katalogları (`/sizin-yayinlariniz`, `/tum-yayinlar`), Challenge Club (`/challenge-club`), E-Club Kişi Paneli (`/eclub/panel`, `/eclub/panel/firma/[firma_id]`) ve Eczanem Müşteri Rafı (`/eczanem`) mobilde halen `overflow-x-auto` yatay kaydırma kullanmaktadır.
3. **UTT Durum Listesi:**
   - `UttAnaSayfa.tsx` içindeki `aktifDurumVideolari` listesi, sanılanın aksine 2 sütunlu değil; kodda zaten `grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3...` olarak dikey tek sütundur. Bu görünüm URL parametresi (`/ana-sayfa?durum=...`) değil, sayfa içi `aktifDurumFiltresi` React state'i ile açılmaktadır.
4. **Eczanem Anahtar ve Veri Kaynağı:**
   - `EczanemVideoRafi.tsx` bileşeni kart anahtarı olarak `video.yayin_id` değil, `${baslik}-${video.gonderim_id}` kullanmaktadır. Eczanem müşterisi aynı yayını farklı gönderimlerle alabileceği için gönderim kimliği (`gonderim_id`) merkezileştirmede korunacaktır.
   - Veri kaynağı `/eczanem/api` değil, doğrudan `/eczanem/api/videolar` uç noktasıdır.
5. **Yayın Yönetimi Aktif Yayınlar Bölümü:**
   - `/yayin-yonetimi` sayfasının "Aktif Yayınlar" sekmesi (`aktifSekme === "yayinda"`), `YayinSatir` bileşenine `kartGorunumu={true}` prop'u geçerek gerçek yayın kartları grid'i oluşturmaktadır. Bu liste mobil dikey akış kapsamına alınmıştır; üzerindeki durdurma, planlama ve önizleme aksiyonları korunacaktır.

---

## 4. Yayın Kataloğu Olmayan Operasyonel Yüzeylerin Gerekçeli Ayrımı

Sistemde yayın bilgisi taşıdığı halde **yayın kataloğu olmayan**, operasyonel iş akışı, dağıtım ve yönetim amaçlı olan yüzeyler incelenmiş ve gerekçeleriyle ayrılmıştır:

1. **Yayın Yönetimi — Onay ve Durdurulan İşlem Satırları (`/yayin-yonetimi`):**
   - *Bileşenler:* `BekleyenSatir.tsx` (Yayına Hazır İçerikler sekmesi), `YayinSatir.tsx` (`kartGorunumu={false}`, Durdurulan Yayınlar sekmesi).
   - *Gerekçe:* Buradaki öğeler kart değil, yayın onaylama, puan/barem atama, tekrar periyodu belirleme ve yayından kaldırma işlemlerinin yapıldığı genişletilebilir işlem satırlarıdır. (Aktif Yayınlar sekmesindeki kart listesi ise madde 12 olarak kapsama alınmıştır).
2. **E-Club Video Dağıtım / Öneri Gönderim Formu (`/eclub/videolarim`):**
   - *Bileşenler:* `VideoGonderimSatiri.tsx`, `DagitimIcerikOzeti.tsx`.
   - *Gerekçe:* Temsilcinin eczane çalışanlarını seçtiği, kota/limit kontrolü yaptığı ve video önerisi yolladığı işlem formudur; kart değil işlem satırıdır.
3. **E-Club Gönderilen Videolar Geçmişi (`/eclub/gonderilen-videolar`):**
   - *Gerekçe:* Geçmiş önerilerin hangi tarihte kime iletildiğini ve açılma durumunu gösteren denetim akordiyonudur.
4. **BM ve TM Öneri Takibi (`/oneriler` - BM ve TM görünümleri):**
   - *Bileşenler:* `BmOneriTakibi.tsx`, `TmOneriTakibi.tsx`.
   - *Gerekçe:* Bölgedeki UTT'lerin kendilerine atanan önerileri izleme durumunu denetleyen yönetim ve denetim tablosudur.
5. **Eczanem Temsilci Dağıtım Yönetimi (`/eczanem/utt`):**
   - *Bileşenler:* `UttVideoGonderimSatiri.tsx`, `DagitimIcerikOzeti.tsx`.
   - *Gerekçe:* UTT'nin kendi bölgesindeki eczanelere içerik dağıtım eşiklerini, gönderim oranlarını ve hazır eczane durumunu yönettiği katlanabilir dağıtım satırlarıdır.
6. **Eczanem Eczane Müşteri Dağıtım Paneli (`/eczanem/eczane/dagitim`):**
   - *Bileşenler:* `EczanemVideoGonderimSatiri.tsx`.
   - *Gerekçe:* Eczanenin kendi danışan/müşteri listesine video ataması yaptığı, müşteri arama ve çoklu seçim onay kutuları içeren dağıtım yönetim tablosudur.
7. **Talep Yönetimi ve Üretim Takibi (`/talepler`, `/yayin-takip`):**
   - *Gerekçe:* İçerik üretim görev ve onay tablolarıdır.
8. **Store ve Sipariş Takibi (`/store`, `/eclub/store`):**
   - *Gerekçe:* Fiziksel ürün sipariş katalogları ve sipariş takip tablolarıdır.
9. **Raporlar (`/raporlar/...`):**
   - *Gerekçe:* İstatistiksel izlenme, tamamlama ve puan analiz tablolarıdır.

---

## 5. Kapsam Sınırları ve Mimari Taahhütler

1. **Tanbur İzolasyonu:**
   - UTT dışındaki sayfalara tanbur **kesinlikle eklenmeyecektir**.
   - UTT’deki mevcut tanbur **asla değiştirilmeyecektir**.
   - Ortak yayın bileşeni içerisine tanbur, tanbur state'i veya tanbur bağımlılığı **kesinlikle konulmayacaktır**.
   - BM/TM ana sayfasında mevcut bulunan tanbur bağlantısı envantere işlenmiş olup korunacaktır.
2. **İş Kuralları Bütünlüğü:**
   - Rol yetkileri, veri erişim sınırları, puan kazanımları, soru setleri, öneri mekanizmaları, challenge akışı, eczanem gönderim kimlikleri ve oynatma izinleri korunacaktır.
3. **Masaüstü/Tablet Bütünlüğü:**
   - Mevcut `sm:` ve üzeri (tablet/masaüstü) ızgara ve kayan raf düzenleri aynen muhafaza edilecektir.
4. **Kod Değişmezliği Taahhüdü:**
   - Faz 0 kapsamında hiçbir uygulama kodu veya davranışı değiştirilmemiştir.
