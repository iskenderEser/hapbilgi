# Soru Seti İş Süreci İyileştirme ve Geliştirme İş Planı — İki Kol

*19.07.2026. Kaynak olay: IU, soruları başka yerde yazıp yapıştırdı; format doğru olduğu halde soru içindeki satır boşlukları yüzünden önizleme çalışmadı (İskender aktarımı). İskender çerçevesi: süreç iki kolda ele alınır — (A) taleple ilerleyen kol (IU'nun soru seti yazım ekranı) ve (B) hazır soru seti ile ilerleyen kol (üreticinin talep formu). Önce kontrol, çıktılara göre plan. Kontrol bu oturumda koşuldu (onay: 19.07); hiçbir dosya değiştirilmedi.*

## Kontrol çıktıları (kanıtlı)

### Kol A — Taleple ilerleyen (IU ekranı)

- **A1 Giriş yöntemi:** Toplu metin alanı (`yapisTir` textarea) + "Önizle" butonu; yaşanan olaydaki alan budur (`app/soru-setleri/[video_durum_id]/page.tsx:485-527`).
- **A2 Parse zinciri:** IU ekranı **kendi yerel kopyasını** kullanıyor (`parseSorular`, aynı dosya :202-241) — üretici formundaki ortak `parseSoruSeti` (`app/talepler/_hooks/useSoruSetiParse.ts:13-53`) ile mantık birebir aynı ama **İKİ AYRI KOPYA** var (yalnız hata mesajı ifadesi farklı). Tek düzeltme iki kolu ancak tekilleştirme yapılırsa kurtarır.
- **A3 Yönlendirme:** Format örneği ve "sorular arasında boş satır bırakın" ipucu var (:473-488); ama soru İÇİNE boş satır girmenin kırdığına dair hiçbir uyarı yok ve hata mesajları nedeni göstermiyor (aşağıda K-1/K-5).
- **A4 Word yapıştırma masa başı testi** (gerçek `parseSoruSeti` ile, 9 vaka, tek geçiş):

| Girdi | Sonuç |
|---|---|
| Temiz format (kontrol) | GEÇİYOR |
| **Soru İÇİNDE boş satır (yaşanan olay)** | **KIRIYOR** — üstelik hata yanıltıcı: "Soru sayısı 2 olmalıdır. Şu an: 1" |
| CRLF satır sonları (Windows/Word) | GEÇİYOR |
| Bölünmez boşluk (NBSP) | GEÇİYOR |
| Akıllı tırnak içerikte | GEÇİYOR |
| **Numarasız soru** (Word otomatik listesi numarayı metinden düşürürse) | **KIRIYOR** — "Soru metni bulunamadı." |
| **"Dogru:" (ğ'siz yazım)** | **KIRIYOR** — "Doğru cevap satırı bulunamadı." |
| Sorular arasında çift boş satır | GEÇİYOR |
| Sekme/çoklu boşluklu girinti | GEÇİYOR |

  **Word sorusu cevabı:** Sistem Word yapıştırmasına engel KOYMUYOR — Word'ün gizli karakterleri (CRLF, NBSP, akıllı tırnak) sorunsuz. Kırılganlık tümüyle **boş satır / numara / "Doğru" yazımı** üçlüsünde.
- **A5 Sunucu kilidi:** `PUT /soru-setleri/api` yalnız yapısal JSON doğrular (soru sayısı = büyüklük, tam 2 seçenek — `app/soru-setleri/api/route.ts:87-97`); metin formatından bağımsız. **Düzeltme yalnız istemci parse'ında kalabilir, sunucuya dokunmak gerekmez.**

### Kol B — Hazır soru seti ile ilerleyen (üretici formu)

- **B1 Giriş ve yönlendirme:** Aynı desen: format örneği + textarea + önizleme (`HazirSoruSetiBlogu.tsx`). **Bayat metin bulundu:** başlıkta "(IU bu soru setini sisteme işleyecek…)" yazıyor (:39) — G-1a/F-07 sonrası yanlış; set artık otomatik işleniyor.
- **B2 Parse ortaklığı:** Bu kol ortak `parseSoruSeti`'yi kullanıyor; A4 tablosu bu kol için de aynen geçerli (aynı fonksiyon test edildi).
- **B3 Sunucu kilidi:** Form "önce önizleme" şartı koyar (`useTalepFormu.ts:352-355`), API `hazir_soru_seti_verisi`'ni zorunlu tutar (`talepler/api/route.ts:188-190`), onayda `hazirParametreKontrol` sayıyı kilitler. Format bozuksa üretici formda, parse'ın yanıltıcı mesajıyla baş başa kalır.
- **B4 Veri sözleşmesi:** Parse çıktısı `{soru_metni, secenekler:[{harf, metin, dogru}]}`; tüketiciler: `soru_setleri.sorular` (jsonb), hazır modül (veriyi aynen yazar), izleme uçları (rastgele seçim + `dogru` alanını istemciye sızdırmadan servis). **Parse toleranslı yapılırsa çıktı şekli DEĞİŞMEZ — yalnız girdi kabulü genişler; alt akışa etki yok.**

### Ortak — Word dosyası yükleme fizibilitesi

- **C1:** package.json'da .docx okuyabilen bağımlılık YOK. Aday: `mammoth` (docx → düz metin, sunucu tarafı; dosya küçük — MB altı). Yeri: sunucu ucu (dosya → metin → AYNI parse) — parse tekilleştirilirse Word yolu da aynı çekirdeği kullanır. Yalnız tespit; kurulum yapılmadı.
- **C2:** Tarayıcı, Word'den yapıştırmada textarea'ya düz metni düşürür (biçimlendirme atılır); paragraflar satıra, boş paragraflar boş satıra dönüşür — yaşanan olayın olası kaynağı budur. Word otomatik liste numarasının düz metne her zaman taşınmaması A4/6 riskinin kaynağıdır. (Masa başı bilgi; fiziksel Word teyidi İskender'in test turunda.)

## Bulgular (özet)

- **K-1 | KRİTİK (UX):** Soru içi boş satır parse'ı kırıyor; hata mesajı gerçek nedeni söylemiyor ("Soru sayısı N olmalıdır: 1" — kullanıcı formatın doğru olduğunu biliyor, çaresiz kalıyor). Yaşanan olayın kendisi.
- **K-2 | ORTA (mimari):** Parse'ın iki kopyası var (IU sayfası yereli + ortak hook) — her düzeltme iki yerde yapılmak zorunda; tekilleştirilmeli.
- **K-3 | ORTA:** Numarasız soru kırıyor (Word listesi riski).
- **K-4 | NOT:** "Dogru:" (ğ'siz) kırıyor.
- **K-5 | ORTA (UX):** Hata mesajları konum/neden göstermiyor (hangi soru, hangi eksik).
- **K-6 | NOT (metin):** Üretici formundaki "(IU işleyecek)" ibaresi bayat (G-1a sonrası).
- **K-7 | NOT:** IU ekranında "Önizle" buton rengi blok sayısına bakıyor (:524) — boş satır sorununda yanlış sinyal verir.

## Geliştirme planı (öneri — İskender onayı bekler)

- **D-1 | Toleranslı ortak parse (çekirdek iş; K-1+K-2+K-3+K-4):** Parse tek dosyaya alınır (öneri: `lib/soru/parse.ts` — izleme tarafındaki `lib/soru/secim.ts`'in yanına); iki ekran da oradan kullanır. Yeni mantık blok (boş satır) temelli değil **satır temelli** olur: numaralı satır ya da (numara yoksa) A/B/Doğru dışındaki ilk satır yeni soruyu başlatır; boş satırlar tümüyle anlamsızlaşır (soru içinde de arada da serbest); "Doğru/Dogru" ikisi de kabul. Format şartı (soru + 2 seçenek + doğru şık) aynen korunur. Çıktı sözleşmesi değişmez (B4 güvencesi).
- **D-2 | Konumlu hata mesajları (K-5):** "3. soruda B seçeneği bulunamadı" düzeyinde, kullanıcıyı satıra götüren Türkçe mesajlar; ipucu metinlerinden "boş satır bırakın" zorunluluğu kalkar.
- **D-3 | Ekran metinleri (K-6+K-7):** Bayat "(IU işleyecek)" ibaresi düzeltilir; Önizle buton sinyali blok sayımından ayrılır.
- **D-4 | Word dosyası yükleme (faz 2 — ayrı karar):** Textarea'ya ek ".docx yükle" yolu: sunucu ucu dosyayı metne çevirir (mammoth), metin AYNI toleranslı parse'tan geçer, önizleme aynı ekranda gösterilir. Yeni bağımlılık gerektirir; kapsam ve zamanlama İskender kararı.

Önerilen sıra: D-1 → D-2 → D-3 tek iş paketi (aynı çekirdeğe dokunuyorlar); D-4 ayrı faz.

## Doğrulama disiplini

Her adım: tsc + `npm run denetim` + `npm run lint:mimari` temiz; en fazla 1 smoke (1 mutlu + 1 red — D-1'de doğal aday: toleranslı parse'a A4 tablosunun kırdığı vakalar). Fiziksel teyit İskender'de: gerçek Word'den kopyala-yapıştır + (D-4 yapılırsa) gerçek .docx yükleme. Canlı DB'ye yazım yok.

## Durum

**KONTROL BİTTİ — GELİŞTİRME KARARI BEKLİYOR.** D-1/D-2/D-3 paketi ve D-4 fazı için kapsam kararı İskender'de.
