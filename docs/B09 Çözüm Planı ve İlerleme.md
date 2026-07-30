# B09 Çözüm Planı ve İlerleme

*Kaynak: `B09 — Modül × İş Süreci × Rol × Kod Matrisi (Çekirdek Modüller).md` + 30.07 kararları.
Bu belge canlı ilerleme takibidir: her adımın **Durum** alanı vardır (bekliyor / yapıldı),
adım bitince "yapıldı" işaretlenip kod ile birlikte commit edilir. Kesinti olursa bu belge
tek başına devam için yeterlidir (hedef sabitler + dosya listeleri burada).*

---

## ▶ DEVAM NOKTASI (son güncelleme: 30.07 — E3 sonrası)

> Yeni oturum buradan devam etsin. Tüm iş commit'li; çalışma ağacında B-09'a ait
> bekleyen değişiklik yok.

- **Tamamlanan:** **T-CLUB BİTTİ** — G1 (bekçi) · T1 · T2 · T3 · T3b · T4 · T5 · T6 · T7. **E-CLUB: E1 · E2 · E3 yapıldı.** Hepsi commit'li, üçlü doğrulamadan geçti.
- **Sıradaki adımlar:** E-Club → E4 (ops) → C1 (dokunma) → Ez1 → Ez2 (ops) → kompleks modüller.
- **Kalan tekil `=== "iu"` (kendi adımlarında süpürülecek):** `ana-sayfa/api:33` T6'da yapıldı; kalanlar
  `talepler/api/route.ts:36,303` + `talepler/[talep_id]/page`, `onaylanan-talepler/page:87`,
  `lib/utils/durum/mesaj.ts:178`, `lib/uretim/surec.ts:255` (.eq) — hepsi tekil, sınırda.
