# Kalite Bulgu Raporu — FİNAL (Q1 tarama → Q5 kapanış)

*Kapanış (12.07.2026): 16 bulgudan KRİTİK+ORTA 8'i birer commit'le düzeltildi (§4); NOT'lar redbook §6.4'e işlendi; K-E1 ifadesi üç belgede eşitlendi (Turkcell, sözleşme/entegrasyon açık); B-14/B-07 metin düzeltmeleri redbook'ta yapıldı; `denetim:tutarlilik` kalıcı (Q4). Kalan tek iş: B-15 silme SQL'inin İskender'ce koşulması (§4 sonu) — sonrasında `npm run denetim:tutarlilik` tamamen yeşildir.*

*Tarama: 12.07.2026, Code (salt-okuma; Q0 kuralı — sıfır değişiklik). Kapsam: T-K1..8 kod desenleri, T-B1..5 belge-kod uyumu, T-D1..12 DB veri tutarlılığı (DATABASE_URL, session `READ ONLY` kilitli). Plan: docs/teknik_kalite_kontrol_is_plani.md.*

*DB bağlam notu: işlem verisi henüz sıfırdır (yayin_yonetimi/izleme/puan/öneri/eczanem tabloları boş; firmalar=2, kullanicilar=31, urunler=3, teknikler=3, eclub_eczane_master=34.174, 1 talep→senaryo→video→soru seti zinciri üretimde). Bu yüzden veri-bağımlı T-D maddeleri "ihlal yok" ama **vacuous** (boş kümede) geçmiştir — kalıcı script (Q4) asıl değerini canlı veri geldiğinde üretir.*

---

## 1. Bulgular

Format: `B-## | kategori | kanıt | önem | önerilen düzeltme`

### KRİTİK

- **B-01 | T-B1 (+T-K1) | kd_utt'nin /izle listesi her zaman boş.** Kanıt: `app/izle/api/route.ts:50-54` RPC'ye ham `p_rol` geçer; `get_izle_videolari` gövdesi (pg_get_functiondef) `p_rol = ANY(hedef_roller)` ile eşleşir; `hedef_roller` her zaman `[talep.hedef_rol]` olarak yazılır (`app/yayin-yonetimi/api/yayinlar/route.ts:55,166`) ve talep API'si yalnız `utt/bm/eczanem` kabul eder → `kd_utt` hiçbir yayının hedefinde olamaz. Ana sayfa emsali kd_utt'yi utt sayar (`app/ana-sayfa/api/route.ts:31` → `lib/utils/anaSayfa/utt.ts:48`), /izle saymaz. | KRİTİK | RPC çağrısından önce `kd_utt→utt` eşlemesi (tek satır; ana sayfa davranışıyla simetri). D2 ile düzeltme onaylı.

- **B-02 | T-K1 | `kendi_kendine` izlemede hedef rol kontrolü yok → hedef dışı yayından puan kazanılabilir.** Kanıt: `app/izle/api/baslat/route.ts:52-62` yalnız `durum='yayinda'` kontrol eder, `hedef_roller`'a hiç bakmaz; `app/izle/api/bitir/route.ts` bu izlemeye izleme/extra puanı yazar. Bir utt/kd_utt, yayin_id'sini bilerek bm/eczacı/eczanem hedefli yayını başlatıp tamamlayabilir ve puan kazanır (utt.ts sızıntısının API tarafı; T-D3 bunun VERİ izini arar — bugün veri boş, iz yok). | KRİTİK | `baslat`'a pozitif hedef süzgeci: yayının `hedef_roller`'ı kullanıcının rol eşleniğini (kd_utt≡utt) içermiyorsa red.

### ORTA

- **B-03 | T-K1 | /izle/[yayin_id] detayı hedef kontrolsüz `video_url` döner.** Kanıt: `app/izle/api/[yayin_id]/route.ts:25-33` — utt/kd_utt rol bekçisi var ama hedef süzgeci yok; her `yayinda` yayının video_url/puan bilgisi ID ile çekilebilir. Gerekçe yorumu da yok. | ORTA | B-02 ile aynı süzgeç bu route'a da.

- **B-04 | T-K3 | `user_metadata.rol` ile dallanan 8 client dosyası (login hariç).** Kanıt: `app/analiz/page.tsx:25`, `app/analiz/{bm,tm,yonetici,uretici}/layout.tsx:22-24`, `app/challenge-club/page.tsx:87`, `app/challenge-club/izle/[yayin_id]/page.tsx:53`, `app/cc-ligi/page.tsx:71`. rolCozucu bug'ının emsal sınıfı: metadata bayatlayabilir; sunucu API'leri rolCozucu kullandığından sızıntı değil ama yanlış UI/yönlendirme üretir. | ORTA | Bu sayfaların rol okumasını AuthProvider (`useAuth`) kimliğine bağlama; T-K3 lint kuralı adayı (Q4).

- **B-05 | T-B2 | Talep formu Eczacı/Ecz.Teknisyeni sunuyor, API reddediyor.** Kanıt: `app/talepler/_components/YeniTalepForm.tsx:83` seçenekler `utt, bm, eczaci, eczane_teknisyeni (+eczanem)`; `app/talepler/api/route.ts:22` `GECERLI_HEDEF_ROLLER=["utt","bm","eczanem"]`, `:145` red → kullanıcı "Hedef rol seçimi zorunludur" hatası alır. Ek tespit (Q2 incelemesi): koddaki "eczaci/eczane_teknisyeni üretimi ayrı akışta" yorumuna karşın repoda `talepler`'e INSERT eden TEK uç bu API'dir — E-Club hedefli içerik üretiminin başka yolu yok; E-Club öneri akışı ise bu hedefli yayınlara muhtaç. Form daraltılırsa E-Club içerik üretimi tamamen yolsuz kalır. | ORTA | D2 kararı doğrultusunda yön İskender'in: API genişletilir (muhtemel doğru) ya da form daraltılıp E-Club üretimi bilinçli ertelenmiş sayılır.

