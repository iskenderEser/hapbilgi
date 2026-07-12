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
