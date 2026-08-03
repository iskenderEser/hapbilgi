# Ana Sayfa Kabuk Dönüşümü — İş Planı

*Oluşturma: 02.08.2026. Bu belge **yaşayan** iş planıdır: her aşama tamamlandıkça
durum ✅ **yapıldı** olarak işaretlenir ve belge güncel tutulur. Karar değişiklikleri
en alttaki Değişiklik Günlüğü'ne yazılır.*

**Durum efsanesi:** ⬜ beklemede · 🟨 yapılıyor · ✅ yapıldı

---

## 0. Amaç

Login sonrası açılan uygulama kabuğunun sekme yapısını değiştirmek. Her rol için ana
ve alt görevler çoğaldığından mevcut navbar pill sistemi yetmiyor, yük sayfanın içine
biniyor. Yeni yapı:

- **Navbar (tüm roller aynı, sabit):** 5 bilgi amaçlı (fonksiyonel olmayan) pill —
  **Ana Sayfa · HapBilgi Nedir · Nasıl Çalışır · Sözleşmeler · İletişim** — mevcut
  sıra ve sağ blok (Ad-Soyad + avatar + Çıkış) korunur.
- **Sol liste:** Bugün navbardaki rol-bazlı **fonksiyonel** piller, sayfanın soluna,
  navbarın hemen altına **ana görev → alt görev** dikey listesi olarak iner.

Böylece role göre navbar yükü kalkar; aktif pillerin alt fonksiyonlarına ulaşmak
kolaylaşır.

---

## 1. Aşama Takibi (özet)

| # | Aşama | Durum |
|---|---|---|
| 0 | Kararların sabitlenmesi (KARAR-1…6) | ✅ |
| 1 | Faz 1 — Kabuk + pilot (yalnız `/ana-sayfa`) | ✅ |
| 2 | Faz 2 — Yayım (kalan 40 sayfa, batch) | ✅ |
| 3 | Faz 3 — Temizlik (eski Navbar sil + REDBOOK) | ✅ |

Bağımlılık: 0 → 1 (görsel onay) → 2 → 3.

---

## 2. Teşhis (mevcut durum)

- **Navbar tek bileşen (`components/Navbar.tsx`) ama 41 sayfa onu ayrı ayrı render
  ediyor** — ortak layout yok. Fonksiyonel piller her sayfada bu yüzden çıkıyor. Kök
  sorun budur: **tekrar (duplication)**.
- Navbar içi: solda logo + rol-bazlı fonksiyonel piller; sağda ad-soyad + avatar +
  Çıkış. Ayrıca mobilde hamburger menü + tüketici için alt tab bar.
- Kimlik/çıkış zaten context'te: `useAuth()` (`app/providers/AuthProvider.tsx`) →
  `{ kullanici, yukleniyor, cikisYap }`. AuthProvider kök layout'u sarıyor.
- Guard deseni tek-tip: `useAuth` + `yukleniyor→spinner` + `!kullanici→/login`;
  `/ana-sayfa`'da ek `admin→/admin` ve `ROLE_MAP` kontrolü.
- **eclub_kisi** kimliği yalnız 3 sayfada: `/eclub/store`, `.../adreslerim`,
  `.../siparislerim` (dış müşteri; saha sol listesi ona uymaz).
- `proxy.ts` **path-bazlı**; route group URL'i değiştirmediği için etkilenmez.
- Bilgi rotaları (`hapbilgi-nedir`, `nasil-calisir`, `sozlesmeler`, `iletisim`) **yok**.

**Neden ortak layout (route group):** Kök neden tekrar olduğundan, çözüm kabuğu her
sayfaya yeniden sardırmak değil (bu tekrarı korur), **tek bir ortak layout'ta**
render etmektir. Next.js App Router'ın native yapısıdır; 4 değere (ideal /
sürdürülebilir / kaliteli / verimli) uyan tek yol budur.

---

## 3. Kararlar (Aşama 0 — ✅ 02.08.2026)

- **KARAR-1 — Route group:** `app/(panel)/`. URL'leri değiştirmez, ortak layout kazandırır.
- **KARAR-2 — Gezinme tek kaynak:** Sol liste ve mobil drawer, imperatif JSX yerine
  bildirimsel bir config'ten (`panelNav.config.ts`) beslenir. Bugünkü masaüstü/mobil
  pill tekrarı biter.
