# Eczanem — Teknik İş Planı

*Eczanem İş Planı'nın (işleyiş belgesi, uyumlandırılmış sürüm 10.07.2026) koda dönüşüm planı. Bu belge "nasıl ve hangi sırayla" sorusunun cevabıdır; kurallar ve gerekçeler işleyiş belgesindedir, burada tekrarlanmaz — yalnızca referans verilir (§İP-x.y). Kod yazımı her adımda KONTROL → YAZIM ile ilerler. Belge canlıdır: kapanan her adım §9'daki durum takibinde tiklenir, yeni bulgular ilgili bölüme işlenir.*

*Son güncelleme: 10.07.2026 — Plan yazıldı; K-E8 (OTP test modu) kapalı karar olarak eklendi. Diğer kararlar ve KONTROL'ler bekliyor.*

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

**Push disiplini:** Bekleyen U10+U7 testleri ve deploy-öncesi mecburi işler (RLS vb.) bu projeden bağımsız olarak durur; Eczanem commit'leri de aynı disipline tabidir. Yeni tabloların TÜMÜ RLS listesine doğar (açık iş büyümesin diye migration'da RLS'li düşünülür — K-E7).

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

**Ayar anahtarları** (`sistem_ayarlari`, admin panelinden): `eczanem_aktif_uye_esigi` (İP-§5.2), `eczanem_puan_omru_gun` (=180, İP-§7.4), `eczanem_davet_gecerlilik_saat` (=24), izleme/cevap puan değerleri (K-E4: sabit mi ayar mı).

**Korumalı tablolar:** `eczanem_puan_kayitlari`, `eczanem_harcama_kayitlari`, `eczanem_siparisler` → `KORUMALI_TABLOLAR`'a eklenir; yazım yalnızca `lib/eczanem/` tek-kaynak fonksiyonları + RPC üzerinden.

## 3. Kimlik, giriş ve erişim

