# Toast Mesaj Düzenleme ve Geliştirme — Keşif Planı

*08.08.2026. Amaç: tüm toast mesajlarının tek bir merkezden yönetildiği,
sürdürülebilir bir kurgunun tasarlanabilmesi için önce mevcut durumun kategorik
keşfi. Bu belge canlıdır: her bölümün keşif sonucu, o bölümün çalışması bitince
ilgili "Keşif sonucu" başlığının altına yazılır. Tüm bölümler bitince belge,
çözüm mimarisinin girdisi olur ve olası geri dönüşlerde "nerede kaldık" kaydı
buradan okunur.*

---

## 0. Neden bu iş (bağlam)

- **Toast, hapbilgi'nin her rolle iç iletişimindeki tek aracıdır** → kritik
  altyapı, "yan özellik" değil.
- Bugün **metin katmanı disiplinsiz**: her sayfa/handler cümleyi kendi içinde
  üretip bırakıyor. Birkaç alan (üretim/durum/CC) sözlüğe toplanmış ama gerisi
  dağınık (satır-içi string).
- **Gidişat riski:** mesaj üreten nesneler component sayısı kadar çoğalır →
  çalışsa bile yönetilemez hâle gelir (tutarlılık, dil, "top kimde" bilgisi her
  yerde farklı).
- **Hedef:** tüm toast mesajları **tek merkezde** yönetilsin; diğer yerler
  cümleyi üretmesin, merkeze **danışsın**; merkez üç şeyi garanti etsin —
  **doğru kişi** (rol/alıcı) · **doğru an** (eylem sırasında ya da sonrasında) ·
  **doğru mesaj** (tutarlı dil, "sıra kimde" bilgisi dâhil). Yani
  `lib/uretim/toastMesaj.ts`'in üretim hattı için kurduğu felsefeyi tüm sisteme
  yaymak.

---

## Keşif algoritmasının mantığı

Sıralama rastgele değil: **listelemeden sınıflayamazsın, sınıflamadan role/olaya
bağlayamazsın.** Her bölüm bir öncekinin çıktısını girdi alır; sonda hepsi tek
bir **envanter + harita** tablosunda birleşir. Bu tablo = çözüm tasarımının
başlangıç noktası.

- **Disiplin:** her bölüm yalnız **tarama** — sıfır değişiklik (Kural 6c), tek
  tek koşulur.
- **Girdi tabanı:** 05.08.2026'da yapılmış rol bazlı içerik taraması (458 çağrı
  → 61 satır) bu belgeye **Ek A** olarak taşındı. O belge bu işin içinde bir
  nesneydi; ayrı dosya (`toast_mesaj_mevcut_oneri.md`) bu belgeye katılıp
  kaldırıldı. **Bölüm 1–3, Ek A'nın üstüne kurulur** — envanter sıfırdan
  taranmaz, eksik sütunlar (kaynak, zamanlama/top-kimde, kanal, risk) eklenir.

---

## Bölüm 1 — Envanter & Motor (ne, nerede, kaç)

- **Amaç:** Bütün toast yüzeyini ve gösterim altyapılarını çıkarmak.
- **Toplanır:** (a) tüm `basari/hata/uyari/bilgi` çağrı noktaları; (b) gösterim
  motorları — `HataMesaji`/`useHataMesaji` tek mi, yoksa admin/eczanem gibi
  paralel motorlar var mı; (c) mevcut merkezî sözlükler (`toastMesaj.ts`,
  `durum/mesaj.ts`, `cc/bildirimMesajlari`, `bildirimOlustur`, `eclubBildirim`)
  — her biri neyi kapsıyor.
- **Çıktı:** "Çağrı noktası → dosya/modül" listesi + motor envanteri.

### Keşif sonucu (08.08.2026)

**Gösterim motoru → tek ve merkezî.**
- Tek dosya: `components/HataMesaji.tsx`. Toast state'ini yalnız burası tutuyor —
  paralel motor yok (admin/eczanem dâhil herkes bunu kullanıyor).
- `useHataMesaji()` hook'u dört fonksiyon veriyor: `hata` · `basari` · `uyari` ·
  `bilgi` (+ `temizle`).
