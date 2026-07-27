# Pill Envanteri — Adım 1 (27.07.2026)

Pill birleştirme işinin tarama çıktısı. **Bu adımda hiçbir dosya değiştirilmedi**;
belge yalnızca mevcut durumu kaydeder. Kararlar Adım 2'de İskender tarafından verilir.

**Kapsam:** `app/` ve `components/` altındaki tüm `.tsx` dosyaları. `components/Navbar.tsx`
kapsam dışı (İskender kararı — ama bkz. Bulgu P-9).

**Yöntem:** `rounded-full` geçen her satır tarandı; avatar, spinner, ilerleme çubuğu,
anahtar (toggle), radyo düğmesi ve durum noktası gibi pill olmayan yuvarlaklar ayıklandı.

---

## Özet

| Ölçüm | Sayı |
|---|---|
| Toplam `rounded-full` eşleşmesi | 155 |
| Pill olmayan yuvarlak (avatar/spinner/çubuk/anahtar/nokta) | 37 |
| **Pill (etiket + buton)** | **118** |
| **Farklı ölçü imzası** | **32** |
| Pill satırlarında geçen farklı hex renk | 38 (+ Tailwind sınıf renkleri) |
| Ayrı bileşen olarak yazılmış pill | **3** (`HedefRolBant`, `UretimVaryantiRozet`, `TeknikPill`) |
| Satır içi (elle) yazılmış pill | **115** |

Yani pill'lerin **%97'si elle yazılmış**. "Pill'ler ayrı dosyada tutuluyor" varsayımı
yalnızca 3 tanesi için geçerli.

---

## A. Ölçü envanteri — 32 imza

İmza biçimi: `tip | yazı boyu | kalınlık | dolgu | kenar | satır yüksekliği`

| Adet | Tip | Yazı | Kalınlık | Dolgu | Kenar | Satır yük. |
|---:|---|---|---|---|---|---|
| 23 | etiket | 10px | 400 | px-2 py-0.5 | yok | — |
| 11 | etiket | 10px | 400 | px-2.5 py-1 | yok | — |
| 10 | etiket | 10px | 400 | px-2 py-0.5 | var | — |
| 10 | etiket | 10px | bold | px-2 py-0.5 | yok | — |
| 6 | etiket | 10px | 400 | px-3 py-1 | var | — |
| 5 | etiket | (satır içi) | 400 | (satır içi) | yok | — |
| 5 | etiket | 10px | 400 | px-1.5 py-0.5 | yok | — |
| 4 | **buton** | xs | 400 | px-3 py-1 | var | — |
| 4 | etiket | 10px | 400 | px-2.5 py-0.5 | yok | — |
| 4 | etiket | 10px | 400 | px-2 py-0.5 | yok | tight |
| 4 | etiket | 10px | bold | px-1.5 py-0.5 | yok | — |
| 3 | etiket | xs | 400 | px-3 py-1 | var | — |
| 3 | etiket | 10px | 400 | px-2.5 py-0.5 | yok | snug |
| 3 | etiket | (satır içi) | 400 | py-1 | var | — |
| 3 | **buton** | (satır içi) | 400 | (satır içi) | yok | — |
| 3 | etiket | 10px | bold | px-2 py-0.5 | var | tight |
| 2 | etiket | (satır içi) | bold | px-2 py-0.5 | var | — |
| 1 | etiket | xs | 400 | px-2 py-0.5 | yok | — |
| 1 | **buton** | 10px | 400 | px-4 py-1.5 | var | — |
| 1 | etiket | 10px | semibold | px-1.5 py-0.5 | yok | — |
| 1 | etiket | 10px | medium | px-3 py-1 | var | — |
| 1 | etiket | xs | semibold | px-2 py-0.5 | yok | — |
| 1 | etiket | 10px | 400 | px-3 py-0.5 | yok | — |
| 1 | etiket | xs | 400 | px-2 py-1 | var | — |
| 1 | **buton** | xs | 400 | px-4 py-1.5 | var | — |
| 1 | etiket | (satır içi) | bold | px-1.5 py-0.5 | yok | — |
| 1 | **buton** | (satır içi) | 400 | px-2.5 py-1 | yok | — |
| 1 | etiket | 10px | semibold | px-2 py-0.5 | var | — |
| 1 | **buton** | xs | semibold | px-4 py-1.5 | var | — |
| 1 | etiket | 10px | bold | px-2 py-0.5 | yok | tight |
| 1 | etiket | 10px | bold | px-2 py-0.5 | var | — |
| 1 | etiket | 10px | medium | px-2.5 py-1 | var | — |