- **Bekçi baseline durumu:** başlangıç 50 → **şu an 19** (T2 −8 izle, T3b −takımlar, T5 −dosyalar, T6 −ana-sayfa+hbligi, T7 −izle/api/route, E1 −8 eclub, E2 −7 eclub, E3 −3 eclub;
  T4 dosyaları baseline'da değildi — tekil `=== "iu"` kural kapsamında değil). `tools/eslint-rules/index.mjs` `ROL_BASELINE`.

---

## Kararlar (30.07 — kapalı)

1. **Regresyon bekçisi kurulacak, ÖNCE (kesin).** ESLint `hapbilgi-mimari/rol-tek-kaynak` kuralı.
   Ratchet modeli: mevcut 132 dosya baseline'a alınır (tanınır, geçer); **yeni** elle rol yazımı
   anında reddedilir. Her modül temizlendikçe o dosyalar baseline'dan düşer; baseline boşalınca
   kural tam sıkı olur. Meşru literaller (hedef_rol, tip-union, ekran rengi, discriminator) kalıcı
   allowlist'te — asla ihlal sayılmaz.
2. **Aşağıdaki 4 nokta implementasyon detayıdır, kararı bana bırakıldı; davranış bugünküyle aynı kalır:**
   - **PM ailesi (talep dosyaları):** yeni tek sabit — erişim bugünküyle aynı kişilere (PM ailesi + İÜ).
   - **Sipariş filtresi (T1):** küme `STORE_GENEL_GOREN_ROLLER`'dan türetilir; sonuç aynı, hayalet roller düşer.
   - **`IZLEME_ROLLERI`:** davranış-korur — bugün kim görüyorsa aynen; yalnız isimlendirip toparlanır.
     (Bu sırada gerçek bir yanlış açık/kapalı bulunursa ayrı, sade dille bildirilir.)
   - **E-Club UTT tarafı:** her süreç en özgül mevcut gruba bağlanır (liste → `ECLUB_GOREN_ROLLER`);
     bugünkü görünürlük değişmez.

---

## Ortak disiplin (her adımda)

- **Tamamen kod** — `roller.ts` + tüketici dosyalar. DB'ye yazım yok, SQL üretilmez.
- **Doğrulama üçlüsü:** `tsc` + `npm run denetim` + `lint:mimari` temizse adım kapanır.
- **Davranış-korur adımlar:** yerel kopya, hedef sabitle **değer olarak birebir aynı** olduğu teyit edilir.
- **Davranış-değiştiren tek adım T1** — önce/sonra kanıtı zorunlu.
- **Bir adım = bir commit** (aynı deseni paylaşan çok dosya tek commit'te). **Push yok.**
- Her adım öncesi ilgili madde onaya sunulur; onaysız kod yok. Adım bitince Durum → yapıldı.

---

## ADIM 0 — Bekçi (önce)

### G1 · `rol-tek-kaynak` ESLint kuralı + baseline
- **Durum:** ✅ yapıldı (30.07) — commit'te.
- **Kategori:** regresyon bekçisi · **Davranış:** runtime'da değişmez (yalnız lint)
- **Ne:** `hapbilgi-mimari` ESLint eklentisine (`tools/eslint-rules/index.mjs`, KURAL 7) yeni kural.
  İçinde **≥2 hard-code rol string'i** olan dizi literallerini (grup yeniden-tanımı) reddeder.
  Kapsam dışı (bilinçli): tekil `=== "bm"`, tip-union, spread karışımı (`[...GRUP,"iu"]` v1'de değil).
- **Baseline (ratchet):** kuralın gerçekte fire ettiği **50 dosya** `ROL_BASELINE`'da tanınır. Kompleks
  modül dosyaları (kullanicilar/profil/raporlar/oneriler/takimlar) sıraları gelene kadar burada bekler.
  Bir dosya tamamen temizlenince buradan silinir → kural o dosyada sıkılaşır.
- **Doğrulama:** tsc=0, denetim temiz, lint:mimari "ihlal yok". Red senaryosu: baseline dışı dosyaya
  `["utt","kd_utt"]` yazınca kural fire etti (TUKETICI_ROLLER öner). `eslint.config.mjs`'e "warn" olarak eklendi.
- **Bilinen sınır:** baseline dosya-düzeyi — baseline'daki bir dosyaya yeni ihlal eklenirse yakalanmaz
  (o dosyalar zaten temizlik listesinde). Yeni/temiz dosyada tam koruma.

---

## ADIM 1 — T-CLUB

### T1 · Sessiz hata — Sipariş filtresi *(canlı kusur, öncelikli)*
- **Durum:** ✅ yapıldı (30.07) — commit'te.
- **Kategori:** Sessiz Hata · **Davranış:** DEĞİŞİR (önce/sonra kanıtı aşağıda)
- **Dosya:** `app/store/siparisler/_components/SiparisFiltreleri.tsx`
- **Yapılan:** 18-rollük elle OR-zinciri (satır 147-151) `takimFiltresiGoren` türevine indirildi:
  `STORE_GENEL_GOREN_ROLLER.includes(rol) && rol !== "bm" && rol !== "tm"`. Hayalet roller kalktı.
- **Önce/sonra kanıtı:** filtreyi gören rol 14 → 21. **Yeniden kazanan (7):** egt_yrd_md, egt_yon,
  egt_uz, ik_drk, ik_yrd_md, ik_uz, ik_per. **Kaybeden: yok** (regresyon yok). Temizlenen hayalet: 4.
- **Doğrulama:** tsc=0, denetim temiz, lint:mimari ihlal yok. (Bu blok dizi değil OR-zinciriydi;
  bekçi baseline'ında değildi — baseline'dan silme gerekmedi.)
- **Not:** UI'da rol-rol fiziksel doğrulama U-serisinin işi (CLAUDE.md: rol matrisi taraması yapılmaz).

### T2 · Tüketim — izleme akışı
- **Durum:** ✅ yapıldı (30.07) — commit'te.
- **Kategori:** Gerçek Sorun · **Davranış:** değişmez (`TUKETICI_ROLLER` ≡ `["utt","kd_utt"]`, tsc teyit)
- **Yapılan (9 dosya):** `["utt","kd_utt"]` → `TUKETICI_ROLLER`; her dosyaya roller.ts import'u eklendi.
- **Baseline:** 8 tekil dosya (`baslat,bitir,cevap,begeni,favori,sorular,ileri-sarma,[yayin_id]`)
  tamamen temizlendi → baseline'dan düştü. `izle/api/route.ts` baseline'da KALIYOR — satır 33 çözüldü
  ama satır 9 `IZLEME_ROLLERI` T7'nin işi.
- **Doğrulama:** tsc=0, denetim temiz, lint:mimari ihlal yok, bekçi 0 fire.

### T3 · Üretim hattı — erişim
- **Durum:** ✅ yapıldı (30.07) — commit'te.
- **Kategori:** Karışık · **Davranış:** değişmez (`URETIM_HATTI_GORENLER` ≡ `[...URETICI_ROLLER,"iu"]`)
- **Düzeltme:** matris "4 dosya" diyordu; aynı desen **6 dosyadaymış** (matris `head` ile eksik saymış).
  Aynı emri tüm örneklerine uyguladım: `senaryolar/api/route.ts`, `videolar/api/route.ts`,
  `videolar/api/bunny-durum/route.ts`, `soru-setleri/api/route.ts`, **`teknikler/api/route.ts`**,
  **`urunler/api/route.ts`** → `[...URETICI_ROLLER,"iu"]` → `URETIM_HATTI_GORENLER`.
- **Doğrulama:** tsc=0, denetim temiz, lint:mimari ihlal yok. (Bu 6 dosya bekçi baseline'ında değildi —
  tek literal + spread, kural fire etmiyordu.)

### T3b · `takimlar/api/route.ts` (+admin varyantı)
- **Durum:** ✅ yapıldı (30.07) — commit'te.
- **Kategori:** Karışık · **Davranış:** değişmez (`[...URETIM_HATTI_GORENLER, ...ADMIN_ROLLER]` ≡ `[...URETICI_ROLLER, "iu", "admin"]`, kod ile teyit)
- **Yapılan:** `takimlar/api/route.ts:19` `TAKIM_GORUNTULEME_ROLLERI` yerel dizisi
  `[...URETICI_ROLLER, "iu", "admin"]` → `[...URETIM_HATTI_GORENLER, ...ADMIN_ROLLER]`; import
  `URETICI_ROLLER` → `URETIM_HATTI_GORENLER, ADMIN_ROLLER`. Küme birebir aynı (T3'e sessizce
  katılmadı çünkü küme +admin ile farklıydı).
- **Baseline:** dosya spread-only kaldı (0 literal) → `ROL_BASELINE`'dan düşürüldü. Bekçi 42 → 41.
- **Doğrulama:** tsc=0, denetim temiz, lint:mimari ihlal yok (baseline'sız da temiz — ratchet çalıştı).

### T4 · Üretim hattı — İÜ teslim
- **Durum:** ✅ yapıldı (30.07) — commit'te.
- **Kategori:** Sınırda · **Davranış:** değişmez (`IU_ROLU` ≡ `"iu"`, tsc teyit)
- **Yapılan (10 dosya):** teslim üçlüsünde (senaryolar/videolar/soru-setleri × api+durum+page)
  gerçek `rol === "iu"` / `!== "iu"` → `IU_ROLU`. **Toast payload'ları** (`uretimToast({ rol: "iu" })`),
  `kaynak: "iu"` ve tip-union etiketlerine dokunulmadı — rol değil, veri.
- **Kapsam kararı:** T4'ü teslim üçlüsüyle sınırladım (asimetrinin — T3'ün dokunduğu dosyalarda
  `URETIM_HATTI_GORENLER` yanında `!== "iu"` kalması — olduğu yer). Diğer gerçek `=== "iu"` siteleri
  Devam Noktası'ndaki listeyle kendi adımlarında (T5/T6) süpürülecek — düşmedi.
- **Doğrulama:** tsc=0, denetim temiz, lint:mimari ihlal yok.

### T5 · Talep dosyaları *(Karar #1 uygulandı)*
- **Durum:** ✅ yapıldı (30.07) — commit'te.
- **Kategori:** Karar/Gerçek Sorun · **Davranış:** değişmez (değer birebir, tsc teyit)
- **Karar #1:** roller.ts'e `PM_AILESI_ROLLER = ["pm","jr_pm","kd_pm"]` tabanı eklendi. Aynı 3 rolü
  taşıyan `ECZANEM_TALEP_ACAN_ROLLER` (kavram birebir "PM ailesi") bu tabana bağlandı → kaynak dosyada
  mükerrer dizi yok. (Domain ileride ayrışırsa tekrar bölünür.)
- **Yapılan:** `dosyalar/route.ts` → erişim `[...PM_AILESI_ROLLER, IU_ROLU]`, yükleme/silme `PM_AILESI_ROLLER`.
- **Doğrulama:** tsc=0, denetim temiz, lint:mimari ihlal yok, bekçi 0 fire. Dosya baseline'dan düştü.

### T6 · Ana sayfa + HB Ligi dispatch
- **Durum:** ✅ yapıldı (30.07) — commit'te.
- **Kategori:** Karışık/Sınırda · **Davranış:** değişmez
- **Yapılan:** `ana-sayfa/api/route.ts` + `hbligi/api/route.ts` `["utt","kd_utt"]` → `TUKETICI_ROLLER`;
  ayrıca ana-sayfa'daki T4 artığı `rol === "iu"` → `IU_ROLU` süpürüldü. `bm`/`tm`/`admin` tekil kaldı (sınırda).
- **Doğrulama:** tsc=0, denetim temiz, lint:mimari ihlal yok, bekçi 0 fire. İki dosya baseline'dan düştü.

### T7 · `IZLEME_ROLLERI` *(Karar #3 — davranış-korur isimlendirme)*
- **Durum:** ✅ yapıldı (30.07) — commit'te. **Bununla T-Club bitti.**
- **Kategori:** Karar · **Davranış:** değişmez (üye kümesi birebir korundu)
- **Yapılan:** `izle/api/route.ts:9` `["utt","kd_utt","bm","tm",...URETICI_ROLLER]` →
  `[...TUKETICI_ROLLER, ...YONLENDIRICI_ROLLER, ...URETICI_ROLLER]` (aynı küme, spread-only, bekçi-temiz).
- **Not:** kümenin üyeliği (yönetici/İÜ hariç) bilinçli olarak korundu; "bu küme doğru mu" ayrı bir
  soru — B-09 kapsamı değil, davranış değiştirilmedi.
- **Doğrulama:** tsc=0, denetim temiz, lint:mimari ihlal yok, bekçi 0 fire. Dosya baseline'dan düştü.

---

## ADIM 2 — E-CLUB

### E1 · Kişi rolleri (panel + store + liste)
- **Durum:** ✅ yapıldı (30.07) — commit `c72ebdd`.
- **Kategori:** Gerçek Sorun · **Davranış:** değişmez (`ECLUB_TUKETICI_ROLLERI` ≡ eski yerel değer `["eczaci","eczane_teknisyeni"]`, tsc teyit)
- **Yapılan (9 dosya):** yerel `ECLUB_KISI_ROLLERI = ["eczaci","eczane_teknisyeni"]` kaldırıldı, roller.ts'teki mevcut `ECLUB_TUKETICI_ROLLERI` import edildi. Dosyalar: `panel/api/{baslat,bitir,route,sorular,cevapla}`, `listem/api/kisiler`, `store/api/{route,siparis,adres}`.
- **Baseline:** 8 dosya tamamen temizlenip düştü (37→29). `listem/api/kisiler` baseline'da **KALDI** — içindeki `ECLUB_UTT_ROLLERI` (E2'nin işi) hâlâ literal olduğundan düşürülemezdi.
- **Doğrulama:** tsc=0, denetim temiz, lint:mimari ihlal yok, bekçi 0 fire.

### E2 · UTT tarafı (liste + öneri) *(Karar #4 — en özgül gruba)*
- **Durum:** ✅ yapıldı (30.07) — commit `b5004ca`.
- **Kategori:** Gerçek Sorun · **Davranış:** değişmez (her iki hedef bugün `["utt","kd_utt"]` ≡ eski yerel değer, tsc teyit)
- **Yapılan (7 dosya):** yerel `ECLUB_UTT_ROLLERI`/`UTT_ROLLER` kaldırıldı, en özgül gruba bağlandı:
  öneri (`oneriler/api/{route,yayinlar}`, `oneriler/page`) + `ligi/takim-adi` → `TUKETICI_ROLLER`;
  liste yönetimi (`listem/api/{eczaneler,kisiler}`, `listem/page`) → `ECLUB_GOREN_ROLLER`.
- **Karar notu:** `takim-adi` `ECLUB_LIGI_GOREN_ROLLER`'a DEĞİL `TUKETICI_ROLLER`'a bağlandı — takım adını yalnız UTT belirler (bm/tm hariç); ligi görüntüleme kümesi (bm/tm dahil) buraya uymaz.
- **Baseline:** 7 dosya tamamen temizlenip düştü (29→22). `kisiler` E1+E2 ile iki literalini de kaybedip baseline'dan düştü.
- **Doğrulama:** tsc=0, denetim temiz, lint:mimari ihlal yok, bekçi 0 fire.

### E3 · E-Club Ligi + Store rapor
- **Durum:** ✅ yapıldı (30.07) — commit `0df2732`.
- **Kategori:** Gerçek Sorun · **Davranış:** değişmez (yerel `["utt","kd_utt","bm","tm"]` ≡ hedefler, tsc teyit)
- **Yapılan (3 dosya):** `ligi/api/{route,export}` yerel `LIG_GOREN_ROLLER` → `ECLUB_LIGI_GOREN_ROLLER`; `store/rapor/api/route` yerel `FIRMA_YETKILI_ROLLER` → `ECLUB_STORE_RAPOR_GOREN_ROLLER`. `store/rapor`'daki `adminMi` (`=== "admin"`) tekil kontrol korundu.
- **Baseline:** 3 dosya tamamen temizlenip düştü (22→19).
- **Doğrulama:** tsc=0, denetim temiz, lint:mimari ihlal yok, bekçi 0 fire.

### E4 · E-Club Ligi sayfa içi dağıtım *(opsiyonel)*
- **Durum:** bekliyor · **Kategori:** Sınırda · **Davranış:** değişmez
- **Dosyalar:** `eclub/ligi/page.tsx:37,71,181,191,243`, `useEclubLigi.ts:131`

---

## ADIM 3 — C-CLUB

### C1 · Challenge tekil "bm" *(dokunma önerisi)*
- **Durum:** bekliyor · **Kategori:** Sınırda
- **Not:** Modül tek-rollü; tekil `=== "bm"` meşru. Öneri: bekçi baseline'ından düşür, koda dokunma.

---

## ADIM 4 — ECZANEM

### Ez1 · İsim gölgesi
- **Durum:** bekliyor · **Kategori:** Gerçek Sorun · **Davranış:** değişmez
- **Dosya:** `app/eczanem/utt/page.tsx:32`
- **Hedef:** yerel `const TUKETICI_ROLLER = [...]` kaldırılır, roller.ts'ten import edilir (gölge biter)

### Ez2 · Müşteri kimlik kontrolü *(opsiyonel)*
- **Durum:** bekliyor · **Kategori:** Sınırda · **Davranış:** değişmez
- **Dosya:** `app/eczanem/page.tsx:31` `"musteri"` → `MUSTERI_ROLU`

---

## Kompleks modüller (sonraya)
admin / analiz / raporlar / kullanicilar / profil / login — çekirdek bittikten sonra tek tek ele alınacak;
o modüllerin dosyaları bekçi baseline'ında bekler.
