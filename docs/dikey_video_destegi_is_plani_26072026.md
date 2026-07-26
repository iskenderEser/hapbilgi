# Dikey Video Desteği — Birleşik İş Planı

**26.07.2026 · Karar sahibi: İskender · Uygulama başladı (Adım 1 tamam)**

Üç kaynaktan alınanlar: **Claude** (yardımcı + sarmalayıcı + yedek zinciri),
**DeepSeek** (kapaktan ölçme), **ChatGPT** (pilot yüzey, webhook, guard'lar, eşik).

---

## 1. Talep

**Sahibi:** İskender · 26.07.2026

Video oynatma alanı, gelen videonun yönüne göre **responsive** olsun. Yatay gelen
yatay, dikey gelen dikey gösterilsin.

**Kısıtlar:**
1. **Dikey video masaüstünde ortalanacak.**
2. **Mevcut yatay oynatma işi bozulmayacak.**

---

## 2. Bugünkü durum (kod kanıtlı)

Sistemde dikey video kavramı yok. Her yüzey videoyu sabit yatay çerçeveye sokuyor.

**Oynatıcılar — sabit yükseklikli iframe:**

| Yüzey | Satır | Ölçü |
|---|---|---|
| İzle (UTT) | [components/izle/VideoOynatici.tsx:281](components/izle/VideoOynatici.tsx:281) | `width="100%" height="400"` |
| Challenge Club | [components/challenge-club/CcVideoOynatici.tsx:416](components/challenge-club/CcVideoOynatici.tsx:416) | `height="400"` |
| Eczanem | [app/eczanem/_components/EczanemVideoOynatici.tsx:188](app/eczanem/_components/EczanemVideoOynatici.tsx:188) | `height="400"` |
| E-Club | [app/eclub/panel/_components/EclubVideoOynatici.tsx:229](app/eclub/panel/_components/EclubVideoOynatici.tsx:229) | `height="400"` |
| Video detay (üretim) | [app/videolar/[senaryo_durum_id]/page.tsx:485](app/videolar/[senaryo_durum_id]/page.tsx:485) | `height="450"` |
| Talep detay (hazır video) | [app/talepler/[talep_id]/page.tsx:394](app/talepler/[talep_id]/page.tsx:394) | `height="360"` |
| Onaylanan talepler | [app/onaylanan-talepler/page.tsx:179](app/onaylanan-talepler/page.tsx:179) | `height="320"` |
| Yayın önizleme modalı | [app/yayin-yonetimi/_components/Modallar.tsx:23](app/yayin-yonetimi/_components/Modallar.tsx:23) | `height="450"` |

**Kart/kapak alanları — sabit 16:9:** `components/ana-sayfa/VideoBolumu.tsx:53`,
`components/ana-sayfa/UttAnaSayfa.tsx:94`,
`app/yayindaki-videolar/_components/YayindakiVideoBolumu.tsx:59`,
`app/oneriler/page.tsx:499`.

**Sonuç:** Dikey video yüklenirse kaybolmaz — Bunny oynatıcısı yanlara siyah bant
koyup ortalar — ama 400 px'lik yatay kutuda avuç içi kadar kalır.

Kod tabanının tamamında `9:16`, `portrait` ya da yön/oran mantığı yok (grep
teyitli). Yükleme tarafında da yön kontrolü ya da döndürme yok.

---

## 3. Planın yapısı

Plan **sabit bir çekirdek** ile **tek değişkenden** oluşur. Çekirdek her koşulda
aynıdır; değişken yalnız "oran nereden geliyor".

```
Adım 0  → ÖLÇÜM (karar kapısı)          → Yol A ya da Yol B
Adım 1  → enBoyOrani yardımcısı          ← her iki yolda aynı   [TAMAM]
Adım 2  → VideoCercevesi bileşeni        ← her iki yolda aynı
Adım 3  → ORAN KAYNAĞI                   ← Yol A veya Yol B
Adım 4  → Pilot yüzey (tek ekran)        ← her iki yolda aynı
Adım 5  → Kalan 7 yüzey                  ← her iki yolda aynı
Adım 6  → Kapanış                        ← her iki yolda aynı
```

Her adım tek commit. Her commit öncesi üçlü doğrulama:
`npx tsc --noEmit` + `npm run denetim` + `npm run lint:mimari`.
Bir adımda iki deneme başarısız olursa DUR, üç cümleyle özetle, talimat bekle.
Canlı DB'ye yazan hiçbir komut Claude tarafından çalıştırılmaz.

---

## Adım 0 — Ölçüm: karar kapısı

**Soru:** Bunny'nin `thumbnail.jpg` dosyası videonun **gerçek oranında** mı
üretiliyor, yoksa sabit bir kutuya mı dolduruluyor?

Bu tek olgu, planın 6 adım mı 10 adım mı olacağını belirler. Mevcut videoların
hepsi 16:9 olduğu için onlarla ayırt edilemez — **16:9 olmayan tek bir örnek
gerekir.**

**İskender:** Test firmasında bir talebe dikey (telefonla çekilmiş) video yükler,
encode bitince video URL'ini verir.

**Claude:** Kapak adresini `thumbnailUrlUret()` ile üretip
([lib/video/thumbnail.ts](lib/video/thumbnail.ts)) dosyanın gerçek piksel
ölçüsünü okur, Bunny API'sinin bildirdiği `width`/`height` ile karşılaştırır.

| Sonuç | Karar |
|---|---|
| Kapak ölçüsü = video ölçüsü | **Yol A** — DB yok, SQL yok, webhook yok |
| Kapak 16:9'a doldurulmuş | **Yol B** — DB + webhook |

Test verisi işin sonunda temizlenir.

---

## Adım 1 — Oran yardımcısı ✅ TAMAM (commit `1ed62ae`)

**Dosya:** [lib/video/enBoyOrani.ts](lib/video/enBoyOrani.ts)

```ts
export const VARSAYILAN_ORAN = 16 / 9;
export const DIKEY_ESIGI = 0.98;
export function enBoyOrani(genislik?: number | null, yukseklik?: number | null): number;
export function dikeyMi(oran: number): boolean;
```

**Kararlar:**
- **Ham ölçü tutulur, yön değil.** `"portrait"` bilgisiyle `aspect-ratio`
  kurulamaz; elde sayı olmayınca zorunlu 9:16 varsayılır ve 3:4 ya da 4:5
  çekilmiş dikey video yine bantlanır.
- **Sıfır/negatif/NaN/Infinity guard'ı.** `genislik / 0` → `Infinity` →
  `aspectRatio: Infinity` → kutu sıfır yükseklikte çizilir, video görünmez olur.
  Sessiz ve teşhisi zor arıza; girdide kapatıldı.
- **`DIKEY_ESIGI = 0.98`.** 1080×1082 gibi encode sapması videoyu dikey
  saydırıp gereksiz yere tavana sokmasın.
- **Yedek zinciri 16/9.** Eksik/bozuk her girdi bugünkü görünüme düşer.

**Doğrulama:** tsc + denetim + lint:mimari temiz. Ayrıca 14 vaka fiilen koşuldu:

| Girdi | Oran | Sonuç |
|---|---|---|
| 1920×1080 · 1440×1080 · 1080×1080 | 1.7778 · 1.3333 · 1.0000 | tam genişlik |
| 1080×1082 (kare sapması) | 0.9982 | tam genişlik — eşik çalıştı |
| 1080×1920 · 1080×1440 · 1080×1350 | 0.5625 · 0.7500 · 0.8000 | tavan + ortala |
| null · 0 · negatif · NaN · Infinity · undefined | 1.7778 | 16:9 yedeği |

---

## Adım 2 — `VideoCercevesi` bileşeni

**Yeni dosya:** `components/video/VideoCercevesi.tsx`

**Kritik tasarım kararı — iframe'i bileşen SAHİPLENMEZ, `children` alır.**

Gerekçe: `components/izle/VideoOynatici.tsx` ve
`components/challenge-club/CcVideoOynatici.tsx` iframe'e `ref` bağlayıp
[lib/video/videoPlayer.ts](lib/video/videoPlayer.ts) üzerinden **playerjs** ile
konuşuyor (izleme takibi, ileri sarma denetimi, bitiş tespiti). Sarmalayıcı
iframe'i kendi üretirse o zincir kopar.

```tsx
interface Props {
  videoUrl?: string | null;   // Yol A'da kapak ölçümü için
  genislik?: number | null;   // Yol B'de DB'den
  yukseklik?: number | null;
  children: React.ReactNode;  // iframe — çağıran sahiplenir
}
```

**Yerleşim:**

```tsx
// Dış kap: ortalamayı garantiler (margin-inline tek başına yetmeyebilir)
<div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
  <div style={{
    aspectRatio: oran,
    width: dikey ? "auto" : "100%",          // dikeyde genişlik tavandan türer
    maxHeight: dikey ? "min(70vh, 560px)" : undefined,
    maxWidth: "100%",
    marginInline: dikey ? "auto" : undefined,
    overflow: "hidden",
  }}>
    {children}                                {/* iframe: %100 × %100, border yok */}
  </div>
</div>
```

**Davranış tablosu:**

| Video | Masaüstü | Mobil |
|---|---|---|
| Yatay (16:9, 4:3…) | Tam genişlik — **bugünkü görünümün aynısı** | Tam genişlik |
| Dikey (9:16, 3:4, 4:5…) | Kendi oranında, tavan `min(70vh,560px)`, **ortalanmış** | Tam genişlik |
| Kare (1:1) | Eşik üstünde → yatay muamelesi, sığar | Tam genişlik |
| Oran bilinmiyor | 16:9 | 16:9 |

Mobil ayrımı `maxHeight`'ı medya sorgusuyla kaldırarak yapılır — dar ekranda
dikey video zaten tam genişliğe oturur, tavan gereksiz kısıt olur.

**`aspect-ratio` tarayıcı desteği tartışması kapalı:** kod tabanı bu özelliği
zaten dört yerde kullanıyor (`VideoBolumu.tsx:53`, `UttAnaSayfa.tsx:94`,
`YayindakiVideoBolumu.tsx:59`, `oneriler/page.tsx:499`). Yeni bağımlılık değil.

---

## Adım 3 — Oran kaynağı (**yol burada ayrılır**)

### Yol A — Kapaktan ölçme *(Adım 0 "kapak oranlı" derse)*

DB yok, SQL yok, webhook yok, sunucuya dokunulmuyor.

`VideoCercevesi` içinde, ölçü verilmemişse kapağı yükleyip ölçer:

```ts
useEffect(() => {
  if (genislik && yukseklik) return;              // dışarıdan geldiyse ölçme
  const kapak = thumbnailUrlUret(videoUrl);       // lib/video/thumbnail.ts — MEVCUT
  if (!kapak) return;                             // Bunny dışı/eski URL → 16:9

  let aktif = true;
  const img = new Image();
  img.onload = () => {
    if (aktif && img.naturalWidth > 0 && img.naturalHeight > 0) {
      setOlculen({ g: img.naturalWidth, y: img.naturalHeight });
    }
  };
  img.src = kapak;                                // kart yüzeylerinde zaten önbellekte
  return () => { aktif = false; };
}, [videoUrl, genislik, yukseklik]);
```

**Neden `thumbnailUrlUret` ile:** video URL'i bir HTML embed sayfasıdır, `Image`
onu yükleyemez. Doğru adres
`https://{pull_zone}.b-cdn.net/{video_id}/thumbnail.jpg`; onu üreten yardımcı
repoda hazır.

**Bilinen ödün — tek seferlik yerleşim kayması:** İlk çizimde oran bilinmediği
için 16:9 kutu çizilir, kapak yüklenince dikey videoda kutu yeniden boyutlanır.
Kapak küçük ve kart ekranlarında zaten önbellekte olduğu için pratikte tek
karelik sıçrama. Rahatsız ederse **isteğe bağlı ek:** ölçüm sonrası tek bir
`PUT` ile ölçüler `videolar`'a yazılır; ikinci açılışta sıçrama olmaz. Bu ek
Yol A'yı Yol B'ye çevirmez — DB alanı **önbellek** olur, kaynak değil.

**Toplam plan: 6 adım.**

---

### Yol B — Bunny ölçüsü + webhook *(Adım 0 "kapak doldurulmuş" derse)*

**B-1 · DB kolonları — SQL İskender'de**
```sql
alter table videolar
  add column if not exists video_genislik  integer,
  add column if not exists video_yukseklik integer;
```

Ayrı `video_medya_metadata` tablosu **açılmaz:** bugünkü ihtiyaç iki tam sayı,
`videolar`'da 8 kolon var, ve ayrı tablo `v_yayin_detay`'ı okuyan **her** yola
bir join daha bindirir. Zengin metadata yol haritası çıktığı gün tablo açılır.

**B-2 · `lib/video/bunnyYukleme.ts`**
`BunnyVideoDurum` arayüzüne `genislik: number | null; yukseklik: number | null`
eklenir; `bunnyVideoDurumu()` yanıttan `video.width` / `video.height` okur.
**Yeni Bunny isteği yok** — bugün çekilip atılan alanlar (satır 124-126).

**B-3 · Yeni uç: `app/videolar/api/bunny-webhook/route.ts`**
- Bunny kütüphane ayarındaki webhook URL'i bu uca bağlanır.
- **İmza doğrulaması zorunlu** — dışarıdan çağrılan kamu ucu; doğrulamasız
  bırakılırsa herkes ölçü yazabilir.
- Encode bitiş olayında `videoGuid` → `videolar` satırı bulunur → ölçüler
  **yalnız boşsa** yazılır (idempotent).
- **`bunny-durum` GET'ine yazma eklenmez.** Saf kalır.
- Bilinen sınır: yerel geliştirmede webhook gelmez; o ortamda ölçüler boş kalır
  → 16:9 yedeği devreye girer, geliştirme engellenmez.

**B-4 · Görünüm — SQL İskender'de**
`v_yayin_detay` görünümüne iki kolon eklenir (`create or replace view`, mevcut
tanım korunarak). Tam metin, kolonlar canlıda oluştuktan sonra verilir.

**B-5 · Veri yolları**
`lib/video/anaSayfaVideolari.ts:50` · `lib/video/yayindakiVideolar.ts:36` ·
`app/izle/api/[yayin_id]/route.ts:27` · `lib/eczanem/gonderim.ts` (3 sorgu) ·
E-Club / Challenge Club yolları — select listelerine ve dönüş tiplerine iki alan.

**Sıra kilidi:** B-1 ve B-4 SQL'leri **koda dokunmadan önce** koşulur. Kolonlar
canlıda yokken select'e eklenirse `npm run denetim` şema uyuşmazlığı verir.

**Toplam plan: 10 adım.**

---

## Adım 4 — Pilot yüzey

Sekiz oynatıcı yüzeyi var; sarmalayıcının davranışı yanlışsa sekizi birden
bozulur. Önce **tek ekran** dönüştürülür.

**Pilot:** [components/izle/VideoOynatici.tsx:281](components/izle/VideoOynatici.tsx:281)
— UTT'nin ana izleme yolu, en yüksek trafik, playerjs entegrasyonunun en yoğun
olduğu yer. Burada çalışıyorsa her yerde çalışır.

`width="100%" height="400"` kalkar, iframe `VideoCercevesi` çocuğu olur.

**Bu adımda doğrulanacaklar:** (1) playerjs zinciri kopmadı mı — izleme takibi,
ileri sarma denetimi, bitiş tespiti; (2) yatay video görünümü değişmedi mi;
(3) dikey video masaüstünde ortalanıyor mu; (4) mobilde tam genişlik mi.

**Fiziksel test İskender'de. Onay gelmeden Adım 5'e geçilmez.**

---

## Adım 5 — Kalan yedi yüzey

**Tüketim (3):** Challenge Club (`CcVideoOynatici.tsx:416`) · Eczanem
(`EczanemVideoOynatici.tsx:188`) · E-Club (`EclubVideoOynatici.tsx:229`)

**Üretim hattı (4):** video detay (`[senaryo_durum_id]/page.tsx:485`) · talep
detay (`[talep_id]/page.tsx:394`) · onaylanan talepler (`page.tsx:179`) · yayın
önizleme modalı (`Modallar.tsx:23`)

**Talep detayın özel durumu:** Video oradan `talepler.hazir_video_url` ile
geliyor, `videolar` satırından değil. Yol A'da sorun yok — kapak adresi doğrudan
video URL'inden türer. Yol B'de ölçü, hazır videonun `videolar` satırından
(`kaynak='hazir'`) okunur; o sayfa zaten `bunny-durum` ucuna `talep_id` ile çağrı
atıyor, ölçü oradan taşınır.

---

## Adım 6 — Kapanış

1. Üçlü doğrulama son kez.
2. Önce/sonra kanıtı: sekiz yüzeyin eski ve yeni ölçü davranışı.
3. Adım 0'da yüklenen test videosu temizlenir.
4. Fiziksel test İskender'de: dikey + yatay video × masaüstü + mobil.

---

## 4. Kararlar ve gerekçeleri

| Karar | Gerekçe | Kaynak |
|---|---|---|
| **Kart/kapak alanları 16:9 KALIR** | Kartlar ızgarada yan yana; oranlı kapak satırları tırtıklar. Dikey kapak `object-cover` ile kırpılır. | Üç AI hemfikir |
| Ham ölçü tutulur, yön değil | `"portrait"` ile `aspect-ratio` kurulamaz; 3:4 video 9:16 varsayılırsa yine bantlanır | Claude · ChatGPT Alt-3 reddi |
| Ayrı metadata tablosu açılmaz | İki tam sayı için join maliyeti; zengin metadata yol haritası yok | ChatGPT Alt-2 reddi |
| GET'e yan etki konmaz | Webhook doğru katman; yoksa "yalnız boşsa yaz" kuralı kesin | ChatGPT Alt-1 |
| Yedek zinciri hep 16:9 | Eski kayıt, Bunny dışı URL, ölçüsüz veri — dördü de bugünkü görünüme düşer | Claude |
| Pilot yüzey | 8 yüzeyi birden bozmamak için | ChatGPT |
| `0`/`null` guard + eşik payı | `Infinity` sessiz arızası; kare video sapması | ChatGPT |
| Parent'ta `justify-content: center` | `margin-inline: auto` garantisi | ChatGPT |
| İframe `children` olarak alınır | playerjs zinciri kopmasın | Claude (repo kanıtı) |
| Kapaktan ölçme (Yol A) | DB/SQL/webhook'u tamamen gereksiz kılabilir | DeepSeek |

**Reddedilenler:**
- **Container query ile oran tespiti** — container query kapsayıcının ölçüsünü
  sorgular, içeriğin değil; ayrıca cross-origin iframe içeriği CSS'e hiçbir
  koşulda sızmaz. Çalışmaz.
- **Cross-origin JS ile iframe içi ölçüm** — aynı sebep. Mümkün değil.
- **postMessage ile Bunny'den ölçü** — Bunny'nin gönderdiği doğrulanmadı;
  gerekirse `VideoPlayer` sözleşmesine eklenir, bileşene ham dinleyici konmaz.
- **Ayrı metadata tablosu · yalnız yön tutma** — yukarıda gerekçeli.

---

## 5. Yatay işin bozulmama garantisi

| Durum | Sonuç |
|---|---|
| Mevcut videolar (ölçü boş) | `enBoyOrani` → 16/9 → **bugünkü görünümün aynısı** |
| Yeni yüklenen yatay video | Ölçü 16:9 çıkar → **görünüm değişmez** |
| Bunny dışı / eski URL | Kapak adresi üretilemez / guid çözülemez → 16/9 |
| Bunny `width`/`height` döndürmezse | `null` → 16/9 |

Dört yolun da varsayılanı 16/9. Davranış değişikliği yalnızca ölçüsü gerçekten
dikey olan videoda tetiklenir.

---

## 6. Kapsam dışı

Yükleme akışı (TUS, vezne, Bunny kaydı) · video döndürme/yeniden kodlama ·
Reels tarzı tam ekran dikey akış · kart/kapak alanları · toast ve durum
mesajları · eski videoların geriye dönük doldurulması (Yol B'de isteğe bağlı,
varsayılan yapılmaz).

---

## 7. Riskler

| # | Risk | Karşılık |
|---|---|---|
| R1 | Yol B'de kolonlar canlıda açılmadan koda select eklenirse denetim patlar | SQL adımları kod adımlarından önce koşulur |
| R2 | Sarmalayıcı playerjs zincirini kırar | İframe `children` olarak alınır; pilot yüzeyde önce doğrulanır |
| R3 | Yol A'da ilk çizimde yerleşim kayması | Kapak küçük ve önbellekli; rahatsız ederse ölçü `videolar`'a önbelleklenir |
| R4 | Dikey video masaüstünde sayfayı uzatır | `maxHeight: min(70vh, 560px)` tavanı |
| R5 | Bunny thumbnail'ı 16:9'a doldurursa | Adım 0 bunu ölçer; Yol B'ye geçilir |
