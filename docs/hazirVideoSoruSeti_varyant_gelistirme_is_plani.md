# hazırVideoSoruSeti Varyant Geliştirme İş Planı

*19.07.2026. Kaynak: F-07 açık ucu (docs/fiziksel_tespitler_ve_cozumler.md) — "Hazır Soru Setim Var" tek başına seçildiğinde işleme mekanizmasının olmayışı. İskender talebi: dört varyantın `lib/hazirVideoSoruSeti` modülü bağlamında kod üzerinden kontrolü (19.07, bu oturum) ve sonuçların iş planı olarak yazımı. Tüm tespitler kod kanıtlıdır; hiçbir dosya değiştirilmemiştir.*

## Kapsam ve terimler

- **Üretici:** Talebi açan rol. Hazır akış TÜM üretici rollere açıktır (`URETICI_ROLLER`, İskender kararı 19.07, `c753a2e`); onay yetkisi rolde değil üreticiliktedir — herkes yalnız kendi talebini yürütür (`uretici_id` şartı).
- **IU (içerik üreticisi):** Normal üretim hattının çalışanı (senaryo → video → soru seti).
- **Varyant:** Talep formundaki iki bağımsız anahtarın ("Hazır Videom Var" / "Hazır Soru Setim Var") dört kombinasyonu. Anahtarlar birbirine kilitli DEĞİLDİR (`useTalepFormu.ts:225-233` — toggle'lar bağımsız), dört kombinasyon da formdan açılabilir.
- **Modülün devreye girme koşulu:** `hazirZinciriKur` YALNIZ `hazir_video=true` taleplerde, üreticinin video onayı anında çağrılır (`app/talepler/api/hazir-video/route.ts:102`). `hazir_video=false` taleplerde hazır uçlar "Bu talep hazır video talebi değil" ile kapalıdır — modül hiç çalışmaz.

## Ortak parametre işleyişi (dört varyantta aynı)

Üretici, toplam soru sayısını (10/15/20/25) ve video başı soru sayısını talep aşamasında tanımlar; form ve API doğrular (`app/talepler/api/route.ts:192-196`). Sistem videoya kalıcı soru ataması yazmaz — izleme anında setten video başı sayı kadar rastgele seçer. Hazır set verildiğinde ikinci kilit sunucudadır: set sayısı = toplam, video başı ≤ toplam, Türkçe gerekçeli red (`lib/hazirVideoSoruSeti/parametreKontrol.ts`).

---

## Varyant 1 — Hazır video VAR, hazır soru seti YOK

**Mevcut davranış (kod kanıtlı):** Üretici onayında zincir kurulur; soru seti BOŞ açılır (`sorular: []`, `iu_id: null`), `soru_seti_durumu` kaydı AÇILMAZ, onay mesajı "Soru seti yazım süreci başlayabilir." (`zincir.ts:112-119`, `hazir-video/route.ts:116`). Boş set IU'nun soru seti listesine düşer — liste sorgusunun zincir join'leri hazır kolda da çözülür, senaryo "[Hazır Video — Senaryo Atlandı]" kaydı vardır. IU normal `PUT /soru-setleri/api` ile soruları yazar; soru sayısı talep zincirinden okunan `soru_seti_buyuklugu` ile denetlenir, yazımda `iu_id` IU'ya atanır (`app/soru-setleri/api/route.ts:80-100`); sonrası normal durum/onay akışı.

**Operasyonel iş bölümü:**
- *Üretici:* Talep formunu doldurur, video dosyasını seçer (form → doğrudan Bunny, TUS); yarım kalırsa/reddedilirse talep detayından yeniden yükler; önizlemede encode rozetini görür; videoyu onaylar. Sonra IU'nun yazdığı soru setini onaylar.
- *IU:* Tek işi soru setini yazmaktır — senaryo ve video işi YOKTUR.

**Sorun (ince nokta 1 — sinyalsizlik):** İş, üreticinin video onayı anında doğar; o anda HİÇBİR bildirim gitmez (zincir modülünde ve hazır-video ucunda sıfır bildirim çağrısı — grep teyitli). IU'nun elindeki tek sinyal talep açılışındaki genel "Yeni talep" bildirimidir; o an ortada yazılacak set yoktur, üretici onaylamazsa hiç olmayacaktır. IU işi ancak listeye kendiliğinden bakarsa görür. Normal hatta aynı anın bildirimi vardır: "Videon onaylandı, soru seti yazmaya hazır" (`app/videolar/api/durum/route.ts:109-118`).

**İnce nokta 2 (ikincil):** Soru seti listesinde durum filtresi seçiliyse, henüz durumu olmayan bu satır görünmez olur (filtre koşulu `s.son_durum && filtreler.has(...)` — `app/soru-setleri/page.tsx:172-174`); filtresiz görünümde görünür.

**Geliştirme gerekli mi:** EVET (küçük) — set doğduğu anda IU'lara bildirim (normal hattaki desenin aynısı). Filtre ince noktası ayrıca değerlendirilebilir (NOT düzeyi).

---

## Varyant 2 — Hazır video VAR, hazır soru seti VAR

**Mevcut davranış:** F-07 çözümünün kendisi (`a8a5429`). Form dosya + set önizlemeyi zorunlu kılar (`useTalepFormu.ts:349-356`); üretici onayında parametre kilidi çalışır, sorular OTOMATİK yazılır, `soru_seti_durumu` "onaylandı" açılır → yayın bekleyenlerine düşer (`zincir.ts:128-144`). Uçtan uca tutarlı.

**Operasyonel iş bölümü:**
- *Üretici:* Talep formunda dosya seçer + hazır seti girer/önizler; videoyu onaylar. Onayla birlikte içerik yayın hattına girer.
- *IU:* HİÇBİR işi yoktur.

**Geliştirme gerekli mi:** HAYIR. (Yalnız kesişen konu: aşağıdaki "açılış bildirimi" maddesi — bu kolda IU'ya giden "Yeni talep" bildirimi tümüyle gereksizdir.)

---

## Varyant 3 — Hazır video YOK, hazır soru seti VAR (AÇIK UCUN KENDİSİ)

**Mevcut davranış (kod kanıtlı):** Form kombinasyona izin verir, API veriyi kaydeder (`hazir_soru_seti_verisi` zorunlu — `app/talepler/api/route.ts:188-190`). Ama `hazir_video=false` olduğundan hazır uçlar talebi reddeder ve `hazirZinciriKur` HİÇ çağrılmaz; talep normal IU hattına düşer. Normal hattın hiçbir noktası — senaryo, video onayı, soru seti ekranları/uçları — `hazir_soru_seti` alanlarını OKUMAZ (grep: `app/videolar/api/durum`, `app/senaryolar/api/durum`, `app/soru-setleri/**`, `lib/utils/talepZinciri.ts` içinde sıfır referans). Video onaylanınca boş set açılır, IU'ya "soru seti yazmaya hazır" bildirimi gider; üreticinin girdiği hazır set DB'de ÖLÜ VERİ olarak kalır. Tek izi talep listesindeki "Hazır Soru Seti" rozetidir (`TalepListesi.tsx:102-112`).

**Sonuç:** Form vaadi ile sistem davranışı çelişir — üretici seti verdi, sistem IU'ya sıfırdan yazdıracak; üretici de kendi verdiği setin yerine IU'nun yazdığını onaylamak zorunda kalacak.

**Operasyonel iş bölümü (bugünkü fiili durum):**
- *Üretici:* Talep açar + hazır seti girer (boşa); sonra normal hattın tüm onaylarını yürütür: senaryo onayı → video onayı → soru seti onayı.
- *IU:* Normal hattın tamamını üretir: senaryo yazar, video yükler, soruları SIFIRDAN yazar — üreticinin seti önüne hiçbir ekranda gelmez.

**Geliştirme gerekli mi:** EVET — karar İskender'de, iki seçenek:
- **(a) İşleme:** Normal hatta video onayı anında (`app/videolar/api/durum/route.ts:87-96`) talep `hazir_soru_seti=true` ise boş set yerine hazır veri yazılır ve Varyant 2 deseniyle "onaylandı" durumu açılır (parametre kilidi dahil — `hazirParametreKontrol` burada da çağrılır). IU soru seti adımı bu talepte hiç doğmaz; "soru seti yazmaya hazır" bildirimi atlanır. Dikkat noktası: bu, normal hattın onay ucuna hazır modülünden bilinçli ve dar bir dokunuştur — F-07'nin "IU koluna dokunma" kararıyla çelişmemesi için işleme mantığı modülde kalır, uç yalnız çağırır.
- **(b) Engelleme:** Form ve API bu kombinasyonu reddeder ("Hazır soru seti yalnız hazır videoyla birlikte seçilebilir"); mevcut ölü kayıtlar için tek seferlik durum kararı verilir. Basit ama üreticiden yeteneği geri alır.

---

## Varyant 4 — Hazır video YOK, hazır soru seti YOK (normal hat)

**Mevcut davranış:** Klasik üretim hattı; `hazirVideoSoruSeti` modülü HİÇ devreye girmez — F-07'nin "IU koluna dokunmadan gruplama" kararı korunmuştur. Bildirim zinciri tamdır: talep açılışında tüm aktif IU'lara "Yeni talep"; senaryo onayında IU'ya "video yüklemeye hazır"; video onayında IU'ya "soru seti yazmaya hazır"; ara durumlarda üreticiye "inceleme bekliyor" / "revizyon istendi" bildirimleri (`senaryolar/api/durum`, `videolar/api/durum`, `soru-setleri/api/durum`).

**Operasyonel iş bölümü:**
- *Üretici:* Talep açar; senaryo, video ve soru seti onaylarını yürütür (revizyon hakları dahil).
- *IU:* Senaryo yazar, videoyu yükler (A2 — doğrudan Bunny), soru setini yazar.

**Geliştirme gerekli mi:** HAYIR.

---

## Kesişen konu — talep açılışındaki "Yeni talep" bildirimi

Talep açılışında tüm aktif IU'lara giden "Yeni talep" bildirimi KOŞULSUZDUR (`app/talepler/api/route.ts:232-248`) — hazır video kollarında da gider. Varyant 2'de IU'nun hiçbir işi yoktur (bildirim tümüyle gereksiz); Varyant 1'de işi çok sonra, video onayında doğar (bildirim erken ve yanıltıcı). Öneri: `hazir_video=true` taleplerde açılış bildirimi atlanır; Varyant 1'in bildirimi set doğduğu anda gider (G-2). Karar İskender'de.

## Önerilen geliştirme adımları (öncelik sırasıyla — hepsi İskender onayı bekler)

- **G-1 | Varyant 3 kararı ve uygulaması** — seçenek (a) işleme ya da (b) engelleme. Açık ucu kapatan asıl iş.
- **G-2 | Varyant 1 bildirimi** — hazır zincirde boş set açıldığında IU'lara bildirim; normal hattaki desenin aynısı.
- **G-3 | Açılış bildirimi ayarı (opsiyonel, NOT düzeyi)** — hazır video taleplerinde koşulsuz "Yeni talep" bildiriminin kaldırılması/koşullanması.
- **G-4 | Liste filtre ince noktası (opsiyonel, NOT düzeyi)** — durumu olmayan (yazım bekleyen) setin, durum filtresi seçiliyken listeden kaybolmaması.

## Doğrulama disiplini

Her adım: tsc + `npm run denetim` + `npm run lint:mimari` temiz; en fazla 1 smoke (1 mutlu + 1 red). Rol matrisi taraması yapılmaz — fiziksel teyit İskender'de. Canlı DB'ye yazan hiçbir komut oturumda çalıştırılmaz.

## Kararlar ve sonuç (19.07.2026 — KOD BİTTİ)

İskender kararları: **G-1 seçenek (a)** işleme · **G-3 evet** · **G-4 evet** ("kodlamada mantıksal hata, düzeltilecek"). G-2, G-3 ile çift olduğundan birlikte uygulandı (G-3 açılış bildirimini kaldırınca V1'in tek sinyali G-2 bildirimi olur — plan metnindeki bağ).

- **G-1a:** Modüle `hazirSoruSetiIsle` eklendi (parametre kilidi → sorular yazılır → "onaylandı" durumu). Normal hattın video onay ucu (`app/videolar/api/durum/route.ts`) talepte `hazir_soru_seti` varsa boş set açmak yerine bu fonksiyonu çağırır; IU'ya "yazmaya hazır" bildirimi gitmez, işleme hatasında onaylayana [SİSTEM] bildirimi düşer. İşleme mantığı modülde — uç yalnız çağırır (F-07 gruplama kararı korunur). `hazirZinciriKur` (V2) de aynı fonksiyonu kullanır — tek doğruluk kaynağı.
- **G-2:** V1'de boş set doğduğu anda tüm aktif IU'lara bildirim: "Hazır video onaylandı, soru seti yazmaya hazır: <ürün>" (`zincir.ts`; hazır kolda videoyu yükleyen IU olmadığından alıcı tüm aktif IU'lardır). Bildirim için `hazir-video` ucu talep sorgusuna ürün/teknik adı eklendi.
- **G-3:** Talep açılışındaki "Yeni talep" bildirimi `hazir_video=true` taleplerde atlanır (`app/talepler/api/route.ts`).
- **G-4:** Durum filtresi düzeltildi: durumu henüz olmayan satır (yazım bekleyen iş) filtre seçiliyken listeden düşmez (`app/soru-setleri/page.tsx:172-176`).

Üçlü doğrulama temiz. Smoke: modülün parametre kilidi F-07'de smoke'landı (`hazirParametreKontrol` mutlu+red); bu adım yeni saf fonksiyon eklemedi.

## Durum

**KOD BİTTİ — fiziksel teyit İskender'de.** Teyit adımları: (V3) normal hatta hazır setli talep → IU videosu onaylanınca setin otomatik "onaylandı" olup yayın bekleyenlerine düştüğü; (V1) video onayında IU'lara bildirim gittiği ve setin filtre açıkken de listede göründüğü; (V1/V2) talep açılışında IU'ya "Yeni talep" bildirimi GİTMEDİĞİ.