- **KARAR-3 — Gating birebir korunur:** Kim neyi görüyorsa aynı (`roller.ts` setleri,
  `profil/api`, `bildirimler/api`, `yayin-yonetimi/api/bekleyenler`). Davranış-korur iş.
- **KARAR-4 — eclub_kisi:** Layout `kimlikTuru`'na göre dallanır — eclub_kisi'de sol
  liste yerine yalnız "E-Club Store" gezinmesi (bugünkü Navbar dallanmasının taşınmışı).
- **KARAR-5 — Bilgi pilleri = 4 gerçek rota:** `/hapbilgi-nedir`, `/nasil-calisir`,
  `/sozlesmeler`, `/iletisim` — ortak `BilgiSayfa` kabuğunu kullanan iskelet sayfalar
  (başlık + placeholder). "Ana Sayfa" pill'i mevcut `/ana-sayfa`.
- **KARAR-6 — Sol listenin ana→alt ağacı:** aşağıdaki tablo.

### Sol liste — ana → alt görev ağacı

| Ana görev | Alt görevler | Kimde (mevcut Navbar koşulu) |
|---|---|---|
| **Üretim** | Talepler · Senaryolar · Videolar · Soru Setleri | üretim hattı rolleri |
| **Yayın** | Yayın Yönetimi · Yayındaki Videolar · Onaylanan Talepler | üretici / İÜ |
| **Öneriler** | Öneriler | BM · UTT |
| **Raporlama** | Raporlar · Analiz | İÜ hariç / analiz rolleri |
| **Ligler** | HBLigi · CC Ligi · E-Club Ligi | ilgili roller |
| **HBStore** | Mağaza · Siparişler | store rolleri |
| **E-Club** | E-Club · E-Club Store | e-club rolleri |
| **Eczanem** | Eczanem | UTT |
| **Challenge Club** | — | BM |

Rozetler (Talepler/Senaryolar/Video/Soru/Yayın/Öneri) aynı kaynaklardan korunur.
Tek öğeli grup tek satır olur.

---

## 4. Faz 1 — Kabuk + pilot (yalnız `/ana-sayfa`)

**Amaç:** Yeni yapının tamamını tek sayfada canlı görüp görsel onay almak. Kalan 40
sayfa bu fazda taşınmaz; eski Navbar'larıyla çalışır (iki nav geçici bir arada, kırılma yok).

| Adım | İş | Dosya |
|---|---|---|
| 1.1 ✅ | Gezinme config'i (ana→alt ağaç + rol/aktiflik koşulları + badge anahtarları) | `components/panel/panelNav.config.ts` (yeni) |
| 1.2 ✅ | Yeni üst bar — 5 bilgi pill'i + sağ blok (ad-soyad, avatar→`/profil`, Çıkış) | `components/panel/PanelNavbar.tsx` (yeni) |
| 1.3 ✅ | Sol liste — config'i okur, grup + alt öğe, aktif vurgu; rozeti **prop'tan** alır (tek kaynak, B kararı) | `components/panel/SolListe.tsx` (yeni) |
| 1.4 ✅ | Mobil drawer — aynı config; rozeti prop'tan alır; eski bottom-tab yeniden kurgulanır | `components/panel/MobilDrawer.tsx` (yeni) |
| 1.5 ✅ | Ortak layout — `useAuth` guard + profil bayrakları + **rozet çekimi tek sefer** (B) → SolListe/MobilDrawer'a dağıtır; eclub_kisi'de ECLUB_KISI_NAV (b) | `app/(panel)/layout.tsx` (yeni, "use client") |
| 1.6 ✅ | Bilgi sayfaları (iskelet) — ortak kabuk + 4 rota | `components/panel/BilgiSayfa.tsx` + `app/(panel)/{hapbilgi-nedir,nasil-calisir,sozlesmeler,iletisim}/page.tsx` |
| 1.7 ✅ | Pilot taşıma: `app/ana-sayfa/` → `app/(panel)/ana-sayfa/`; Navbar+guard sil, yalnız içerik dön | `app/(panel)/ana-sayfa/page.tsx` |
| 1.8 ✅ | Doğrulama: tsc+denetim+lint temiz; preview; **görsel onay alındı** (İskender: sekmeler gezildi, hata yok). Commit standing kural gereği YOK | — |

