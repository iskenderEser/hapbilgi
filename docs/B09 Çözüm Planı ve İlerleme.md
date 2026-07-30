# B09 Çözüm Planı ve İlerleme

*Kaynak: `B09 — Modül × İş Süreci × Rol × Kod Matrisi (Çekirdek Modüller).md` + 30.07 kararları.
Bu belge canlı ilerleme takibidir: her adımın **Durum** alanı vardır (bekliyor / yapıldı),
adım bitince "yapıldı" işaretlenip kod ile birlikte commit edilir. Kesinti olursa bu belge
tek başına devam için yeterlidir (hedef sabitler + dosya listeleri burada).*

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

### T3b · KEŞİF — `takimlar/api/route.ts` (+admin varyantı)
- **Durum:** ⏳ karar bekliyor (İskender'e sunuldu)
- **Bulgu:** `takimlar/api/route.ts:19` `TAKIM_GORUNTULEME_ROLLERI = [...URETICI_ROLLER, "iu", "admin"]`
  — T3 ailesinin kardeşi ama küme farklı (+admin). Bekçi **baseline'ında** (2 literal: "iu","admin").
- **Öneri (yapılınca):** `[...URETIM_HATTI_GORENLER, ...ADMIN_ROLLER]` — birebir aynı küme, spread-only,
  bekçi-temiz → baseline'dan düşer. Küme farklı olduğu için T3'e sessizce katılmadı.

### T4 · Üretim hattı — İÜ teslim *(opsiyonel, düşük kazanç)*
- **Durum:** bekliyor · **Kategori:** Sınırda · **Davranış:** değişmez
- **Hedef:** İÜ-özel yazma kontrollerinde `=== "iu"` (~10 yer) → `IU_ROLU`

### T5 · Talep dosyaları *(Karar #1 uygulanır)*
- **Durum:** bekliyor · **Kategori:** Karar/Gerçek Sorun · **Davranış:** değişmez
- **Dosya:** `app/talepler/api/dosyalar/route.ts:16,44,87`
- **Hedef:** yeni "PM ailesi" sabiti (erişim = PM ailesi + İÜ; yükleme/silme = PM ailesi)

### T6 · Ana sayfa + HB Ligi dispatch
- **Durum:** bekliyor · **Kategori:** Karışık/Sınırda · **Davranış:** değişmez
- **Dosyalar:** `ana-sayfa/api/route.ts:31,46`, `hbligi/api/route.ts:70`
- **Hedef:** `["utt","kd_utt"]` → `TUKETICI_ROLLER` (bm/tm/iu tekil kalır)

### T7 · `IZLEME_ROLLERI` *(Karar #2 — davranış-korur isimlendirme)*
- **Durum:** bekliyor · **Kategori:** Karar · **Davranış:** değişmez (niyet doğrulanır)
- **Dosya:** `app/izle/api/route.ts:9`

---

## ADIM 2 — E-CLUB

### E1 · Kişi rolleri (panel + store + liste)
- **Durum:** bekliyor · **Kategori:** Gerçek Sorun · **Davranış:** değişmez
- **Dosyalar (9):** `eclub/panel/api/{baslat,bitir,route,sorular,cevapla}`, `eclub/listem/api/kisiler`, `eclub/store/api/{route,siparis,adres}`
- **Hedef:** yerel `ECLUB_KISI_ROLLERI = ["eczaci","eczane_teknisyeni"]` → `ECLUB_TUKETICI_ROLLERI`

### E2 · UTT tarafı (liste + öneri) *(Karar #4 — en özgül gruba)*
- **Durum:** bekliyor · **Kategori:** Gerçek Sorun · **Davranış:** değişmez
- **Dosyalar (7):** `eclub/oneriler/api/{route,yayinlar}`, `eclub/oneriler/page`, `eclub/listem/api/{eczaneler,kisiler}`, `eclub/listem/page`, `eclub/ligi/api/takim-adi`
- **Hedef:** yerel `ECLUB_UTT_ROLLERI`/`UTT_ROLLER` → liste yönetimi `ECLUB_GOREN_ROLLER`, öneri `TUKETICI_ROLLER`

### E3 · E-Club Ligi + Store rapor
- **Durum:** bekliyor · **Kategori:** Gerçek Sorun · **Davranış:** değişmez
- **Dosyalar:** `eclub/ligi/api/{route,export}` → `ECLUB_LIGI_GOREN_ROLLER`; `eclub/store/rapor/api/route` → `ECLUB_STORE_RAPOR_GOREN_ROLLER`

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
