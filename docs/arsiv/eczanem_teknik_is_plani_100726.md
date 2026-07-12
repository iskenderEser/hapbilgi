# Eczanem — Teknik İş Planı

*Eczanem İş Planı'nın (işleyiş belgesi, uyumlandırılmış sürüm 10.07.2026) koda dönüşüm planı. Bu belge "nasıl ve hangi sırayla" sorusunun cevabıdır; kurallar ve gerekçeler işleyiş belgesindedir, burada tekrarlanmaz — yalnızca referans verilir (§İP-x.y). Kod yazımı her adımda KONTROL → YAZIM ile ilerler. Belge canlıdır: kapanan her adım §9'daki durum takibinde tiklenir, yeni bulgular ilgili bölüme işlenir.*

*Son güncelleme: 10.07.2026 — Tüm kararlar kapalı (K-E1–E8). K1 ✓ (OTP mimarisi kesin: kendi OTP tablomuz + standart Supabase oturumu; AuthProvider zaten v_auth_kimlik'te). Kararlar (K-E1–E9) ve KONTROL'ler (K1–K6) TAMAMEN kapalı. Sıradaki adım: U0 yazımı (İskender onayı bekliyor).*

---

## İçindekiler

- [1. İşin özü, önkoşullar ve fazlar](#1-i̇şin-özü-önkoşullar-ve-fazlar)
- [2. Veri modeli](#2-veri-modeli)
- [3. Kimlik, giriş ve erişim](#3-kimlik-giriş-ve-erişim)
- [4. Üretim hattı değişiklikleri](#4-üretim-hattı-değişiklikleri)
- [5. Dağıtım ve tüketim](#5-dağıtım-ve-tüketim)
- [6. Kasa akışı — atomik düşüm](#6-kasa-akışı--atomik-düşüm)
- [7. Görünürlük, raporlar, mutabakat dökümü](#7-görünürlük-raporlar-mutabakat-dökümü)
- [8. Açık kararlar — İskender](#8-açık-kararlar--i̇skender)
- [9. Uygulama sırası ve durum takibi](#9-uygulama-sırası-ve-durum-takibi)

---

## 1. İşin özü, önkoşullar ve fazlar

Eczanem, üçüncü müşteri katmanıdır: eczanenin kendi müşterisi videoyu izler, puan kazanır, aynı eczanede aynı üründe TL indirimi olarak kullanır (İP-§1). Teknik olarak beş yeni yapı taşı gerektirir: **(a)** üçüncü kimlik düzlemi (telefon+OTP), **(b)** sistemdeki ilk puan-yaşlandırma modeli (180 gün kayan pencere + FIFO harcama), **(c)** atomik düşüm RPC'si (sipariş onayı), **(d)** üretim hattında üçüncü hedef (`eczanem`), **(e)** beşinci proxy bekçisi.

**Mevcut altyapının hazır verdiği parçalar** (yeniden kullanılır, icat edilmez):
- Rol çözümü tek kaynakta: `v_auth_kimlik` + `rolCozucu` — müşteri düzlemi view'a UNION olarak eklenir.
- Ayar yönetimi: `sistem_ayarlari` + admin Sistem Ayarları paneli — eşik ve diğer parametreler buradan.
- Denormalizasyon deseni: dörtlü kilit (kişi+eczane+firma+ürün) kayıt anında yazılır (`urun_id` felsefesinin genişlemesi).
- Yayına alma formu genişletme deseni: tekrar periyodu işinde kuruldu; barkod+Karşılık aynı desenle.
- Kayıt-anı simetrisi ve "fiziksel DELETE yok" felsefesi: 180 gün "silme"si sorgu-anı filtresiyle uygulanır (cron'suz — tur modelindeki yaklaşımın aynısı).

**Fazlar** (her faz kendi içinde test edilebilir, sıra bağımlıdır):
- **Faz 0 — Zemin:** hedef_rol genişletmesi + veri modeli migration'ları + ayar anahtarları.
- **Faz 1 — Kimlik:** OTP altyapısı, davet → üyelik, müşteri girişi, proxy bekçisi, KVKK silme.
- **Faz 2 — İçerik + dağıtım:** PM talebi, yayına alma (barkod+Karşılık), UTT→eczane, eczane→müşteri.
- **Faz 3 — Tüketim:** müşteri paneli, izleme + soru + kazanım (kayıpsız).
- **Faz 4 — Kasa:** barkod okuma, sipariş, atomik onay, fiş.
- **Faz 5 — Görünürlük:** eczane dökümü, UTT eczane×ürün, BM/TM/yönetici cascade, PM ürün ekseni.

**Dış bağımlılık:** SMS sağlayıcısı (K-E1) Faz 1'in ön koşuludur; sağlayıcı beklenirken Faz 0 ve Faz 2'nin PM tarafı ilerleyebilir.

**Push disiplini:** Bekleyen U10+U7 testleri ve deploy-öncesi mecburi işler (RLS vb.) bu projeden bağımsız olarak durur; Eczanem commit'leri de aynı disipline tabidir. Yeni tablolar RLS'siz doğar; K-E7 kararıyla RLS tüm testlerden sonra, genel RLS işiyle birlikte uygulanır — Eczanem tabloları o işin kapsam listesine şimdiden eklenir (deploy öncesi mecburi).

## 2. Veri modeli

Yeni tablolar (adlar öneri; KONTROL'lerde mevcut adlandırma diliyle son hâli verilir):

| Tablo | Rol | Kritik kolonlar / notlar |
|---|---|---|
| `eczanem_musteriler` | Kimlik (tek kişi = tek telefon, İP-§3.3) | `musteri_id`, `telefon` (UNIQUE), `ad_soyad`, `kvkk_onay_tarihi`, `aktif_mi`. Ad-soyad görüntüleme katmanlarına ASLA akmaz (İP-§9.2). |
| `eczanem_davetler` | Kayıt öncesi durum (İP-§3.2) | `davet_id`, `eczane_id`, `telefon`, `ad_soyad`, `otp_hash`, `son_gecerlilik` (24s), `durum`. Süresi dolan davet verisi kalıcı tutulmaz — temizleme stratejisi K-E2. |
| `eczanem_uyelikler` | Eczane↔müşteri bağı (çoklu, İP-§1.3) | `uyelik_id`, `musteri_id`, `eczane_id`, `durum`. UNIQUE(musteri_id, eczane_id). "Aktif üye" eşiği bu tablodan sayılır. |
| `eczanem_gonderimler` | Eczane→müşteri dağıtımı (İP-§5.5) | `gonderim_id`, `yayin_id`, `eczane_id`, `musteri_id`. UNIQUE(yayin_id, musteri_id) — ömür boyu teklik yapısal. UTT→eczane tekliği için ayrı tablo: `eczanem_eczane_gonderimleri`, UNIQUE(yayin_id, eczane_id) (İP-§5.3). |
| `eczanem_izleme_kayitlari` | Tüketim | Mevcut izleme deseninin sade hâli; kayıp kolonları yok (İP-§6.1). |
| `eczanem_puan_kayitlari` | **Kazanım ledger'ı — FIFO'nun temeli** | `kayit_id`, `musteri_id`, `eczane_id`, `firma_id`, `urun_id` (dördü kayıt anında denormalize — dörtlü kilit), `puan_turu` (izleme/cevap), `puan`, **`kalan_puan`** (harcamayla azalır), `created_at`. |
| `eczanem_siparisler` | Kasa akışı (İP-§8) | `siparis_id`, `musteri_id`, `eczane_id`, `urun_id`, `adet`, `kullanilan_puan`, `indirim_tl`, `durum` (bekliyor/onaylandi/dustu), `islem_kodu`, `onay_tarihi`. |
| `eczanem_harcama_kayitlari` | FIFO eşleme tarihçesi | `harcama_id`, `siparis_id`, `kaynak_kayit_id` (→ puan_kayitlari), `dusulen_puan`. Hangi kazanımdan ne düştüğü izlenebilir — mutabakat ve denetim tabanı. |

**Bakiye ve 180 gün — tek formül:** kullanılabilir bakiye(müşteri, eczane, ürün) = Σ `kalan_puan` WHERE `created_at >= now() − 180 gün`. Fiziksel silme yok; süresi geçen kazanımın `kalan_puan`'ı tarihçede durur ama formüle girmez. FIFO: harcama RPC'si kayıtları `created_at ASC` tüketir → en eski önce (İP-§7.4), "kalan puanı bekletmek yaşlandırmaz" kuralı kendiliğinden sağlanır.

**Barkod + Karşılık'ın evi:** giriş UX'i yayına almada (İP-§4.3) ama saklama **ürün seviyesinde** olmalıdır — bakiye ürün bazlı birleştiği için karşılık da ürün başına tek güncel değer olmak zorunda (iki yayının iki farklı karşılığı tanımsızlık üretir). Öneri: `urunler`'e `barkod` + Karşılık için `eczanem_urun_tarifeleri` (urun_id, puan, tl, gecerlilik_baslangic — "müşteri aleyhine değişmez" kuralının tarihçesi). Son karar: K-E3.

**Ayar anahtarları** (`sistem_ayarlari`, admin panelinden): `eczanem_aktif_uye_esigi` (İP-§5.2), `eczanem_puan_omru_gun` (=180, İP-§7.4), `eczanem_davet_gecerlilik_saat` (=24). İzleme/cevap puanları AYAR DEĞİLDİR — mevcut üretim hattı mekanizmasıyla PM belirler (K-E4).

**Korumalı tablolar:** `eczanem_puan_kayitlari`, `eczanem_harcama_kayitlari`, `eczanem_siparisler` → `KORUMALI_TABLOLAR`'a eklenir; yazım yalnızca `lib/eczanem/` tek-kaynak fonksiyonları + RPC üzerinden.

## 3. Kimlik, giriş ve erişim

- **OTP:** iki mimari seçenek — (a) Supabase native phone auth (SMS sağlayıcı entegrasyonu Supabase'e), (b) kendi OTP tablomuz + custom session. KONTROL K1 (mevcut auth kurulumunun incelenmesi) + K-E1 sağlayıcı kararıyla netleşir. E-Club'ın bekleyen OTP işi aynı altyapıya bağlanır (İP-§3.5 notu) ama E-Club geçişi AYRI iştir — bu planda yalnızca altyapının paylaşılabilir kurulması hedeflenir.
- **OTP test modu (K-E8, kapalı karar):** Canlı (production = gerçek kullanıcı ortamı) dışındaki her ortamda (local + Vercel preview) SMS gönderilmez ve sabit kod `123456` geçerlidir — test tarafında hiçbir açma/kapama adımı yoktur, kendiliğinden çalışır. Güvence tek taraflı ve çift kilitlidir: kod, sabit kodu yalnızca ortam production DEĞİLKEN kabul eder (`VERCEL_ENV`/`NODE_ENV` kontrolü); canlıda hiçbir koşulda çalışmaz — "kaldırmayı unutma" riski yapısal olarak yoktur (girişsiz test endpoint'leri dersinin uygulaması). Davranış tek noktada yaşar (`lib/eczanem/otp.ts`), test-modu doğrulamaları loglanır. Yan kazanç: U1 ve sonrası OTP'li akışlar K-E1 sağlayıcı kararını beklemeden yazılıp test edilebilir; SMS entegrasyonu sona takılan parçadır.
- **`v_auth_kimlik` genişletmesi:** view'a müşteri düzlemi UNION'ı eklenir; `rolCozucu` `"musteri"` dönebilir hâle gelir. Yazma tarafı: müşteri auth kaydı hangi alanla eşlenir (telefon → auth user) K1'de netleşir.
- **Proxy — beşinci bekçi:** `/eczanem` altı müşteri paneli; eczacı tarafı E-Club oturumuyla `/eclub/eczanem` altında (E-Club store sıralama dersi: özel prefix genel prefixten ÖNCE kontrol edilir). UTT tarafı iç uygulamada mevcut bekçilerin kapsamında.
- **Eczacı/teknisyen ≠ müşteri** (İP-§3.4): davet API'si, telefonu o eczanenin eczacı/teknisyen kayıtlarına karşı doğrular — kaynak tablo K2'de tespit edilir.
- **KVKK silme** (İP-§3.6): sistemdeki ilk gerçek silme akışı. Öneri: kişisel alanlar anonimleştirilir (`telefon`/`ad_soyad` null/hash, `aktif_mi=false`), finansal toplamların dayanağı olan kayıtlar (harcama/sipariş) kişisiz tarihçe olarak kalır — mutabakat toplamları bozulmaz, kişi verisi kalmaz. Son karar: K-E5.

## 4. Üretim hattı değişiklikleri

- **`hedef_rol` genişletmesi — Faz 0'ın ilk işi.** Üçüncü değer: `eczanem`. Bilinen borç `TakipSatiri.hedef_rol: "utt" | "bm"` dar tipi burada kapanır; ayrıca `hedef_rol` dallanan her nokta (talep formu — yalnızca PM'e görünür seçenek İP-§4.1, içerik türü/görünürlük türevleri, yayın listeleri) K3 envanteriyle çıkarılır. Tek tip tanımı `roller.ts`/ilgili tek kaynağa yazılır.
- **Yayına alma:** Eczanem hedefli yayında (a) tekrar periyodu alanı GİZLENİR, `tekrar_periyot_gun` NULL'a zorlanır (İP-§4.4 — server tarafında da doğrulanır), (b) barkod + Karşılık alanları zorunlu olur (K-E3 modeline göre ürün seviyesine yazılır), (c) ileri sarma/extra alanları anlamsızdır — form K4'te incelenip karar verilir.
- **Üretim zinciri (senaryo→video→soru) DEĞİŞMEZ** (İP-§4.2) — hedef_rol genişletmesi dışında bu katmana dokunulmaz.

## 5. Dağıtım ve tüketim

- **UTT ekranı:** "Eczanem" pill/sayfası — Eczanem yayınları + listesindeki eczaneler + aktif üye sayısı + eşik durumu; eşik altına gönderim server tarafında da reddedilir (İP-§5.2). Gönderim `eczanem_eczane_gonderimleri`'ne UNIQUE ile yazılır.
- **Eczane paneli (eczacı/teknisyen):** gelen videolar, üye listesi (yalnız son-4-hane), davet formu, tekil/toplu müşteri gönderimi (İP-§5.5 — toplu gönderim tek istekte, UNIQUE çakışmaları sessizce atlanır), sipariş onay kuyruğu (Faz 4), işlem dökümü.
- **Müşteri paneli:** kendine gönderilen videolar, izleme + soru akışı (mevcut izleme bileşenlerinin sade uyarlaması — kayıp yok, ileri sarma yok, İP-§6.1), bakiye ekranı (Eczane > Firma > Ürün kırılımı), fişler, "İndirim kullan", profil/silme.
- **İzlenme metriği HİÇBİR katmanda üretilmez** (İP-§6.2) — rapor/analiz veri katmanlarına Eczanem izleme verisi bilinçli olarak BAĞLANMAZ; bu bir eksik değil karardır, koda yorum olarak da yazılır.

## 6. Kasa akışı — atomik düşüm

Sipariş onayı tek RPC'de kesinleşir: `eczanem_siparis_onayla(siparis_id)` — transaction içinde: (1) sipariş `bekliyor` mu, (2) bakiye formülü onay anında hesaplanır (kasada anlık işlem — İP-§8), (3) FIFO düşüm: `created_at ASC` kayıtlardan `kalan_puan` azaltılır + `eczanem_harcama_kayitlari` satırları, (4) sipariş `onaylandi` + `islem_kodu` + `onay_tarihi`, (5) fiş verisi döner. Eşzamanlılık: aynı siparişe çift onay `durum` koşuluyla; aynı müşterinin iki siparişinin yarışması satır kilidiyle (RPC içinde `FOR UPDATE`) çözülür. Store sipariş RPC'leri desen emsalidir ama FIFO eşleme yenidir — K5'te mevcut store RPC'si incelenir.

Barkod→hesap adımı (İP-§8.1/2): barkod → ürün → bakiye → tarife → indirim; **adet indirimi çarpmaz** kuralı hesap fonksiyonunda tek yerde durur.

## 7. Görünürlük, raporlar, mutabakat dökümü

Tümü Faz 5; kaynak veriler Faz 4 sonunda hazırdır.
- **Eczane dökümü:** kendi işlemleri, ürün bazında toplam indirim (İP-§9.2).
- **UTT:** eczane × ürün toplamları (kutu + indirim TL) — mutabakatın sistem dayanağı (İP-§10.1).
- **BM/TM/yönetici:** mevcut "aynı sayfa, rol-bağımlı kapsam" cascade deseni birebir.
- **PM:** yeni desen — hiyerarşi değil ürün ekseni (kendi ürünleri, Türkiye geneli, bölge→UTT→eczane kırılımı, İP-§9.2). Başka PM'in ürünü görünmez — süzgeç PM↔ürün sahipliğinden.
- Kişi bazlı hiçbir veri hiçbir iç role akmaz (İP-§9.1/9.3) — sorgular en granüler eczane×ürün toplamında durur; müşteri FK'sı SELECT'lere hiç girmez.

## 8. Açık kararlar — İskender

- **K-E1 — SMS sağlayıcısı: KAPALI (10.07.2026, İskender): TURKCELL.** Entegrasyon detayı (API/panel, başlık tescili) K1 KONTROL'ü sırasında netleşir; K-E8 sayesinde geliştirme bloklanmaz, gerçek entegrasyon canlıya çıkış öncesi takılır.
- **K-E8 — OTP test modu: KAPALI (10.07.2026, İskender):** Canlı dışı ortamlarda SMS'siz sabit kod `123456`; production'da yapısal olarak devre dışı (çift kilit, bkz. §3). Test ortamına hiçbir ek yük getirmez.
- **K-E2 — Davet temizliği: KAPALI (10.07.2026, İskender):** Müşteri kendini aktive etmediyse davet verisi (telefon + ad) SİLİNİR — ilke net, mekanizma teknik tercihe bırakıldı. Uygulama: süre dolan davet sorgu anında geçersiz sayılır (link o an ölür) + günlük otomatik temizlik satırı fiziksel siler. Not: bu, sistemin "fiziksel DELETE yok" felsefesinin bilinçli tek istisnasıdır — kaydolmamış kişinin verisi tarihçe değil, KVKK yüküdür.
- **K-E3 — Karşılık modeli: KAPALI (10.07.2026, İskender): Karşılık ÜRÜNE bağlanır.** Ürün başına tek güncel tarife (video başına değil — tek puan havuzu tek kurdan bozulur); giriş UX'i yayına almada kalır, değer ürün seviyesine yazılır, sonraki yayında dolu gelir; güncelleme yalnızca ileriye işler (tarihçe tablosuyla — "müşteri aleyhine değişmez"). Veri modeli §2'deki öneriyle: `urunler.barkod` + `eczanem_urun_tarifeleri`.
- **K-E4 — İzleme/cevap puan değerleri: KAPALI (10.07.2026, İskender): PM belirler, MEVCUT MEKANİZMA birebir.** Puan = firmanın maliyeti; maliyet kararı yalnızca o firmanın üretici rolünündür (admin'in konuyla teması yoktur). Eczanem üretim zincirini değiştirmeden kullandığı (İP-§4.2) için izleme puanı = üretim hattında belirlenen video puanı (`video_puanlari`), cevap puanları = yayına almada PM'in girdiği soru puanları — yeni ayar anahtarı AÇILMAZ.
- **K-E5 — KVKK silme modeli: KAPALI (10.07.2026, İskender): ANINDA ve TAM silme + anonim etiket.** Hesap silindiğinde kişisel veri VE puan bakiyesi dahil her şey anında silinir (bekleyen puan yanar — geri dönüş yok). Mutabakatın dayanağı olan parasal işlem kayıtları (sipariş/harcama/fiş) kimliksiz kalır ve "Eczane X Müşteri 1, Müşteri 2..." biçiminde anonim sıra etiketiyle görüntülenir — kişiye dair hiçbir bağ kurulamaz, eczane-firma toplamları bozulmaz. Uygulama: silme akışı tek fonksiyonda (lib/eczanem/), etiket üretimi eczane bazlı sıra numarasıyla.
- **K-E6 — DÜŞTÜ (10.07.2026):** Karar maddesi hatalı kurgulanmıştı — işlem eczane İÇİNDE, kasada, yüz yüze ve anlıktır (İP-§8); sipariş ile onay arasına puan yaşlandıracak bir süre girmesi senaryosu bu modülde yoktur. Teknik karşılığı karar değil detaydır: onay RPC'si bakiyeyi onay anında hesaplar (§6), o kadar.
- **K-E7 — RLS zamanlaması: KAPALI (10.07.2026, İskender): EN SONA — tüm testlerden sonra.** Eczanem tabloları RLS'siz doğar; RLS, tüm fiziksel testler tamamlandıktan sonra genel RLS işiyle birlikte (deploy-öncesi mecburi liste) uygulanır. Not: Eczanem tabloları kişisel veri taşıdığından genel RLS işinin kapsam listesine ŞİMDİDEN eklenir ve deploy bu iş bitmeden yapılmaz (mevcut mecburi-liste disiplini aynen geçerli).

## 9. Uygulama sırası ve durum takibi

*Kapanan her adım tiklenir; her U kendi KONTROL'üyle başlar, kod görülmeden yazım yapılmaz.*

**Kararlar (İskender):** 
- [x] K-E1 — SMS sağlayıcısı: Turkcell
- [x] K-E2 — Davet temizliği: aktive olmayanın verisi silinir (sorgu-anı geçersiz + günlük fiziksel temizlik)
- [x] K-E3 — Karşılık modeli: ürüne bağlı tek tarife + tarihçe
- [x] K-E4 — Puan değerleri: PM belirler, mevcut video/soru puan mekanizması birebir
- [x] K-E5 — KVKK silme: anında tam silme (puan dahil) + parasal tarihçe anonim etiketle ("Eczane X Müşteri N")
- [x] K-E6 — DÜŞTÜ: kasada anlık işlem, senaryo yok (RPC zaten onay anında hesaplar)
- [x] K-E7 — RLS zamanlaması: en sona, tüm testlerden sonra (genel RLS işiyle birlikte; deploy öncesi mecburi)
- [x] K-E8 — OTP test modu: kapalı karar (canlı dışı sabit 123456, çift kilit — §3)
- [x] K-E9 — Eczanem firma toggle'ı: KAPALI (10.07.2026, İskender): OLACAK. `firmalar.eczanem_aktif` kolonu (U0 migration'ına), FirmaSidebar toggle'ı + UTT tarafı bekçi koşulu (U3/U6) — mevcut modül toggle deseni birebir. Not: müşteri paneli firma bilmez; toggle yalnızca iç tarafı (UTT Eczanem ekranı) kapatır, mevcut müşterilerin izleme/harcaması ürün kararına kadar sürer.

**KONTROL'ler:**
- [x] K1 — Tamam (10.07.2026): Zemin = Supabase Auth (e-posta/şifre, @supabase/ssr çerez oturumu); client kimlik çözümü ZATEN tek kaynakta (`AuthProvider` → `v_auth_kimlik`: kimlik_turu/rol/ad/soyad/firma_id/telefon; single-flight korumalı). OTP MİMARİSİ KESİNLEŞTİ: kendi OTP tablomuz (Turkcell Supabase'in hazır sağlayıcısı değil + davet akışı zaten bizde + K-E8 test modu kolay) + müşteri GERÇEK Supabase auth kullanıcısı olur (davet kabulünde sentetik kimlik) → standart oturum kurulur, proxy/AuthProvider sıfır özel muamele. Müşteri düzlemi üç noktaya dokunur: view UNION + `KimlikTuru`'na 'musteri' + login yönlendirme dalı. YAN BULGULAR: (1) login'deki `user_metadata.rol`/`eclub_kisi` okumaları gereksizleşmiş — TB1 client kuyruğu, temizlik adayı (kapsam dışı, kayıt); (2) RLS dikkat listesi: `AuthProvider`'ın anon `v_auth_kimlik` sorgusu + login'in firma-aktif sorgusu RLS açılınca 'kendi satırını okuma' izni ister; (3) 'Şifremi unuttum' ölü link (mini not).
- [x] K2 — Tamam (10.07.2026, DB sorgusuyla): Eczane çapası HAZIR — Eczanem `eczane_id` FK'ları doğrudan `eclub_eczaneler`'e (GLN kimlik; master onay süreci ayrık); yeni eczane tablosu İCAT EDİLMEZ. Davet doğrulama kaynağı: `eclub_kisiler.telefon` × `eclub_kisi_eczane` (aktif bağ) — İP-§3.4 kuralının uygulaması. UTT'nin eczane listesi: `eclub_eczane_firma` (`baglayan_utt_id`, `firma_id`, `aktif_mi`) — yeni bağ tablosu gerekmez. Auth eşleme emsali: `eclub_kisiler.auth_user_id` deseni → `eczanem_musteriler.auth_user_id` aynı desen (K1 kararıyla uyumlu).
- [x] K3 — Tamam (10.07.2026): 30 dosya, 6 küme — (1) talep oluşturma (talepler/*, 5; 'eczanem' seçeneği + yalnız-PM kuralı), (2) üretim zinciri görüntüleme (4; rozet/etiket), (3) yayın yönetimi (8; U5 ana sahası), (4) DAĞITIM SÜZGEÇLERİ (7; iç öneri + E-Club öneri + CC), (5) rapor/ana sayfa (3; TakipSatiri dar tipi burada), (6) admin export (1). KRİTİK BULGU — süzgeç yönü riski: pozitif süzgeç (eq 'utt') yeni değeri bedavaya dışarıda tutar; NEGATİF süzgeç (neq 'bm' vb.) varsa 'eczanem' yayınları listelere SESSİZCE SIZAR. U0 şartı: 4. kümenin 7 dosyası satır bazında incelenip süzgeç yönleri doğrulanmadan 'eczanem' değeri DB'ye girmez. Tek tip kaynağı yok — U0'da `HedefRol` tipi + etiket haritası tek kaynağa yazılır.
- [x] K4 — Tamam (10.07.2026, route tarafı): (1) hedef rol yayına almada SEÇİLMEZ — talepten türetilir (`talepBilgisiSoruSeti`, "Karar 1"); 'eczanem' talep aşamasında doğar, route otomatik taşır. (2) ÇELİŞKİ: `extra_puan` validasyonu zorunlu (5-10) ama Eczanem'de extra yok — U5'te dallanır (eczanem → extra_puan istenmez/NULL). (3) Periyot doğrulama deseni hazır — eczanem dalında NULL'a zorlama tek if. (4) BİLDİRİM TUZAĞI: alıcılar `in("rol", hedefRoller)` — rol='eczanem' kullanıcı yok → bildirim sessizce kimseye gitmez; eczanem hedefinde alıcı UTT'ler olmalı (U5 dallanması). Form tarafı: alanlar `BekleyenSatir.tsx`'te — U5 yazımı öncesi görülür (desen-doğrulamalı script zaten şart koşar). Ek not: `yayin_yonetimi.hedef_roller` DİZİ kolonudur.
- [x] K5 — Tamam (10.07.2026, SQL ile `eclub_store_siparis_olustur` gövdesi): atomik onay RPC'sinin iskeleti emsal desenlerden kurulur — (1) `FOR UPDATE` satır kilidi (Eczanem'de müşterinin puan kayıtlarına), (2) bakiye yardımcı fonksiyonu deseni → `get_eczanem_bakiye` = SUM(kalan_puan) + 180 gün filtresi (RPC + bakiye ekranı aynı fonksiyon, tek kaynak), (3) çoklu-kaynak düşme döngüsü (`LEAST` + eşleme satırı) = FIFO'nun kendisi, tek fark `ORDER BY created_at ASC` + `kalan_puan` UPDATE'i, (4) snapshot deseni → fişe tarife snapshot'ı (K-E3 'ileriye işler' teminatı), (5) `(ok, id, hata)` dönüş sözleşmesi. Atomik FIFO icat değil, kanıtlanmış desenin uyarlaması.
- [x] K6 — Tamam (10.07.2026): `/eczanem` çakışan prefix yok, sıralama serbest (admin bloğu sonrası, dar kapsam deseni). Bekçi türü FARKLI: mevcut dördü firma-toggle, Eczanem bekçisi kimlik-türü bekçisi (`v_auth_kimlik` → kimlik_turu='musteri', tek sorgu). KRİTİK BULGU — ters yön açığı: müşteri gerçek Supabase kullanıcısı olduğundan mevcut bekçiler onu sessizce geçirir ('kullanicilar'da yok → firma yok → geç'); route'lar rolCozucu ile reddeder ama savunma tek katmana düşer. U3 ŞARTI: müşteri yalıtım kuralı — kimlik müşteriyse `/eczanem` (+login/çıkış) dışındaki her yol proxy'de kesilir. Yeni ürün sorusu doğdu: K-E9.

**Uygulama:**
- [ ] U0 — Faz 0: `hedef_rol` genişletmesi (K3 envanteriyle, tek commit) + migration seti (§2 tabloları, K-E3/K-E7'ye göre) + ayar anahtarları + `KORUMALI_TABLOLAR` güncellemesi; tsc + lint:mimari + denetim
- [ ] U1 — Faz 1a: OTP altyapısı (K1 mimarisiyle) — gönderim, doğrulama, oturum; test modu (K-E8) baştan gömülü, gerçek SMS entegrasyonu (K-E1) sona takılan parça
- [ ] U2 — Faz 1b: davet akışı (eczacı paneli formu, 24s geçerlilik, eczacı-telefonu reddi, KVKK onay ekranı, üyelik oluşumu) + `v_auth_kimlik` genişletmesi + `rolCozucu` 'musteri'
- [ ] U3 — Faz 1c: proxy beşinci bekçi + müşteri panel iskeleti + KVKK silme akışı (K-E5)
- [ ] U4 — Faz 2a: PM talep akışında 'eczanem' hedefi (İP-§4.1) — yalnız PM'e görünür
- [ ] U5 — Faz 2b: yayına alma — barkod + Karşılık (K-E3), periyot gizleme/NULL zorlaması, server doğrulamaları
- [ ] U6 — Faz 2c: UTT Eczanem ekranı (liste + eşik + gönderim) + eczane paneli gönderim (tekil/toplu, UNIQUE teklikler)
- [ ] U7 — Faz 3: müşteri izleme + soru + kazanım yazımı (`lib/eczanem/` tek-kaynak, kayıpsız model, dörtlü denormalizasyon)
- [ ] U8 — Faz 4: barkod→hesap ekranı + sipariş + `eczanem_siparis_onayla` RPC (FIFO, atomik) + fiş + eczacı onay kuyruğu
- [ ] U9 — Faz 5: görünürlük katmanları (eczane dökümü, UTT eczane×ürün, cascade, PM ürün ekseni)
- [ ] U10 — Doğrulama: tsc + lint:mimari + denetim her fazda; faz sonlarında ara fiziksel testler
- [ ] U11 — Uçtan uca fiziksel test (İskender): davet→OTP→üyelik, eşik, gönderim teklikleri, izleme→kazanım, dörtlü kilit sızmazlığı, FIFO/180 gün senaryosu, sipariş→onay→fiş→mükerrer onay reddi, KVKK silme sonrası toplamların korunumu, görünürlük sınırları (kişi verisi sızmıyor), İP-§11 risk tablosunun satır satır sağlaması
- [ ] U12 — Redbook güncellemesi: Eczanem bölümü (üçüncü katman) + değişen kesitler

**Teknik borç etkisi:** `hedef_rol` dar tipi borcu U0'da kapanır. Yeni borç üretmeme hedefi: RLS (K-E7 evet ise), izlenme-metriği-yok kararının kod yorumlarıyla sabitlenmesi, FIFO ledger'ın denetim scriptine doğal girişi.
