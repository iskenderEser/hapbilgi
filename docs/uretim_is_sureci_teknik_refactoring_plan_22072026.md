# Üretim İş Süreci Teknik Refactoring Planı — 22.07.2026

**Karar sahibi:** İskender.
**Kapsam:** Üretim ekseni — talep → (senaryo) → video → soru seti → yayın — ve bunun dört varyantı. Tüketim tarafı (T-Club, C-Club, E-Club, Eczanem), yayın/puanlama ve Bunny yükleme kapsam dışıdır.
**Veri temsili kararı:** Yol 2 (her iş ürünü talebe bağlı, birinci sınıf; kaynağını taşır).

Bu belge, 22.07 ilk refactoring planının **kod + DB ile doğrulanmış ve düzeltilmiş** halidir. İlk planın çekirdek sezgisi ("tek hat, çoklu giriş") doğrudur; kök neden teşhisi ve kapsamı düzeltilmiştir (§2).

---

## 1. Kavramsal model — tek süreç, iki seçim, dört varyant

Ortada iki ayrı "hat" yoktur. **Tek bir üretim süreci** vardır; süreç, üretici rolün talebi açarken yaptığı **iki seçime** göre dört varyanta ayrılır. "Hazır" ayrı bir kol değil, aynı hatta bazı aşamaların baştan dolu (onaylı) gelmesidir. Bu iki seçim veride zaten var: `talepler.hazir_video`, `talepler.hazir_soru_seti`.

| | Video yok | Video hazır |
|---|---|---|
| **Soru seti yok** | İU: senaryo → video → soru seti | İU: yalnız soru seti |
| **Soru seti hazır** | İU: senaryo → video | İU'ya iş yok — üretici doğrudan yayına |

Her aşamanın (senaryo, video, soru seti) iki hali vardır: **İU yapacak** (bekliyor) ya da **hazır geldi** (baştan onaylı). Senaryonun hazır varyantı **yoktur** — senaryo her zaman İU üretir (iş modeli gereği; bir gün değişirse o gün eklenir).

---

## 2. Doğrulanmış kök neden (kanıtlı)

İlk plan, 22.07 arızasını "hazır kol `iu_id=null` hayalet satırlar üretiyor, RLS onları gizliyor" diye açıkladı. **Bu yanlıştır.** Kod + DB doğrulaması:

