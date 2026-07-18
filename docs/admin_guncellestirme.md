# Admin Güncelleştirme — Yapılan İşin Commit-Kanıtlı Kaydı

*18.07.2026. Bu belge, admin modernizasyonu uygulamasının (M0–M3 + upsert aşaması + T-serisi) commit kanıtlarıyla kaydıdır. Plan ve kararlar: `admin_modernizasyon_is_plani.md`; bulgu tanımları: `kalite_bulgu_raporu.md` §5. Bu belge, silinen `guvenilir_olmayan_refactoring_plani.md`'nin yerine geçer — o planın tüm maddeleri kapatılmıştır, kapanış koşulları ve devralınan disiplin aşağıdadır.*

---

## A. Faz kayıtları (commit kanıtlarıyla)

### M0 — Güvenilirlik tabanı (17.07.2026, 6 commit)

| Bulgu | İş | Commit |
|---|---|---|
| B-17 | Toplu yüklemede dürüst sonuç raporu — kısmi başarısızlık gizlenmez | `58a8063` |
| B-19 | Toplu sil/pasif satır yanıtlarını okur, başarısızlar seçili kalır | `ce471bc` |
| B-18+B-21+B-22 | Kullanıcı doğrulama kural kitabı tek kaynak; bölge firma kapsamına kilitli | `8dc1a2e` |
| B-20 | Export sorgu hatasında kesilir; `son_export_at` yalnız tam yedekte | `1ab3af2` |
| B-23 | Rol değişiminde takım/bölge tutarlılığı — yeni rolün kuralları | `16741b1` |
| B-24 | Kullanıcı silme sırası güvenli (arşiv → DB → Auth, telafili) | `ece0ed1` |

### M1 — Ortak çekirdek (17.07.2026, 4 commit)

| Bulgu | İş | Commit |
|---|---|---|
| B-26 | Tüm admin rotaları tek bekçide (`adminGirisKontrol`) + proxy çift katman | `4196029` |
| B-32 | Eski hook'lar ağ hatasına dayanıklı (try/catch/finally, input reset) | `1ba09f6` |
| B-33 | Sayfa kapıları `ADMIN_ROLLER`'a bağlandı — sabit 'admin' karşılaştırması kalktı | `bf41b9f` |
| B-36 | Şifre politikası: min 6, Türkçe mesaj, tekli+toplu aynı kural | `e0d9b15` |

### M2 — Bilgi mimarisi (17–18.07.2026, 3 commit) — KAPANDI

| Adım | İş | Commit |
|---|---|---|
| M2-a | Yeni kabuk: üst bar (global bölümler) + modül sekmeleri tek kaynaktan | `4ae1fb4` |
| M2-b | Taşımalar: E-Club sekmeye, Store'lar global bölümlere; eski URL'ler redirect, Navbar yetim linkleri kalktı | `d434c67` |
| M2-c | İki gruplu sekme çubuğu (Firma ‖ Modüller); Yapı sekmesi ikiye bölündü | `51be9aa` |

Kapanış teyidi İskender'den (18.07): panel gezildi, üç eski URL canlıda `/login`'e düşüyor, Navbar taraması temiz (`b8878b3` durum notu).

### M3 — Kullanıcı yönetimi modernizasyonu (18.07.2026, 5 commit + 1 fiziksel test düzeltmesi)

| Adım | İş | Commit |
|---|---|---|
| M3-a | Eksik kabul modeli (K-A6): eksik tanımı tek kaynak (`kullaniciEksikMi` + `firmaninEksikKullanicilari`) | `f55b103` |
| M3-b | İnsan-format toplu yükleme (B-25): `turkceKatla` başlık eşleme, `rolCoz`, görünür hata, XLSX şablon | `32a76e8` |
| M3-c | Eksik rozeti + hücre içi tamamlama; "Eksik bilgili" filtresi | `c4ae13c` |
| M3-d | Firma aktivasyon kilidi — isim isim sebepli engel | `172a3d4` |
| M3-e | B-31: yerel ROLLER kopyası kalktı, insan adı gösterimi | `5427fc4` |
| — | Fiziksel test bulgusu: Excel sayı tipi hücreleri artık boş sayılmıyor | `2c58999` |

### Upsert aşaması — K-A7 kararlarının uygulaması (18.07.2026, 3 commit + şema SQL)

| Adım | İş | Commit |
|---|---|---|
| Adım 1 | Şema: `kullanicilar.telefon` + benzersiz index + sahte `0532000XXXX` backfill | SQL — İskender uyguladı |
| Adım 2 | Telefon kimlik çekirdeğinde: `telefonNormalize` (05XXXXXXXXX), şablon/başlık/tekli form/liste; mükerrer telefon satır hatası | `68c9c81` |
| Adım 3 | Toplu yükleme upsert: `satirUpsertPlani` (e-posta+telefon eşleşme), şifre asla ezilmez, önizlemede İşlem sütunu, auth telafili güncelleme, tekil telefon ekleme | `0792bcb` |
| T-1/T-7 | Eksikli kullanıcı PASİF doğar, eksiği kapanınca otomatik aktifleşir; aktif firmaya eksikli yükleme = yükle+uyarı; amber satır vurgusu | `39f337f` |

