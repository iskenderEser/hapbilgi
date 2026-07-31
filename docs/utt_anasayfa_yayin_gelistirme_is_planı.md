# utt_anasayfa_yayin_gelistirme_is_planı

*Oluşturma: 31.07.2026 · Durum: onay bekliyor (uygulanmadı)*

Bu belge, UTT ana sayfası video sergileme düzeninin küratörlü raflara çevrilmesi ve UTT'ye "Yayındaki Videolar" sekmesinin açılması işinin planıdır. Üç bölümdür: mevcut durum, kullanıcı talepleri ve ortaklaşılanlar, teknik detaylı plan.

---

## 1 — Mevcut Durum

- **UTT ana sayfası** (`components/ana-sayfa/UttAnaSayfa.tsx`): veri katmanı (`lib/utils/anaSayfa/utt.ts`) `yeni_videolar / devam_edenler / tamamlananlar / ekstra_izlediklerim + istatistikler` döner. Render sırası: karşılama → 4 stat kart → global 🔥 En Çok İzlenen + ❤️ En Çok Beğenilen (sayaç 0 iken gizli) → ⭐ Ekstra İzlediklerim → **departman blokları** (`icerik_turu`, `TUR_SIRA` sırasıyla: İK / Medikal / Eğitim Müdürlüğü / Ürün), **her blok o kategorinin TÜM videolarıyla sarma-ızgara**, dilimsiz (`UttAnaSayfa.tsx:446-468`). Görünürlük düzeltmesinden sonra 4 departman da dolduğu için sayfa uzun bir dikey akışa dönüştü.
- **UTT'de "Yayındaki Videolar" sekmesi yok.** `YAYINDAKI_VIDEO_GORENLER` tüketici rollerini bilinçli hariç tutar (`lib/utils/roller.ts:60`); bu gruba bağlı dört nokta var: proxy bekçisi (`proxy.ts:160`), sayfa guard'ı, API guard'ı, navbar pill'i (`components/Navbar.tsx:265`). UTT'nin tek video yüzeyi ana sayfadır. Mevcut `/yayindaki-videolar` sayfası yalnız-izlemedir (`tuketici={false}`).
- **Metrikler zaten payload'da:** `yayin_tarihi`, `izlenme_sayisi`, `begeni_sayisi`, `favori_sayisi`, `video_puani` — yani raf algoritması için yeni backend gerekmez.
- **Askıda:** Görünürlük düzeltmesi (`lib/utils/anaSayfa/utt.ts` + `scripts/sql/get_izle_videolari_firma.sql`) yapıldı ve canlıda doğrulandı, ancak henüz commit edilmedi. (Kök neden: V1'in tek-takım varsayımıyla konulan `takim_id` tam-eşleşme süzgeci, üretici rol 13'e genişleyip firma-geneli/takımsız içerik doğunca dar kaldı; iki UTT tüketim yüzeyi de firma-geneli utt-hedefli içeriği eliyordu.)

---

## 2 — Kullanıcı Talepleri ve Ortaklaşılanlar