- **B-06 | T-B3 | Login temizliği (D3 onaylı).** Kanıt: `app/login/page.tsx:143` ölü `href="#"` "Şifremi unuttum"; `:50-51` `user_metadata.rol`/`eclub_kisi` okumaları; `:54,61` anon-key `kullanicilar`/`firmalar` sorguları (RLS dikkat listesi, B-10). | ORTA | Ölü link kaldırılır; yönlendirme kimliği AuthProvider'dan alınır (D3).

- **B-08 | T-K5 | Puan yazım hatası kullanıcıya "başarı" olarak dönüyor — sessiz veri kaybı envanteri.** Kanıt (tümü `[UYARI]` log + akış devam, hiçbirinde bilinçli-tasarım yorumu yok): `app/izle/api/bitir/route.ts:151,188,246` (izleme/extra/öneri puanı), `app/izle/api/cevap/route.ts:146,163` (cevap puanı/yanlış cevap kaybı), `app/izle/api/ileri-sarma/route.ts:37`, `app/eczanem/api/izleme/bitir/route.ts:78`, `app/eczanem/api/izleme/cevapla/route.ts:102`, `app/eclub/panel/api/bitir/route.ts:113`, `app/eclub/panel/api/cevapla/route.ts:135,146`. Düzeltme (Q2 incelemesi): ilk-izleme kontrolü `kazanilan_puanlar` varlığına baktığından, başarısız INSERT sonrası aynı turda videoyu BAŞTAN izlemek puanı yeniden doğurur — kayıp teknik olarak telafi edilebilir; ama kullanıcıya "başarılı" dendiği için tekrar izleme sebebi yoktur, kayıp fiilen kalıcıdır. Asıl risk günlük veri kaybı değil, hata SINIFININ görünmezliği: Eczanem U0/U1'deki GRANT'sız tablo emsalinde bu desen her INSERT'i sessizce yutar, fiziksel test "başarılı" görünürdü. | ORTA | Karar İskender'in: (a) hata durumunda kullanıcıya dürüst hata dön (izleme tamamlandı işareti geri alınmaz ama puan yeniden denenebilir olmalı) ya da (b) bilinçli yutma ise her noktaya gerekçe yorumu.

- **B-12 | T-K/T-B5 | Puansız pencere sunucu yerel saatine bağlı — Vercel'de (UTC) pencere 3 saat kayar.** Kanıt: `lib/zaman/kontrol.ts:26-35` `getDay()/getHours()` (yerel saat); redbook §3.1 kuralı "hafta içi 07:00–20:29" (TR varsayımı). Vercel UTC'de pencere fiilen TR 10:00–23:29 olur; hafta sonu sınırı da gece kayar. Local testte görünmez, canlıda yanlış davranır. | ORTA | Hesabı `Europe/Istanbul`'a sabitleme (Intl/`toLocaleString` ile TZ'li türetme) ya da Vercel'de `TZ` env — tek noktada, `lib/zaman/kontrol.ts`.

- **B-15 | T-D10 | auth.users'ta sahipsiz 3 test kullanıcısı.** Kanıt (SQL, salt-okuma): `auth.users`'ta olup `v_auth_kimlik_admin`'de hiçbir düzleme bağlanmayan: `utt@test.com`, `pm@test.com`, `bm@test.com`. Kimlik çözülemediği için giriş işlevsiz kalır ama canlı auth'ta test kalıntısıdır ("test verisi temizle" kuralı). | ORTA | Silme SQL'i İskender'e verilir (auth.admin ya da SQL; Code çalıştırmaz).

### NOT

- **B-07 | T-K4 | Korumalı tablo lint kuralı yalnız `.insert`'i kapsıyor.** Kanıt: `tools/eslint-rules/index.mjs:118` (`c.property?.name !== "insert"`); `.update/.delete/.upsert` kör nokta. Fiilî kaçak YOK: 13 korumalı tabloya `lib/puan|tur|eczanem` dışından 14 erişimin tamamı SELECT. Ek: redbook §6.2 kural tanımı muafiyeti "lib/puan + lib/tur" diye anlatıyor, kod `lib/eczanem`'i de muaf tutuyor (index.mjs:112). | NOT | Kural genişletme önerisi (Q4): yazım metodları listesi + redbook §6.2 ifadesi güncellenir.

- **B-09 | T-K6 | roller.ts dışında 125 hard-coded rol karşılaştırması (~60 dosya).** Kanıt: en yoğun `components/Navbar.tsx` (13), `app/store/siparisler/_components/SiparisFiltreleri.tsx` (9), `app/eclub/ligi/page.tsx` (5); tam liste grep ile yeniden üretilebilir. Çoğu `["utt","kd_utt"].includes(rol)` sınıfı — `TUKETICI_ROLLER` dururken. | NOT | Q4'te lint kuralı adayı; toplu mekanik değişiklik ayrı iş.

- **B-11 | T-K8 | Ölü env anahtarları.** Kanıt: `.env.local`'da `ADMIN_SECRET`, `BUNNY_LIBRARY_ID`, `BUNNY_API_KEY` tanımlı; repo kodunda (app/lib/scripts/config) hiç referans yok. K-E8 çift kilidin kod teyidi ise TAMAM: `lib/utils/ortam.ts:12-15` (VERCEL_ENV önceliği) + `lib/eczanem/otp.ts:44` (canlıda koşulsuz false); girişsiz test endpoint'i bulunamadı. | NOT | Anahtarlar ya kullanılacak ya .env'den düşülecek (İskender kararı).

