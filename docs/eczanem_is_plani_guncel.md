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