- **T1** — UTT'ye "Yayındaki Videolar" sekmesi açılacak; içerik **utt-hedefli** yayınlar (düzeltmedeki görünürlük süzgeciyle: `hedef_rol=utt` + takım VEYA takımsız+firma), UTT için **puanlı açılış** (diğer roller yalnız-izleme sürer).
- **T2** — Ana sayfada departman başlıkları kalacak, ama her departman **tek satır** (sayfa yatay sınırına göre ~5 kart, sarma yok).
- **T3** — Her departman rafı 5-üstünlük algoritmasıyla dizilecek; slot sırası sabit: **[en yeni · en çok izlenen · en çok beğenilen · en çok favorilenen · en yüksek puanlı]**.
- **T4** — Slot dolum kuralı: metriğin **gerçek kazananı** varsa **deterministik** (harf sırası eşitlik bozucu); metrik tanımsız (hepsi 0) ya da kazananı üst slotça alınmışsa **random rotasyon** (her yüklemede değişir); video tekil; tavan 5; az video → az kutu; **yalnız "en yeni" çoklu slot doldurabilir**.
- **T5** — Global "En Çok İzlenen / En Çok Beğenilen" blokları **kalacak**.
- **T6** — Metrikler **platform-geneli** kalacak; **tamamlanan** videolar da rafa girebilir.
- **T7** — Departman raflarının **en üstünde** (Ekstra İzlediklerim'den sonra, ilk departmandan önce) **"Tümü" rafı** — tamamen random ≤5, her yüklemede değişir.
- **Ortaklaşılan** — Random, **yükleme başına bir kez** hesaplanır (oturum içi sabit, yenilemede değişir) → sayfa render'larında titremez.

---

## 3 — Teknik Detaylı Plan

İki iş; her biri kendi commit'i, üçlü doğrulama (tsc + denetim + lint:mimari), **push yok** (§6.3). Askıdaki görünürlük düzeltmesi de bu seride commit'lenir.

### İş A — Ana sayfa küratörlü raflar (backend gerektirmez)

- **A1 — ✓ yapıldı** — Yeni saf yardımcı `lib/video/anaSayfaRaflari.ts`: girdi utt-görünür video listesi; çıktı `{ tumuRafi: Video[] (random ≤5), departmanRaflari: {tur, videolar: Video[]}[] (her tur 5-üstünlük) }`. Algoritma **tek yerde**, saf ve test edilebilir; random tohumu parametreyle (yükleme başına sabit). Tek-kaynak ilkesi.
- **A2** — `components/ana-sayfa/UttAnaSayfa.tsx`: mevcut departman sarma-ızgarası (446-468) yerine (i) **"Tümü" rafı**, (ii) **departman rafları**; her raf **tek satır** (≤5, sarma yok, responsive: mobilde daha az sütun). Raf hesabı A1'den `useMemo` ile veri yüklendiğinde bir kez. Stat kartlar + global bloklar + Ekstra aynen kalır.
- **A3** — Backend'e dokunulmaz (metrikler mevcut payload'da).

### İş B — UTT "Yayındaki Videolar" sekmesi (rol-duyarlı)

- **B1** — `lib/utils/roller.ts`: yeni erişim grubu `YAYINDAKI_VIDEO_ERISEN = [...YAYINDAKI_VIDEO_GORENLER, ...TUKETICI_ROLLER]`. "Yalnız-izleme" semantiği taşıyan `YAYINDAKI_VIDEO_GORENLER` üretici için korunur. (`rol-tek-kaynak` lint güvenli — adlandırılmış grup.)
- **B2** — Guard'lar `YAYINDAKI_VIDEO_ERISEN`'e geçer: `proxy.ts:160`, sayfa, API. Navbar pill görünürlüğü de (`components/Navbar.tsx:265`).
- **B3** — Veri kaynağı rol-duyarlı: `TUKETICI_ROLLER` ise utt-görünür tam liste — `lib/utils/anaSayfa/utt.ts`'teki ilk zenginleştirilmiş sorgu paylaşılan bir fonksiyona çıkarılır (`icerik_turu` + metrikler); değilse mevcut `getYayindakiVideolar`.
- **B4** — Açılış rol-duyarlı: sayfa `VideoOynatici`'yi `tuketici={TUKETICI_ROLLER.includes(rol)}` ile çağırır → UTT puanlı, üretici yalnız-izleme.
- **B5** — Gruplama: UTT tarafında `icerik_turu` (TUR_BASLIK departmanları). Düzen: mevcut ana sayfa "tam-ızgara departman bölümleri" render'ı bu sekmeye **taşınır** (yani A'da ana sayfadan kaldırılan "hepsi açık" görünüm burada yaşar) + arama (`useListe` / `ListeArama`). Üretici tarafı `KlasorGrid` ile aynen kalır.
- **Doğrulama** — tsc + denetim + lint:mimari + tek smoke (İskender, canlı): UTT sekmeyi görür → açar → **puanlı** izler ve puan alır; üretici hâlâ **yalnız-izleme**; UTT ana sayfası rafları 5 kart + Tümü rafı.

### Sıra ve commit

1. Görünürlük düzeltmesi (askıdaki) — 2 commit (SQL + utt.ts).
2. İş A — raf yardımcısı + UttAnaSayfa (1-2 commit).
3. İş B — roller / guard / veri / açılış / düzen (mantıksal 2-3 commit).

Hepsi üçlüden geçer; **push edilmez** (§6.3 — deploy-öncesi mecburi işler bitmeden push yok).