- **B-13 | T-B4 | K-E1 ifadesi üç belgede çelişik.** Kanıt: `docs/eczanem_teknik_is_plani_100726.md:108,122` "KAPALI: Turkcell"; `docs/eczanem_teknik_is_plani.md:5,122` "açık karar" `[ ]`; redbook `:717` "karar gelmeden çıkılamaz". Muhtemel doğru okuma: sağlayıcı seçildi (Turkcell), sözleşme/entegrasyon açık. | NOT | İskender teyidiyle iki güncel belgede ifade eşitlenir (Q3'te tek commit).

- **B-14 | T-B5 | Redbook §5 "10 yeni eczanem_* tablosu" ↔ DB'de 11.** Kanıt: pg katalogda 11 `eczanem_*` tablosu (`eczanem_giris_otp` dahil); redbook §6.4 başka yerde "+11" diyor. Örneklem doğrulamasının geri kalanı: 15 iddiadan 13 birebir doğrulandı (proxy.ts bekçi, HedefRol 5 değer, CCLIGI_GORENLERLER, /izle 9 route, puanKazanilabilirMi, lib/oneri 3 dosya, oneriLimit ayar anahtarları, eclubKayit 4 fonksiyon, lib/eclub/store 4 dosya, lib/eczanem 10 dosya, dokum.ts'te musteri_id yalnız yorumda, sistem-ayarlari adminKontrol `kullanicilar` temelli); sapmalar B-07 (muafiyet ifadesi) ve bu madde. | NOT | "10"→"11" düzeltilir; belge güvenilirliği YÜKSEK (13/15).

- **B-16 | T-D12 | Tüm public tablolarda anon+authenticated'a TRUNCATE/REFERENCES/TRIGGER grant'i.** Kanıt: `role_table_grants` dökümü — DB default davranışı (U1 migration dersinde saptanan desenin öbür yüzü); PostgREST TRUNCATE endpoint'i sunmadığından bugün istismar yolu bilinmiyor, ama en-az-yetki hijyenine aykırı. | NOT | RLS işiyle (K-E7) birlikte toplu `REVOKE TRUNCATE, REFERENCES, TRIGGER ... FROM anon, authenticated` değerlendirilir.

### Rapor-only (düzeltme kapsam dışı — RLS/K-E7 girdisi)

- **B-10 | T-K7 + T-D12 | RLS hazırlık envanteri.** (1) **RLS hiçbir tabloda açık değil** (pg_class.relrowsecurity=true → 0 satır). (2) **anon'a SELECT açık 19 tablo:** analiz_* (4), oneri_kayip_kayitlari, senaryo_durumu, senaryolar, soru_seti_durumu, soru_seti_puanlari, soru_setleri, talepler, teknikler, urunler, v_yayin_detay, video_durumu, video_puanlari, videolar, yanlis_cevap_kayitlari, yayin_yonetimi — yani tarayıcıya giden anon key ile **tüm içerik + soru setleri (cevaplar dahil) + kullanici_id'li kayıp kayıtları** okunabilir. authenticated 60 tabloda SELECT'li. (3) **RLS açılınca kırılacak anon/oturum-key istemci okumaları (16 dosya):** AuthProvider (`v_auth_kimlik` — kendi-satır policy ister), login (`kullanicilar`,`firmalar`), profil, kullanicilar, videolar (+detay), senaryolar (+detay), soru-setleri (+detay), yayin-yonetimi hook (`v_yayin_detay`,`yayin_yonetimi`,`soru_seti_puanlari`), talepler detay + form hook, hbligi (`kullanicilar`), challenge-club izle (`v_yayin_detay`,`yayin_yonetimi`), UreticiAnaSayfa (`kullanicilar`,`takimlar`) + 2 storage bucket (`profil-fotograflari`, `talep-dosyalari`). | Eczanem GRANT deseni beklenene UYGUN: 11 tabloda service_role tam DML, anon/authenticated DML'siz.

## 2. Temiz çıkan taramalar

- **T-K2 (kimlik bağlamı):** `auth.uid()` filtreli tek view `v_auth_kimlik`; tek tüketicisi client bağlamlı AuthProvider (doğru); `rolCozucu` service_role ile filtresiz `_admin` ikizini okuyor (onarılmış desen). Service_role↔auth.uid() uyumsuzluğu KALMADI.
- **T-K1 liste uçları:** `oneriler/api/yayinlar` (`hedef_rol='utt'` süzgeçli), üretici uçları (`uretici_id` sahiplik), eclub/eczanem akışları (öneri/gönderim sahipliğiyle yapısal daralma) temiz; ihlaller B-01..B-03'te.
- **T-D1..T-D8, T-D11 (veri tutarlılığı SQL'leri):** tümü 0 ihlal — ancak işlem verisi boşken vacuous (üst not). Sorgular Q4'te `scripts/denetim/tutarlilik/` altında kalıcılaşmaya hazır (taslaklar bu taramada yazıldı ve koştu).
- **T-D9 (teklikler):** `UNIQUE(yayin_id,tur_no)`, `eczanem_gonderimler(yayin_id,musteri_id)`, `eczanem_uyelikler(musteri_id,eczane_id)`, `eczanem_musteriler(telefon)`, `(auth_user_id)`, `eczanem_siparisler(islem_kodu)` pg_constraint'te kanıtlı; dörtlü kilit kolonlarında NULL=0.
- **T-D10a/b:** çok-düzlemli auth_id yok; kod tablolarında sahipsiz auth bağı yok (ters yön bulgusu B-15).

## 3. Q2 — Değerlendirme sonucu (12.07.2026, İskender)

**Onaylı Q3 düzeltme listesi ve sırası** (bir bulgu = bir commit): B-01 → B-02 → B-03 → B-05 → B-06 → B-04 → B-08 → B-12 → B-15.

Q2'de bağlanan kararlar:
- **B-05 yönü:** Kayıt kontrol listesi (`GECERLI_HEDEF_ROLLER`) genişletilir — `eczaci` ve `eczane_teknisyeni` eklenir; form olduğu gibi kalır. Gerekçe (İskender): üretici rolün eczacı ya da eczane teknisyeni için talep açması normal akışın kendisidir; kod tasarımın gerisinde kalmıştır.
- **B-08 stratejisi:** Yanıtta dürüst uyarı — izleme tamamlanır, puan yazılamadıysa yanıt bunu açıkça söyler ("puan kaydedilemedi; videoyu yeniden izlerseniz puan doğar"); log korunur.
- **B-12 yaklaşımı:** Pencere hesabı kodda `Europe/Istanbul`'a sabitlenir (TZ env'e güvenilmez).
- **B-13 gerçek durumu:** K-E1 kapalı — Turkcell seçildi; açık kalan yalnız sözleşme/entegrasyon. Belgeler bu ifadeye eşitlenecek (§6.4 kaydı buna göre).
- **B-15:** Silme SQL'i hazırlanıp İskender'e verilir; Code çalıştırmaz.

