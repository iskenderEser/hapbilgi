# Üretim Süreci Teknik Refactoring İş Planı — 22.07.2026

Karar sahibi: İskender. Kapsam: üretim ekseni (talep → senaryo → video → soru seti → yayın) ve ona bağlı hazır video / hazır soru seti varyantları (V1/V2/V3). Tüketim dünyaları (T-Club, C-Club, E-Club, Eczanem) bu sürecin tüketim varyasyonlarıdır; üretim çekirdeği düzeldiğinde ondan beslenirler, refactoring kapsamına girmezler.

---

## 1. Neden bu refactoringe ihtiyaç oldu?

Başlangıç hedefi dar bir arızayı çözmekti: hazır video ile gelen soru seti yazma talebinin İU tarafında doğru yerde görünmesi. 19-22.07 arasında bu arızaya art arda yapılan düzeltmelerin her biri yeni bir arıza ortaya çıkardı: bildirim düzeltildi, talep yanlış listede kaldı; liste düzeltildi, iş bu kez hiçbir yerde görünmez oldu. Yamaların birbirini kovalaması, sorunun tek tek uçlarda değil mimaride olduğunu gösterdi.

Stratejik tespit (İskender, 22.07): **PM-İU üretim hattının kod mimarisi çözülmeden PM-hazır kolu hiçbir varyantıyla çözülemez.** Hazır kol ayrı bir sistem değildir; PM-İU hattının tablolarına ve ekranlarına yerleşmiş bir kiracıdır ve o hattın kurallarını bilmeden taklit etmektedir. Kavramsal gerçek şudur: hazır video, İU'dan gelen videonun onaylanmış halidir — üretim aşamalarını yaşamamış ama "onaylanmış video" durumuna gelmiş bir giriştir. Mevcut mimari bu esnekliği ifade edemiyor; refactoring bu yüzden zorunludur. Ölçüt 4 değerdir: ideal, kaliteli, sürdürülebilir, verimli — palyatif değil kalıcı çözüm.

---

## 2. Kullanıcı hata bildirimleri

1. **21.07 fiziksel test (Excel tespiti):** "Hazır video ile gelen talep, soru seti pill'inin altında olması gerekir. Fakat Talepler pill'inin altında çıkıyor. Yeri yanlış." (test_pm_hazir_v1_21072026.md)
2. **21.07 kontrol (ihlal kaydı):** İlk düzeltme sonrası İU hazır video talebini HÂLÂ Talepler listesinde görüyor; satır açılınca işlevsiz detay sayfası ve anlamsız uyarı metni çıkıyor. Tespit onaysız daraltılmış, yalnız yarısı uygulanmıştı.
3. **22.07 kontrol:** Talep, Talepler listesinden çıkarıldı; ancak işin kendisi İU'nun Soru Setleri pill'i altında da doğmuyor. Sonuç: PM hazır videoyu gönderiyor, İU işin varlığından tümüyle habersiz — soru seti yazılamıyor. Hazır video kolu, İU üzerinden video üretmekten çok daha kolay olması gerekirken fiilen kullanılamaz durumda.

---

## 3. Kullanımdaki eksiklikler

- **İşin sahibi kavramı yok.** İş tüm aktif İU'lara duyurulur; "erken kalkan işi kapar." Kimin üstlendiği, kimden bekleneceği sistemde tanımsız.
- **Tek İU - tek PM varsayımı.** Proje tek İU, tek PM düzleminde başladı; genleşirken bu varsayım hiç sorgulanmadı. Yarın bir ya da birkaç firmadan sorumlu İU geldiğinde mevcut yapı yeniden refactoring dayatır.
- **Devir mekanizması yok.** İU izne çıksa, ayrılsa ya da yoğunlaşsa işin başka İU'ya devri sistemde tanımlı değildir; iş öksüz kalır.
- **Süreklilik korunmuyor.** Firmayı, ürünleri ve talep edenleri tanıyan İU'nun birikimi ile talepçinin o İU'ya güveni, iş dağıtımında hiçbir karşılık bulmuyor.

---

## 4. Bunlara karşı gelen teknik durum

Kod incelemesiyle (22.07, salt okuma) tespit edilen yapısal karşılıklar:

