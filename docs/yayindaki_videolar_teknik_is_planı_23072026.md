# Yayındaki Videolar — Teknik İş Planı (23.07.2026)

**Karar sahibi:** İskender.
**Amaç:** Navbar'da **"Yayındaki Videolar"** pill'i; tıklayınca ayrı bir sayfa açılır. Sayfa, yayındaki videoları **üreten üretici rolüne göre klasörler**; klasöre tıklayınca o rolün videoları kart olarak listelenir; karta tıklayınca video **tam sayfa oynatıcıda** açılır. **İzleme modu:** puan/soru yok (yalnız-izleme).
**Onaylı mockup:** `yayindaki_videolar_pill_mockup` (bu oturum).

---

## 1. Kapsam

**Görecek roller** (hedef set):
- Tüm üretici roller: `pm, jr_pm, kd_pm, med_md, egt_md, egt_yrd_md, egt_yon, egt_uz, ik_drk, ik_md, ik_yrd_md, ik_uz, ik_per`
- Tüm yönetici roller: `gm, gm_yrd, drk, paz_md, blm_md, grp_pm, sm`
- Yönlendirici: `tm, bm`

**Hariç:** `utt, kd_utt, eczaci, eczane_teknisyeni, musteri (danışan)` ve şimdilik `iu`.

**Kapsam dışı (bu turda):**
- Atama/sahiplik, tüketim tarafı (izleme/puanlama/soru akışı — bu sayfada zaten tetiklenmez), Bunny.
- "Tüm firma" (`takim_id IS NULL`) içeriği — üretim henüz üretmiyor (mevcut `anaSayfaVideolari` notuyla aynı sınır).

---

## 2. Mevcut yapı — yeniden kullanılacaklar (yeni tasarım YOK)

| Parça | Dosya | Rol |
|---|---|---|
| Video kart listesi | [`components/ana-sayfa/VideoBolumu.tsx`](../components/ana-sayfa/VideoBolumu.tsx) | "kutu kutu" kartlar; `onVideoSec` ile seçim |
| Tam sayfa oynatıcı | [`components/izle/VideoOynatici.tsx`](../components/izle/VideoOynatici.tsx) | yalnız-izleme; puan/soru yok |
| Yayındaki video verisi | [`lib/video/anaSayfaVideolari.ts`](../lib/video/anaSayfaVideolari.ts) → `getAnaSayfaVideolari` | `v_yayin_detay`'dan tür+konum süzgeciyle çeker |
| Görünürlük kuralı | `lib/video/gorunurluk.ts` → `gorunenTurler(rol)`, `kapsamGenisMi(rol)` | rol hangi türleri/konumu görür |
| Navbar pill'ler | [`components/Navbar.tsx`](../components/Navbar.tsx) | pill + rol grubu deseni |
| Rol grupları | [`lib/utils/roller.ts`](../lib/utils/roller.ts) | `URETICI_ROLLER`, `YONETICI_ROLLER`, `URETIM_HATTI_GORENLER`… |
| Rol adları | `lib/utils/roller.ts` → `ROL_ADLARI` | klasör başlığı = insan-okur rol adı |
| Sayfa erişim bekçisi | `proxy.ts` | rota bazlı rol kapısı (HBStore deseni) |
| Favori / beğeni | `video_favoriler`, `video_begeniler` tabloları | sayaç kaynağı (izle akışından) |
| Merkezî yayın görünümü | `v_yayin_detay` | `talep_id` taşır (üretim refactoring sonrası) → üreten kişi/rol buradan türetilir |

**Tek yeni parça:** klasör (role göre gruplama) katmanı + yeni sayfa/rota/pill + karta favori/beğeni/üreten alanları.

---

## 3. Geliştirme sırası (onaylı)

Her adım: 1 commit; üçlü doğrulama (tsc + `npm run denetim` + `npm run lint:mimari`) temiz; ≤1 duman testi (1 mutlu + 1 red); DB yazımı (şema/view/politika) **SQL → İskender**, Claude canlıya yazmaz; push emirle.