NOT'lar (B-07, B-09, B-11, B-13, B-14, B-16) redbook §6.4'e açık iş olarak işlenir (Q5); B-10 K-E7 (RLS) işinin girdi belgesidir.

## 4. Q3 — Uygulama kaydı (12.07.2026)

Her commit tsc + `npm run denetim` + `npm run lint:mimari` üçlüsünden temiz geçti.

| Bulgu | Commit | Kanıt / not |
|---|---|---|
| B-01 | `b01e97f` | RPC çağrısına `kd_utt→utt` eşlemesi. Davranış kanıtı kod düzeyinde (RPC gövdesi `p_rol=ANY(hedef_roller)` + `hedef_roller=[talep.hedef_rol]`); DB'de yayın verisi olmadığından uçtan uca kanıt U10 fiziksel testine düşer. |
| B-02 | `3313aed` | `baslat`'a pozitif hedef süzgeci (`hedef_roller` + kd_utt≡utt + NULL→['utt'] RPC simetrisi). |
| B-03 | `3741bc1` | `[yayin_id]` detayına aynı süzgeç (`v_yayin_detay.hedef_rol !== 'utt'` → red). |
| B-05 | `0a1a10c` | `GECERLI_HEDEF_ROLLER = TUM_HEDEF_ROLLER` (tek kaynak); teknik-zorunlu muafiyeti eclub hedeflerine genişletildi (form `teknikGosterilsin` simetrisi). |
| B-06 | `7497172` | Metadata okumaları kaldırıldı; firma-aktif kontrolü `useAuth` kimliğiyle (firma_id oradan) useEffect'e taşındı — `kullanicilar` anon sorgusu da düştü; ölü link kaldırıldı. |
| B-04 | `ef18daa` | 5 server guard (`analiz` ailesi) `rolCozucu`'ya, 3 client sayfa (`challenge-club`, `cc-ligi`, cc izle) `useAuth`'a bağlandı; sayfalarda `user_metadata.rol` okuması kalmadı (grep ile doğrulandı). |
| B-08 | `2b3ce1e` | 6 route (`izle/bitir`, `izle/cevap`, `eczanem/bitir+cevapla`, `eclub/bitir+cevapla`) yanıta `puan_uyarisi` ekler; 3 oynatıcı gösterir. Önce/sonra: `izle/cevap` puanı yazım DENEMEDEN önce sayıyordu — artık yalnız başarılı yazımda sayılır. |
| B-12 | `7ebe096` | Önce/sonra kanıtı (TZ=UTC altında smoke): eski kod Salı 05:00 UTC'yi (=08:00 TR) puansız sayar, 18:30 UTC'yi (=21:30 TR) puanlı sayardı; yeni kod 08:00 TR → TRUE, 21:30 TR → FALSE. |
| B-15 | SQL aşağıda | Code çalıştırmaz — İskender koşar. |

**Ek tespit (B-12 sırasında):** `haftaBaslangici` / `ayBaslangici` / `yilBaslangici` / `isGunuEkle` hâlâ sunucu yerel saatiyle çalışır — UTC sunucuda gün/ay sınırları 3 saat kayar (yalnız 00:00–03:00 TR aralığına düşen kayıtları etkiler). Redbook §6.4'e NOT olarak işlenecek.

### B-15 silme SQL'i (İskender koşar)

```sql
-- Önce doğrula: yalnız 3 satır dönmeli (v_auth_kimlik_admin'de karşılığı olmayan test kullanıcıları)
SELECT id, email FROM auth.users
WHERE email IN ('utt@test.com', 'pm@test.com', 'bm@test.com');

-- Sil (auth.identities/sessions FK cascade ile temizlenir)
DELETE FROM auth.users
WHERE email IN ('utt@test.com', 'pm@test.com', 'bm@test.com');
```

---

# Admin Paneli TAM Taraması (17.07.2026 — v2)

*Bu bölüm, aynı gün yapılan ilk (kısmi) admin taramasının YERİNE geçer — ilk tarama kapsam eksikliği nedeniyle İskender tarafından reddedilmiştir; B-27'si (sayfa kapısı yok iddiası) bu tam taramada YANLIŞ çıkmıştır (düzeltme: B-33).*

*Tarama: 17.07.2026, Code (salt-okuma; Q0 — sıfır değişiklik). Kapsam: `app/admin/**`'ın TAMAMI — 24 API rotası, 15 hook, ~20 bileşen satır düzeyinde + dokundukları lib katmanı (`lib/store/storage+siparis`, `lib/eclub/store/*`, `lib/utils/adminGirisKontrol`, `lib/firma/kolonlar`, `lib/uretici/yetenekler` çağrı yüzeyi) + proxy admin bekçisi. DB doğrulamaları DATABASE_URL salt-okuma: rol bütünlüğü (12 rol, tümü geçerli — B-18 sızması henüz gerçekleşmemiş), FK haritası (urunler←9 tablo, teknikler/takimlar/firmalar←talepler), firma sayısı=1 (B-22 uykuda).*

## 5. Bulgular (admin tam taraması)

Format: `B-## | kategori | kanıt | önem | önerilen düzeltme`