- Kapsayıcı `HataMesajiContainer`: ekranda sabit **sağ-üst** (top:24 / right:24),
  maxWidth 380px, zIndex 9999. *(Kod yorumunda "sağ alt" yazıyor ama konum
  sağ-üst — küçük tutarsızlık, Bölüm 4'e not.)*
- Davranış: varsayılan **12 sn** otomatik kapanır; `uyari`'da `kalici` (kapanmaz)
  seçeneği var. Süre türden bağımsız.
- **46 dosya** motoru tüketiyor.

**Çağrı noktaları → ~458 (05.08 taramasıyla tutarlı).**

| Tür | Adet | Not |
|---|---|---|
| `hata(` | 352 | Baskın kalıp: `hata(d.hata ?? "yedek", "adım")` → sunucu metni + istemci yedeği (iki-katman içerik) |
| `basari(` | 97 | |
| `uyari(` | 9 | |
| `bilgi(` | 0 | Tanımlı ama hiç kullanılmıyor (ölü API) |

Modül yoğunluğu (ilk sıralar): admin 151 *(kapsam dışı — İskender kararı)*,
eclub 60, eczanem 45, talepler 38, store 32, challenge-club 16, yayin-yönetimi 13,
videolar 13, profil 12, izle 11, senaryolar 11, ana-sayfa 10…

**İçerik sözlükleri → tek ada merkezî, gerisi dağınık.**

| Dosya | Ne | Toast içeriği mi? |
|---|---|---|
| `lib/uretim/toastMesaj.ts` | Üretim hattı toast sözlüğü (`uretimToast(olay, baglam)`, "devir fişi" felsefesi) | ✅ Evet — tek gerçek toast-içerik sözlüğü; yalnız **9 talepler/üretim dosyasında** tüketiliyor |
| `lib/utils/durum/mesaj.ts` | Durum **rozeti** sözlüğü (işin HÂLİ) | ❌ Toast değil, ayrı yüzey |
| `lib/cc/bildirimMesajlari.ts` · `lib/utils/bildirimOlustur.ts` · `lib/utils/eclubBildirim.ts` | Kalıcı **bildirim** (tabloya yazılır) | ❌ Toast değil, farklı kanal (Bölüm 4) |

**Özet teşhis.**
- **Motor:** merkezî, tekil, sağlam — sorun burada değil.
- **İçerik:** 458 çağrının yalnız üretim hattı kısmı (~9 dosya) sözlüklü; geri
  kalan neredeyse tümü satır-içi. "Tek merkez" felsefesi kurulmuş ama sistemin
  **~%95'ine yayılmamış.** Sonuç: işi "sistemi yönetmek" olan kod dosyalarının
  üstüne, olmaması gereken bir metin-yönetimi yükü binmiş (direktöre telefon
  cevaplatmak gibi — verimsiz).
- İki yapısal düğüm: (1) `bilgi()` ölü; (2) `d.hata ?? yedek` kalıbı içeriği
  baştan iki katmana (istemci + sunucu) bölüyor — merkezileştirmede ilk çözülmesi
  gerekenler.

---

## Bölüm 2 — Kaynak & Tür Sınıflandırması (her mesaj ne cinsten)

- **Amaç:** Dağınıklığın haritasını çıkarmak.
- **Toplanır:** her çağrı için → **kaynak** (satır-içi string / sözlük /
  sunucu-üretimli), **tür** (hata/başarı/uyarı/bilgi), **içerik** (statik mi,
  `puan`/`isim` gibi dinamik değer enterpolasyonlu mu).
- **Çıktı:** Ek A envanterine eklenen üç sütun. "Kaç tanesi inline, kaç tanesi
  sözlüklü" oranı buradan çıkar.

### Keşif sonucu
_(bölüm bitince doldurulacak)_

---

## Bölüm 3 — Rol × Olay × Zamanlama Matrisi (asıl mesele)

- **Amaç:** "Doğru kişi / doğru an / doğru mesaj" beklentisini ölçmek.
- **Toplanır:** her mesaj için → **hangi rol görüyor** (utt/kd_utt, bm, üretici,
  içerik üreticisi, admin, eczane, eclub, cc); **hangi olay/eylem** tetikliyor;
  **zamanlama** (eylem *sırasında* mı, *sonrasında/devir* mi); **"top kimde"**
  bilgisi var mı, yok mu.
- **Çıktı:** Rol-olay matrisi. `toastMesaj.ts`'in "devir fişi" felsefesinin
  nerede uygulandığı / nerede eksik olduğu buradan görünür.

### Keşif sonucu
_(bölüm bitince doldurulacak)_

---

## Bölüm 4 — Kanal Ayrımı & Mükerrerlik (toast ≠ bildirim)

- **Amaç:** Karışan kavramları ayırmak.
- **Toplanır:** anlık **toast** (aktöre) ile kalıcı **bildirim** (karşı tarafa)
  nerede birbirine karışmış; aynı olayın farklı yerlerde **farklı dille**
  tekrarı; motorlar arası davranış tutarsızlığı (süre, konum, stil).
- **Çıktı:** Çakışma/mükerrerlik listesi.

### Keşif sonucu
_(bölüm bitince doldurulacak)_

---

## Bölüm 5 — Dil, Kısıt & Risk (göç edilebilirlik)

- **Amaç:** Merkezileştirmenin kırılganlık noktalarını görmek.
- **Toplanır:** dil tutarlılığı (siz-formu, terminoloji), **kamusal alan kısıtı**
  (eczane lehine kazanç vaadi yasağı — Kural 7b); **sunucu-üretimli metinler**
  (API `mesaj` döndüren uçlar) — bunlar merkeze taşınırken en riskli katman.
- **Çıktı:** Risk/kısıt notları.

### Keşif sonucu
_(bölüm bitince doldurulacak)_

---

## Nihai çıktı

Beş bölüm tek bir **"Toast Envanteri + Rol/Olay Haritası"** olarak birleşir
(satır = mesaj; sütunlar = kaynak, tür, rol, olay, zamanlama, kanal, risk).
Çözüm mimarisi bunun üstüne kurulur.

---

## Ek A — Mevcut Toast Envanteri (05.08.2026 taraması)

*Bu bölüm, kaldırılan `docs/toast_mesaj_mevcut_oneri.md` belgesinin içeriğidir.
Orijinal amacı: fiziksel testler öncesi mesaj içeriklerinin (dil/içerik)
gözden geçirilmesi. Kapsam: rol bazlı; İÜ ve admin dışarıda bırakılmıştı
(İskender kararı). Kaynak: `app/` ve `components/` altındaki toast çağrılarının
taranması (458 çağrı, tekrarlar birleştirildi). Merkez sözlükler:
`lib/uretim/toastMesaj.ts` (üretim hattı), `lib/utils/durum/mesaj.ts` (durum
rozetleri), `components/HataMesaji.tsx` (kutu ve süre). Bu envanter, Bölüm 1–3
için taban kabul edilir.*

**Süre:** Tüm toast'lar 12 saniye görünür, otomatik kapanır. Kalıcı (kapanmayan)
kullanım hiçbir yerde yok. Süre mesajdan bağımsızdır — kritik uyarı ile liste
hatası aynı süre kalır.

### UTT

| # | Durum | Kategori | Mesaj içeriği | Öneri |
|---|---|---|---|---|
| 1 | Veri çekme hataları | Hata | "… yüklenemedi." / "… yüklenirken hata oluştu." | "Liste yüklenemedi. Sayfayı yenileyip tekrar deneyiniz." |
| 2 | Video oynatıcı kurulamadı | Hata | "Video oynatıcı kurulamadı." | "Video açılamadı. Sayfayı yenileyiniz." |
| 3 | İzleme başlatılamadı | Hata | "İzleme başlatılamadı." | "İzleme başlatılamadı. Videoyu kapatıp yeniden açınız." |
| 4 | İzleme tamamlanamadı | Hata | "İzleme tamamlanamadı." | "İzleme kaydedilemedi. Videoyu yeniden izlemeniz gerekiyor." |
| 5 | Puan yok + soru yok | Uyarı | "Puan kazanma saatleri dışında izlendi." | "İzlemeniz kaydedildi. Puan yalnız hafta içi 07:00–20:29 arasında kazanılır; sorular da o saatlerde çıkar." |
| 6 | Puan yazılamadı | Uyarı | "İzleme puanı kaydedilemedi. Videoyu yeniden izlerseniz puan yeniden değerlendirilir." | "İzleme puanınız kaydedilemedi. Videoyu baştan izlerseniz puanınız yeniden hesaplanır." |
| 7 | İleri sarıldı | Uyarı | "Video ileri sarıldığı için sorular gösterilmeyecek." | "İleri sardığınız için sorular gösterilmeyecek. Soruları görmek isterseniz videoyu baştan ileri sarmadan izleyiniz." |
| 8 | Sorular yüklenemedi | Hata | "Sorular yüklenemedi." | "Sorular yüklenemedi. Videoyu kapatıp yeniden açınız." |
| 9 | Cevaplar gönderilemedi | Hata | "Cevaplar gönderilemedi." | "Cevaplarınız gönderilemedi. Tekrar deneyiniz." |
| 10 | Puan kazanıldı | Başarı | "+N puan kazandınız!" | "İzleme puanı: +N" / "Cevap puanı: +N" |
| 11 | Beğeni / favori başarısız | Hata | "Beğeni işlemi başarısız." / "Favori işlemi başarısız." | "Beğeniniz kaydedilemedi. Tekrar deneyiniz." / "Favoriniz kaydedilemedi. Tekrar deneyiniz." |
| 12 | E-Club: eczane eklendi / çıkarıldı | Başarı | "Eczane listenize eklendi." / "…listenizden çıkarıldı." | Değişiklik önermiyorum |
| 13 | E-Club: kişi eklendi / güncellendi / pasife alındı | Başarı | "Kişi eklendi." / "Kişi güncellendi." / "Kişi pasife alındı." | "Kişiyi listenize eklediniz." / "Kişi bilgilerini güncellediniz." / "Kişiyi pasife aldınız." |
| 14 | E-Club: GLN sorgulanamadı | Hata | "GLN sorgulanamadı." | "GLN sorgulanamadı. Numarayı kontrol edip tekrar deneyiniz." |
| 15 | E-Club: takım adı | Başarı | "Takım adı kaydedildi." | "Takım adınızı kaydettiniz." |
| 16 | Öneri gönderilemedi | Hata | "Öneri gönderilemedi." | "Öneriniz gönderilemedi. Tekrar deneyiniz." |
| 17 | Öneri limiti | Hata | "Tek seferde en fazla 3 video önerilebilir." | Değişiklik önermiyorum |
| 18 | Eczanem: video gönderildi | Başarı | "Video eczaneye gönderildi." | "Videoyu eczaneye gönderdiniz." |
| 19 | Mağaza: sipariş | Başarı | "Siparişiniz alındı." / "Siparişin alındı!" | "Siparişiniz alındı. Siparişlerim sayfasından takip edebilirsiniz." |
| 20 | Mağaza: stok / bakiye | Hata | "Stok yetersiz." / "Bakiyen yetmiyor." | "Stok yetersiz. Farklı bir ürün seçebilirsiniz." / "Puanınız yetersiz." |
| 21 | Mağaza: adres | Başarı | "Adres eklendi." / "Adres silindi." / "Varsayılan adres güncellendi." | "Adresinizi eklediniz." / "Adresinizi sildiniz." / "Varsayılan adresinizi güncellediniz." |

### BM

| # | Durum | Kategori | Mesaj içeriği | Öneri |
|---|---|---|---|---|
| 22 | Veri çekme hataları | Hata | "… yüklenemedi." / "… çekilemedi." | "Liste yüklenemedi. Sayfayı yenileyip tekrar deneyiniz." |
| 23 | Yayın bulunamadı | Hata | "Yayın bulunamadı." | "Bu video bulunamadı. Listeye dönüp yeniden seçiniz." |
| 24 | Kanal uyuşmazlığı | Hata | "Bu yayın Challenge Club kanalı için değil." | Değişiklik önermiyorum |
| 25 | İzleme başlatılamadı / tamamlanamadı | Hata | "İzleme başlatılamadı." / "İzleme tamamlanamadı." | "İzleme başlatılamadı. Videoyu kapatıp yeniden açınız." / "İzleme kaydedilemedi. Videoyu yeniden izlemeniz gerekiyor." |
| 26 | İleri sarıldı | Uyarı | "Video ileri sarıldığı için sorular gösterilmeyecek." | "İleri sardığınız için sorular gösterilmeyecek. Soruları görmek isterseniz videoyu baştan ileri sarmadan izleyiniz." |
| 27 | Sorular / cevaplar | Hata | "Sorular yüklenemedi." / "Cevaplar gönderilemedi." | "Sorular yüklenemedi. Videoyu kapatıp yeniden açınız." / "Cevaplarınız gönderilemedi. Tekrar deneyiniz." |
| 28 | Challenge gönderildi | Başarı | "Challenge başarıyla gönderildi." | "Challenge'ı gönderdiniz. Alıcıya bildirim iletildi." |
| 29 | Challenge gönderilemedi | Hata | "Challenge gönderilemedi." | "Challenge gönderilemedi. Tekrar deneyiniz." |
| 30 | Mağaza (UTT ile ortak) | — | Yukarıdaki mağaza satırlarının aynısı | 19–21 numaralı öneriler geçerli |

### TM

| # | Durum | Kategori | Mesaj içeriği | Öneri |
|---|---|---|---|---|
| 31 | Ana sayfa verisi | Hata | "Veriler yüklenemedi." | "Sayfa verisi yüklenemedi. Sayfayı yenileyip tekrar deneyiniz." |
| 32 | Öneri listesi | Hata | "Öneriler çekilemedi." | "Öneri listesi yüklenemedi. Sayfayı yenileyip tekrar deneyiniz." |

### Üretici roller

| # | Durum | Kategori | Mesaj içeriği | Öneri |
|---|---|---|---|---|
| 33 | Talep gönderildi (4 varyant) | Başarı | "Senaryo talebiniz içerik üreticinize iletildi" / "Soru seti talebiniz…" / "Yayın yönetimi sayfasına gidiniz" | Değişiklik önermiyorum |
| 34 | Aşama onaylandı | Başarı | "[Nesne]yi onayladınız, [sıradaki iş ve sahibi]" | Değişiklik önermiyorum |
| 35 | Revizyon istendi | Başarı | "[Aşama] için revizyon talebiniz içerik üreticisine iletildi" | Değişiklik önermiyorum |
| 36 | İptal | Başarı | "[Aşama] talebinizi iptal ettiniz" | Değişiklik önermiyorum |
| 37 | Yayına alma | — | Mesaj yok | "Videoyu yayına aldınız. Hedef kullanıcılara bildirim iletildi." |
| 38 | Form doğrulama | Hata | "Ürün seçimi zorunludur." / "Teknik seçimi zorunludur." / "Hedef rol seçimi zorunludur." / "Eğitim/İçerik adı zorunludur." / "Hazır video talebi için video dosyası zorunludur." / "Eczanem hedefli talepte ürün seçimi zorunludur." | Değişiklik önermiyorum |
| 39 | Video yükleme | Hata | "Video yüklemesi başlatılamadı." / "Video Bunny'ye yüklenemedi. Tekrar deneyin." / "Video adresi kaydedilemedi." | "Video yüklemesi başlatılamadı. Tekrar deneyiniz." / "Video yüklenemedi. Dosyayı yeniden seçip tekrar deneyiniz." / "Video kaydedilemedi. Yüklemeyi tekrarlayınız." |
| 40 | Yayın ayarları | Hata | "Video puanı kaydedilemedi." / "Soru puanları kaydedilemedi." / "İleri sarma ayarı güncellenemedi." / "Yayına alınamadı." | "Video puanı kaydedilemedi. Tekrar deneyiniz." / "Soru puanları kaydedilemedi. Tekrar deneyiniz." / "İleri sarma ayarı güncellenemedi. Tekrar deneyiniz." / "Yayına alınamadı. Tekrar deneyiniz." |
| 41 | Genel işlem | Başarı | "İşlem tamamlandı." | Olayın adıyla yazılmalı — "Ayarları kaydettiniz." gibi |
| 42 | Genel işlem | Hata | "İşlem gerçekleştirilemedi." | Olayın adıyla yazılmalı — "Onayınız kaydedilemedi. Tekrar deneyiniz." gibi |
| 43 | Dosya | Başarı / Hata | "Dosya silindi." / "Dosya silinemedi." | "Dosyayı sildiniz." / "Dosya silinemedi. Tekrar deneyiniz." |

### Yönetici roller

| # | Durum | Kategori | Mesaj içeriği | Öneri |
|---|---|---|---|---|
| 44 | Ana sayfa verisi | Hata | "Veriler yüklenemedi." | "Sayfa verisi yüklenemedi. Sayfayı yenileyip tekrar deneyiniz." |

### Eczacı ve eczane teknisyeni

| # | Durum | Kategori | Mesaj içeriği | Öneri |
|---|---|---|---|---|
| 45 | E-Club panel yüklenemedi | Hata | "Panel yüklenemedi." | "Panel yüklenemedi. Sayfayı yenileyip tekrar deneyiniz." |
| 46 | İzleme başlatılamadı / tamamlanamadı | Hata | "İzleme başlatılamadı." / "İzleme tamamlanamadı." | "İzleme başlatılamadı. Videoyu kapatıp yeniden açınız." / "İzleme kaydedilemedi. Videoyu yeniden izlemeniz gerekiyor." |
| 47 | Sorular / cevaplar | Hata | "Sorular yüklenemedi." / "Cevaplar gönderilemedi." | "Sorular yüklenemedi. Videoyu kapatıp yeniden açınız." / "Cevaplarınız gönderilemedi. Tekrar deneyiniz." |
| 48 | Eczanem: davet gönderildi | Başarı | "Davet gönderildi — müşterinize SMS ile kod iletildi." | Değişiklik önermiyorum |
| 49 | Eczanem: davet gönderilemedi | Hata | "Davet gönderilemedi." | "Davet gönderilemedi. Telefon numarasını kontrol edip tekrar deneyiniz." |
| 50 | Eczanem: video gönderildi | Başarı | "Gönderildi." | "Videoyu müşterinize gönderdiniz." |
| 51 | Eczanem: sipariş onayı | Başarı | "Onaylandı — indirim N TL (işlem kodu)." | "Siparişi onayladınız. İndirim N TL, işlem kodu: XXX" |
| 52 | Eczanem: sipariş düşürüldü | Başarı | "Sipariş düşürüldü." | "Siparişi reddettiniz." |
| 53 | Eczanem: döküm / liste | Hata | "Döküm yüklenemedi." / "Siparişler yüklenemedi." | "Döküm yüklenemedi. Sayfayı yenileyip tekrar deneyiniz." / "Sipariş listesi yüklenemedi. Sayfayı yenileyip tekrar deneyiniz." |

### Müşteri (Eczanem)

| # | Durum | Kategori | Mesaj içeriği | Öneri |
|---|---|---|---|---|
| 54 | Videolar yüklenemedi | Hata | "Videolar yüklenemedi." | "Videolar yüklenemedi. Sayfayı yenileyip tekrar deneyiniz." |
| 55 | İzleme başlatılamadı / tamamlanamadı | Hata | "İzleme başlatılamadı." / "İzleme tamamlanamadı." | "İzleme başlatılamadı. Videoyu kapatıp yeniden açınız." / "İzleme kaydedilemedi. Videoyu yeniden izlemeniz gerekiyor." |
| 56 | İzleme puanı | Başarı | "+N izleme puanı kazandınız!" | Değişiklik önermiyorum |
| 57 | Cevap puanı | Başarı | "+N cevap puanı kazandınız!" | Değişiklik önermiyorum |
| 58 | Puan yazılamadı | Hata | (sunucudan gelen uyarı metni) | "Puanınız kaydedilemedi. Videoyu baştan izlerseniz puanınız yeniden hesaplanır." — kategori uyarıya çevrilmeli |
| 59 | Kasa verisi / hesap | Hata | "Kasa verisi yüklenemedi." / "Hesap yapılamadı." | "Kasa bilgisi yüklenemedi. Eczacınıza başvurunuz." / "İndirim hesaplanamadı. Tekrar deneyiniz." |
| 60 | Sipariş | Başarı / Hata | "Sipariş gönderildi." / "Sipariş gönderilemedi." | "Siparişiniz eczacınıza iletildi. Onay bekleniyor." / "Siparişiniz gönderilemedi. Tekrar deneyiniz." |
| 61 | Vazgeçme | Başarı / Hata | "Siparişten vazgeçildi." / "Vazgeçilemedi." | "Siparişinizden vazgeçtiniz." / "Vazgeçme işlemi tamamlanamadı. Tekrar deneyiniz." |
