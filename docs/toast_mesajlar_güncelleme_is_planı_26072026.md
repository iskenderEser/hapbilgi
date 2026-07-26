# Toast Mesajları Güncelleme İş Planı — 26.07.2026

**Karar sahibi:** İskender.
**Durum:** Onay bekliyor. Hiçbir dosya değiştirilmedi.
**Amaç:** Üretim hattının toast metinlerini tek merkeze taşımak. Sayfalar metin
tutmaz; olayı + varyantı + rolü verir, cümleyi merkezden alır.

---

## 1. Bugünkü durum (kod kanıtlı)

**Altyapı** — `components/HataMesaji.tsx`: `useHataMesaji()` her sayfada yerel bir
`mesajlar` dizisi tutar; `basari()/hata()/uyari()/bilgi()` diziye kayıt ekler;
`<HataMesajiContainer>` sağ üstte (`top:24px right:24px`) listeler; her mesaj
kendi `useEffect` sayacıyla 12000 ms sonra silinir. Global sağlayıcı yoktur.
**Bu plan altyapıya dokunmaz.**

**Metin envanteri** — üretim hattının akış cümleleri 5 dosyada satır içi string:

| # | Dosya:satır | Bugünkü metin |
|---|---|---|
| M1 | `app/senaryolar/[talep_id]/page.tsx:238` | `Senaryo {Unvan} onayına gönderildi.` (yedek: `Senaryo onaya gönderildi.`) |
| M2 | `app/senaryolar/[talep_id]/page.tsx:258` | `Senaryo onaylandı.` / `Revizyon talebi gönderildi.` / `Senaryo iptal edildi.` |
| M3 | `app/videolar/[senaryo_durum_id]/page.tsx:195` | `Video yüklendi, {Unvan} onayına gönderildi.` |
| M4 | `app/videolar/[senaryo_durum_id]/page.tsx:214` | `Video onaylandı.` / `Revizyon talebi gönderildi.` / `Video iptal edildi.` |
| M5 | `app/soru-setleri/[video_durum_id]/page.tsx:213` | `Soru seti {Unvan} onayına gönderildi.` |
| M6 | `app/soru-setleri/[video_durum_id]/page.tsx:238` | `Soru seti onaylandı.` / `Revizyon talebi gönderildi.` / `Soru seti iptal edildi.` |
| M7 | `app/talepler/_hooks/useTalepFormu.ts:596` | `Talep başarıyla oluşturuldu.` |
| M8 | `app/talepler/[talep_id]/page.tsx:160` | `basari(d2.mesaj ?? "Video gönderildi.")` |
| M9 | `app/talepler/api/hazir-video/route.ts:82` | `Video gönderildi; hazır soru seti otomatik işlendi ve onaylandı.` / `Video gönderildi. Soru seti içerik üreticisine yönlendirildi.` |

**Üç yapısal eksik:**
1. Sözlük yok — durum rozetlerinin `lib/utils/durum/mesaj.ts` tek kaynağı var, toast'ların yok.
2. Varyant körü — hiçbir toast `hazir_video`/`hazir_soru_seti` okumuyor.
3. Sunucu metin üretiyor (M9) — cümle iki katmana bölünmüş.