### KRİTİK

- **B-17 | T-K5 | Toplu kullanıcı yüklemede kısmi başarısızlık UI'da yutulur — her koşulda "Ekleme başarılı."** Kanıt: route satır bazında devam edip `{basarili, hatali, hatalar[]}` döner, durum 200 (`app/admin/api/firmalar/[firma_id]/toplu-yukle/route.ts:137-193`); hook yalnız `res.ok`'a bakar, `data.hatalar`'ı okumaz, formu sıfırlar (`app/admin/_hooks/useTopluForm.ts:47-62`). 11 satırın 5'i kaydolmasa admin asla görmez (B-08 sınıfının admin emsali). | KRİTİK | Hook `hatali>0` ise satır hatalarını görünür listeler; "X başarılı, Y hatalı" özeti.

- **B-18 | T-K1 | Toplu yüklemede ROL DOĞRULAMASI YOK — geçersiz rol "Hazır" sayılıp DB'ye yazılır.** Kanıt: tekli rota `TUM_ROLLER.includes` uygular (`kullanicilar/route.ts:102`); toplu rota rolü hiçbir listeye vurmaz (`toplu-yukle/route.ts:75-131`, dosyada roller.ts import'u yok) — `genel_mudur` gibi değer takım/bölge listelerinin ikisine de girmediğinden zorunluluk kontrolünden de muaf kalıp `kullanicilar.rol`'e yazılır; hiçbir yetki kapısından geçemeyen hayalet kullanıcı doğar. Fiziksel test dosyasında 4 satır bu sınıftaydı. DB bugün temiz (sızma yalnız toplu yükleme hiç başarılı koşmadığı için yaşanmadı). | KRİTİK | B-21'deki ortak doğrulama lib'i.

- **B-19 | T-K5 | Toplu SİL ve toplu PASİF, satır yanıtlarını hiç okumaz — silme kısmen başarısız olsa da "Silme işlemi başarılı."** Kanıt: `useKullaniciListesi.ts:142-155` (`handleTopluPasif`) ve `:159-173` (`handleTopluSil`) — döngüdeki `fetch`'lerin `res.ok`'u kontrol edilmez, koşulsuz `basari(...)` + seçim temizlenir. Tekil `handleSil` (127-139) doğru davranır. Arşiv/Auth hatasında satır sessizce hayatta kalır, admin yanlış bilgilendirilir. | KRİTİK | Döngüde sonuç toplama + "X silindi, Y silinemedi (sebep)" raporu.

- **B-20 | T-K5 | Export'ta veri sorgularının hataları yutulur; eksik Excel'e "tam yedek" muamelesi yapılır ve firma silme yolu açılır.** Kanıt: `export/route.ts` yalnız firma sorgusunda hata kontrol eder (:39-47); takımlar/bölgeler/kullanıcılar/ürünler/teknikler/talepler/yayın zinciri/puan-kayıp sorgularının TÜMÜ `const { data } = ...` ile error'suz (:50,:61,:70,:87,:95,:102,:116-161,:229,:246-270) — bir sorgu hata verirse ilgili sayfa sessizce boş kalır; buna rağmen `son_export_at` koşulsuz güncellenir (:352-356) ve firma DELETE'in export ön koşulu (:157-175, `[firma_id]/route.ts`) sağlanmış sayılır. Sonuç: eksik yedek + silinebilir firma = geri dönüşsüz veri kaybı zinciri. | KRİTİK | Her sorguda hata kontrolü; herhangi biri hata verirse export'u hata ile kes, `son_export_at` güncelleme.

### ORTA

- **B-21 | T-K1/T-K6 | Tekli ve toplu kullanıcı ekleme İKİ AYRI kural setiyle çalışır.** Kanıt: tekli rota rol kurallarını `ureticiYetenegi` + `TUKETICI_ROLLER`'dan türetir (`kullanicilar/route.ts:108-222`); toplu rota koda gömülü `["pm","jr_pm","kd_pm","tm"]` / `["bm","utt","kd_utt"]` listeleriyle (`toplu-yukle/route.ts:108,118`) — üretici yetenek profili toplu tarafta yok; İlke 3 (tek kaynak) ihlali + davranış sapması. | ORTA | Satır doğrulama + takım/bölge çözümü tek lib fonksiyonuna; iki rota da onu çağırır (B-18'i de kapatır).

- **B-22 | T-K1 | Bölge çözümünde firma kapsamı doğrulanmıyor.** Kanıt: tekli POST bm/utt yolunda `bolgeler` SELECT'i firma filtresi olmadan (`kullanicilar/route.ts:198-217`; takım sorgularındaki `.eq("firma_id")` simetriği yok); toplu rota tüm bölgeleri firma'sız çeker (`toplu-yukle/route.ts:50-52`). İkinci firma açıldığında aynı adlı bölge yanlış firmaya bağlanabilir (bugün firma=1, uykuda). | ORTA | Bölge çözümü `bolgeler→takimlar.firma_id` üzerinden firmaya kilitlenir.

- **B-23 | T-K1 | Rol değişikliğinde takım/bölge tutarlılığı denetlenmez; rol tipi de doğrulanmaz.** Kanıt: PUT yalnız `TUM_ROLLER` üyeliğine bakar, takım/bölge alanlarına dokunmaz (`kullanicilar/route.ts:288-303`); KullaniciListesi satır içi rol dropdown'ı bu ucu kullanır (`useKullaniciListesi.ts:88-99`). utt→tm geçişinde `bolge_id` kalır, takım zorunluluğu aranmaz → rol-veri uyumsuz kullanıcı. Ek: `rol.trim()` (:289) — rol string değilse (ör. sayı) 500. | ORTA | Rol geçişine yeni rolün zorunlulukları (B-21 ortak fonksiyonu) uygulanır; string kontrolü eklenir.