- `lib/hazirVideoSoruSeti/zincir.ts` üç tabloya da `iu_id: null` yazıyor (senaryo, video, soru seti).
- Ama şema anlık görüntüsü (`scripts/denetim/sema.json`, canlı DB'den 21.07): `senaryolar.iu_id`, `videolar.iu_id`, `soru_setleri.iu_id` üçü de **NOT NULL**.
- Salt-okuma sayım sorgusu (İskender koştu, 22.07): üç tabloda da `iu_id IS NULL` satır sayısı **sıfır**.

**Sonuç:** Hazır zincir daha ilk INSERT'te (senaryo, `iu_id=null`) NOT NULL ihlaliyle patlıyor; `hazir-video/route.ts` URL'i geri alıp PM'e hata dönüyor. **Hiç satır doğmuyor** — hayalet satır yok, RLS'in gizlediği bir şey yok. İU işi görememesinin nedeni okuma-filtresi değil, yazımın hiç tutmaması.

Bu düzeltme önemlidir: refactoring, yanlış katmana (okuma/RLS) değil, doğru soruna (veri modelinin hazır aşamayı dürüstçe ifade edememesi) yönelir.

**Yapısal tespitler (doğrulandı, geçerli):**
- **İki kopya kural.** "Onay → sonraki iş doğar → bildirim" kuralı `videolar/api/durum/route.ts` (≈121-151) ve `hazirVideoSoruSeti/zincir.ts` (≈130-163) içinde iki kez, farklı semantikle yazılı.
- **Sahte senaryo.** Hazır kol, veri modeli "video senaryosuz olamaz" dediği için `"[Hazır Video — Senaryo Atlandı]"` metinli sahte senaryo üretiyor (`zincir.ts` ≈54-63).
- **`iu_id` yükü.** Video/soru seti aşama açılışında `iu_id=PM` (yer tutucu) yazılıyor; İU teslim edince `iu_id=İU` üzerine yazıyor. Kimlik-sahiplik-yer tutucu tek alanda eziliyor (kalite raporu B-39 ile de doğrulandı).
- **Üç ayrı görünürlük mekanizması.** Talepler (elle süzgeç, service-role), PM listeleri (`v_yayin_detay` görünümü), İU soru setleri (istemci `!inner` zinciri).

---

## 3. Hedef veri modeli (Yol 2)

İlke: her iş ürünü (senaryo/video/soru seti) **talebe doğrudan bağlı, kendi ayakları üstünde** durur; kaynağını taşır. Durum geçmişi mevcut append-only `*_durumu` tablolarında kalır (korunur).

| Tablo | Eklenen / değişen alan | Anlam |
|---|---|---|
| `videolar` | **+`talep_id`** (FK talepler) | Video artık senaryoya değil, talebe bağlı |
| | **+`kaynak`** ('iu' / 'hazir', default 'iu') | İU mü üretti, hazır mı geldi — dürüst bilgi |
| | `senaryo_durum_id` → **nullable** | Yalnız İU-senaryosundan gelen videoda dolu; hazırda boş |
| | `iu_id` → **nullable** | "Videoyu üreten İU"; hazırda ve teslim öncesi boş |
| `soru_setleri` | **+`talep_id`** (FK talepler) | Set artık videoya değil, talebe bağlı |
| | **+`kaynak`** ('iu' / 'hazir', default 'iu') | Aynı |
| | `video_durum_id` → **nullable** | İlişkilendirme bilgisi; zorunlu bağ değil |
| | `iu_id` → **nullable** | "Seti yazan İU"; hazırda ve yazım öncesi boş |
| `senaryolar` | **değişmez** | Zaten `iu_id`=İU; hazır varyantı yok, `kaynak` gerekmez |

**Aşama açılış deseni (tekilleştirilir):** Bir aşama İU'ya açıldığında **boş kabuk** satır oluşur: `kaynak='iu'`, `iu_id=null` (sahibi henüz yok — bkz. §5 sahiplik borcu), durumsuz (=bekliyor). İU teslim edince içerik + `iu_id=İU` + durum yazılır. Hazır girişte kabuk `kaynak='hazir'`, içerik dolu, durum `onaylandi`, `iu_id=null` doğar. Böylece `iu_id`'ye asla yanlış (PM) kimlik yazılmaz — NOT NULL kırığının gerçek çözümü budur.

**Görünümler (SQL → İskender):** `v_yayin_detay` zincir yerine `ürün.talep_id → talepler.uretici_id` ile sadeleşir; `v_soru_seti_son_durum` (yalnız durum) korunur.

---

## 4. Süreç modülü — `lib/uretim/surec.ts` (yeni)

Tek kural yeri. Barındırır: aşama açma, durum geçişinde sıradaki işi doğurma, bildirim tetikleme, hazır girişler, parametre kilidi (`parametreKontrol` buraya taşınır). Ekranlar ve API uçları kuralı hep buradan çağırır; içine "hazırsa atla" serpiştirilmez. (Tek modül ≠ tek dosyada akan süreç; `page.tsx` dosyaları şişirilmez.)

Modül, talebin iki seçimini okuyup varyantı kurar:

| Varyant (video, set) | Modülün kurduğu |
|---|---|
| yok, yok | Senaryo aşaması İU'ya açılır → onay → video → onay → set |
| hazır, yok | Video `kaynak='hazir'` onaylı doğar; **set aşaması İU'ya hemen açılır** |
| yok, hazır | Senaryo → video İU'da; set `kaynak='hazir'` onaylı doğar |
| hazır, hazır | İkisi de onaylı doğar; üretici doğrudan yayına |

---

## 5. Kararlar

- **c1 — Görünürlük: RLS (tek hukuk).** "Kim neyi görür" kuralları veritabanında (RLS) tanımlanır; rol + kapsam + sahiplikten türer. Üretim tablolarına (senaryolar/videolar/soru_setleri + durum tabloları) politikalar yazılır (SQL → İskender). Okumalar İU'nun **kendi oturumuna** taşınır; `talepler`'deki elle süzgeç ve PM listelerindeki service-role okumaları kalkar. Yazma işlemleri (durum geçişi, çok tablolu kayıt, bildirim) sunucu API'sinde service-role'da kalır.
- **c2 — `kaynak` alanı yalnız `videolar` + `soru_setleri`'nde.** Senaryo dokunulmaz (tek varyant — gerçek asimetri, keyfi istisna değil). Senaryo RLS politikası `kaynak` koşulu taşımaz ("tüm bekleyen senaryo işi İU'nundur").
- **Sahiplik — geliştirme borcu (bu turda havuz).** Mimari "bu bekleyen işin sahibi kim?" sorusunu prospektif olarak **sormaz**; kabuk `iu_id=null` doğar, tüm aktif İU'lara görünür (havuz, ilk üstlenen yapar). "Sorumlu İU" alanı + tam atama makinesi (firma-İU eşlemesi, kuyruk, devir) bu planın **dışında**, ayrı bir geliştirme turunda karara bağlanacak. (Hafıza: `isin-sahibi-gelistirme-borcu`.)

---

## 6. Kapsam dışı (net sınır)

- **Atama/sahiplik makinesi** — geliştirme borcu, ayrı tur.
- **Tüketim tarafı** (`app/izle/*`), **yayın/puanlama** (`app/yayin-yonetimi/*`), **Bunny yükleme** (`app/videolar/api/bunny-*`), **admin export** — süreci okur, kuralını yazmaz; dokunulmaz.

---

## 7. Etkilenecek dosyalar (kararlarla değişkenlik olabilir)

**Yeni:**
- `lib/uretim/surec.ts` — tek süreç modülü.

**Silinecek / taşınacak:**
- `lib/hazirVideoSoruSeti/zincir.ts` — silinir.
- `lib/hazirVideoSoruSeti/parametreKontrol.ts` — mantık `surec.ts`'e taşınır, klasör boşalır.

**Çekirdek (değişecek):**
- `app/talepler/api/route.ts` — talep açılışı + hazır girişlerin modüle bağlanması; elle görünürlük süzgeci RLS'e devredilir.
- `app/talepler/api/hazir-video/route.ts` — modülün hazır video girişini çağırır.
- `app/senaryolar/api/durum/route.ts`, `app/videolar/api/durum/route.ts`, `app/soru-setleri/api/durum/route.ts` — kopya kural kodları sökülür, modüle bağlanır.
- `app/senaryolar/api/route.ts`, `app/videolar/api/route.ts`, `app/soru-setleri/api/route.ts` — teslimde `iu_id=İU` + `kaynak` yönetimi; RLS'e uyum.
- `app/soru-setleri/page.tsx` — istemci `!inner` zinciri yerine RLS'e uygun okuma.

**Dokunulabilir (karara bağlı):**
- `app/senaryolar/page.tsx`, `app/videolar/page.tsx` — İU listeleri, RLS'e uyum.
- `lib/utils/anaSayfa/iu.ts`, `lib/utils/anaSayfa/uretici.ts` — rozet/sayaç, tek kaynaktan.
- `lib/utils/talepZinciri.ts` — `talep_id` ile sadeleşir.
- Detay sayfaları (`app/.../[id]/page.tsx`) — zincir şekli değişince ufak uyum.

---

## 8. Adım adım plan

Her adım: 1 commit; tsc + `npm run denetim` + `npm run lint:mimari` temiz; ≤1 duman testi (1 mutlu + 1 red); DB yazımı (veri + şema + politika) SQL → İskender, Claude canlıya yazmaz; adım öncesi yapılacaklar listelenir + onay alınır; push yok.

**Adım 1 — Veri temeli (eklemeli, davranış değişmez).**
DB (SQL → İskender): §3 kolon eklemeleri (nullable), `kaynak` default 'iu', mevcut satırlara `talep_id` backfill (zinciri yürüyerek) + `kaynak='iu'`. RLS politikalarının SQL'i bu adımda değil, **Adım 4'ün hemen öncesinde** hazırlanır (okuma modeli Adım 2–3'te oturur). Kod değişmez.
Doğrulama: denetim (sema.json yenilenir) + tsc. Çıktı: yeni temel canlı; normal akış etkilenmez.

**Adım 2 — Süreç modülü + normal hat.**
`lib/uretim/surec.ts` yazılır. `senaryolar/api/durum` ve `videolar/api/durum` içindeki kopya "onayda otomatik satır + bildirim" mantığı sökülüp modüle bağlanır; kabuklar artık `talep_id`+`kaynak='iu'`+`iu_id=null`. Teslim uçları (`senaryolar/api` POST, `videolar/api` PUT, `soru-setleri/api` PUT) teslimde `iu_id=İU` yazar.
Doğrulama: normal hat senaryo→video→set uçtan uca (1 mutlu + 1 red). Çıktı: normal hat yeni modelde; `iu_id` yükü çözüldü.

**Adım 3 — Hazır kol tek hatta katılır; ayrı modül sökülür.**
`talepler/api/hazir-video` ve talep açılışı modülün hazır girişlerini çağırır (sahte senaryo yok). `lib/hazirVideoSoruSeti/zincir.ts` silinir; `parametreKontrol` modüle taşınır.
Doğrulama: hazır video (varyant 2) uçtan uca — İU seti görür ve yazar (1 mutlu + 1 red parametre). Çıktı: **hazır akış onarılır**; ayrı modül ve sahte senaryo gider.
*Geçiş notu (bkz. hafıza `gecis-durumu-kontrolu`): Adım 1'de `iu_id` nullable olunca eski hazır modül "sahte senaryolu ama çalışır" ara hale gelebilir; bu yüzden hazır video Adım 3'e kadar denenmez, Adım 3 hem kodu değiştirir hem varsa ara-satırları temizler (temizlik SQL → İskender).*

**Adım 4 — Görünürlük RLS'e iner (tek hukuk).**
RLS politikaları devreye alınır (Adım 4 öncesinde hazırlanan SQL → İskender); okumalar İU'nun kendi oturumuna taşınır; `talepler/api` elle süzgeci ve PM listelerindeki service-role okumaları kalkar; İU soru setleri sayfası RLS'e uygun okur.
Doğrulama: dört varyant doğru listede, doğru rolde (1 mutlu + 1 red). Çıktı: tek görünürlük hukuku; zincir/istemci kırılganlığı biter.

**Adım 5 — Eski zincir bağımlılıkları sökülür (temizlik).**
`talepZinciri.ts` yardımcıları `talep_id` ile sadeleşir; zincire dayalı kalan okuma/görünüm kalıntıları kalkar; ölü kod temizlenir.
Doğrulama: üçlü temiz + normal/hazır duman. Çıktı: zincir tesisatı gider.

**Adım 6 — Test verisi temizliği + fiziksel test.**
Temizlik SQL → İskender. İskender uçtan uca: dört varyant + revizyon + red senaryoları.
Çıktı: temiz zemin; İskender onayı.

---

## 9. Çalışma disiplini

- Her adım öncesi yapılacaklar madde madde + İskender onayı; bir adım = bir commit; push yok.
- Üçlü doğrulama (tsc + denetim + lint:mimari) temiz geçmeden adım kapanmaz; adım başına ≤1 duman testi (1 mutlu + 1 red). Rol matrisi taraması yok (fiziksel testte).
- DB'ye yazan her şey (veri + şema + politika) SQL olarak İskender'e verilir; Claude canlı DB'ye yazmaz.
- Uçtan uca doğrulama İskender'in fiziksel testlerindedir; test tespitleri talimattır, kapsamları onaysız daraltılamaz.
- İskender'in emri ve tespitleri birebir uygulanır; üzerine Claude'un kendi yöntemi (risk-azaltma refleksi dahil) eklenemez — sapma gerekliyse önce açıkça yazılır ve sorulur.

---

## 10. Uygulama günlüğü

Her adım tamamlandıkça yapılanlar ve yaşanan sorunlar buraya işlenir.

- **23.07 — Hazır soru seti varyantı fiziksel test (başarıyla geçildi) + PM giriş formu sadeleştirmesi (PM=İU).** Hazır soru seti varyantı (video İU'dan, set üreticiden) ilk kez uçtan uca fiziksel test edildi ve geçti. İki iş çıktı:
  - **Giriş anı gözden geçirildi — KOD DEĞİŞMEDİ (bilinçli karar).** Setin talep açılışında mı yoksa İU video onayından sonra mı girilmesi gerektiği tartışıldı. Öneri (sonraya öteleme) ele alındı ve reddedildi; mevcut tasarım korundu: set video/hazır video gibi **talep açılışında girilir**, video onayında otomatik işlenip onaylanır ([`surec.ts hazirSoruSetiGir`](lib/uretim/surec.ts), [`videolar/api/durum`](app/videolar/api/durum/route.ts) onay dalı). Gerekçe: "hazır" tanımı gereği set eldedir; sonraya öteleme (a) "hazır" kavramıyla çelişir, (b) üreticiyi aynı iş için iki kez oturtur, (c) bugün yalnız İU'ya açık soru seti yazma ucunu üreticiye açmayı gerektirir, (d) onaylanmış videonun set girilmeden askıda kalması riskini doğurur. Üreticinin tek karar noktası video onayıdır; set o an otomatik biner.
  - **Yapıştır text alanı PM formundan kaldırıldı (PM=İU).** Belirti: PM hazır soru seti bloğunda hem eski "toplu yapıştır" textarea'sı hem yeni soru-seçenek tablosu görünüyordu. Neden: F-8/F-9 temizliği (bayat yapıştır alanını kaldır, yalnız dosya yükleme + tablo bırak) daha önce **yalnız İU soru sayfasına** uygulanmıştı (`yalnizDosya` bayrağı); PM bloğu eski panelde kalmış, kod içinde "PM yapıştırma yolunu şimdilik koruyor" notuyla ertelenmişti. Bu tur PM de İU ile aynı yapıldı: `SoruIceAktar` tek moda (dosya yükleme + tablo) indirildi — kullanılmayan yapıştır dalı + ilgili state + `parseSoruSetiEsnek` importu söküldü, gereksizleşen `yalnizDosya` bayrağı kaldırıldı (İU çağrısı da sadeleşti). `parseSoruSetiEsnek` kütüphanede kalır; dosya yükleme yolu ([`dosyadanGetir`](lib/soru/dosyadanGetir.ts)) kullanmaya devam eder. Dosyalar: [`components/SoruIceAktar.tsx`](components/SoruIceAktar.tsx), [`app/talepler/_components/HazirSoruSetiBlogu.tsx`](app/talepler/_components/HazirSoruSetiBlogu.tsx), [`app/soru-setleri/[video_durum_id]/page.tsx`](app/soru-setleri/[video_durum_id]/page.tsx). tsc/denetim/lint temiz; DB yazımı yok.
- **23.07 — Hata düzeltmesi (hazır video soru seti onaylandığı halde "Soru Seti" pill kızarık + badge takılı).** Belirti: hazır videonun soru seti onaylandığı halde üreticinin (PM) navbar "Soru Seti" pill'i normale dönmüyor, badge düşmüyordu. Beklenen: iş kapanınca ilgili bildirim okundu olur, pill normale döner, badge −1. **Kök neden:** [`lib/utils/bildirimOlustur.ts → gonderenTalepBildirimleriOkunduYap`](lib/utils/bildirimOlustur.ts) — onayda badge'i kapatmak için talebe bağlı tüm kayıt id'lerini toplayıp okundu yapar; ama video ve soru seti id'lerine **senaryo zinciriyle** ulaşıyordu (`senaryolar → senaryo_durumu → videolar[senaryo_durum_id] → video_durumu → soru_setleri[video_durum_id]`). Hazır videoda `senaryolar` boş → zincir ilk adımda kopuyor → `soru_seti_id` hiç toplanmıyor → `ilgili_idler=[talep_id]`. Bildirimin anahtarı `soru_seti_id` olduğundan eşleşmiyor, okundu yapılamıyor. (`talepBilgisiSoruSeti` Adım 5'te düzelmişti ama bu fonksiyon onu kullanmıyor, kendi zincirini yürütüyordu — kaçmıştı.) **Kanıt:** merve'nin okunmamış `soru_seti` bildirimi, `kayit_id=73f4930d…` (Laropen). **Çözüm:** video ve soru seti id'leri artık `talep_id` ile doğrudan toplanıyor (senaryo_durum/video_durum ara yürümesi kalktı; yayına `soru_seti_durum` üstünden ulaşılıyor). Normal kol davranışı aynı; hazırda id'ler artık toplanır → bundan sonraki onaylarda pill kendiliğinden düşer. **Eski takılı kayıt:** kod düzelmeden önce oluşan merve bildirimi kendiliğinden düşmez; tek seferlik `update bildirimler set goruldu_mu=true where kayit_turu='soru_seti' and kayit_id='73f4930d…'` (SQL → İskender koştu) ile temizlendi. tsc/denetim/lint temiz.
- **23.07 — Hazır video yayın + rapor görünürlük boşlukları kapatıldı (tüm sistem taraması).** İlk kez normal + hazır iki yayın birlikte canlıyken tarandı. Hazır videonun senaryosuz oluşu (`senaryo_durum_id=null`) senaryo-zincirli **her** okuma noktasında satırı düşürüyordu. Kapatılanlar:
  - **İçerik takibi (üretici ana sayfa) — `lib/utils/anaSayfa/uretici.ts`:** aşama senaryo zinciriyle hesaplanıyor, hazır talep "Senaryo Bekleniyor"da donuyordu. Hazır-farkında yapıldı: `hazir_video` ise senaryo atlanır, video `talep_id` ile bulunur → gerçek aşama (Video/Soru Seti/Yayın). Normal kol değişmedi. Kanıt: merve `4a632ab6` artık Soru Seti/İnceleme, `95e9b07c` Yayın.
  - **Yayın bekleyen bandı — `app/yayin-yonetimi/api/bekleyenler/route.ts` (Adım A):** talep senaryo zinciriyle çekiliyor → hazırda ürün adı/teknik/hedef/rozetler "-"/varsayılan geliyordu. Join `videolar → talepler` (talep_id) yapıldı. Kanıt: `7df96a1f` ürün adı "Laropen", 10 soru. NOT: bekleyen bandında "durum etiketi" tasarımca yok (Yayınla butonu) — bug değil.
  - **`v_yayin_detay` (Adım B, SQL → İskender canlıda koştu):** dağıtım + tüm tüketim bu view'dan okur; senaryo INNER JOIN hazırı tümden düşürüyordu → hazır video **yayınlanınca hem Yayında bandında hem tüm izleyicide KAYBOLUYORDU.** Talebe `v.talep_id` ile bağlandı, senaryo LEFT yapıldı. 28 tüketicinin hiçbiri senaryo kolonu okumadığından güvenli. Kanıt: iki yayın da v_yayin_detay'da sağlıklı — Laropen video_puani=40, soru_puani=3, 10 soru.
  - **3 rapor view'ı (SQL → İskender canlıda koştu):** `v_izleme_ozet`, `v_rapor_begeni_favori`, `v_rapor_urun_izlenme` aynı senaryo INNER JOIN'i taşıyordu → hazır videonun izleme/puan/beğeni/favori/ürün-izlenme verisi **raporlardan sessizce düşecekti** (puanlar `kazanilan_puanlar`'da durur, kaybolmaz; ama özet/rapor saymaz). Üçü de `v.talep_id`'ye bağlandı, kullanılmayan senaryo join'leri kaldırıldı. `v_cc_challenge_listesi` v_yayin_detay'dan okuduğu için kendiliğinden düzeldi; `v_senaryo_son_durum` senaryo-hakkında, doğru — dokunulmadı.
  - Kod: tsc/denetim/lint temiz. DB view'ları (4 adet) İskender canlıda koştu (Claude DB'ye girmedi). **Tüketim izleme/puanlama fiziksel testi ERTELENDİ** — izleme kasıtlı tamamlanmıyor; üretim gap'leri bitince tüketim tarafı (izleme/puanlama/rapor yansıması) ayrıca kontrol edilecek.
- **23.07 — Hata düzeltmesi (hazır video soru seti formu yanlış soru sayısı).** Fiziksel testte çıktı. **Belirti:** PM 10 soruluk hazır video talebi gönderdi; İU'nun soru seti yazım formu **25** (varsayılan) açıldı — üstelik ürün adı, teknik adı, video başı soru, hedef rol, üretici alanları da varsayılana düştü. **Kök neden:** `app/soru-setleri/[video_durum_id]/page.tsx` `fetchUrunBilgileri` talebi hâlâ `video_durumu → videolar → senaryo_durumu!inner → senaryolar!inner → talepler!inner` zinciriyle çekiyordu. Hazır video senaryosuz (`senaryo_durum_id=null`) olduğundan `!inner` join boş döner → erken `return` altındaki **6 setter'ın hiçbiri** çalışmaz → alanlar `useState` varsayılanında (soru sayısı **25**) kalır. Adım 5 sunucu tarafını (`talepZinciri.ts`) `talep_id`'ye çevirmişti ama bu **istemci detay sayfası** zincirde kalmıştı (Task 1 yalnız liste sayfasını düzeltmişti). **Çözüm:** sorgu `video_durumu → videolar!inner ( talepler!inner (…) )` yani `talep_id` yoluna çevrildi; `VideoDurumJoin` tipi + destructuring sadeleşti. Tek dosya, sunucuya dokunulmadı. **Kanıt:** yeni yol test kaydında (`video_durum 14fd4ac7`, `kaynak=hazir`, `senaryo_durum_id=null`) `soru_seti_buyuklugu=10` döndürdü; İskender formda 10 + etiketleri doğruladı. Sunucu (`soru-setleri/api` PUT/durum) zaten 10 bekliyordu — form uyunca form↔sunucu çelişkisi de kapandı. tsc/denetim/lint temiz. *(Bu turda Adım 4'ün Task 1 kodu `app/soru-setleri/page.tsx` de commit'lendi.)*
- **22.07 — Adım 5 yapıldı (eski zincir bağımlılıkları söküldü — temizlik).**
  - **`lib/utils/talepZinciri.ts`:** `talepBilgisiVideo` ve `talepBilgisiSoruSeti` artık `videolar.talep_id` / `soru_setleri.talep_id` ile talebe **tek hop**'ta ulaşır; eski zincir yürümeleri (video→senaryo_durumu→senaryolar→talep ve set→video_durumu→…→talep) kaldırıldı. **Yan fayda:** hazır videoda `senaryo_durum_id=null` olduğundan eski zincir `null` dönüyordu — artık düzeldi. Ortak `talepler` alan listesi + `haritalaTalep` ile üç giriş DRY'landı. Dönüş şekli (`TalepBilgisi`) değişmedi → 6 çağıran (durum uçları, `soru-setleri/api`, `yayin-yonetimi/api`, `bildirimOlustur`) etkilenmedi.
  - **`v_uretim_detay` koddan söküldü (3 uç):** `videolar/api` ve `soru-setleri/api` GET, üretici okumasını artık **oturumla** yapar (görünürlük RLS'te; elle `uretici_id`→`v_uretim_detay` süzgeci kalktı). `bunny-yukleme-baslat` ürün adını `talepBilgisiVideo`'dan alır.
  - **`talepler/api` GET:** elle `uretici_id` süzgeci RLS'e devredildi, okuma oturuma taşındı. İU'nun `hazir_video=false` **liste kuralı** (V1-5, İskender 21.07) iş kuralı olarak korundu — bu RLS/sahiplik değil, liste görünüm kuralıdır.
  - **DB (SQL → İskender):** kod artık `v_uretim_detay`'ı kullanmıyor; kalıntı görünümü düşürmek için `drop view if exists public.v_uretim_detay;` İskender'e verildi.
  - **Doğrulama:** tsc ✓, `npm run denetim` (kod↔DB tutarlı) ✓, `lint:mimari` ✓. Fiziksel/rol-bazlı test İskender'de; bozulursa bu commit revert edilir (gerekirse Adım 4 RLS `disable` ile birlikte).
- **22.07 — Adım 4 yapıldı (görünürlük RLS'e indi — tek hukuk).** Üretim ekseninin 7 tablosuna (`talepler`, `senaryolar`, `senaryo_durumu`, `videolar`, `video_durumu`, `soru_setleri`, `soru_seti_durumu`) satır düzeyi güvenlik (RLS) + `SELECT` politikası kuruldu.
  - **Politika modeli:** her tabloda tek politika `uretim_gorunurluk_select` (`for select to authenticated`). İU tüm üretim işini görür; üretici yalnız kendi talebini. İU kontrolü ayrı fonksiyon yerine **satır içi** `exists (select 1 from public.v_auth_kimlik where rol = 'iu')` ile yapıldı — `v_auth_kimlik` zaten `auth.uid()`'e daraltılı istemci görünümü, kaynak `rolCozucu` ile aynı (İskender kararı: SECURITY DEFINER fonksiyon istenmedi, sade satır içi seçildi).
  - **Sahiplik kökü:** `talepler.uretici_id = auth.uid()`. Alt tablolar talep sahipliğine bağlanır: `senaryolar`/`videolar`/`soru_setleri` doğrudan `talep_id` üstünden; `senaryo_durumu`/`video_durumu`/`soru_seti_durumu` parent→`talep` join'iyle (`senaryo_id`/`video_id`/`soru_seti_id` → ilgili tablo → `talepler.uretici_id`).
  - **Sınır (dokunulmayanlar):** yazımlar sunucu API'sinde `service_role`'da kaldı (RLS'i baypas eder — davranış değişmedi); tüketim `v_yayin_detay` görünümü üstünden okur (görünüm RLS'i baypas eder — kesilmedi); `anon` bu 7 tabloda tümüyle kapandı — B-10'daki anon içerik + soru seti (cevap dahil) sızıntısı da böylece kapanır.
  - **Uygulama (SQL → İskender; Claude canlıya yazmadı):** politika-önce / enable-sonra sırasıyla, her tablo için önce `create policy` sonra `enable row level security`, **tek tek 14 komut** koşuldu. Salt-okuma teşhis: 7/7 tabloda `rls_acik=true`, `politika_sayisi=1` doğrulandı.
  - **Kaza düzeltmesi:** önceki denemede politikasız `enable` koşulmuş → o roller için deny-all → İU/üretici ekranları boşalmış → `disable` ile geri alınmıştı (DB doğrulaması: RLS kapalı, 0 politika). Bu tur politika-önce doğru sırasıyla onarıldı; kök sorun eksik politikaydı, test değil.
  - **Kod (Task 1):** `app/soru-setleri/page.tsx` İU soru setleri listesi istemci `!inner` zinciri yerine `talep_id` ile okur (RLS'e uygun; hazır videodan doğan setler de düşmez), kullanılmayan `SoruSetiJoin` arayüzü kaldırıldı, ürün/teknik adı `talep_id` ile toplu çekilir; tsc/denetim/lint temiz. *(Bu kod değişikliği çalışma ağacında hazır; İskender kararıyla bu commit'e alınmadı — yalnız plan günlüğü commit edildi.)*
  - **Eksik/ertelenen (dürüst kayıt):** plan §8 Adım 4, RLS'in yanında `talepler/api` elle görünürlük süzgecinin ve PM listelerindeki `service_role` okumalarının kalkmasını da istiyordu — bu **kod temizliği henüz yapılmadı** (RLS katmanı üstte olduğundan işlev doğru; elle süzgeç artık gereksiz ama zararsız). Bu ile `v_uretim_detay`'ın kaldırılması Adım 5 (temizlik) turuna ertelendi (bu oturum kararı).
  - **Bekleyen:** fiziksel/rol-bazlı test İskender'de (İU hazır seti görür / üretici yalnız kendini / tüketim çalışır); bozulursa 7 tabloya `disable row level security` ile anında geri alınır.
- **22.07 — Adım 3 yapıldı (hazır kol tek hatta katıldı; ayrı modül söküldü).** `surec.ts`'e hazır girişler eklendi: `hazirVideoGir` (talebe doğrudan bağlı video, `kaynak='hazir'`, senaryosuz, otomatik onay) + `hazirSoruSetiGir` (`kaynak='hazir'`, otomatik onay) + `hazirVideoBul`. **Fake senaryo kaldırıldı.** `talepler/api/hazir-video` ve `videolar/api/durum` hazır dalı yeni fonksiyonlara bağlandı. `lib/hazirVideoSoruSeti/{zincir,parametreKontrol}.ts` silindi; parametre kilidi `lib/uretim/parametreKontrol.ts`'e taşındı. Hazır videoda (set yoksa) iş havuza düşer — tüm aktif İU'ya bildirim (sahiplik borcu, plan §5). Geçiş temizliği: sahte-senaryo sayısı 0 (temiz). tsc/denetim/lint temiz. **Not:** İU'nun listede görmesi + üretim uçlarının hazır videoyu görmesi Adım 4'e bağlı (görünürlük + `v_uretim_detay`'ın `talep_id`'ye çevrilmesi) — Adım 3 kaydı doğru kurar, tam görünür uçtan-uca Adım 4 sonrası.
- **22.07 — Adım 2 yapıldı (süreç modülü + normal hat).** `lib/uretim/surec.ts` kuruldu (tek kural yeri: onayda sıradaki kabuğu doğurma + bildirim). `senaryolar/api/durum` ve `videolar/api/durum` içindeki kopya "onayda otomatik satır + bildirim" mantığı söküldü, modüle bağlandı. Kabuklar artık `talep_id`+`kaynak='iu'`+`iu_id=null` doğuyor — PM yer tutucu sorunu bitti. Teslim uçları zaten `iu_id=İU` yazdığından değişmedi. Hazır dal (videolar/api/durum) Adım 3'e bırakıldı. tsc/denetim/lint temiz; DB yazımı yok.
- **22.07 — Adım 1 yapıldı (veri temeli).** `videolar` ve `soru_setleri`: +`talep_id` (FK talepler, nullable), +`kaynak` (default 'iu', CHECK 'iu'/'hazir'), `senaryo_durum_id`/`video_durum_id`/`iu_id` nullable yapıldı; mevcut satırlara `talep_id` backfill (doğrulama: her iki tabloda talep_null=0). Şema + backfill canlıda (SQL İskender koştu). denetim/tsc/lint temiz; kod değişmedi. RLS taslağı Adım 4 öncesine ertelendi (İskender kararı). Plan §8 Adım 1'den "v_yayin_detay yeniden" ifadesi çıkarıldı (ön-geliştirme ile üretim zaten ayrıldı).
- **22.07 — Ek ön-geliştirme: v_yayin_detay üretim/tüketim ayrımı.** Üretim refactoring'i Adım 3'te v_yayin_detay'a (yayın-kapılı, ~25 tüketicili merkezî görünüm) dokunmayı gerektiriyordu. Üretimi bu bağdan koparmak için üretime özel `v_uretim_detay` görünümü kuruldu (İskender kararı: seçenek b — talep/ürünlerden, yayına bağlı değil; üretici yayınlanmamış kayıtları da görür). 3 üretim ucu (videolar/api, soru-setleri/api, bunny-yukleme-baslat) v_yayin_detay yerine v_uretim_detay'a çevrildi. v_yayin_detay tüketim için olduğu gibi kaldı. Üçlü doğrulama temiz. Sonuç: üretim v_yayin_detay'dan bağımsız; Adım 3'teki v_yayin_detay değişikliği artık yalnız tüketim işi.
- **22.07 — Plan oluşturuldu.** İlk refactoring planı kod + DB ile doğrulandı; kök neden düzeltildi (hayalet satır değil, NOT NULL ihlali — §2). Veri temsili Yol 2, görünürlük RLS (c1), `kaynak` yalnız video+set (c2), sahiplik geliştirme borcu olarak ertelendi. İskender onayıyla bu belge yazıldı.