- **OTP:** iki mimari seçenek — (a) Supabase native phone auth (SMS sağlayıcı entegrasyonu Supabase'e), (b) kendi OTP tablomuz + custom session. KONTROL K1 (mevcut auth kurulumunun incelenmesi) + K-E1 sağlayıcı kararıyla netleşir. E-Club'ın bekleyen OTP işi aynı altyapıya bağlanır (İP-§3.5 notu) ama E-Club geçişi AYRI iştir — bu planda yalnızca altyapının paylaşılabilir kurulması hedeflenir.
- **OTP test modu (K-E8, kapalı karar):** Canlı (production = gerçek kullanıcı ortamı) dışındaki her ortamda (local + Vercel preview) SMS gönderilmez ve sabit kod `123456` geçerlidir — test tarafında hiçbir açma/kapama adımı yoktur, kendiliğinden çalışır. Güvence tek taraflı ve çift kilitlidir: kod, sabit kodu yalnızca ortam production DEĞİLKEN kabul eder (`VERCEL_ENV`/`NODE_ENV` kontrolü); canlıda hiçbir koşulda çalışmaz — "kaldırmayı unutma" riski yapısal olarak yoktur (girişsiz test endpoint'leri dersinin uygulaması). Davranış tek noktada yaşar (`lib/eczanem/otp.ts`), test-modu doğrulamaları loglanır. Yan kazanç: U1 ve sonrası OTP'li akışlar K-E1 sağlayıcı kararını beklemeden yazılıp test edilebilir; SMS entegrasyonu sona takılan parçadır.
- **`v_auth_kimlik` genişletmesi:** view'a müşteri düzlemi UNION'ı eklenir; `rolCozucu` `"musteri"` dönebilir hâle gelir. Yazma tarafı: müşteri auth kaydı hangi alanla eşlenir (telefon → auth user) K1'de netleşir.
- **Proxy — beşinci bekçi (güncellendi 11.07.2026):** Eczanem bağımsız modüldür ve kendi kökünde yaşar: müşteri paneli `/eczanem`, eczacı tarafı `/eczanem/eczane` (E-Club oturumuyla girilir ama yol E-Club prefix'inde DEĞİLDİR — modül bağımsızlığı kararı; eski `/eclub/eczanem` yolu U2 sonrası taşındı). Tek bekçi `/eczanem/*` kökünü korur; girişsiz uçlar (giriş API'leri, davet kabul sayfası ve API'si) bekçi istisnasıdır. UTT tarafı iç uygulamada mevcut bekçilerin kapsamında.
- **Eczacı/teknisyen ≠ müşteri** (İP-§3.4): davet API'si, telefonu o eczanenin eczacı/teknisyen kayıtlarına karşı doğrular — kaynak tablo K2'de tespit edilir.
- **KVKK silme (K-E5 KAPALI, 11.07.2026):** sistemdeki ilk gerçek silme akışı — **anında TAM silme, puan dahil**: müşteri satırı, auth kaydı, üyelikler, gönderimler, davetler, izleme ve puan kayıtları fiziksel silinir. Yalnızca parasal tarihçe (sipariş + harcama kayıtları) mutabakat dayanağı olarak kalır; kişi bağı koparılır ve satırlar **"Eczane X Müşteri N"** anonim etiketine çevrilir (`musteri_id` boşalır) — mutabakat toplamları bozulmaz, kişi verisi kalmaz. (Önceki anonimleştirme önerisi geçersizdir.)

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

Sipariş onayı tek RPC'de kesinleşir: `eczanem_siparis_onayla(siparis_id)` — transaction içinde: (1) sipariş `bekliyor` mu, (2) bakiye formülü yeniden hesaplanır (onay ANI esas — sipariş ile onay arasında puan yaşlanmış olabilir; hesap onayda güncellenir, K-E6), (3) FIFO düşüm: `created_at ASC` kayıtlardan `kalan_puan` azaltılır + `eczanem_harcama_kayitlari` satırları, (4) sipariş `onaylandi` + `islem_kodu` + `onay_tarihi`, (5) fiş verisi döner. Eşzamanlılık: aynı siparişe çift onay `durum` koşuluyla; aynı müşterinin iki siparişinin yarışması satır kilidiyle (RPC içinde `FOR UPDATE`) çözülür. Store sipariş RPC'leri desen emsalidir ama FIFO eşleme yenidir — K5'te mevcut store RPC'si incelenir.

Barkod→hesap adımı (İP-§8.1/2): barkod → ürün → bakiye → tarife → indirim; **adet indirimi çarpmaz** kuralı hesap fonksiyonunda tek yerde durur.

## 7. Görünürlük, raporlar, mutabakat dökümü

Tümü Faz 5; kaynak veriler Faz 4 sonunda hazırdır.
- **Eczane dökümü:** kendi işlemleri, ürün bazında toplam indirim (İP-§9.2).
- **UTT:** eczane × ürün toplamları (kutu + indirim TL) — mutabakatın sistem dayanağı (İP-§10.1).
- **BM/TM/yönetici:** mevcut "aynı sayfa, rol-bağımlı kapsam" cascade deseni birebir.
- **PM:** yeni desen — hiyerarşi değil ürün ekseni (kendi ürünleri, Türkiye geneli, bölge→UTT→eczane kırılımı, İP-§9.2). Başka PM'in ürünü görünmez — süzgeç PM↔ürün sahipliğinden.
- Kişi bazlı hiçbir veri hiçbir iç role akmaz (İP-§9.1/9.3) — sorgular en granüler eczane×ürün toplamında durur; müşteri FK'sı SELECT'lere hiç girmez.

## 8. Açık kararlar — İskender

- **K-E1 — SMS sağlayıcısı:** hangi firma (maliyet/sözleşme kararı)? Bu karar OTP mimarisini (Supabase native vs custom) de yönlendirir. (K-E8 sayesinde bu karar geliştirme akışını BLOKLAMAZ — yalnızca canlıya çıkış öncesi gerekir.)
- **K-E8 — OTP test modu: KAPALI (10.07.2026, İskender):** Canlı dışı ortamlarda SMS'siz sabit kod `123456`; production'da yapısal olarak devre dışı (çift kilit, bkz. §3). Test ortamına hiçbir ek yük getirmez.
- **K-E2 — Davet temizliği:** 24 saati dolan davet kaydının silinme mekanizması — sorgu-anı geçersiz sayma + periyodik temizlik mi, anlık silme mi? (Eğilim: sorgu-anı geçersiz + günlük temizlik; KVKK "kalıcı tutulmaz" şartını temizlik karşılar.)
- **K-E3 — Karşılık modeli:** ürün seviyesinde tek güncel tarife + tarihçe tablosu önerisi (bkz. §2) onaylanıyor mu? "Müşteri aleyhine değişmez" kuralının teknik yorumu: yeni tarife yalnızca ileriye mi işler?
- **K-E4 — İzleme/cevap puan değerleri:** ürün/yayın başına mı, sistem geneli ayar mı?
- **K-E5 — KVKK silme modeli: KAPALI (11.07.2026, İskender):** Anında TAM silme (puan dahil); parasal tarihçe "Eczane X Müşteri N" anonim etiketiyle kalır (bkz. §3).
- **K-E6 — Sipariş-onay arası bakiye değişimi:** onay anındaki güncel bakiye esas (indirim tutarı düşebilir) — müşteriye fark gösterilir mi, sipariş düşürülür mü?
- **K-E7 — RLS zamanlaması:** yeni tablolar migration'da RLS'li mi doğsun (önerim: evet — açık iş büyümesin), yoksa genel RLS işine mi bırakılsın?

## 9. Uygulama sırası ve durum takibi

*Kapanan her adım tiklenir; her U kendi KONTROL'üyle başlar, kod görülmeden yazım yapılmaz.*

**Kararlar (İskender):** 
- [ ] K-E1 — SMS sağlayıcısı
- [ ] K-E2 — Davet temizliği
- [ ] K-E3 — Karşılık modeli (ürün seviyesi + tarihçe)
- [ ] K-E4 — Puan değerlerinin yeri
- [x] K-E5 — KVKK silme modeli: kapalı karar (anında tam silme + anonim parasal tarihçe — §3, §8)
- [ ] K-E6 — Onay anı bakiye kuralı
- [ ] K-E7 — RLS zamanlaması
- [x] K-E8 — OTP test modu: kapalı karar (canlı dışı sabit 123456, çift kilit — §3)

**KONTROL'ler:**
- [x] K1 — Mevcut auth kurulumu → OTP mimari kararının teknik yarısı. **Bulgu (redbook §2.2/§2.4/§4.3, kodla teyit 11.07.2026):** Supabase Auth + `@supabase/ssr` çerez oturumu (`lib/supabase/server.ts`); AuthProvider herkesi `v_auth_kimlik`+`kimlik_turu` ile çözer; E-Club kişisi `auth.admin.createUser` (e-posta+şifre, geçici model) ile açılır; `eczanem_musteriler.auth_user_id` kolonu U0'da hazır — müşteri de Supabase auth user olur, telefon eşlemesi bu kolonla. **Mimari karar:** custom OTP tablosu + Supabase session (native phone auth DEĞİL — SMS'in Supabase'e bağlanmasını gerektirirdi, K-E1'i bloklar ve ince-bağımlılık felsefesine aykırı). Oturum üretimi: `auth.admin.generateLink(magiclink)` → SSR `verifyOtp(token_hash)` → çerez; müşteri auth kaydı sentetik e-posta ile.
- [x] K2 — Eczane/eczacı veri modeli → davet doğrulaması + eczane paneli zemini. **Bulgu (11.07.2026):** Eczacı/teknisyen telefonu `eclub_kisiler.telefon`; eczane bağı `eclub_kisi_eczane` (aktif_mi'li, kişi→tek aktif eczane); eczane kimliği `eclub_eczaneler.eczane_id`, adı GLN üzerinden `eclub_eczane_master` (ayrı sorgu + Map deseni). `eczanem_davetler` FK'ları hazır (eczane_id→eclub_eczaneler, davet_eden_kisi_id→eclub_kisiler). İP-§3.4 reddi: davet telefonu, o eczaneye aktif bağlı kişilerin normalize telefonlarıyla karşılaştırılır (eczane başına kişi sayısı küçük — JS tarafında). Dev DB'de `eclub_kisiler.telefon` şu an boş. **KRİTİK YAN BULGU — canlı bug (TB, Eczanem dışı):** `v_auth_kimlik` `auth.uid()` filtreli, ama `rolCozucu` onu service_role ile sorguluyor (service_role JWT'sinde `sub` yok → `auth.uid()` NULL → view boş). Canlıda doğrulandı: service_role sorgusu null dönüyor → rolCozucu commit'inden (dfcf82f, 09.07) beri 66 dosyadaki rol kontrolü herkesi reddediyor; fark edilmedi çünkü fiziksel testler push öncesi bekliyordu ve proxy view kullanmıyor (doğrudan `kullanicilar`). Onarım U2-SQL ile birleşik: filtresiz `v_auth_kimlik_admin` (yalnız service_role SELECT) + rolCozucu'nun ona geçmesi.
- [x] K3 — `hedef_rol` envanteri (grep: talep formu, üretim zinciri, görünürlük türevleri, TakipSatiri, yayın listeleri) → Faz 0 genişletme kapsamı. **Bulgu (11.07.2026):** 7 süzgeç dosyası + `get_izle_videolari` RPC'si pozitif süzüyor; tek sızıntı `lib/utils/anaSayfa/utt.ts` (süzgeçsiz `v_yayin_detay` okuması) idi — U0-kod'da pozitif süzgeçle kapatıldı. Yan gözlemler: (a) `get_izle_videolari`'na `p_rol` ham geçiyor, `kd_utt` hiçbir `hedef_roller` ile eşleşmiyor → kd_utt /izle listesi boş dönüyor olmalı; (b) talep formu Eczacı/Ecz.Tek. seçeneği sunuyor ama API `GECERLI_HEDEF_ROLLER=["utt","bm"]` ile reddediyor. İkisi de U0 dışı mevcut tutarsızlık.
- [ ] K4 — Yayına alma formu + INSERT zinciri (tekrar periyodu işi sonrası güncel hâli) → barkod/Karşılık alanları + periyot gizleme noktaları
- [ ] K5 — Store sipariş RPC deseni (varsa) + `sistem_ayarlari` okuma desenleri → atomik onay RPC'sinin emsal incelemesi
- [x] K6 — Proxy güncel hâli → beşinci bekçinin ekleme noktası ve sıralaması. **Bulgu (11.07.2026):** proxy.ts = admin API bekçisi + 4 firma-bayrağı bekçisi (CC, HBStore, E-Club Store, E-Club), hepsi aynı desen: oturum yok → API 401 / sayfa login; bayrak kapalı → API 403 / sayfa ana-sayfa; "firma yoksa geçer". Sıralama dersi (/eclub/store → /eclub) bizim /eczanem/eczane → /eczanem sıralamamıza emsal. Eczanem bekçisi ROL tabanlı olur (rolCozucu ile; müşterinin/eczacının firması olmadığından firma-bayrağı deseni uygulanamaz — `eczanem_aktif` UTT ekranlarında, U6'da devreye girer). Ek bulgu: `eczanem_siparisler.musteri_etiket` + nullable `musteri_id` U0-SQL'de zaten hazır — K-E5'in şema yarısı kurulu; tek eksik `harcama_kayitlari.kaynak_kayit_id`'nin puan silmeye dayanması (U3-SQL).

**Uygulama:**
- [x] U0 — Faz 0: `hedef_rol` genişletmesi + migration seti + ayar anahtarları + `KORUMALI_TABLOLAR`. **Kapandı (11.07.2026):** U0-SQL (10 eczanem tablosu + `firmalar.eczanem_aktif` + `urunler.barkod` + 3 ayar anahtarı) + U0-kod commit `939330c` (HedefRol tek kaynak `lib/utils/roller.ts`, 'eczanem' değeri, TakipSatiri dar tipi kapandı, utt.ts pozitif süzgeci, KORUMALI_TABLOLAR) + `chk_talepler_hedef_rol` ALTER'ı canlıda doğrulandı. tsc + denetim + lint:mimari temiz. Not: U0 tabloları RLS'siz doğdu — K-E7 fiilen genel RLS işine kaldı (deploy-öncesi liste).
- [x] U1 — Faz 1a: OTP altyapısı (K1 mimarisiyle) — gönderim, doğrulama, oturum; test modu (K-E8) baştan gömülü, gerçek SMS entegrasyonu (K-E1) sona takılan parça. **Kapandı (11.07.2026):** `lib/utils/ortam.ts` (çift kilit tek kaynağı), `lib/sms/gonderici.ts` (provider-agnostik; canlı-dışı loglar, canlıda K-E1'e dek bilinçli hata), `lib/eczanem/telefon.ts` (kanonik 10 hane), `lib/eczanem/otp.ts` (üretim/hash/kayıt/doğrulama; 5 dk geçerlilik, 5 deneme, 60 sn yeniden-gönderim eşiği, tek kullanımlık kapatma; canlı-dışı sabit 123456), `lib/eczanem/oturum.ts` (sentetik e-posta + `musteriAuthSagla` kendini-onaran auth bağı + generateLink→verifyOtp çerez oturumu), `app/eczanem/api/giris/otp` + `giris/dogrula`. `eczanem_giris_otp` tablosu canlıda; tsc + denetim + lint:mimari temiz. **Duman testi geçti (local):** kod isteği → [SMS TEST] log; 123456 → `sb-*-auth-token` çerezi; yanlış kod → red + deneme sayacı; kayıtsız numara → davet mesajı; 60 sn eşiği → blok; `auth_user_id` kendini-onaran bağ yazıldı. Test verileri temizlendi. **Migration dersi (U2+ için):** bu DB'de yeni tablolar service_role'e DML vermeden doğuyor (yalnız REFERENCES/TRIGGER/TRUNCATE geliyor) — U0+U1 tablolarının tamamına `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE <tablo> TO service_role;` uygulandı (11.07.2026, anon/authenticated'a bilinçli verilmedi — RLS'siz tabloya en az yetki). Bundan sonraki her eczanem migration'ının sonuna aynı GRANT satırı eklenmeli.
- [x] U2 — Faz 1b: davet akışı + `v_auth_kimlik` genişletmesi + `rolCozucu` 'musteri'. **Kapandı (11.07.2026):** U2-SQL (v_auth_kimlik müşteri UNION'ı + `v_auth_kimlik_admin` onarım view'ı + `eczanem_davetler.deneme_sayisi`) canlıda; rolCozucu `v_auth_kimlik_admin`'e geçti (K2'deki kritik bug onarıldı — service_role artık rol görüyor, canlıda doğrulandı); `lib/eczanem/davet.ts` (oluşturma: aktif eczane bağı, İP-§3.4 normalize telefon reddi, zaten-üye reddi, bekleyen davet iptali, ayar tabanlı geçerlilik, OTP+SMS; kabul: deneme sınırı, sabit-kod K-E8, müşteri doğumu/yeniden aktifleşme, UNIQUE-sessiz üyelik bağı, davet kapanışı); eczacı ekranı `app/eczanem/eczane/` (form + son-4-hane maskeli liste, süresi dolan sorgu-anında 'suresi_doldu'; ilk hâli `app/eclub/eczanem/` idi, modül bağımsızlığı kararıyla taşındı — §3) + müşteri ekranı `app/eczanem/davet/` (KVKK + kod). `roller.ts`'e MUSTERI_ROLU. Duman testi uçtan uca geçti (KVKK reddi, yanlış kod+sayaç, kabul+çerez oturumu, mükerrer kabul reddi, girişsiz 401, rolCozucu='musteri'); test verileri temizlendi. **Açık uç:** KVKK metni placeholder — gerçek metin İskender'den gelince `app/eczanem/davet/page.tsx` içindeki `KVKK_METNI` değişecek. Müşteri paneli yönlendirmesi U3'ü bekliyor (başarı ekranı gösteriliyor).
- [x] U3 — Faz 1c: proxy beşinci bekçi + müşteri panel iskeleti + KVKK silme akışı (K-E5). **Kapandı (11.07.2026):** U3-SQL (harcama `kaynak_kayit_id` nullable + ON DELETE SET NULL) canlıda. Beşinci bekçi proxy'de: `/eczanem/*` ROL tabanlı (rolCozucu), özel dal `/eczanem/eczane` (eczacı/teknisyen) genel daldan önce; girişsiz istisnalar: `/eczanem/giris`, `/eczanem/api/giris/*`, `/eczanem/davet`, `/eczanem/api/davet-kabul`. `KimlikTuru` += 'musteri' (AuthProvider çıkışı müşteri yollarında `/eczanem/giris`'e, login güvenlik ağı `/eczanem`'e). Müşteri girişi `/eczanem/giris` (2 adım), panel iskeleti `/eczanem` (video/puan placeholder + profil), KVKK silme `lib/eczanem/silme.ts` + `silme-otp`/`sil` API'leri (OTP teyitli, İP-§3.6). **Duman testi geçti:** bekçi 5 senaryo (oturumsuz yönlendirmeler, istisnalar, 401), müşteri çerezle rol yönlendirmeleri, silme uçtan uca — kişisel kayıtlar 0'landı, sipariş `musteri_id=NULL` + `musteri_etiket='Müşteri 1'` ile kaldı (parasal iz korundu), auth kaydı silindi, bayat çerez girişe düştü. Test verileri temizlendi.
- [x] U4 — Faz 2a: PM talep akışında 'eczanem' hedefi (İP-§4.1) — yalnız PM'e görünür. **Kapandı (11.07.2026):** `roller.ts`'e `ECZANEM_TALEP_ACAN_ROLLER = [pm, jr_pm, kd_pm]` (ürün müdürü ailesi — yetenekler.ts "kıdem unvanları, yetenek olarak özdeş" gerekçesiyle; yalnız 'pm'e daraltılacaksa tek satır). Form: hedef seçeneği yalnız bu ailede render edilir; eczanem'de teknik gizlenir/temizlenir (E-Club deseni), ürün tür kuralından bağımsız zorunlu (dörtlü kilit, İP-§4.3). API: `GECERLI_HEDEF_ROLLER` += eczanem + rol şartı (403) + teknik gevşetme + ürün şartı; `insertTeknikId` eczanem'de her hâlükârda NULL. **Duman testi (gerçek UI, geçti):** test PM login → 5. seçenek amber "Eczane Müşterileri" görünür → seçince Teknik alanı kayboldu → Fluzon'la talep oluştu (DB: hedef_rol=eczanem, teknik_id=NULL, icerik_turu=urun) → ürünsüz POST 400; test egt_md login → seçenek YOK → API POST 403 "yalnızca Ürün Müdürü". Test talep+bildirim+kullanıcılar temizlendi.
- [ ] U5 — Faz 2b: yayına alma — barkod + Karşılık (K-E3), periyot gizleme/NULL zorlaması, server doğrulamaları
- [ ] U6 — Faz 2c: UTT Eczanem ekranı (liste + eşik + gönderim) + eczane paneli gönderim (tekil/toplu, UNIQUE teklikler)
- [ ] U7 — Faz 3: müşteri izleme + soru + kazanım yazımı (`lib/eczanem/` tek-kaynak, kayıpsız model, dörtlü denormalizasyon)
- [ ] U8 — Faz 4: barkod→hesap ekranı + sipariş + `eczanem_siparis_onayla` RPC (FIFO, atomik) + fiş + eczacı onay kuyruğu
- [ ] U9 — Faz 5: görünürlük katmanları (eczane dökümü, UTT eczane×ürün, cascade, PM ürün ekseni)
- [ ] U10 — Doğrulama: tsc + lint:mimari + denetim her fazda; faz sonlarında ara fiziksel testler
- [ ] U11 — Uçtan uca fiziksel test (İskender): davet→OTP→üyelik, eşik, gönderim teklikleri, izleme→kazanım, dörtlü kilit sızmazlığı, FIFO/180 gün senaryosu, sipariş→onay→fiş→mükerrer onay reddi, KVKK silme sonrası toplamların korunumu, görünürlük sınırları (kişi verisi sızmıyor), İP-§11 risk tablosunun satır satır sağlaması
- [ ] U12 — Redbook güncellemesi: Eczanem bölümü (üçüncü katman) + değişen kesitler

**Teknik borç etkisi:** `hedef_rol` dar tipi borcu U0'da kapanır. Yeni borç üretmeme hedefi: RLS (K-E7 evet ise), izlenme-metriği-yok kararının kod yorumlarıyla sabitlenmesi, FIFO ledger'ın denetim scriptine doğal girişi.