- **B-24 | T-K5 | Kullanıcı silmede Auth-önce sıra geri alınamaz yarım durum bırakabilir.** Kanıt: `auth.admin.deleteUser` başarılı olup `kullanicilar` DELETE başarısız olursa (FK vb.) auth'suz yetim satır kalır; telafi yok (`kullanicilar/route.ts:356-367`; POST'taki rollback deseninin — :249-251 — simetriği yok). | ORTA | Sıra ters çevrilir ya da DB hatasında telafi eklenir.

- **B-25 | T-B (UX) | Toplu yükleme insan-format toleranssız; satır hatası fiilen görünmez.** Kanıt: başlıklar makine adıyla birebir aranır (`toplu-yukle/route.ts:77-83`; "Ad/E-posta/Takım" başlıklı insan dosyası 11/11 "Zorunlu alan eksik" — fiziksel test kanıtı); rol yalnız kod kabul eder, `ROL_ADLARI` (roller.ts:215) kullanılmaz; hata yalnız `title` tooltip'inde (`TopluGirisFormu.tsx:110`) ve kullanıcıda hiç çıkmadı; indirilecek şablon yok. | ORTA | Esnek başlık eşleme + rol ad→kod çevirisi + görünür hata sütunu + "şablonu indir".

- **B-26 | T-D/T-K6 | Admin uçlarında EN AZ DÖRT savunma deseni; bu iş için yazılmış `adminGirisKontrol` ölü kod.** Kanıt: (1) `/admin/api/*` rotalarının çoğunda route-içi kontrol YOK, koruma yalnız proxy bekçisi (proxy.ts:43-72); (2) store/eclub-store rotaları proxy yolunun DIŞINDA, route-içi `rolCozucu`+`ADMIN_ROLLER` ile (`store/api/urun/route.ts:33-45` vb.); (3) `sistem-ayarlari` ve `eclub/*` rotaları KENDİ yerel `adminKontrol` kopyalarıyla (`sistem-ayarlari/route.ts:17-28`, `eclub/kayitli/route.ts:14-25`, `eclub/onaylar`, `eclub-store/*`); (4) `lib/utils/adminGirisKontrol.ts` repo genelinde hiçbir yerden çağrılmıyor (dosya başı "her admin route'unda kullanın" talimatına rağmen — grep 0 sonuç). Bugün açık kapı yok ama tek-katman bağımlılığı + kopya çokluğu kırılgan. | ORTA | Tüm rotalar `adminGirisKontrol`'e bağlanır; yerel kopyalar silinir.

- **B-27 | T-K1 | E-Club Store siparişinde serbest durum atlama — teslim edilmiş siparişe puan iadesi mümkün.** Kanıt: `action="durum"` dört durum arasında HER YÖNE geçişe izin verir, geçiş matrisi yok (`eclub-store/api/siparis/route.ts:10,90-107`); `teslim_edildi → beklemede` çekilip `action="iptal"` ile RPC iadesi tetiklenebilir — ürün müşteride, puan+stok iade edilmiş olur. HBStore simetriği kısıtlı (yalnız beklemede→kargoda, `store/api/siparis/route.ts:129-145`). "iptal" değeri listede olmadığından iade-atlamalı iptal yolu YOK (o kapı kapalı). | ORTA | Geçiş matrisi: beklemede→hazirlaniyor→kargoda→teslim_edildi ileri yönlü; teslim_edildi'den geri dönüş kapalı.

- **B-28 | T-B2 | Sistem Ayarları paneli jsonb-NESNE değerli anahtarı yönetemiyor.** Kanıt: sunucu doğrulaması yalnız pozitif sayı / sayı dizisi kabul eder (`sistem-ayarlari/route.ts:31-37`); UI `degerMetni` nesneyi `String(deger)` = "[object Object]" basar (`SistemAyarlari.tsx:24-25`). P0'da eklenen `push_olay_aktif` (jsonb nesne) panelde bozuk görünür ve düzenlenemez — push planı B.2-6 ("olay bazlı aç/kapa `sistem_ayarlari`'ndan yönetilir") fiilen karşılanmaz. | ORTA | Panel+route'a nesne (anahtar→boolean) değer desteği; ya da push_olay_aktif için özel toggle UI.

- **B-29 | T-K5 | Ürün/teknik silmede bağlı-veri koruması yok — kullanımda olan kayıt ham FK hatasıyla düşer.** Kanıt: `urunler/route.ts:95-131` ve `teknikler/route.ts:75-111` DELETE'lerinde hiçbir bağlılık kontrolü yok; FK haritası (sema.json): `urunler` ← talepler, kazanilan_puanlar, eczanem_urun_tarifeleri, ileri_sarma, oneri_kayip, challenge_kayip, eclub_* (9 tablo); `teknikler` ← talepler. Kullanımdaki ürünün silinmesi "Ürün silinemedi." ham mesajıyla düşer (takım/bölge/kullanıcı silmelerindeki rehberli engellerin — `[takim_id]/route.ts:97-112` — simetriği yok). | ORTA | Silme öncesi bağlılık sayımı + açıklayıcı 422 ("X talepte kullanılıyor").

- **B-30 | T-B5 | "Export edilirse firma silinir" vaadi kodda tutmuyor — talepli firma FK nedeniyle her koşulda silinemez.** Kanıt: firma DELETE export + takım + kullanıcı kontrollerinden geçse bile (`[firma_id]/route.ts:149-192`) `talepler.firma_id → firmalar` FK'sı (sema.json) DELETE'i düşürür; yanıt ham "Firma silinemedi." (:199) — sebep söylenmez, talepler için rehberli engel yok. | ORTA | Talep (ve varsa diğer FK) sayımı + açıklayıcı engel; ya da talepli firma silme akışı bilinçli tanımlanır.

### NOT