### Adım 1 — Kapsam & rol seti (tek yerde)
**Amaç:** Pill, sayfa bekçisi ve veri ucu aynı rol listesinden okusun; kopya liste olmasın.
**Yapılacaklar:**
- `lib/utils/roller.ts`'e yeni sabit:
  `export const YAYINDAKI_VIDEO_GORENLER = [...URETICI_ROLLER, ...YONETICI_ROLLER, "tm", "bm"];`
  (`iu, utt, kd_utt, eczaci, eczane_teknisyeni, musteri` zaten hiçbir alt listede değil → otomatik hariç.)
- Yorum: İK roller `URETICI_ROLLER` içinde olduğundan sette görünür — **ama** `gorunenTurler` bugün İK'ya boş döndürüyor (§5 açık karar).
**Doğrulama:** tsc; sabitten türeyen liste beklenen rolleri içerir (unit-ölçekli kontrol), tüketici/iu içermez.
**Çıktı:** Tek kaynak rol seti.

### Adım 2 — Sayfa iskeleti + rota + navbar pill + rol bekçisi
**Amaç:** Gezilebilir kabuk erken görünür; akış (kart→oynatıcı) baştan test edilir. (Henüz düz liste, klasörsüz.)
**Yapılacaklar:**
- **Sayfa:** `app/yayindaki-videolar/page.tsx` — `Navbar` + başlık "Yayındaki videolar" + "izleme modu" rozeti + `aktifVideo` state deseni (`UreticiAnaSayfa`'daki desenin aynısı): `aktifVideo` yoksa `VideoBolumu`, varsa `VideoOynatici` (yalnız-izleme). İlk aşamada mevcut `getAnaSayfaVideolari` verisi düz gösterilir.
- **API:** `app/yayindaki-videolar/api/route.ts` — `auth.getUser` → `rolCozucu` → `YAYINDAKI_VIDEO_GORENLER.includes(rol)` değilse `rolHatasi`; sonra `getAnaSayfaVideolari(user.id, rol, adminSupabase)`.
- **Navbar:** `components/Navbar.tsx` — `YAYINDAKI_VIDEO_GORENLER.includes(rolKucu)` ise pill (play ikonu YOK), `router.push("/yayindaki-videolar")`. Pill'in konumu üretim pill'lerinin yanına.
- **Bekçi:** `proxy.ts` — `/yayindaki-videolar` rotası yalnız hedef rollere; URL'den giren tüketici/iu reddedilir (pill gizli olsa da URL kapalı).
**Doğrulama:** pill görünür → sayfa açılır → kartlar listelenir → karta tıkla → oynatıcı; bir tüketici (utt) pill'i görmez ve URL'den giremez (1 mutlu + 1 red).
**Çıktı:** Çalışan, korunan sayfa kabuğu.

### Adım 3 — Veri katmanı (üreten rol + ad soyad + favori/beğeni)
**Amaç:** Gruplama anahtarı ve kart alanları için veriyi zenginleştir.
**Yapılacaklar:**
- `AnaSayfaVideo`'ya (ya da bu sayfaya özel `YayindakiVideo` tipine) alanlar: `ureten_ad_soyad: string`, `ureten_rol: string`, `favori_sayisi: number`, `begeni_sayisi: number`.
- **Üreten kişi/rol:** `v_yayin_detay` `talep_id` taşıyor → `talepler.uretici_id` → `kullanicilar(ad, soyad, rol)`. İki yol:
  - (a) `v_yayin_detay`'a `uretici_id / ureten_ad_soyad / ureten_rol` kolonları eklenir (SQL → İskender), ya da
  - (b) kod tarafında yayınların `uretici_id` seti tek sorguda çekilip `kullanicilar`'dan toplu çözülür (N+1 yok). — **Adım 5'in açık kararı.**
- **Favori/beğeni sayısı:** `video_favoriler` / `video_begeniler` tablolarından, ilgili `yayin_id` (ya da `video_id`) listesi için **tek toplu group-by count** (döngü içi sorgu YASAK). Alternatif: sayıları veren bir view (SQL → İskender).
- Veri fonksiyonu yeni adla ayrılabilir: `getYayindakiVideolar(userId, rol, adminSupabase)` — mevcut `getAnaSayfaVideolari`'yi bozmadan (o ana sayfada kullanılıyor).
**Doğrulama:** bir yayının kart verisinde doğru ad soyad + rol + favori/beğeni sayısı.
**Çıktı:** Gruplama ve kart için hazır veri.

### Adım 4 — Klasör (role göre gruplama)
**Amaç:** Videoları üreten üretici rolüne göre klasörle.
**Yapılacaklar:**
- Sayfada videoları `ureten_rol` ile grupla; klasör başlığı `ROL_ADLARI[ureten_rol]`; sayaç = grup uzunluğu; **videosu olmayan rol klasörü gösterilmez**.
- Bileşen: `app/yayindaki-videolar/_components/KlasorGrid.tsx` (klasör kartları) + seçili klasör state; klasör seçiliyken o grubun videoları `VideoBolumu` ile; "Klasörler" geri butonu.
- Grup sırası: sabit rol sırası (ör. `YAYINDAKI_VIDEO_GORENLER` sırası) ya da video sayısına göre — karara bağlı ufak nokta.
**Doğrulama:** PM'in 5 videosu "Ürün Müdürü" klasöründe; klasör→kart→oynatıcı akışı; boş rol görünmez.
**Çıktı:** Klasör → kart yapısı.

### Adım 5 — Kart güncellemesi (VideoBolumu)
**Amaç:** Kart mockup'a oturur: ★ favori + ♥ beğeni (sol) · yayın tarihi (sağ) · altında üreten (rol kısaltması + ad soyad). Eski "Video puanı" rozeti bu bağlamda **kaldırılır**.
**Yapılacaklar:**
- `VideoBolumu` kartına favori/beğeni/üreten alanları. **DİKKAT — paylaşımlı bileşen:** `VideoBolumu` ana sayfalarda (`UreticiAnaSayfa`, `Ytc.` vb.) da kullanılıyor; değişiklik oraları da etkiler. İki seçenek (§5 açık karar):
  - (a) `VideoBolumu`'na `varyant`/prop eklenir: "puan" (mevcut ana sayfa) vs "favori-begeni" (yeni sayfa),
  - (b) ana sayfalar da yeni görünüme geçirilir (puan rozeti her yerde favori/beğeniyle değişir).
- Üreten etiketi: rol kısa adı + ad soyad (ör. "PM Merve Yılmaz"). Kısa rol eşlemesi gerekiyorsa küçük bir harita.
**Doğrulama:** kart mockup ile birebir; ana sayfa kartı seçilen seçeneğe göre bozulmadı.
**Çıktı:** Nihai kart görünümü.

### Adım 6 — Erişim/güvenlik doğrulaması
**Amaç:** Yalnız hedef roller; izlemede puan/soru üretilmez.
**Yapılacaklar:**
- API ucu `YAYINDAKI_VIDEO_GORENLER` dışını `403` ile reddeder (Adım 2'de kuruldu; burada teyit + test).
- `v_yayin_detay` okuması sunucuda service-role (mevcut desen; RLS baypası kasıtlı).
- İzleme: bu sayfa `VideoOynatici`'yi **yalnız-izleme** modunda çağırır; `izle/api/baslat|cevap|bitir` bu sayfadan tetiklenmez — koddan teyit (puan/soru kaydı doğmaz).
**Doğrulama:** tüketici `403`; oynatma sonrası `kazanilan_puanlar`/cevap kaydı oluşmadığı teyidi.
**Çıktı:** Kapalı erişim + izleme-modu garantisi.

### Adım 7 — Doğrulama
**Yapılacaklar:** Üçlü (tsc/denetim/lint) + rol bazlı fiziksel test.
**Fiziksel:** bir üretici (pm), bir yönetici (gm), tm/bm → pill görünür, klasör→kart→oynatıcı çalışır; bir tüketici (utt) → pill yok, URL reddi.
**Çıktı:** Özellik tamam; İskender onayı.

---

## 4. Açık kararlar (teknik yazımı bitmeden netleşmeli)

1. **İK rolleri (`ik_*`):** `URETICI_ROLLER` içinde oldukları için hedef sette görünüyorlar; **ama** `gorunenTurler(rol)` bugün İK'ya boş liste döndürüyor → İK şu an hiç video görmüyor. İK bu sayfada video görecek mi? Görecekse hangi türleri? (Görmeyecekse: sette kalsın ama veri boş döner → pill'i olan ama boş sayfa. Bu istenmiyorsa İK seti dışına alınır.)
2. **`VideoBolumu` paylaşımı (Adım 5):** kart değişikliği ana sayfaları da etkiler → prop'lu varyant (a) mı, her yerde yeni görünüm (b) mi?
3. **Favori/beğeni + üreten kaynağı (Adım 3):** `v_yayin_detay`'a kolon/view eklenerek DB'de mi (SQL → İskender), yoksa kodda toplu sorguyla mı çözülsün?
4. **Klasör sırası (Adım 4):** sabit rol sırası mı, video sayısına göre mi?

---

## 5. Çalışma disiplini

- Her adım öncesi yapılacaklar madde madde + onay; bir adım = bir commit; push emirle.
- Üçlü doğrulama temiz geçmeden adım kapanmaz; adım başına ≤1 duman testi (1 mutlu + 1 red).
- DB'ye yazan her şey (şema/view/politika) SQL olarak İskender'e verilir; Claude canlı DB'ye yazmaz.
- Uçtan uca doğrulama İskender'in fiziksel testlerinde; tespitler talimattır, kapsam onaysız daraltılmaz.

---

## 6. Uygulama günlüğü

Her adım tamamlandıkça buraya işlenir.

- **23.07 — Adım 6 yapıldı (erişim/güvenlik teyidi — kod değişikliği yok).** Kod incelemesiyle doğrulandı:
  - **Erişim:** API ucu `YAYINDAKI_VIDEO_GORENLER` dışını `rolHatasi` ile reddeder; `proxy.ts` bekçisi URL'den gireni kapatır (tüketici/iu → API 403 / sayfa `/ana-sayfa`).
  - **İzleme modu:** sayfa `VideoOynatici`'yi `tuketici={false}` çağırır. `VideoOynatici`'de `baslat` efekti (`if (!tuketici) return;`) ve `bitir` efekti (`if (!tuketici ...) return;`) erken döner; soru-cevap ve ileri-sarma UI yalnız `tuketici` iken render edilir. Sonuç: yönetici/üretici izlerken **hiçbir izleme/puan/cevap kaydı doğmaz** — `izle/api/baslat|bitir|cevap|sorular|ileri-sarma` bu sayfadan tetiklenmez.
  - Kod değişikliği gerekmedi; yalnız belge güncellendi. Kalan: Adım 7 (uçtan uca fiziksel test — İskender).
- **23.07 — Adım 5 yapıldı (kart güncellemesi — ana sayfaya dokunulmadı).** Yeni sayfaya ÖZEL kart bileşeni [`app/yayindaki-videolar/_components/YayindakiVideoBolumu.tsx`](../app/yayindaki-videolar/_components/YayindakiVideoBolumu.tsx) yazıldı (paylaşımlı `VideoBolumu`'ndan ayrı → ana sayfa kartı eskisi gibi puanlı kalır, karar 2).
  - **Kart (mockup ile birebir):** thumbnail (gradient/play deseni), üst satır ürün + teknik; alt satır **★ favori** + **♥ beğeni** (sol) · **yayın tarihi** (sağ); altında **üreten** (kısa rol + ad soyad, `ROL_KISA` haritası; bilinmeyen rol tam adına düşer). Puan rozeti yok.
  - **Bağlama:** [`KlasorGrid`](../app/yayindaki-videolar/_components/KlasorGrid.tsx) artık `VideoBolumu` yerine `YayindakiVideoBolumu` kullanıyor. `VideoBolumu` (ana sayfa) hiç değişmedi.
  - Doğrulama: tsc/denetim/lint temiz. Kart görünümü İskender'in fiziksel testinde (favori/beğeni gerçek değerleri + üreten etiketi).
  - **Durum:** özellik işlevsel olarak tamam (pill → sayfa → klasör → kart → oynatıcı, izleme modu). Kalan: Adım 6 (erişim/güvenlik teyidi) + Adım 7 (uçtan uca fiziksel test).
- **23.07 — Adım 4 yapıldı (departman klasörleri).** Videolar üreten rolüne göre departmana gruplanıp klasör olarak gösteriliyor.
  - **Eşleme (tek yer):** [`lib/video/departman.ts`](../lib/video/departman.ts) — `departmanKey(rol)`: `ik_*`→ik, `egt_*`→egitim, `med_md`→medikal, gerisi→urun. `DEPARTMAN_SIRA` = urun > medikal > egitim > ik. `DEPARTMAN_ETIKET` default: Ürün Müdürlüğü / Medikal Müdürlük / Eğitim Müdürlüğü / İK Müdürlüğü. Firma-özel adlandırma (Müdürlük/Direktörlük) ileride bu haritaya override katmanıyla bağlanacak — `firmalar` tablosunda alan yok, ayrı DB/tur işi (kod yorumunda not düşüldü).
  - **UI:** [`app/yayindaki-videolar/_components/KlasorGrid.tsx`](../app/yayindaki-videolar/_components/KlasorGrid.tsx) — klasör grid (departman adı + "N video", boş departman gösterilmez) → klasöre tıkla → o departmanın videoları mevcut `VideoBolumu` ile → "← Klasörler" geri. Seçili departman KlasorGrid iç state'inde; video seçimi `onVideoSec` ile sayfaya (tam sayfa `VideoOynatici`).
  - **Sayfa:** düz `VideoBolumu` yerine `KlasorGrid` bağlandı ([`page.tsx`](../app/yayindaki-videolar/page.tsx)).
  - Doğrulama: tsc/denetim/lint temiz. Klasör→kart→oynatıcı akışı + boş departman gizleme İskender'in fiziksel testinde.
- **23.07 — Adım 3 yapıldı (veri katmanı: üreten + favori/beğeni, tüm türler, İK dahil).** Yeni veri fonksiyonu [`lib/video/yayindakiVideolar.ts`](../lib/video/yayindakiVideolar.ts) → `getYayindakiVideolar` (mevcut `getAnaSayfaVideolari` bozulmadı, ana sayfada kalıyor).
  - **Görünürlük (yeni sayfaya özel):** `v_yayin_detay`, `durum='yayinda'`; **tür süzgeci YOK** (ana sayfadaki "kendi türünü görme" dışlaması uygulanmaz → yayındaki her tür görünür, İK dahil). **Konum kapsamı korundu:** `kapsamGenisMi` → geniş rol firma takımları, dar rol (tm/bm/İK) yalnız kendi takımı; başka firma sızmaz.
  - **Üreten:** `v_yayin_detay.uretici_id` → `kullanicilar(ad, soyad, rol)` **tek toplu sorgu** (N+1 yok) → `ureten_ad_soyad`, `ureten_rol` (Adım 4'te departman klasörüne eşlenecek).
  - **Favori/beğeni:** `video_favoriler` / `video_begeniler` (ikisi de `yayin_id` anahtarlı) ilgili yayınlar için toplu çekilip JS'te sayıldı → `favori_sayisi`, `begeni_sayisi`. **DB yazımı yok** (açık karar 3: view yerine kod).
  - **Tip:** `YayindakiVideo = AnaSayfaVideo + ureten_ad_soyad + ureten_rol + favori_sayisi + begeni_sayisi`. API ([`.../api/route.ts`](../app/yayindaki-videolar/api/route.ts)) bu fonksiyona geçti; sayfa `videolar` tipi `YayindakiVideo[]` (kart Adım 5'te kullanacak).
  - Doğrulama: tsc/denetim/lint temiz (denetim yeni sorguların kolonlarını şemayla doğruladı). Sayaçların doğru değeri gerçek veriyle İskender'in fiziksel testinde (yeni alanlar ekranda Adım 5'te görünür).
  - Not: dar kapsamlı roller (tm/bm/İK) yalnız kendi takımını görür — İK'nın takımı yoksa liste boş olabilir; gerekirse konum kuralı ayrı ele alınır.
- **23.07 — Adım 2 yapıldı (sayfa iskeleti + rota + navbar pill + rol bekçisi).** Gezilebilir kabuk kuruldu; mevcut bileşenler yeniden kullanıldı, yeni tasarım yok.
  - **Sayfa:** [`app/yayindaki-videolar/page.tsx`](../app/yayindaki-videolar/page.tsx) — `Navbar` + "Yayındaki videolar" başlığı + "izleme modu" rozeti; `aktifVideo` yoksa `VideoBolumu` (düz liste, `baslik=""`), varsa `VideoOynatici` (`tuketici={false}` → puan/soru yok). Rol bekçisi sayfada da tekrar (`YAYINDAKI_VIDEO_GORENLER` değilse `/ana-sayfa`'ya).
  - **API:** [`app/yayindaki-videolar/api/route.ts`](../app/yayindaki-videolar/api/route.ts) — auth + `YAYINDAKI_VIDEO_GORENLER` kontrolü + `getAnaSayfaVideolari` (Adım 2'de mevcut haliyle; üreten/favori/beğeni Adım 3'te).
  - **Navbar:** [`components/Navbar.tsx`](../components/Navbar.tsx) — "Ana Sayfa"dan sonra **"Yayındaki Videolar"** pill'i (play ikonu yok), yalnız `YAYINDAKI_VIDEO_GORENLER`; `/yayindaki-videolar`'a gider.
  - **Bekçi:** [`proxy.ts`](../proxy.ts) — CC bloğundan sonra `/yayindaki-videolar` (sayfa+api) yalnız hedef rollere; tüketici/iu URL'den girerse API→403, sayfa→`/ana-sayfa`. (Sorgu yalnız bu yolda çalışır.)
  - Doğrulama: tsc/denetim/lint temiz. Rol-bazlı mutlu/red (hedef rol pill+sayfa görür; tüketici görmez/URL reddi) auth gerektirdiğinden İskender'in fiziksel testinde.
  - Bilinen sınır: İK şu an `getAnaSayfaVideolari` boş dönüşü nedeniyle boş sayfa görür — Adım 3'te açılacak. Klasör yok (düz liste) — Adım 4.
- **23.07 — Adım 1 yapıldı (kapsam & rol seti).** [`lib/utils/roller.ts`](../lib/utils/roller.ts)'e tek sabit eklendi: `YAYINDAKI_VIDEO_GORENLER = [...URETICI_ROLLER, ...YONETICI_ROLLER, ...YONLENDIRICI_ROLLER]` (üretici — İK dahil — + yönetici + tm/bm). `iu` ve tüketici roller (`utt/kd_utt/eczaci/eczane_teknisyeni/musteri`) otomatik hariç (hiçbir alt listede yoklar). Bu sabit sonraki adımlarda navbar pill + sayfa bekçisi + veri ucunda tek kaynak olarak kullanılacak. Bu adımda yalnız tanımlandı; henüz tüketici yok, görsel değişiklik yok. tsc/denetim/lint temiz. **Karar güncellemeleri (§4):** (1) İK görecek — `gorunenTurler` İK'ya bugün boş dönüyor, İK için Adım 3'te açılacak; (4) klasörler **departman bazında** (Ürün Müdürlüğü > Medikal Müdürlük > Eğitim Müdürlüğü > İK Müdürlüğü), etiketler **firmaya göre** uyarlanabilir (Müdürlük/Direktörlük) → firma bazlı etiket kaynağı Adım 4'te ele alınacak; (2) `VideoBolumu` ana sayfada **değişmeyecek**, yeni sayfa kendi kart varyantını kullanacak; (3) favori/beğeni+üreten kaynağı teknik seçim (Claude'da).
- **23.07 — Plan oluşturuldu.** Onaylı mockup ve mevcut bileşen taraması (`VideoBolumu`/`VideoOynatici`/`getAnaSayfaVideolari`/`v_yayin_detay`/`video_favoriler`/`video_begeniler`) üzerine yazıldı. Geliştirme sırası: rol seti → sayfa iskeleti → veri → klasör → kart → güvenlik → doğrulama. Dört açık karar §4'te bekliyor.
