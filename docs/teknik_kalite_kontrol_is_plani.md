# Teknik Kalite Kontrol — Teknik İş Planı

*Gerekçe somuttur: `tsc` + `denetim` + `lint:mimari` üçlüsü "kod düzgün mü"ye bakar; ama bu döngüde yakalanan gerçek hataların hiçbiri o sınıftandı değildi — UTT ana sayfasında hedef_rol süzgecinin hiç olmaması (sızıntı), `rolCozucu`'nun service_role ile boş view okuması (66 dosyayı kıran canlı bug), Eczanem tablolarının GRANT'sız doğması. Üçü de "yanlış kod" değil "eksik/yanlış tasarımın koda yansıması"ydı ve üçlüden temiz geçti. Bu plan o sınıf hatayı sistematik arar: kod desenleri + DB veri tutarlılığı + belge-kod uyumu. Referans: docs/hapbilgi_teknik_rapor_guncel.md (redbook, 12.07.2026 sürümü). Belge canlıdır; her adım §7'de tiklenir.*

*Son güncelleme: 12.07.2026 — Plan yazıldı; D1–D4 kararları KAPANDI (İskender): D1 Code koşar (salt-okuma), D2 bilinen tutarsızlıklar düzeltilir, D3 login temizliği yapılır, D4 KRİTİK+ORTA düzeltilir / NOT'lar §6.4'e. Plan uygulamaya hazır — sıradaki adım Q-0.*

---