- **B-31 | T-K6 | Admin'de yerel `ROLLER` kopyası + dropdown'larda ham rol kodu.** Kanıt: `_constants.ts:5-10` kendi listesi (roller.ts'ten import yok; `admin` bilinçli hariç olabilir); `TekilGirisFormu.tsx:56` ve `KullaniciListesi.tsx:220-229` kodu ham basar — `ROL_ADLARI` dururken insan "kd_utt" görür. | NOT | `TUM_ROLLER`(−admin) türetimi + görünümde `ROL_ADLARI[kod]`.

- **B-32 | T-K5 | Eski hook'larda fetch try/catch'siz — ağ hatasında loading takılır; dosya input'u sıfırlanmaz.** Kanıt: `useAdminPanel` (36-64, 66-77…), `useTekilForm` (66-89), `useTopluForm` (31-62), `useKullaniciListesi` (tekil handler'lar) korumasız — fırlatan fetch loading state'ini açık bırakır ("Dosya okunuyor..." kalıcı); yeni katman (eclub/store/eclub-store hook'ları, modallar) try/catch'li — tutarsızlık. Ek: `TopluGirisFormu` input `value` reset edilmediğinden düzeltilen dosya aynı adla yeniden seçilince `onChange` tetiklenmez. | NOT | try/finally standardı + seçim sonrası `e.target.value=""`.