**Eksen bazında dağılım:**
- Yazı boyu: `10px`, `xs` (12px), satır içi `fontSize: 10` — 3 yol
- Kalınlık: 400 / medium / semibold / bold — 4 değer
- Yatay dolgu: 1.5 / 2 / 2.5 / 3 / 4 birim — 5 değer
- Dikey dolgu: 0 / 0.5 / 1 / 1.5 birim — 4 değer
- Kenar: yok / `border` (1px) / satır içi `0.5px solid` — 3 yol
- Satır yüksekliği: miras / tight / snug / satır içi `1.05` — 4 yol

---

## B. Renk envanteri

Pill satırlarında **38 farklı hex** geçiyor; ayrıca Tailwind sınıfları (`bg-blue-50`,
`bg-green-50`, `bg-red-50`, `bg-gray-100`) doğrudan kullanılıyor. Renk üç ayrı yoldan geliyor:

1. **Tek kaynaktan** — `HEDEF_ROL_TASARIM` (`app/talepler/_types`), `mesaj.ts` durum sözlüğü
2. **Dosya içi yerel harita** — `asamaRenk()`, `durumRenk()` gibi bileşen içi fonksiyonlar
3. **Satır içi sabit** — doğrudan JSX'e yazılmış hex

En yaygın renkler: `#f0fdf4` (10 yer), `#56aeff` (8), `#1d4ed8` / `#eff6ff` (7),
`#bc2d0d` (7), `#e5e7eb` (6), `#bfdbfe` (5).

---

## C. Metin envanteri

Pill içeriği iki kaynaktan gelir:

**Tek kaynaktan (iyi):** durum metinleri `mesaj.ts` sözlüğünden, hedef rol kısa etiketi
`HEDEF_ROL_TASARIM.kisaEtiket`'ten, teknik adı veriden.

**Elle yazılmış (dağınık):** `"Hazır Video"`, `"Hazır Soru Seti"`, `"Video"`, `"Soru"`,
`"İzlendi"`, `"Yeni"`, `"senin"`, `"İleri sarma açık"`, `"Filtreyi Kaldır"` (3 dosyada
birebir tekrar), boş-durum örnek satırındaki `"UTT"` / `"Senaryo"` / `"Sizden Onay Bekleniyor"`.

**Biçim kuralı yok:** Aynı satırda dört ayrı yazım düzeni bir arada bulunabiliyor —
tek kelime (`Video`), büyük kısaltma (`UTT`), başlık düzeni (`Soru Seti`), tam cümle
(`Sizden Onay Bekleniyor`).

---

## D. Bulgular

Biçim: `P-## | kanıt | önem | öneri`

- **P-1 | Aynı satırda dört farklı yükseklik.** Yayın Listesi'nde yan yana duran dört pill
  farklı ölçüde: varyant (dolgu 0, satır yük. 1.05), hedef rol (py-0.5, 1px kenar),
  aşama (py-0.5, kenarsız), durum (py-0.5, 0.5px kenar, tight). Kabaca 11.5 / 21 / 19 / 17.5 px.
  Kanıt: `UretimVaryantiRozet.tsx:41`, `HedefRolBant.tsx:32`, `UreticiAnaSayfa.tsx:283-284`.
  **KRİTİK** | Tek ölçü ilkesine bağla.

- **P-2 | Aynı pill mobilde ve masaüstünde farklı.** Aşama pill'i mobilde `px-1.5`,
  masaüstünde `px-2`. Kanıt: `UreticiAnaSayfa.tsx:242` ve `:283`. Aynı fark
  `IuAnaSayfa.tsx:148` / `:186`'da da var. **KRİTİK** | Kopyala-yapıştır kaynaklı; merkez çözer.