- **Onay-sonrası kural iki kopyadır.** "Video onaylandı → soru seti işi doğar → İU'ya bildirim gider" kuralı hem `app/videolar/api/durum/route.ts` (≈121-151) hem `lib/hazirVideoSoruSeti/zincir.ts` (≈130-163) içinde yazılıdır ve iki kopya aynı işi **farklı semantikle** yapar: normal hatta `iu_id` dolu + videoyu çeken tek İU'ya bildirim; hazır kolda `iu_id=null` + tüm aktif İU'lara bildirim.
- **Veri modeli videoya senaryosuz izin vermez.** Hazır kol bu yüzden sahte kayıt üretir: `"[Hazır Video — Senaryo Atlandı]"` metinli senaryo satırı (`zincir.ts` ≈54-67). Kaynak bilgisi (İU üretimi mi, üreticiden hazır mı) açık bir alanda değil, sahte metin ve boş kimliklerle ima edilir.
- **`iu_id` alanının anlamı tutarsızdır.** Normal hatta otomatik açılan soru setine önce onaylayan PM'in kimliği yazılır, İU sonradan üzerine kendi kimliğini yazar (son-yazan davranışı); hazır kolda alan `null`'dur; V3'te zincir karışıktır (senaryo ve video İU'nun, set `null`). Kimlik, sahiplik ve görünürlük tek alanda ezilmiştir.
- **Görünürlük iki ayrı hukuka bölünmüştür.** Talepler listesi sunucu API'sinden service-role ile, elle yazılmış filtreyle beslenir (`app/talepler/api/route.ts` ≈58-62, V1-5 süzgeci). Soru Setleri listesi ise doğrudan istemciden, İU'nun kendi oturumuyla RLS altında sorgulanır (`app/soru-setleri/page.tsx` ≈78-99) ve `soru_setleri → video_durumu → videolar → senaryo_durumu → senaryolar → talepler` boyunca `!inner` join zinciri kurar. Zincirin herhangi bir halkası RLS'ten geçemezse satır listeden bütünüyle düşer. Hazır kolun satırları (`iu_id=null`, service-role yazımı) bu hukukun öngörmediği hayalet satırlardır — 22.07'de İU'nun işi görememesinin teknik karşılığı budur.
- **Rozet/bildirim sahiplikten değil yayından türer.** Bildirimler herkese gider; rozet bildirim esaslıdır. İş-kişi ilişkisi olmadığından "işin sahibinde rozet yanar" davranışı kurulamaz.

---

## 5. Çözümde karşılaşılan sorunlar

- **Semptom yaması yeni semptom doğurdu.** V1-5 zincirinde her düzeltme (bildirim, liste süzgeci, detay yönlendirmesi) bir semptomu kapatıp bir sonrakini açtı; çünkü hepsi aynı kök nedenin — hazır kolun normal hattı kurallarını bilmeden taklit etmesinin — yüzeyleriydi.
- **İki kopyanın farklı semantiği yamayla eşitlenemiyor.** Kopyalardan birine yapılan düzeltme diğerine taşınmadıkça davranış ayrışıyor; taşınsa bile üçüncü bir kopya riski doğuyor.
- **Görünürlüğün iki hukuku birbirini görmüyor.** Sunucu tarafındaki filtre düzeltmesi (Talepler) istemci-RLS tarafını (Soru Setleri) hiç etkilemedi; iş oradan da düştü.
- **Mimari "sahipsiz iş" kavramını ifade edemiyor.** Hazır videonun tek gerçek farkı — videonun bir İU sahibi olmaması — mevcut modelde ancak `null` kimlik + herkese bildirim hack'iyle temsil edilebiliyor; İU'ya dönük ekranların tamamı ise sahipli satır varsayımıyla inşa edilmiş.

---

## 6. Önerilen teknik iş planı

### 6.1 Çekirdek kararlar (mutabık, 22.07)

1. **Tek üretim hattı, çoklu giriş noktası.** Talep → senaryo → video → soru seti → yayın tek durum zinciridir. Hazır video hatta "video onaylandı" durumundan, hazır soru seti "soru seti onaylandı" durumundan katılır. Katılım sonrası kod hazır/normal ayrımını bilmez; sürecin içine serpiştirilmiş "hazırsa atla" kontrolleri kurulmaz. Süreç kuralları (durum geçişleri ve geçişte doğan işler) tek modülde yaşar; ekranlar ve API uçları kendi dosyalarında kalır, kuralı hep o modülden çağırır. (Tek modül ≠ tek dosyada akan süreç; page.tsx dosyaları şişirilmez.)
2. **Firma bazlı atama modeli.** Ayrıntısı 6.2'de. "Erken kalkan işi kapar" modelden bütünüyle çıkar; otomatik yük dengeleme / sırayla atama politikası kurulmaz (birimi tanımsız, sürekliliği körleştirir).
3. **Tek görünürlük hukuku.** "Kim neyi görür" kuralları tek yerde — veritabanında (RLS) — tanımlanır ve rol kilidi + kapsam + sahiplikten türer. Okumalar bu kurala tabidir; API uçlarında elle görünürlük filtresi kalmaz. Yazma işlemleri (durum geçişleri, çok tablolu kayıtlar, bildirimler) sunucu API'sinde kalır.

### 6.2 Atama modeli (netleşen kurallar)

