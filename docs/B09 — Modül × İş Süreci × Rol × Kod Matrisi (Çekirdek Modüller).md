# B09 — Modül × İş Süreci × Rol × Kod Matrisi (Çekirdek Modüller)

*Kaynak: REDBOOK §2.3/§2.8/§3-§5 (süreç+rol) + 30.07 kod taraması (hard-code konumu). "Karşılığı VAR" = roller.ts'te birebir grup mevcut, kullanılmıyor.*

## 1 · T-CLUB (merkez rol: utt / kd_utt)

| İş süreci | Rol ne yapıyor | Bugün nerede hard-code (dosya:satır) | roller.ts karşılığı |
|---|---|---|---|
| **Üretim hattı — erişim** (talep/senaryo/video/soru seti görüntüleme) | Üretici roller + İÜ görür | `senaryolar/api/route.ts:15`, `videolar/api/route.ts:17` + `bunny-durum:26`, `soru-setleri/api/route.ts:18` → `[...URETICI_ROLLER, "iu"]` | **VAR — `URETIM_HATTI_GORENLER`** (kısmi: URETICI_ROLLER import ediliyor, iu elle) |
| **Üretim hattı — İÜ teslimi** (senaryo/video/soru seti üretme) | Yalnız İÜ üretir/teslim eder | `senaryolar/api/route.ts:54`, `videolar/api/route.ts:53` + `bunny-yukleme-baslat:26`, `soru-setleri/api/route.ts:54`; `isIU = ...==="iu"` ~6 sayfa/durum dosyası | **VAR — `IU_ROLU`** sabiti; her yerde `=== "iu"` elle |
| **Talep dosyası** (erişim / yükleme / silme) | Erişim: PM ailesi + İÜ · Yükleme-silme: yalnız PM ailesi | `talepler/api/dosyalar/route.ts:16` `["pm","jr_pm","kd_pm","iu"]`, `:44`/`:87` `["pm","jr_pm","kd_pm"]` | **YOK — "PM ailesi" grubu açılmalı** (`ECZANEM_TALEP_ACAN_ROLLER` aynı 3 rol ama anlamı farklı → karar gerek) |
| **Tüketim — izleme/cevap/beğeni/favori** | Yalnız utt/kd_utt izler | `izle/api/`: `baslat:18, bitir:23, cevap:19, begeni:17, favori:17, sorular:22, ileri-sarma:18, [yayin_id]:22, route:33` → `["utt","kd_utt"]` | **VAR — `TUKETICI_ROLLER`**; hiç kullanılmıyor |
| **Yayındaki Videolar — izleme yüzeyi** | Üretici+yönlendirici+tüketici izler | `izle/api/route.ts:9` `IZLEME_ROLLERI = ["utt","kd_utt","bm","tm",...URETICI_ROLLER]` | **KISMİ — `YAYINDAKI_VIDEO_GORENLER` VAR ama küme farklı** (o yönetici içerir, utt içermez) → doğrulanacak/karar |
| **Ana sayfa — role göre dispatch** | Her rol kendi panosuna | `ana-sayfa/api/route.ts:27-46` (`bm`/`tm`/`["utt","kd_utt"]`/`iu`), `page.tsx:44` `admin` | Kısmi: utt/kd_utt için `TUKETICI_ROLLER` VAR; gerisi tekil |
| **HB Ligi — role göre kapsam** | utt kendi/takım, bm bölge, tm takım | `hbligi/api/route.ts:70` `["utt","kd_utt"]`, `:78` bm, `:86` tm | `TUKETICI_ROLLER` VAR; bm/tm tekil |
| **HBStore — sipariş görüntüleme filtreleri** | admin+üretici+yönetici "Takım" filtresi görür (TM hariç) | `store/siparisler/…/SiparisFiltreleri.tsx:147-151` (18-rol OR + **hayalet roller** `egt_uzm`/`ik_uzm`), `:75/84/93/128/158/171/178/197` tekil; `store/page.tsx:204` bm | **VAR — `STORE_GENEL_GOREN_ROLLER`** (blok onun elle yazılmış, hatalı alt kümesi) → **SESSİZ HATA burada** |