### T-serisi — plan dışı iş yükünün kapanışı (18.07.2026)

18.07 soğuk taramasının 7 maddesinin tamamı kapatıldı:

| # | İş | Kapanış | Commit |
|---|---|---|---|
| T-1 | Aktif firmaya eksikli yükleme | İskender kararı: yükle + uyarı | `39f337f` |
| T-2 | FirmaSidebar "⚠ N eksik bilgili" rozeti — GET /firmalar `eksik_sayisi` (tek ek SELECT, `eksikSayilariCikar`), sebepli tooltip, sessiz tazeleme | kod bitti | `7faf018` |
| T-3 | Bordo görsel dili (K-A3): 23 bileşende tüm mavi vurgular `_constants.ts` bordo ailesine (RENK_BORDO + ZEMIN/KENAR); yerel MAVI/BORDO kopyaları silindi. Anlamsal renkler korundu (İskender kararı: Hazırlanıyor durum mavisi kalır; modül switch, amber eksik, kırmızı hata dilleri yerinde) | kod bitti | `fc5c6a6` |
| T-4 | PUT rol değişimi `rolCoz`'dan — rol kural kaynağı üçüncü rotada da tekleşti | kod bitti | `83baa45` |
| T-5 | Önizlemede rol insan adıyla; ham rolün DB'ye yazılma açığı kapandı | upsert Adım 3 içinde | `0792bcb` |
| T-6 | Dosya seçici `.xls` kabulü — rotayla eşitlendi | kod bitti | `97dde17` |
| T-7 | Eksikli kullanıcının doğum durumu | İskender kararı: pasif doğar + otomatik aktifleşme | `39f337f` |

---

## B. Kararların özeti

- **K-A6** (17.07): eksik kabul modeli — kimlik çekirdeği tam satır yüklenir, takım/bölge eksiği engel değil; firma aktivasyon kilidi.
- **K-A7** (18.07): upsert modeli + telefon kimlik çekirdeği. Kalıcı kimlik `kullanici_id`; Excel eşleştirme anahtarları e-posta + telefon; telefonsuz satır yüklenmez; ikinci liste günceller, şifre asla ezilmez (yalnız yeni kullanıcıda zorunlu), listede olmayana dokunulmaz, çakışma/mükerrer görünür satır hatası; tekil yol: liste hücresinden telefon ekleme (Enter → PUT).
- **T-1/T-7 kararları** (18.07): yukarıdaki tabloda.
- **T-3 istisnası** (18.07, İskender): sipariş durum etiketlerindeki anlamsal renkler bordo diline dahil değildir — Hazırlanıyor mavi kalır.

---

## C. Kapanış koşulları (devralınan — kod beyanı kapanış sayılmaz)

Silinen plandan devralınan ilke: **bu dönemin "bitti" beyanları İskender'in fiziksel kontrolünden geçmeden kapanmış sayılmaz.**

1. **Fiziksel toplu yükleme testi (M0+M3+upsert birlikte):** takım/bölge tanımlı firmayla tam akış — 11 kişilik gerçek insan-format dosya → önizleme → kaydet → eksik tamamlama → upsert ile ikinci liste → otomatik aktifleşme → firma kilidi/aktivasyon. (Önizleme aşaması 18.07'de fiziksel testte doğrulandı; kaydet/tamamlama/kilit akışları canlıda hiç koşulmadı.)
2. **T-2 canlı kontrolü:** firma kartında eksik rozeti + kullanıcı işlemi sonrası tazelenme (fiziksel testin içinde görülür).
3. **T-3 görsel kontrolü:** panelin bordo dilinin İskender onayı (K-A3/K-A4 — yerleşim kararı canlı).
4. M0 bulgu düzeltmeleri kod tarandı, canlı akış fiziksel testle doğrulanır.

DB durumu (18.07 salt-okur tespit): hepifarma'da kullanıcı 0, takım 0, bölge 0; auth'ta @test2.com hesabı 0 — test yükleme aşamasına geçmemişti, temizlenecek veri yok.

## D. Devralınan çalışma disiplini (fiziksel test kapanana dek geçerli)

1. Her madde öncesi plan İskender'e sunulur, onaysız kod yazılmaz.
2. Her madde ayrı commit; üçlü doğrulama (tsc + denetim + lint:mimari) zorunlu.
3. Smoke girdileri gerçek/insan-format veriden; idealize girdi yasak.
4. Plandan sapma ya da öngörülmeyen senaryo: DUR + tek cümleyle sor.
5. Kapanış beyanı İskender'den gelir.

---

*Sonraki iş: M4 (modül sekmeleri) ve M5 — `admin_modernizasyon_is_plani.md` C bölümünde bekliyor.*