- **layout.tsx guard:** `yukleniyor→spinner`, `!kullanici→/login`, `admin→/admin`;
  `profil/api` bayraklarını bir kez çekip context'le alt bileşenlere verir.
- eclub_kisi bu fazda kapsam dışı (batch-6'da).

---

## 5. Faz 2 — Yayım (kalan 40 sayfa)

Sayfalar gruplar hâlinde `app/(panel)/` altına taşınır; her sayfadan `<Navbar>` + guard
çıkarılır. Taşınmayanlar eski Navbar'la çalışır. Her batch: taşı → Navbar+guard sil →
`tsc`+denetim+`lint:mimari` → 1 smoke → commit.

1. ✅ **Üretim hattı:** talepler(+[id]), senaryolar(+[id]), videolar(+[id]), soru-setleri(+[id]), yayin-yonetimi, onaylanan-talepler (10 sayfa taşındı+sadeleşti; tsc+denetim+lint temiz)
2. ✅ **Raporlar + Analiz:** raporlar/{utt,bm,tm,uretici,yonetici}, analiz/{bm,tm,uretici,yonetici} (9 sayfa taşındı+sadeleşti; tsc+denetim+lint temiz)
3. ✅ **Ligler + Öneriler:** hbligi, cc-ligi, oneriler, challenge-club (+ challenge-club/izle) taşındı+sadeleşti; tsc+denetim+lint temiz
4. ✅ **HBStore:** store(+[urun_id]), store/siparisler, store/adreslerim, store/siparislerim (5 sayfa taşındı+sadeleşti; tsc+denetim+lint temiz)
5. ✅ **E-Club (saha):** eclub/listem, oneriler, panel, ligi + store/rapor (28 dosya taşındı+sadeleşti; tsc+denetim+lint temiz)
6. ✅ **E-Club Store (eclub_kisi):** eclub/store(+adreslerim, siparislerim) taşındı+sadeleşti; tsc+denetim+lint temiz
7. ✅ **Kalan:** profil, kullanicilar, talepler-v2, yayindaki-videolar (4 sayfa taşındı+sadeleşti; tsc+denetim+lint temiz). Artık hiçbir sayfa eski Navbar kullanmıyor.

En büyük risk: taşımada `../` relative import kırılması (çoğu `@/` alias). Pilot ve
her batch tsc'si erken yakalar.

---

## 6. Faz 3 — Temizlik

- Tüm sayfalar taşındıktan sonra `components/Navbar.tsx` **silinir**; eski
  bottom-tab/hamburger artıkları temizlenir.
- REDBOOK §7'ye "Ana sayfa kabuk dönüşümü" adımı; ilgili açık iş kapanır.
- Son üçlü doğrulama + commit.

---

## 6.5 Ek İşler (tüm fazlardan SONRA — İskender'in Faz 1 görsel geri bildirimi)

| # | İş | Durum |
|---|---|---|
| E1 | **Logo hizası + piller:** navbar tam-genişlik; logo solda, 5 pil tek blok navbarın **ortasına** sabitlendi (mutlak ortalama — pencere genişliğinden bağımsız), sağ blok sağda. | ✅ |
| E2 | **Sol liste her sayfada görünür.** Faz 2 taşımalarıyla çözüldü; İskender gezinerek doğruladı. | ✅ |
| E3 | **Açılır/kapanır gruplar:** çok öğeli gruplar akordiyon (chevron döner); başlıklar **siyah bold**, alt öğeler koyu gri. Sol liste font +2px. | ✅ |
| E4 | **IU'da HBLigi TAMAMEN kaldırıldı:** nav gate (IU hariç) + sayfa (IU→/ana-sayfa) + API (IU→403). | ✅ |

---

## 7. Doğrulama ve sınırlar

- **Smoke (her faz/batch):** 1 mutlu yol (bir rolle gezinme + aktif vurgu + badge) +
  gerekli yerde 1 red (yetkisiz/kimlik varyantı).
- **Teknik üçlü:** `tsc` + denetim + `lint:mimari`.
- **DB yazımı yok**; tümü lokal; commit'ler İskender onayıyla; **push yok** (Kural 4c).
- Oluşturulan geçici test verisi/dosya iş sonunda temizlenir (Kural 6d).

---

## 8. Değişiklik Günlüğü

- **02.08.2026** — Faz 2 Batch 7 (kalan sayfalar) tamamlandı → **Faz 2 bitti.** profil, kullanicilar,
  talepler-v2, yayindaki-videolar (4 sayfa) `(panel)`'e taşındı; `app/` kökünde artık `@/components/Navbar`
  kullanan sayfa YOK. 4 sayfadan Navbar + handleCikis + kullanılmayan `cikisYap` çıkarıldı. **profil**: genel
  guard useEffect tek başınaydı ve `router` yalnız onda + handleCikis'te kullanılıyordu → guard useEffect +
  `useRouter` + `router` de çıkarıldı (ligi deseni). **kullanicilar/talepler-v2/yayindaki-videolar**: sayfaya
  özel rol guard'ı + `router` korundu. Mutlak import yoktu; talepler-v2 içi `../` göreli importlar dizinle
  birlikte taşındı. tsc + denetim + lint:mimari temiz (kalan eslint react-hooks/img uyarıları önceden vardı —
  HEAD'de doğrulandı, kapsam dışı). Sırada **Faz 3** (Navbar.tsx sil + REDBOOK).
- **02.08.2026** — Faz 2 Batch 6 (E-Club Store / eclub_kisi) tamamlandı: store kök + adreslerim +
  siparislerim (7 dosya) `(panel)`'e taşındı (Batch 5'te bölünen store'un kalanı; `rapor`'a dokunulmadı,
  `app/eclub` tamamen boşaldı). 3 sayfadan Navbar + handleCikis + kullanılmayan `cikisYap` çıkarıldı;
  `router` (guard + modal/buton yönlendirmeleri) ve sayfaya özel guard (kimlik `eclub_kisi` + veri çekme)
  korundu. Import güncellemesi gerekmedi (store-içi `./`/`../` + `@/` alias). tsc + denetim + lint:mimari temiz.
- **02.08.2026** — Faz 2 Batch 5 (E-Club saha) tamamlandı: eclub/{listem, oneriler, panel, ligi} +
  store/rapor (28 dosya) `(panel)`'e taşındı. 5 sayfadan Navbar + handleCikis + kullanılmayan `cikisYap`
  çıkarıldı; **ligi**'de ayrıca genel guard useEffect + `useRouter` + `router` (başka kullanımı yoktu).
  **listem/oneriler/panel/rapor**'da sayfaya özel guard (rol/kimlik/veri çekme) + `router` korundu.
  **store bölündü:** rapor Batch 5'te taşındı, kök/adreslerim/siparislerim Batch 6'ya (eclub_kisi) bırakıldı.
  Import güncellemesi gerekmedi (tümü `@/` alias veya `./` göreli). tsc + denetim + lint:mimari temiz.
- **02.08.2026** — Faz 3 (temizlik) tamamlandı: eski `components/Navbar.tsx` silindi (sıfır importer
  doğrulandı; kalan iki referans yalnız yorumdu, "eski/silindi" olarak güncellendi). Bottom-tab/hamburger
  artığı yok (hepsi eski Navbar'ın içindeydi). REDBOOK §7'ye "Ana sayfa kabuk dönüşümü (02.08.2026)"
  adımı eklendi. tsc + lint:mimari temiz. **Faz 1–3 tamam; kalan yalnız Ek İşler (§6.5: E1–E4).**
- **02.08.2026** — Faz 2 Batch 4 (HBStore) tamamlandı: `store` dizini (5 sayfa) `(panel)`'e taşındı.
  Hepsi modern desen ve uniform; `router` her sayfada render'da kullanıldığı için korundu. Guard
  useEffect sayfaya özel (STORE_ALABILEN rol kontrolü + `setYetkiKontrolEdildi`) → korundu; yalnız
  Navbar + cikisYap + handleCikis çıkarıldı. Pre-existing 3 ölü kalem temizlendi (İskender onayı):
  store/page + store/[urun_id] `MAVI`, store/siparisler `basari`. tsc + no-unused-vars + denetim +
  lint:mimari temiz.
- **02.08.2026** — Faz 2 Batch 3 (ligler + öneriler + challenge) tamamlandı: 4 dizin `(panel)`'e
  taşındı. Sayfalar çok heterojendi (hepsi tam okundu): **hbligi** 4 Navbar (3×8-girinti replace_all
  + 1×6-girinti); **oneriler** modern (router back-nav'da kaldı); **cc-ligi + challenge-club** eski
  desen (user/rol/adSoyad state, eski `supabase.auth.signOut` handleCikis) — Navbar + createClient +
  boşta kalan rol/adSoyad state + guard'daki setRol/setAdSoyad temizlendi; router/rol/user (sayfaya
  özel) korundu. **challenge-club/izle** immersive değil, Navbar'sız → trim yok, sadece taşındı.
  Ayrıca taşımadan önce **4 ölü kalem** silindi (İskender onayı): oneriler `createClient`+`formatTarih`,
  cc-ligi `BORDO`+`basari`. tsc + no-unused-vars + denetim + lint:mimari temiz.
- **02.08.2026** — Faz 2 Batch 2 (raporlar + analiz) tamamlandı: 2 dizin / 9 sayfa `(panel)`'e
  taşındı. Bu batch deseni Batch 1'den farklıydı (tam okundu): Navbar `handleCikis` yerine doğrudan
  `cikisYap`, guard ayrı bir useEffect (`if (!yukleniyor && kullanici === null) router.replace('/login')`),
  analiz sayfalarında **2 Navbar** (hata-render + ana-render), zaten `if (!kullanici …) return null`
  daraltması var. Çıkarılanlar: Navbar + useRouter + router + cikisYap + genel guard useEffect.
  Sayfaya özel korunanlar: veri useEffect'leri, `if (!kullanici) return` veri guard'ları, spinner,
  hata-render, index dispatcher'lar (analiz/page, raporlar/page — Navbar'sız redirect). Wrapper'lar
  korundu (çok-return'lü analiz'de fragment riski). tsc + denetim + lint:mimari temiz.
- **02.08.2026** — Faz 2 Batch 1 (üretim hattı) tamamlandı: 6 dizin (10 sayfa) `(panel)`'e
  taşındı, her sayfadan Navbar+genel guard çıkarıldı (sayfaya özel yönlendirme/erişim korundu),
  `kullanici` null daralması için spinner guard'ına `!kullanici` eklendi. Taşınan `@/app/talepler/*`
  mutlak importları `@/app/(panel)/talepler/*`'e güncellendi (10 dosya). **Mimari bekçi düzeltmesi:**
  `toast-tek-kaynak` yol kontrolü `/app/talepler/` → `/talepler/` (klasör adı) olarak genişletildi;
  route group taşımalarında bekçi kapsamı korunur (İskender kararı: "yok say" değil "kapsamı genişlet").
  **Önceden var olan bug — DÜZELTİLDİ (İskender onayıyla):** `onaylanan-talepler/page.tsx`'te HEAD'de
  guard `useEffect`'inin içine kopyalanmış `const liste = useListe(...)` vardı (React hook kuralı
  ihlali). Kopya blok çıkarıldı; useEffect yalnız guard'ı içeriyor (üstteki `const liste` korundu).
  `rules-of-hooks` 0'a indi; tsc + lint:mimari temiz. Kalan eslint uyarıları (any/set-state-in-effect,
  veriCek) önceden vardı, kapsam dışı.