**İki eksik sinyal** (yeni bağlantı noktaları, §4 Adım 2'de çözülür):
- **Revize ayrımı.** Ne İÜ teslimi ne üretici onayı "bu tur revizyon muydu"yu
  biliyor. Senaryo ve video sayfalarında durum sorgusu `.limit(1)` ile yalnız
  son durumu çekiyor; geçmiş yok. Soru seti sayfasında geçmiş zaten çekiliyor
  (`fetchSoruSetleri` tüm durum satırlarını `.in(...)` ile alıyor).
- **Varyant.** Üç detay sayfası da künyeyi `/talepler/api/kunye` ucundan çekip
  `talep: TalepBilgisi` state'inde tutuyor; `hazir_video`, `hazir_soru_seti` ve
  `uretici_rol_adi` alanları **zaten mevcut**. Yeni sorgu gerekmez.

---

## 2. Onaylanmış mesaj tablosu (kodun kaynağı)

| Varyant | Üretici aksiyonu | Üreticiye mesaj | İçerik üreticisine mesaj | İÇ.Ü. aksiyonu |
|---|---|---|---|---|
| Hazır Video yok, Hazır soru seti yok | Talebi açtı | Senaryo talebiniz içerik üreticinize iletildi |  |  |
|  |  |  | Senaryoyu {Rol} onayına ilettiniz | Senaryoyu yazıp gönderdi |
|  | Senaryoyu onayladı | Senaryoyu onayladınız, içerik üreticinize video talebiniz iletildi |  |  |
|  | Senaryo için revizyon istedi | Senaryo için revizyon talebiniz içerik üreticisine iletildi |  |  |
|  |  |  | Revize senaryoyu {Rol} onayına ilettiniz | Revize senaryo yazdı |
|  | revize senaryo onaylandı | Revize senaryoyu onayladınız, içerik üreticinize video talebiniz iletildi |  |  |
|  | Senaryo talebini iptal etti | Senaryo talebinizi iptal ettiniz |  |  |
|  |  |  | Videoyu {Rol} onayına ilettiniz | Videoyu yükleyip gönderdi |
|  | Videoyu onayladı | Videoyu onayladınız, soru seti talebiniz içerik üreticisine iletildi |  |  |
|  | Video için revizyon istedi | Video için revizyon talebiniz içerik üreticisine iletildi |  |  |
|  |  |  | Revize videoyu {Rol} onayına ilettiniz | Revize video yükledi |
|  | revize video onaylandı | Revize videoyu onayladınız, soru seti talebiniz içerik üreticisine iletildi |  |  |
|  | Video talebini iptal etti | Video talebinizi iptal ettiniz |  |  |
|  |  |  | Soru setini {Rol} onayına ilettiniz | Soru setini yazıp gönderdi |
|  | Soru setini onayladı | Soru setini onayladınız, yayın yönetimi sayfasına gidiniz |  |  |
|  | Soru seti için revizyon istedi | Soru seti için revizyon talebiniz içerik üreticisine iletildi |  |  |
|  |  |  | Revize soru setini {Rol} onayına ilettiniz | Revize soru seti yazdı |
|  | revize soru seti onaylandı | Revize soru setini onayladınız, yayın yönetimi sayfasına gidiniz |  |  |
|  | Soru seti talebini iptal etti | Soru seti talebinizi iptal ettiniz |  |  |
|  | Videoyu yayına aldı |  |  |  |
| Hazır Video var, Hazır soru seti yok | Talebi videoyla birlikte gönderdi | Soru seti talebiniz içerik üreticinize iletildi |  |  |
|  |  |  | Soru setini {Rol} onayına ilettiniz | Soru setini yazıp gönderdi |
|  | Soru setini onayladı | Soru setini onayladınız, yayın yönetimi sayfasına gidiniz |  |  |
|  | Soru seti için revizyon istedi | Soru seti için revizyon talebiniz içerik üreticisine iletildi |  |  |
|  |  |  | Revize soru setini {Rol} onayına ilettiniz | Revize soru seti yazdı |
|  | revize soru seti onaylandı | Revize soru setini onayladınız, yayın yönetimi sayfasına gidiniz |  |  |
|  | Soru seti talebini iptal etti | Soru seti talebinizi iptal ettiniz |  |  |
|  | Videoyu yayına aldı |  |  |  |
| Hazır Video yok, Hazır soru seti var | Talebi açtı | Senaryo talebiniz içerik üreticinize iletildi |  |  |
|  |  |  | Senaryoyu {Rol} onayına ilettiniz | Senaryoyu yazıp gönderdi |
|  | Senaryoyu onayladı | Senaryoyu onayladınız, içerik üreticinize video talebiniz iletildi |  |  |
|  | Senaryo için revizyon istedi | Senaryo için revizyon talebiniz içerik üreticisine iletildi |  |  |
|  |  |  | Revize senaryoyu {Rol} onayına ilettiniz | Revize senaryo yazdı |
|  | revize senaryo onaylandı | Revize senaryoyu onayladınız, içerik üreticinize video talebiniz iletildi |  |  |
|  | Senaryo talebini iptal etti | Senaryo talebinizi iptal ettiniz |  |  |
|  |  |  | Videoyu {Rol} onayına ilettiniz | Videoyu yükleyip gönderdi |
|  | Videoyu onayladı | Videoyu onayladınız, yayın yönetimi sayfasına gidiniz |  |  |
|  | Video için revizyon istedi | Video için revizyon talebiniz içerik üreticisine iletildi |  |  |
|  |  |  | Revize videoyu {Rol} onayına ilettiniz | Revize video yükledi |
|  | revize video onaylandı | Revize videoyu onayladınız, yayın yönetimi sayfasına gidiniz |  |  |
|  | Video talebini iptal etti | Video talebinizi iptal ettiniz |  |  |
|  | Videoyu yayına aldı |  |  |  |
| Hazır Video var, Hazır soru seti var | Talebi videoyla ve soru setiyle birlikte gönderdi | Yayın yönetimi sayfasına gidiniz |  |  |
|  | Videoyu yayına aldı |  |  |  |

`{Rol}` = `talep.uretici_rol_adi` (`ROL_ADLARI[rol]` — Ürün Müdürü, Eğitim Müdürü,
Medikal Müdür…). Metinler tablodan **birebir** kodlanır; "içerik üreticinize" /
"içerik üreticisine" farkı tabloda olduğu gibi korunur, düzeltilmez.

---

## 3. Hedef modülün teknik tasarımı

**Yeni dosya:** `lib/uretim/toastMesaj.ts` (istemci-güvenli, saf fonksiyon; DB
erişimi, import zinciri yok).

```ts
export type ToastVaryant = "normal" | "hazir_video" | "hazir_set" | "hazir_ikisi";
export type ToastAsama   = "senaryo" | "video" | "soru_seti";

export type ToastOlay =
  | { rol: "uretici"; olay: "talep_gonderildi" }
  | { rol: "uretici"; olay: "onay";     asama: ToastAsama; revize: boolean }
  | { rol: "uretici"; olay: "revizyon"; asama: ToastAsama }
  | { rol: "uretici"; olay: "iptal";    asama: ToastAsama }
  | { rol: "iu";      olay: "teslim";   asama: ToastAsama; revize: boolean };

export interface ToastBaglam {
  varyant: ToastVaryant;
  rolAdi?: string | null;   // talep.uretici_rol_adi
}

export function toastVaryant(hazirVideo?: boolean | null,
                             hazirSoruSeti?: boolean | null): ToastVaryant;

export function uretimToast(olay: ToastOlay, baglam: ToastBaglam): string;
```

**İç sözlükler (tablodan birebir):**

```ts
// Aşamanın yalın ve iyelikli adları — cümle kurucular buradan okur.
const ASAMA_AD: Record<ToastAsama, { belirtme: string; talep: string; ad: string }> = {
  senaryo:   { belirtme: "Senaryoyu",   talep: "Senaryo",   ad: "senaryo" },
  video:     { belirtme: "Videoyu",     talep: "Video",     ad: "video" },
  soru_seti: { belirtme: "Soru setini", talep: "Soru seti", ad: "soru seti" },
};

// 1) Talep gönderimi — yalnız varyanttan çözülür.
const TALEP_GONDERILDI: Record<ToastVaryant, string> = {
  normal:      "Senaryo talebiniz içerik üreticinize iletildi",
  hazir_set:   "Senaryo talebiniz içerik üreticinize iletildi",
  hazir_video: "Soru seti talebiniz içerik üreticinize iletildi",
  hazir_ikisi: "Yayın yönetimi sayfasına gidiniz",
};

// 2) Onay mesajının İKİNCİ yarısı — hangi iş doğdu, kimde.
//    Kural: onaylanan aşamadan sonra İÜ'ye düşen bir aşama var mı?
const ONAY_DEVAMI = (asama, varyant) =>
  asama === "senaryo"   ? "içerik üreticinize video talebiniz iletildi"
: asama === "video"     ? (varyant === "hazir_set"
                            ? "yayın yönetimi sayfasına gidiniz"
                            : "soru seti talebiniz içerik üreticisine iletildi")
                        : "yayın yönetimi sayfasına gidiniz";
```

**Cümle kuralları:**

| Olay | Kalıp | Varyanta duyarlı mı |
|---|---|---|
| `uretici / talep_gonderildi` | `TALEP_GONDERILDI[varyant]` | **Evet** (4 metin) |
| `uretici / onay` | `{Revize }{Belirtme} onayladınız, {ONAY_DEVAMI}` | **Evet** (yalnız `video` aşamasında) |
| `uretici / revizyon` | `{Talep} için revizyon talebiniz içerik üreticisine iletildi` | Hayır |
| `uretici / iptal` | `{Talep} talebinizi iptal ettiniz` | Hayır |
| `iu / teslim` | `{Revize }{Belirtme} {Rol} onayına ilettiniz` | Hayır |

- `revize=true` → cümle "Revize " ile başlar ve devamındaki aşama adı küçük
  harfe iner (`Revize senaryoyu`, `Revize videoyu`, `Revize soru setini`).
- `rolAdi` boşsa `iu/teslim` yedeği: `{Belirtme} onaya ilettiniz`.
- Tabloda mesajı olmayan hücre (yayına alma) modüle **hiç girmez** — fonksiyon
  çağrılmaz.

**Neden `lib/uretim/` altında:** üretim sürecinin kural yeri orası
(`lib/uretim/surec.ts`, `lib/uretim/parametreKontrol.ts`). Toast metni de sürecin
kuralıdır; ekranın değil.

---

## 4. Adım adım plan

Her adım **tek commit**. Her commit öncesi üçlü doğrulama:
`npx tsc --noEmit` → `npm run denetim` → `npm run lint:mimari`.
Bir adımda **iki deneme** başarısız olursa DUR, üç cümleyle özetle, talimat bekle.
Hiçbir adımda canlı DB'ye yazan komut çalıştırılmaz.

---

### Adım 1 — Sözlük modülü

**Dosya:** `lib/uretim/toastMesaj.ts` (yeni, ~90 satır)

**Yapılacaklar:**
1. §3'teki tipler, sözlükler ve `uretimToast` yazılır.
2. `toastVaryant(hazirVideo, hazirSoruSeti)` dört kombinasyonu döndürür;
   `undefined/null` → `false` sayılır.
3. `switch (olay.olay)` tam kapsayıcı olur (`never` kontrolü ile), yeni olay
   eklendiğinde tsc uyarır.
4. Dosya başına, `durum/mesaj.ts`'teki gibi, kararın gerekçesi yazılır: mesajın
   iki yarısı, aşama kapatmayan aksiyonlarda birinci yarının olmayışı, sıradaki
   iş aynı kişideyse yönlendirmeye dönmesi.

**Dokunulmayan:** hiçbir mevcut dosya. Bu adım sonunda uygulama davranışı
**değişmez** (modül henüz çağrılmıyor).

**Doğrulama:** tsc + denetim + lint:mimari.

---

### Adım 2 — Revize sinyalinin kurulması

Metin bağlanmadan önce eksik sinyal tamamlanır. **Bu adımda hiçbir toast metni
değişmez** — yalnız sayfalar "bu tur revizyon muydu"yu bilir hale gelir.

**2a. `app/senaryolar/[talep_id]/page.tsx`**
- `veriCek` içindeki per-senaryo durum sorgusu (satır ~106-112) bugün
  `.order(desc).limit(1)` ile yalnız son durumu alıyor. `.limit(1)` kaldırılır;
  dönen listeden hem `son_durum` (ilk kayıt) hem
  `revizyon_sayisi = durumlar.filter(d => d.durum === "revizyon bekleniyor").length`
  türetilir. `Senaryo` arayüzüne `revizyon_sayisi: number` eklenir.
- Ek sorgu **yok** — var olan sorgunun `limit`i kalkıyor.

**2b. `app/videolar/[senaryo_durum_id]/page.tsx`**
- Aynısı: per-video `video_durumu` sorgusundan (satır ~113-118) `.limit(1)`
  kaldırılır, `revizyon_sayisi` türetilir, `Video` arayüzüne eklenir.
- Mevcut `revizyonSayisi` türetmesi (satır 147) bugün "son durumu revizyon olan
  satır sayısı"nı sayıyor; bu, İÜ yeniden teslim edince sıfırlanır. Ekrandaki
  "Revizyon: n / 2" sayacı da bundan besleniyor — yeni alan doğru sayıyı verdiği
  için o sayaç da düzelir.

**2c. `app/soru-setleri/[video_durum_id]/page.tsx`**
- `fetchSoruSetleri` zaten tüm durum satırlarını çekiyor (`.in(...)`, desc).
  `durumMap` yalnız ilkini saklıyor; yanına set başına revizyon sayacı biriktirilir.
  **Yeni sorgu yok.**

**Türetilen iki bayrak (üç sayfada aynı isim):**
```ts
// İÜ teslimi: bu gönderim bir revizyon turu mu?
const teslimRevize = sonKayit?.son_durum === "revizyon bekleniyor";
// Üretici onayı: onaylanan iş daha önce revizyona düşmüş mü?
const onayRevize = (sonKayit?.revizyon_sayisi ?? 0) > 0;
```

**Dikkat:** iki bayrak da ilgili `handle...` fonksiyonunun **başında** okunur.
`basari()` çağrısı `veriCek()`'ten önce çalışıyor ama state güncellenmiş olabilir;
değer handler girişinde yerel değişkene alınır.

**Doğrulama:** tsc + denetim + lint:mimari. Ekranda görünür değişiklik yalnız
video sayfasındaki revizyon sayacının doğrulanması.

---

### Adım 3 — Senaryo sayfası bağlanır

**Dosya:** `app/senaryolar/[talep_id]/page.tsx`

1. Import: `import { uretimToast, toastVaryant } from "@/lib/uretim/toastMesaj";`
2. Türetme (bileşen gövdesinde, `talep` state'inin yanında):
   ```ts
   const varyant = toastVaryant(talep?.hazir_video, talep?.hazir_soru_seti);
   ```
3. **M1** (satır 238, `handleSenaryoGonder` sonu) — mevcut üçlü koşullu metin
   silinir:
   ```ts
   basari(uretimToast(
     { rol: "iu", olay: "teslim", asama: "senaryo", revize: teslimRevize },
     { varyant, rolAdi: talep?.uretici_rol_adi },
   ));
   ```
   Üstündeki "unvan ek almasın diye … kalıbı" yorumu modüle taşınır.
4. **M2** (satır 258, `handlePMKarar`) — üçlü koşul kaldırılır, durum kodundan
   olaya çevrilir:
   ```ts
   const olay: ToastOlay =
     durum === "onaylandi"           ? { rol: "uretici", olay: "onay", asama: "senaryo", revize: onayRevize }
   : durum === "revizyon bekleniyor" ? { rol: "uretici", olay: "revizyon", asama: "senaryo" }
   :                                   { rol: "uretici", olay: "iptal", asama: "senaryo" };
   basari(uretimToast(olay, { varyant, rolAdi: talep?.uretici_rol_adi }));
   ```

**Sonuç metinleri (normal ve hazır-set varyantı, ikisinde de aynı):**
"Senaryoyu {Rol} onayına ilettiniz" · "Revize senaryoyu {Rol} onayına ilettiniz" ·
"Senaryoyu onayladınız, içerik üreticinize video talebiniz iletildi" ·
"Revize senaryoyu onayladınız, …" · "Senaryo için revizyon talebiniz içerik
üreticisine iletildi" · "Senaryo talebinizi iptal ettiniz".

**Doğrulama:** tsc + denetim + lint:mimari + `grep -n 'basari("' app/senaryolar/` → boş.

---

### Adım 4 — Video sayfası bağlanır

**Dosya:** `app/videolar/[senaryo_durum_id]/page.tsx`

Adım 3'ün birebir aynısı, `asama: "video"`:
- **M3** (satır 195, `handleIuGonder`) → `{ rol: "iu", olay: "teslim", asama: "video", revize: teslimRevize }`
- **M4** (satır 214, `handlePMKarar`) → onay / revizyon / iptal

**Bu sayfada varyant kritik:** `hazir_set` varyantında video onayı mesajının
ikinci yarısı `"yayın yönetimi sayfasına gidiniz"` olmalı, `"soru seti talebiniz…"`
değil. `ONAY_DEVAMI` bunu tek yerden çözüyor; sayfada koşul yazılmaz.

**Doğrulama:** tsc + denetim + lint:mimari + `grep -n 'basari("' app/videolar/` → boş.

---

### Adım 5 — Soru seti sayfası bağlanır

**Dosya:** `app/soru-setleri/[video_durum_id]/page.tsx`

- **M5** (satır 213, `handleIuGonder`) → `{ rol: "iu", olay: "teslim", asama: "soru_seti", revize: teslimRevize }`
- **M6** (satır 238, `handlePMKarar`) → onay / revizyon / iptal

Onay mesajı her varyantta `"…yayın yönetimi sayfasına gidiniz"` ile biter.
`uyari()` ile basılan içe-aktarma uyarısı (satır 172) **dokunulmaz** — akış
mesajı değil, biçim uyarısıdır.

**Doğrulama:** tsc + denetim + lint:mimari + `grep -n 'basari("' app/soru-setleri/` → boş.

---

### Adım 6 — Talep açılışı ve hazır video bağlanır

**6a. `app/talepler/_hooks/useTalepFormu.ts:596`**
```ts
basari(uretimToast({ rol: "uretici", olay: "talep_gonderildi" },
                   { varyant: toastVaryant(hazirVideo, hazirSoruSeti) }));
```
`hazirVideo` / `hazirSoruSeti` hook'un kendi state'i (satır 78-79) — ek veri yok.
Kısmi başarısızlık dalındaki kalıcı `uyari()` (satır 598, F-01/3) **korunur**:
o bir hata raporu, akış mesajı değil.

**6b. `app/talepler/[talep_id]/page.tsx:160`** — `basari(d2.mesaj ?? …)` kalkar:
```ts
basari(uretimToast({ rol: "uretici", olay: "talep_gonderildi" },
                   { varyant: toastVaryant(talep?.hazir_video, talep?.hazir_soru_seti) }));
```
Bu uç yarım kalan/reddedilen yüklemenin telafisidir; zincir orada kurulduğu için
mesaj açılıştakiyle aynıdır.

**6c. `app/talepler/api/hazir-video/route.ts:81-84`** — yanıttan `mesaj` alanı
çıkarılır; `video_id` ve `soru_seti_islendi` kalır. Önce
`grep -rn "hazir-video" app | grep -n "mesaj"` ile başka tüketici olmadığı teyit
edilir; varsa o çağıran da merkeze bağlanır.

**Doğrulama:** tsc + denetim + lint:mimari.

---

### Adım 7 — Mimari bekçi

**7a. `tools/eslint-rules/index.mjs`** — yeni kural `toast-tek-kaynak`:
- Kapsam: `app/senaryolar/**`, `app/videolar/**`, `app/soru-setleri/**`,
  `app/talepler/**`.
- İhlal: `basari(...)` çağrısının ilk argümanı `Literal` (string) ya da
  `TemplateLiteral` ise uyarı — "Toast metni `lib/uretim/toastMesaj` modülünden
  gelmelidir."
- `hata()` ve `uyari()` kapsam dışı (teknik metinler merkezde değil).

**7b. `eslint.config.mjs`** — `rules` bloğuna `"hapbilgi-mimari/toast-tek-kaynak": "warn"`.

**7c.** `toastMesaj.ts`'teki `ToastAsama` ile `lib/utils/durum/mesaj.ts`'teki
`Asama` tekilleştirilebilir mi bakılır (biri `"Senaryo"`, diğeri `"senaryo"`).
Tekilleştirme yapılamıyorsa gerekçe iki dosyaya da yorum olarak yazılır.

**Doğrulama:** `npm run lint:mimari` → yeni kural ihlal üretmemeli (Adım 3-6
metinleri söktüğü için).

---

### Adım 8 — Kapanış

1. Üçlü doğrulama son kez.
2. `grep -rn 'basari("' app/senaryolar app/videolar app/soru-setleri app/talepler`
   → boş çıktı (kanıt bu belgeye eklenir).
3. Bu belgeye "önce → sonra" tablosu eklenir: M1-M9'un her biri hangi cümleye
   dönüştü.
4. Fiziksel test İskender'de: dört varyantta birer mutlu yol + bir revizyon turu.

---

## 5. Kapsam dışı

- **Toast altyapısı** — konum, 12 sn süre, kuyruk sınırı, tekrar engeli, `adim`/
  `detay` alanlarının kullanıcıya gösterilmesi. Hepsi olduğu gibi kalır.
- **`hata()` metinleri** — teknik hata cümleleri, tabloda yok, dokunulmaz.
- **Yayın yönetimi** (`app/yayin-yonetimi/**`) — yayına alma/durdurma toast'ları
  bu planın dışında, olduğu gibi kalır.
- **Diğer modüller** — store, e-club, eczanem, admin, profil, öneriler,
  challenge-club sayfalarının toast'ları.
- **Bildirimler** (`bildirimOlustur`) — toast değil, ayrı kanal; metinleri
  değişmez.
- **Durum rozetleri** (`lib/utils/durum/mesaj.ts`) — ayrı sözlük, ayrı yüzey.

---

## 6. Riskler ve dikkat noktaları

| # | Risk | Karşılık |
|---|---|---|
| R1 | Revize bayrağının yanlış hesaplanması (asıl yeni bağlantı noktası) | Adım 2 ayrı commit; sinyal kurulmadan metin bağlanmaz |
| R2 | `.limit(1)` kaldırılınca durum listesi büyür | Kayıt başına durum satırı sayısı tek haneli (revizyon tavanı 2); sorgu zaten per-kayıt |
| R3 | `hazir-video` ucundan `mesaj` alanını başka tüketen olması | Adım 6c'de grep ile teyit, varsa o da bağlanır |
| R4 | Metnin tablodan sapması | Sözlük tablodan birebir kopyalanır; Adım 8'de önce/sonra tablosu ile karşılaştırılır |
| R5 | İleride metnin tekrar sayfalara dağılması | Adım 7 lint bekçisi |

---

## 7. Uygulama sonucu — TAMAMLANDI (26.07.2026)

Sekiz adım da uygulandı. Her adım tek commit, her commit öncesi üçlü doğrulama
(`tsc --noEmit` + `npm run denetim` + `npm run lint:mimari`) temiz.

### Önce → sonra

| # | Önce | Sonra |
|---|---|---|
| M1 | `Senaryo {Unvan} onayına gönderildi.` | `Senaryoyu {Unvan} onayına ilettiniz` |
| M2 | `Senaryo onaylandı.` | `Senaryoyu onayladınız, içerik üreticinize video talebiniz iletildi` |
| M2 | `Revizyon talebi gönderildi.` | `Senaryo için revizyon talebiniz içerik üreticisine iletildi` |
| M2 | `Senaryo iptal edildi.` | `Senaryo talebinizi iptal ettiniz` |
| M3 | `Video yüklendi, {Unvan} onayına gönderildi.` | `Videoyu {Unvan} onayına ilettiniz` |
| M4 | `Video onaylandı.` | `Videoyu onayladınız, soru seti talebiniz içerik üreticisine iletildi` (hazır set varyantında: `…yayın yönetimi sayfasına gidiniz`) |
| M4 | `Revizyon talebi gönderildi.` | `Video için revizyon talebiniz içerik üreticisine iletildi` |
| M4 | `Video iptal edildi.` | `Video talebinizi iptal ettiniz` |
| M5 | `Soru seti {Unvan} onayına gönderildi.` | `Soru setini {Unvan} onayına ilettiniz` |
| M6 | `Soru seti onaylandı.` | `Soru setini onayladınız, yayın yönetimi sayfasına gidiniz` |
| M6 | `Revizyon talebi gönderildi.` | `Soru seti için revizyon talebiniz içerik üreticisine iletildi` |
| M6 | `Soru seti iptal edildi.` | `Soru seti talebinizi iptal ettiniz` |
| M7 | `Talep başarıyla oluşturuldu.` | Varyanta göre 3 ayrı cümle (normal/hazır set → senaryo, hazır video → soru seti, ikisi hazır → yayın yönlendirmesi) |
| M8 | sunucudan gelen `d2.mesaj` | merkezden çözülen talep gönderimi metni |
| M9 | uçta üretilen iki cümle | **silindi** — uç yalnız olgu döndürüyor |

Revizyon turunda üretici ve İÜ cümleleri "Revize " ile başlar (12 yeni cümle).

### Doğrulama kanıtı

Sözlük dört varyantta çalıştırıldı; üretilen 40 cümlenin tamamı §2'deki
onaylı tabloyla **birebir** aynı. Örnekler (varyant farkının göründüğü satırlar):

```
normal      | Videoyu onayladınız, soru seti talebiniz içerik üreticisine iletildi
hazir_set   | Videoyu onayladınız, yayın yönetimi sayfasına gidiniz
normal      | Senaryo talebiniz içerik üreticinize iletildi
hazir_video | Soru seti talebiniz içerik üreticinize iletildi
hazir_ikisi | Yayın yönetimi sayfasına gidiniz
```

Üretim hattında gömülü akış metni kalmadı; bekçi temiz. Muaf tutulan üç toast
(ek dosya silme, ürün ekleme, teknik ekleme) akış mesajı değil, gerekçeli
`eslint-disable` ile işaretli.

### Yan düzeltme (planda öngörülmemişti, Adım 2'de çıktı)

Video ve soru seti ekranlarındaki **"Revizyon: n / 2" sayacı bozuktu**: satır
sayarak çalışıyordu, oysa revizyon yeni satır doğurmuyor (aynı satıra UPDATE).
İÜ yeniden teslim edince sayaç sıfırlanıyordu. Artık durum geçmişinden okunuyor.

### Adım 7c — tekilleştirme kararı

`toastMesaj.ts`'teki `ToastAsama` ile `durum/mesaj.ts`'teki `Asama`
**birleştirilmedi**: ikincisinde anahtar aynı zamanda ekrana çıkan etiket,
birincisinde cümle parçası üreten kod. Birleştirme rozet sözlüğünün anahtarını
değiştirmeyi gerektirirdi — kapsam dışı. Gerekçe iki dosyaya da yazıldı.

### Yapılmayan

**Fiziksel test yapılmadı.** Tüm doğrulama tsc + denetim + lint:mimari + sözlük
çıktısı düzeyinde. Ekranlar giriş arkasında olduğu için tarayıcıda görülmedi.
Dört varyantta birer mutlu yol + bir revizyon turu İskender'de.
