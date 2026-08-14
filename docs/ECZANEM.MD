# Eczanem — İş Planı

*HapBilgi'nin üçüncü müşteri katmanı: eczanenin kendi müşterisi.*

*Sürüm: Tamamlandı — tüm kararlar kapalı. Temmuz 2026. Güncelleme (10.07.2026): Tekrar Gönderim Modeli ve sonrası teknik altyapıyla uyumlandırıldı — §4.4 (tur kapsamı), §5.2 (eşik yönetimi), §12 (E-Club maddesi güncellendi).*

---

## İçindekiler

- [1. Kapsam ve yasal çerçeve](#1-kapsam-ve-yasal-çerçeve)
- [2. Terim sözlüğü](#2-terim-sözlüğü)
- [3. Kimlik ve üyelik](#3-kimlik-ve-üyelik)
- [4. İçerik zinciri: talep → yayın](#4-i̇çerik-zinciri-talep--yayın)
- [5. Dağıtım zinciri: PM → UTT → Eczane → Müşteri](#5-dağıtım-zinciri-pm--utt--eczane--müşteri)
- [6. Tüketim: izleme ve puan kazanımı](#6-tüketim-izleme-ve-puan-kazanımı)
- [7. Puan: kilit, karşılık, ömür](#7-puan-kilit-karşılık-ömür)
- [8. Kasa akışı: barkod → sipariş → sipariş onayı → indirim](#8-kasa-akışı-barkod--sipariş--sipariş-onayı--indirim)
- [9. Görünürlük ve gizlilik katmanları](#9-görünürlük-ve-gizlilik-katmanları)
- [10. Mutabakat](#10-mutabakat)
- [11. Güvenli kullanım — risk/karşılık tablosu](#11-güvenli-kullanım--riskkarşılık-tablosu)
- [12. Kapsam dışı ve bağlantılı işler](#12-kapsam-dışı-ve-bağlantılı-işler)

---

## 1. Kapsam ve yasal çerçeve

**1.1 Eczanem nedir.** Eczanem, HapBilgi öğrenme zincirini (üretim → tüketim → ölçüm → ödül) son karar noktasının da ötesine, eczanenin kendi müşterisine taşıyan kanaldır. Müşteri, eczanesinin gönderdiği ürün videosunu izleyip soruları cevaplayarak puan kazanır; bu puanı aynı eczanede, aynı ürünü alırken TL indirimi olarak kullanır.

**1.2 Ürün kısıtı (kanun).** "Eczanem" kanalı Sağlık Bakanlığı ruhsatına tabi olmayan ürünler için kullanılabilir.

**1.3 Rekabet kısıtı yok.** Bir müşterinin hangi eczanenin listesinde yer alacağına sistem kısıt getirmez; aynı müşteri birden fazla eczanenin listesinde olabilir. (Puanın eczaneye kilitli olması bunu ihlal etmez — bkz. §7.1: her eczanedeki puan, o eczanenin gönderdiği içerikten doğan ayrı bir kazanımdır.)

**1.4 Öngörülen Tüketim Döngüsü ve Birikmiş Puan Ömrü.** OTC ve dermokozmetik ürünlerin kutu bazında tekrar satın alma süresi 30–60 gün olarak öngörülerek, puan biriktirme süresi 180 gün olarak belirlenmiştir. Bu süre içinde kullanılmayan puanlar silinir (işleyiş modeli: §7.4).

---

## 2. Terim sözlüğü

| Terim | Tanım |
|---|---|
| **Müşteri** | Eczanenin, sisteme eczacı/teknisyen tarafından davet edilip OTP ile üye olmuş son tüketicisi. |
| **Davet** | Eczacının girdiği ad-soyad + telefon ile başlayan, 24 saat geçerli, henüz üyelik doğurmamış kayıt öncesi durum. |
| **Karşılık** | PM'in ürün başına tanımladığı "X puan = Y TL" çifti. İndirim hesabının tek parametresi. |
| **Kullanılabilir puan** | İzleyerek ve sorulara doğru cevap vererek toplanan puan; indirim amaçlı kullanılır. |
| **Kalan puan** | İndirim için kullanılan puandan sonra, indirim yapmaya yeterli olmayan puan; bakiyede kalır. |
| **İndirim tutarı** | Kullanılabilir puanın firma tarafından belirlenmiş karşılığı. |
| **Sipariş** | Müşterinin, indirim yapılabilecek olan üründen satın alma isteği; barkod okutup adet seçerek eczacıya iletilir, bu aşamada puan düşmez. |
| **Sipariş Onayı** | Eczacının siparişi kabulü; puanın düştüğü ve işlemin kesinleştiği an (çift taraflı el sıkışma). |

---

## 3. Kimlik ve üyelik

**3.1 Kayıt yalnızca davetle.** Müşteri kendini kaydedemez; onu sisteme eczacı/teknisyen davet eder. Eczacı, önden sözlü rızasını aldığı müşterinin ad-soyad + cep telefonunu girer.

**3.2 Davet → OTP → üyelik.** Davet anında müşterinin telefonuna tek kullanımlık kod (OTP) ve giriş linki gider. Müşteri linke tıklar, KVKK aydınlatma/onay metnini onaylar, OTP'yi girer — **ancak bu anda** gerçek müşteri kaydı oluşur. Davet 24 saat içinde tamamlanmazsa kaydedilen bilgiler silinir; kabul edilmemiş kişisel veri kalıcı olarak tutulmaz. Eczacı dilerse yeni davet gönderir.

**3.3 Telefon = tek kişi.** Müşteri kimliği telefon numarasına bağlıdır ve sistemde tek kişidir. Aynı kişi birden fazla eczanenin listesinde yer alabilir (§1.3); kimliği tek, eczane bağları çokludur.

**3.4 Eczacı/teknisyen müşteri olamaz.** UTT'nin eczane kaydında tuttuğu eczacı/teknisyen telefon numaraları, aynı eczanede müşteri olarak kaydedilemez (kendi kendine puan üretme suistimalinin karşılığı).

**3.5 Giriş.** Telefon + OTP ile — baştan itibaren; geçici e-posta/şifre dönemi yoktur. (Not: SMS/OTP altyapısı sistemde henüz yoktur ve yeni dış bağımlılıktır; E-Club'ın deploy-öncesi listesinde bekleyen "OTP girişi" açık işi de aynı altyapıyla kapanır — iki iş tek entegrasyonda birleştirilir.)

**3.6 Silme hakkı.** Müşteri, panelindeki profilinden silinme talebinde bulunur; OTP ile teyit eder. Bakiyesi olsa dahi hesabı silinir — silme hakkı bakiye şartına bağlanamaz.

---

## 4. İçerik zinciri: talep → yayın

**4.1 Talep — yalnızca PM.** Eczanem hedefli talebi yalnızca PM açabilir; hedef kitle olarak "Eczanem" seçilir, alt seçim yoktur. Ürün, §1.2 kısıtına uygun olmalıdır.

**4.2 Üretim — standart zincir.** Talep, mevcut üretim hattından aynen geçer: senaryo → video → soru seti.

**4.3 Yayın — barkod ve Karşılık tanımı zorunlu.** Ürün, talep aşamasında zaten seçilidir (adı sistemde mevcuttur); teknik ise Eczanem'de yoktur. PM, yayına almadan önce yalnızca iki bilgi girer: ürünün **barkodu** ve o ürün için **Karşılık** ("X puan = Y TL"). Böylece üretim zincirinin diğer adımlarında hiçbir değişiklik yapılmaz; ekleme yalnızca yayın yönetimi seviyesindedir. Karşılık, PM'in ürün maliyet yapısına göre vereceği tek karardır; eşik, kademe, özel oran yoktur (§7.3). Yayın sonrası müşteri aleyhine keyfi değişiklik yapılamaz.

**4.4 Yayın kuralları.** Eczanem yayınlarında ileri sarma, extra puan ve öneri puanı yoktur. **Tekrar gönderim (tur) modeli de bu kanala uygulanmaz:** teklik ömür boyudur (§5.3, §5.5) ve Eczanem hedefli yayında yayına alma formundaki tekrar periyodu seçimi sunulmaz — `tekrar_periyot_gun` NULL'a zorlanır. Böylece otomatik tur mekanizması bu yayınlar için hiç devreye girmez; ihtiyaç sahada doğarsa tur modeli hazır altyapı olarak durmaktadır (sonraki sürüm kararı).

---

## 5. Dağıtım zinciri: PM → UTT → Eczane → Müşteri

**5.1 UTT görür.** Yayınlanan Eczanem videosu, UTT'nin kendi "Eczanem" ekranında/pill'inde listelenir.

**5.2 Eşik ön koşulu.** UTT, listesindeki her eczanenin **aktif üye** (daveti kabul etmiş müşteri, §3.2) sayısını görür. Belirlenen eşiğin altındaki eczaneye video gönderilemez. Eşik değeri sistem genelinde tek yerden yönetilir — mevcut mekanizmayla: `sistem_ayarlari` anahtarı olarak tanımlanır ve admin panelindeki Sistem Ayarları ekranından güncellenir (tüm firmalara aynı). Davet aşamasındaki kayıtlar sayılmaz — telefon numarası girerek eşik şişirmek yapısal olarak imkânsızdır.

**5.3 UTT → eczane: video başına 1 gönderim.** Bir video, bir eczaneye yalnızca bir kez gönderilebilir; tekrar gönderim sistemce engellenir.

**5.4 Eczane görür.** Eczacı/teknisyen, eczaneye iletilen videoları kendi Eczanem panelinde görür.

**5.5 Eczane → müşteri: tekil veya toplu.** Eczacı videoyu müşterilerinden tek tek seçtiklerine gönderebileceği gibi "tüm listeme gönder" ile toplu da gönderebilir. Yalnızca aktif üyeye gönderilebilir (§3.2). Aynı video aynı müşteriye yalnızca bir kez gönderilebilir.

---

## 6. Tüketim: izleme ve puan kazanımı

**6.1 Kayıpsız model.** Müşteri videoyu izler, soruları cevaplar; yalnızca **kazanım** vardır — izleme puanı ve doğru cevap puanı. Yanlış cevap, ileri sarma vb. hiçbir kayıp mekanizması bu katmanda yoktur.

**6.2 İzlenme takibi yok — hiçbir katmanda.** Eczacı, gönderdiği videonun izlenip izlenmediğini ne müşteri bazında ne toplam olarak görür; UTT/BM/TM/PM katmanlarında da izlenme metriği üretilmez. Gerekçe: izlemenin ucunda maddi kazanç vardır; rızası olan müşteri özgürdür — izlerse kazanır, izlemezse kazanmaz. Sistem bir hatırlatma/baskı aracına dönüştürülmez, takibin firma veya eczane tarafından yapılması pratikte de yersizdir.

---

## 7. Puan: kilit, karşılık, ömür

**7.1 Dörtlü kilit: kişi + eczane + firma + ürün.** Müşterinin kazandığı puan dört boyuta birden kilitlidir: puanı hangi eczanenin gönderdiği videodan, hangi firmanın hangi ürünü için kazandıysa, yalnızca **o eczanede, o ürünü alırken** kullanabilir.

- Ayşe, X eczanesinden A firmasının P1 ürünü videolarıyla 500 puan; Y eczanesinden B firmasının ürünüyle 400 puan kazanır → X'teki puanı Y'de, Y'dekini X'te kullanamaz.
- Ayşe aynı ürünün (A/P1) videolarını hem X hem Y üzerinden izlerse iki ayrı bakiye oluşur; birleştirilemez.

Gerekçeler: (a) **Eczane kilidi** — her eczanenin yaptığı indirim, kendi gönderdiği içerikten doğan öğrenmenin karşılığıdır; mutabakat tarafında da her eczane yalnızca kendi ürettiği indirimi firmadan talep eder. (b) **Ürün kilidi (PM adaleti)** — her ürünü bir PM yönetir; bir PM'in emeğiyle üretilen puanın firma genelinde (özellikle "zaten çok satan" üründe) kullanılması hem adaletsiz olur hem satışını artırmak isteyen PM'in ayağına pranga olur. Firma seviyesi ayrı bir bakiye değildir; yalnızca görüntüleme hiyerarşisinde gruplama katmanıdır (Eczane > Firma > Ürün).

**7.2 Karşılık — tek doğrusal tarife.** İndirim hesabının tek parametresi PM'in tanımladığı Karşılık'tır (X puan = Y TL): her X puan, Y TL indirim eder. Kalan puan bakiyede durur ve sonraki kazanımlarla birleşir. Örnek (100 puan = 5 TL): 570 puanla okutma → 25 TL indirim, 70 puan bakiyede kalır.

**7.3 Eşik yok.** Minimum puan barajı, kademeli tarife, ilk-birikim özel oranı yoktur — son tüketicinin kafasını karıştırmamak temel ilkedir. Müşteri **ne zaman** kullanacağını kendi seçer (100'de bozdurmayıp 350'de veya 1000'de okutabilir); **ne kadar** kullanılacağını formül belirler. PM ilk birikimi daha cömert ödüllendirmek isterse bunu Karşılık oranının kendisiyle kurar.

**7.4 Puan ömrü: 180 gün — kayan pencere.** Her puan, kazanıldığı andan itibaren 180 gün yaşar (Ocak kazanımı Temmuz'da, Mart kazanımı Eylül'de düşer). Amaç: 30–60 günlük tekrar satın alma döngüsünde (§1.4) düzenli müşteri hiç etkilenmez; yalnızca kanalı terk etmiş müşterinin firmadaki ucu açık indirim yükümlülüğü kapanır. Harcama sırasında en eski puan önce tüketilir — böylece kalan puanı bekletmek müşteri aleyhine yaşlanma üretmez.

---

## 8. Kasa akışı: barkod → sipariş → sipariş onayı → indirim

**8.1 Akış — çift taraflı el sıkışma.**

1. **Barkod.** Müşteri ürünü kasaya getirir, kendi telefonundan paneline girer (üye olmayan bu noktaya gelemez), "İndirim kullan" ile ürünün barkodunu okutur.
2. **Hesap.** Sistem zinciri çözer: barkod → ürün → bu eczane+firma+ürün bakiyesi → Karşılık → indirim tutarı. Ekranda ürün adı, **adet** (varsayılan 1, +/− ile artırılır), kullanılacak puan ve indirim TL'si görünür.
3. **Sipariş.** Müşteri siparişi gönderir — puan henüz düşmez.
4. **Sipariş Onayı.** Sipariş, eczacının panelinde belirir (müşteri son-4-hane, ürün, adet, indirim TL). Eczacı onaylar → puan **o anda, atomik olarak** düşer; müşterinin ekranı "onaylandı" fişiyle (ürün, indirim, tarih-saat, işlem kodu) kilitlenir; işlem kesinleşir.
5. **Ödeme.** Eczacı kasada indirim tutarını düşer; müşteri indirimli tutarı öder.

**8.2 Adet, indirimi çarpmaz.** İndirim, müşterinin o üründeki hakkı kadardır; adet yalnızca satılan kutu sayısını kaydeder (mutabakat verisi). Örnek: 2 kutu × 500 TL = 1000 TL; indirim hakkı 50 TL; ödenen 950 TL. Kayıt: 2 kutu, 50 TL.

**8.3 Vazgeçme ve iptal.** Vazgeçme sipariş aşamasında doğaldır: eczacı onaylamaz, sipariş düşer — puan hiç düşmemiştir. Sipariş Onayı sonrası iptal mekanizması v1'de yoktur; Sipariş Onayı zaten iki tarafın karşılıklı iradesidir, istisnai hatalar taraflar arasında saha pratiğiyle telafi edilir.

**8.4 Sahtecilik doğal olarak imkânsız.** İndirim hesabı müşterinin ekranında ve eczacının onayıyla oluştuğu için ne eczacının tek taraflı beyanına dayanır ne de eski/ sahte bir ekran görüntüsüyle tekrarlanabilir — fiş, eczacının kendi panelindeki onayının sonucudur.

---

## 9. Görünürlük ve gizlilik katmanları

**9.1 Temel ilke — kişi gizli, toplam görünür.** Müşteri kimliği ve müşteri bazlı her bilgi (kim aldı, kimin ne puanı var, kim ne izledi) hiçbir iç role akmaz. Eczane × ürün seviyesindeki toplam finansal bilgi (kutu adedi, toplam indirim TL) ise mutabakatın dayanağıdır ve saha hiyerarşisine akar.

**9.2 Katman katman:**

| Katman | Gördüğü |
|---|---|
| **Müşteri** | Kendi bakiyeleri (Eczane > Firma > Ürün kırılımı), kendine gönderilen videolar, kendi işlem fişleri. |
| **Eczane (eczacı/teknisyen)** | Üye listesi ve tüm işlem kayıtları — müşteri her ekranda yalnızca **telefon son-4-hane** ile; ad-soyad yalnızca davet anında girilir, hiçbir görüntüleme katmanında gösterilmez. Gelen videolar, kendi gönderimleri (kime gönderdiği; izlenme bilgisi olmadan), ürün bazında toplam indirim dökümü. |
| **UTT** | Listesindeki her eczanenin **eczane × ürün** toplamları: kaç kutu satıldı, toplam ne kadar indirim yapıldı. Müşteri bilgisine (son-4-hane dahil) erişemez. Dağıtım bilgisi: hangi videoyu hangi eczaneye gönderdi. |
| **BM / TM / firma yönetimi** | UTT'de oluşan eczane × ürün toplamlarının kapsam-daralması cascade'i: BM bölgesi, TM takımı, yönetici firma geneli. |
| **PM** | Hiyerarşi değil **ürün ekseni**: kendi ürün(ler)inin Türkiye geneli performansı — bölge → UTT → eczane kırılımında kutu/indirim toplamları. Başka PM'lerin ürünleri görünmez. |

**9.3 Firma kimin aldığını göremez.** Hiçbir iç rol (PM dahil) müşteri bazlı satın alma verisine ulaşamaz; en granüler görünüm eczane × ürün toplamıdır.

---

## 10. Mutabakat

**10.1 Yürütücü: UTT.** Eczanenin yaptığı indirimlerin firmadan geri alınması HapBilgi **dışında**, firmanın aylık mutabakat sürecinde yürür; süreci sahada UTT yürütür. UTT'nin §9.2'deki eczane × ürün dökümü (kutu adedi + toplam indirim TL) bu mutabakatın sistem tarafındaki dayanağıdır; eczanenin kendi panelindeki işlem dökümü de eczane tarafındaki karşılığıdır.

**10.2 Satış doğrulaması kapsam dışı.** "Satış gerçekten oldu mu" sorusunu sistem doğrulamaz; çift taraflı Sipariş Onayı (§8.1) iradeyi kayda bağlar, stok/fatura doğrulaması firma-eczane mutabakatının kendi işidir.

---

## 11. Güvenli kullanım — risk/karşılık tablosu

| Risk | Karşılanma biçimi |
|---|---|
| Sahte/erişilemez telefonla müşteri kaydı | Üyelik yalnızca OTP doğrulamasıyla oluşur (§3.2); doğrulanmamış davet 24 saatte silinir, kalıcı kayıt hiç oluşmaz. |
| Eczacı/teknisyenin kendini "müşteri" kaydetmesi | Eczacı/teknisyen telefonları aynı eczanede müşteri olarak kaydedilemez (§3.4). |
| Telefon numarası girerek eşik şişirme | Eşik yalnızca **aktif üyeleri** sayar (§5.2); OTP'siz kayıt sayıma girmez. |
| Aynı videonun eczaneye tekrar gönderimi | Video başına eczaneye 1 gönderim (§5.3). |
| Aynı videonun müşteriye tekrar gönderimi | Video başına müşteriye 1 gönderim (§5.5). |
| Yetersiz üyeli eczaneye gönderim | Eşik ön koşulu (§5.2). |
| Eczacının indirimi müşteriye yansıtmaması | Hesap müşterinin ekranında oluşur; işlem çift taraflı onayla kesinleşir (§8.1, §8.4). |
| Eski/sahte fiş ekran görüntüsüyle mükerrer indirim | Fiş, eczacının kendi panelindeki onayının sonucudur; onaysız fiş yoktur (§8.4). |
| Puanın mükerrer/aşkın harcanması | Sipariş Onayı anında atomik düşüm; puan yettiği kadar harcanır (§8.1). |
| Puanın başka eczane/firma/ürüne sızması | Dörtlü kilit (§7.1). |
| Eczacının müşteri adına soru cevaplaması | Eczane-müşteri güven ilişkisine bırakılan, kabul edilen risk. |
| Aynı kişinin farklı eczanelerde kaydı | Risk değil, tasarım (§1.3): kimlik tek, eczane bağı çoklu; her bakiye kendi eczanesine kilitli. |
| Gerçekleşmemiş satışın "yapıldı" işlenmesi | Kapsam dışı (§10.2); çift taraflı Sipariş Onayı iradeyi bağlar, stok/fatura doğrulaması mutabakatın işidir. |
| Terk etmiş müşterinin ucu açık indirim yükümlülüğü | Puan ömrü 180 gün (§7.4). |

---

## 12. Kapsam dışı ve bağlantılı işler

- **E-Club tekrar gönderim kontrolü — ÇÖZÜLDÜ (farklı modelle, 07.2026):** Bu madde Tekrar Gönderim Modeli ile kapanmıştır: E-Club tekliği ömür boyu engel değil, bilinçli olarak **tur bazlı** tanımlanmıştır (yeni turda aynı video aynı kişiye yeniden önerilebilir ve puanlar yeniden doğar); kişi-koruma ise `sistem_ayarlari`'ndan yönetilen frekans limitleriyle sağlanır (gönderim aralığı + haftalık kabul limiti). Eczanem'in ömür boyu tekliği (§5.5) bundan bağımsız ve bilinçli olarak farklıdır: iki kanalın teklik modeli aynı olmak zorunda değildir (§4.4).
- **Satış/stok doğrulaması:** §10.2 gereği kapsam dışı.
- **Sipariş Onayı sonrası iptal mekanizması:** v1 kapsamı dışında (§8.3); ihtiyaç sahada doğrulanırsa sonraki sürümde değerlendirilir.
# Eczanem — Teknik İş Planı

*Eczanem İş Planı'nın (işleyiş belgesi, uyumlandırılmış sürüm 10.07.2026) koda dönüşüm planı. Bu belge "nasıl ve hangi sırayla" sorusunun cevabıdır; kurallar ve gerekçeler işleyiş belgesindedir, burada tekrarlanmaz — yalnızca referans verilir (§İP-x.y). Kod yazımı her adımda KONTROL → YAZIM ile ilerler. Belge canlıdır: kapanan her adım §9'daki durum takibinde tiklenir, yeni bulgular ilgili bölüme işlenir.*

*Son güncelleme: 12.07.2026 — U9 + U12 kapandı: kod üretimi tamam (U0–U9), redbook güncel (Eczanem = Bölüm 5). Kalan: U10/U11 fiziksel testler (İskender); K-E1 kararı KAPALI — Turkcell (10.07.2026; açık kalan sözleşme/entegrasyon, canlı blokörü odur — B-13 ifade eşitleme 12.07.2026); açık kararlar K-E2 (davet temizliği), K-E7 (RLS → redbook §6.4 genel listesinde); KVKK metni placeholder; push testler sonrası. Teknik borç ve deploy-öncesi mecburi işlerin tek kaynağı: redbook §6.4.*

---

## İçindekiler

- [1. İşin özü, önkoşullar ve fazlar](#1-i̇şin-özü-önkoşullar-ve-fazlar)
- [2. Veri modeli](#2-veri-modeli)
- [3. Kimlik, giriş ve erişim](#3-kimlik-giriş-ve-erişim)
- [4. Üretim hattı değişiklikleri](#4-üretim-hattı-değişiklikleri)
- [5. Dağıtım ve tüketim](#5-dağıtım-ve-tüketim)
- [6. Kasa akışı — atomik düşüm](#6-kasa-akışı--atomik-düşüm)
- [7. Görünürlük, raporlar, mutabakat dökümü](#7-görünürlük-raporlar-mutabakat-dökümü)
- [8. Açık kararlar — İskender](#8-açık-kararlar--i̇skender)
- [9. Uygulama sırası ve durum takibi](#9-uygulama-sırası-ve-durum-takibi)

---

## 1. İşin özü, önkoşullar ve fazlar

Eczanem, üçüncü müşteri katmanıdır: eczanenin kendi müşterisi videoyu izler, puan kazanır, aynı eczanede aynı üründe TL indirimi olarak kullanır (İP-§1). Teknik olarak beş yeni yapı taşı gerektirir: **(a)** üçüncü kimlik düzlemi (telefon+OTP), **(b)** sistemdeki ilk puan-yaşlandırma modeli (180 gün kayan pencere + FIFO harcama), **(c)** atomik düşüm RPC'si (sipariş onayı), **(d)** üretim hattında üçüncü hedef (`eczanem`), **(e)** beşinci proxy bekçisi.

**Mevcut altyapının hazır verdiği parçalar** (yeniden kullanılır, icat edilmez):
- Rol çözümü tek kaynakta: `v_auth_kimlik` + `rolCozucu` — müşteri düzlemi view'a UNION olarak eklenir.
- Ayar yönetimi: `sistem_ayarlari` + admin Sistem Ayarları paneli — eşik ve diğer parametreler buradan.
- Denormalizasyon deseni: dörtlü kilit (kişi+eczane+firma+ürün) kayıt anında yazılır (`urun_id` felsefesinin genişlemesi).
- Yayına alma formu genişletme deseni: tekrar periyodu işinde kuruldu; barkod+Karşılık aynı desenle.
- Kayıt-anı simetrisi ve "fiziksel DELETE yok" felsefesi: 180 gün "silme"si sorgu-anı filtresiyle uygulanır (cron'suz — tur modelindeki yaklaşımın aynısı).

**Fazlar** (her faz kendi içinde test edilebilir, sıra bağımlıdır):
- **Faz 0 — Zemin:** hedef_rol genişletmesi + veri modeli migration'ları + ayar anahtarları.
- **Faz 1 — Kimlik:** OTP altyapısı, davet → üyelik, müşteri girişi, proxy bekçisi, KVKK silme.
- **Faz 2 — İçerik + dağıtım:** PM talebi, yayına alma (barkod+Karşılık), UTT→eczane, eczane→müşteri.
- **Faz 3 — Tüketim:** müşteri paneli, izleme + soru + kazanım (kayıpsız).
- **Faz 4 — Kasa:** barkod okuma, sipariş, atomik onay, fiş.
- **Faz 5 — Görünürlük:** eczane dökümü, UTT eczane×ürün, BM/TM/yönetici cascade, PM ürün ekseni.

**Dış bağımlılık:** SMS sağlayıcısı (K-E1) Faz 1'in ön koşuludur; sağlayıcı beklenirken Faz 0 ve Faz 2'nin PM tarafı ilerleyebilir.

**Push disiplini:** Bekleyen U10+U7 testleri ve deploy-öncesi mecburi işler (RLS vb.) bu projeden bağımsız olarak durur; Eczanem commit'leri de aynı disipline tabidir. Yeni tabloların TÜMÜ RLS listesine doğar (açık iş büyümesin diye migration'da RLS'li düşünülür — K-E7).

## 2. Veri modeli

Yeni tablolar (adlar öneri; KONTROL'lerde mevcut adlandırma diliyle son hâli verilir):

| Tablo | Rol | Kritik kolonlar / notlar |
|---|---|---|
| `eczanem_musteriler` | Kimlik (tek kişi = tek telefon, İP-§3.3) | `musteri_id`, `telefon` (UNIQUE), `ad_soyad`, `kvkk_onay_tarihi`, `aktif_mi`. Ad-soyad görüntüleme katmanlarına ASLA akmaz (İP-§9.2). |
| `eczanem_davetler` | Kayıt öncesi durum (İP-§3.2) | `davet_id`, `eczane_id`, `telefon`, `ad_soyad`, `otp_hash`, `son_gecerlilik` (24s), `durum`. Süresi dolan davet verisi kalıcı tutulmaz — temizleme stratejisi K-E2. |
| `eczanem_uyelikler` | Eczane↔müşteri bağı (çoklu, İP-§1.3) | `uyelik_id`, `musteri_id`, `eczane_id`, `durum`. UNIQUE(musteri_id, eczane_id). "Aktif üye" eşiği bu tablodan sayılır. |
| `eczanem_gonderimler` | Eczane→müşteri dağıtımı (İP-§5.5) | `gonderim_id`, `yayin_id`, `eczane_id`, `musteri_id`. UNIQUE(yayin_id, musteri_id) — ömür boyu teklik yapısal. UTT→eczane tekliği için ayrı tablo: `eczanem_eczane_gonderimleri`, UNIQUE(yayin_id, eczane_id) (İP-§5.3). |
| `eczanem_izleme_kayitlari` | Tüketim | Mevcut izleme deseninin sade hâli; kayıp kolonları yok (İP-§6.1). |
| `eczanem_puan_kayitlari` | **Kazanım ledger'ı — FIFO'nun temeli** | `kayit_id`, `musteri_id`, `eczane_id`, `firma_id`, `urun_id` (dördü kayıt anında denormalize — dörtlü kilit), `puan_turu` (izleme/cevap), `puan`, **`kalan_puan`** (harcamayla azalır), `created_at`. |
| `eczanem_siparisler` | Kasa akışı (İP-§8) | `siparis_id`, `musteri_id`, `eczane_id`, `urun_id`, `adet`, `kullanilan_puan`, `indirim_tl`, `durum` (bekliyor/onaylandi/dustu), `islem_kodu`, `onay_tarihi`. |
| `eczanem_harcama_kayitlari` | FIFO eşleme tarihçesi | `harcama_id`, `siparis_id`, `kaynak_kayit_id` (→ puan_kayitlari), `dusulen_puan`. Hangi kazanımdan ne düştüğü izlenebilir — mutabakat ve denetim tabanı. |

**Bakiye ve 180 gün — tek formül:** kullanılabilir bakiye(müşteri, eczane, ürün) = Σ `kalan_puan` WHERE `created_at >= now() − 180 gün`. Fiziksel silme yok; süresi geçen kazanımın `kalan_puan`'ı tarihçede durur ama formüle girmez. FIFO: harcama RPC'si kayıtları `created_at ASC` tüketir → en eski önce (İP-§7.4), "kalan puanı bekletmek yaşlandırmaz" kuralı kendiliğinden sağlanır.

**Barkod + Karşılık'ın evi:** giriş UX'i yayına almada (İP-§4.3) ama saklama **ürün seviyesinde** olmalıdır — bakiye ürün bazlı birleştiği için karşılık da ürün başına tek güncel değer olmak zorunda (iki yayının iki farklı karşılığı tanımsızlık üretir). Öneri: `urunler`'e `barkod` + Karşılık için `eczanem_urun_tarifeleri` (urun_id, puan, tl, gecerlilik_baslangic — "müşteri aleyhine değişmez" kuralının tarihçesi). Son karar: K-E3.

**Ayar anahtarları** (`sistem_ayarlari`, admin panelinden): `eczanem_aktif_uye_esigi` (İP-§5.2), `eczanem_puan_omru_gun` (=180, İP-§7.4), `eczanem_davet_gecerlilik_saat` (=24). (İzleme/cevap puan değerleri ayar DEĞİL — K-E4 KAPALI: yayın başına, PM ailesi belirler.)

**Korumalı tablolar:** `eczanem_puan_kayitlari`, `eczanem_harcama_kayitlari`, `eczanem_siparisler` → `KORUMALI_TABLOLAR`'a eklenir; yazım yalnızca `lib/eczanem/` tek-kaynak fonksiyonları + RPC üzerinden.

## 3. Kimlik, giriş ve erişim

- **OTP:** iki mimari seçenek — (a) Supabase native phone auth (SMS sağlayıcı entegrasyonu Supabase'e), (b) kendi OTP tablomuz + custom session. KONTROL K1 (mevcut auth kurulumunun incelenmesi) + K-E1 sağlayıcı kararıyla netleşir. E-Club'ın bekleyen OTP işi aynı altyapıya bağlanır (İP-§3.5 notu) ama E-Club geçişi AYRI iştir — bu planda yalnızca altyapının paylaşılabilir kurulması hedeflenir.
- **OTP test modu (K-E8, kapalı karar):** Canlı (production = gerçek kullanıcı ortamı) dışındaki her ortamda (local + Vercel preview) SMS gönderilmez ve sabit kod `123456` geçerlidir — test tarafında hiçbir açma/kapama adımı yoktur, kendiliğinden çalışır. Güvence tek taraflı ve çift kilitlidir: kod, sabit kodu yalnızca ortam production DEĞİLKEN kabul eder (`VERCEL_ENV`/`NODE_ENV` kontrolü); canlıda hiçbir koşulda çalışmaz — "kaldırmayı unutma" riski yapısal olarak yoktur (girişsiz test endpoint'leri dersinin uygulaması). Davranış tek noktada yaşar (`lib/eczanem/otp.ts`), test-modu doğrulamaları loglanır. Yan kazanç: U1 ve sonrası OTP'li akışlar K-E1 sağlayıcı kararını beklemeden yazılıp test edilebilir; SMS entegrasyonu sona takılan parçadır.
- **`v_auth_kimlik` genişletmesi:** view'a müşteri düzlemi UNION'ı eklenir; `rolCozucu` `"musteri"` dönebilir hâle gelir. Yazma tarafı: müşteri auth kaydı hangi alanla eşlenir (telefon → auth user) K1'de netleşir.
- **Proxy — beşinci bekçi (güncellendi 11.07.2026):** Eczanem bağımsız modüldür ve kendi kökünde yaşar: müşteri paneli `/eczanem`, eczacı tarafı `/eczanem/eczane` (E-Club oturumuyla girilir ama yol E-Club prefix'inde DEĞİLDİR — modül bağımsızlığı kararı; eski `/eclub/eczanem` yolu U2 sonrası taşındı). Tek bekçi `/eczanem/*` kökünü korur; girişsiz uçlar (giriş API'leri, davet kabul sayfası ve API'si) bekçi istisnasıdır. UTT tarafı iç uygulamada mevcut bekçilerin kapsamında.
- **Eczacı/teknisyen ≠ müşteri** (İP-§3.4): davet API'si, telefonu o eczanenin eczacı/teknisyen kayıtlarına karşı doğrular — kaynak tablo K2'de tespit edilir.
- **KVKK silme (K-E5 KAPALI, 11.07.2026):** sistemdeki ilk gerçek silme akışı — **anında TAM silme, puan dahil**: müşteri satırı, auth kaydı, üyelikler, gönderimler, davetler, izleme ve puan kayıtları fiziksel silinir. Yalnızca parasal tarihçe (sipariş + harcama kayıtları) mutabakat dayanağı olarak kalır; kişi bağı koparılır ve satırlar **"Eczane X Müşteri N"** anonim etiketine çevrilir (`musteri_id` boşalır) — mutabakat toplamları bozulmaz, kişi verisi kalmaz. (Önceki anonimleştirme önerisi geçersizdir.)

## 4. Üretim hattı değişiklikleri

- **`hedef_rol` genişletmesi — Faz 0'ın ilk işi.** Üçüncü değer: `eczanem`. Bilinen borç `TakipSatiri.hedef_rol: "utt" | "bm"` dar tipi burada kapanır; ayrıca `hedef_rol` dallanan her nokta (talep formu — yalnızca PM'e görünür seçenek İP-§4.1, içerik türü/görünürlük türevleri, yayın listeleri) K3 envanteriyle çıkarılır. Tek tip tanımı `roller.ts`/ilgili tek kaynağa yazılır.
- **Yayına alma:** Eczanem hedefli yayında (a) tekrar periyodu alanı GİZLENİR, `tekrar_periyot_gun` NULL'a zorlanır (İP-§4.4 — server tarafında da doğrulanır), (b) barkod + Karşılık alanları zorunlu olur (K-E3 modeline göre ürün seviyesine yazılır), (c) ileri sarma/extra alanları anlamsızdır — form K4'te incelenip karar verilir.
- **Üretim zinciri (senaryo→video→soru) DEĞİŞMEZ** (İP-§4.2) — hedef_rol genişletmesi dışında bu katmana dokunulmaz.

## 5. Dağıtım ve tüketim

- **UTT ekranı:** "Eczanem" pill/sayfası — Eczanem yayınları + listesindeki eczaneler + aktif üye sayısı + eşik durumu; eşik altına gönderim server tarafında da reddedilir (İP-§5.2). Gönderim `eczanem_eczane_gonderimleri`'ne UNIQUE ile yazılır.
- **Eczane paneli (eczacı/teknisyen):** gelen videolar, üye listesi (yalnız son-4-hane), davet formu, tekil/toplu müşteri gönderimi (İP-§5.5 — toplu gönderim tek istekte, UNIQUE çakışmaları sessizce atlanır), sipariş onay kuyruğu (Faz 4), işlem dökümü.
- **Müşteri paneli:** kendine gönderilen videolar, izleme + soru akışı (mevcut izleme bileşenlerinin sade uyarlaması — kayıp yok, ileri sarma yok, İP-§6.1), bakiye ekranı (Eczane > Firma > Ürün kırılımı), fişler, "İndirim kullan", profil/silme.
- **İzlenme metriği HİÇBİR katmanda üretilmez** (İP-§6.2) — rapor veri katmanına Eczanem izleme verisi bilinçli olarak BAĞLANMAZ; bu bir eksik değil karardır, koda yorum olarak da yazılır.

## 6. Kasa akışı — atomik düşüm

Sipariş onayı tek RPC'de kesinleşir: `eczanem_siparis_onayla(siparis_id)` — transaction içinde: (1) sipariş `bekliyor` mu, (2) bakiye formülü yeniden hesaplanır (onay ANI esas — sipariş ile onay arasında puan yaşlanmış olabilir; hesap onayda güncellenir, K-E6), (3) FIFO düşüm: `created_at ASC` kayıtlardan `kalan_puan` azaltılır + `eczanem_harcama_kayitlari` satırları, (4) sipariş `onaylandi` + `islem_kodu` + `onay_tarihi`, (5) fiş verisi döner. Eşzamanlılık: aynı siparişe çift onay `durum` koşuluyla; aynı müşterinin iki siparişinin yarışması satır kilidiyle (RPC içinde `FOR UPDATE`) çözülür. Store sipariş RPC'leri desen emsalidir ama FIFO eşleme yenidir — K5'te mevcut store RPC'si incelenir.

Barkod→hesap adımı (İP-§8.1/2): barkod → ürün → bakiye → tarife → indirim; **adet indirimi çarpmaz** kuralı hesap fonksiyonunda tek yerde durur.

## 7. Görünürlük, raporlar, mutabakat dökümü

Tümü Faz 5; kaynak veriler Faz 4 sonunda hazırdır.
- **Eczane dökümü:** kendi işlemleri, ürün bazında toplam indirim (İP-§9.2).
- **UTT:** eczane × ürün toplamları (kutu + indirim TL) — mutabakatın sistem dayanağı (İP-§10.1).
- **BM/TM/yönetici:** mevcut "aynı sayfa, rol-bağımlı kapsam" cascade deseni birebir.
- **PM:** yeni desen — hiyerarşi değil ürün ekseni (kendi ürünleri, Türkiye geneli, bölge→UTT→eczane kırılımı, İP-§9.2). Başka PM'in ürünü görünmez — süzgeç PM↔ürün sahipliğinden.
- Kişi bazlı hiçbir veri hiçbir iç role akmaz (İP-§9.1/9.3) — sorgular en granüler eczane×ürün toplamında durur; müşteri FK'sı SELECT'lere hiç girmez.

## 8. Açık kararlar — İskender

- **K-E1 — SMS sağlayıcısı:** hangi firma (maliyet/sözleşme kararı)? Bu karar OTP mimarisini (Supabase native vs custom) de yönlendirir. (K-E8 sayesinde bu karar geliştirme akışını BLOKLAMAZ — yalnızca canlıya çıkış öncesi gerekir.)
- **K-E8 — OTP test modu: KAPALI (10.07.2026, İskender):** Canlı dışı ortamlarda SMS'siz sabit kod `123456`; production'da yapısal olarak devre dışı (çift kilit, bkz. §3). Test ortamına hiçbir ek yük getirmez.
- **K-E2 — Davet temizliği:** 24 saati dolan davet kaydının silinme mekanizması — sorgu-anı geçersiz sayma + periyodik temizlik mi, anlık silme mi? (Eğilim: sorgu-anı geçersiz + günlük temizlik; KVKK "kalıcı tutulmaz" şartını temizlik karşılar.)
- **K-E3 — Karşılık modeli:** ürün seviyesinde tek güncel tarife + tarihçe tablosu önerisi (bkz. §2) onaylanıyor mu? "Müşteri aleyhine değişmez" kuralının teknik yorumu: yeni tarife yalnızca ileriye mi işler?
- **K-E4 — İzleme/cevap puan değerleri: KAPALI (11.07.2026, İskender):** **Yayın başına** — kazanım puanları (izleme + cevap) PM ailesi tarafından üretim hattında belirlenir (mevcut `video_puani` + soru puanları; standart kanaldaki mekanizmanın aynısı, genel teknik raporda tanımlı). Sistem geneli ayar DEĞİL; yeni ayar anahtarı yok. İP-§7.3'teki "özel oran yok" ifadesi Karşılık'ın (puan↔TL) kademesizliğine dairdir, kazanım puanına değil. U7 ledger'ı bu değerleri yayından okur.
- **K-E5 — KVKK silme modeli: KAPALI (11.07.2026, İskender):** Anında TAM silme (puan dahil); parasal tarihçe "Eczane X Müşteri N" anonim etiketiyle kalır (bkz. §3).
- **K-E6 — Sipariş-onay arası bakiye değişimi:** onay anındaki güncel bakiye esas (indirim tutarı düşebilir) — müşteriye fark gösterilir mi, sipariş düşürülür mü?
- **K-E7 — RLS zamanlaması:** yeni tablolar migration'da RLS'li mi doğsun (önerim: evet — açık iş büyümesin), yoksa genel RLS işine mi bırakılsın?

## 9. Uygulama sırası ve durum takibi

*Kapanan her adım tiklenir; her U kendi KONTROL'üyle başlar, kod görülmeden yazım yapılmaz.*

**Kararlar (İskender):** 
- [x] K-E1 — SMS sağlayıcısı: Turkcell (10.07.2026, İskender; sözleşme/entegrasyon açık — B-13 ifade eşitleme 12.07.2026)
- [ ] K-E2 — Davet temizliği
- [x] K-E3 — Karşılık modeli: KAPALI (11.07.2026, İskender): ürün seviyesi tek güncel tarife + tarihçe (`eczanem_urun_tarifeleri`, U0'da hazır); yeni tarife YALNIZ İLERİYE işler (append-only, güncel = max(gecerlilik_baslangic ≤ now)); değer değişmediyse yeni satır açılmaz. Giriş yayına-almada, saklama ürün seviyesinde.
- [x] K-E4 — Puan değerlerinin yeri: KAPALI (11.07.2026): yayın başına (PM ailesi, mevcut video_puani + soru puanları; sistem ayarı değil)
- [x] K-E5 — KVKK silme modeli: kapalı karar (anında tam silme + anonim parasal tarihçe — §3, §8)
- [x] K-E6 — Onay anı bakiye kuralı: KAPALI (11.07.2026, İskender): onay anı esas (§93). U8 uygulaması: bakiye yaşlandıysa yalnız MEVCUT kadar düşülür; tümü yaşlanmışsa onay verilmez (sipariş 'bekliyor' kalır, eczacı reddeder); tarife müşteri aleyhine değişmez (sipariş anı snapshot).
- [ ] K-E7 — RLS zamanlaması
- [x] K-E8 — OTP test modu: kapalı karar (canlı dışı sabit 123456, çift kilit — §3)

**KONTROL'ler:**
- [x] K1 — Mevcut auth kurulumu → OTP mimari kararının teknik yarısı. **Bulgu (redbook §2.2/§2.4/§4.3, kodla teyit 11.07.2026):** Supabase Auth + `@supabase/ssr` çerez oturumu (`lib/supabase/server.ts`); AuthProvider herkesi `v_auth_kimlik`+`kimlik_turu` ile çözer; E-Club kişisi `auth.admin.createUser` (e-posta+şifre, geçici model) ile açılır; `eczanem_musteriler.auth_user_id` kolonu U0'da hazır — müşteri de Supabase auth user olur, telefon eşlemesi bu kolonla. **Mimari karar:** custom OTP tablosu + Supabase session (native phone auth DEĞİL — SMS'in Supabase'e bağlanmasını gerektirirdi, K-E1'i bloklar ve ince-bağımlılık felsefesine aykırı). Oturum üretimi: `auth.admin.generateLink(magiclink)` → SSR `verifyOtp(token_hash)` → çerez; müşteri auth kaydı sentetik e-posta ile.
- [x] K2 — Eczane/eczacı veri modeli → davet doğrulaması + eczane paneli zemini. **Bulgu (11.07.2026):** Eczacı/teknisyen telefonu `eclub_kisiler.telefon`; eczane bağı `eclub_kisi_eczane` (aktif_mi'li, kişi→tek aktif eczane); eczane kimliği `eclub_eczaneler.eczane_id`, adı GLN üzerinden `eclub_eczane_master` (ayrı sorgu + Map deseni). `eczanem_davetler` FK'ları hazır (eczane_id→eclub_eczaneler, davet_eden_kisi_id→eclub_kisiler). İP-§3.4 reddi: davet telefonu, o eczaneye aktif bağlı kişilerin normalize telefonlarıyla karşılaştırılır (eczane başına kişi sayısı küçük — JS tarafında). Dev DB'de `eclub_kisiler.telefon` şu an boş. **KRİTİK YAN BULGU — canlı bug (TB, Eczanem dışı):** `v_auth_kimlik` `auth.uid()` filtreli, ama `rolCozucu` onu service_role ile sorguluyor (service_role JWT'sinde `sub` yok → `auth.uid()` NULL → view boş). Canlıda doğrulandı: service_role sorgusu null dönüyor → rolCozucu commit'inden (dfcf82f, 09.07) beri 66 dosyadaki rol kontrolü herkesi reddediyor; fark edilmedi çünkü fiziksel testler push öncesi bekliyordu ve proxy view kullanmıyor (doğrudan `kullanicilar`). Onarım U2-SQL ile birleşik: filtresiz `v_auth_kimlik_admin` (yalnız service_role SELECT) + rolCozucu'nun ona geçmesi.
- [x] K3 — `hedef_rol` envanteri (grep: talep formu, üretim zinciri, görünürlük türevleri, TakipSatiri, yayın listeleri) → Faz 0 genişletme kapsamı. **Bulgu (11.07.2026):** 7 süzgeç dosyası + `get_izle_videolari` RPC'si pozitif süzüyor; tek sızıntı `lib/utils/anaSayfa/utt.ts` (süzgeçsiz `v_yayin_detay` okuması) idi — U0-kod'da pozitif süzgeçle kapatıldı. Yan gözlemler: (a) `get_izle_videolari`'na `p_rol` ham geçiyor, `kd_utt` hiçbir `hedef_roller` ile eşleşmiyor → kd_utt /izle listesi boş dönüyor olmalı; (b) talep formu Eczacı/Ecz.Tek. seçeneği sunuyor ama API `GECERLI_HEDEF_ROLLER=["utt","bm"]` ile reddediyor. İkisi de U0 dışı mevcut tutarsızlık.
- [x] K4 — Yayına alma formu + INSERT zinciri → barkod/Karşılık + periyot gizleme noktaları. **Bulgu (11.07.2026):** yayına alma `app/yayin-yonetimi/`; form satırı `_components/BekleyenSatir.tsx` (Video/Extra puan, Tekrar periyodu, İleri sarma; `b.hedef_rol` satırda), submit `_hooks/useYayinYonetimi.ts`, INSERT `api/yayinlar/route.ts` → `yayin_yonetimi`. **Kritik:** `hedef_rol` kullanıcıdan gelmiyor, talepten türüyor (`talepBilgisiSoruSeti`) — sunucu eczanem'i yeni tesisatsız biliyor. `extra_puan`/`tekrar_periyot_gun`/`ileri_sarma_acik` nullable. **Yan bulgu (düzeltildi U5):** `api/bekleyenler/route.ts` `filtrelenmis`'i hesaplayıp `sonuc`'u (filtresiz) dönüyordu → tüm sekmeler tüm bekleyenleri gösteriyordu.
- [x] K5 — Store sipariş RPC deseni + `sistem_ayarlari` okuma desenleri → atomik onay RPC emsali. **Bulgu (11.07.2026):** `store_siparis_olustur`/`iptal`/`teslim_aldim` RPC'leri TABLE döner, ilk satırda `ok`/`siparis_id`/`hata` (`lib/store/siparis.ts` çağrı deseni). Stok/bakiye/durum kontrolleri DB'de atomik. Eczanem'e FIFO eşleme + `kalan_puan` düşümü + 180g kayan pencere yeni; gerisi bu desende. `sistem_ayarlari.deger` **jsonb** — `#>>'{}'` ile okunur (RPC içinde `(deger#>>'{}')::int`).
- [x] K6 — Proxy güncel hâli → beşinci bekçinin ekleme noktası ve sıralaması. **Bulgu (11.07.2026):** proxy.ts = admin API bekçisi + 4 firma-bayrağı bekçisi (CC, HBStore, E-Club Store, E-Club), hepsi aynı desen: oturum yok → API 401 / sayfa login; bayrak kapalı → API 403 / sayfa ana-sayfa; "firma yoksa geçer". Sıralama dersi (/eclub/store → /eclub) bizim /eczanem/eczane → /eczanem sıralamamıza emsal. Eczanem bekçisi ROL tabanlı olur (rolCozucu ile; müşterinin/eczacının firması olmadığından firma-bayrağı deseni uygulanamaz — `eczanem_aktif` UTT ekranlarında, U6'da devreye girer). Ek bulgu: `eczanem_siparisler.musteri_etiket` + nullable `musteri_id` U0-SQL'de zaten hazır — K-E5'in şema yarısı kurulu; tek eksik `harcama_kayitlari.kaynak_kayit_id`'nin puan silmeye dayanması (U3-SQL).

**Uygulama:**
- [x] U0 — Faz 0: `hedef_rol` genişletmesi + migration seti + ayar anahtarları + `KORUMALI_TABLOLAR`. **Kapandı (11.07.2026):** U0-SQL (10 eczanem tablosu + `firmalar.eczanem_aktif` + `urunler.barkod` + 3 ayar anahtarı) + U0-kod commit `939330c` (HedefRol tek kaynak `lib/utils/roller.ts`, 'eczanem' değeri, TakipSatiri dar tipi kapandı, utt.ts pozitif süzgeci, KORUMALI_TABLOLAR) + `chk_talepler_hedef_rol` ALTER'ı canlıda doğrulandı. tsc + denetim + lint:mimari temiz. Not: U0 tabloları RLS'siz doğdu — K-E7 fiilen genel RLS işine kaldı (deploy-öncesi liste).
- [x] U1 — Faz 1a: OTP altyapısı (K1 mimarisiyle) — gönderim, doğrulama, oturum; test modu (K-E8) baştan gömülü, gerçek SMS entegrasyonu (K-E1) sona takılan parça. **Kapandı (11.07.2026):** `lib/utils/ortam.ts` (çift kilit tek kaynağı), `lib/sms/gonderici.ts` (provider-agnostik; canlı-dışı loglar, canlıda K-E1'e dek bilinçli hata), `lib/eczanem/telefon.ts` (kanonik 10 hane), `lib/eczanem/otp.ts` (üretim/hash/kayıt/doğrulama; 5 dk geçerlilik, 5 deneme, 60 sn yeniden-gönderim eşiği, tek kullanımlık kapatma; canlı-dışı sabit 123456), `lib/eczanem/oturum.ts` (sentetik e-posta + `musteriAuthSagla` kendini-onaran auth bağı + generateLink→verifyOtp çerez oturumu), `app/eczanem/api/giris/otp` + `giris/dogrula`. `eczanem_giris_otp` tablosu canlıda; tsc + denetim + lint:mimari temiz. **Duman testi geçti (local):** kod isteği → [SMS TEST] log; 123456 → `sb-*-auth-token` çerezi; yanlış kod → red + deneme sayacı; kayıtsız numara → davet mesajı; 60 sn eşiği → blok; `auth_user_id` kendini-onaran bağ yazıldı. Test verileri temizlendi. **Migration dersi (U2+ için):** bu DB'de yeni tablolar service_role'e DML vermeden doğuyor (yalnız REFERENCES/TRIGGER/TRUNCATE geliyor) — U0+U1 tablolarının tamamına `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE <tablo> TO service_role;` uygulandı (11.07.2026, anon/authenticated'a bilinçli verilmedi — RLS'siz tabloya en az yetki). Bundan sonraki her eczanem migration'ının sonuna aynı GRANT satırı eklenmeli.
- [x] U2 — Faz 1b: davet akışı + `v_auth_kimlik` genişletmesi + `rolCozucu` 'musteri'. **Kapandı (11.07.2026):** U2-SQL (v_auth_kimlik müşteri UNION'ı + `v_auth_kimlik_admin` onarım view'ı + `eczanem_davetler.deneme_sayisi`) canlıda; rolCozucu `v_auth_kimlik_admin`'e geçti (K2'deki kritik bug onarıldı — service_role artık rol görüyor, canlıda doğrulandı); `lib/eczanem/davet.ts` (oluşturma: aktif eczane bağı, İP-§3.4 normalize telefon reddi, zaten-üye reddi, bekleyen davet iptali, ayar tabanlı geçerlilik, OTP+SMS; kabul: deneme sınırı, sabit-kod K-E8, müşteri doğumu/yeniden aktifleşme, UNIQUE-sessiz üyelik bağı, davet kapanışı); eczacı ekranı `app/eczanem/eczane/` (form + son-4-hane maskeli liste, süresi dolan sorgu-anında 'suresi_doldu'; ilk hâli `app/eclub/eczanem/` idi, modül bağımsızlığı kararıyla taşındı — §3) + müşteri ekranı `app/eczanem/davet/` (KVKK + kod). `roller.ts`'e MUSTERI_ROLU. Duman testi uçtan uca geçti (KVKK reddi, yanlış kod+sayaç, kabul+çerez oturumu, mükerrer kabul reddi, girişsiz 401, rolCozucu='musteri'); test verileri temizlendi. **Açık uç:** KVKK metni placeholder — gerçek metin İskender'den gelince `app/eczanem/davet/page.tsx` içindeki `KVKK_METNI` değişecek. Müşteri paneli yönlendirmesi U3'ü bekliyor (başarı ekranı gösteriliyor).
- [x] U3 — Faz 1c: proxy beşinci bekçi + müşteri panel iskeleti + KVKK silme akışı (K-E5). **Kapandı (11.07.2026):** U3-SQL (harcama `kaynak_kayit_id` nullable + ON DELETE SET NULL) canlıda. Beşinci bekçi proxy'de: `/eczanem/*` ROL tabanlı (rolCozucu), özel dal `/eczanem/eczane` (eczacı/teknisyen) genel daldan önce; girişsiz istisnalar: `/eczanem/giris`, `/eczanem/api/giris/*`, `/eczanem/davet`, `/eczanem/api/davet-kabul`. `KimlikTuru` += 'musteri' (AuthProvider çıkışı müşteri yollarında `/eczanem/giris`'e, login güvenlik ağı `/eczanem`'e). Müşteri girişi `/eczanem/giris` (2 adım), panel iskeleti `/eczanem` (video/puan placeholder + profil), KVKK silme `lib/eczanem/silme.ts` + `silme-otp`/`sil` API'leri (OTP teyitli, İP-§3.6). **Duman testi geçti:** bekçi 5 senaryo (oturumsuz yönlendirmeler, istisnalar, 401), müşteri çerezle rol yönlendirmeleri, silme uçtan uca — kişisel kayıtlar 0'landı, sipariş `musteri_id=NULL` + `musteri_etiket='Müşteri 1'` ile kaldı (parasal iz korundu), auth kaydı silindi, bayat çerez girişe düştü. Test verileri temizlendi.
- [x] U4 — Faz 2a: PM talep akışında 'eczanem' hedefi (İP-§4.1) — yalnız PM'e görünür. **Kapandı (11.07.2026):** `roller.ts`'e `ECZANEM_TALEP_ACAN_ROLLER = [pm, jr_pm, kd_pm]` (ürün müdürü ailesi — yetenekler.ts "kıdem unvanları, yetenek olarak özdeş" gerekçesiyle; yalnız 'pm'e daraltılacaksa tek satır). Form: hedef seçeneği yalnız bu ailede render edilir; eczanem'de teknik gizlenir/temizlenir (E-Club deseni), ürün tür kuralından bağımsız zorunlu (dörtlü kilit, İP-§4.3). API: `GECERLI_HEDEF_ROLLER` += eczanem + rol şartı (403) + teknik gevşetme + ürün şartı; `insertTeknikId` eczanem'de her hâlükârda NULL. **Duman testi (gerçek UI, geçti):** test PM login → 5. seçenek amber "Eczane Müşterileri" görünür → seçince Teknik alanı kayboldu → Fluzon'la talep oluştu (DB: hedef_rol=eczanem, teknik_id=NULL, icerik_turu=urun) → ürünsüz POST 400; test egt_md login → seçenek YOK → API POST 403 "yalnızca Ürün Müdürü". Test talep+bildirim+kullanıcılar temizlendi.
- [x] U5 — Faz 2b: yayına alma — barkod + Karşılık (K-E3), periyot gizleme/NULL zorlaması, server doğrulamaları. **Kapandı (11.07.2026):** yeni `lib/eczanem/tarife.ts` (barkod UPDATE + tarife INSERT tek-kaynağı; append-only, değer aynıysa satır açmaz — K-E3); `eczanem_urun_tarifeleri` → `KORUMALI_TABLOLAR`. API `yayinlar/route.ts` eczanem dalı: barkod+Karşılık zorunlu, `extra_puan`/`ileri_sarma_acik`/`tekrar_periyot_gun` NULL-zorlama, tarife yayından ÖNCE yazılır (canlı yayının daima tarifesi olsun). Form (`BekleyenSatir.tsx`) eczanem satırında extra/tekrar/ileri gizli → barkod + Karşılık (puan=TL); Yayınla kapısı bu alanları arar; video + soru puanları durur. `ANA_SEKMELER += eczanem`; `bekleyenler` süzgeç hatası düzeltildi (K4 yan bulgusu). Yeni SQL yok — tarife GRANT'i U0+U1 toplu GRANT'inde alındı. **tsc + denetim + lint:mimari temiz. DUMAN TESTİ YAPILMADI** — eczanem bekleyen videosu + PM login gerektiriyor; uçtan uca doğrulama İskender'in fiziksel testine (U10) bırakıldı.
- [x] U6 — Faz 2c: UTT Eczanem ekranı (liste + eşik + gönderim) + eczane paneli gönderim (tekil/toplu, UNIQUE teklikler). **Kapandı (11.07.2026):** yeni `lib/eczanem/gonderim.ts` dağıtım zincirinin tek kaynağı — UTT tarafı (`uttEczanemVerisi`: takım Eczanem yayınları + `eclub_eczane_firma` baglayan_utt_id=user.id eczaneleri + `eczanem_uyelikler` aktif üye sayısı + eşik durumu + zaten gönderilmiş çiftler; `eczaneyeGonder`: sahiplik+yayın+eşik server doğrulaması → `eczanem_eczane_gonderimleri` UNIQUE(yayin_id,eczane_id)), eczane tarafı (`eczaneGelenVideolar`, `eczaneAktifUyeler` son-4-hane, `musteriyeGonder`: video eczaneye gelmiş+aktif üye+UNIQUE(yayin_id,musteri_id) sessiz atlama, tekil/toplu tek istek). UTT ekranı `app/eczanem/utt/` (yayın seç → eczane listesi + Gönder, eşik altı buton kapalı); eczacı sayfasına (`app/eczanem/eczane/page.tsx`) Video Dağıtımı bölümü (gelen video seç + üye checkbox tekil/toplu). Proxy'ye 3. dal `/eczanem/utt` (`TUKETICI_ROLLER`, girişsiz→/login); Navbar'a `eczanem_aktif` bayraklı "Eczanem" pill'i (utt/kd_utt — K6: firma bayrağı UTT ekranında burada devreye girdi); `/profil/api` + `FIRMA_KOLONLARI` sabitine `eczanem_aktif` eklendi. **Karar teyitleri:** `baglayan_utt_id`=`kullanici_id`=auth id (canlı: user oluşturmada `kullanici_id: authData.user.id`), `gonderen_utt_id` FK'sız düz uuid→user.id, `gonderen_kisi_id`→eclub_kisiler.kisi_id, `eczanem_uyelikler.aktif_mi` (dokümandaki `durum` değil), eşik canlı=10. Yeni SQL yok — üç tablo + eşik ayarı + GRANT'ler U0/U1'de hazırdı. **tsc + denetim + lint:mimari temiz. DUMAN TESTİ YAPILMADI** (U5 gibi) — mutlu yol UTT girişi + eczanem yayını + eşiği karşılayan bağlı eczane + aktif üye + eczacı oturumu gerektirir (canlı fixture); uçtan uca doğrulama İskender'in fiziksel testine (U11) bırakıldı.
- [x] U7 — Faz 3: müşteri izleme + soru + kazanım yazımı (`lib/eczanem/` tek-kaynak, kayıpsız model, dörtlü denormalizasyon). **Kapandı (11.07.2026):** yeni `lib/eczanem/kazanim.ts` kazanım ledger'ının tek kaynağı — `kazanimKaydet` (dörtlü kilit `musteri_id`+`eczane_id`+`firma_id`+`urun_id` kayıt anında denormalize; `urun_id`=`get_urun_from_yayin` RPC, `firma_id`=urunler.firma_id; `kalan_puan`=puan taze; `eczanem_puan_kayitlari`) + `kazanimVarMi` (ömür boyu teklik — ledger yayin_id tutmaz, izleme_id üzerinden köprü). `musteriKimligi` yardımcısı `lib/eczanem/oturum.ts`'e (auth→aktif müşteri). İzleme akışı 5 route (`app/eczanem/api/`): `videolar` (gönderilen videolar + izleme/soru durumu), `izleme/baslat` (gönderime bağlı izleme), `izleme/bitir` (tamamla + ilk izleme & video_puani>0 → izleme kazanımı), `izleme/sorular` (rastgele N soru, dogru sızmaz), `izleme/cevapla` (KAYIPSIZ — yalnız doğru cevap × soru_puani kazanımı, yanlış hiç kayıt üretmez). Müşteri paneli (`app/eczanem/page.tsx`) placeholder yerine gerçek video listesi + `_components/EczanemVideoOynatici.tsx` (E-Club oynatıcısının Eczanem/amber uyarlaması: baslat→oynat→bitir→sorular→cevapla). **Emsal:** E‑Club panelinin atomik tamamlama ve cevap kaydı akışı (üç farkla: kayıpsız, dörtlü kilit, tur yok/ömür boyu). **Karar teyitleri:** K-E4 KAPALI (yayın başına video_puani/soru_puani, PM ailesi); `eczanem_izleme_kayitlari` gonderim_id bağlı; `eczanem_puan_kayitlari.puan_turu`∈{izleme,cevap}. Yeni SQL yok — iki tablo + `get_urun_from_yayin` RPC + GRANT'ler U0/U1'de hazırdı; INSERT tek-kaynak `eczanem_puan_kayitlari` zaten KORUMALI_TABLOLAR'da (U5). **tsc + denetim + lint:mimari temiz. DUMAN TESTİ YAPILMADI** (U5/U6 gibi) — mutlu yol müşteri oturumu + tam dağıtım zinciriyle (UTT→eczane→müşteri) gelmiş video + video_url + soru gerektirir (canlı fixture); uçtan uca doğrulama İskender'in fiziksel testine (U11) bırakıldı.
- [x] U8 — Faz 4: barkod→hesap ekranı + sipariş + `eczanem_siparis_onayla` RPC (FIFO, atomik) + fiş + eczacı onay kuyruğu. **Kapandı (11.07.2026), RPC canlıda:** yeni `lib/eczanem/kasa.ts` kasa akışının TS tek-kaynağı — `urunBakiyesi` (Σ kalan_puan, `eczanem_puan_omru_gun` kayan pencere), `barkodHesap` (barkod→ürün→üyelik→tarife→indirim; İP-§8.2 adet çarpmaz), `siparisOlustur` (puan DÜŞMEZ, `bekliyor`, tarife_snapshot alınır — K-E3), `siparisOnayla` (RPC sarmalayıcı), `siparisReddet` (bekliyor→dustu, düşüm yok), `musteriEczaneleri` (İndirim kullan dropdown). **Atomik onay DB RPC'sinde:** `eczanem_siparis_onayla(p_siparis_id)` — sipariş FOR UPDATE + durum kontrolü → tarife_snapshot ile hesap → FIFO düşüm (`created_at ASC`, `kalan_puan` azalt + `eczanem_harcama_kayitlari`) → `onaylandi`+islem_kodu+onay_tarihi → fiş (TABLE döner, store deseni). **SQL `U8_eczanem_siparis_onayla.sql` İskender tarafından Supabase'de çalıştırıldı; `npm run denetim:sema` ile snapshot yenilendi — RPC canlıda, denetim+lint temiz.** Route'lar: müşteri `app/eczanem/api/siparis` (GET eczaneler+siparişler, POST oluştur) + `siparis/hesap` (önizleme) + `siparis/vazgec`; eczacı `app/eczanem/eczane/api/siparisler` (GET kuyruk, POST onayla/reddet). UI: müşteri paneline `_components/EczanemKasa.tsx` (eczane seç→barkod→hesap→adet→gönder + siparişler/fişler), eczacı sayfasına `_components/EczanemSiparisKuyrugu.tsx` (bekleyen→Onayla/Reddet + geçmiş). Müşteri son-4-hane (İP-§9.2); silinmişte musteri_etiket. **K-E6 uygulaması:** onay anı esas — bakiye yaşlandıysa yalnız mevcut kadar düşülür; tümü yaşlanmışsa onay verilmez (sipariş 'bekliyor' kalır, eczacı reddeder). Tarife müşteri aleyhine değişmez (snapshot). **tsc temiz; denetim/lint yalnız yeni RPC'yi bekliyor.** DUMAN TESTİ YAPILMADI — SQL + tam zincir fixture gerektirir, U11'e. **Açık uç:** müşteri bakiye kırılım ekranı (Eczane>Firma>Ürün, §88) İndirim-kullan hesabıyla kısmen karşılandı; ayrı döküm ekranı istenirse eklenir.
- [x] U9 — Faz 5: görünürlük katmanları (eczane dökümü, UTT eczane×ürün, cascade, PM ürün ekseni). **Kapandı (12.07.2026):** yeni `lib/eczanem/dokum.ts` görünürlüğün SALT-OKUMA tek kaynağı — kaynak `eczanem_siparisler` (durum='onaylandi', dönem süzgeci onay_tarihi); `musteri_id` hiçbir SELECT'e girmez (İP-§9.1/9.3), izlenme metriği üretilmez (İP-§6.2, kod yorumuyla sabit). Dört katman (İP-§9.2): `eczaneDokumu` (eczacı: ürün×kutu+TL), `uttDokumu` (eczane×ürün — mutabakat dayanağı İP-§10.1), `cascadeDokumu` (BM bölge / TM takım / yönetici firma; UTT→eczane bağı `eclub_eczane_firma` aktif bağ üzerinden), `pmUrunDokumu` (ürün ekseni: Türkiye + bölge→UTT→eczane kırılımı; sahiplik `urunler.takim_id` — başka takımın ürünü yapısal girmez). Route'lar: eczacı `eczane/api/dokum`, UTT `utt/api/dokum`, iç roller tek uç `raporlar/api/eczanem` (rol→kapsam sunucuda; `eczanem_aktif` bayrağı kapalıysa `aktif:false` → bölüm hiç görünmez — K6 kararının rapor yarısı). UI: eczacı sayfasına İşlem Dökümü, UTT sayfasına Mutabakat Dökümü (yayın olmasa da görünür), 4 rapor sayfasına (bm/tm/yonetici/uretici) paylaşılan `EczanemDokumBolumu` (PM-dışı üretici rollerde 403→gizli; her bölümün kendi periyot pill'i — mutabakat ayrı süreç). Yeni sayfa/bekçi/nav YOK (önceki oturum kararı); yeni SQL yok. **tsc + denetim + lint:mimari temiz. DUMAN TESTİ YAPILMADI** (U5–U8 gibi) — onaylı sipariş fixture'ı gerektirir; uçtan uca doğrulama U11'de (görünürlük sınırları zaten U11 listesinde).
- [ ] U10 — Doğrulama: tsc + lint:mimari + denetim her fazda; faz sonlarında ara fiziksel testler
- [ ] U11 — Uçtan uca fiziksel test (İskender): davet→OTP→üyelik, eşik, gönderim teklikleri, izleme→kazanım, dörtlü kilit sızmazlığı, FIFO/180 gün senaryosu, sipariş→onay→fiş→mükerrer onay reddi, KVKK silme sonrası toplamların korunumu, görünürlük sınırları (kişi verisi sızmıyor), İP-§11 risk tablosunun satır satır sağlaması
- [x] U12 — Redbook güncellemesi: Eczanem bölümü (üçüncü katman) + değişen kesitler. **Kapandı (12.07.2026, U10/U11'den önce öne çekildi — İskender talimatı):** redbook'a yeni Bölüm 5 "Üçüncü Müşteri Katmanı — Eczanem" (5.1 kimlik/üyelik/KVKK, 5.2 üretim+dağıtım, 5.3 tüketim+puan, 5.4 kasa, 5.5 görünürlük); eski Bölüm 5 → 6 renumaralandı (tüm §5.x referansları dahil). Değişen kesitler: başlık "üç katmanlı", §1.2 üçüncü katman tanıtımı, §2.2 üç kimlik düzlemi + `v_auth_kimlik_admin` + beşinci firma bayrağı, §2.3 MUSTERI_ROLU + HedefRol, §2.4 altıncı bekçi + rolCozucu güncellemesi, §2.8 beş hedef değeri. §6.4 teknik borç güncel: Eczanem kapananları (U0–U9), RLS +11 eczanem tablosu, Eczanem canlı ön koşulları (K-E1 blokör, K-E2, KVKK metni), Eczanem U10/U11 fiziksel testleri ve Vercel push maddesi doğrulama bloğunda; E-Club OTP maddesi paylaşılabilir altyapıya bağlandı.

**Teknik borç etkisi:** `hedef_rol` dar tipi borcu U0'da kapanır. Yeni borç üretmeme hedefi: RLS (K-E7 evet ise), izlenme-metriği-yok kararının kod yorumlarıyla sabitlenmesi, FIFO ledger'ın denetim scriptine doğal girişi.