*Meşru (kapsam dışı):* `hedef_rol`/`hedef_roller` karşılaştırmaları ve `ANA_SEKMELER`/`HedefRol` listeleri (DB içerik ekseni — `TUM_HEDEF_ROLLER` alanı), `kaynak:"iu"` üretim-kaynağı enum'u, `tip:"utt"` union etiketleri, toast payload rol etiketleri. Not: `YeniTalepForm.tsx:86` / `YeniTalepFormV2.tsx:45` `["utt","bm","eczaci","eczane_teknisyeni"]` hedef listesi — `TUM_HEDEF_ROLLER`/`ECLUB_HEDEF_ROLLER` VAR, elle yazılmış (hedef ekseni).

## 2 · C-CLUB (merkez rol: bm)

| İş süreci | Rol ne yapıyor | Bugün nerede hard-code | roller.ts karşılığı |
|---|---|---|---|
| **Challenge — izleme/gönderme** | Yalnız bm gönderir/izler | `challenge-club/**`: `api/route.ts:40,236,261`, `izle/api/{baslat:39,bitir:38,cevap:35,ileri-sarma:32}`, `uygun-aliciler:34`, `uygun-videolar:30`, `page.tsx:92,100` → `rol !== "bm"` / `=== "bm"` | **Tekil rol — grup gereksiz.** `bm ∈ YONLENDIRICI_ROLLER` ama modül tek-rollü → **sınırda/meşru** |
| **Alıcı süzme** | Challenge yalnız bm'lere | `challenge-club/api/route.ts:61` `.eq("hedef_rol","bm")`, `lib/cc/uygunAliciListesi.ts:34` `.eq("rol","bm")` | `hedef_rol` = meşru; `.eq("rol","bm")` = tekil sorgu, sınırda |
| **CC Ligi görünürlüğü** | bm asıl, diğerleri gözlemci | *(hard-code yok)* | **`CCLIGI_GORENLERLER` zaten kullanılıyor — temiz** |

*Bulgu:* C-Club tek-rollü olduğu için B-09 yüzeyi çok dar — hemen hepsi tekil `"bm"` (Sınırda). `hedef_rol !== "bm"` meşru.

## 3 · E-CLUB (merkez rol: eczaci / eczane_teknisyeni)

| İş süreci | Rol ne yapıyor | Bugün nerede hard-code | roller.ts karşılığı |
|---|---|---|---|
| **Liste yönetimi** (eczane/kişi ekleme) | utt/kd_utt yönetir | `listem/api/eczaneler:20`, `kisiler:16`, `page.tsx:13` → `ECLUB_UTT_ROLLERI = ["utt","kd_utt"]` | **VAR — `ECLUB_GOREN_ROLLER`** (tam bu sayfa için tanımlı) / `TUKETICI_ROLLER` |
| **Öneri gönderme** (UTT → kişi) | utt/kd_utt önerir | `oneriler/api/route:15`, `yayinlar:8`, `page.tsx:13` → `ECLUB_UTT_ROLLERI` | **VAR — `TUKETICI_ROLLER` / `ECLUB_GOREN_ROLLER`** |
| **Tüketim — kişi paneli** | eczacı/teknisyen izler | `panel/api/{baslat:13,bitir:13,route:14,sorular:11,cevapla:12}` → `ECLUB_KISI_ROLLERI = ["eczaci","eczane_teknisyeni"]` | **VAR — `ECLUB_TUKETICI_ROLLERI`**; ×5 yerel yeniden tanım |
| **E-Club Ligi** (koçluk sıralaması) | utt/kd_utt+bm+tm görür | `ligi/api/route:14`, `export:14` → `LIG_GOREN_ROLLER=["utt","kd_utt","bm","tm"]`; `page.tsx:37,71,181,191,243` + `useEclubLigi:131` tekil dağıtım | **VAR — `ECLUB_LIGI_GOREN_ROLLER`** (birebir); ×2 yerel + sayfa içi tekil |
| **E-Club Store — rapor** | utt/kd_utt+bm+tm görür, admin tümü | `store/rapor/api/route.ts:6` `FIRMA_YETKILI_ROLLER=["utt","kd_utt","bm","tm"]`, `:24` admin | **VAR — `ECLUB_STORE_RAPOR_GOREN_ROLLER`** (birebir) |
| **E-Club Store — kişi alışverişi** | eczacı/teknisyen alır | `store/api/{route:6,siparis:6,adres:6}` → `ECLUB_KISI_ROLLERI` | **VAR — `ECLUB_TUKETICI_ROLLERI`** |