- **02.08.2026** — Faz 1 tamamlandı, görsel onay alındı (İskender sekmeleri gezdi, hata yok).
  Geri bildirimden 3 madde **Ek İşler (§6.5)** olarak eklendi (E1 logo hizası, E2 sol liste
  her sayfada — Faz 2 ile kendiliğinden, E3 accordion gruplar). Ek işler tüm fazlardan sonra.
- **02.08.2026** — Karar B (rozet tek kaynak): Rozet çekimi SolListe içinden alınıp
  layout'a (Adım 1.5) tek sefere taşınacak; SolListe ve MobilDrawer rozeti **prop**
  olarak alacak. Gerekçe: tek kaynak + verimli (mükerrer istek yok). Fonksiyonel
  testlerde gerekirse düzenlenecek. Adım 1.3 (SolListe) buna göre revize edildi.
- **02.08.2026** — Belge oluşturuldu. Aşama 0 kapandı: ortak layout (route group)
  yaklaşımı benimsendi (önceki "AppShell'i her sayfaya sardır" fikri, tekrarı koruduğu
  için elendi). KARAR-1…6 sabitlendi; teşhis (41 sayfa ayrı Navbar, useAuth context,
  eclub_kisi 3 sayfa, path-bazlı proxy) doğrulandı.