## İçindekiler
- [1. Amaç ve üç katman modeli](#1-amaç-ve-üç-katman-modeli)
- [2. Kapsam ve kapsam dışı](#2-kapsam-ve-kapsam-dışı)
- [3. Denetim envanteri](#3-denetim-envanteri)
- [4. Çalışma disiplini ve maliyet frenleri](#4-çalışma-disiplini-ve-maliyet-frenleri)
- [5. Kararlar — İskender](#5-kararlar--i̇skender)
- [6. Uygulama sırası](#6-uygulama-sırası)
- [7. Durum takibi](#7-durum-takibi)

## 1. Amaç ve üç katman modeli

Kalite güvencesi üç katmandır; bu plan **yalnızca 2. katmanı** kurar ve bir kez uçtan uca koşar:

1. **Statik denetimler (VAR, korunur):** `tsc` + `npm run denetim` (kod↔DB şema) + `npm run lint:mimari`. 
2. **Tutarlılık denetimi (BU PLAN):** kodun ve verinin *iş kurallarına* uyumu — süzgeç bütünlüğü, veri simetrisi, belge-kod tutarlılığı. Tek seferlik tarama + bulgu raporu + onaylı düzeltmeler + **kalıcı script ailesi** (`npm run denetim:tutarlilik`).
3. **Fiziksel testler (AYRI, planlı):** U10 + U7 + Eczanem U11 + final test (redbook §6.4 Doğrulama bloğu). Bu plandan **sonra** koşulur — tarama önce, ki testler temiz zeminde yapılsın.

## 2. Kapsam ve kapsam dışı

**Kapsamda:** Tüm repo kodu (app/, lib/, components/, tools/, scripts/); DB'nin salt-okuma veri tutarlılık sorguları; redbook iddiaları ↔ kod gerçeği karşılaştırması; bilinen açık tutarsızlıkların (aşağıda T-B listesi) kapatılması (D2-D3 onayına bağlı).

**Kapsam DIŞI (bilinçli):**
- **RLS** — K-E7 kararı ve §6.4 güvenlik bloğu gereği ayrı iş; bu plan yalnızca RLS'e hazırlık notu üretir (hangi sorgular anon'la kırılır listesi — T-K7).
- **Fiziksel test senaryoları** — §6.4 Doğrulama bloğunda, bu planın ARDINDAN.
- **Performans iyileştirmeleri** (üretici N+1, HB Ligi ölçeği) — bulgu olarak raporlanır, düzeltilmez.
- **Yeni özellik** — hiçbir koşulda; bu plan yalnızca mevcut kuralların doğruluğunu arar.

## 3. Denetim envanteri

### 3.1 Kod desen taramaları (T-K serisi — Code yürütür, salt okuma)

| No | Tarama | Aradığı hata sınıfı (emsal) |
|---|---|---|
| T-K1 | **Süzgeç bütünlüğü:** `v_yayin_detay` / `yayin_yonetimi` okuyan HER sorguda hedef süzgeci (`hedef_rol`/`hedef_roller`) var mı; yoksa gerekçeli mi (yorumla)? | utt.ts sızıntısı emsali — aynı sınıftan başka sorgu kaldı mı? |
| T-K2 | **Kimlik bağlamı uyumu:** `auth.uid()` filtreli view'ları (`v_auth_kimlik`) service_role ile sorgulayan yer kaldı mı? Genel kural: her view tüketiminde çağıranın kimlik bağlamı ile view filtresi uyumlu mu? | rolCozucu bug'ı emsali |
| T-K3 | **user_metadata kalıntıları:** yetki/dallanma amaçlı `user_metadata.rol` / `eclub_kisi` okuyan client/route kaldı mı? (Bilinen: login/page.tsx) | TB1 client kuyruğu |
| T-K4 | **Korumalı tablolara kaçak yazım:** `KORUMALI_TABLOLAR`'a `.update`/`.delete`/`.upsert` — lint kuralı yalnızca `.insert`'i mi kapsıyor? Kapsam boşluğu varsa kural genişletme önerisi | lint kör noktası |
| T-K5 | **Hata yutma:** kritik yazım zincirlerinde (puan, sipariş, tur) `catch`+log'la yutulup akışın "başarılı" döndüğü yerlerin envanteri — hangileri bilinçli (yorumlu), hangileri sessiz? | sessiz veri kaybı riski |
| T-K6 | **Rol listesi tutarlılığı:** rol sabitleri (`roller.ts`) dışında hard-coded rol dizisi/string karşılaştırması kalan dosyalar | tek kaynak ihlali |
| T-K7 | **RLS hazırlık envanteri (rapor-only):** anon key ile DB okuyan tüm noktalar (AuthProvider, login firma-kontrolü, artifact/client sorguları) — RLS açılınca kırılacaklar listesi | RLS işinin girdisi |
| T-K8 | **Ortam/anahtar hijyeni:** `.env*` referansları, K-E8 çift kilidinin fiilen `VERCEL_ENV`/`NODE_ENV` koşuluna bağlı olduğunun kod teyidi, canlıya sızabilecek test kapısı var mı? | girişsiz test endpoint sınıfı |

### 3.2 DB veri tutarlılığı (T-D serisi — salt-okuma SQL seti; yürütücü D1 kararına bağlı)

Her madde bir SQL'dir; İHLAL SATIRI döndürür (boş dönüş = temiz). Q3'te `scripts/denetim/tutarlilik/` altında kalıcılaşır.

| No | Kontrol |
|---|---|
| T-D1 | Üretim zinciri bütünlüğü: `yayinda` durumundaki her yayının talep→senaryo→video→soru seti→video_puanı→soru_puanları zinciri eksiksiz mi |
| T-D2 | `hedef_rol` CHECK-dışı / `hedef_roller` boş-dizi kayıt var mı |
| T-D3 | Rol-izleme uyumu: `hedef_roller` X olan yayını X-dışı rolün izleme/puan kaydı var mı (sızıntının VERİ tarafı testi — geçmişte sızmış kayıt kaldıysa görünür) |
| T-D4 | Tur tutarlılığı: `UNIQUE(yayin_id,tur_no)` dışı anomali, tur-1'i olmayan periyotlu yayın, `baslangic_tarihi` sıra bozukluğu |
| T-D5 | Extra kural ihlali: aynı max(ay,tur) penceresinde aynı kişi-yayın için 1'den fazla 'extra' puan kaydı |
| T-D6 | Puansız pencere ihlali: `puanKazanilabilirMi` dışı `izleme_baslangic`'lı kazanım kaydı |
| T-D7 | Kazanım-kayıp simetrisi: süresi geçmiş, izlenmemiş öneride ne puan ne kayıp kaydı olan "kayıp" satırlar |
| T-D8 | Eczanem ledger: `kalan_puan > puan` veya `kalan_puan < 0`; harcama eşleme toplamı ≠ sipariş `kullanilan_puan` olan onaylı sipariş |
| T-D9 | Eczanem teklikler: `UNIQUE` kısıtlarının fiilen var olduğunun kanıtı (pg_constraint) + dörtlü kilit kolonlarında NULL |
| T-D10 | Kimlik düzlemleri: `v_auth_kimlik_admin`'de aynı `auth_id`'nin birden çok düzlemde görünmesi; `kullanicilar`/`eclub_kisiler`/`eczanem_musteriler`'de sahipsiz auth bağı |
| T-D11 | Rapor-lig tutarlılığı: örneklem kullanıcılar için `get_kullanici_ozet` net puanı ile lig view puanının birebirliği |
| T-D12 | GRANT/izin envanteri: tüm `eczanem_*` + son dönem tablolarında rol bazlı izin dökümü — beklenen desenle (service_role açık, anon kapalı) fark |

### 3.3 Belge-kod uyumu (T-B serisi — redbook iddiası ↔ kod gerçeği)

Bilinenlerden başlar, örneklem taramayla genişler:
- **T-B1 (bilinen):** kd_utt'nin `/izle` listesi — `get_izle_videolari`'na ham rol geçiliyor, `kd_utt` hiçbir `hedef_roller`'la eşleşmez → boş liste şüphesi. Doğrula; doğruysa düzeltme önerisiyle raporla.
- **T-B2 (bilinen):** Talep formu Eczacı/Ecz.Teknisyeni seçeneği sunuyor, API reddediyor — form-API tutarsızlığı. Karar D2'ye bağlı düzeltme.
- **T-B3 (bilinen):** login'de ölü "Şifremi unuttum" linki + metadata okumaları (T-K3 ile birleşik).
- **T-B4 (bilinen):** K-E1 ifade tutarlılığı — Eczanem teknik planında karar "Turkcell (kapalı)"; redbook §6.4 "sağlayıcı seçimi kararı gelmeden çıkılamaz" diyor. Hangisi doğruysa iki belge eşitlenir (muhtemel doğru okuma: karar verildi, sözleşme/entegrasyon bekliyor — ifade netleşsin).
- **T-B5 (örneklem):** Redbook'un her ana bölümünden 3'er somut iddia seçilir (dosya adı/kural/davranış), kodda doğrulanır. Amaç tam tarama değil; belge güvenilirlik ölçümü.

## 4. Çalışma disiplini ve maliyet frenleri

- **Q0 kuralı — SIFIR DEĞİŞİKLİK:** Tarama aşamasında hiçbir dosya değiştirilmez, hiçbir DB yazımı yapılmaz. Çıktı yalnızca `docs/kalite_bulgu_raporu.md`'dir.
- **Bulgu formatı:** `B-## | kategori (T-K/T-D/T-B) | kanıt (dosya:satır ya da SQL çıktısı) | önem (KRİTİK/ORTA/NOT) | önerilen düzeltme (1-2 cümle)`.
- **Maliyet frenleri (CLAUDE.md'ye ek — Q-0 adımında yazılır):** tarama maddeleri tek tek koşulur, madde başına tek geçiş; bir maddede 2 takılmada dur-sor; bulgu başına derinleşme yok (kanıtla, raporla, geç); DB'ye yalnızca salt-okuma; toplam tarama tek oturum hedefi.
- **Düzeltme disiplini (Q2):** yalnızca İskender'in KRİTİK/ORTA olarak onayladığı bulgular; **bir bulgu = bir commit**; her commit üçlü doğrulamadan geçer; davranış değiştiren düzeltmelerde önce/sonra kanıtı rapora eklenir.

## 5. Kararlar — İskender

*Tümü kapalı — 12.07.2026, İskender:*
- **D1 — KAPALI: Code koşar.** T-D sorguları DATABASE_URL üzerinden, YALNIZCA salt-okuma (U2 emsali). Yazan tek satır SQL çalıştırılmaz.
- **D2 — KAPALI: düzeltilir.** T-B1 (kd_utt boş /izle listesi) ve T-B2 (talep formu Eczacı seçeneği ↔ API reddi) bu kapsamda, Q3'te, birer commit'le kapatılır.
- **D3 — KAPALI: yapılır.** Login'deki gereksiz metadata okumaları kaldırılır (kaynak useAuth); ölü "Şifremi unuttum" linki kaldırılır (işlevlendirme ayrı/ileri iş).
- **D4 — KAPALI: eşik onaylı.** KRİTİK+ORTA bulgular düzeltilir; NOT seviyesindekiler redbook §6.4'e açık iş olarak işlenir.

## 6. Uygulama sırası

- **Q-0 — Hazırlık:** CLAUDE.md'ye §4 frenleri eklenir; bu plan `docs/`a konur. (Eczanem planları `docs/arsiv/`e taşınabilir — karar İskender'in; repodan ÇIKARILMAZ.)
- **Q1 — Tarama:** T-K1..8 → T-B1..5 → (D1'e göre) T-D1..12; çıktı `docs/kalite_bulgu_raporu.md`. Değişiklik YOK.
- **Q2 — Değerlendirme:** Rapor İskender'le birlikte sınıflandırılır (bu sohbette ya da Code'da); düzeltme listesi onaylanır.
- **Q3 — Onaylı düzeltmeler:** bir bulgu = bir commit; üçlü doğrulama her commit'te.
- **Q4 — Kalıcılaştırma:** T-D sorguları `scripts/denetim/tutarlilik/` + runner; `package.json`'a `denetim:tutarlilik`; T-K taramalarından otomatikleşebilenler (T-K3, T-K6) lint kuralı adayı olarak raporlanır.
- **Q5 — Kapanış:** bulgu raporunun final hâli + redbook §6.4 güncellemesi (kapananlar/kalanlar) + kısa kapanış özeti.

## 7. Durum takibi

**Kararlar:**
- [x] D1 — Code koşar (salt-okuma)
- [x] D2 — T-B1 + T-B2 düzeltilir
- [x] D3 — Login temizliği yapılır
- [x] D4 — KRİTİK+ORTA düzeltilir, NOT'lar §6.4'e

**Adımlar:**
- [x] Q-0 — CLAUDE.md frenleri + plan repoya (12.07.2026)
- [x] Q1 — Tarama + bulgu raporu (değişiklik yok) — 12.07.2026, `docs/kalite_bulgu_raporu.md` (16 bulgu: 2 KRİTİK, 7 ORTA, 6 NOT, 1 rapor-only)
- [x] Q2 — Değerlendirme/sınıflandırma (İskender) — 12.07.2026: 9 maddelik Q3 listesi + B-05/B-08/B-12/B-13/B-15 kararları bağlandı (rapor §3)
- [ ] Q3 — Onaylı düzeltmeler (bulgu başına commit)
- [ ] Q4 — `denetim:tutarlilik` kalıcılaştırma
- [ ] Q5 — Kapanış + redbook güncellemesi
