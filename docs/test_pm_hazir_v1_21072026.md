# Hazır Video & Soru Seti — Fiziksel Test, Varyasyon 1

*21.07.2026. Kaynak: İskender'in fiziksel test turu (`hb_testler_pm_iu_talep_210726.xlsx`, sayfa `pm-hazırVideo&SoruSeti`). Üretici rol: PM, tüketici rol: UTT. Talep tipi: Hazır Video & Soru Seti. Üç varyasyon test edilecek: **V1 = video var - soru seti yok** (bu belge), V2 = video yok - soru var, V3 = her ikisi de var. Madde numaralandırması varyasyon öneklidir (V1-1, V1-2, ...) — sonraki varyasyonlarla karışmaz (İskender talimatı).*

---

## Talep (test tespitleri + İskender'in ek talimatları)

- **V1-1 | Metin değişikliği — hazır video uyarısı.** Talep formunda hazır video seçilince çıkan mevcut uyarı ("Hazır video talebi oluşturuyorsunuz. Senaryo aşaması atlanacak...") değişecek. Yeni metin: **"Videonuzu yükledikten sonra hazır soru setinizle devam edebilir ya da içerik üreticisinden talep edebilirsiniz."**
- **V1-2 | Metin değişikliği — placeholder.** Açıklama alanındaki placeholder **"Açıklama yazınız"** olacak.
- **V1-3 | Buton adı.** "Talep Oluştur" butonu **"Gönderiniz"** olacak — hazır videosu ve soru seti olan için "Talep Oluştur" ifadesi anlamsız.
- **V1-4 | Mevcut modalın zenginleştirilmesi + gönderim modal çeşitliliği.** "Gönderiniz" sonrası zaten bir onay modalı çıkıyor ve içeriği iyi — sıfırdan yazılmayacak, korunarak zenginleştirilecek:
  - (a) Hazır video (soru seti İU'dan) gönderiminde modala eklenecek ifade: *"Soru setinin hazırlanması için talebiniz içerik üreticisine yönlendirilecek. Açıklama yazmak ve/veya dosya eklemek ister misiniz?"* — Evet → gönderim durur, PM açıklama/dosya ekler; Hayır → devam.
  - (b) Modal çeşitlemesi: açıklama ve/veya dosya eksikse ikinci teyit — *"Açıklama / Dosya (hangisi eksikse) olmadan talebinizin içerik üreticisine gönderilmesini onaylıyor musunuz?"* — Evet → talep video ile İU'ya soru seti üretimi için gider; Hayır → PM eksiği tamamlar, tekrar gönderir.
- **V1-5 | HATA — İU tarafında rozet/pill konumu.** Hazır video talebi gönderilince İU'da hiçbir pill'de işaret belirmedi; talep Talepler pill'i altında listeleniyor. Olması gereken: İU'nun tek işi soru seti olduğundan iş **Soru Setleri** pill'i altına düşmeli, rozeti orada yanmalı.
- **V1-6 | HATA — Talep detayında yanlış ve işlevsiz ifade.** İU satıra tıklayınca *"Bu talep için senaryo aşaması atlanmıştır. Video yüklendi, üretici onayı bekleniyor."* görüyor; sayfada eylem yok ve ifade yanlış — hazır videoda "üretici onayı bekleniyor" diye bir aşama olmamalı, beklenen İU'nun soru seti üretmesi.
- **V1-7 | TEST DURDU.** V1-5/V1-6 nedeniyle İU soru seti aşamasına ulaşamadı; V1 burada durduruldu. V2 ve V3 bu akış düzelince koşulacak.

---

## Kontrol (kod incelemesi — sıfır değişiklik, 21.07.2026)

**Kök tespit — V1-5 ve V1-6 hata değil, 19.07 tasarım kararının sonucu; test kararı geçersiz kıldı.** Mevcut tasarımda zincir şöyle işler: PM talebi gönderir → video talep oluşturulurken TUS ile doğrudan Bunny'ye yüklenir → embed adresi kaydedilir (`PUT /talepler/api/hazir-video`) → **PM'in talep detayına dönüp videoyu izleyerek "Onayla" demesi beklenir** (`app/talepler/[talep_id]/page.tsx:401-411`) → onayla `POST /talepler/api/hazir-video` → `hazirZinciriKur()` (`lib/hazirVideoSoruSeti/zincir.ts`) zinciri kurar: senaryo (atlandı, otomatik onay) → video (otomatik onay) → **boş soru seti INSERT** → tüm aktif İU'lara "soru seti yazmaya hazır" bildirimi (`kayit_turu: "soru_seti"` — Soru Setleri rozetini yakar). Ayrıca G-3 kararı gereği hazır video talebinde **açılış bildirimi İU'lara bilinçli gitmez** (`app/talepler/api/route.ts:232`) — bildirim video onayı anına ertelenmiştir. Testte PM bu ara onay adımını yapmadığı (yapması gerektiği hiçbir yerden anlaşılmadığı) için zincir hiç kurulmadı: İU'ya ne bildirim/rozet düştü (V1-5) ne Soru Setleri'nde iş göründü; talep detayı da "üretici onayı bekleniyor"da kaldı (V1-6). İskender'in V1-4 talimatı bu ara adımı kaldırıyor: gönderim (modal teyitleri) tamamlandığında talep doğrudan İU'ya soru seti işi olarak gitmeli.

Madde madde teknik karşılıklar:

- **V1-1** | `app/talepler/_components/YeniTalepForm.tsx:140` — hazır video (+soru setisiz) uyarı metni. Aynı blokta iki kardeş metin daha var (138: video+set, 142: yalnız set) — V2/V3 testlerinde ele alınır.
- **V1-2** | `YeniTalepForm.tsx:174` — `placeholder="Talep açıklamasını girin"`.
- **V1-3** | `YeniTalepForm.tsx:224` — buton etiketi "Talep Oluştur". Not: buton tüm talep tipleri için ortaktır (normal İU talebi dahil) — "Gönderiniz" her tipte görünecek.
- **V1-4** | Mevcut modal: `app/talepler/_components/TalepOnayModal.tsx` (F-01/4 kararı — Talep Özeti: ürün, teknik, soru adedi, video başı soru, açıklama özeti, ekli dosyalar; Evet/Hayır; gönderim yalnız Evet'le). Açılışı `useTalepFormu.ts:549-616` (`onayModalAcik`). Açıklama boşsa "—", dosya yoksa "Dosya eklenmedi" zaten gösteriliyor — çeşitleme bu bilgilerin üzerine kurulur.
- **V1-5** | İki kaynak: (a) G-3 — açılış bildirimi bilinçli yok (`app/talepler/api/route.ts:232-234`); (b) Soru Setleri listesi `soru_setleri` kaydına dayanır (`app/soru-setleri/page.tsx`) ve o kayıt ancak `hazirZinciriKur` ile (PM video onayında) doğar. Onay yapılmadığından ikisi de tetiklenmedi.
- **V1-6** | `app/talepler/[talep_id]/page.tsx:243-244` (İU metinleri) + `:241-242` (PM metinleri) + `:401-411` (PM Onayla/Reddet butonları) + `POST /talepler/api/hazir-video` (onay/reddet ucu). "Üretici onayı" ara adımı kalkarsa bu metinler ve uç yeniden düzenlenir.

**Doğrulama üçlüsü:** Kontrol salt-okumadır, kod değişikliği yapılmamıştır.

---

## Çözümler (21.07.2026 — mutabakat sonrası; bir bulgu = bir commit)

*Mutabakat: kök çözüm (onay ara adımının kaldırılması) + V1-1..V1-4 onaylandı; V1-3 yalnız hazır kollarda, V1-1 kardeş metinleri (V2/V3) kendi varyasyon testlerine bırakıldı (İskender, 21.07).*

- **V1-1** (`fc4ad7f`): Hazır video (soru seti İU'dan) uyarısı yenilendi: "Videonuzu yükledikten sonra hazır soru setinizle devam edebilir ya da içerik üreticisinden talep edebilirsiniz."
- **V1-2** (`fe36dbe`): Açıklama placeholder'ı "Açıklama yazınız" oldu.
- **V1-3** (`7d826ce`): Hazır video ve/veya hazır soru seti seçiliyken buton "Gönderiniz"; normal talepte "Talep Oluştur" korundu (İskender kararı: yalnız hazır kollarda).
- **V1-4** (`d33b70f`): Mevcut `TalepOnayModal` korunarak zenginleştirildi. Hazır video kolunda modala "Soru setinin hazırlanması için talebiniz içerik üreticisine yönlendirilecek." bilgisi eklendi; üç çeşitleme: açıklama+dosya ikisi de yoksa "Açıklama yazmak ve/veya dosya eklemek ister misiniz?" (Evet, Ekleyeceğim → forma dön; Hayır, Böyle Gönder → gönder), biri eksikse "Talebinizin açıklama yazmadan / dosya eklemeden gönderilmesini onaylıyor musunuz?" (Evet, Gönder / Hayır), ikisi doluysa mevcut onay sorusu. Diğer talep tipleri değişmedi.
- **V1-5 + V1-6 — kök çözüm** (`70ae462`): PM'in kendi yüklediği videoyu ikinci kez onayladığı ara adım kaldırıldı; zincir kurulumu (`hazirZinciriKur`) video yüklemesinin tamamlandığı ana (PUT `hazir-video`) taşındı — boş soru seti ve İU bildirimi (Soru Setleri rozeti) gönderim anında doğar. `POST onayla/reddet` ucu silindi; talep detayında Onayla/Reddet butonları ve "üretici onayı bekleniyor" metinleri kalktı, dört rol×durum kombinasyonu için doğru metinler geldi; İU'nun "Soru Seti Yaz" butonu video yüklendiyse aktif (Soru Setleri'ne götürür). Sağlamlık: zincir kurulamazsa `hazir_video_url` geri alınır (yarım gönderim kalmaz); zincir kuruluyken yeniden yükleme (`hazirZincirVideoBul`) yalnız zincirdeki video adresini günceller — mükerrer zincir/bildirim yapısal olarak imkânsız; işlenemeyen video için "Yeni Video Yükle" telafi butonu (eski reddet yolunun karşılığı).

**Doğrulama:** tsc + `npm run denetim` + `npm run lint:mimari` temiz. Duman testi YAPILMADI — mutlu yol PM oturumu + gerçek Bunny yüklemesi gerektirir (U5/U6 emsali); uçtan uca doğrulama İskender'in fiziksel testine bırakıldı.

**Fiziksel teyit (İskender):** (a) hazır video talebinde yeni uyarı metni + "Açıklama yazınız" + "Gönderiniz" butonu, (b) modal çeşitlemeleri (hiçbiri yok / biri eksik / ikisi dolu), (c) gönderim sonrası İU'da Soru Setleri rozetinin yanması ve işin Soru Setleri'nde görünmesi, (d) talep detayında yeni metinler + İU "Soru Seti Yaz" aktif butonu, (e) V1 akışı tamamlanınca V2 ("video yok - soru var") ve V3 ("her ikisi de var") testleri.