- **B-33 | DÜZELTME (ilk taramanın B-27'si yanlıştı) | /admin sayfa kapısı VARDIR.** Kanıt: `useAdminPanel.ts:28-34`, `useStoreAdminPanel.ts:29`, `useEclubStoreAdminPanel.ts:62` — admin değilse `/ana-sayfa`'ya yönlendirir. Kalan küçük izler: üç yerde `rol !== "admin"` hardcoded (`ADMIN_ROLLER` yerine — B-09 sınıfı) ve kapı yalnız client-side (veri zaten API'lerce korunur). | NOT | `ADMIN_ROLLER.includes` kullanımı; istenirse proxy'ye `/admin` sayfa kapsamı.

- **B-34 | T-K7 | test-verileri-sil kapsamı push tablolarını bilmiyor.** Kanıt: `SILINECEK_TABLOLAR` (test-verileri-sil/route.ts:37-93) 12.07 envanteri; 16.07'de doğan `push_gonderim_kayitlari` (işlem verisi) listede yok — test temizliğinde kalıntı kalır (`push_abonelikleri` kimlik-benzeri, korunması savunulabilir). | NOT | Listeye `push_gonderim_kayitlari` eklenir; araç zaten deploy öncesi kaldırılacak.

- **B-35 | T-K5 | Takım listesinde N+1 fetch.** Kanıt: `useAdminPanel.ts:52-64` — her takım için ayrı bölge isteği. Mevcut ölçekte zararsız. | NOT | Bölgeleri tek istekte döndüren uca geçiş (istenirse).

- **B-36 | T-K1 | Şifre politikası yok.** Kanıt: tekli/toplu yalnız boş-değil + ≤200 kontrol eder (`kullanicilar/route.ts:93,99`; `toplu-yukle/route.ts:95`); Supabase min-6 kuralına takılan şifre ham İngilizce Auth hatası olarak döner. | NOT | Min uzunluk kontrolü + Türkçe mesaj.

- **B-37 | T-K1 | E-Club Store admin iptalinde alan anlamları kayıyor.** Kanıt: `iptal_eden_kisi_id`'ye AUTH id yazılır (admin'in eclub kisi kaydı yoktur; `eclub-store/api/siparis/route.ts:110-118`); `sebep` opsiyonel (HBStore'da zorunlu — `store/api/siparis/route.ts:166-168`) — kayıt izi tutarsız. | NOT | is_admin=true yolunda alan sözleşmesi netleştirilir; sebep zorunlu yapılır.

- **B-38 | T-K1 | Store ürün PATCH'inde kategori varlık kontrolü yok.** Kanıt: POST kategori doğrular (`store/api/urun/route.ts:112-120`), PATCH `kategori_id`'yi kontrolsüz yazar (:170-171) — geçersiz id ham FK hatası. | NOT | PATCH'e aynı kontrol.

## 6. Temiz çıkan taramalar (admin tam taraması)

- **Takım/bölge rotaları** (takimlar, [takim_id], bolgeler, [bolge_id]): firma/takım kapsaması, ad-teklik kontrolleri, silmede rehberli bağlılık engelleri — panelin ÖRNEK deseni; bulguların çoğu bu desenden sapmadır.
- **Firma CRUD + PATCH bayrakları**: validasyon, mükerrer ad, `FIRMA_KOLONLARI` tek kaynağı, beş modül anahtarının tek uçta yönetimi doğru.
- **Tekli kullanıcı POST**: rol doğrulama + `ureticiYetenegi` profili + Auth→DB rollback telafisi yerinde.
- **Sipariş para hareketleri atomik**: HBStore/E-Club Store iptal ve teslim RPC'lerde (`store_siparis_iptal`, `eclub_store_siparis_iptal`, `*_teslim_aldim`) — TS tarafında parça parça para işlemi yok (B-27 durum-atlamayı yönetim katmanında bırakır, RPC'ler kendi kurallarını korur).
- **Storage katmanı**: mime + 2MB sınırı iki store'da da; PATCH/DELETE'te eski görselin temizlenmesi ve "görsel silinemese de kayıt tutarlı" log yaklaşımı bilinçli.
- **E-Club onay/kayıt akışı**: bekleyen kontrolü, karar validasyonu, reddedilen kaydın güvenli hard-delete gerekçesi; harita temelli birleştirme (N+1'siz).
- **test-verileri-sil**: FK-sıralı silme + silme öncesi stok iadesi + tablo başına sonuç raporu + kapsamlı onay modalı (kapsam eksiği yalnız B-34).
- **Silme onayları UI genelinde**: tekil inline "Eminim", toplu iki aşama, firma `window.confirm`, store/eclub-store inline onaylar, TestVeriSilModal listeli onay.
- **Export üretimi**: harita temelli zincir çözümü (N+1'siz), şifre/hassas alan dışarı çıkmıyor, ASCII-güvenli dosya adı (sorun yalnız B-20 hata yutumu).
- **Yeni katman hata işleyişi**: eclub/store/eclub-store hook'ları ve modallar try/catch + `res.ok` disiplinli.

*Q2 kararı (İskender, 17.07.2026): önem ayrımı yapılmadan TÜMÜ düzeltilecek; iş, admin modernizasyon planının (docs/admin_modernizasyon_is_plani.md) M0–M5 fazlarına bağlandı.*

## 7. Uygulama kaydı — M0 (17.07.2026)

Her commit tsc + `npm run denetim` + `npm run lint:mimari` üçlüsünden temiz geçti.

| Bulgu | Commit | Önce → Sonra |
|---|---|---|
| B-17 | `58a8063` | Hook `data.hatalar`'ı okumuyordu, koşulsuz "Ekleme başarılı." → kaydet sonucu `{basarili, hatali, hatalar[]}` state'e alınır, ekranda renkli kutuda satır satır listelenir; kısmi hatada önizleme temizlenmez. |
| B-19 | `ce471bc` | Toplu sil/pasif döngüsü `res.ok` okumuyordu → ortak `topluIslemKos`: satır sonuçları toplanır, "X başarılı, Y başarısız (sebepler)" raporlanır; başarısızlar seçili bırakılır. |
| B-18+B-21+B-22 | `8dc1a2e` | İki rota iki ayrı kural seti; toplu tarafta rol doğrulaması yok; bölge sorguları firma'sız → `lib/admin/kullaniciDogrulama.ts` TEK kaynak: `firmaYapisiYukle` (bölgeler takım→firma zinciriyle kilitli) + saf `kullaniciSatirDogrula` (TUM_ROLLER + ureticiYetenegi kuralları); tekli ve toplu rota aynı fonksiyonu çağırır. (B-22 aynı kod yolunda doğal olarak kapandı — ayrı commit'e bölmek bilinçli kötü ara-kod gerektirecekti.) |
| B-20 | `1ab3af2` | 17 export sorgusunun hatası yutuluyordu, `son_export_at` koşulsuz güncelleniyordu → her sorguda kontrol; herhangi biri düşerse "Dışa aktarma iptal edildi: ... eksik yedek üretilmez." ile kesilir; damga yalnız tam yedekte atılır. |
| B-23 | `16741b1` | PUT rol değişiminde takım/bölge dokunulmuyordu → `rolGecisiCoz` (kural kitabına eklendi): yeni rolün zorunlulukları uygulanır (utt→tm takım ister; yönetici sınıfına geçişte takım/bölge temizlenir); `rol` tip kontrolü eklendi. |
| B-24 | `ece0ed1` | Auth-önce silme, DB hatasında geri alınamaz yetim satır bırakıyordu → sıra arşiv→DB→Auth; DB düşerse arşiv geri alınır, Auth düşerse satır kopyadan geri yazılır — her adım telafili. |

## 8. Uygulama kaydı — M1 (17.07.2026)

| Bulgu | Commit | Önce → Sonra |
|---|---|---|
| B-26 | `4196029` | 4 farklı savunma deseni + ölü `adminGirisKontrol` → giriş hariç 23 rotanın TÜM handler'ları `adminGirisKontrol()`'den geçer (grep haritasıyla doğrulandı); yerel `adminKontrol`/`yetkiAl` kopyaları tek bekçiye saran ince sarmalayıcıya indirildi; `/admin/api/*` artık proxy + route çift katmanlı. |
| B-32 | `1ba09f6` | Eski hook'larda korumasız fetch'ler; ağ hatasında "yükleniyor..." takılı, aynı dosya yeniden seçilemiyor → `useAdminPanel` (10 fonksiyon) + `useTekilForm` + `useTopluForm` + `useKullaniciListesi` try/catch/finally standardında; loading her koşulda kapanır; dosya input'u seçim sonrası sıfırlanır. |
| B-33 | `bf41b9f` | Üç shell'de `rol !== "admin"` sabit karşılaştırma → `ADMIN_ROLLER.includes(...)` (tek kaynak). (İlk taramanın "kapı yok" iddiasının düzeltmesi raporda kayıtlı; kapılar zaten vardı.) |
| B-36 | `e0d9b15` | Şifre yalnız boş-değil kontrolüydü; kısa şifre ham İngilizce Auth hatası döndürüyordu → kural kitabına min-6 + Türkçe mesaj; tekli ve toplu aynı kuraldan geçer. |

Kalan işler: B-25 + K-A6 eksik-kabul modeli (M3), yeni bilgi mimarisi (M2), modül sekmeleri (M4), B-27/B-28/B-29/B-30/B-34/B-35/B-37/B-38 (M5).

## 9. Süreç incelemesi bulguları — normal üretim kolu (21.07.2026, İskender talimatıyla kaydedildi)

B-39 | T-K | Kanıt: `app/senaryolar/api/durum/route.ts:95` ve `app/videolar/api/durum/route.ts:125` — senaryo onayında açılan boş video kaydına ve video onayında açılan boş soru seti kaydına `iu_id: user.id` yazılır; `user` o anda onayı veren PM'dir. Alan, İU işi teslim ettiğinde (`app/videolar/api/route.ts:86`, `app/soru-setleri/api/route.ts:100`) İU kimliğiyle üzerine yazılarak düzelir. | Önem: NOT | Önerilen düzeltme: ara evrede `iu_id`'ye PM yazmak yerine NULL bırakmak (hazır kol zinciri `lib/hazirVideoSoruSeti/zincir.ts` zaten `iu_id: null` deseniyle çalışıyor) ya da senaryodaki İU'yu taşımak; "bu işin İU'su kim" sorusu ara evrede yanlış cevap vermesin. Bekleyen: İskender onayı.