- **P-3 | "Video" iki ayrı pill türü.** Üretim varyantı olarak `Video` (`#dbeafe` zemin) ve
  üretim aşaması olarak `Video` (`#eff6ff` zemin). Aynı kelime, iki kutu, bazen aynı satırda.
  **KRİTİK** | Adım 2'de adlandırma kararı gerekiyor.

- **P-4 | Aynı renk iki anlam.** `#eff6ff` + `#1d4ed8` hem "Video aşaması" hem
  "inceleme bekleniyor" durumu için kullanılıyor. Kanıt: `UreticiAnaSayfa.tsx:82`
  (aşama haritası) ve `videolar/[senaryo_durum_id]/page.tsx:250`,
  `senaryolar/[talep_id]/page.tsx:290`, `soru-setleri/[video_durum_id]/page.tsx:271`.
  **ORTA** | Renk-anlam eşlemesi Adım 2'de kararlaştırılmalı.

- **P-5 | Aşama renk haritası iki dosyada kopyalanmış.** `asamaRenk()` hem
  `UreticiAnaSayfa.tsx:80` hem `IuAnaSayfa.tsx:42`'de tanımlı. **ORTA** | Tek yere taşı.

- **P-6 | Aynı kavram iki farklı metin + iki farklı pill.** Talep detayında
  `"Hazır Video"` / `"Hazır Soru Seti"` (`talepler/[talep_id]/page.tsx:230,235`),
  listelerde aynı bilgi `"Video"` / `"Soru"` (`UretimVaryantiRozet`). **ORTA** | Metin kararı Adım 2.

- **P-7 | Boş-durum örnek satırı pill'i üçüncü kez kopyalıyor.** `UreticiAnaSayfa.tsx:131-133`
  (masaüstü) ve `:148-150` (mobil) — gri örnek satır için pill biçimi yeniden yazılmış.
  **NOT** | Merkez bunu tek bileşenle çözer.

- **P-8 | Buton pill'leri etiket pill'leriyle karışmış.** 118 pill'in ~11'i tıklanabilir
  (periyot seçici, "Filtreyi Kaldır", filtre sekmeleri) ama etiketlerle aynı görsel dili
  kullanıyor. **ORTA** | Merkezde etiket/buton ayrımı yapılmalı.

- **P-9 | Navbar kapsam dışı ama referans.** `UretimVaryantiRozet.tsx:8` yorumunda
  "navbar pill çizgisi referans" yazıyor. **KARARA BAĞLANDI (İskender, 27.07):** Navbar
  kapsam dışı; merkez yapılandırıldıktan SONRA ayrı iş olarak ele alınacak. Yani merkez
  navbar'a göre değil, kendi tutarlılığına göre kurulur; navbar sonradan ona uyarlanır.

- **P-10 | "Filtreyi Kaldır" üç dosyada birebir kopya.** `BmAnaSayfa.tsx:151`,
  `IuAnaSayfa.tsx:115`, `UreticiAnaSayfa.tsx:208`. **NOT** | Merkeze taşınacak.

---

## E. Adım 2'ye taşınan kararlar

1. Standart ölçü ne olacak? (yazı boyu, kalınlık, dolgu, kenar kalınlığı, satır yüksekliği)
2. Kaç boy olacak? (tek boy mu, yoksa "küçük/normal" gibi iki boy mu)
3. `Video` çakışması nasıl çözülür — varyant mı yoksa aşama mı yeniden adlandırılır?
4. Renk-anlam eşlemesi: hangi renk hangi kavrama ait? (`#eff6ff` çakışması dahil)
5. `"Hazır Video"` mı `"Video"` mü — tek metin hangisi?
6. Buton pill'leri etiketlerden görsel olarak ayrılacak mı?
7. ~~Navbar kapsama alınsın mı?~~ **KARAR: Hayır** — merkez kurulduktan sonra ayrı iş (27.07).