*Meşru (kapsam dışı):* `k.rol === "eczaci"` (tek-rol iş kuralı "bir eczacı/çok teknisyen" ayrımı — `listem/api/kisiler:186,195`, `eczaneler:69`), ekran rengi (`EczaneBlogu:103,123`), `<option value="eczaci">`, `type EclubHedefRol/EclubKisiRol` union'ları, `rolRenk(rol: …)` tip imzası.

## 4 · ECZANEM (merkez rol: musteri)

| İş süreci | Rol ne yapıyor | Bugün nerede hard-code | roller.ts karşılığı |
|---|---|---|---|
| **UTT dağıtım ekranı** (/eczanem/utt) | utt/kd_utt dağıtır | `eczanem/utt/page.tsx:32` `const TUKETICI_ROLLER = ["utt","kd_utt"]` | **VAR — `TUKETICI_ROLLER`** → **aynı adla yerel gölge** (en tehlikeli hâl) |
| **Müşteri paneli** (/eczanem) | musteri kendi bakiyesini görür | `eczanem/page.tsx:31` `kimlik_turu === "musteri"` | `MUSTERI_ROLU` VAR (bu kimlik_turu kontrolü — sınırda) |
| **Eczacı tarafı / kasa / gönderim** | eczacı, rol tabanlı proxy bekçisi | *(app tarafında hard-code yok — proxy + `lib/eczanem` `rolCozucu` kullanır)* | **Temiz** |

*Bulgu:* Eczanem'in rol kapısı ağırlıkla proxy (§2.4 rol tabanlı 6. bekçi) ve `lib/eczanem`'de; app yüzeyinde tek gerçek ihlal `eczanem/utt/page.tsx:32`'deki isim-gölgesi.

---

## Matrisin yol haritasına söylediği

**Çekirdek modüllerde neredeyse her hard-code'un roller.ts karşılığı ZATEN VAR.** Yeni grup icat etmek değil, var olanı benimsetmek gerekiyor. Tekrar eden yerel kopyalar ve hedefleri:

| Yerel kopya | Kaç yer | Hedef sabit (mevcut) |
|---|---|---|
| `["utt","kd_utt"]` / `ECLUB_UTT_ROLLERI` / `UTT_ROLLER` / yerel `TUKETICI_ROLLER` | ~15 | `TUKETICI_ROLLER` (E-Club'da `ECLUB_GOREN_ROLLER`) |
| `ECLUB_KISI_ROLLERI = ["eczaci","eczane_teknisyeni"]` | ~8 | `ECLUB_TUKETICI_ROLLERI` |
| `LIG_GOREN_ROLLER` / `FIRMA_YETKILI_ROLLER = [utt,kd_utt,bm,tm]` | 3 | `ECLUB_LIGI_GOREN_ROLLER` / `ECLUB_STORE_RAPOR_GOREN_ROLLER` |
| `[...URETICI_ROLLER,"iu"]` | 4 | `URETIM_HATTI_GORENLER` |
| `=== "iu"` | ~10 | `IU_ROLU` |

**Karar gerektiren (grup YOK / kısmi):** yalnız 3 nokta — (a) talep dosyası "PM ailesi" grubu, (b) `IZLEME_ROLLERI` vs `YAYINDAKI_VIDEO_GORENLER` küme farkı, (c) SiparisFiltreleri'nin `STORE_GENEL_GOREN_ROLLER` alt kümesi + hayalet rol düzeltmesi.

**C-Club ve Eczanem düşük yüzeyli:** biri tek-rollü (bm), diğeri proxy/lib tabanlı; ikisi de küçük.

Bu, çözüm sırasının neden **1-4-5-2-3** olduğunu da doğruluyor: çekirdek modüllerdeki iş çoğunlukla "yerel kopyayı mevcut sabitle değiştir" (Gerçek Sorun + Karışık Kullanım), yeni tasarım değil.