- Atama **firma bazlıdır**: admin, firma-İU eşlemesini yönetir; firmanın her talebi eşlenen İU'ya kendiliğinden gider ve **sahipli doğar**.
- Eşlemesi olmayan (ya da birden çok adayı olan) firmanın işi admin'in **"atama bekleyenler"** listesine düşer; admin elle atar. Kapma mekanizması yoktur.
- Admin **tek bir talebi** geçici olarak başka İU'ya verebilir (yoğunluk vb.); talep bitince istisna biter, firmanın sonraki talepleri asıl İU'ya döner.
- **Firma başka İU'ya taşınırsa** firmanın tüm işleri — devam edenler dahil — yeni İU'ya geçer. **İstisna korunur:** elle atanmış talep firma taşımasından etkilenmez; admin isterse onu da ayrıca taşır.
- **Devirde** yarım işler yeni İU'nun listesinde görünür ve yeni İU'ya bildirim gider; devir görünmez olamaz.
- **Tek İU varken** mekanizmaların hiçbiri görünmez: her firma ve her talep o İU'nundur. Bugünkü çalışma düzeni, modelin özel halidir; firma-sorumlu İU dünyasına geçiş kod değişikliği değil, eşleme tablosuna satır eklemektir.
- Hazır üründe sahiplik: hazır video/set'in sahibi üreticidir. Sahipsizlik yalnız tek yerde var olur — hazır videonun doğurduğu, henüz atanmamış/üstlenilmemiş soru seti yazma işi — ve o da atama modeliyle sahipli doğar ya da atama kuyruğuna düşer.
- Bildirim ve rozet atamadan türer: iş kiminse haber ona gider, rozet onda yanar; herkese yayın biter.

### 6.3 Adımlar

İlke (İskender emri, 22.07): Adımlar eski kodu korumaz, toparlamaz, ömrünü uzatmaz. Her adım kararlaştırılan yeni mimariyi doğrudan kurar; eski kod, yeni yapı devraldıkça sökülür.

| Adım | İş | Çıktı |
|---|---|---|
| A1 | Yeni yapının veri temeli kurulur: her iş ürününe (senaryo/video/soru seti) kaynak alanı ("İU üretimi / üreticiden hazır") ve sahiplik alanı; firma-İU eşleme tablosu; talep-bazlı atama/istisna tablosu; videonun talebe doğrudan bağlanması — sahte senaryo ihtiyacı kökten kalkar. Tüm şema değişiklikleri SQL olarak İskender'e verilir, İskender koşar. | Yeni veri temeli canlı |
| A2 | Süreç kuralı yeni tasarıma göre sıfırdan yazılır: tek hat, durum geçişleri, geçişte doğan işin sorumlu İU'ya sahipli doğması. Normal hattın uçları (senaryo/video/soru seti durum uçları) bu modüle bağlanır; eski kopya kural kodları sökülür. | Tek hat çalışır; kopya kod sökülmüş |
| A3 | Hazır kol tek hatta bağlanır: hazır video "video onaylandı" girişinden, hazır soru seti "soru seti onaylandı" girişinden katılır (V1/V2/V3). Ayrı hazır-zincir kodu (`lib/hazirVideoSoruSeti`) sökülür. Sonuç: PM hazır videoyu yükler; iş, sorumlu İU'nun Soru Setleri'nde doğar ve rozeti yakar. | Hazır kol = hatta ileriden katılan iş; İU işi görür |
| A4 | Atama sistemi kurulur: admin eşleme yönetimi ekranı, atama bekleyenler kuyruğu, talep istisnası, firma taşıma, devir; bildirim ve rozet sahiplikten türetilir — herkese yayın biter. | 6.2 modeli uçtan uca çalışır |
| A5 | Görünürlük RLS'e taşınır: rol kilidi + kapsam + sahiplikten türeyen politikalar (politika SQL'leri İskender'e); tüm ekranlar tek hukuka bağlanır; API'lerdeki elle görünürlük filtreleri sökülür. | Tek görünürlük hukuku |
| A6 | Test verileri temizlenir (temizlik SQL'i İskender'e) ve fiziksel test: üç hazır varyant + atama senaryoları (atama, istisna, firma taşıma, devir). | Temiz zemin; İskender onayı |

### 6.4 Çalışma disiplini

- Her adım öncesi yapılacaklar madde madde yazılır + İskender onayı alınır; bir adım = bir commit; push yok.
- Her adım tsc + `npm run denetim` + `npm run lint:mimari` üçlüsünden temiz geçmeden kapanmaz; adım başına en fazla 1 smoke test (1 mutlu yol + 1 red).
- DB'ye yazan her şey (veri + şema + politika) SQL olarak İskender'e verilir; Claude canlı DB'ye yazmaz.
- Uçtan uca doğrulama İskender'in fiziksel testlerindedir; test tespitleri talimattır, kapsamları onaysız daraltılamaz.
- İskender'in emri ve tespitleri birebir uygulanır; üzerine Claude'un kendi yöntemi (risk azaltma refleksi dahil) eklenemez — sapma gerekli görülürse önce açıkça yazılır ve sorulur.

---

## 7. Uygulama günlüğü

Refactoring tamamlandıkça her adımın yapılanları ve yaşanan sorunları buraya işlenir.

- **22.07 — Plan düzeltmesi (İskender emri):** İlk sürümdeki A1 ("eski kopyaları davranışı koruyarak birleştir") emre aykırıydı — eski kodu koruma odaklıydı ve İskender'in emrinde yoktu; Claude'un kendi risk-azaltma refleksiyle plana eklenmişti. Çıkarıldı; adımlar yeni mimariyi doğrudan kuracak şekilde yeniden yazıldı.
