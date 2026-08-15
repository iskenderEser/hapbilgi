# HapBilgi — Teknik Rapor

*Üç katmanlı öğrenme ekosisteminin veritabanı, backend ve frontend yapısı*

*Sürüm: Tamamlandı — Bölüm 1–6. Temmuz 2026. Güncellemeler (29.07.2026): **Üretim hattının yeniden kurulması işlendi** — değişen kesitler: §2.6 (arayüz merkezleri: pill + liste), §2.7 (Bunny doğrudan yükleme/vezne modeli, dikey video ve oranlı çerçeve), §2.8 (dört üretim varyantı, zincirin talebe doğrudan bağlanması, durum sözlüğü, firma-önekli talep kimliği), §3.1 (üretim ekranlarının giriş disiplini, Yayındaki Videolar), §6.1 (talep ve yayın silme), §6.4 (fiziksel test turları ve zincir kırıkları kapananlara işlendi). Önceki güncellemeler (18.07.2026): **Admin modernizasyonu işlendi** (M0–M3 + M2 bilgi mimarisi + upsert aşaması + T-serisi; değişen kesitler: §2.2, §2.4, §6.1 yeniden yazıldı, §6.2, §6.4) ve **Web Push kod üretimi tamam** (P0–P7 + K-P12, 16–18.07; "push bekletiliyor" durumu artık yalnız canlıya alma içindir). Daha önceki güncellemeler: Eczanem üçüncü müşteri katmanı (12.07.2026 — yeni Bölüm 5 + değişen kesitler: §1.2, §2.2–2.4, §2.8, §6.4; U0–U9 kod üretimi tamam, commit'lerde), Tekrar Gönderim Modeli + Ekstra İzlediklerim (10.07.2026). Fiziksel insan testleri (U10/U11 + Tekrar Gönderim U10 + Ekstra U7 + admin toplu yükleme), RLS ve diğer deploy-öncesi mecburi işler §6.4'te teknik borç olarak listelidir.*

---

## İçindekiler

- [1. Genel Bakış](#1-genel-bakış)
  - [1.1 HapBilgi nedir — iki katmanlı öğrenme ekosistemi](#11-hapbilgi-nedir--iki-katmanlı-öğrenme-ekosistemi)
  - [1.2 İki müşteri katmanı: iç müşteri (saha) ve dış müşteri (eczane)](#12-iki-müşteri-katmanı-iç-müşteri-saha-ve-dış-müşteri-eczane)
  - [1.3 Öğrenme zinciri: üretim → tüketim → ölçüm → ödül](#13-öğrenme-zinciri-üretim--tüketim--ölçüm--ödül)
  - [1.4 Raporun kapsamı ve okuma rehberi](#14-raporun-kapsamı-ve-okuma-rehberi)
- [2. Ortak Temel Katman](#2-ortak-temel-katman)
  - [2.1 Teknik altyapı ve stack](#21-teknik-altyapı-ve-stack)
  - [2.2 Kimlik ve hiyerarşi](#22-kimlik-ve-hiyerarşi)
  - [2.3 Roller ve yetki modeli](#23-roller-ve-yetki-modeli)
  - [2.4 Erişim & güvenlik mimarisi](#24-erişim--güvenlik-mimarisi)
  - [2.5 Veri modeli felsefesi](#25-veri-modeli-felsefesi)
  - [2.6 Katman ayrımı — route = orkestrasyon, lib = iş mantığı](#26-katman-ayrımı--route--orkestrasyon-lib--iş-mantığı)
  - [2.7 Ortak servis soyutlamaları — provider-agnostik video](#27-ortak-servis-soyutlamaları--provider-agnostik-video)
  - [2.8 İçerik Üretim Hattı — üç katmanı besleyen tek motor](#28-i̇çerik-üretim-hattı--üç-katmanı-besleyen-tek-motor)
- [3. İç Müşteri Katmanı — Saha Ekibi (UTT + BM)](#3-i̇ç-müşteri-katmanı--saha-ekibi-utt--bm)
  - [3.1 Tüketim — izleme, puanlama, öneri](#31-tüketim--izleme-puanlama-öneri)
  - [3.2 Raporlar — rol bazlı ölçüm](#32-raporlar--rol-bazlı-ölçüm)
  - [3.3 Challenge Club (yönetici öğrenmesi — BM)](#33-challenge-club-yönetici-öğrenmesi--bm)
  - [3.4 Ligler — HBLigi ve Challenge Club Ligi](#34-ligler--hbligi-ve-challenge-club-ligi)
  - [3.5 HBStore (iç ödül)](#35-hbstore-iç-ödül)
- [4. Dış Müşteri Katmanı — Eczane (Eczacı + Eczane Teknisyeni)](#4-dış-müşteri-katmanı--eczane-eczacı--eczane-teknisyeni)
  - [4.1 E-Club — Liste yönetimi](#41-e-club--liste-yönetimi-eczanekişi-gln--master-utt-bağı)
  - [4.2 E-Club — Öneri ve tüketim](#42-e-club--öneri-ve-tüketim-izlemepuanlama)
  - [4.3 E-Club — Kimlik, bildirim, kişi paneli](#43-e-club--kimlik-bildirim-kişi-paneli)
  - [4.4 E-Club Ligi](#44-e-club-ligi-utt-koçluk-sıralaması-gönderipuanı)
  - [4.5 E-Club Store](#45-e-club-store-dış-ödül-çok-firmalı-bakiye)
- [5. Üçüncü Müşteri Katmanı — Eczanem (Eczanenin Kendi Müşterisi)](#5-üçüncü-müşteri-katmanı--eczanem-eczanenin-kendi-müşterisi)
  - [5.1 Kimlik ve üyelik — telefon+OTP, davet, KVKK tam silme](#51-kimlik-ve-üyelik--telefonotp-davet-kvkk-tam-silme)
  - [5.2 Üretim ve dağıtım — eczanem hedefi, tarife, iki kademeli gönderim](#52-üretim-ve-dağıtım--eczanem-hedefi-tarife-iki-kademeli-gönderim)
  - [5.3 Tüketim ve puan — kayıpsız model, dörtlü kilit, 180 gün + FIFO](#53-tüketim-ve-puan--kayıpsız-model-dörtlü-kilit-180-gün--fifo)
  - [5.4 Kasa akışı — barkod→hesap→sipariş→atomik onay→fiş](#54-kasa-akışı--barkodhesapsiparişatomik-onayfiş)
  - [5.5 Görünürlük — kişi gizli, toplam görünür](#55-görünürlük--kişi-gizli-toplam-görünür)
- [6. Kesişen / Operasyonel Katman](#6-kesişen--operasyonel-katman)
  - [6.1 Yönetim paneli (admin)](#61-yönetim-paneli-admin)
  - [6.2 Kalite & denetim altyapısı](#62-kalite--denetim-altyapısı)
  - [6.3 Dağıtım & ortam](#63-dağıtım--ortam)
  - [6.4 Açık işler, teknik borç, deploy-öncesi mecburi işler](#64-açık-işler-teknik-borç-deploy-öncesi-mecburi-işler)
- [7. HapBilgi Geliştirme Adımları (Modül ve Tarih)](#7-hapbilgi-geliştirme-adımları-modül-ve-tarih)
  - Kuruluş — ilk yapı (20.03–29.04.2026)
  - Genel Sistem'e geçiş ve eğitim türü ayrımı (01.05.2026)
  - Rol sisteminin merkezîleştirilmesi (06.05.2026)
  - Talepler sayfasının parçalanması (09.06.2026)
  - Yetki, lig periyodu ve firma bazlı modül anahtarları (27–29.06.2026)
  - E-Club Ligi (03.07.2026) · E-Club Store (05.07.2026)
  - Denetim altyapısı ve mimari bekçiler (06.07.2026)
  - Tekrar Gönderim Modeli ve Ekstra İzlediklerim (10.07.2026)
  - Eczanem — üçüncü müşteri katmanı (10–12.07.2026)
  - Teknik kalite kontrol taraması (12.07.2026)
  - Yayın yönetimi iyileştirmeleri (13.07.2026)
  - Web Push bildirim katmanı (16–18.07.2026)
  - Admin modernizasyonu (17–18.07.2026)
  - Bunny doğrudan yükleme — vezne modeli (19.07.2026)
  - Dört üretim varyantının tanımlanması (19.07.2026)
  - Fiziksel test turu — F-01…F-07 (19.07.2026)
  - Üretim ekranlarının giriş disiplini (20.07.2026)
  - PM ve İÜ fiziksel test turu (21.07.2026)
  - PM hazır video fiziksel test turu (21.07.2026)
  - Zincirin talebe doğrudan bağlanması (22–23.07.2026)
  - Yayındaki Videolar sayfası (23.07.2026)
  - Firma-önekli talep numarası — gösterim (23.07.2026)
  - Talep ve yayın silme (24.07.2026)
  - Zincir kırıklarının kapatılması (25.07.2026)
  - Durum sözlüğü ve iletişim kartı (25.07.2026)
  - Toast merkezi ve mimari bekçi (26.07.2026)
  - Dikey video ve oranlı çerçeve (26.07.2026)
  - Pill ve liste merkezleri (27.07.2026)
  - Üretici ana sayfası — 43 sorgu → 2 (27.07.2026)
- [8. Kullanıcı Bilgilendirme Ekleri](#8-kullanıcı-bilgilendirme-ekleri)
  - [8.1 UTT video izleme, ileri sarma ve soru hakkı](#81-utt-video-izleme-ileri-sarma-ve-soru-hakkı)

---

## 1. Genel Bakış

### 1.1 HapBilgi nedir — iki katmanlı öğrenme ekosistemi

HapBilgi, ilaç sektörüne özgü, video tabanlı bir B2B e-öğrenme platformudur. Çıkış noktası, bu sektörde bilginin doğruluğunun doğrudan insan sağlığına dokunması; dolayısıyla bir ürünün doğru anlatılması yalnızca ticari değil, aynı zamanda etik bir sorumluluktur.

Platformun kendini bir "eğitim yazılımı"ndan ayıran yanı, öğrenmeyi kopuk derslerin toplamı olarak değil, bilginin üretildiği yerden başlayıp son karar noktasına kadar uzanan **tek bir öğrenme zinciri** olarak ele almasıdır. Amaç sade: doğru bilgiyi, doğru kişiye, doğru zamanda ulaştırmak ve bu süreci ölçülebilir, sürdürülebilir ve adil kılmak.

Bu raporun mimari omurgasını belirleyen kritik gözlem şudur: HapBilgi iki farklı müşteri kitlesine hizmet eder, ama bunu iki ayrı program olarak değil, **aynı motorun beslediği tek ekosistem** olarak yapar. Aynı içerik üretim hattı, hedeflenen role göre hem sahadaki temsilciye hem eczane rafındaki uzmana içerik üretir. İki dünya ayrı yaşar ama tek kaynaktan öğrenir.

### 1.2 İki müşteri katmanı: iç müşteri (saha) ve dış müşteri (eczane)

**İç müşteri — firmanın kendi insanları.** Ürün Tanıtım Temsilcileri (UTT) ve onları yöneten Bölge Müdürleri (BM). Bunlar ürünü öğrenen ve sahada anlatan kişilerdir. Sistem içinde tam anlamıyla kullanıcıdırlar: firma → takım → bölge hiyerarşisine bağlı, kendi kimlik ve rolleriyle otururlar.

**Dış müşteri — sahanın diğer ucundaki uzmanlar.** Eczacılar ve eczane teknisyenleri. Ürünün hastayla buluştuğu son karar noktasıdırlar. Bunlar firmanın çalışanı değildir; HapBilgi'nin doğrudan kullanıcısı da sayılmazlar. Ayrı bir kimlik düzleminde yaşarlar ve sisteme kendilerini ekleyen UTT aracılığıyla bağlanırlar.

Bu ayrımın iki yapısal sonucu var ve rapor boyunca belirleyici olacak. Birincisi, iç müşteri tek bir firmaya doğrudan bağlıyken, dış müşteri **çok firmalı** olabilir — aynı eczacıyı farklı firmaların temsilcileri ekleyebilir, dolayısıyla o eczacı birden fazla firmanın içeriğini görür ve puanını ayrı ayrı biriktirir. İkincisi, iki katman **aynı öğrenme iskeletini** paylaşır (izle → puan kazan → sıralamada yer al → ödül) ama bu iskeleti ayrı düzlemlerde, birbirine karışmadan yaşar. Bu izolasyon bilinçli bir tasarım ilkesidir.

Ekosistemin özgün değeri tam da bu iki katmanı birbirine bağlamasında: temsilci öğrendikçe daha iyi anlatır, eczacı daha iyi dinlediğinde daha iyi öğrenir, ve bu iyi öğrenme güven olarak temsilciye geri döner. Ziyaret bir satış anından bir öğrenme buluşmasına evrilir.

**Üçüncü katman — Eczanem (Temmuz 2026).** Zincir bir halka daha uzadı: eczanenin **kendi müşterisi**. Eczacı, sözlü rızasını aldığı müşterisini telefonla davet eder; müşteri kendisine gönderilen ürün videosunu izleyip puan kazanır ve bu puanı aynı eczanede, aynı üründe TL indirimi olarak kullanır. Bu katman ne iç müşteridir ne E-Club kişisi — üçüncü bir kimlik düzleminde (telefon+OTP) yaşar, kendi puan-yaşlandırma modeli (180 gün + FIFO) ve kendi kasa akışı vardır. Aynı üretim motoru üçüncü hedefi de besler (`hedef_roller = ['eczanem']`). Ayrıntı Bölüm 5'tedir; iş kuralları `docs/ECZANEM.MD`'de yaşar.

### 1.3 Öğrenme zinciri: üretim → tüketim → ölçüm → ödül

Her iki katman da aynı dört halkalı döngü üzerinde çalışır; katmanlar arasındaki fark, halkaların hangi yapılar ve roller üzerinden döndüğüdür.

**Üretim** — bilginin doğduğu yer. Sahaya inecek her içerik özenle hazırlanır, gözden geçirilir ve onaylanır (talep → senaryo → video → soru seti → yayın). Buradaki değer görünmezdir ama belirleyicidir: sahaya yanlış hiçbir şeyin inmemesini sağlar. Bu tek motor, hedeflenen role göre hem iç hem dış müşteri içeriğini üretir.

**Tüketim** — öğrenmenin gerçekleştiği an. İçerik izlenir, sorular çözülür, puan kazanılır. Amaç, öğrenmeyi bir zorunluluktan bir alışkanlığa çevirmek; ezberi değil anlamayı hedeflemek.

**Ölçüm** — görünmeyeni görünür kılmak. Kimin ne öğrendiği, kimin nerede desteğe ihtiyacı olduğu şeffaf biçimde ortaya konur. Ama bunu bir "denetim" soğukluğuyla değil, bir "gelişim aynası" sıcaklığıyla yapar; kimse karanlıkta kalmaz.

**Ödül** — emeğin takdir görmesi. Öğrenme emeği görülüp karşılık bulmadığında sürdürülemez. Ligler emeği bir toplulukta görünür kılar, mağazalar ise somut takdire dönüştürür. Buradaki rekabet bir baskı aracı değil, motivasyon kaynağıdır — herkes başkasıyla değil, dünkü kendisiyle yarışır.

Sonuçta ortaya çıkan bir yazılım değil bir kültürdür: öğrenmenin sürekli, adil, ölçülebilir ve karşılıklı olduğu bir kültür.

### 1.4 Raporun kapsamı ve okuma rehberi

Bu rapor HapBilgi'nin güncel teknik yapısını — veritabanı, backend ve frontend katmanlarını — belgeler. Ancak amaç yalnızca bir tablo, dosya ve endpoint listesi çıkarmak değil; sistemi kendi çalışma mantığına, yani iki müşteri katmanlı öğrenme ekosistemine sadık biçimde anlatmaktır. Bu nedenle rapor teknik envanteri modüllerin işlevi etrafında örgütler.

**Yapı.** Rapor iki müşteri katmanını omurga alır. Önce her iki katmanın üzerinde durduğu **ortak temel** (altyapı, kimlik, güvenlik, veri modeli felsefesi ve iki katmanı birden besleyen içerik üretim hattı) gelir. Ardından **iç müşteri katmanı** (saha ekibinin tüketim, rapor, challenge, lig ve store modülleri) ve **dış müşteri katmanı** (eczane tarafının E-Club modülleri) ayrı ayrı ele alınır. En sonda iki katmana birden hizmet eden **kesişen/operasyonel** konular (yönetim paneli, kalite-denetim altyapısı, dağıtım, açık işler) yer alır.

**Referans hiyerarşisi.** Rapor canlı sistemi yansıtmayı hedefler. Kaynaklar arasında çelişki olduğunda öncelik sırası şudur: gerçek veritabanı şeması > gerçek proje dosya dizini > doğrulanmış iş akışı > geçmiş belgeler. Yani bu rapor, tarihsel devir notlarını değil, sistemin bugünkü fiili durumunu esas alır.

**Kaynaklar.** İçerik üç kaynaktan süzülmüştür: sistemin niyet ve felsefesini tanımlayan değer metni, teknik tarihçeyi ve mimari kararları taşıyan devir belgesi, ve gerektiğinde doğrudan veritabanı/kod doğrulaması.

---

## 2. Ortak Temel Katman

Bu bölüm, tüm müşteri katmanlarının üzerinde durduğu ortak zemini tanımlar: teknik altyapı, kimlik ve hiyerarşi, roller, erişim güvenliği, veri modeli felsefesi, katman ayrımı, ortak servis soyutlamaları ve katmanları birden besleyen içerik üretim hattı.

### 2.1 Teknik altyapı ve stack

HapBilgi, tek bir Next.js uygulaması içinde hem frontend'i hem backend'i (API route'ları) barındıran bütünleşik bir yapıdır. Aşağıdaki tablo, sistemin dayandığı teknoloji katmanlarını ve her birinin rolünü özetler.

| Katman | Teknoloji | Sürüm | Rol |
|---|---|---|---|
| Framework | Next.js (App Router) | 16.2.0 | Frontend sayfaları + backend API route'ları tek projede |
| UI kütüphanesi | React | 19.2.4 | Bileşen katmanı; React Compiler derleme optimizasyonu açık |
| Dil | TypeScript | 5.x | `strict: true`; tip güvenliği zorunlu |
| Stil | TailwindCSS | 4.x | `@theme` tabanlı kurumsal renk sistemi |
| Veritabanı & Auth | Supabase (PostgreSQL) | `@supabase/ssr` + `@supabase/supabase-js` | Frankfurt bölgesi; kimlik doğrulama + veri |
| Grafik | ECharts | 6.1.0 | Rapor ve lig grafikleri |
| Elektronik tablo | SheetJS (xlsx) | 0.18.5 | Excel dışa aktarma (firma yaşam döngüsü, E-Club Ligi) |
| Video CDN | Bunny.net | (SDK yok — env/HTTP) | Video barındırma ve oynatma |
| Dağıtım | Vercel | — | Production deploy |

**Yapılandırma notları.** Proje `reactCompiler: true` ile React Compiler'ı etkinleştirir; bunun dışında `next.config.ts` sade tutulmuştur. TypeScript tarafında `strict` mod açık, modül çözümlemesi `bundler`, ve `@/*` path alias'ı proje köküne işaret eder (`@/lib/...`, `@/components/...` importlarının temeli). Kök dizinde Next.js 16 middleware'i `proxy.ts` olarak bulunur (Edge değil, Node.js runtime) ve tüm erişim kontrolünün merkezidir (bkz. §2.4).

**Bağımlılık felsefesi — ince dış bağımlılık.** Dikkat çeken nokta, Bunny.net video servisinin npm bağımlılığı olarak **bulunmamasıdır**. Servis, SDK ile değil kendi soyutlama katmanı üzerinden env değişkenleri ve HTTP çağrılarıyla kullanılır (bkz. §2.7). Bu bilinçli tercih, sağlayıcı değişiminde uygulamayı bir kütüphaneye kilitlenmekten korur.

**Kalite araçları.** `package.json` script'leri, standart `dev`/`build`/`start`/`lint`'e ek olarak projeye özgü iki denetim katmanı tanımlar: `denetim` (kod ile canlı DB şeması tutarlılığını `ts-morph` + `pg` ile karşılaştırır) ve `lint:mimari` (özel ESLint mimari kurallarını çalıştırır). Bu araçlar §6.2'de ayrıntılandırılır; burada stack'in bir parçası olarak `devDependencies` içinde `pg`, `ts-morph` ve `dotenv` ile temsil edildiklerini not etmek yeterli.

### 2.2 Kimlik ve hiyerarşi

HapBilgi'de üç ayrı kimlik düzlemi vardır ve bu ayrım §1.2'deki müşteri katmanlarının teknik karşılığıdır: firmanın kendi insanları `kullanicilar` tablosunda, dış müşteriler (eczacı/eczane teknisyeni) `eclub_kisiler` tablosunda, eczanenin kendi müşterileri ise `eczanem_musteriler` tablosunda (telefon kimlikli, Bölüm 5) yaşar. Üçü farklı tablolar olsa da, giriş katmanında tek bir view (`v_auth_kimlik`) altında birleştirilir.

**Organizasyon hiyerarşisi — firma → takım → bölge.** İç müşteri tarafı üç katmanlı bir ağaçtır:

| Tablo | Anahtar | Üst bağ | Açıklama |
|---|---|---|---|
| `firmalar` | `firma_id` | — | Kök. Ürün, kullanıcı ve içeriğin sahibi olan kurum. |
| `takimlar` | `takim_id` | `firma_id` → firmalar | Firma altındaki takım. |
| `bolgeler` | `bolge_id` | `takim_id` → takimlar | Takım altındaki saha bölgesi. |

Her kullanıcı, rolüne göre bu ağacın bir katmanına bağlanır: yönetici roller firma seviyesinde (`takim_id`/`bolge_id` boş), üretici/yönlendirici roller takım seviyesinde, saha rolleri (UTT/BM) bölge seviyesinde konumlanır. Bu bağ `kullanicilar` tablosundaki üç nullable kolonla (`firma_id`, `takim_id`, `bolge_id`) tutulur; hangisinin dolu olacağını rol belirler (bkz. §2.3).

**`kullanicilar` — iç müşteri kimliği.** 14 kolon: kimlik (`kullanici_id`, `ad`, `soyad`, `eposta`, `telefon`, `rol`), hiyerarşi bağı (`firma_id`, `takim_id`, `bolge_id` — hepsi nullable), durum (`aktif_mi`), profil (`fotograf_url`) ve iki yetki bayrağı (`yetki_kullanici_yonetim`, `yetki_aktif_pasif`). Kritik nokta: `kullanici_id`, Supabase Auth'un ürettiği kullanıcı kimliğiyle birebir aynıdır — yani ayrı bir eşleme tablosu yoktur, auth kimliği doğrudan iş kimliğidir. **Güncelleme (admin upsert aşaması, K-A7 — 18.07.2026):** `telefon` kimlik çekirdeğine girdi — `05XXXXXXXXX` biçiminde normalize edilir (`telefonNormalize`), benzersiz index taşır ve toplu yüklemenin upsert eşleştirme anahtarlarından biridir (e-posta + telefon; Excel'de kalıcı `kullanici_id` görünmediği için). Kolon öncesi mevcut kayıtlara sahte `0532000XXXX` backfill uygulanmıştır (SQL — İskender); gerçek numaralar panelden ya da upsert'le düzeltilir.

**`firmalar` — kurumsal kök ve modül anahtarları.** Kimlik (`firma_id`, `firma_adi`), ve dikkat çekici biçimde firma yaşam döngüsü ile modül aç/kapa bayrakları — `aktif` (firma canlı mı), `son_export_at` (silme öncesi Excel dışa aktarma damgası) ve beş modül anahtarı: `hbstore_aktif`, `cc_aktif`, `eclub_aktif`, `eclub_store_aktif`, `eczanem_aktif`. Bu bayraklar, aynı kod tabanının her firma için farklı modül kümesiyle çalışmasını sağlar; erişim kontrolündeki rolleri §2.4'te ele alınır.

**`eclub_kisiler` — dış müşteri kimliği.** 8 kolon: kimlik (`kisi_id`, `rol`, `ad`, `soyad`, `eposta`, `telefon`), auth bağı (`auth_user_id`, nullable) ve `created_at`. Burada iki tasarım kararı belirleyicidir. Birincisi, bu tabloda **firma veya eczane bağı yoktur** — çünkü bir eczacı çok firmalı olabilir ve eczane bağı zamanla değişebilir; bu ilişkiler ayrı bağlantı tablolarında tutulur (bkz. §4.1). İkincisi, `auth_user_id` nullable'dır: kişi henüz giriş kimliği almadan da sisteme eklenebilir (UTT ekler, kişi sonradan giriş kimliği kazanır).

**`v_auth_kimlik` — birleşik giriş katmanı.** Üç kimlik düzlemi giriş anında tek bir view altında toplanır: `kullanicilar`, `eclub_kisiler` ve `eczanem_musteriler` satırları `UNION` ile birleştirilir; ayırt edici kolon `kimlik_turu`'dur (`'kullanici'` / `'eclub_kisi'` / `'musteri'`). Uygulamanın kimlik sağlayıcısı (AuthProvider) giriş yapan kişiyi bu view üzerinden çözer: `auth_id` ile eşleşen satırı çeker, `kimlik_turu`'na göre yönlendirir. Böylece üç ayrı tablo, uygulama koduna tek ve tutarlı bir kimlik arayüzü olarak sunulur.

**`v_auth_kimlik_admin` — service_role onarım view'ı (Eczanem U2'de kapanan canlı bug).** `v_auth_kimlik`, güvenlik gereği `auth.uid()` filtresiyle daraltılmıştır (herkes yalnız kendi satırını görür). Ancak `rolCozucu` view'ı service_role ile sorgular ve service_role JWT'sinde `sub` olmadığından `auth.uid()` NULL döner — view boş kalır. Bu, rol okumanın tekleştirilmesinden (§2.4) beri 66 dosyadaki rol kontrolünün herkesi reddettiği anlamına geliyordu; fark edilmemişti çünkü fiziksel testler push öncesi bekliyordu. Onarım: filtresiz `v_auth_kimlik_admin` (yalnız service_role SELECT yetkili) eklendi ve `rolCozucu` ona geçirildi. `auth.uid()` filtreli `v_auth_kimlik` istemci-taraflı sorgular için durmaya devam eder.

### 2.3 Roller ve yetki modeli

Sistemdeki tüm rol tanımları ve yetki kümeleri tek bir dosyada, `lib/utils/roller.ts` içinde merkezîleştirilmiştir. Bu, projenin temel mimari ilkelerinden biridir: bir rolün nereye erişebileceği kod içine dağılmış `if` kontrollerinde değil, adlandırılmış sabit listelerde tanımlanır. Yeni bir rol eklemek ya da bir yetkiyi genişletmek, ilgili listeye tek satır eklemekle tüm route ve sayfalara otomatik yansır. Bu ilke 30.07.2026'dan itibaren derleme zamanında da korunur: `hapbilgi-mimari/rol-tek-kaynak` ESLint kuralı (§6.2) elle yazılmış rol dizilerini reddeder — B-09 temizliğiyle geçmişteki tüm ihlaller kapandığından bekçinin baseline'ı boştur ve kural tam sıkı çalışır.

**Üç kimlik düzlemi, tek geçerlilik listesi.** Roller, §2.2'deki kimlik ayrımını yansıtacak biçimde üç düzlemde yaşar. İç müşteri rolleri (`kullanicilar` tablosu) `TUM_ROLLER` altında toplanır ve kullanıcı doğrulamalarında "geçerli rol mü?" kontrolünün kaynağıdır. Dış müşteri rolleri (`eczaci`, `eczane_teknisyeni` — `ECLUB_TUKETICI_ROLLERI`) ve Eczanem müşterisi (`musteri` — `MUSTERI_ROLU`) ayrı tutulur ve **bilinçli olarak `TUM_ROLLER`'a dahil edilmez** — çünkü bu roller `kullanicilar` değil kendi tablolarında (`eclub_kisiler`, `eczanem_musteriler`) yaşar ve ayrı yetki düzlemlerine aittir.

**Hedef rol — kullanıcı rolü değil, içerik ekseni.** `talepler.hedef_roller` dizisi de `roller.ts`'te tek kaynaktır ama kavramsal olarak ayrıdır: değerler kişilerin rolü değil, üretilen içeriğin hedef kitlesidir. `HedefRol` beş atomik değer alır (`utt`, `bm`, `eczaci`, `eczane_teknisyeni`, `eczanem`); `HedefRoller` ise DB CHECK constraint'iyle korunan seçim dizisidir. Saha ve Eczanem hedefleri tekildir; Eczacı ile Eczane Teknisyeni tek tek veya birlikte seçilebilir. Eczanem hedefli talebi yalnız ürün müdürü ailesi açabilir (`ECZANEM_TALEP_ACAN_ROLLER` = pm/jr_pm/kd_pm — Bölüm 5.2).

**Temel rol grupları.** İç müşteri rolleri, hiyerarşideki konumlarına ve işlevlerine göre gruplanır:

| Grup | Roller | İşlev / hiyerarşi seviyesi |
|---|---|---|
| `URETICI_ROLLER` | pm, jr_pm, kd_pm, med_md, egt_md, egt_yrd_md, egt_yon, egt_uz, ik_drk, ik_md, ik_yrd_md, ik_uz, ik_per (13 rol) | İçerik üretir: talep açar, senaryo/video/soru seti onaylar, yayınlar (takım seviyesi) |
| `YONETICI_ROLLER` | gm, gm_yrd, drk, paz_md, blm_md, grp_pm, sm | Yönetici raporu erişimi (firma seviyesi) |
| `ADMIN_ROLLER` | admin | Tüm firmalar + admin paneli + tüm raporlar |
| `YONLENDIRICI_ROLLER` | tm, bm | UTT performansını hiyerarşik olarak izler; öneri gönderme yetkisi yalnız BM’dedir (BM bölge, TM takım görünümü) |
| `TUKETICI_ROLLER` | utt, kd_utt | Sahada video tüketir, soru cevaplar, puan kazanır (bölge seviyesi) |
| `IU_ROLU` | iu (tekil) | İçerik Uzmanı — talebe cevaben senaryo/video/soru seti üretir; firma bağımsız |

`URETICI_ROLLER`'ın "PM-merkezli" olmaktan çıkıp 13 rolü kapsaması, projenin geçirdiği önemli bir mimari dönüşümdür: içerik üretimi artık yalnızca Ürün Müdürü'nün değil, medikal, eğitim ve İK rollerinin de ortak akışıdır (üretici roller mimarisi). Her üretici rolün hangi talep türlerini açabileceği ayrı bir yetenek profili katmanında tanımlanır (bkz. §2.8).

**Türetilmiş / modül bazlı görünürlük kümeleri.** Temel grupların üzerine, her modülün "kim görür, kim erişir" kuralını tanımlayan türetilmiş kümeler kurulur. Bunlar temel grupları birleştirerek oluşturulur — yani tek kaynak korunur:

| Küme | Kapsam |
|---|---|
| `URETIM_HATTI_GORENLER` | Üretim hattı sayfaları (talepler/senaryolar/videolar/soru-setleri): üretici roller + İU |
| `CCLIGI_GORENLERLER` | Challenge Club Ligi: BM (asıl) + TM/üretici/yönetici/admin (gözlemci) |
| `STORE_ALABILEN_ROLLER` | HBStore'dan puan harcayabilen: UTT/KD_UTT + BM |
| `STORE_GORENLERLER` / `STORE_GENEL_GOREN_ROLLER` | HBStore sipariş görüntüleme; kapsam role göre daralır (kendi / takım / firma) |
| `ECLUB_GOREN_ROLLER` | E-Club çalışma/yönetme yüzeyi (Videolar ve Eczanelerim): UTT/KD_UTT |
| `ECLUB_YONETIM_ROLLERI` | E-Club Raporlar / Lig / Siparişler: UTT/KD_UTT, BM, TM, üretici ve yönetici roller |
| `ECLUB_LIGI_GOREN_ROLLER` | E-Club yönetim sözleşmesiyle aynı kapsamın lig route'undaki adlandırılmış karşılığı |

Bu kümelerin çoğunda ortak desen, kapsamın role göre daralmasıdır: aynı sayfayı gören iki rol farklı genişlikte veri görür (UTT kendi verisini, BM bölgesini, TM takımını, yönetici tüm firmayı). E-Club'da video gönderme ve eczane/kişi bağını yönetme yalnız UTT/KD_UTT'dedir; rapor, lig ve sipariş izleme ise bu UTT yapraklarını yetkili yönetim hiyerarşisinde toplar.

**Yetki bayrakları — role dik kesen izinler.** Rol grubuna ek olarak, `kullanicilar` tablosundaki iki boolean kolon (`yetki_kullanici_yonetim`, `yetki_aktif_pasif`) belirli işlemleri role dik biçimde açar: bir kullanıcının kullanıcı ekleme/silme veya aktif/pasif yapma yetkisi, rolünden bağımsız olarak bu bayraklarla verilir. Böylece aynı roldeki iki kişiden yalnızca birine yönetim yetkisi tanınabilir.

**Görüntüleme katmanı.** `ROL_ADLARI` map'i, rol kodlarının (`pm`, `bm`, `eczaci`…) Türkçe karşılıklarını (`Ürün Müdürü`, `Bölge Müdürü`, `Eczacı`…) tutar. Bu yalnızca arayüz gösterimi içindir; veritabanında rol her zaman kod olarak saklanır, karşılık runtime'da `ROL_ADLARI[rol] ?? rol` deseniyle çözülür.

### 2.4 Erişim & güvenlik mimarisi

Sistemin tüm erişim kontrolü tek bir noktada — kök dizindeki `proxy.ts` (Next.js 16 middleware'i) — toplanır. Her istek, sayfa ya da API fark etmeksizin, uygulamaya ulaşmadan önce bu dosyadan geçer (`config.matcher` statik dosyalar dışındaki tüm yolları kapsar). Bu merkezîleştirme bilinçli bir mimari tercihtir: modül erişim kuralı onlarca dosyaya dağıtılmak yerine tek yerde tutulur, böylece yeni bir uç eklendiğinde korumasız kalma riski ortadan kalkar.

**İki Supabase client — "kim?" ve "ne?" ayrımı.** Güvenlik modelinin temelinde iki farklı istemcinin ayrı amaçlarla kullanılması yatar:

| Client | Anahtar | Amaç | RLS |
|---|---|---|---|
| `createServerClient` (ssr) | anon key + oturum çerezi | Kullanıcıyı tespit et (`auth.getUser()` → "kim?") | Geçerli |
| `createClient` (service_role) | service_role key | DB sorgusu çalıştır (rol/firma doğrula → "ne?") | Bypass |

Proxy önce anon key + çerez ile giriş yapan kişiyi tespit eder; sonra service_role ile o kişinin rolünü/firmasını **yetkili kaynaktan** (`kullanicilar` tablosu) doğrular. Kritik ilke: yetki asla kullanıcının değiştirebildiği `user_metadata`'dan değil, DB'deki tablodan okunur.

**Rol okumanın tekleştirilmesi — `rolCozucu`.** Bu ilke başlangıçta yalnızca proxy'de uygulanıyordu; route katmanında rol okuma yaygın biçimde `user_metadata.rol`'den yapılıyordu. Bu tutarsızlık tek bir işle kapatıldı: 65 dosyadaki rol okuması, yeni tek-kaynak fonksiyon `lib/utils/rolCozucu.ts` üzerinden `v_auth_kimlik` view'ına taşındı. `rolCozucu(adminSupabase, authUserId)` rolü view'dan (lowercase) döner; kayıt yoksa ya da hata olursa boş rol döner ve boş rol tüm kontrollerden reddedilir (güvenli varsayılan). E-Club kişileri de aynı view'dan (UNION) doğru çözülür. Yazma tarafına dokunulmamıştır: admin kullanıcı-oluşturma kodları `user_metadata.rol` yazmaya devam eder, ama bu değer artık hiçbir yetki kontrolünde okunmaz. Bilinçli bedel, her korumalı istekte +1 view sorgusudur; karşılığı, bayat metadata kopyası riskinin sıfırlanması ve rol değişikliğinin yeniden giriş gerektirmeden anında etki etmesidir. **Güncelleme (Eczanem U2):** `rolCozucu`'nun kaynağı `v_auth_kimlik_admin`'e taşındı — `auth.uid()` filtreli view'ın service_role'de boş dönmesi bug'ı için (bkz. §2.2); davranış sözleşmesi aynıdır.

**Bekçi zinciri.** Proxy, ilgili yol geldiğinde sırayla çalışan bekçilerden oluşur. Her bekçi yalnızca kendi yol öbeğinde DB sorgusu yapar (dar kapsam — alakasız isteklerde firma sorgusu yapılmaz):

1. **Admin API bekçisi** — `/admin/api/*` (giriş hariç): kullanıcının rolü `kullanicilar` tablosundan çekilir, `ADMIN_ROLLER` değilse 403. `test-verileri-sil` de bu bekçinin arkasındadır (12.07.2026 — canlıda girişsiz silme ucu bırakılamazdı). **Güncelleme (admin M1, B-26 — 17.07.2026):** proxy artık tek katman değildir — tüm admin route handler'ları ayrıca route-içi tek bekçiden (`lib/utils/adminGirisKontrol`) geçer; yerel kontrol kopyaları silinmiş, proxy + route çift katman olmuştur.
2. **Challenge Club bekçisi** — `/challenge-club/*` ve `/cc-ligi/*`: firmanın `cc_aktif` bayrağı kapalıysa API 403 / sayfa `/ana-sayfa` redirect.
3. **HBStore bekçisi** — `/store/*`: `hbstore_aktif` kapalıysa aynı desen.
4. **E-Club Store bekçisi** — `/eclub/store/*`: `eclub_store_aktif` kapalıysa aynı desen. **Sıralama kritiktir:** bu bekçi `/eclub` bekçisinden *önce* gelir; çünkü `/eclub/store` aynı zamanda `/eclub` ile başlar. Böylece E-Club açık ama Store kapalı bir firmada yalnızca Store engellenir.
5. **E-Club bekçisi** — `/eclub/*`: `eclub_aktif` kapalıysa aynı desen. Not: `/admin/eclub` bu bekçinin kapsamında değildir (o `/admin` ile başlar, ayrı korunur; firma bağımsız).
6. **Eczanem bekçisi** — `/eczanem/*`: diğerlerinden farklı olarak firma-bayrağı değil **ROL tabanlıdır** (ne müşterinin ne eczacının `firma_id`'si vardır; `eczanem_aktif` bayrağı iç uygulama ekranlarında devreye girer, Bölüm 5.2/5.5). Rol tek kaynak `rolCozucu`'dan okunur; üç dal sıralıdır (özel prefix önce — `/eclub/store` dersi): `/eczanem/eczane` (eczacı/teknisyen), `/eczanem/utt` (UTT), genel `/eczanem` (müşteri). Girişsiz istisnalar oturum-öncesi akışlardır (müşteri giriş sayfası/API'leri, davet kabulü) — koruma OTP mekanizmasındadır.

Dört modül bekçisi (2–5) aynı deseni paylaşır: oturum yoksa API→401 / sayfa→login; firma bayrağı `false` ise API→403 / sayfa→`/ana-sayfa`; bayrak açık **veya kullanıcının firması yoksa** geçer. Bu son koşul dış müşteri için anlamlıdır: E-Club kişisinin `firma_id`'si olmadığından çok-firmalı erişimi bu bekçiyle değil, sayfa/RPC seviyesindeki filtrelerle çözülür (bkz. §4.5).

**Firma bazlı modül aç/kapa.** Bayraklı bekçilerin dayandığı dört bayrak (`cc_aktif`, `hbstore_aktif`, `eclub_store_aktif`, `eclub_aktif`) ve Eczanem'in iç-uygulama bayrağı (`eczanem_aktif`) §2.2'de görülen `firmalar` tablosundaki kolonlardır. Admin bunları firma panelindeki toggle'larla yönetir (bkz. §6.1). Böylece tek kod tabanı, her firma için farklı modül kümesiyle çalışır ve bir modül bir firmada kapatıldığında o firmanın hiçbir kullanıcısı ilgili sayfa/API'yi göremez veya erişemez. Erişim engeli (proxy) ile görünürlük gizleme (Navbar pill'leri) birlikte tam bir UX oluşturur.

**Güvenlik modelinin sınırı — tek katman savunma.** Şu an neredeyse tüm API route'ları DB sorgularını service_role ile çalıştırır; service_role RLS'i bypass eder. Bu, tabloların çoğunda RLS kapalı olmasıyla birleşince tek savunma katmanının API/proxy seviyesindeki manuel rol kontrolü olduğu anlamına gelir. Bu bilinçli bir geçici durumdur; deploy öncesi ~30 tabloya RLS eklenmesi ve service_role/anon kullanım sınırının kararlaştırılması açık iş olarak durur (bkz. §6.4).

**Not — temizlenen senaryo API kalıntısı.** Bu bölüm hazırlanırken, proxy'nin sonunda `/senaryolar/api/*` yollarına özel, `user_metadata.rol`'ü büyük harfle (`"PM"`, `"IU"`) karşılaştıran eski bir blok tespit edildi. İnceleme sonucu bunun ölü kod olduğu doğrulandı: (a) blok var olmayan yolları (`/senaryolar/api/senaryolar`, `/senaryolar/api/talepler`) hedefliyordu — gerçek endpoint `/senaryolar/api`'dir; (b) gerçek route zaten kendi içinde `kullanicilar` temelli, küçük harf rol kontrolü yapıyordu; (c) `user_metadata.rol` (büyük harf) deseni güncel yetki modeliyle uyuşmuyordu. Blok ve yalnızca onun kullandığı `SADECE_PM_PREFIXLER` sabiti kaldırıldı; `tsc` temiz, değişiklik commit edildi. Proxy artık yalnızca admin + 4 modül bekçisinden ve `config`'ten oluşur.

### 2.5 Veri modeli felsefesi

HapBilgi'nin veri modeli üç ilkeye dayanır. Bu ilkeler tablo tasarımının rastgele değil, "veri doğruluğu her zaman garanti altında olsun, iki kez sayılmasın, tek yerden değişsin" hedefiyle şekillendiğini gösterir. Bu felsefe her iki müşteri katmanında da (iç müşterinin puan tabloları, dış müşterinin `eclub_` karşılıkları) birebir uygulanır.

**İlke 1 — Kayıt-anı simetrisi.** Bir kullanıcının puanı, sonradan yapılan bir hesaplamayla değil, olayın gerçekleştiği anda yazılan kayıtlarla tutulur. Her olay için ya bir kazanım ya da bir kayıp kaydı, tam o anda ilgili tabloya düşer:

| Olay | Kazanım kaydı | Kayıp kaydı |
|---|---|---|
| Doğru cevap | `kazanilan_puanlar` (cevaplama) | — |
| Yanlış cevap | — | `yanlis_cevap_kayitlari` |
| İlk izleme tamamlandı | `kazanilan_puanlar` (izleme, tam) | — |
| İleri sarıldı | (izleme puanı yine tam yazılır) | `ileri_sarma_kayitlari` |
| Aynı hafta tekrar izleme | `kazanilan_puanlar` (extra) | — |
| Önerilen video izlendi | `kazanilan_puanlar` (oneri) | — |
| Öneri süresi geçti, izlenmedi | — | `oneri_kayip_kayitlari` |

Kazanımlar tek tabloda toplanır: `kazanilan_puanlar`, `puan_turu` kolonuyla dört türü (izleme / cevaplama / oneri / extra) ayırır. Kayıplar ise üç ayrı tabloda tutulur (`ileri_sarma_kayitlari`, `yanlis_cevap_kayitlari`, `oneri_kayip_kayitlari`), her biri `kaybedilen_puan` taşır.

Bu tasarımın kritik sonucu şudur: **net puan = kazanım toplamı − üç kayıp tablosunun toplamı.** Kazanım her zaman tam yazılır; kayıp asla kazanımın içine gömülmez, ayrı durur ve çıkarılır. Örneğin ileri sarma olduğunda izleme puanı azaltılarak yazılmaz — izleme puanı tam kalır, kayıp yalnızca `ileri_sarma_kayitlari`'nda görünür. Böylece hem çift sayım imkânsızlaşır hem de kayıp raporlarda görünür kalır. UTT raporu, BM raporu ve HB Ligi sıralaması hepsi bu aynı SUM farkından beslenir.

**İlke 2 — Denormalize `urun_id`.** Puan ve kayıp kayıtlarının doğal anahtarı `yayin_id`'dir; ama ürün bazlı raporlama için yayından ürüne ulaşmak sekiz tablolu bir JOIN zinciri gerektirir (yayın → soru seti durumu → soru seti → video durumu → video → senaryo durumu → senaryo → talep). Bu zinciri her sorguda yürütmek pahalıdır. Çözüm: dört kayıt tablosunun her birine (`kazanilan_puanlar`, `ileri_sarma_kayitlari`, `yanlis_cevap_kayitlari`, `oneri_kayip_kayitlari`) `urun_id` kolonu denormalize edilmiştir. Bu değer kayıt anında, `get_urun_from_yayin()` yardımcı fonksiyonuyla bir kez çözülüp yazılır. Bir kaydın `yayin_id`'si değişmediği için `urun_id`'si de değişmez; bir kez yazılan değer sonsuza kadar geçerlidir. Böylece ürün bazlı dağılımlar JOIN olmadan, doğrudan kolondan okunur.

**İlke 3 — Tek kaynak.** Bir alan adına ait değer sistemde tek bir yerde tanımlanır ve her yer oradan okur. Puan miktarları (izleme puanı, öneri puanı vb.) koda gömülü sabitler değil, `sistem_ayarlari` tablosundaki anahtar-değer kayıtlarıdır (`anahtar`, `deger`). Örneğin öneri kaybı işleyen fonksiyon, kaybedilen puanı sabit `10` yerine `sistem_ayarlari`'ndan okur; değer değişirse tüm sistem tek satırla güncellenir. Aynı ilke rol tanımlarında (`lib/utils/roller.ts`, §2.3), firma kolon listesinde (`lib/firma/kolonlar.ts`, §6.1) ve puan kayıt mantığında (`lib/puan/`, §2.6) de geçerlidir. Tek kaynak ilkesi, bir kavramın iki yerde farklı tanımlanıp tutarsızlaşmasını yapısal olarak engeller. Tekrar Gönderim ve E-Club gönderi yönetimiyle ilgili anahtarlar da buradadır: `tekrar_periyot_secenekleri`, `eclub_aylik_gonderim_limiti`, `eclub_oneri_gecerlilik_gun`, `eclub_gonderim_araligi_gun`, `eclub_alici_pencere_gun`, `eclub_alici_haftalik_limit` (`deger` kolonu jsonb'dir, dizi değerler gerçek JSON dizisi olarak yazılır). Admin panelindeki Sistem Ayarları ekranı (§6.1) mevcut anahtarları günceller — yeni anahtar eklemek migration işidir.

**Tur kavramı — kişi × yayın tekilliğinden tur bazlı tekilliğe.** Tekrar Gönderim Modeli, veri modeline dördüncü bir yapı taşı ekledi. Sistemin puan kararları başlangıçta örtük bir varsayıma dayanıyordu: bir kişi bir yayını bir kez puanlı izler. Tekrar gönderim bu varsayımı değiştirdi: kişi × yayın artık **tur** bazında tekildir — "ilk izleme", extra sayacı ve öneri puanı tur içinde geçerlidir. Tur çapası yeni `yayin_tekrar_kayitlari` tablosudur (`tekrar_id`, `yayin_id`, `tur_no`, `baslangic_tarihi`, `acilis_turu`; `UNIQUE (yayin_id, tur_no)`); `yayin_yonetimi` ise `tekrar_periyot_gun` kolonunu taşır (NULL = tekrar yok; geçerli değerler 15/30/45/60 — kolonda CHECK yoktur, geçerli liste `sistem_ayarlari`'nda tek kaynak olarak durur). `yayin_tarihi` tur çapası olarak bilinçli kullanılmaz: yeniden başlatmada bugüne çekildiği için "son aktifleşme anı" gibi davranır. Tur açılışı otomatiktir ve sorgu anındadır: `lib/tur/kayit.ts`'teki `gecerliTur()` son turu döner, periyot dolmuşsa yeni turu takvim hizalı açar (son başlangıç + geçen tam periyot × periyot — sorgu anına değil periyodun takvimine bağlanır, sayaç deterministiktir), atlanan periyotlarda hayalet tur açmaz (tur_no +1, başlangıç son dolan sınıra hizalı), tur kaydı hiç yoksa kendini onarır (tur-1'i now() ile açar) ve eşzamanlı çakışmayı DB'deki UNIQUE ile çözer — ayrı bir zamanlayıcı/cron gerekmez. Kayıt tablolarına `tekrar_id` FK'sı bilinçli olarak eklenmemiştir: tüm tekillik sorguları tur başlangıç tarihiyle (`gte` tur başı) çözülür; raporlama JOIN ihtiyacı doğarsa kolon sonradan eklenip geçmişe doğru doldurulabilir. Kayıt-anı simetrisi turla da korunur: yeni tur açıldığında hiçbir fiziksel DELETE olmaz — önceki turun kayıtları ve kazanılmış puanları tarihçede durur, yalnızca sayaçlar yeni turun penceresinden okunur.

**Ölçek notu.** HB Ligi sıralaması, bu kayıt tablolarından canlı SUM ile hesaplanan bir VIEW/RPC ailesidir — ayrı bir "lig tablosu" tutulmaz, böylece sıralama her zaman anlık ve tutarlıdır. Bu yaklaşım mevcut ölçekte (yaklaşık 500–1000 UTT'ye kadar) yeterlidir; daha büyük ölçekte materialized view veya artımlı güncelleme stratejisine geçiş açık bir iş olarak durur (bkz. §6.4).

### 2.6 Katman ayrımı — route = orkestrasyon, lib = iş mantığı

HapBilgi'nin backend'i iki katmana ayrılır ve bu ayrım projenin en tutarlı uygulanan mimari ilkesidir: **API route'ları yalnızca orkestrasyon yapar, iş mantığı `lib/` altında yaşar.**

**Route'un sorumluluğu (ince katman).** Bir API route dört şeyden sorumludur: (1) kullanıcıyı tespit etmek (`createClient` ile auth), (2) rol/yetki kontrolü, (3) girdi validasyonu, (4) uygun `lib` fonksiyonunu çağırıp sonucu JSON olarak döndürmek. Route, "nasıl hesaplanır / nasıl yazılır" bilgisini içermez. §2.4'te görülen senaryo route'u bunun tipik örneğidir: auth + rol + validasyon yapar, sonra DB işlemini yürütür — iş kuralı orada değil, veri katmanındadır.

**Lib'in sorumluluğu (kalın katman).** Gerçek iş mantığı — puan formülleri, kayıt kuralları, agregasyon, RPC çağrıları — `lib/` altında, domain'e göre klasörlenmiş dosyalarda durur. Bunun faydası tek kaynak ilkesinin (İlke 3) koda yansımasıdır: bir kural değişirse tek dosyada değişir, onu çağıran tüm route'lar otomatik doğru davranır.

**`lib/` domain haritası.** Klasör yapısı, sistemin modüllerini birebir yansıtır:

| Klasör | Sorumluluk |
|---|---|
| `lib/supabase/` | İki client fabrikası: `server.ts` (`createClient` anon + `createAdminClient` service_role), `client.ts` (tarayıcı) |
| `lib/puan/` | Puan/kayıp kayıt katmanı — kazanım + üç kayıp INSERT'i tek noktada. Ayrıca tam tekrar sayımının tek kaynağı: `tekrarSayim.ts` — tekil imza `bitir` route'una (extra puan kararı), toplu imza Ekstra İzlediklerim bölümüne hizmet eder; iki ekranın farklı sayması yapısal olarak imkânsızdır |
| `lib/tur/` | Tur katmanı — `ayarlar.ts` (periyot seçenekleri okuyucu) + `kayit.ts` (`turKaydiAc` tek-kaynak yazım, `gecerliTur` otomatik açılış, `gecerliTurBaslangiclari` toplu salt-okur hesap; ikisi de ortak `hizaliBaslangic()` takvim formülünü kullanır) |
| `lib/utils/anaSayfa/` | Ana sayfa veri katmanı — rol başına dosya (`bm`, `utt`, `tm`, `iu`, `uretici`, `yonetici` + `bmAktivite`). Eski tek dosya `anaSayfaVeri.ts` (542 satır, altı rolün fonksiyonu) bölünüp silindi; tek tüketici `app/ana-sayfa/api` doğrudan rol dosyalarından import eder. Üreticideki döngü-içi sıralı sorgu (N+1) deseni ayrı bir performans işi olarak ertelenmiş, 27.07.2026'da kapanmıştır: zincir `v_uretici_icerik_takip` view'ine taşındı, maliyet talep sayısından bağımsız sabit iki sorgudur (§6.4) |
| `lib/rapor/` | Rol bazlı rapor veri katmanı (`utt`, `bm`, `tm`, `uretici`, `yonetici` + `paylasilan`) |
| `lib/cc/` | Challenge Club (`izleme`, `puan`, `soru` alt katmanları) |
| `lib/eclub/` | E-Club iş mantığı (`store` alt katmanı dahil) |
| `lib/uretici/` | Üretici rol yetenek profilleri (§2.8) |
| `lib/hbligi/`, `lib/oneri/`, `lib/soru/`, `lib/zaman/` | Lig, öneri, soru seçimi, zaman/periyot yardımcıları |
| `lib/firma/`, `lib/store/`, `lib/video/`, `lib/utils/`, `lib/types/` | Firma kolonları, HBStore, video oynatıcı, ortak yardımcılar, tipler |

**Örnek desen — `lib/puan/`.** İç müşteri puan katmanında `tipler.ts` parametre tiplerini, `strateji.ts` izleme/extra kararını ve eşik mantığını, `kayit.ts` ise kazanım ve kayıp kayıtlarını yönetir. E‑Club dış müşteri akışında aynı sorumluluk, yarış durumlarını önlemek için `eclub_izleme_tamamla` ve `eclub_cevaplari_kaydet` RPC'lerinde atomik olarak uygulanır; API route'ları puan kayıtlarını doğrudan yazmaz (§1.2).

**Raporlarda tekrarlanan alt-desen.** `lib/rapor/` altında her rolün kendi klasörü (`bm`, `tm`, `uretici`, `yonetici`, `utt`) ve bir `paylasilan/` klasörü bulunur. Bu, "her rol kendi veri kaynağından beslenir, ortak hesaplar tek yerde" ilkesinin klasör düzeyindeki karşılığıdır; ayrıntısı §3.2'de ele alınır.

**Arayüz merkezleri — rozet ve liste (27.07.2026).** Katman ayrımı yalnız route/lib ekseninde değil, arayüzde de uygulanır: tekrar eden görsel davranışlar sayfalarda değil merkezlerde yaşar. **Pill merkezi** (`components/pill/`) rozetin *şeklini* sahiplenir — tarama 118 pill ve 32 farklı ölçü imzası bulmuştu; ölçü artık tek satırda tanımlıdır (10px yazı, `px-2 py-0.5` dolgu, 0.5px kenar, tight satır yüksekliği). Sınır bilinçlidir: merkez şekli tutar, **anlamı tutmaz** — renk durum sözlüğünden (`lib/utils/durum/mesaj.ts`) ve rol tasarımından gelir. Anlam sarmalayıcıları `AsamaPill`, `DurumPill`, `VaryantPill`, `HedefRolPill`, `TeknikPill` rengi kaynağından alır, ölçüye hiç karışmaz. **Liste merkezi** (`components/liste/`) arama ve kademeli listelemeyi taşır (`useListe` + `ListeArama` + `DahaFazlaGoster`); aranabilir alanları sayfa tanımlar, merkez "talep no" gibi bir alan adı bilmez — böylece 40 liste ekranı aynı davranışı paylaşır.

### 2.7 Ortak servis soyutlamaları — provider-agnostik video

HapBilgi, video servisine bağımlılığını bir soyutlama katmanıyla yönetir. Tüketici kod belirli bir sağlayıcıya değil, bir *arayüze* bağlanır. Bu, §2.1'de not edilen "ince dış bağımlılık" tercihinin — sağlayıcı SDK'sı yerine kendi soyutlaması — teknik karşılığıdır ve sistemi tek bir sağlayıcıya kilitlenmekten korur.

**Video oynatıcı — `lib/video/videoPlayer.ts`.** Video oynatma teknik detayları (script yükleme, `postMessage` protokolü, event isimleri, URL format dönüşümü) tüketici bileşenden (VideoOynatici) tamamen soyutlanır. Mimari üç parçadır:

- **`VideoPlayer` arayüzü** — tüm sağlayıcı adapter'larının uyduğu ortak sözleşme. Yedi metot tanımlar: `onReady`, `onTimeUpdate`, `onEnded`, `onSeeked`, `getDuration`, `getCurrentTime`, `setCurrentTime`, `destroy`. Sağlayıcıya özgü detaylar bu arayüzün arkasında gizlenir.
- **Adapter sınıfları** — her sağlayıcı için bir tane; şu an yalnızca Bunny.net aktiftir.
- **`createVideoPlayer(iframe, url)` fabrikası** — URL deseninden hangi sağlayıcı olduğunu tespit eder ve doğru adapter'ı kurar.

Yeni bir sağlayıcı (Mux, Cloudflare Stream, Vimeo, YouTube, JW Player, Wistia) eklemek üç adımdır: URL desenini tanıt, arayüzü uygulayan adapter'ı yaz, fabrikaya `case` ekle. VideoOynatici'ye hiç dokunulmaz. Bu genişleme noktaları dosyanın başında yorum olarak hazır bekler — ama kod yazılmamıştır; ilkesi, "test edilemeyen sağlayıcı için kod yazmak sahte güvence yaratır" olarak benimsenmiştir.

Soyutlamanın bir önemli tasarım notu: `onEnded` event'ı bazı sağlayıcılar tarafından her zaman gönderilmez. Bu yüzden tüketici kod, kritik iş mantığını (izleme tamamlandı mı) yalnızca sağlayıcının gönüllü event'ına bağlamaz; `timeupdate` + `duration` ile kendi manuel bitiş tespitini de yapar. İlke: kritik iş mantığı üçüncü taraf sağlayıcının davranışına emanet edilmez, sağlayıcı event'ları yalnızca yedektir.

**Doğrudan yükleme — vezne modeli (19.07.2026).** Video dosyası Supabase storage'a hiç girmez ve uygulama sunucusuna uğramaz. Akış üç adımdır: (1) **vezne** ucu kimlik ve sıra kontrolü yapar, Bunny'de kaydı **sistem** açar, adı **sistem** koyar (`urunadi_vN`), istemciye tek videoya özel iki saatlik TUS imzası döner — imza formülü `sha256(library_id + api_key + expiration + video_guid)`; (2) dosya tarayıcıdan `tus-js-client` ile **doğrudan** Bunny'ye gider, kesintiden kaldığı yerden devam eder; (3) kanonik embed adresini sistem yazar — istemci URL kurmaz. **API anahtarı istemciye asla inmez.** Çekirdek sunucu tarafındadır (`lib/video/bunnyYukleme.ts`), istemci yardımcısı ayrı dosyadadır (`lib/video/bunnyTusIstemci.ts`) ve çekirdeğe import etmez. Encode durumu kart açılışında sorgulanır (`GET /videolar/api/bunny-durum`) ve sınırlı süreli tekrar-sorguyla izlenir (15 sn aralık, 5 dk tavan — sonsuz polling yoktur). Yarım kalan yüklemenin Bunny'de bıraktığı **yetim kayıt** `bunny-yukleme-iptal` ile silinir; güvenlik kuralı nettir — bir kayda bağlanmış GUID silinmez, yalnız yetim silinir.

**Hazır video da aynı yoldan (19.07.2026).** Aynı model hazır video koluna da uygulanır: hazır video Supabase storage'a hiç girmez, PM'in talep formunda seçtiği dosya talep oluşurken tarayıcıdan doğrudan Bunny'ye gider — İçerik Uzmanı'nın "indir, yeniden yükle" adımı tümüyle kalkmıştır. İkinci vezne ucu `POST /talepler/api/bunny-yukleme-baslat`'tır (PM rolü + üretici şartı; sıra kontrolü: hazır video talebi ve `hazir_video_url` boş; adı sistem koyar — `urunadi_hazir`). TUS istemci mantığı iki ekranın paylaştığı ortak yardımcıdadır (`lib/video/bunnyTusIstemci.ts`). Kanonik adresi burada da sistem yazar; `PUT hazir-video` üretici-PM'e aittir ve kanonik-adres doğrulaması yapar — İÜ'nün URL girme yolu ve talep detayındaki URL alanı kaldırılmıştır. Yarım kalan ya da reddedilen yüklemede üretici talep detayından aynı akışla yeniden yükler; yetim telafisi genişletilmiştir — `bunny-yukleme-iptal` GUID'i hem `videolar.video_url` hem `talepler.hazir_video_url` içinde arar, bağlıysa silmez.

**Dikey video ve oranlı çerçeve (26.07.2026).** Oynatıcı kutusu videonun kendi en-boy oranına göre çizilir: `VideoCercevesi` sarmalayıcısı iframe'i oranlı bir kutuya alır, oran hesabı tek yerdedir (`lib/video/enBoyOrani.ts`) ve kaynağı Bunny kapağının ölçüsüdür. Sekiz oynatma yüzeyi bu çerçeveye taşındı; dikey video artık 16:9 kutuya sıkışıp iki yanında siyah bant bırakmıyor. Masaüstünde dikey videonun sayfayı uzatmaması için `maxHeight: min(70vh, 560px)` tavanı vardır.

### 2.8 İçerik Üretim Hattı — üç katmanı besleyen tek motor

Üretim hattı, her içeriğin doğduğu yerdir ve sistemin en kritik yapısal özelliği şudur: **tek bir üretim motoru, hedeflenen role göre hem iç hem dış müşteri içeriğini üretir.** Bu, §1.2'de tanımlanan "aynı motorun beslediği tek ekosistem" ilkesinin teknik karşılığıdır. Bu bölüm hattı ortak temel katmanda konumlandırır; çünkü çıktısı iki müşteri katmanına birden gider.

**Beş aşamalı zincir.** Bir içerik, talepten yayına beş aşamada olgunlaşır. Her aşamanın kendi tablosu ve bir "durum geçmişi" tablosu vardır:

```
talep → senaryo → video → soru seti → yayın
```

| Aşama | Tablo | Kim yapar |
|---|---|---|
| Talep | `talepler` | Üretici rol (talebi açar) |
| Senaryo | `senaryolar` | İçerik Uzmanı (yazar) |
| Video | `videolar` | İçerik Uzmanı (yükler) |
| Soru seti | `soru_setleri` | İçerik Uzmanı (hazırlar) |
| Yayın | `yayin_yonetimi` | Üretici rol (yayına alır) |

Her aşamada üretici rol onaylar / revizyon ister / iptal eder; onay zinciri ilerledikçe bildirimler ilgili tarafa düşer. Bu operasyonel akışın ayrıntısı (badge'ler, revizyon limiti, hazır video/soru seti özel akışları) iç müşteri tüketimiyle iç içe olduğundan §3.1'de ele alınır; burada hattın yapısal omurgası verilir.

**Durum-kaydı bazlı bağlanma — kritik mimari.** Zincir, tablolara doğrudan değil, her zaman "onaylanan durum kaydı" üzerinden bağlanır. `sema.json`'dan doğrulanan FK yapısı şudur:

- `videolar.senaryo_durum_id` → senaryonun **durum kaydına** bağlanır (senaryonun kendisine değil)
- `soru_setleri.video_durum_id` → videonun durum kaydına
- `yayin_yonetimi.soru_seti_durum_id` → soru setinin durum kaydına

Yani üretim ilerlemesi her zaman "hangi durumda onaylandı" bilgisini taşıyan kayıt üzerinden akar. Bu, bir içeriğin hangi revizyonunun onaylandığının izlenebilir kalmasını sağlar.

**`hedef_roller` — üç katmana dallanma noktası.** `talepler` tablosundaki `hedef_roller` dizisi, üretilen içeriğin hangi kitlelere gideceğini belirler ve tek motorun katmanlara dallandığı yerdir. Atomik değerler `utt` ve `bm` (iç müşteri), `eczaci` ve `eczane_teknisyeni` (dış müşteri), `eczanem`dir (eczanenin kendi müşterisi — Bölüm 5). Geçerli diziler tek elemanlı hedefler ile `['eczaci','eczane_teknisyeni']` birleşimidir; sıra ve kombinasyon DB CHECK constraint'iyle korunur. Aynı dizi yayın oluşturulurken tek `yayin_id` üzerinde `yayin_yonetimi.hedef_roller` alanına taşınır: iki dış rol seçildiğinde iki yayın kopyası oluşmaz. Böylece aynı talep→senaryo→video→soru seti→yayın hattı, hedef dizisine göre saha ekibine, eczane tarafına ya da eczane müşterisine açılır — ayrı bir üretim sistemi kurulmaz. Eczanem hedefli yayının farkları (tekrar periyodu NULL zorlaması, barkod+tarife zorunluluğu) Bölüm 5.2'dedir.

**`talepler` tablosunun zenginliği.** `talepler` tablosu hattın yapılandırma merkezidir. Kimlik ve sahiplik (`talep_id`, `uretici_id`, `firma_id` — denormalize), hedefleme (`hedef_roller`, `icerik_turu`, `egitim_turu`), içerik bağı (`urun_id`, `teknik_id`), soru yapılandırması (`soru_seti_buyuklugu`, `video_basi_soru_sayisi`) ve özel akış bayrakları (`hazir_video`, `hazir_soru_seti`) burada tutulur. Not: `uretici_id` kolonu eski `pm_id`'nin yeniden adlandırılmış hâlidir — üretici rollerin PM'den 13 role genişlemesinin veri tabanındaki izidir.

**Üretici yetenek profili — kimin ne üretebileceği.** Hangi rolün hangi talep türünü açabileceği, hangi içerik türünü ürettiği, takıma bağlı mı yoksa firma kapsamlı mı çalıştığı koda gömülü `if`'lerle değil, tek bir dosyada — `lib/uretici/yetenekler.ts` — profil olarak tanımlanır. Bu dosya bilinçli olarak DB'de değil koddadır; gerekçesi dosyanın kendi başında açıkça yazılıdır: bu profiller Türkiye ilaç sektörünün rol hiyerarşisini ve HapBilgi'nin üretim hattı tasarımını yansıtır, firmadan firmaya değişmez. Bir firmaya özel yetenek özelleştirmesi, konfigürasyon değişikliği değil, platformun temel tasarımının dışına çıkmak (ayrı bir ürün) sayılır. Dosya üç katmanı ayırır: sektör katmanı (sabit) ve HapBilgi katmanı (sabit) kodda, firma katmanı (değişken) DB'de. Ayrıca içerik/görünürlük türevleri (`lib/video/icerikTuru.ts`, `gorunurluk.ts`) bu profilden türetilir — orada tekrar eden rol listesi yoktur (tek kaynak ilkesi).

**Tekrar gönderim — yayına almada tur.** Yayına alma anında üretici rol, yayın için bir tekrar periyodu seçebilir. Form dropdown'ı seçenekleri client sabitinden değil, `app/yayin-yonetimi/api/tekrar-secenekleri` endpoint'i aracılığıyla `sistem_ayarlari.tekrar_periyot_secenekleri` anahtarından alır (tek kaynak DB); "Tekrar yok" varsayılandır ve zorunlu alan değildir. Yayın INSERT'i `tekrar_periyot_gun` kolonunu taşır (ayar listesine karşı doğrulanır) ve INSERT'ten hemen sonra tur-1 kaydı `turKaydiAc()` ile açılır (`acilis_turu = ilk_yayin`, başlangıç = yayın tarihi); tur açılışı başarısız olursa yayın geri alınmaz, uyarı loglanır — `gecerliTur()` kendini onarma davranışıyla eksik tur-1'i sonradan tamamlar. Not: `tekrar_periyot_gun` değeri `v_yayin_detay` gibi view'lara eklenmez; tek doğru kaynağı `yayin_yonetimi`'dir (§3.3'teki CC vakasının dersi). Kritik karar: **tur takvimi durdurmadan bağımsızdır.** Yayını durdurup başlatmak `yayin_tarihi`'ni değiştirir ama tur başlangıcını değiştirmez — aksi hâlde durdur-başlat ile 15 günlük alt sınır delinip sınırsız puan turu açılabilirdi. Yayın geri açıldığında periyot dolmuşsa otomatik mekanizma yeni turu zaten açar.

**Tarih bazlı yayınlama (13.07.2026).** Yayına alma anında üretici rol, opsiyonel bir **yayın günü** seçebilir (boş = hemen yayın, bugünkü davranış). Gün seçilirse yayın `durum='planlandi'` ve `yayin_tarihi = seçilen gün 07:00` (Europe/Istanbul — puan penceresi açılışı) ile doğar; tüm tüketici sorguları `durum='yayinda'` süzdüğünden tarihi gelmemiş yayın hiçbir ekranda yapısal olarak görünmez ve "yayına bekleyenler" rozet sayımından düşer. Aktivasyon **tek kaynaktan** koşar: `yayin_planlananlari_aktive()` DB fonksiyonu (`scripts/sql/yayin_aktivasyon.sql`) durumu `yayinda`'ya çevirir, tur-1 kaydını açar ve hedef kullanıcılara "Yeni video yayında" bildirimlerini üretir — yani tur-1 ve bildirimler yayına almada değil aktivasyon anında doğar. Tetikleyici pg_cron'dur (`yayin_aktivasyon` job'ı, her gün 07:00 + 07:10 TR; `oneri_kaybi_tarama` ailesiyle aynı desen); fonksiyon mükerrer-korumalıdır (durum süzgeci + tur-1 `ON CONFLICT`). Planlanmış yayın "Yayında" sekmesinde **Planlandı** rozetiyle listelenir ve üç aksiyon tanır: Tarihi Değiştir, Hemen Yayınla (aynı fonksiyonu tek yayın için `p_yayin_id` ile çağırır — app'te aktivasyon kopyası yoktur), Planı İptal (kayıt silinir, video bekleme kuyruğuna döner); durdur/başlat aksiyonlarına kapalıdır. `durum` kolonunda CHECK olmadığından `planlandi` değeri migration gerektirmemiştir.

**Dört üretim varyantı.** Hat tek değil, dört koldan yürür ve kol talep açılırken seçilir: **V1** normal (senaryo, video ve soru seti içerik üreticisinden), **V2** hazır video (senaryo hiç yazılmaz), **V3** hazır soru seti (set üretici tarafından talep anında verilir), **V4** ikisi de hazır. Numaralandırma tek standarda bağlıdır — X ekseni soru seti (yok → var), Y ekseni video (yok → var). Hazır akış **tüm üretici rollere** açıktır; onay yetkisi rolde değil üreticiliktedir (`uretici_id` şartı, herkes yalnız kendi talebini yürütür). Hazır video taleplerinde talep açılışında içerik üreticisine bildirim gitmez: iş ya hiç yoktur (V4) ya da video yüklenince doğar (V2).

**Zincirin talebe doğrudan bağlanması (22.07.2026).** Başlangıçta `videolar` ve `soru_setleri` yalnız bir önceki aşamanın durum kaydına bağlıydı; hazır kolda o önceki aşama hiç var olmadığı için ayrı bir modül sahte satırlar üretiyordu. Bu bağ kaldırıldı: iki tabloya `talep_id` (FK) ve `kaynak` (`'iu'` / `'hazir'`) kolonları eklendi, `senaryo_durum_id` / `video_durum_id` / `iu_id` nullable yapıldı. Hazır kol ayrı modülünden söküldü ve normal hatla aynı yola katıldı; kural artık tek dosyadadır — `lib/uretim/surec.ts` "onayda sıradaki kabuğu doğur + bildir" işinin tek yeridir. Kabuklar `iu_id = null` doğar (eskiden onayı veren üretici yazılıyordu ve "bu işin İÜ'su kim" sorusu ara evrede yanlış cevap veriyordu). Üretim görünürlüğü yedi tabloda RLS'e indi; üretime özel `v_uretim_detay` görünümü kurularak üretim, tüketim tarafının merkezî `v_yayin_detay`'ından koparıldı.

**Durum sözlüğü — tek doğruluk kaynağı (25.07.2026).** Aynı üretim durumu altı ayrı yüzeyde dört ayrı dille yazılıyordu: ana sayfa türetilmiş cümleler, üretim hattı sayfaları ham DB değeri, durum anahtarı kısaltmalar, yayın yönetimi kendi üçlüsü. Metin ve renk artık tek dosyadadır (`lib/utils/durum/mesaj.ts`). Kural: mesaj tek başına iki şeyi söyler — **ne oldu + kimden aksiyon bekleniyor**. Aşama adı mesajda tekrarlanmaz, onu taşıyan sütun zaten yanındadır. İçerik üreticisi için ikinci bir tablo vardır: aynı kodlar, ama İÜ'nün işi aşamaya göre değiştiği için mesaj "neyin" beklendiğini söyler ve karşı taraf kod diliyle ("üretici") değil gerçek unvanıyla anılır. Aynı desen toast metinlerinde de uygulanır (`lib/uretim/toastMesaj.ts`): sunucu uçları cümle üretmez, yalnız olguyu döner — cümleyi çağıran çözer. Kalıcı koruma `hapbilgi-mimari/toast-tek-kaynak` ESLint kuralıdır.

**Talep kimliği — firma-önekli numara (23.07.2026).** Her talep firma bazlı sıralı bir numara alır (`talepler.talep_no`, 10001'den başlar), `UNIQUE(firma_id, talep_no)` ve `talep_no_ata` INSERT trigger'ıyla güvence altındadır. Görünen metin (`FirmaAdı_10001`) kayıtta tutulmaz, firma adı ve numaradan ekranda üretilir (`lib/utils/talepId.ts`); yedi takip ekranında ilk sütundur. Tekil silme bu ID ile hedeflenir — firma karışıklığı kaynaklı hatalı silme böylece önlenir.

---

## 3. İç Müşteri Katmanı — Saha Ekibi (UTT + BM)

Bu bölüm, firmanın kendi insanlarının — sahadaki Ürün Tanıtım Temsilcileri (UTT) ve onları yöneten Bölge Müdürleri (BM) — öğrenme, ölçülme ve ödüllendirilme döngüsünü oluşturan modülleri ele alır. Tüm bu modüller §2'deki ortak temel (kimlik, roller, veri modeli, üretim hattı) üzerinde çalışır.

### 3.1 Tüketim — izleme, puanlama, öneri

Tüketim, öğrenmenin gerçekleştiği andır: üretim hattından çıkan içeriğin UTT tarafından izlendiği, sorularının cevaplandığı ve puanın kazanıldığı akış. Bu akış `app/izle/` altında dokuz API route'una dağılır (`baslat`, `bitir`, `cevap`, `sorular`, `ileri-sarma`, `begeni`, `favori`, liste, `[yayin_id]`), ancak iş mantığı §2.6 ilkesi gereği `lib/puan/`, `lib/zaman/`, `lib/oneri/` ve `lib/soru/` katmanlarında durur.

**İzleme akışı.** UTT bir videoyu izlemeye başladığında `baslat` bir izleme kaydı (`izleme_kayitlari`) açar; video bitince `bitir` çağrılır. `bitir` route'u tüketimin kalbidir ve şu sırayı yürütür: izleme kaydını tamamlandı olarak işaretle → puansız zaman penceresini kontrol et → yayın/soru seti/video puanı bilgisini çöz → izleme türüne göre puan kararını uygula. İzleme tamamlandıktan sonra sorular gösterilir (`sorular` route'u, `lib/soru/` ile setten rastgele seçim yaparak) ve her cevap `cevap` route'una gider.

**Puansız zaman penceresi — bir iş kuralı.** Puan yalnızca hafta içi 07:00–20:29 arasında kazanılır; hafta sonu tüm gün ve hafta içi bu pencere dışında izleme kaydı tutulur (analitik için) ama puan verilmez, kayıp işlenmez ve soru gösterilmez. Bu kural `lib/zaman/kontrol.ts`'teki `puanKazanilabilirMi()` ile uygulanır ve UTT'lerin mesai dışı "puan biriktirmesini" engelleyen bilinçli bir tasarımdır.

**Puan kararı — kayıt-anı simetrisinin tur bazlı uygulaması.** İzleme türüne göre karar `lib/puan/strateji.ts`'teki saf fonksiyonlarla verilir (fonksiyonlar DB sorgusu yapmaz; girdileri route hesaplar). Tekrar Gönderim Modeli ile `bitir` route'undaki dört tekillik sorgusu tur bazına alınmıştır — saf fonksiyonlara dokunulmamıştır. Tur çözümü route içinde `gecerliTur()` ile yapılır ve otomatik tur açılışının ilk tetik noktası burasıdır; çözüm başarısız olursa güvenli geri düşüş devreye girer: alt sınır epoch olur (eski ömür-boyu davranış), puan fazla verilmez, uyarı loglanır. Karar §2.5'teki üç sonuçtan birine varır:

- **İlk izleme (tur içinde)** → `ilkIzleme` kontrolü yalnızca geçerli turun kayıtlarına bakar (`gte` tur başı). İlkse `kazanilan_puanlar`'a izleme puanı **tam** yazılır; ileri sarma olsa bile azaltılmaz, kayıp yalnızca `ileri_sarma_kayitlari`'nda tutulur (çift sayım önlenir). Yan kazanım: `soru_gosterilecek = ilkIzleme && !ileriSarildi` olduğundan sorular yeni turda kendiliğinden yeniden çıkar.
- **Extra** → kural Tekrar Gönderim Modeli sırasında yeniden tanımlandı (eski kural: kayan hafta içinde 4 tam seyretme — ilk izleme dahil, hafta başına tek extra). Yeni kural: **ilk izleme sayılmaz; takvim ayı içindeki 3. tam tekrar izlemenin (ileri sarmasız, tamamlanmış, `izleme_turu = 'extra'`) sonunda TEK extra yazılır (`EXTRA_PUAN_TEKRAR_ESIGI = 3`); 4. ve sonraki tekrarlar puansızdır; her yeni ayda hak yenilenir.** Sayım alt sınırı max(ay başı, tur başı)'dır — yeni tur ay ortasında açılırsa önceki turun izlemeleri sayılmaz. Mükerrer önleme yapısaldır: extra, sayı eşiğe tam eşitlendiği anda bir kez yazılır; eski ayrı "extra mükerrer" sorgusu kaldırılmıştır (CC deseni, §3.3). Sayımın kendisi sonradan tek kaynağa çıkarılmıştır: `lib/puan/tekrarSayim.ts` (`tamTekrarSayisi`) — `bitir` route'u inline sorgu yerine bu fonksiyonu çağırır (davranış birebir), max(ay başı, tur başı) alt sınırı fonksiyonun içinde hesaplanır.
- **Öneri izleme** (`izleme_turu = 'oneri'`) → öneri penceresi `oneriPenceresiAcik()` ile kontrol edilir; açıksa ve **bu turda** verilmemişse öneri puanı yazılır — "yayın-kullanıcı çifti için tek defa" tekilliği "tur başına tek defa" olmuştur. Puan değeri koda gömülü değil, `sistem_ayarlari`'ndan (`oneri_puani`) okunur (tek kaynak, §2.5). Ayrıca öneri `izlendi_mi` işaretlenir ve ilgili bildirim `goruldu_mu = true` yapılır (Öneriler badge'i düşsün diye).

Tüm puan yazımları route içinde inline değil, `lib/puan/kayit.ts`'teki `kazanilanPuanKaydet()` üzerinden yapılır — route yalnızca "hangi tür, ne kadar" kararını orkestre eder.

**Yeniden görünme ve tekrar sayacı.** Periyodu dolan video, UTT'nin karşısına kendiliğinden yeniden çıkar: `lib/utils/anaSayfaVeri.ts`'teki tamamlanan/devam eden haritaları tur bazlıdır (`izleme_baslangic ≥` tur başı; tur kaydı olmayan yayında alt sınır epoch'tur — eski davranış birebir korunur), böylece önceki turda tamamlanan video yeni turda "yeni videolar"a döner. `daha_once_izledi` bilgisi ise ömür boyu ayrı bir haritada tutulur ve kalıcı rozeti besler: tamamlanmış + periyotlu videolarda "N gün sonra yeniden puanlı" sayacı gösterilir (UTT ana sayfa kartı `UttAnaSayfa.tsx`; üretici yayın listesinde `YayinSatir` rozeti: "Tekrar: X gün · Yeni tur: N gün sonra"). Sayaç hesabı toplu ve salt-okurdur: `gecerliTurBaslangiclari()` iki sorguyla hesaplar, satır açmaz (N+1 INSERT tuzağı yok) — gerçek tur açılışı yalnızca izleme anlarında `gecerliTur()` ile olur. E-Club kişi tarafındaki sayaç bilinçli olarak ertelenmiştir: kişiye video kendiliğinden düşmez, UTT göndermeden "puanlı olacak" demek boş vaat olur — sayaç UTT gönderim ekranına aittir ve o ekran Eczanem ile şekillenecektir (§6.4).

**Ekstra İzlediklerim — extra puanın keşfedilebilirliği.** UTT ana sayfasındaki bölümlerden biri, extra mekanizmasını görünür kılar: kullanıcının ömür boyu en az iki kez tamamladığı videolar (kaynak liste zaten `durum='yayinda'` filtreli olduğundan yalnızca aktif yayınlar) kart altında iki sayaçla listelenir — "Bu turda: N izleme" ve "Extra'ya X tam tekrar kaldı", eşik geçildiyse "Bu ay extra kazanıldı ✓". İkinci durum ayrı bir `kazanilan_puanlar` sorgusuyla değil, sayının kendisinden türetilir (sayı ≥ eşik): extra eşik anında yapısal olarak düştüğü için görüntü ile puan kararının ayrışması imkânsızdır. Sayım `tekrarSayim.ts`'in toplu imzasıyla tek sorguda yapılır (ay başı her yayın için güvenli alt küme sınırıdır, yayın bazlı tur süzgeci bellekte uygulanır; N+1 yok) ve `bitir`'in kullandığı tanımın aynısıdır (tek kaynak). 'Extra' işaretli kayıtlar doğaları gereği temizdir — ileri sarmalı ve puansız-pencere izlemeleri bitir akışında bu işareti hiç alamaz — dolayısıyla sayaç tarafında ayrıca eleme gerekmez. Sıralama keşfedilebilirlik amacına hizmet eder: extra'ya en yakın video en üstte, "bu ay kazanıldı" satırları altta, ikincil ölçüt toplam izleme. Liste boşken bölüm gizlenmez, kısa bir teşvik metni gösterilir. Not: bölümün adı bilinçli olarak "Ekstra İzlediklerim"dir — platform-geneli popülerliği gösteren mevcut "En Çok İzlenen" bölümüyle isim karışıklığı böylece yapısal olarak önlenir.

**Öneri mekanizması.** Yalnız BM, kendi bölgesindeki UTT/KD_UTT'lere video izleme önerisi gönderir; TM öneri göndermez, takımındaki BM önerilerini salt-okuma izler. Öneri `oneri_kayitlari` tablosuna geçerlilik penceresiyle (`oneri_baslangic`, `oneri_bitis`) yazılır. Öneri iş kuralları `lib/oneri/` altında üç dosyaya ayrılır: `tarihKurali.ts` (geçerli tarih aralığı), `limitKontrol.ts` (kotalar — haftalık limit ve aylık kota, `MAKS_ALICI_HAFTA` gibi sabitler), `pencereKontrol.ts` (izleme anının öneri penceresinde olup olmadığı). Öneri listesi `get_oneri_listesi` RPC'siyle tek sorguda çekilir (N+1 önlenmiş) ve role göre farklı okuma kapsamı döner. Öneri döngüsü tüketimle kapanır: UTT öneriyi penceresi içinde izlerse öneri puanı kazanır (yukarıda); süresi geçer de izlemezse `oneri_kayip_kayitlari`'na kayıp düşer (§2.5 tablosu). Tekrar modeliyle birlikte, önceki turda izlenmiş bir video yeni turda yeniden önerilebilir ve penceresi içinde izlenirse izleme + cevaplama + öneri puanı doğal olarak yeniden doğar; kayıp simetrisi bozulmaz. Bu iş için öneri tarafında kod değişikliği gerekmemiştir: gönderme listesinde "izlenmemiş" süzgeci zaten yoktur (durum + `hedef_roller` içinde `utt` filtresi) ve `get_oneri_listesi` süzgeç değil kayıt listesidir — davranış, `bitir` route'undaki dört tekillik sorgusunun tur bazına alınmasıyla kendiliğinden doğru işler.

**Üretim onay akışı ve bildirimler.** Tüketimin beslendiği içerik, §2.8'deki üretim hattından gelir; bu hattın operasyonel akışı — kimin ne zaman ne göreceği — bildirim ve badge sistemiyle yürür. Her aşamanın bir durum route'u vardır (`senaryolar/api/durum`, `videolar/api/durum`, `soru-setleri/api/durum`) ve hepsi aynı deseni paylaşır: geçerli durum sözlüğü (IU'nun set edebileceği durumlar ile üretici rolün set edebileceği durumlar ayrıdır), rol kontrolü, durum kaydı INSERT'i ve bildirim yönetimi. Bildirimler `lib/utils/bildirimOlustur.ts` ile oluşturulur; alıcısız geçişlerde (onay/iptal) `gonderenBildirimleriOkunduIsaretle()` ile gönderenin badge'i yeni bildirim üretmeden kapatılır. Badge'ler, kullanıcının okunmamış bildirimlerini periyodik olarak sorgulayan bir hook üzerinden Navbar'da görünür. Zincir yardımcıları (`lib/utils/talepZinciri.ts`) senaryo/video/soru seti kayıtlarından ilgili talebe ulaşmayı sağlar. Revizyon her aşamada sınırlıdır (maksimum iki revizyon), ve iki özel akış vardır: "hazır video" (senaryo aşaması atlanır) ve "hazır soru seti" (İU kendi yazmak yerine talepçinin verdiği seti işler); her ikisi de açıksa en kısa üretim akışı oluşur.

**Üretim ekranlarının giriş disiplini (20.07.2026).** Üretim hattındaki üç teslim ekranı, serbest metin girişinden yapısal girişe çevrilmiştir; ortak gerekçe, kuralın kayıt anında değil **girdi anında** uygulanmasıdır. **Senaryo revizyonu** düz bir textarea değildir: İçerik Uzmanı revizyonu canlı işaretli editörde (`SenaryoDuzeltmeEditoru`) yapar — silinen metin anında üstü çizili, eklenen anında kırmızı görünür, taslak yerel anahtarla korunur; üretici neyin değiştiğini metinleri karşılaştırmadan görür. **Hazır soru seti** yapıştırma alanıyla değil yapısal soru kartlarıyla girilir (`lib/soru/taslak` — soru + şıklar + doğru işareti); dosyadan içe aktarma (`SoruIceAktar`, Word/Excel/PPT/PDF/metin) yalnızca formu **doldurur**, doğrulama alan bazlı kalır — esnek parse'ın sessizce yanlış set üretmesi böyle engellenir. Kart sayısı talepteki soru seti büyüklüğüyle senkrondur: büyüklük küçülürse yalnız boş kartlar düşer, dolu veri sessizce silinmez. **Karar yetkisi** rolde değil sahipliktedir: onay / revizyon / iptal düğmelerini yalnız talebi açan üretici görür; revizyon notu zorunlu bir alandır ve revizyon tavanı ikidir — tavan dolduğunda düğme hiç çizilmez, sunucunun reddetmesi beklenmez.

**Yayındaki Videolar — üretim tarafının izleme yüzeyi (23.07.2026).** Üretici, yönetici ve yönlendirici roller yayındaki tüm videoları ayrı bir sayfadan izleyebilir (`YAYINDAKI_VIDEO_GORENLER`; içerik üreticisi ve tüketici roller hariçtir). Videolar üreten rolün **departmanına** göre klasörlenir (Ürün / Medikal / Eğitim / İK); kartta favori, beğeni ve üreten bilgisi görünür, karta tıklanınca video tam sayfa açılır. Bu yüzey **yalnız-izlemedir**: puan verilmez, soru sorulmaz — tüketim akışının kendisi değil, üretim tarafının kendi çıktısını görme yoludur.

### 3.2 Raporlar — rol bazlı ölçüm

Öğrenme ölçülemezse geliştirilemez. Raporlar ve ligler, §1.3'teki "ölçüm" halkasının teknik karşılığıdır: raporlar kişi ve kapsam bazında ne yapıldığını, ligler ise kullanıcının karşılaştırmalı konumunu görünür kılar.

Rapor modülü beş rol için beş ayrı sayfadan oluşur (`app/raporlar/` altında `utt`, `bm`, `tm`, `uretici`, `yonetici`). Mimarinin temel ilkesi şudur: **her rol kendi veri kaynağından beslenir; üst seviye, alt seviyenin verisini frontend'de toplamaz.** UTT raporu UTT RPC'sinden, BM raporu BM RPC'sinden, TM raporu TM RPC'sinden beslenir. Bir üst seviyenin alt seviyenin ham verisini çekip tarayıcıda toplaması yanlış mimari sayılır; her seviye kendi kapsamına uygun sorgudan gelir.

**Üç katmanlı yapı — sayfa / route / veri katmanı.** Her rapor §2.6'daki katman ayrımını izler:

- **Sayfa** (`app/raporlar/<rol>/page.tsx`) — yalnızca render. Hesaplama yapmaz; API'den gelen payload'ı gösterir.
- **Route** (`app/raporlar/api/<rol>/route.ts`) — orkestrasyon: auth, rol kontrolü, veri katmanı çağrısı, JSON yanıt.
- **Veri katmanı** (`lib/rapor/<rol>/get<Rol>Data.ts`) — ham veriyi RPC/tablodan çeker ve o rolün veri sözleşmesine (ör. BM için `OzetSatir`, `UrunBazliGrup`, `BolgeSiraSatir`) dönüştürür.

**Kapsamın role göre daralması.** Aynı rapor iskeleti farklı rollerde farklı genişlikte veri gösterir — bu §2.3'teki "aynı sayfa, rol-bağımlı kapsam" ilkesinin rapordaki karşılığıdır. UTT kendi performansını görür; BM bölgesindeki UTT'leri; TM takımındaki bölgeleri; üretici kendi ürettiği içeriğin performansını; yönetici tüm firmayı. Her kapsam kendi RPC'sinden gelir, böylece bir UTT'nin verisi hem kendi raporunda hem BM'in bölge raporunda aynı kaynaktan (kayıt tabloları, §2.5) türeyerek tutarlı kalır.

**Ortak hesap katmanı — `lib/rapor/paylasilan/`.** Rollerin veri katmanları farklı olsa da bazı hesaplar ortaktır; bunlar tek yerde toplanır (tek kaynak, §2.5):

- `oran.ts` — üç yüzde formülü, hepsi sıfıra bölme korumalı: `katkiYuzdesi()` (parça/bütün, 1 ondalık — ör. bölge puanı / takım toplamı), `izlenmeOrani()` (gerçekleşen izlenme / potansiyel; potansiyel = yayın × UTT), `tamamlanmaOrani()` (tamamlanan/gönderilen — öneri tamamlanması).
- `agregasyon.ts` — UTT özet satırlarından kapsam toplamlarını çıkaran ortak agregasyon.
- `ligSira.ts` — bir kişi/kapsam listesini sıralı lig görünümüne çeviren ortak mantık (sıra, bir üst rakiple fark, takipçiyle fark).

Bir yüzde formülü değişirse beş rolde ayrı ayrı değil, bu tek dosyada değişir. Veri katmanı (`get<Rol>Data.ts`, ham veri çekme) ile hesap katmanı (`paylasilan/`, dönüşüm) bilinçli olarak ayrı sorumluluklardır.

**Yönetici raporunun lazy-load akordeonu.** Yönetici raporu tüm firmayı kapsadığı için en geniş veri hacmine sahiptir; bu yüzden Takım → Bölge → UTT kırılımı tek seferde değil, katman katman (kullanıcı bir düğümü açtıkça) `app/raporlar/api/yonetici/akordeon/route.ts` üzerinden çekilir. Bu, büyük firmalarda ilk yükleme maliyetini düşürür ve raporu ölçeklenebilir tutar.

### 3.3 Challenge Club (yönetici öğrenmesi — BM)

Öğrenme yalnızca sahadaki temsilcinin işi değildir; Bölge Müdürleri de sürekli gelişmek, sahayı yönlendirebilmek için bilgilerini tazelemek zorundadır. Challenge Club, öğrenme kültürünü yönetim katmanına taşıyan modüldür: bir BM, başka bir BM'e video izleme "challenge"ı gönderir, karşı taraf süresi içinde izleyip sorularını çözer. "Önce ben öğrenirim, sonra öğretirim" anlayışının teknik karşılığıdır.

**Akış — BM → BM.** Challenge, bir BM'in (gönderen) başka bir BM'e (alan) belirli bir yayını meydan olarak göndermesiyle başlar. Bu kayıt `challenge_kayitlari` tablosuna yazılır: `gonderen_id`, `alan_id`, `yayin_id`, `izlendi_mi` ve `son_tarih` (challenge'ın geçerlilik süresi). Modül `app/challenge-club/` altında iki tarafı barındırır: gönderme tarafı (challenge oluştur + uygun alıcı/video listeleri) ve izleme tarafı (`izle/` altında `baslat`/`bitir`/`cevap`/`ileri-sarma` — UTT izleme akışının birebir paraleli). Erişim yalnızca BM'e açıktır; firma bazında `cc_aktif` bayrağıyla açılıp kapatılır (proxy bekçisi, §2.4).

**İzole puan düzlemi — `cc_` tabloları.** Challenge Club'ın en belirleyici tasarım kararı, kendi puan/kayıp tablolarını ayrı tutmasıdır. İç müşterinin ana puan tabloları (`kazanilan_puanlar` + üç kayıp tablosu) UTT tüketimine aittir; Challenge Club bunlara dokunmaz, paralel bir set kullanır:

| Tablo | Karşılığı | Anahtar |
|---|---|---|
| `cc_izleme_kayitlari` | izleme_kayitlari | `bm_id`, `challenge_id` |
| `cc_kazanilan_puanlar` | kazanilan_puanlar | `bm_id` (puan_turu + puan) |
| `cc_ileri_sarma_kayitlari` | ileri_sarma_kayitlari | `bm_id` |
| `cc_yanlis_cevap_kayitlari` | yanlis_cevap_kayitlari | `bm_id` |
| `challenge_kayip_kayitlari` | oneri_kayip_kayitlari | `kullanici_id` + `urun_id` |

Bu ayrımın gerekçesi, BM'in challenge performansının saha (UTT) performansıyla karışmamasıdır — iki farklı öğrenme bağlamı, iki farklı puan düzlemi. Ama tasarım felsefesi aynıdır: kayıt-anı simetrisi burada da birebir uygulanır (kazanım `cc_kazanilan_puanlar`'a tam yazılır, kayıplar `cc_ileri_sarma`/`cc_yanlis_cevap`/`challenge_kayip` tablolarına ayrı düşer, net = kazanım − kayıp).

**Lib katmanının zenginliği — `lib/cc/`.** Challenge Club, UTT tüketimindeki mantığı kendi düzleminde tekrar kurar ve bunu ayrıntılı bir lib katmanına böler: izleme (`izleme/baslat`, `izleme/bitir`, `izleme/extraKontrol`), puan (`puan/kazanim`, `puan/kayip`, `puan/netHesap`), kota kontrolü (`kotaKontrol`, `tekrarIzlemeKontrol`), uygun alıcı/video listeleri (`uygunAliciListesi`, `uygunVideoListesi`), soru işleme (`soru/cevapIsle`), sabitler ve bildirim mesajları. Bu, §2.6'daki "route ince, lib kalın" ilkesinin en yoğun uygulandığı modüllerden biridir. Önemli bir teknik not: challenge izleme akışında `ileri_sarma_acik` ve `extra_puan` gibi yayın değerleri, birleşik yayın view'ından değil doğrudan `yayin_yonetimi` tablosundan okunur — bu değerler view kapsamında olmadığından, yanlış kaynaktan okuma geçmişte hata üretmiştir ve doğru kaynak `yayin_yonetimi`'dir.

**CC extra kuralı — yeniden tanım ve tur bazı.** Kod incelemesi, CC'de başlangıçta hiçbir extra sınırı olmadığını ortaya çıkardı: her tekrar izleme koşulsuz extra yazıyordu. Kural Tekrar Gönderim Modeli kapsamında yeniden tanımlandı: ilk izleme sayılmaz (türü fark etmeksizin — kendi_izleme ya da challenge); takvim ayı içindeki 2. tam tekrarın (ileri sarmasız, tamamlanmış) sonunda TEK extra yazılır (`CC_EXTRA_TEKRAR_ESIGI = 2`; `extraPuanHakEdildiMi` — sayı eşiğe eşitlendiği anda tek sefer, mükerrer yapısal olarak imkânsız); 3. ve sonraki tekrarlar puansızdır; her yeni ayda hak yenilenir; sayım alt sınırı max(ay başı, tur başı)'dır. UTT extra kuralı da aynı desene güncellenmiştir (§3.1) — eşikler farklıdır (UTT 3, CC 2) ve sayım tarafları bilinçli olarak ayrı tutulmuştur (tablolar/kolonlar farklı, desen aynı).

**Tekrar modelinin BM izleme akışına uygulanması.** Tekrar/tur mantığı BM'in doğrudan izleme akışına ("İzlenecek Videolar") uygulanır: `baslat` route'unda tür kararı tur bazlıdır — yeni turda izleme `kendi_izleme`'ye döner (tam puan + sorular yeniden), liste kaynağındaki `tamamlananSet` geçerli turun kayıtlarıyla sınırlanır ve periyodu dolan video listede başa, "tamamlanmamış" olarak döner (UTT ana sayfa düzeltmesinin kardeşi); listeye "N gün sonra yeniden puanlı" sayaç rozeti de eklenmiştir. **Challenge mekanizmasının kendisi bilinçli olarak kapsam dışıdır:** meydan okuma motivasyonu puan değil sosyal jesttir ve her challenge kendi `son_tarih` penceresiyle zaten "tek turluk"tur. Challenge iş kuralları (kota, karşılıklılık, "önce kendin izle") ve alıcı-izlemiş engeli (ömür boyu — "from BM kapalı" kararının koddaki teminatı) aynen korunmuş, `uygunVideoListesi`'ne dokunulmamıştır.

**Sıralama.** Challenge Club'ın kendi lig görünümü vardır (Challenge Club Ligi); bu §3.4'te ligler başlığı altında ele alınır. Sıralama ayrı bir tablo tutmaz, `cc_` puan tablolarından canlı hesaplanır.

### 3.4 Ligler — HBLigi ve Challenge Club Ligi

Öğrenme, tek başına yürünen bir yol olduğunda yorucudur; paylaşılan bir yolculuğa dönüştüğünde anlam kazanır. Ligler, §1.3'teki "ödül" halkasının motivasyon boyutudur: her bireyin öğrenme emeğini ait olduğu topluluk içinde görünür kılar ve sağlıklı bir gelişim rekabetine çevirir. İç müşteri tarafında iki lig vardır: **HBLigi** (UTT'lerin sahnesi) ve **Challenge Club Ligi** (BM'lerin sahnesi).

**Önceden hesaplanmış özet mimarisi (E9, 31.07.2026).** İki ligde de sıralama, kişi × gün bazında önceden hesaplanmış bir **özet tablodan** okunur: HBLigi `hb_ligi_ozet_v2`, CC Ligi `cc_ligi_ozet`. Özet, kayıt-anı simetrisine sadık biçimde besleyen olay tablolarından bir **`AFTER INSERT` trigger** ile günlük kovaya toplanır (HBLigi: `kazanilan_puanlar`'ın dört kazanım türü — izleme/cevaplama/oneri/extra — + üç kayıp tablosu; CC: BM rolü, izleme/cevaplama/extra/cc_gonderme/cc_referral + challenge kaybı). Okuma anında `v_hbligi_sirali`/RPC'ler bu günlük kovaları seçilen tarih aralığıyla toplar, net puanı (`toplam_puan`) çıkarır, kullanıcıyı firma/takım/bölge ile birleştirir ve sıra kolonlarını (`firma_sirasi`, `bolge_sirasi`, `takim_sirasi`) okuma anında `row_number`/`RANK` ile üretir. Bu, E9 öncesi **her sorguda kayıt tablolarından sıfırdan SUM yapan** "canlı hesap" yaklaşımının yerini aldı; sebep ölçekti (hedef 100k) — ilkel tam-tarama her okumada tekrarlanıyordu. Tutarlılık korunur: özet aynı olay tablolarından türetilir, geçişte canlı-SUM ile birebir doğrulandı (fark 0), ve trigger her yazımı anında kovaya işlediğinden çift sayım/bayat snapshot yapısal olarak yoktur — bir UTT'nin raporundaki net puanı ile lig sıralamasındaki puanı **aynı kaynaktan** gelir. Tekrar Gönderim Modeli'yle uyum sürer: puanlar tur bazlı çoğaldığında yeni kayıtlar aynı tablolara yazılır, trigger özeti günceller; türetilmiş rapor katmanı (`getUttData.ts` dahil) doğru kalır. Store bakiyelerinin puan artışıyla büyümesi iş modelinin doğal sonucudur, teknik sorun değildir. *(Not: özeti besleyen öneri kaybı yazımı E9 öncesi eksikti — `oneri_kaybi_tara()` fonksiyonu aynı çalışmada kuruldu; bkz. §7.)*

**Periyot boyutu — parametreli RPC ailesi.** Lig, sabit bir "tüm zamanlar" sıralaması değildir; **dört periyotta** görülebilir: haftalık, aylık, dönemlik (çeyrek), yıllık. Her lig için dört RPC vardır: `get_hb_ligi_haftalik/aylik/donemlik/yillik` (ve CC tarafında `get_cc_ligi_*` + dönem/yıl lideri fonksiyonları). Hepsi özet tablonun günlük kovalarını seçilen tarih aralığıyla toplar (haftalık Pazartesi bazlı, `date_trunc('week')`). Sayfa bir periyot seçici sunar; seçime göre `lib/hbligi_v2/ligRpcCagir.ts` (CC: api içi dispatch) doğru RPC'yi çağırır. Bu, "yarış periyotta, takip anlık" ilkesini uygular: profil ve UTT raporundaki anlık puan tüm-zaman görünümünden beslenirken, lig sıralaması seçilen periyodun penceresinden hesaplanır.

**Puan çeyrek-sıfırlaması ve kalan sipariş puanı.** Lig periyot mantığıyla ilişkili bir iş kuralı, puanların takvim çeyreği bazlı değerlendirilmesidir. UTT/BM raporlarında "Kalan Sipariş Puanı" gösterimi, periyottan bağımsız olarak anlık çeyrek bakiyesini yansıtır — bu, kazanılan puanın hem yarışmada (lig) hem ödülde (store bakiyesi, §3.5) nasıl kullanıldığının kesişim noktasıdır.

**Rol bazlı cascade görünüm.** HBLigi, §2.3'teki kapsam-daralması ilkesini lig sıralamasına uygular. UTT'nin kişisel lig görünümü `getUttLig`, üst rollerin saha görünümü ise tek ve sunucu-yetkili `getSahaLig` sözleşmesinden beslenir; istemciden gelen firma/takım/bölge kimliği yetki kaynağı değildir. BM kendi bölgesinin UTT'lerini ve kendi takımındaki bölgelerin karşılaştırmasını; TM kendi takımının UTT'lerini ve yalnız kendi firmasındaki takımların karşılaştırmasını; üretici rol kendi takımındaki bölge→UTT kırılımını; yönetici kendi firmasındaki takım→UTT kırılımını; admin sistem genelindeki firma kırılımını görür. Sıralama düğümleri açıldıkça derinleşen bir cascade olarak sunulur. Üst seviyelerin puanları aynı periyot RPC'sinin alt UTT satırlarından türetilir; DB'de ikinci bir skor motoru yoktur. Eşit net puan eşit sıradır (`dense rank`); eşit puan içindeki görsel sıra Türkçe ada göre kararlı tutulur. Üst rol ekranındaki özet, puan bileşimi ve saha sinyalleri yalnız gerçek kazanım/kayıp kayıtlarından hesaplanır; UTT kişisel ekranındaki geliştirme-motoru stub'ları üst rollere taşınmaz.

**Challenge Club Ligi.** Aynı gelişim ruhunu yönetim katmanına taşır: BM'ler challenge performanslarında yarışır. `app/cc-ligi/` altında ayrı sayfa/route olarak durur, `cc_` puan tablolarından (§3.3) canlı hesaplanır ve `CCLIGI_GORENLERLER` kümesindeki rollere (BM asıl, TM/üretici/yönetici/admin gözlemci) açıktır. Periyot ve lider mantığı HBLigi ile aynı desendedir (aylık/dönemlik/yıllık + dönem/yıl lideri). Firma bazında `cc_aktif` kapalıysa lig de görünmez.

### 3.5 HBStore (iç ödül)

Firmanın kendi insanları da emeklerinin karşılığını hissetmelidir. HBStore, §1.3'teki "ödül" halkasının somut boyutudur: UTT, KD_UTT ve BM'in öğrenme yolculuğunda kazandıkları puanı fiziksel ürünlerle takdire dönüştürdüğü mağazadır. Öğrenmeyi bireysel bir yük olmaktan çıkarıp kazanıma bağlar — "öğrendikçe kazanıyorum".

**İki taraf — alışveriş ve izleme.** Modül `app/store/` altında iki yüzü barındırır. Alışveriş tarafı (vitrin `page.tsx`, ürün detayı `[urun_id]`, adres yönetimi `adreslerim`, kendi siparişleri `siparislerim`) puan harcayabilen roller (`STORE_ALABILEN_ROLLER`: UTT/KD_UTT + BM) içindir. İzleme tarafı (`siparisler/`, filtreli tablo + hiyerarşi) ise başkalarının siparişlerini kapsam dahilinde gören roller (`STORE_GENEL_GOREN_ROLLER`) içindir: BM bölgesindeki, TM takımındaki, üretici/yönetici firma genelindeki siparişleri görür. Bu yine §2.3'teki kapsam-daralması ilkesidir.

**Global katalog, firma bazlı görünürlük.** HBStore'da her firma için ayrı mağaza veya katalog kopyası kurulmaz. `store_kategoriler` ve `store_urunler` tüm sistemin ortak kataloğudur; admin, bir global ürünün satırındaki **Firma Erişimi** yönetiminden ürünü seçili firmalarda açıp kapatır. Bu istisnalar `store_urun_firma_ayarlari` tablosunda tutulur: satır yoksa ürün firmaya açıktır, yalnız kapatma istisnası (`aktif_mi=false`) kaydedilir; `store_urunler.aktif_mi=false` ise firma ayarından bağımsız global kapatmadır. Böylece örneğin AirPods tek ürün olarak yönetilir, maliyeti uygun olmayan firmalarda kapatılır; ürün/stok/kategori kopyaları ve birbiriyle ayrışan mağazalar doğmaz.

**Altı tablo.** Mağazanın veri modeli altı tablodan oluşur:

| Tablo | Rol |
|---|---|
| `store_kategoriler` | Ürün kategorileri (`ad`, `sira`, `aktif_mi`) |
| `store_urunler` | Ürünler (`puan_fiyati`, `stok`, `gorsel_url`, `aktif_mi`) |
| `store_urun_firma_ayarlari` | Global ürünün firma bazlı kapatma istisnası (`urun_id`, `firma_id`, `aktif_mi`) |
| `store_adresler` | Kullanıcı teslimat adresleri (`varsayilan_mi`) |
| `store_siparisler` | Siparişler (`adet`, `toplam_puan`, `durum`, kargo bilgisi, `adres_snapshot`) |
| `store_puan_harcamalari` | Puan harcama kayıtları (`puan_miktari`, `tur`, `siparis_id`) |

Dikkat çeken iki tasarım detayı: `store_siparisler.adres_snapshot` sipariş anındaki adresi jsonb olarak dondurur (adres sonradan değişse bile sipariş kaydı bozulmaz), ve harcama ayrı bir tabloda (`store_puan_harcamalari`) tutulur — bu, kayıt-anı simetrisinin (§2.5) ödül tarafındaki karşılığıdır: puanın kazanımı ayrı, harcaması ayrı kayıtta durur.

**Bakiye — çeyrek penceresi.** Harcanabilir puan (sipariş bakiyesi), `get_harcama_bakiyesi` RPC'siyle hesaplanır. Kritik iş kuralı: bakiye, tüm-zaman puanı değil, takvim çeyreği penceresindeki kazanımdan aynı penceredeki harcamaları düşen anlık değerdir. Takvim çeyreği değiştiğinde önceki puan ve sipariş kayıtları silinmez; yeni çeyreğin hesap penceresine girmedikleri için kullanılabilir bakiye sıfırdan başlar. UTT/KD_UTT'nin firmasında HBStore açıksa Navbar'da **Sipariş Puanı** görünür; sipariş tamamlanınca kullanılan puan anında düşer, sipariş iptal edilip puan iade edilince anında yükselir. Bu §3.4'teki "yarış çeyrekte, takip anlık" ilkesiyle uyumludur ve UTT/BM raporlarındaki "Kalan Sipariş Puanı" gösterimini besler.

**Sipariş yaşam döngüsü — atomik RPC'ler.** Sipariş işlemleri, tutarlılık gerektirdiği için tek tek atomik RPC'lerle yürür (`lib/store/` orkestrasyonu üzerinden):

- `store_siparis_olustur` — önce firmanın HBStore erişimini, global ürün aktifliğini ve firma-ürün görünürlüğünü doğrular; ardından korunmuş atomik çekirdekte stok kilidi + bakiye kontrolü + adres snapshot + sipariş kaydı + puan düşme + stok azaltma işlemlerini birlikte yürütür. Vitrini aşan doğrudan istek de kapalı ürünü satın alamaz.
- `store_siparis_iptal` — stok iadesi + durum güncelleme (harcama kaydı iptal mantığıyla bakiyeye geri döner).
- `store_teslim_aldim` — kargodaki siparişi teslim edildi olarak işaretler.

İzleme tarafı için `get_kapsamli_siparisler` (role göre kapsamlı sipariş listesi) ve `get_siparis_filtre_hiyerarsi` (filtre dropdown'ları için takım/bölge hiyerarşisi) RPC'leri kullanılır. Lib katmanı bunları domain'lere böler: `bakiye.ts`, `siparis.ts`, `adres.ts`, `kargo.ts`, `storage.ts` (ürün görselleri), `sabitler.ts`, `tipler.ts`.

**Firma bazlı iki ayrı kapı.** `firmalar.hbstore_aktif`, mağazanın tamamını firma düzeyinde açıp kapatır; kapalı firmada hiçbir kullanıcı (ne alışveriş yapan ne izleyen) mağazaya erişemez — proxy bekçisi (§2.4), route doğrulaması, sidebar ve Navbar görünürlüğü birlikte çalışır. Mağaza açıkken ürün düzeyindeki daha dar kapı `store_urun_firma_ayarlari`'dır; vitrin, kategori listesi, ürün detayı ve sipariş RPC'si aynı kararı uygular.

---

## 4. Dış Müşteri Katmanı — Eczane (Eczacı + Eczane Teknisyeni)

Bu bölüm, HapBilgi'nin sahanın diğer ucundaki uzmanlara — eczacılara ve eczane teknisyenlerine — uzanan katmanını, yani E-Club modülünü ele alır. §1.2'de tanımlandığı gibi bu kişiler firmanın çalışanı değildir; ayrı bir kimlik düzleminde (`eclub_kisiler`) yaşarlar ve sisteme kendilerini ekleyen UTT aracılığıyla bağlanırlar. E-Club, iç müşterinin öğrenme iskeletini (öğren → puan → sırala → ödül) dış müşteri düzleminde tekrar kurar; ama bu düzlemin kendine özgü iki belirleyici farkı vardır: **çok firmalılık** ve **izolasyon**. E-Club tüm tablolarını `eclub_` önekiyle ayrı tutar, mevcut iç müşteri tablolarına dokunmaz — böylece iki katman aynı ekosistemde ama birbirine karışmadan yaşar.

### 4.1 E-Club — Liste yönetimi (eczane/kişi, GLN & master, UTT bağı)

Dış müşteri döngüsü, bir eczanenin ve içindeki kişilerin sisteme tanıtılmasıyla başlar. Bu işi UTT yapar: sahada tanıştığı eczaneyi ve o eczanedeki eczacı/teknisyeni kendi listesine ekler. Modül `app/eclub/listem/` altında yaşar (sayfa + `EczaneBlogu` bileşeni + `useEclubListem` hook + iki API route: `eczaneler`, `kisiler`).

**Beş tablolu bağlılık modeli.** Dış müşteri kimliğinin (§2.2) neden `eclub_kisiler`'de firma/eczane bağı taşımadığı burada netleşir: bu ilişkiler zamanla değişebilen, çok-yönlü bağlar olduğu için ayrı tablolarda tutulur. Beş tablo birlikte modeli kurar:

| Tablo | Rol |
|---|---|
| `eclub_eczane_master` | Resmî eczane sicili — `gln` (birincil anahtar), `eczane_adi`, `il`, `ilce`, `onay_durumu`, `ekleyen_utt_id`. GLN'den ada çözümlemenin kaynağı. |
| `eclub_eczaneler` | Sisteme dahil edilmiş eczaneler — `eczane_id`, `gln`. Master'a GLN üzerinden bağlanan hafif kayıt. |
| `eclub_eczane_firma` | Eczane–UTT sahiplik bağı — `eczane_id`, `firma_id`, `baglayan_utt_id`, `aktif_mi`. Bir eczaneyi hangi firmanın hangi UTT'sinin bağladığını tutar. |
| `eclub_kisiler` | Kişi kimliği — `kisi_id`, `rol` (eczaci/eczane_teknisyeni), ad/soyad/eposta/telefon. Eczane bağı yok. |
| `eclub_kisi_eczane` | Kişi–eczane bağı — `kisi_id`, `eczane_id`, `aktif_mi`, `baslangic/bitis_tarihi`. Kişinin hangi eczaneye bağlı olduğunu ve aktifliğini tutar. |

**GLN — eczanenin evrensel kimliği.** Sistemin veri kalitesini ayakta tutan anahtar, GLN'dir (Global Location Number — eczanenin 13 haneli benzersiz kimliği). UTT bir eczane eklerken serbest metin girmez; GLN ile `eclub_eczane_master` sicilinden **seçer**. Master, resmî eczane kaydını (ad, il, ilçe) taşır; UTT buraya kayıt eklemez, oradan bulur. Bir eczanenin adı bu yüzden `eclub_eczaneler`'de değil, GLN üzerinden bağlı `eclub_eczane_master`'da yaşar — kod bunu nested embed yerine ayrı sorgu + Map ile çözer (view/FK üzerinden nested join her zaman güvenilir olmadığından). Bu tasarım, aynı eczanenin farklı UTT'ler tarafından tutarlı biçimde tanınmasını sağlar.

**Bul-veya-oluştur ve sahiplik.** UTT bir GLN girdiğinde sistem "bu eczane zaten var mı" diye bakar: varsa mevcut `eczane_id`'ye bağlanır, yoksa oluşturur. Ardından `eclub_eczane_firma`'ya sahiplik bağı (`baglayan_utt_id`, `firma_id`) yazılır. Böylece aynı fiziksel eczane, farklı firmaların UTT'leri tarafından bağlanabilir — çok firmalılığın veri modelindeki temeli budur. Kişi eklemede benzer mantık: kişi `eclub_kisiler`'e, eczaneyle bağı `eclub_kisi_eczane`'ye yazılır.

**Bağ kuralları.** Modelin tuttuğu iş kuralları: bir eczacı tek bir eczaneye aktif bağlıdır; bir eczanede tek eczacı ama birden çok teknisyen olabilir; pasife alma kişiyi silmez, yalnızca `eclub_kisi_eczane.aktif_mi`'yi `false` yapar (kişinin puanları `kisi_id`'de kaldığı için korunur). Elle girilen eczaneler (master'da olmayan) admin onayına düşer (`eclub_eczane_master.onay_durumu`, §6.1).

**Görünürlük ayrımı.** Eczane/kişi listesini ve video gönderimini yalnızca ekleyen UTT görür (`ECLUB_GOREN_ROLLER`: utt/kd_utt); üst roller UTT adına bağ veya öneri yönetemez. Buna karşılık Raporlar, E-Club Ligi ve Siparişler üst rollerde yönetim hiyerarşisiyle açılır. Her UTT yaprağı yine kendi aktif eczane/kişi kapsamından hesaplanır; üst toplamlar bu güvenli yaprakların birleşimidir ve başka hiyerarşideki UTT kapsama karışmaz.

**İç kullanıcı çalışma yüzeyi — tek E-Club grubu, dört görev.** UTT/KD_UTT sidebar'ında E-Club dört sayfayı sabit sırayla sunar: **Videolar ve Eczanelerim**, **Raporlar**, **E-Club Ligi**, **Siparişler**. İlk sayfa iki görünümü tek yerde birleştirir: UTT yayındaki uygun videoları izler/önerir ve kendi eczane–eczacı–teknisyen bağlarını yönetir. BM, TM, üretici ve yönetici roller bu yönetme sayfasını görmez; E-Club altında Raporlar, E-Club Ligi ve Store açıksa Siparişler'i görür. Raporlar periyot bazlı eczane→kişi öğrenme sonuçlarını, lig dış müşteri sıralamasını, Siparişler ise firma payıyla doğan siparişleri rol kapsamına göre BM→UTT veya Takım→BM→UTT hiyerarşisinde gösterir. Bu dört sayfa birbirinin tekrarı değildir; yönetme, ölçme, sıralama ve sipariş izleme görevlerini ayırır.

**Test GLN havuzu ve temizliği.** Gerçek eczane kayıtları `868` önekli resmi GLN havuzunda kalır; test kayıtları adminin E-Club sekmesindeki **Test Eczane Tanımları** kartından üretilir. Sistem her istekte 1–100 arasında benzersiz, 13 haneli ve `111` önekli GLN oluşturur; kayıtları `kaynak='test'`, `onay_durumu='onayli'` olarak master havuza yazar. UTT tarafında ayrı test alanı yoktur: UTT bu numarayı mevcut GLN aramasına girer ve gerçek eczane ekleme akışını aynen çalıştırır. Böylece test, doğrudan DB eklemesiyle süreci atlamaz. Admin kullanılmamış master kayıtlarını tek tuşla kaldırabilir; kullanılmış testlerin tam temizliği ise önce kapsam sayılarını gösteren, `TEST VERİLERİNİ SİL` açık onayını isteyen **Test Sürecini Temizle** işlemiyle yapılır. DB zinciri `eclub_test_veri_islem('temizle')` RPC'sinde atomik silinir; Store stokları geri konur, test eczanesine ait E-Club/Eczanem bağları, öğrenme kayıtları, puanlar, siparişler ve yalnız-test kimlikleri temizlenir, Auth hesapları route'ta Admin API ile kapatılır. Gerçek eczaneyle herhangi bir bağı veya işlemi bulunan E-Club kişisi/Eczanem müşterisi silinmez; yalnız test bağı kaldırılır.

### 4.2 E-Club — Öneri ve tüketim (izleme/puanlama)

Dış müşteri öğrenmesi, UTT'nin bir videoyu bir kişiye (eczacı/teknisyen) önermesiyle başlar ve kişinin o videoyu izleyip sorularını çözmesiyle tamamlanır. Bu, §3.1'deki UTT tüketim akışının dış müşteri düzlemindeki karşılığıdır — aynı iskelet, `eclub_` tabloları üzerinde.

**Öneri akışı — UTT → kişi.** UTT, `/eclub/listem` içindeki **Videolar** görünümünden bir yayını önce izleyebilir, sonra öneri modunda seçili kişiye gönderebilir. Öneri `eclub_oneri_kayitlari` tablosuna yazılır: `oneren_id` (UTT — `kullanicilar`), `kisi_id` (alıcı — `eclub_kisiler`), `yayin_id`, geçerlilik penceresi (`oneri_baslangic`, `oneri_bitis`) ve `izlendi_mi`. Yayın seçimi hem UTT'nin firma/takım kapsamıyla hem `hedef_roller` ile sınırlıdır: Eczacı veya Eczane Teknisyeni hedeflerinden en az birini içeren, yayında ve erişilebilir içerikler önerilebilir (§2.8). Alıcı bu UTT'nin aktif bağlı eczanesinde bulunmalı, giriş hesabına sahip olmalı ve kendi rolü yayın hedefleri içinde yer almalıdır. İki rol birlikte hedeflenmişse aynı yayın her iki rol için de seçilebilir; öneri ve izleme kayıtları `kisi_id`/`oneri_id` düzeyinde ayrı kalır.

**E-Club'ta Gönderi Sayısı Limitleri.** Gönderim rakamlarının tamamı admin'in Sistem Ayarları ekranındaki aynı adlı kart grubundan yönetilir ve **tüm firmalara aynı** uygulanır. Tek kaynak tanımı `lib/eclub/gonderiAyarlari.ts`, iş kuralı okuyucusu `lib/eclub/oneriLimit.ts`'tir; ayar okunamazsa aynı tanımdaki güvenli varsayılan kullanılır. Beş değer şunlardır: UTT aylık gönderim limiti (`eclub_aylik_gonderim_limiti`, varsayılan 100), öneri izleme/puan/soru geçerlilik süresi (`eclub_oneri_gecerlilik_gun`, 7 gün), aynı UTT'nin aynı kişiye tekrar gönderim aralığı (`eclub_gonderim_araligi_gun`, 7 gün), alıcı toplamlarının sayıldığı kayan pencere (`eclub_alici_pencere_gun`, 7 gün) ve kişinin bu pencerede tüm UTT'lerden alabileceği toplam öneri (`eclub_alici_haftalik_limit`, 20). Aylık kota takvim ayı başında fiilen sıfırdan sayılır; öneri gönderildiği anda tüketilir, izlenmemesi krediyi geri getirmez.

**Tüketim akışı — kişi paneli.** Kişi, kendisine önerilen videoları `app/eclub/panel/` üzerinden izler. Panel API'si dört adımdan oluşur (UTT akışının paraleli): `baslat` (izleme kaydı — `eclub_izleme_kayitlari`, `izleme_turu = 'oneri'`), `sorular` (setten rastgele soru seçimi, doğru cevap sızdırılmadan), `cevapla` (her cevap), `bitir` (izleme tamamlama + puanlama). Video oynatma §2.7'deki provider-agnostik oynatıcıyla (`EclubVideoOynatici`) yapılır. Kişi yalnızca kendine önerilen ve kendi rolünü `hedef_roller` içinde taşıyan yayınları görür (çift filtre). Aynı `yayin_id`yi izleyen Eczacı ve Teknisyen için farklı `oneri_id` ve `izleme_id` doğar; cevap ve puan tekillikleri `izleme_id` üzerinden korunur.

**Atomik tamamlama ve cevaplama.** İzleme tamamlanması `eclub_izleme_tamamla`, cevap kümesinin kaydı `eclub_cevaplari_kaydet` RPC'sinde atomik yürür. İzleme başına öneri, puan türü ve soru cevabı tekillikleri veritabanı indeksleriyle korunur; `eclub_izleme_kayitlari` o izlemeye soru hakkı verilip verilmediğini, nedenini ve atanmış soru indekslerini saklar. Süresi geçmiş video izlenebilir ama **puan kazandırmaz ve soru seti açmaz**. Yanlış cevap da puan kazandırmaz ve `kaybedilen_puan = 0` olarak tutulur; dış müşterinin izleme isteğini tersine çevirecek ceza uygulanmaz.

**Puanlama — kayıt-anı simetrisinin dış karşılığı.** Geçerli penceredeki puan yazımı atomik RPC'lerde yapılır ve §2.5 ilkesini izler:

| Olay | Tablo | Karşılığı |
|---|---|---|
| geçerli izleme tamamlandı | `eclub_kazanilan_puanlar` | izleme kazanımı |
| doğru cevap kaydedildi | `eclub_dogru_cevap_kayitlari` | cevaplama kazanımı |
| yanlış cevap kaydı | `eclub_yanlis_cevap_kayitlari` | cevap sonucu, kayıp 0 |
| önerilen video tamamlandı | `eclub_utt_puanlari` | UTT koçluk puanı (+10) |

Her kayıt `urun_id` denormalizasyonunu taşır (§2.5, İlke 2); `urun_id`, `get_urun_from_yayin()` ile çözülür. Süre penceresi kuralı RPC içinde yeniden doğrulanır; istemci bu kararı veremez.

Tekrar Gönderim Modeli bu düzlemde de geçerlidir. `bitir` route'u `gecerliTur()` ile yayın turunun başlangıcını çözer ve bunu atomik tamamlama RPC'sine verir; izleme puanı aynı yayın için aynı turda ikinci kez doğmaz. Yeni turdaki yeni öneri yeni bir `izleme_id` üretir; izleme/cevaplama puanı ve öneriyi gönderen UTT'nin +10 GönderiPuanı yeniden doğabilir. Tur çözülemezse güvenli geri düşüş ömür-boyu tekilliktir; aynı olayın iki kez puan yazması yerine kazanımın daralması tercih edilir.

**İç müşteriden iki fark.** Dış müşteri tüketimi UTT akışının kopyası olsa da iki bilinçli fark taşır. Birincisi, yanlış cevap ve süre aşımı ceza üretmez; geçerli ve doğru davranış ödüllendirilir, motivasyonu tersine çevirecek eksi puan yoktur. İkincisi, **UTT koçluk puanı (GönderiPuanı)** vardır: kişi önerilen videoyu geçerli sürede tamamladığında öneriyi gönderen UTT'ye +10 puan yazılır (`eclub_utt_puanlari`). Bu puanın ayrı tabloda tutulması, kişinin izlemesinin iç müşteri kayıtlarına FK ile bağlanamaması sorununu çözer ve UTT katkısını dış müşteri puanından ayırır.

### 4.3 E-Club — Kimlik, bildirim, kişi paneli

Dış müşterinin sisteme girişi, iç kullanıcılardan farklı bir yol izler: eczacı/teknisyen kendini kaydetmez, UTT tarafından sisteme eklenir ve sonradan bir giriş kimliği kazanır. Bu bölüm o kimlik köprüsünü, kişinin gördüğü paneli ve bildirim mekanizmasını ele alır.

**Kimlik köprüsü — `v_auth_kimlik`.** §2.2'de tanıtılan birleşik kimlik view'ı burada işlevini gösterir. AuthProvider, giriş yapan herkesi tek sorguyla `v_auth_kimlik`'ten çözer ve `kimlik_turu` kolonuna bakar: `'kullanici'` ise iç müşteri, `'eclub_kisi'` ise dış müşteri. Buna göre kişi giriş sonrası kendi paneline (`/eclub/panel`) yönlendirilir; iç kullanıcıların firma-aktiflik kontrolü kişiyi atlar (kişinin `firma_id`'si yoktur, çok firmalıdır). Kişi ekleme akışı (`listem/api/kisiler`) auth kaydını oluşturur: `auth.admin.createUser` ile bir auth kullanıcısı açılır, `eclub_kisiler.auth_user_id`'ye bağlanır; herhangi bir adım başarısız olursa rollback yapılır. `auth_user_id`'nin nullable olması (§2.2), kişinin giriş kimliği kazanmadan da listeye eklenebilmesini sağlar.

**Geçici auth ve OTP açık işi.** Şu anki giriş modeli geçicidir: UTT kişi için e-posta + şifre belirler, kişi bununla girer. Hedeflenen gerçek akış — kişiye tek kullanımlık kod (OTP) + giriş linki, ilk girişte zorunlu şifre değiştirme — henüz kurulmamıştır; bu bir açık iştir (§6.4). Ayrıca bir güvenlik inceliği: `v_auth_kimlik` view'ı, giriş yapan her kullanıcının yalnızca kendi kimlik satırını görebilmesi için `auth.uid()` filtresiyle daraltılmıştır (aksi halde birleşik view tüm kimlikleri sorgulanabilir kılardı).

**Kişi çalışma yüzeyi.** Eczacı ve eczane teknisyeni için ayrı rapor veya lig yüzeyi yoktur; dış müşteri gezinmesi dört görevle sınırlıdır: **Videolarım**, **Mağazam**, **Siparişlerim**, **Adreslerim**. `app/eclub/panel/` kişiye önerilen videoları firma başlıkları altında toplar; her videoda geçerli video/soru puanını, doğru-yanlış sonucunu ve fiilen kazanılan puanı gösterir. Üst özetler toplam kazanımı ve Store'da harcanabilir bakiyeyi ayırır; izleme ve soru akışı aynı panelde tamamlanır. Panel API'si (`panel/api/route.ts`) giriş yapan kişiyi çözer, yalnız `kisi_id`'sine bağlı önerileri ve bu önerilerin izleme/puan kayıtlarını döndürür. Mağaza tarafı firma bakiyelerini ayrı gösterirken toplam harcanabilir bakiyeyle sipariş verilmesini sağlar; sipariş ve adres yaşam döngüsü kendi iki sade sayfasında yönetilir. Böylece arayüz basit kalır ancak çok firmalı puanın kaynağı kullanıcıdan gizlenmez.

**Bildirim.** UTT bir öneri gönderdiğinde, kişiye bir bildirim yazılır: `eclub_bildirimler` tablosuna (`alici_kisi_id`, `gonderen_id`, `kayit_turu`, `mesaj`, `goruldu_mu`) `lib/utils/eclubBildirim.ts` üzerinden kayıt düşülür (tekil ve çoklu bildirim fonksiyonları). Mevcut durumun dürüst tespiti: **bildirim yazılıyor ama kişi tarafında henüz gösterilmiyor.** Öneri zaten panelde göründüğü için ayrı bir zil/rozet gösterimi kurulmamıştır; okundu işaretleme mekanizması ve harici kanal (WhatsApp/SMS) bildirimi de henüz yoktur. Bunlar açık işlerdir (§6.4). Yani altyapı (tablo + yazım) hazırdır; görüntüleme katmanı eksiktir.

### 4.4 E-Club Ligi (dış müşteri takım sıralaması ve yönetim hiyerarşisi)

E-Club Ligi'nin çekirdeği UTT/KD_UTT'nin kendi dış müşteri takım sıralamasıdır. Yarışanlar bu UTT'nin aktif bağlı eczanelerindeki eczacı ve teknisyenlerdir; başka UTT'nin eczanesi veya kişisi UTT kapsamına giremez. BM kendi UTT'lerini, TM kendi BM→UTT hattını, üretici ve yönetici roller ise yetkili takım/firma kapsamını aynı verinin üstten toplamı olarak görür. Hiyerarşi adla değil `firma_id`, `takim_id` ve `bolge_id` kimlikleriyle kurulur; aynı adlı bölgeler birbirine karışmaz. Ana sıralama kişinin izleme ve doğru cevap puanından oluşur; UTT'nin GönderiPuanı ise Raporlar'da UTT katkısını ölçen ayrı metriktir ve kişi sırasına eklenmez.

**Sıralamanın temeli.** Puan = kişinin geçerli sürede kazandığı izleme puanı + doğru cevap puanı. Yanlış cevap kayıp üretmez. Eşit puanlar eşit sıra alır; puan kazanmayan kişiye yapay sıra verilmez. Kişi satırı açıldığında puanını oluşturan ürün/içerik dökümü görünür.

**Tek rapor kaynağı.** Raporlar ve lig ayrı hesaplar üretmez; ikisi de `get_eclub_utt_rapor(p_utt_id, p_baslangic, p_bitis)` RPC'sinin kişi×içerik satırlarını kullanır. `lib/eclub/rapor.ts` aynı ham veriyi raporda eczane→kişi ve içerik dağılımına, ligde kişi→içerik sırasına toplar. Böylece aynı periyotta rapor toplamı ile lig toplamının ayrışması önlenir. Lig haftalık, aylık, dönemlik ve yıllık seçilebilir; zaman aralığı `lib/eclub/ligPeriyot.ts` ve ortak zaman yardımcılarından gelir.

**Takım adı ve dışa aktarma.** `eclub_takim_adlari` tablosu UTT'nin kendi dış müşteri takımına verdiği adı tutar (`app/eclub/ligi/api/takim-adi`); üst roller bu adı değiştiremez. `api/export` endpoint'i oturum kullanıcısının yetkili hiyerarşisini Takım→BM→Bölge→UTT kolonlarıyla Excel'e döker. Firma bazında `eclub_aktif` kapalıysa lig görünmez; UTT'nin video/eczane yönetimi `ECLUB_GOREN_ROLLER`, rapor-lig-sipariş yönetimi ise `ECLUB_YONETIM_ROLLERI` sözleşmesini kullanır.

**Canlı hesap.** E-Club Ligi ayrı bir sıralama tablosu tutmaz; `eclub_kazanilan_puanlar` ve cevap kayıtları `get_eclub_utt_rapor` tarafından periyot penceresiyle canlı toplanır. Tutarlılık ve anlık takip aynı kaynaktan gelir (§2.5).

### 4.5 E-Club Store (dış ödül, çok-firmalı bakiye)

E-Club Store, dış müşterinin öğrenme emeğinin karşılık bulduğu mağazadır — §3.5'teki HBStore'un dış müşteri katmanındaki ikizi. Kişi, izleme ve doğru cevaplarla kazandığı puanı ürünlere dönüştürür. Modül `app/eclub/store/` altında yaşar: vitrin (`page.tsx`), adres yönetimi (`adreslerim`) ve kendi siparişleri (`siparislerim`) kişi tarafıdır. İç kullanıcıların kanonik izleme yüzeyi `/eclub/siparisler`'dir; `get_eclub_utt_siparisler` her UTT için yalnız o UTT'nin aktif bağladığı eczanelerdeki eczacı/teknisyen siparişlerini ve firmanın puan kullanımını döndürür. Yönetim API'si bu güvenli UTT parçalarını oturum kapsamına göre birleştirir: BM→UTT, TM→BM→UTT, firma düzeyi→Takım→BM→UTT. Eski `/eclub/store/rapor` yolu kanonik sayfaya yönlenir.

**Yapısal paralellik, tek kritik fark.** Beş tablo HBStore'un birebir karşılığıdır (`eclub_store_kategoriler`, `urunler`, `adresler`, `siparisler` — aynı kolon deseni, `kisi_id` ile). Ama bir tablo fazladır ve bu fazlalık E-Club Store'un asıl mimari sorununu çözer: `eclub_store_siparis_firma_puan` (`siparis_id`, `firma_id`, `kullanilan_puan`). Bu tablonun varlığı, dış müşterinin **çok firmalı** olmasının (§1.2) ödül tarafındaki doğrudan sonucudur.

**Çok-firmalı bakiye — puanın kaynağı firmaya bağlı.** Bir kişinin puanı tek bir havuzda değil, firma bazında ayrı ayrı birikir: `eclub_kazanilan_puanlar.urun_id`, ürün üzerinden `firma_id`'ye çözülür (§2.5, İlke 2), yani bir kişinin kazandığı her puan hangi firmanın içeriğinden geldiği bilinerek tutulur. `get_eclub_store_firma_bakiye` RPC'si, bu şekilde kişinin **firma bazında ayrıştırılmış** bakiyesini döner ve sorgu yalnızca `eclub_store_aktif = true` olan firmaları kapsar — bir firma modülü kapatırsa o firmanın puanı bakiyede görünmeye devam etmez.

**Sipariş anında birleştirerek harcama.** Kişi sipariş verdiğinde, ürünün puan fiyatı tek bir firmanın bakiyesini aşabilir. `eclub_store_siparis_olustur` RPC'si bu durumu firma bakiyelerini **yüksekten düşüğe sıralayıp birleştirerek** çözer: gereken puan, en yüksek bakiyeli firmadan başlayarak sırayla düşülür, her düşülen miktar `eclub_store_siparis_firma_puan`'a ayrı satır olarak yazılır. Böylece tek bir sipariş, birden fazla firmanın puanından beslenmiş olabilir — ama her firmanın payı ayrı ayrı, denetlenebilir biçimde kayıt altındadır. Bu, §2.5'teki kayıt-anı simetrisi ilkesinin çok-firmalı bir varyasyonudur: harcama anında hangi kaynaktan ne kadar alındığı donar.

**Sipariş yaşam döngüsü.** Geri kalan akış HBStore ile aynıdır: `eclub_store_siparis_olustur` (stok + bakiye kontrolü + adres snapshot + firma_puan dağılımı, atomik), `eclub_store_siparis_iptal` (stok iadesi + firma bazlı puan iadesi), `eclub_store_teslim_aldim`. Lib katmanı `lib/eclub/store/` altında `eclubStoreBakiye.ts`, `eclubStoreSiparis.ts`, `eclubStoreStorage.ts` (ürün görselleri), `eclubStoreTipler.ts` olarak sadeleşmiş biçimde durur.

**Sipariş görünürlüğü — UTT'nin eczaneleri + firma payı.** Her yaprakta yalnız ilgili UTT'nin aktif bağladığı eczanelerdeki kişilerin siparişleri görünür. Üst rol bu yaprakları yalnız kendi yetkili hiyerarşisi içinde toplar; istemciden gelen `utt_id` kapsam dışında ise reddedilir. Görülen siparişte de yalnız iç kullanıcının firmasından kullanılan puan raporlanır; aynı siparişin başka firmalardan gelen payı açığa çıkmaz. Bu koşullar birlikte uygulanır: oturum hiyerarşisi UTT kapsamını, eczane sahipliği kişileri, `eclub_store_siparis_firma_puan` ise görünür mali payı belirler.

---

## 5. Üçüncü Müşteri Katmanı — Eczanem (Eczanenin Kendi Müşterisi)

Eczanem, Temmuz 2026'da eklenen üçüncü müşteri katmanıdır ve ekosistemin zincirini bir halka daha uzatır: eczanenin **kendi müşterisi** (hasta/danışan), eczanesinin gönderdiği ürün videosunu izler, puan kazanır ve bu puanı **aynı eczanede, aynı üründe** TL indirimi olarak kullanır. İş kuralları ve gerekçeler iki canlı belgede yaşar: tek belgede birleştirilmiş iki kesit: işleyiş belgesi (`docs/ECZANEM.MD` §1 — "İP") ve teknik iş planı (aynı belge §2 — KONTROL bulguları, kapalı kararlar, U0–U12 durum takibi). Bu bölüm mimari özeti verir; kural ayrıntısı oraya bırakılır.

Katman beş yeni yapı taşı getirmiştir: **(a)** üçüncü kimlik düzlemi (telefon+OTP), **(b)** sistemdeki ilk puan-yaşlandırma modeli (180 gün kayan pencere + FIFO harcama), **(c)** atomik düşüm RPC'si, **(d)** üretim hattında üçüncü hedef (`eczanem`), **(e)** proxy'de altıncı bekçi. Modül bağımsızdır ve kendi kökünde yaşar: müşteri paneli `/eczanem`, eczacı tarafı `/eczanem/eczane` (E-Club oturumuyla girilir ama yol E-Club prefix'inde değildir — modül bağımsızlığı kararı), UTT dağıtım ekranı `/eczanem/utt`. İş mantığının tamamı `lib/eczanem/` tek-kaynak ailesindedir (`otp`, `oturum`, `telefon`, `davet`, `silme`, `tarife`, `gonderim`, `kazanim`, `kasa`, `dokum`); route'lar yalnızca auth + orkestrasyondur (§2.6 ilkesi). Veri modeli 11 yeni `eczanem_*` tablosudur (`eczanem_giris_otp` dahil — B-14 düzeltmesi); parasal üçlü (`eczanem_puan_kayitlari`, `eczanem_harcama_kayitlari`, `eczanem_siparisler`) + `eczanem_urun_tarifeleri` korumalı tablolardır (`lint:mimari` yazımı `lib/eczanem/` dışında engeller, §6.2).

### 5.1 Kimlik ve üyelik — telefon+OTP, davet, KVKK tam silme

**Üçüncü kimlik düzlemi.** Müşteri `eczanem_musteriler`'de yaşar (tek kişi = tek telefon, UNIQUE); eczane bağı `eczanem_uyelikler` ile çokludur (aynı kişi farklı eczanelerde üye olabilir; her bakiye kendi eczanesine kilitli). `kullanicilar` ve `eclub_kisiler`'den sonra üçüncü düzlem olarak `v_auth_kimlik`'e UNION'landı; `rolCozucu` artık `"musteri"` dönebilir (`MUSTERI_ROLU`, bilinçli olarak `TUM_ROLLER` dışında — §2.3 deseni).

**OTP mimarisi (K1 kararı).** Supabase native phone auth DEĞİL — custom OTP tablosu (`eczanem_giris_otp`) + Supabase session: SMS sağlayıcısını Supabase'e bağlamak K-E1 kararını bloklar ve ince-bağımlılık felsefesine (§2.1) aykırı olurdu. Oturum üretimi `auth.admin.generateLink(magiclink)` → SSR `verifyOtp(token_hash)` → çerez; müşteri auth kaydı sentetik e-posta ile açılır, `eczanem_musteriler.auth_user_id` bağı kendini-onarandır. SMS gönderimi provider-agnostik `lib/sms/gonderici.ts`'tedir (§2.7 deseni); sağlayıcı seçimi (K-E1) canlıya çıkışın tek gerçek blokörüdür. **Test modu (K-E8):** canlı-dışı her ortamda SMS'siz sabit kod `123456` geçerlidir; çift kilit (`lib/utils/ortam.ts` — `VERCEL_ENV`/`NODE_ENV`) sabit kodu production'da yapısal olarak devre dışı bırakır, "kaldırmayı unutma" riski yoktur.

**Davet akışı (İP-§3).** Üyelik yalnızca eczacının davetiyle başlar: eczacı ad-soyad + telefon girer, müşteriye SMS ile kod gider, müşteri `/eczanem/davet`'te KVKK onayı + kodla üye olur. Doğrulamalar server'dadır: davet telefonu o eczanenin eczacı/teknisyen telefonlarıyla çakışamaz (İP-§3.4), süresi dolan davet sorgu-anında geçersizdir, deneme sınırı vardır. Ad-soyad yalnızca davet anında girilir; **hiçbir görüntüleme katmanında gösterilmez** (eczacı ekranları dahil her yerde telefon son-4-hane).

**KVKK tam silme (K-E5).** Sistemdeki ilk gerçek fiziksel silme akışı: OTP teyitli silmede müşteri satırı, auth kaydı, üyelikler, gönderimler, davetler, izleme ve puan kayıtları **fiziksel silinir**; yalnızca parasal tarihçe (sipariş + harcama) mutabakat dayanağı olarak kalır — `musteri_id` NULL'lanır, satır "Eczane X Müşteri N" anonim etiketine döner. Mutabakat toplamları bozulmaz, kişi verisi kalmaz. ("Fiziksel DELETE yok" felsefesinin (§2.5) bilinçli istisnasıdır; yasal gereklilik tasarım ilkesinin önündedir.)

### 5.2 Üretim ve dağıtım — eczanem hedefi, tarife, iki kademeli gönderim

**Üretim hattı değişmedi, hedef genişledi.** Talep→senaryo→video→soru seti→yayın zinciri (§2.8) aynen kullanılır; `hedef_roller` dizisinin atomik değerlerinden biri `eczanem`dir ve tip tek kaynağa bağlıdır (`HedefRol`/`HedefRoller`, `lib/utils/roller.ts`). Eczanem hedefli talebi yalnızca ürün müdürü ailesi açabilir (`ECZANEM_TALEP_ACAN_ROLLER` = pm/jr_pm/kd_pm; İP-§4.1) — Karşılık tanımı PM'in ürün maliyet kararıdır. Talep üründen bağımsız olamaz (dörtlü kilidin tohumu), teknik alanı zorlanmaz.

**Yayına almada barkod + Karşılık (K-E3).** Eczanem hedefli yayında tekrar periyodu / extra puan / ileri sarma alanları gizlenir ve server'da NULL'a zorlanır (İP-§4.4 — tur modeli bu katmanda yoktur); yerine barkod + Karşılık (puan=TL) zorunludur. Saklama ürün seviyesindedir: `urunler.barkod` + `eczanem_urun_tarifeleri` append-only tarihçe (güncel tarife = max(gecerlilik_baslangic ≤ now); değer değişmediyse satır açılmaz; yeni tarife yalnız ileriye işler — "müşteri aleyhine değişmez"). Tarife yayından ÖNCE yazılır: canlı yayının daima tarifesi vardır.

**İki kademeli dağıtım, yapısal teklik (İP-§5).** Video müşteriye iki adımda ulaşır: UTT → eczane (`eczanem_eczane_gonderimleri`, UNIQUE(yayin_id, eczane_id)) ve eczacı → müşteri (`eczanem_gonderimler`, UNIQUE(yayin_id, musteri_id) — **ömür boyu teklik**, E-Club'ın tur bazlı modelinden bilinçli farklı). UTT yalnızca kendi bağladığı eczanelere (`eclub_eczane_firma.baglayan_utt_id`) ve yalnızca aktif üye eşiğini (`sistem_ayarlari.eczanem_aktif_uye_esigi`) geçen eczanelere gönderebilir; eşik server'da yeniden doğrulanır. Eczacı tekil/toplu gönderir; UNIQUE çakışmaları sessizce atlanır. Firma bayrağı `firmalar.eczanem_aktif` (beşinci modül anahtarı) UTT ekranlarını açıp kapatır.

### 5.3 Tüketim ve puan — kayıpsız model, dörtlü kilit, 180 gün + FIFO

**Kayıpsız izleme (İP-§6.1).** Müşteri paneli, E-Club oynatıcısının sade uyarlamasıdır: izle → tamamla → soruları cevapla. İç müşterinin kayıp mekanizmaları (ileri sarma, yanlış cevap) burada YOKTUR — yanlış cevap hiç kayıt üretmez, yalnız doğru cevap kazandırır. Kazanım puanları yayın başına PM ailesince belirlenir (K-E4: mevcut `video_puani` + soru puanları; sistem ayarı değil). **İzlenme metriği hiçbir katmanda üretilmez** (İP-§6.2): Eczanem izleme verisi rapor katmanına bilinçli olarak bağlanmaz — eksik değil, karardır.

**Kazanım ledger'ı — dörtlü kilit.** `lib/eczanem/kazanim.ts` tek yazım noktasıdır: her kazanım `eczanem_puan_kayitlari`'na **kişi + eczane + firma + ürün** dörtlüsü kayıt anında denormalize edilerek yazılır (§2.5 İlke 2'nin genişlemesi). Puan başka eczaneye/firmaya/ürüne yapısal olarak sızamaz (İP-§7.1). Kayıt `kalan_puan` taşır: kazanımda `puan`'a eşit doğar, harcamayla azalır.

**180 gün + FIFO — sistemdeki ilk puan yaşlandırması.** Kullanılabilir bakiye tek formüldür: Σ `kalan_puan` WHERE `created_at ≥ now() − eczanem_puan_omru_gun` (=180, `sistem_ayarlari`). Fiziksel silme ve cron yoktur — süresi geçen kazanım tarihçede durur ama formüle girmez (sorgu-anı filtresi; tur modelindeki yaklaşımın aynısı). Harcama en eski kaydı önce tüketir (FIFO, `created_at ASC`) — "kalan puanı bekletmek yaşlandırmaz" kuralı kendiliğinden sağlanır.

### 5.4 Kasa akışı — barkod→hesap→sipariş→atomik onay→fiş

Kasa zinciri `lib/eczanem/kasa.ts` + tek DB RPC'sinden oluşur (store sipariş RPC deseni, K5 emsali). Müşteri eczanede barkod okutur/seçer: barkod → ürün → üyelik → bakiye → güncel tarife → indirim hesabı (İP-§8.2: **adet indirimi çarpmaz** — kural tek fonksiyonda). Sipariş `bekliyor` durumunda doğar, puan DÜŞMEZ; sipariş anındaki tarife `tarife_snapshot` olarak saklanır (müşteri aleyhine değişmezlik).

**Atomik onay — `eczanem_siparis_onayla(p_siparis_id)`.** Eczacının onayı tek transaction'da kesinleşir: sipariş `FOR UPDATE` + durum kontrolü (çift onay yapısal imkânsız) → bakiye onay ANI esasıyla yeniden hesaplanır (K-E6: sipariş-onay arasında puan yaşlanmışsa yalnız mevcut kadar düşülür; tümü yaşlanmışsa onay verilmez, eczacı reddeder) → FIFO düşüm (`kalan_puan` azaltılır + her eşleme `eczanem_harcama_kayitlari`'na yazılır — hangi kazanımdan ne düştüğü denetlenebilir) → sipariş `onaylandi` + işlem kodu + fiş verisi döner. Onaysız fiş yoktur (İP-§8.4); "satış gerçekten oldu mu" bilinçli kapsam dışıdır (İP-§10.2) — çift taraflı onay iradeyi bağlar, stok/fatura doğrulaması firma-eczane mutabakatının işidir.

### 5.5 Görünürlük — kişi gizli, toplam görünür

Temel ilke (İP-§9.1/9.3): müşteri kimliği ve müşteri bazlı her bilgi **hiçbir iç role akmaz**; eczane × ürün seviyesindeki toplam finansal bilgi (kutu + indirim TL) ise mutabakatın dayanağıdır ve saha hiyerarşisine akar. Teknik karşılığı `lib/eczanem/dokum.ts`'tir (salt-okuma tek kaynak; veri `eczanem_siparisler` durum='onaylandi', dönem süzgeci `onay_tarihi`): **`musteri_id` hiçbir SELECT'e girmez.**

| Katman | Gördüğü | Yüzey |
|---|---|---|
| Müşteri | Kendi bakiyeleri, videoları, fişleri | `/eczanem` |
| Eczacı | Üye listesi + işlemler (yalnız son-4-hane), ürün bazında indirim dökümü | `/eczanem/eczane` |
| UTT | Eczane × ürün toplamları — **aylık mutabakatın sistem dayanağı** (İP-§10.1) | `/eczanem/utt` |
| BM / TM / yönetici | Aynı toplamların kapsam daralması: bölge / takım / firma | `/raporlar/{bm,tm,yonetici}` Eczanem bölümü |
| PM ailesi | Hiyerarşi değil **ürün ekseni**: kendi ürünleri (`urunler.takim_id`), Türkiye geneli + bölge→UTT→eczane kırılımı | `/raporlar/uretici` Eczanem bölümü |

İç rollerin dökümü tek uçtan servis edilir (`/raporlar/api/eczanem` — rol→kapsam sunucuda çözülür; `eczanem_aktif` kapalı firmada bölüm hiç görünmez) ve mevcut rapor sayfalarına paylaşılan tek bileşenle eklenir — "aynı sayfa, rol-bağımlı kapsam" ilkesinin (§2.3) Eczanem karşılığı.

---

## 6. Kesişen / Operasyonel Katman

Bu son bölüm, müşteri katmanlarının tümüne birden hizmet eden yapıları ele alır: sistemi işleten yönetim paneli, kod kalitesini koruyan denetim altyapısı, dağıtım disiplini ve raporun ortaya çıkardığı açık işlerin toplu dökümü.

### 6.1 Yönetim paneli (admin)

*Bu kesit 18.07.2026'da yeniden yazıldı: admin tam kalite taraması (22 bulgu, B-17..B-38) ve İskender'in yapısal tespiti ("HapBilgi modüler olarak genişlerken admin geride kalmıştır — gerçek anlamda ortada bir admin yoktur") üzerine panel modernize edildi. Plan M0–M5 fazları ve K-A kararlarıydı; uygulamanın commit-kanıtlı kaydı Bölüm 7'dedir.*

Admin paneli, HapBilgi'nin yönetim beynidir: bir firma seçilir; o firmanın kullanıcıları, yapısı ve modüllerinin işleyişi aynı panelden yönetilir; firma-üstü işler ayrı "global" bağlamda toplanır. Önceki mimarinin dört parçalı yüzeyi (`/admin` + Navbar'a dağılmış `eclub`/`eclub-store` panelleri + hiçbir yerden bağlantısız yetim `/admin/store`) M2 bilgi mimarisiyle tek kabukta birleştirilmiştir.

**Tek kabuk — M2 bilgi mimarisi (KAPANDI, 18.07.2026).** `app/admin/page.tsx` orkestratördür (sayfa ince, hook'lar kalın — §2.6'nın frontend karşılığı): üstte **global bölümler** barı (HBStore | E-Club Store | Sistem Ayarları + onay modallı test-verisi-sil butonu), solda `FirmaSidebar`, içerikte **iki gruplu sekme çubuğu** — Firma bağlamı (Kullanıcılar | Organizasyon | Ürün & Teknik) ‖ Modüller (T-Club | C-Club | E-Club | Eczanem). Sekme/bölüm tanımları tek kaynaktadır (`_constants.ts` — `MODUL_SEKMELERI`/`GLOBAL_BOLUMLER`; her kayıttaki `firmaAdminGorur` bayrağı, ileride eklenecek "firma admini" rolüne yetki kapatmanın tek yerden yapılabilmesi içindir, K-A1). Eski bağımsız paneller sekmelere/bölümlere gömüldü; eski URL'ler (`/admin/store`, `/admin/eclub`, `/admin/eclub-store`) `/admin`'e redirect olur ve Navbar'da admin'e giden hiçbir link kalmamıştır (canlı doğrulama İskender — girişsiz ziyaretçi `/login`'e düşer). Görsel dil login neslindendir (K-A3): tüm vurgular `_constants.ts` bordo ailesinden (`RENK_BORDO` + zemin/kenar tonları) okunur; anlamsal renkler (sipariş durum etiketleri, modül switch renkleri, amber eksik dili, kırmızı hata dili) bilinçli olarak bu dile dahil değildir.

**Kullanıcı yönetimi — M0 güvenilirlik tabanı + M3 modernizasyonu + upsert.** Panelin en temel işi üç dalgada yeniden kurulmuştur. **M0 (B-17..B-24):** toplu yükleme/silme/pasifleme artık kısmi başarısızlığı gizlemez (sonuç yalanları bitti), doğrulama kural kitabı tek kaynaktır (`lib/admin/kullaniciDogrulama.ts` — tekil, toplu ve PUT aynı fonksiyonları çağırır; bölge çözümü firma kapsamına kilitli), export sorgu hatasında kesilir, silme sırası telafilidir (arşiv → DB → Auth). **M3 (K-A6 + B-25 + B-31):** toplu yükleme insan-format dosyayı kabul eder (`turkceKatla` esnek başlık eşleme, `rolCoz` insan adı→kod çözümü, görünür satır hatası, XLSX şablon indirme; Excel'in sayı tipine çevirdiği hücreler tip-bağımsız okunur — fiziksel test bulgusu); **eksik kabul modeli** kurulmuştur: kimlik çekirdeği tam satır, takım/bölge eksik olsa da yüklenir ve "eksik bilgili" işaretlenir — tanımın tek kaynağı `kullaniciEksikMi`'dir (DB kolonu yoktur, koddan türetilir), listede amber rozet + hücre içi tamamlama seçicisi, `FirmaSidebar`'da firma kartına "⚠ N eksik bilgili" göstergesi (T-2) ve **firma aktivasyon kilidi** (eksikli kullanıcı varken `aktif=true` isim isim sebeple reddedilir) aynı kaynaktan beslenir. **Upsert aşaması (K-A7):** toplu yükleme artık ekleme değil upsert'tir — kullanıcı takibi kalıcı `kullanici_id` üzerinden, Excel eşleştirmesi e-posta + telefon anahtarlarıyla (telefon kimlik çekirdeğinde, §2.2); ikinci liste mevcut kayıtları günceller, şifre ASLA ezilmez (yalnız yeni kullanıcıda zorunlu), listede olmayana dokunulmaz, çakışma/mükerrer görünür satır hatasıdır; eksikli kullanıcı PASİF doğar ve eksiği kapanınca otomatik aktifleşir (T-7 — bilinçli pasif korunur), aktif firmaya eksikli yükleme yükle+uyarıdır (T-1). Önizleme tablosu İşlem sütunuyla (yeni/güncelle/değişiklik-yok) kaydetmeden önce ne olacağını gösterir.

**Sistem Ayarları — global bölüm.** Tekrar Gönderim Modeli'yle eklenen firma-bağımsız ayar paneli, M2 ile üst bardaki global bölümlerden biri olmuştur (önceki "firma görünümünün alternatifi panel" yerleşimi kalktı; global iş global yerde ilkesi korunur). Panel davranışı aynıdır: `sistem_ayarlari` tablosunu anahtar + açıklama + değerle listeler, PUT yalnızca mevcut anahtarı günceller (yeni anahtar migration işidir), değer doğrulaması pozitif sayı/sayı dizisidir. Jsonb-nesne değer desteği (B-28 — push olay ayarının panelden yönetimi) M5'te açık iştir.

**Firma yaşam döngüsü.** `FirmaSidebar` yaşam döngüsünün tüm aşamalarını tek yerde toplar: oluştur, aktif/pasif (aktivasyon kilidi dahil), modül aç/kapa toggle'ları (§2.2/§2.4'teki bayrakların arayüz karşılığı), silmeden önce Excel dışa aktarma (`son_export_at` damgası) ve kalıcı silme. Sıralama bilinçlidir: silme, export edilmemiş firmada engellenir.

**Eczane onayı — E-Club sekmesinde.** `eclub_eczane_master`'a elle girilen eczanelerin onaylanması (§4.1) artık ayrı panel değil, ana kabuğun E-Club sekmesidir (M2-b taşıması; hook'lar aynı: `useEclubKayitli` + `useEclubOnaylar`). Akış firma bağımsızdır; eski `/admin/eclub` URL'si redirect'tir.

**Mağaza yönetimleri — global bölümlerde paralel çift panel.** HBStore ve E-Club Store yönetimleri aynı üç sekme (Kategoriler/Ürünler/Siparişler) ve aynı hook desenini koruyarak global bölümlere gömülmüştür — §3.5/§4.5'teki ikizliğin admin yansıması. HBStore için K-A2 kararı düzeltilerek kapanmıştır: katalog firma bazında çoğaltılmaz, **global katalog + firma bazlı ürün görünürlüğü** kullanılır. Admin HBStore Ürünler tablosundaki **Firma Erişimi** ile yalnız istisnaları kapatır; ürünün global pasifliği ise tüm firmalara üstün gelir. E-Club Store'un çok-firmalı dış müşteri modeli (§4.5) bundan ayrıdır ve aynı ayar tablosunu kullanmaz.

**Güvenlik — çift katman.** Tüm admin route handler'ları route-içi tek bekçiden (`adminGirisKontrol`) geçer; proxy admin bekçisi ikinci katmandır (B-26, §2.4). Sayfa kapıları `ADMIN_ROLLER` tek kaynağına bağlıdır (B-33); eski hook'lar ağ hatasına dayanıklıdır (B-32); şifre politikası tekil+topluda aynı kural kitabındandır (B-36).

**Talep ve yayın silme (24.07.2026).** Admin, bir talebi ya da yayını **görünen ID** ile siler; tekil ve toplu silme aynı kurala bağlıdır ve işlem atomiktir (`scripts/sql/tekil_talep_sil.sql`, `app/admin/api/talep-sil`). Puanı işlenmiş yayın için ayrı kontrol vardır (`yayin_puan_var_mi.sql`). Eski `test-temizlik` sayfası ve modalı kaldırıldı; işlem admin üst barındaki onay modallı tek kapıdan yürür.

**Silmenin kuralı ve tuzakları.** Kural üç satırdır: yayını doğmamış talep silinir · puansız yayın bağlı her şeyiyle silinir · **puanlı yayın silinmez, korunur** (yerine "durdur" önerilir). Buradaki "puan" hem kazanç hem kayıptır — herhangi bir defterde o yayına kayıt varsa yayın puanlıdır. Kontrol dört kanala yayılmış **14 puan defterini** tarar (T-Club 4, C-Club 4, E-Club 5, Eczanem 1) ve ilk kayıtta kısa devre yapar. Silme sırası çocuktan ebeveyne sabittir: yayın-bağlı defterler ve etkileşim kayıtları → challenge/öneri/izleme/tur kayıtları → `yayin_yonetimi` → üretim zinciri (soru seti → video → senaryo → talep). Üç tuzak kalıcı olarak not edilmelidir: **(1)** Eczanem puan kaydı yayına doğrudan bağlı değildir (ürün-firma-eczane bazlı sadakat parası olduğu için, §5.3) — kontrol `izleme_id` üzerinden JOIN ister. **(2)** Üç tabloda (`ileri_sarma_kayitlari`, `eclub_dogru_cevap_kayitlari`, `eclub_utt_puanlari`) `yayin_id` kolonu vardır ama FK yoktur; cascade bunları yakalamaz, silme bunları elle ele almak zorundadır. **(3)** `video_puanlari` ve `soru_seti_puanlari` puan defteri değildir — üretim artefaktının kalite oylamasıdır; puanlılık kontrolüne girmez, ama tekil silmede üretim zincirinin çocuğu olarak silinir. `bildirimler` ve `eclub_bildirimler` polymorphic olduğundan (`kayit_turu` + `kayit_id`) hedefli temizlenir.

**Modül sekmelerinin bugünkü sınırı.** Panelin kapanmamış tek yapısal eksiği burada durur: admin dört modülü **açıp kapatabilir, içeriğini göremez.** T-Club, C-Club ve Eczanem sekmeleri yalnız `ModulDurumKarti`'nı çizer — modülün o firmada açık/kapalı olduğunu ve aç-kapa düğmesini. E-Club tek istisnadır; onun eczane onay paneli M2'de taşındığı için sekme dolu gelir. Bunun API karşılığı da nettir: admin'in 25 rotasının hiçbiri bu üç modülün işleyen verisine (yayınlar, challenge'lar, üyeler, gönderimler, siparişler, tarifeler) bakmaz. Firma bayrağı kapalıysa sekme listeden düşer. Bu boşluğun kapatılması M4'tür (§6.4).

**Durum.** M0/M1/M2 kapandı; M3 + upsert + T-serisinin kod tarafı bitti — kapanış İskender'in fiziksel toplu yükleme testine (11 kişilik gerçek dosyayla tam akış) ve T-3 görsel onayına bağlıdır (§6.4 Doğrulama). M4 ve M5 plandadır (§6.4).

### 6.2 Kalite & denetim altyapısı

HapBilgi, mimari ilkelerin (§2.5, §2.6) zamanla erozyona uğramaması için iki bağımsız otomatik denetim katmanı işletir. Biri kod ile veritabanı arasındaki **doğruluğu**, diğeri kod içindeki **mimari disiplini** kontrol eder. İkisi de `package.json` script'leri olarak çalışır (§2.1) ve CI/deploy öncesi kontrol noktalarıdır.

**Kod↔DB denetimi (`npm run denetim`).** Bu katman, koddaki veritabanı erişiminin gerçek şemayla tutarlı olduğunu doğrular. Üç adımlı bir zincirdir:

1. `sema-cek.js` — canlı DB'ye bağlanır (`pg`), tüm tablo/view/kolon/RPC/FK bilgisini çeker, `sema.json`'a yazar (bu rapor boyunca kullanılan kaynak).
2. `kod-tara.js` — kod tabanını `ts-morph` ile AST seviyesinde tarar, her `.from()`, `.select()`, `.rpc()` çağrısını `kullanim.json`'a çıkarır.
3. `denetle.js` — ikisini karşılaştırır, dört tür uyuşmazlığı raporlar: var olmayan tablo/view (`.from`), var olmayan RPC (`.rpc`), var olmayan kolon (`.select` — üst seviye + nested embed), FK'si olmayan nested embed.

Denetleyicinin dikkat çeken tasarım kararı **muhafazakârlıktır**: `.from` ve `.select` ayrı çağrılar olduğu için AST bir `.select`'in hangi tabloya ait olduğunu her zaman kesin eşleyemez. Sahibi belirsiz kolonlar, yalnızca *hiçbir* tabloda bulunmuyorsa hataya düşer — böylece yanlış-pozitif (aslında doğru olan bir kolonu hatalı göstermek) riski, bazı gerçek hataları kaçırma pahasına bilinçli olarak azaltılır.

**Mimari kural denetimi (`npm run lint:mimari`).** Bu katman şema doğruluğuna değil, projenin kendi tasarım ilkelerine kod düzeyinde uyulup uyulmadığına bakar. `tools/eslint-rules/index.mjs` içinde tek bir ESLint eklentisi (`hapbilgi-mimari`) altında yedi kural tanımlıdır:

| Kural | Kontrol ettiği |
|---|---|
| `olu-rpc` | Kodun çağırdığı bir RPC'nin DB'de artık var olmaması — canlı şemayı (`sema.json`) okuyarak kontrol eder (denetim katmanıyla aynı kaynağı paylaşır). |
| `firma-kolonlari` | `FIRMA_KOLON_ESIK` (5) üzerinde kolon değişikliğinin `lib/firma/kolonlar.ts` tek-kaynağından geçip geçmediği — bu eşiğin altında kalan değişiklikler kural dışıdır. |
| `kayit-tek-kaynak` | Belirli **korumalı tablolara** (`KORUMALI_TABLOLAR` — puan/kayıt tabloları, `yayin_tekrar_kayitlari` ve iki push tablosu `push_abonelikleri`/`push_gonderim_kayitlari`) doğrudan yazılmaması — dört yazma işleminin tamamı denetlenir (`.insert` / `.update` / `.delete` / `.upsert`, B-07 kapsam genişletmesi 29.07.2026); yazım yalnızca tek-kaynak fonksiyonlar üzerinden geçmeli (muafiyet: `/lib/puan/` + `/lib/tur/` + `/lib/eczanem/` + `/lib/push/` — her biri kendi tablolarının meşru tek yazım noktasıdır; B-07 ifade düzeltmesi). |
| `dogru-client` | Doğru Supabase client'ın (anon vs service_role, §2.4) doğru bağlamda kullanılması. |
| `talep-kunye-tek-kaynak` | Talep künyesinin (ürün/teknik adı) elle sorgulanmaması (`urunler(urun_adi)`/`teknikler(teknik_adi)` join'i) — tek kaynak `lib/utils/talepZinciri.ts` `TALEP_ALANLARI` + `/talepler/api/kunye` (25.07.2026). |
| `toast-tek-kaynak` | Üretim hattı toast metninin (`basari(...)`) sayfaya gömülmemesi — tek kaynak `lib/uretim/toastMesaj.ts` `uretimToast` (26.07.2026). |
| `rol-tek-kaynak` | "Kim görebilir" rol kararının elle yazılmaması — tek kaynak `lib/utils/roller.ts` adlandırılmış grupları; içinde ≥2 hard-code rol string'i olan diziyi reddeder (tekil karşılaştırma / `hedef_roller` / tip-union kapsam dışı). B-09 temizliğiyle ratchet baseline'ı 50→0'a indi; kural tam sıkıdır (30.07.2026). |

Bu kuralların ortak paydası, §2.5'teki "tek kaynak" ilkesini derleme zamanında zorunlu kılmalarıdır — bir geliştirici (ya da gelecekte bir LLM) korumalı bir tabloya doğrudan yazmaya kalkarsa, ya da kolon listesini tek-kaynak dosyasından geçirmeden değiştirirse, `lint:mimari` bunu daha kod incelemesine gelmeden yakalar.

**İki katmanın tamamlayıcılığı.** Kod↔DB denetimi "kod, DB'nin bugünkü haliyle uyumlu mu?" sorusuna cevap verir; mimari kural denetimi "kod, projenin kendi ilkelerine sadık mı?" sorusuna cevap verir. Biri dış tutarlılığı, diğeri iç disiplini korur. §2.4'te temizlenen ölü proxy bloğunun hiçbiri tarafından yakalanamamış olması (çünkü ne bir şema hatasıydı ne de mevcut dört kuralın kapsamındaydı), bu iki katmanın sınırlarını da ortaya koyar — kapsamları geniş ama sınırsız değildir. Tekrar Gönderim Modeli'nin kapanışında iki katman da temiz geçmiştir: `denetim` scripti tamamen otomatiktir (elle liste yoktur — `sema-cek` DB'den çeker, `kod-tara` kodu tarar, `denetle` karşılaştırır). Push uygulaması ve admin modernizasyonu boyunca da her commit aynı üçlü doğrulamadan (tsc + denetim + lint:mimari) geçmiştir; son koşum (18.07.2026) 699 `.from` / 576 `.select` / 76 `.rpc` üzerinde hiçbir uyuşmazlık raporlamamış, `lint:mimari` ihlal bulmamıştır. Denetim ailesinin ürettiği ikinci büyük çıktı, admin panelinin **tam kalite taramasıdır** (18.07.2026): admin tam taramasının 22 bulgusu (B-17..B-38), admin modernizasyon planının tetikleyicisi ve M0/M1/M5 iş listesinin kaynağı olmuştur (§6.1).

### 6.3 Dağıtım & ortam

**Vercel — varsayılan yapılandırma.** Proje, özel bir `vercel.json` taşımaz; `.vercel/project.json` yalnızca Vercel CLI'nin projeyi bağladığı kaydı tutar. Bu, Next.js App Router'ın Vercel'in varsayılan build/deploy algılamasıyla ek yapılandırma gerektirmeden çalıştığı anlamına gelir — route'lar, ortam değişkenleri ve build adımı platformun standart davranışına bırakılmıştır.

**Ortam değişkenleri.** Sistemin dış bağımlılıkları (Supabase, Bunny.net, Web Push) env üzerinden yönetilir; yerelde `dotenvx` (`.env.local`, `devDependencies`'te görülen `dotenv`, §2.1) ile enjekte edilir. Production'da bu değerlerin Vercel proje ayarlarında tanımlı olması gerekir; anahtar değişken grupları şunlardır: Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`), Bunny.net (`BUNNY_LIBRARY_ID`, `BUNNY_API_KEY`, `NEXT_PUBLIC_BUNNY_PULL_ZONE`) ve Web Push VAPID (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_SUBJECT` her ortamda; `VAPID_PRIVATE_KEY` YALNIZ production — K-P7 çift kilidi, push iş planı).

**Commit disiplini.** Proje geçmişi, tutarlı ve tek-amaçlı commit mesajları izler (`refactor:`, `feat:`, `fix:` önekleriyle, Türkçe açıklama) — örneğin `refactor: FIRMA_KOLONLARI lib/firma/kolonlar.ts'e tasindi (tek-kaynak)` ya da `fix: CC ileri_sarma_acik/extra_puan v_yayin_detay yerine yayin_yonetimi`. Bu commit'ler, raporun kendisinde de tekrar tekrar görülen "tek kaynak" ve "doğru veri kaynağından okuma" ilkelerinin geçmişte de aktif olarak düzeltildiğinin izidir.

**Push disiplini — deploy-öncesi mecburi işler bitmeden push yok.** Kritik bir çalışma kuralı, kod değişikliklerinin mecburi deploy-öncesi işler (§6.4) tamamlanmadan push edilmemesidir. Tekrar Gönderim Modeli'nin tüm kod işleri bu disiplin içinde tamamlanmış ve mantıksal gruplar hâlinde dokuz commit olarak alınmıştır (`proxy.ts` temizliği dahil); ardından Ekstra İzlediklerim işi üç commit daha eklemiştir (ana sayfa veri katmanının bölünmesi, tam tekrar sayımının tek kaynağa çıkarılması, bölümün kendisi). Hepsi `tsc` + `lint:mimari` + `denetim` doğrulamasından geçmiştir. Ardından Eczanem geliştirmesi (U0–U9, 12.07.2026) aynı disiplin içinde bir commit serisi daha eklemiştir. Local'de push bekleyen tüm commit'ler, fiziksel insan testleri (§6.4 Doğrulama bloğu) tamamlanana kadar bekletilir; Vercel push/deploy, mecburi işler listesi kapandığında tek bir hazır durum olarak yapılır. Bu bilinçli bir tercihtir — deploy bir dizi ayrık değişiklik değil, doğrulanmış tek bütündür.

### 6.4 Açık işler, teknik borç, deploy-öncesi mecburi işler

Bu rapor hazırlanırken sistemin farklı katmanlarında karşılaşılan, bilinçli olarak ertelenmiş ya da henüz tamamlanmamış işler burada tek yerde toplanır. Amaç, bunların dağınık notlar olarak kaybolmaması; deploy öncesi tek bir kontrol listesi oluşturmasıdır.

**Güvenlik — deploy öncesi mecburi.**
- **RLS eksikliği** (§2.4): Tabloların büyük çoğunluğunda Row Level Security kapalı; şu an tek savunma katmanı API/proxy seviyesindeki manuel rol kontrolüdür (service_role RLS'i bypass eder). Yaklaşık 30 tabloya (`yayin_tekrar_kayitlari` dahil) **+ 11 yeni `eczanem_*` tablosuna + 2 push tablosuna (`push_abonelikleri`, `push_gonderim_kayitlari` — K-E7 deseniyle RLS'siz doğdu)** RLS eklenmesi ve hangi işlemlerin service_role, hangilerinin anon+RLS ile yapılacağının netleştirilmesi gerekiyor. (Eczanem K-E7 kararı fiilen bu genel işe katlandı: tablolar RLS'siz doğdu, service_role'e açık GRANT'li, anon/authenticated'a bilinçli kapalı.) Girdi envanteri hazır: kalite raporu B-10 — anon'a SELECT açık 19 tablo (soru setleri cevaplarıyla dahil) + RLS açılınca kırılacak 16 istemci okuma noktası; B-16'daki toplu `REVOKE TRUNCATE/REFERENCES/TRIGGER FROM anon, authenticated` da bu işle birlikte ele alınır.
- **Test endpoint'lerinin kaldırılması** (§2.4, §6.1): `admin/api/test-verileri-sil` ve `app/admin/test-temizlik/` test araçlarıdır; 12.07.2026'da girişsiz olmaktan çıkarılıp proxy admin bekçisinin arkasına alındı (canlıda girişsiz silme ucu bırakılamazdı) ve admin üst barına onay modallı "Test Verilerini Sil" butonu eklendi. Deploy öncesi araç bütünüyle (buton + modal + sayfa + endpoint) yine de kaldırılmalı.
- **`@test.com` verilerinin temizliği**: Geliştirme sürecinde oluşturulan test kullanıcı/verilerinin production'a taşınmadan temizlenmesi gerekiyor. Kalite taraması somutladı (B-15): `auth.users`'ta hiçbir kimlik düzlemine bağlı olmayan 3 sahipsiz kullanıcı (`utt/pm/bm@test.com`); silme SQL'i kalite raporu §4'te, İskender koşar (`denetim:tutarlilik` td10 yeşile döner).

**Kalite taraması NOT'ları (12.07.2026).**
- **Platform geneli lint temizliği — E‑Club sonrasında:** 14.08.2026 tarihli tam `npm run lint` taraması, E‑Club dışındaki mevcut kodda 331 hata ve 113 uyarı gösterdi. Başlıca borçlar belirsiz `any` tipleri, React hook/saflık ihlalleri ve kullanılmayan değişkenlerdir. Production build'i engellemeyen bu borç, E‑Club tamamlandıktan sonra modül modül ele alınacaktır.
- **Hard-coded rol dizileri (B-09)**: `roller.ts` dışında 125 rol karşılaştırması (~60 dosya); T-K3/T-K6 ile birlikte lint kuralı adayı.
- **Ölü env anahtarları (B-11)**: `ADMIN_SECRET`, `BUNNY_LIBRARY_ID`, `BUNNY_API_KEY` `.env.local`'da tanımlı, kodda referanssız — ya kullanılacak ya düşülecek.
- **Zaman-sınır fonksiyonları yerel saatte (B-12 ek tespiti)**: `haftaBaslangici/ayBaslangici/yilBaslangici/isGunuEkle` sunucu yerel saatiyle çalışır; UTC'de gün/ay sınırları 3 saat kayar (yalnız 00:00–03:00 TR kayıtlarını etkiler). Puan penceresi (asıl kural) B-12 ile sabitlendi.
- **"Şifremi unuttum" işlevlendirme**: ölü link kaldırıldı (B-06); gerçek şifre sıfırlama akışı ayrı iş.

**Eczanem — canlıya çıkış ön koşulları (Bölüm 5).**
- **K-E1 — SMS sağlayıcısı (tek gerçek blokör)**: Sağlayıcı KARARI KAPALI — **Turkcell** (10.07.2026, İskender; ifade eşitleme B-13, 12.07.2026). Açık kalan sözleşme/entegrasyondur; entegrasyon noktası hazırdır (`lib/sms/gonderici.ts` provider-agnostik, canlı-dışı ortamlar K-E8 test moduyla sağlayıcısız çalışır). Entegrasyon tamamlanmadan Eczanem canlıya çıkamaz.
- **K-E2 — davet temizliği**: 24 saati dolan davet verisinin kalıcı tutulmaması (KVKK) için temizlik mekanizması kararı; sorgu-anı geçersiz sayma kurulu, kalıcı silme stratejisi açık.
- **KVKK aydınlatma metni**: `app/eczanem/davet/page.tsx` içindeki `KVKK_METNI` placeholder'dır; gerçek metin İskender'den gelince değişecek.

**E-Club — kimlik ve bildirim.**
- **OTP girişi** (§4.3): Şu anki geçici giriş modeli (UTT'nin belirlediği e-posta+şifre) yerine OTP akışı kurulmalı. Altyapı artık hazır: Eczanem'in OTP + oturum mekanizması (Bölüm 5.1) paylaşılabilir kurulmuştur; E-Club'ın buna bağlanması ayrı bir iştir.
- **Bildirim gösterimi** (§4.3): `eclub_bildirimler` tablosuna yazım çalışıyor ama kişi tarafında gösterilmiyor; okundu işaretleme mekanizması ve harici kanal (WhatsApp/SMS) bildirimi eksik.
- **Liste yönetimi cascade görünümü** (§4.1): BM/TM'in altındaki UTT'lerin eczane/kişi listelerini görebildiği bir cascade henüz kurulmadı (E-Club Ligi'ndeki cascade'den ayrı bir iştir).

**Ölçek.**
- ~~**HB Ligi ölçeklenmesi**~~ **ÇÖZÜLDÜ (E9, 31.07.2026):** canlı-SUM yerine kişi × gün özet tablosu (`hb_ligi_ozet_v2`) + `AFTER INSERT` trigger + okuma anında `row_number`; canlı-SUM ile birebir doğrulandı. Aynı desen CC Ligi'ne de uygulandı (`cc_ligi_ozet`). Detay §2.5.

**Ertelenen işler (bilinçli).**
- **`tekrar_id` FK kolonu** (§2.5): Tüm tekillik sorguları tarih karşılaştırmasıyla çözüldüğünden ertelendi; raporlama JOIN ihtiyacı doğarsa kolon eklenip geçmiş tarihten geriye doldurulur.
- **E-Club kişi tarafı sayacı ve UTT "gönderime hazır" durumları (v2)** (§3.1): Sayaç UTT gönderim ekranına aittir; o ekran Eczanem geliştirmesiyle şekillenecek.
- **Ekstra İzlediklerim'in CC/BM karşılığı**: BM'in "İzlenecek Videolar" düzleminde aynı bölümün eşik-2 karşılığı; ihtiyaç doğarsa aynı desen (tekrarSayim'in CC eşdeğeriyle) birebir uygulanır.

**Doğrulama.**
- **U10 — Tekrar Gönderim uçtan uca fiziksel test (push öncesi şart)**: 12 senaryoluk liste üretim ortamında koşulur — yayına alma/tur-1, ilk izleme, yeni extra kuralı (UTT ve CC), tur dönüşü, sayaç rozetleri, BM/CC akışı, öneri (BM→UTT; TM salt-okuma takip), E-Club (yeni öneri + ayar değişiminin davranışa etkisi), durdur/başlat tur bağımsızlığı, challenge etkilenmezliği, Sistem Ayarları paneli, puansız zaman penceresi. Rol değişikliğinin yeniden giriş gerektirmeden anında etki ettiği (rolCozucu, §2.4) de bu kapsamda doğrulanır. Local'de bekleyen commit'ler bu test tamamlanmadan push edilmez (§6.3).
- **U7 — Ekstra İzlediklerim fiziksel testi (push öncesi şart)**: 9 senaryo — liste/sıralama doğruluğu, tur dönüşünde "bu turda" sayacının sıfırlanması (ömür boyu süzgeci değişmeden), "extra'ya X kaldı" ile bitir kararının birebirliği (X=1 iken bir tam tekrar → extra düşer, satır "bu ay kazanıldı"ya döner), ay dönümünde hak yenilenmesi, ileri sarmalı / puansız-pencere izlemelerinin sayaca girmemesi, refactor sonrası bitir davranışının birebirliği, durdurulan yayının bölümden düşmesi, boş durum teşviki, beğeni/favori senkronu. U10 oturumuyla birleşik koşulabilir.
- **Eczanem U10/U11 — faz sonu ara testler + uçtan uca fiziksel test (push öncesi şart, İskender)**: Eczanem'in U5–U9 adımları duman testi yapılmadan kapandı (mutlu yol canlı fixture — onaylı sipariş, tam dağıtım zinciri, çoklu rol oturumu — gerektiriyordu); doğrulama bilinçli olarak bu insan-yürütümlü testlere bırakıldı. Kapsam (teknik iş planı U11): davet→OTP→üyelik, eşik, gönderim teklikleri, izleme→kazanım, dörtlü kilit sızmazlığı, FIFO/180 gün senaryosu, sipariş→onay→fiş→mükerrer onay reddi, KVKK silme sonrası toplamların korunumu, görünürlük sınırları (kişi verisi sızmıyor, İP-§9), İP-§11 risk tablosunun satır satır sağlaması.
- **Admin toplu yükleme fiziksel testi (İskender — M0+M3+upsert birlikte)**: 11 kişilik gerçek insan-format dosyayla, takım/bölge tanımlı firmada tam akış — önizleme → kaydet → eksik tamamlama → upsert ile ikinci liste → otomatik aktifleşme → firma kilidi/aktivasyon. Önizleme aşaması 18.07'de fiziksel testte doğrulandı; kaydet/tamamlama/kilit akışları canlıda hiç koşulmadı. T-2 rozet tazelenmesi aynı oturumda görülür; T-3 bordo dilinin görsel onayı (K-A3/K-A4) da bu kapsamdadır.
- **Final test**: Deploy öncesi uçtan uca doğrulama — üç müşteri katmanının kritik akışlarının (üretim→tüketim→puan→lig→store zinciri; iç müşteri, E-Club ve Eczanem için) manuel/otomatik testi.
- **Vercel push/deploy**: Yukarıdaki doğrulama bloğu + güvenlik bloğu (RLS, test endpoint'leri, test verisi temizliği) + Eczanem canlı ön koşulları (K-E1 başta) kapanmadan `origin`'e push yapılmaz (§6.3). Push, biriken commit serisinin tek hazır durum olarak yayınlanmasıdır; Eczanem için ayrıca üretim ortamı env'inde SMS sağlayıcı anahtarlarının tanımlanması gerekir.

---

## 7. HapBilgi Geliştirme Adımları (Modül ve Tarih)

Bölüm 1–6 sistemin **bugününü** anlatır; bu bölüm o bugüne **nasıl gelindiğini** kaydeder. Her girdi üç şeyi taşır: yapılan iş, tarihi ve kısa teknik bilgi. Sıralama kronolojiktir.

**Kaynak ve doluluk farkı.** Kayıt iki dönemden oluşur ve ikisi aynı doluluğa sahip değildir. **20.03–09.07.2026** arası belge tutulmadan geçmiştir; o dönemin girdileri yalnız commit kayıtlarından yazılmıştır — ne yapıldığı ve ne zaman yapıldığı kesindir, kararların gerekçesi kayıtlı değildir ve buraya sonradan üretilmemiştir. **10.07.2026 sonrası** için iş planı ve test tutanağı belgeleri mevcuttur; o girdiler gerekçe ve commit numaralarıyla birlikte yazılmıştır. Kaynak belge adı verilen girdilerde tam ayrıntı o belgededir.

**Neyin buraya girmediği.** Açık işler, teknik borç ve deploy-öncesi mecburi işler bu bölümde değil §6.4'tedir. Burada yalnız kapanmış işler durur.

---

### Kuruluş — ilk yapı (20.03–29.04.2026)

*Kaynak: commit kayıtları.* Proje Next.js iskeletiyle açıldı (`8bd9d4c`), ilk bütün yapı 23.04'te geldi (`d888365`). Bu dönemin kalıcı bir kararı erişim kontrolünün konumudur: middleware dosyası önce `proxy.ts`, sonra `middleware.ts`, sonra tekrar `proxy.ts` olarak adlandırıldı ve Node.js runtime'a sabitlendi (25.04, dört commit) — bugünkü tek merkezli bekçi zincirinin (§2.4) yerleşim kararı burada verildi. 27.04'te raporlar navbar'ı ve admin ürün/teknik yönetimi eklendi; aynı gün beğeni/favori raporları ve BM eğitim sistemiyle birlikte **Challenge Club** ilk hâlini aldı. 28–29.04 responsive protokolüne ayrıldı: tüm sayfalar, Navbar, ana sayfa bileşenleri ve login Tailwind responsive'e çevrildi.

### Genel Sistem'e geçiş ve eğitim türü ayrımı (01.05.2026)

*Kaynak: commit kayıtları.* Üç iş aynı gün yapıldı. **v21** kategorileri, `PM_ROLLERI` sabitini, hazır soru seti kavramını ve dinamik soru sayısını getirdi. **v22 — Genel Sistem'e geçiş** yapısal olanıydı: `bm_*` önekli ayrık yapı kaldırıldı, yerine `hedef_roller` dizisi geldi ve yayına almada hedef kitle seçimi devreye alındı — bugünkü "tek motor, hedefe göre dallanma" mimarisinin (§2.8) temeli budur. Aynı gün **Genel Eğitim / Ürün Eğitimi ayrımı** için `egitim_turu` kolonu eklendi, talep formuna seçim kartları ve listeye görünüm ayrımı kondu.

### Rol sisteminin merkezîleştirilmesi (06.05.2026)

*Kaynak: commit kayıtları.* Dosyalara dağılmış yerel rol listeleri kaldırıldı; `lib/utils/roller.ts` merkezî yapı olarak kuruldu ve `YONETICI_ROLLER` oradan import edilmeye başlandı. §2.3'teki "bir rolün nereye erişebileceği adlandırılmış sabit listelerde tanımlanır" ilkesinin başlangıcıdır.

### Talepler sayfasının parçalanması (09.06.2026)

*Kaynak: commit kayıtları.* 711 satırlık tek dosyalık talep sayfası bileşenlere ayrıldı: `VideoYukleme`, `SoruSetiAyarlari`, `KategoriSecici`, `HazirSoruSetiBlogu`, `TalepTuruTablari`, `UrunTeknikSecici`, `TalepListesi`, `EkDosyaYukleme`, `_types`. Tüm state ve kurallar `useTalepFormu` hook'una toplandı, `page.tsx` yalnız orkestrasyon yapan ince kabuğa indirildi. §2.6'daki katman ayrımının frontend'deki ilk uygulamasıdır. Aynı gün `GET /takimlar/api` ucu açıldı.

### Yetki, lig periyodu ve firma bazlı modül anahtarları (27–29.06.2026)

*Kaynak: commit kayıtları.* Üretim hattı detay sayfalarına rol kontrolü eklendi (`fix(yetki)`). **HB Ligi**'ne periyot seçici ve çeyrek bazlı RPC ailesi geldi, raporlara "kalan sipariş puanı" eklendi, `aktifDonem` ortak yardımcısı çıkarıldı (§3.4). **Firma bazlı modül aç/kapa** deseni bu dönemde kuruldu: önce HBStore (firma guard'ı 5 API + 5 sayfa, Navbar gizleme, admin mağaza anahtarı), sonra Challenge Club (proxy bekçisi, admin toggle, Navbar pill gizleme); ardından HBStore guard'ları 10 dosyadan sökülüp proxy'ye taşındı ve iki ölü dosya silindi — §2.4'teki "modül erişim kuralı tek yerde" mimarisi böyle oluştu. **Firma yaşam döngüsü** (aktif/pasif, export koşullu silme, Excel dışa aktarma) aynı dönemde eklendi. **Kalıcı sınır:** export koşulu silmenin tek kapısı değildir — talebi olan firma hiçbir koşulda silinemez (`talepler.firma_id` FK'sı). Bu bir eksik değil, korumadır: üretim geçmişi olan firma veriden düşürülemez.

### E-Club Ligi (03.07.2026)

*Kaynak: commit kayıtları.* Dış müşteri tarafının koçluk sıralaması kuruldu: cascade lig görünümü, izlenen öneri başına UTT'ye +10 GönderiPuanı, UTT'nin kendi dış müşteri takımına ad verebilmesi, ürün sütunu, Excel dışa aktarma ve periyot seçimi. Aynı commit kişi taşıma müdahalesini de içerir. Bugünkü hâli §4.4'tedir.

### E-Club Store (05.07.2026)

*Kaynak: commit kayıtları.* Dış müşterinin ödül tarafı eklendi: kişi vitrini, sipariş, adres yönetimi, rapor ve admin yönetimi. Çok-firmalı bakiyenin sipariş anında birleştirilerek harcanması ve firma payının ayrı kayda geçmesi bu modülün özgün yanıdır (§4.5). Aynı gün `lib/puan/puanTuru` → `strateji` olarak yeniden adlandırıldı ve izleme/puan yardımcıları (`randomSoruSec`, `zamanKontrol`) ayrıldı.

### Denetim altyapısı ve mimari bekçiler (06.07.2026)

*Kaynak: commit kayıtları.* Kalite altyapısının iki katmanı aynı gün doğdu (§6.2). **Kod↔DB denetimi:** `sema-cek` + `kod-tara` + `denetle` zinciri kuruldu — kodun çağırdığı tablo/kolon/RPC'nin canlı şemayla tutarlılığı otomatik doğrulanır. **Mimari kural denetimi:** ESLint eklentisi dört kuralla yazıldı (`olu-rpc`, `firma-kolonlari`, `kayit-tek-kaynak`, `dogru-client`) ve `lint:mimari` script'i eklendi. Aynı gün `FIRMA_KOLONLARI` tek kaynağa taşındı (`lib/firma/kolonlar.ts`) ve üç "yanlış kaynaktan okuma" hatası düzeltildi: E-Club eczane bağının eski model embed yerine gerçek şemadan (`kisi_eczane`/`master`/`firma`) okunması, CC'nin `ileri_sarma_acik`/`extra_puan` değerlerini view yerine `yayin_yonetimi` tablosundan alması, UTT raporunun video puanını doğru FK üzerinden (`video_durumu`) çözmesi.

---

### Tekrar Gönderim Modeli ve Ekstra İzlediklerim (10.07.2026)

*Kaynak: §6.4 kapananlar.* Sistemin puan kararları o güne dek örtük bir varsayıma dayanıyordu: bir kişi bir yayını bir kez puanlı izler. Tekrar gönderim bu varsayımı değiştirdi — kişi × yayın artık **tur** bazında tekildir. Tur çapası `yayin_tekrar_kayitlari` tablosudur; tur açılışı otomatik ve sorgu anındadır (`gecerliTur()`), takvim hizalıdır ve ayrı bir zamanlayıcı gerektirmez (§2.5). UTT extra kuralı kayan-hafta modelinden ay-bazlı tek hak modeline çevrildi (ilk izleme hariç 3. tam tekrarda tek extra); CC tarafında hiç sınır olmadığı ortaya çıktı ve aynı desene oturtuldu (eşik 2). Aynı gün `anaSayfaVeri.ts` (542 satır) rol başına dosyalara bölündü, tam tekrar sayımı tek kaynağa çıkarıldı (`tekrarSayim.ts`) ve **Ekstra İzlediklerim** bölümü UTT ana sayfasına eklendi. `proxy.ts`'teki ölü senaryo API bloğu ve 65 dosyadaki `user_metadata.rol` okuması da bu turda temizlendi (`rolCozucu` → `v_auth_kimlik`).

### Eczanem — üçüncü müşteri katmanı (10–12.07.2026)

*Kaynak: `ECZANEM.MD`.* Zincir bir halka uzatıldı: eczanenin kendi müşterisi. Katman beş yeni yapı taşı getirdi — üçüncü kimlik düzlemi (telefon+OTP), sistemdeki ilk puan yaşlandırması (180 gün kayan pencere + FIFO), atomik kasa düşüm RPC'si, üretim hattında üçüncü hedef (`eczanem`) ve proxy'de altıncı bekçi. Adımlar U0–U9 olarak koşuldu (`939330c` … `c597744`). Kalıcı kararlar: OTP için Supabase native phone auth değil custom tablo + Supabase session (K1 — SMS sağlayıcısını Supabase'e bağlamak sağlayıcı kararını bloklardı); puan **kişi + eczane + firma + ürün** dörtlüsüne kilitli (İP-§7.1); KVKK tam silme sistemin ilk gerçek fiziksel silme akışıdır ve "fiziksel DELETE yok" felsefesinin bilinçli istisnasıdır. Yan kazanım: `rolCozucu`'nun service_role ile boş view okuduğu canlı hata U2'de yakalandı ve `v_auth_kimlik_admin` ile kapatıldı — 66 dosyadaki rol kontrolünü etkiliyordu, fark edilmemişti çünkü fiziksel testler bekliyordu (`9322f36`).

### Teknik kalite kontrol taraması (12.07.2026)

*Kaynak: commit kayıtları.* Taramanın gerekçesi somuttu: üçlü doğrulama (`tsc` + `denetim` + `lint:mimari`) "kod düzgün mü"ye bakıyordu, ama yakalanan gerçek hataların hiçbiri o sınıftan değildi — UTT ana sayfasında hedef rol süzgecinin hiç olmaması, `rolCozucu`'nun boş view okuması, Eczanem tablolarının GRANT'sız doğması. Üçü de "yanlış kod" değil eksik tasarımın koda yansımasıydı ve üçlüden temiz geçmişti. Bunun üzerine üç eksenli tarama tanımlandı — kod desenleri (T-K), belge-kod uyumu (T-B), DB veri tutarlılığı (T-D) — ve **Q0 kuralı** kondu: tarama sırasında hiçbir dosya değiştirilmez, çıktı yalnız bulgu raporudur. 16 bulgudan KRİTİK+ORTA sekizi birer commit'le kapandı (`b01e97f` … `7ebe096`): kd_utt'nin boş izleme listesi, izleme uçlarına pozitif hedef süzgeci, talep formu-API hedef eşitlemesi, login temizliği, `user_metadata.rol` dallanmalarının kaldırılması, puan yazım hatalarının dürüst bildirimi, puan penceresinin `Europe/Istanbul`'a sabitlenmesi (Vercel UTC'de pencere üç saat kayıyordu). Kalıcı çıktı `denetim:tutarlilik` script ailesidir: 12 salt-okuma SQL + READ ONLY koşucu, üçlü doğrulamanın yanına dördüncü katman.

### Yayın yönetimi iyileştirmeleri (13.07.2026)

*Kaynak: §6.4 kapananlar.* **Tarih bazlı yayınlama** eklendi: yayına almada opsiyonel gün seçilirse yayın `planlandi` durumunda doğar, aktivasyon tek kaynaktan (`yayin_planlananlari_aktive()` DB fonksiyonu + pg_cron) koşar — tur-1 ve bildirimler yayına almada değil aktivasyon anında doğar (§2.8). Yayın Yönetimi pill'ine rozet eklendi; sayı bilinçli olarak bildirim değil **canlı bekleyen sayımıdır** (kuyruk ortaktır, okunma durumundan bağımsız gerçeği göstermesi gerekir). Bekleyen kartındaki ayarlar dar dikey sütundan tam genişlik yatay banda taşındı. Aynı gün giriş sayfası yeniden tasarlandı (iki panel, dört modül tanıtımı, şifre göster/gizle) ve `test-verileri-sil` ucu proxy muafiyetinden çıkarılıp admin bekçisinin arkasına alındı.

### Web Push bildirim katmanı (16–18.07.2026)

*Kaynak: commit kayıtları.* Mevcut in-app bildirim + badge katmanının üstüne, uygulama kapalıyken ve kullanıcı giriş yapmamışken bile teslim edilen bir push katmanı kuruldu. P0–P7 sekiz adımda koşuldu (`5ef5a04` … `0d1ca0a`): zemin (tip tek kaynağı, tablolar+ayarlar SQL'i canlıda), push-only service worker + PWA manifesti, yumuşak izin kartı (7 gün erteleme), abonelik saklama (endpoint UNIQUE upsert), gönderici (VAPID transport arayüz arkasında, denemeli retry, 404/410 ölü budama, canlı-dışı no-op çift kilit), orkestrasyon ve rol-aware içerik (`pushYayinla`, gönderim-anı rol çözümü), mevcut bildirim fonksiyonlarına yan etki olarak bağlanma, push tablolarının lint korumasına alınması. **K-P12** fiziksel test bulgusundan doğdu: cihaz izni olsa da rıza vermemiş hesap adına sessiz abonelik yapılmaz, anahtarlar hesaba özeldir (`17bb897`).

**Fiziksel test onayı (29.07.2026, İskender).** Katmanın uçtan uca fiziksel doğrulaması yapıldı ve onaylandı; push işi kod tarafında kapanmış sayılır. Aynı tarihte kod taramasıyla teyit edildi: `lib/push/` altı dosya (tipler, istemci, abonelik, gönderici, içerik, orkestrasyon), `public/sw.js` + `manifest.json` + iki ikon, `app/api/push/abonelik` ucu, `app/providers/PushAbonelik.tsx` (planda hook öngörülmüştü, uygulamada `app/layout.tsx`'e bağlı provider olarak yazıldı) ve dört entegrasyon noktası yerinde — `bildirimOlustur.ts` (iç müşteri), `eclubBildirim.ts` (E-Club), `lib/eczanem/gonderim.ts` + `kasa.ts` (Eczanem, in-app katmanı olmadığı için doğrudan iş olayından, K-P3 istisnası). İki push tablosu lint korumasındadır. Kalan tek adım deploy'dur (P9) ve o, projenin tümü için geçerli olan push disiplinine bağlıdır (§6.3).

### Admin modernizasyonu (17–18.07.2026)

*Kaynak: commit kayıtları.* Tetikleyici admin tam kalite taraması (22 bulgu, B-17..B-38) ve şu yapısal tespitti: "HapBilgi modüler olarak genişlerken admin geride kalmıştır — gerçek anlamda ortada bir admin yoktur." Fiziksel testler durduruldu, öncelik bu işe verildi. **M0 güvenilirlik tabanı** (`58a8063` … `ece0ed1`): toplu yükleme/silme artık kısmi başarısızlığı gizlemez, doğrulama kural kitabı tek kaynaktır, export sorgu hatasında kesilir, silme sırası telafilidir (arşiv → DB → Auth). **M1 ortak çekirdek** (`4196029` … `e0d9b15`): tüm admin route'ları route-içi tek bekçiden geçer (proxy ikinci katman olur), sayfa kapıları `ADMIN_ROLLER`'a bağlanır, şifre politikası tekil ve topluda aynı kural kitabındandır. **M2 bilgi mimarisi** (`4ae1fb4`, `d434c67`, `51be9aa`): dört parçalı yüzey (ana panel + Navbar'a dağılmış iki panel + yetim `/admin/store`) tek kabukta birleştirildi; üstte global bölümler barı, solda firma listesi, içerikte iki gruplu sekme çubuğu. **M3 kullanıcı yönetimi** (`f55b103` … `5427fc4`): toplu yükleme insan-format dosyayı kabul eder ve **eksik kabul modeli** kurulur — kimlik çekirdeği tam satır, takım/bölge eksik olsa da yüklenir, "eksik bilgili" işaretlenir ve firma aktivasyonu bu kullanıcılar varken kilitlenir. Ardından **upsert aşaması** (K-A7): toplu yükleme ekleme değil upsert'tir, şifre asla ezilmez, listede olmayana dokunulmaz.

**K-A8 — organizasyon dosyadan kurulur (18.07.2026, fiziksel test bulgusu üzerine).** Yüklenen dosyada adı geçip firmada bulunmayan takım/bölge "eksik bilgi" değil **kurulum planıdır**. Önizleme "bu yüklemeyle oluşturulacak: N takım, M bölge" kırılımını ve satır bazında neyin açılacağını gösterir — yazım hatasına karşı göz onayı. Kaydette önce takım ve bölge açılır (`organizasyonKurulumPlani` saf plan üretir, yazım rotada kalır), satırlar sonra bilinen akışla işlenir; kayıt tek dosyayla tamamlandığı için kullanıcılar eksik kalmaz ve aktif doğar (T-7). Sınırlar bilinçlidir: **takımsız bölge oluşturulmaz** (uydurma bağ yok — o satır eksik kalır), rol gereği takım taşımayan satırlardaki değerler ("Merkez" vb.) yok sayılır, tekil rota ve Organizasyon sekmesi değişmez. Yan kazanım: ad eşleştirmesi tr-TR katlamasına alındı (`adKatla`) — düz `toLowerCase` "İzmir/izmir" eşleşmesini bozuyordu, smoke bulgusu. Uygulama `1a3a944`.

**K-A5 — geçici çözüm yok.** Panelin tüm fazları boyunca geçerli olan çalışma ilkesi: sistem henüz tek kullanıcılı olduğu için aciliyet baskısı yoktur; ara yamalar (geçici Navbar linki vb.) atlanır, doğrudan hedef kurulur.

### Bunny doğrudan yükleme — vezne modeli (19.07.2026)

*Kaynak: commit kayıtları.* Video önce Supabase storage'a yükleniyor, İçerik Uzmanı onu indirip Bunny'ye yeniden yüklüyordu. Yeni model bu iki adımı da kaldırdı: **vezne** ucu kimlik ve sıra kontrolü yapar, Bunny'de kaydı sistem açar ve adını sistem koyar, istemciye tek videoya özel iki saatlik TUS imzası iner, dosya tarayıcıdan doğrudan Bunny'ye gider ve kanonik embed adresini sistem yazar. API anahtarı istemciye hiç inmez. A0'da imza formülü 201/401 ile doğrulandı, A1 vezne ucunu (`93e686c`), A2 istemci akışını (`a47aa63`), A3 encode durum rozetini ve yetim kayıt telafisini (`1f18454`) getirdi. A4 aynı modeli hazır video koluna taşıdı: PM talep formundan doğrudan Bunny'ye yükler, ikinci vezne ucu (`/talepler/api/bunny-yukleme-baslat`) açıldı, TUS istemcisi ortak yardımcıya çıktı ve İÜ'nün indir-yeniden-yükle adımı kalktı (§2.7). Güvenlik kuralı nettir: bir kayda bağlanmış GUID silinmez, yalnız yetim silinir. Fiziksel teyit aynı gün uçtan uca başarılı. Kapsam dışı bırakılan A5 (Bunny embed/CDN token güvenliği) açık iş olarak durur.

### Dört üretim varyantının tanımlanması (19.07.2026)

*Kaynak: commit kayıtları.* "Hazır soru setim var" tek başına seçildiğinde işleyecek bir mekanizma yoktu (F-07 açık ucu). Dört varyantın tamamı kod üzerinden tek tek kontrol edildi ve her biri için "geliştirme gerekli mi" sorusu gerekçeli cevaplandı; hiçbir dosya değiştirilmeden yazılan bu rapor sonraki işlerin girdisi oldu. Kalıcı karar: hazır akış tüm üretici rollere açıktır, onay yetkisi rolde değil üreticiliktedir (`c753a2e`). Varyant numaraları 27.07'de tek standarda bağlandı (soru seti × video ekseni).

### Fiziksel test turu — F-01…F-07 (19.07.2026)

*Kaynak: commit kayıtları.* İlk kapsamlı insan testi. Bulgular ve çözümleri: talep gönderimi tek tıkla oluyordu ve unutulan dosya fark edilmiyordu → gönderim iki aşamalı yapıldı (doğrulama → özet modalı → gönder); kısmi dosya yükleme hatası sessizce yutuluyordu → dürüst raporlanır oldu; Türkçe adlı dosya yüklemesi kırılıyordu → `guvenliDosyaAdi` ile normalize edildi; gönderilmiş talebin detayında dosya ekleme yolu vardı → kaldırıldı, ekleme yalnız talep açılışında. Test verisi silme rotasındaki "tüm hedef tablolarda `created_at` var" varsayımının bayatladığı da bu turda görüldü.

### Üretim ekranlarının giriş disiplini (20.07.2026)

*Kaynak: commit kayıtları.* Dört ayrı iş, tek ortak ilke: kural kayıt anında değil **girdi anında** uygulanır. Senaryo revizyonundaki düz textarea canlı işaretli editöre çevrildi — silinen üstü çizili, eklenen kırmızı görünür. Hazır soru seti yapıştırma alanından yapısal soru kartlarına geçti; dosyadan içe aktarma yalnız formu doldurur, doğrulama alan bazlı kalır — esnek parse'ın sessizce yanlış set üretmesi böyle engellendi (`f5f0396`, `68a429e`). Karar yetkisi talebi açan üreticiye kilitlendi (Ç-7), revizyon notu zorunlu alan oldu ve revizyon tavanı ikiye sabitlendi (`50dc5a7`); İÜ süreçleri aynı turda düzenlendi (`ae65ef5`).

### PM ve İÜ fiziksel test turu (21.07.2026)

*Kaynak: commit kayıtları.* İki kalıcı karar bu turdan çıktı. **Talep numarası:** her talep firma bazlı sıralı numara alır, 10001'den başlar, görünüm `FirmaAdı_10001`'dir — tarih yok, kısaltma yok; görünen metin kayıtta tutulmaz, firma adı ve numaradan ekranda üretilir. DB tarafında `talep_no` kolonu, `UNIQUE(firma_id, talep_no)` ve INSERT trigger'ı kuruldu, mevcut talepler geriye dönük numaralandı. **Onaylanan Talepler** kart yığınından tabloya çevrildi; satıra tıklanınca onaylı senaryo + video + soru seti detayı altında açılır.

### PM hazır video fiziksel test turu (21.07.2026)

*Kaynak: commit kayıtları.* Turun asıl bulgusu V1-5/V1-6 idi: üretici kendi yüklediği videoyu ikinci kez onaylıyordu — anlamsız bir ara adım ve zincirin orada kilitlenme noktası. Ara adım kaldırıldı; zincir yükleme biter bitmez kurulur, soru seti işi ve İÜ bildirimi o anda doğar (`70ae462`). Belge ayrıca bir **ihlal kaydı** taşır: V1-5 ilk seferinde eksik uygulanmış, İskender'in kontrolünde yakalanmış ve `142e187` ile tamamlanmıştır.

### Zincirin talebe doğrudan bağlanması (22–23.07.2026)

*Kaynak: commit kayıtları.* Hazır kol ayrı bir modülde yaşıyor ve sahte senaryo satırları (`"[Hazır Video — Senaryo Atlandı]"`) üretiyordu; kök neden hayalet satır değil NOT NULL ihlaliydi. Veri temsilinde "Yol 2" seçildi: `videolar` ve `soru_setleri` tablolarına `talep_id` (FK) ve `kaynak` (`'iu'`/`'hazir'`) eklendi, üç kolon nullable yapıldı, mevcut satırlar backfill edildi (Adım 1, `8151458` öncesi SQL). Süreç modülü `lib/uretim/surec.ts` kuruldu — "onayda sıradaki kabuğu doğur + bildir" kuralının tek yeri (Adım 2, `8151458`). Hazır kol ayrı modülünden söküldü ve aynı hatta katıldı, modül silindi (Adım 3, `72e870a`). Görünürlük yedi üretim tablosunda RLS'e indi (Adım 4, `016c86c`), eski zincir bağımlılıkları temizlendi (Adım 5, `f2ef7b2`). Ön-geliştirme olarak üretim, tüketimin merkezî `v_yayin_detay` görünümünden koparıldı ve üretime özel `v_uretim_detay` kuruldu. Kabuklar artık `iu_id = null` doğar — eskiden onayı veren üretici yazılıyor ve "bu işin İÜ'su kim" sorusu ara evrede yanlış cevap veriyordu.

### Yayındaki Videolar sayfası (23.07.2026)

*Kaynak: commit kayıtları.* Üretim tarafının kendi çıktısını izleyebileceği ayrı bir sayfa kuruldu; yedi adımda koşuldu (`1a835ba` … `030f236`). Rol seti tek sabitte tanımlandı (`YAYINDAKI_VIDEO_GORENLER` = üretici + yönetici + yönlendirici); klasörleme kararı rol değil **departman** bazındadır — eşleme tek dosyadadır (`lib/video/departman.ts`: `ik_*`→İK, `egt_*`→Eğitim, `med_md`→Medikal, gerisi→Ürün), üç ayrı ürün rolü tek "Ürün" klasörüne düşer, etiketler firmaya göre uyarlanabilir ve boş departman hiç gösterilmez. İK bilinçli olarak dahil edildi. Ana sayfadaki mevcut video bölümüne dokunulmadı; yeni sayfa kendi kart varyantını kullanır (`YayindakiVideoBolumu` — ana sayfanın `VideoBolumu`'su değişmedi). Yüzey yalnız-izlemedir: puan verilmez, soru sorulmaz — oynatıcı `tuketici={false}` ile çağrılır, `baslat`/`bitir` etkileri erken döner.

Üç tasarım kararı bu sayfaya özgüdür. **(1) Tür süzgeci yoktur:** ana sayfadaki "kendi ürettiğin türü görme" dışlaması burada uygulanmaz — yayındaki her tür görünür, çünkü amaç tüketim değil üretim çıktısını izlemektir. **(2) Üreten bilgisi ve sayaçlar kodda toplanır:** `v_yayin_detay.uretici_id` → `kullanicilar` tek toplu sorguyla çözülür (N+1 yok); favori ve beğeni sayıları `video_favoriler`/`video_begeniler`'den toplu çekilip bellekte sayılır — bu sayfa için DB'ye kolon ya da view eklenmemiştir. **(3) Erişim iki katmanlıdır:** API ucu rol setinin dışını reddeder, proxy bekçisi URL'den gireni kapatır (tüketici/İÜ → API 403, sayfa `/ana-sayfa`). Aynı turda üretici ana sayfasından alt "Videolar" bölümü kaldırıldı (içerik artık bu sayfada) ve talebi olmayan üreticinin "İçerik Takibi" tablosuna boş-durum metni kondu. Bilinen sınır: dar kapsamlı roller (TM/BM/İK) yalnız kendi takımını görür — takımı olmayan rolde liste boş kalabilir.

### Firma-önekli talep numarası — gösterim (23.07.2026)

*Kaynak: commit kayıtları.* 21.07'de kurulan numaralandırmanın ekran tarafı tamamlandı: ID yedi takip ekranında ilk sütun olarak gösterilmeye başlandı (`6dbd6fe` … `4aaa70e`) ve gösterim ortak fonksiyona (`talepIdGoster`) toplandı. Amaç açıkça yazılıdır: her kalem tek bir ID ile tanınsın, tekil silme bu ID ile hedeflensin, firma karışıklığı kaynaklı hatalı işlem önlensin. Bu iş, bir sonraki günün silme işinin ön koşuluydu.

### Talep ve yayın silme (24.07.2026)

*Kaynak: commit kayıtları.* Admin, bir talebi ya da yayını görünen ID ile silebilir oldu; tekil ve toplu silme aynı kurala bağlı ve işlem atomiktir (`1e59294`). Puanı işlenmiş yayın için ayrı kontrol vardır. Eski `test-temizlik` sayfası ve modalı silindi, işlem admin üst barındaki onay modallı tek kapıya taşındı. Aynı gün talep alanları da genişletildi: ürünsüz ve tekniksiz türlerde (medikal, İK) izleyicinin göreceği serbest eğitim adı alanı eklendi, ürün müdüründe teknik tercihli hâle geldi (`148bb44`, `b21b09f`).

### Zincir kırıklarının kapatılması (25.07.2026)

*Kaynak: commit kayıtları.* Adım 0 teşhisiyle başlandı ve canlıda zarar görmüş kayıt olmadığı doğrulandı (`cff0b7c`). Üç kırık kapatıldı: yarım kalan hazır video zincirinin kalıcı kilidi — "video zaten var → yalnız adresi güncelle ve çık" erken dönüşü kaldırıldı, süreç modülü eksik halkayı tamamlar (`6e3b379`); onayda sıradaki iş doğmazsa onay geri alınır, sessiz kopma bitti (`5c9e924`); hazır set parametre kilidi talep anına çekildi — uyumsuz set eskiden DB'ye girip saatler sonra video yüklemesinde patlıyordu (`31fc962`). Aynı turda talep künyesinin adı tek kapıdan okunur oldu (`/talepler/api/kunye` + mimari bekçi, `7015b60`): ad kuralı 13 ekranda ayrı ayrı kopyalanmış, dördünde yanlış kopyalanmıştı.

### Durum sözlüğü ve iletişim kartı (25.07.2026)

*Kaynak: commit kayıtları ve `bac3bce` belge güncellemesi.* Aynı üretim durumu altı ayrı yüzeyde dört ayrı dille yazılıyordu ve hiçbiri "top kimde" bilgisini vermiyordu. Metin ve renk tek dosyaya toplandı (`lib/utils/durum/mesaj.ts`); kural şudur: mesaj tek başına iki şeyi söyler — ne oldu ve kimden aksiyon bekleniyor. Aşama adı mesajda tekrarlanmaz. İçerik Uzmanı için ikinci bir tablo yazıldı: aynı kodlar, ama İÜ'nün işi aşamaya göre değiştiği için mesaj "neyin" beklendiğini söyler ve karşı taraf kod diliyle değil gerçek unvanıyla anılır. Ana sayfa, üretim hattı sayfaları ve yayın yönetimi satırı sırayla bu sözlüğe bağlandı (`0fc84df`, `11d2dda`, `0f4406f`, `4fc2cad`). Aynı gün İÜ ekranlarına talebi açanın, üretici ekranlarına içerik üreticisinin künyesi eklendi (`6116dea`) — gerekçe "olası acil hızlı iletişim".

### Toast merkezi ve mimari bekçi (26.07.2026)

*Kaynak: commit kayıtları.* Toast cümleleri hem sunucu uçlarında hem sayfalarda üretiliyordu; aynı olay iki farklı cümle verebiliyordu. Sekiz adımda tek merkeze toplandı (`bf20d0a` … `ebee81c`): sözlük kuruldu, senaryo/video/soru seti aşamaları sırayla bağlandı, talep açılışı varyanta duyarlı hâle getirildi ve sunucudaki metinler kaldırıldı — uç yalnız olguyu döner, cümleyi çağıran çözer. Kalıcı koruma belge değil koddur: `hapbilgi-mimari/toast-tek-kaynak` ESLint kuralı yazıldı (`917b527`). Aynı turda revizyon turu sayısının son duruma değil **durum geçmişine** bakması gerektiği bulundu ve üç sayfada düzeltildi (`cd13e88`) — İÜ yeniden teslim edince revizyon izi kayboluyordu.

### Dikey video ve oranlı çerçeve (26.07.2026)

*Kaynak: commit kayıtları.* Oynatıcı sabit 16:9 kutudaydı; dikey video iki yanında siyah bantla sıkışıyordu. Oran hesabı tek yere çıkarıldı (`lib/video/enBoyOrani.ts`, `1ed62ae`), `VideoCercevesi` oranlı kutu bileşeni yazıldı (`c0cb904`), önce izleme oynatıcısında pilot yapıldı (`433cfdc`), sonra sekiz yüzeye yayıldı (`6aedc84`). Oranın kaynağı Bunny kapağının ölçüsüdür; masaüstünde dikey videonun sayfayı uzatmaması için yükseklik tavanı kondu. Yol seçimi ölçümle yapıldı: Bunny kapağı videonun gerçek oranında üretildiği için DB kolonu ve webhook gerektiren yol hiç açılmadı. Dört alternatif gerekçeli reddedildi — container query kapsayıcının ölçüsünü sorgular, içeriğin değil; cross-origin iframe içeriği CSS'e ya da JS'e hiçbir koşulda sızmaz; ayrı metadata tablosu iki tam sayı için her `v_yayin_detay` okumasına bir join bindirirdi; yalnız "dikey/yatay" yönünü tutmak 3:4 ve 4:5 videoyu yine bantlardı, bu yüzden ham ölçü tutulur. Kart ve kapak alanları bilinçli olarak 16:9 kaldı: ızgarada yan yana duran kartlarda oranlı kapak satırları tırtıklar. Yedek zinciri her koşulda 16:9'dur — eski kayıt, Bunny dışı URL, ölçüsüz veri ve bozuk girdi bugünkü görünüme düşer. Aynı gün Onaylanan Talepler'e firma / müdürlük / ürün klasör kırılımı eklendi (`f991a23`, `96d204f`, `15cb98b`) ve unvan tek kaynağa bağlandı (`4922de5`).

### Pill ve liste merkezleri (27.07.2026)

*Kaynak: commit kayıtları.* Önce tarama yapıldı, hiçbir dosya değiştirilmeden: 118 pill ve **32 farklı ölçü imzası** bulundu — yazı boyu üç yoldan, kalınlık dört, yatay dolgu beş, dikey dolgu dört, kenar üç, satır yüksekliği dört yoldan geliyordu; aynı satırdaki dört rozet dört ayrı yükseklikteydi. Kararlar tarama sonrası verildi: tek standart ölçü, tek boy, kenar her zaman 0.5px, satır yüksekliği sabit. Ölçü `components/pill/Pill.tsx`'e toplandı; sınır bilinçli çizildi — merkez **şekli** sahiplenir, **anlamı** değil: renk durum sözlüğünden ve rol tasarımından gelir (`701911f`). Aynı gün liste merkezi kuruldu (`useListe` + `ListeArama` + `DahaFazlaGoster`) ve Talepler sayfası devam eden / iptal edilen diye ayrıldı — üretimi bitmiş talep artık o sayfada görünmez, Yayın Listesi'ne aittir (`580097b`).

### Üretici ana sayfası — 43 sorgu → 2 (27.07.2026)

*Kaynak: §6.4 kapananlar.* `lib/utils/anaSayfa/uretici.ts`'te talep başına sıralı sorgu zinciri vardı (1+7N): altı talepli bir üreticide 43 ardışık gidiş-geliş, `/ana-sayfa/api` 2.93 saniye. Üretim zinciri `v_uretici_icerik_takip` view'ine (LATERAL) taşındı; route iki paralel sorgu yapar ve maliyet talep sayısından bağımsız sabittir. Yöntem seçimi kurala uygundur: sayfa hesaplamıyor listeliyor, dolayısıyla RPC değil view. View yalnız **ham durum** döndürür — durum metni sözlükte, aşama seçimi saf fonksiyonda kalır. Kolonlar açık seçilir ki denetim kolon değişimini yakalasın. Yeni view otomatik yetki almaz; service_role SELECT alamazsa sayfa "permission denied for view" ile boşalır, bu yüzden GRANT DDL'in parçasıdır (`9fb6839`).

### `kayit-tek-kaynak` kapsam genişletmesi — B-07 (29.07.2026)

*Kaynak: açık işler md.3 (kalite taraması B-07, 12.07.2026'da tespit edilmişti).* Korumalı 15 tabloyu koruyan mimari kural yalnız `.insert` çağrısını tanıyordu; `.update`, `.delete` ve `.upsert` kuralın görüş alanı dışındaydı — yetkili dört klasör (`lib/puan/`, `lib/tur/`, `lib/eczanem/`, `lib/push/`) dışından yapılacak bir güncelleme ya da silme rapor edilmeden geçerdi. Kural dört yazma işlemini birden tanıyan bir kümeye bağlandı (`YAZMA_ISLEMLERI`, `tools/eslint-rules/index.mjs`) ve hata mesajı hangi işlemin yakalandığını söyleyecek şekilde parametrelendi. Zincir yürüyüşü değişmedi: supabase-js'te dördü de `.from(tablo).xxx()` biçiminde yazıldığı için mevcut `.from` arama döngüsü hepsini aynı yoldan çözer. Genişletme **hiçbir mevcut kodu bozmadı** — aynı gün yapılan sayımda 15 tablodaki 19 yazma işleminin tamamı (ekleme 14, güncelleme 4, üzerine yazma 1, silme 0) zaten yetkili klasörlerin içindeydi; kural genişletildikten sonra `lint:mimari` yine ihlalsiz geçti. Kapsam doğrulaması ayrıca yapıldı: yetkili klasörler dışında dört işlemi de içeren geçici bir dosya oluşturulup dördünün de rapor edildiği görüldü, dosya silindi. Kapsam dışı kalan bilinen sınır: `.rpc()` üzerinden yapılan yazımlar bu kuralın görüş alanına girmez — kural yalnız doğrudan tablo çağrılarına bakar. Aynı turda kuralın belgedeki muafiyet listesi kodla eşitlendi (`lib/push/` eksikti, §6.2).

### Hard-coded rol dizilerinin temizliği — `rol-tek-kaynak` bekçisi (30.07.2026)

*Kaynak: açık işler md.3 (kalite taraması B-09, 12.07.2026'da tespit edilmişti).* "Kim görebilir" rol kararı `lib/utils/roller.ts` adlandırılmış gruplarından okunmalıyken dosyalara elle yazılmıştı ve büyüyordu (12.07'de ~125 karşılaştırma / ~60 dosya; 29.07 ölçümü 190 / 98). Sorun önce ölçüldü: 132 dosya beş öncelik kategorisine ayrıldı (gerçek grup-tekrarı / sessiz hata / karışık kullanım / tekil-sınırda / meşru), ardından modül × iş-süreci × rol × kod matrisi çıkarıldı — çekirdek modüllerde (T-Club/E-Club/C-Club/Eczanem) hard-code'ların neredeyse hepsinin roller.ts karşılığı **zaten vardı**, yani yeni grup değil benimsetme gerekiyordu. **Sıralama kararı bekçiyi öne aldı:** `hapbilgi-mimari/rol-tek-kaynak` kuralı (§6.2) *ratchet* modeliyle kuruldu — mevcut 50 ihlal dosyası baseline'da tanındı, yeni elle yazım anında reddedilir; her modül temizlendikçe dosyalar baseline'dan düştü. Kural bilinçli olarak yalnız **içinde ≥2 hard-code rol string'i olan dizileri** hedefler; tekil karşılaştırma (`rol === "bm"`), hedef kitle değerleri ve tip-union'lar kapsam dışıdır. Temizlik çekirdek (T-Club T1–T7 + T3b, E-Club E1–E4, C-Club sıfır-eylem, Eczanem Ez1–Ez2) ve kompleks faz (rapor/öneri/anaSayfa/profil/video/hedef-listeleri/kullanıcılar, K1–K7) olarak yürüdü; her adım tek commit ve üçlü doğrulamadan (tsc + denetim + lint:mimari) geçti. Değişimlerin çoğu davranış-korurdu (yerel kopya ≡ mevcut sabit), ama iki **sessiz sapma** ortaya çıktı ve düzeltildi: HBStore sipariş "Takım" filtresinde dört hayalet rol (`egt_uzm`/`ik_uzm` — 7 gerçek eğitim/İK rolü filtreyi göremiyordu) ve kullanıcı oluşturma dropdown'ında elle listenin 5 İK rolünü atlaması (admin bu ekrandan İK kullanıcısı oluşturamıyordu; İskender kararıyla eklendi). İş bitiminde baseline **50→0**'a indi: bekçi artık tam sıkıdır, sorunun yeniden büyümesi yapısal olarak engellenmiştir.

### HBLigi ölçek geçişi ve haftalık periyot — E9 (31.07.2026)

*Kaynak: açık işler md.9 (HB Ligi ölçeklenmesi).* İki ligin sıralaması her sorguda kayıt tablolarından sıfırdan SUM yapan canlı-hesap view'larından okunuyordu (`v_hbligi_sirali`); ~500–1000 UTT'ye kadar yeterliydi, hedef 100k ölçeğinde ilkel kalıyordu. Sıralama, kişi × gün bazında önceden hesaplanmış bir **özet tabloya** taşındı (HBLigi `hb_ligi_ozet_v2`, CC Ligi `cc_ligi_ozet`): dört besleyen tabloya `AFTER INSERT` trigger özet kovayı günceller, okuma anında `v_hbligi_sirali`/RPC'ler kovaları tarih aralığıyla toplayıp `row_number`/`RANK` ile sıralar (§2.5). Geçiş güvenli yürüdü — önce v1'in birebir kopyası (`_v2`), her adım özet çıktısı canlı-SUM ile birebir doğrulandı (`EXCEPT` farkı 0; hem statik hem trigger-canlılık smoke testi), sonra tüketiciler v2'ye alındı ve v1 emekli edildi. Özet günlük kovaya kurulduğundan **haftalık periyot** eklendi (dört periyot: hafta/ay/çeyrek/yıl, Pazartesi bazlı); lig arayüzü Excel-gridinden podyum + progression çubuklu leaderboard'a dönüştü ve **kayıplar görünür** kılındı (önceden net puana giriyor ama gösterilmiyordu). Aynı çalışmada iki eksik kapandı: **öneri kaybı** cezası hiç yazılmıyordu (cron var olmayan `oneri_kaybi_tara()`'yı çağırıyordu, tablo boştu) — fonksiyon kuruldu ve `td07` simetri denetimi temizlendi; özet tabloyu okuyan periyot RPC'leri `SECURITY DEFINER` yapıldı (iç/KORUMALI tablo). Aynı desen CC Ligi'ne (BM) birebir uygulandı. Tümü lokal, üçlü doğrulamadan (tsc + denetim + lint:mimari) geçti, push yok.

### Toplu ve Tekil Silme aracı (01.08.2026)

*Kaynak: `docs/toplu_tekil_silme_is_plani.md` (yaşayan iş planı, tamamlanınca bu adıma taşındı).* Test ortamındaki niteliksiz girdileri ve üretilen sonuçları uçtan uca ve **iz bırakmadan** silmek için admin-özel bir araç kuruldu; yetki yalnız admin. Silme **yalnız üretilen veriyi** hedefler — iskelet (kimlik + master + ürün içeriği), içerik puan-değerleri (`video_puanlari`/`soru_seti_puanlari` = bir videonun/sorunun kaç puan ettiği, "kalite oyu" değil) ve **bitmiş siparişler** (mağaza `teslim_edildi` / eczanem `onaylandi`) her modda korunur. Mimari tek parametrik çekirdek + önizleme + API + iki UI tetikleyici: FK-güvenli tek RPC `test_veri_temizle(p_mod, p_firma_id, p_talep_id)` üç modu tek gövdede toplar (`tum` tüm firmalar / `firma` o firmanın verisi / `tekil` tek talep), salt-okuma ikizi `test_veri_sayim` aynı kapsam mantığıyla önizleme sayılarını döndürür (önizleme gerçek silmeyle birebir uyuşur). Firma bağı `talepler`'de `firma_id` olmadığından `talep.urun_id → urunler.firma_id` üzerinden kurulur; firma kapsamı zaten sistemde tanımlı olduğundan belirsizlik yoktur (HBStore alan kişinin firması, E-Club Store `firma_puan.firma_id`), adresler kişi-düzeyi olduğu için yalnız `tum` modunda temizlenir. Silme atomik tek işlemdir; FK sırasına göre sipariş çocukları → izleme çocukları → 15 puan/kayıp defteri → izleme tabloları → izleme ebeveynleri (öneri/challenge/gönderim/tekrar) → siparişler (onaysız küme) + kullanılmayan adresler → eczanem yan kayıtlar + **push abonelik/gönderim** + bildirim silinir, ardından lig özet-cache'leri (`cc_ligi_ozet`, `hb_ligi_ozet_v2`, `hb_ligi_v2`) tazelenir ki puan gidince hayalet sıralama kalmasın. **İz bırakmama** kritik kararı: push kayıtları DB'de tutulduğundan RPC onları da siler — eski `test-temizlik` aracının açığı buradaydı; Bunny/Auth/ürün dosyaları korunan iskelet olduğundan dış çağrı gerekmez. API ucu (`app/admin/api/veri-sil/route.ts`) iki katman güvenlik taşır (proxy `/admin` bekçisi + `adminGirisKontrol`) ve UUID doğrular. İki UI girişi: navbar "Toplu/Tekil Sil" modalı (`TopluTekilSilModal` — Toplu "TÜM VERİLER" yazımıyla / Tekil `talep_id`) ve firma kartındaki ayrı "Veri Sil" butonu (`FirmaVeriSilModal`, firma adını yazma onayıyla; firmayı tümüyle silen "Sil"den ayrıdır). Her tetikleme sayım önizleme → geri alınamaz son onay → silme akışını izler. Aşamalar 0–6 sırayla koşuldu; tümü lokal, üçlü doğrulamadan (tsc + denetim + lint:mimari) geçti, DB işlemleri İskender tarafından koşuldu, push yok.

### Ana sayfa kabuk dönüşümü — navbar → sol liste (02.08.2026)

*Kaynak: `docs/ana_sayfa_kabuk_donusum_is_plani.md` (yaşayan iş planı).* Her rol için ana/alt görevler çoğaldıkça navbardaki rol-bazlı pill sistemi yetersiz kaldı, yük sayfanın içine biniyordu; ayrıca **41 sayfa** eski `components/Navbar.tsx`'i ayrı ayrı render ediyordu (mükerrer mount + mükerrer auth guard). Çözüm framework-native oldu: App Router **route group ortak layout**'u (`app/(panel)/layout.tsx`) kabuğu tek yerde kurar — guard, firma-aktiflik bayrakları (`profil/api`) ve rozet çekimi (`bildirimler/api` + yayın kuyruğu) **bir kez** burada yapılır; sayfalar yalnız içerik döner. Gezinme **tek kaynak** bir bildirimsel config'ten (`components/panel/panelNav.config.ts`) beslenir: rol/aktiflik koşulları eski Navbar'dan birebir alındı (davranış-korur), ana→alt görev ağacı olarak dizildi. Üst bar (`PanelNavbar`) tüm rollerde sabit 5 bilgi pill'i (Ana Sayfa · HapBilgi Nedir · Nasıl Çalışır · Sözleşmeler · İletişim) + sağ blok; fonksiyonel gezinme sola (`SolListe`) dikey liste olarak indi; mobil için aynı config'i çizen `MobilDrawer`. Rozetler tek kaynaktan çekilip prop olarak dağıtıldı (karar B — mükerrer istek yok). eclub_kisi dar gezinmesi aynı bileşenlere ayrı bir config listesi (`ECLUB_KISI_NAV`) verilerek çözüldü (tek kaynak). 41 sayfa yedi batch'te `(panel)`'e taşındı (URL'ler route group nedeniyle değişmedi); her sayfadan Navbar + genel guard boilerplate çıkarıldı, sayfaya özel yönlendirme/erişim/veri mantığı ve gereken `router` kullanımları korundu, wrapper'lar bırakıldı. Taşıma bir mimari bekçiyi kırdı: `toast-tek-kaynak` yol kontrolü `/app/talepler/` gibi sabit önekler kullanıyordu; `(panel)` eklenince kapsamını yitirdi → kural klasör-adı bazına genişletildi (`/talepler/`), route group taşımalarında bekçi korunur. Yol boyunca birkaç pre-existing ölü kalem (kullanılmayan import/sabit/değişken) ve bir React hook kuralı ihlali (`onaylanan-talepler`'de useEffect içinde `useListe`) temizlendi. Bitişte eski `components/Navbar.tsx` silindi (sıfır importer doğrulandı). Tümü lokal, her batch tsc + denetim + lint:mimari + no-unused-vars'tan geçti; commit'ler İskender onayıyla, push yok. Faz 1 pilotu ana-sayfada görsel onaydan geçti; açık ek işler: logo hizası, accordion gruplar, IU'da HBLigi gizleme (iş planı §6.5).

**Kabuk sabitleme (03.08.2026, devam).** Kabuk oturduktan sonra fiziksel testte sol listenin (ve algıda üst barın) sayfa aşağı/yukarı kaydıkça onunla birlikte kaydığı, sabit kalmadığı görüldü. **Ne yapıldı:** kabuk, sayfanın (viewport) hiç kaymadığı bir yapıya çevrildi — navbar üstte, sol liste solda yapısal olarak sabit kalır; yalnız orta içerik kendi içinde kayar. **Nasıl yapıldı:** ilk denemede `SolListe` aside'ına `position:sticky; top:54px` verildi, ancak `54px` mobil navbar yüksekliğine denk geldiğinden logosu responsive büyüyen (`h-10/h-14/h-20`) masaüstü navbar'ıyla uyuşmadı ve tam oturmadı ("az hareket"). Bir magic-number'a bağlı kalmamak için sağlam çözüme geçildi: `app/(panel)/layout.tsx` dış çerçevesi `height:100vh` + `display:flex; flex-direction:column; overflow:hidden` yapıldı; alt satır `flex-1` + `min-h-0`; `<main>`'e `overflow-y-auto` eklendi. `SolListe` aside'ından sticky/offset kaldırılıp `overflow-y-auto` verildi — flex-stretch ile tam yüksekliğe uzar, kendi alanında sabit kalır ve uzunsa içinde kayar. Böylece navbar ve sol liste, sayfa hiç kaymadığı için yapısal olarak sabittir ve navbar yüksekliğine dair offset tahminine gerek kalmaz. `MobilDrawer` `fixed inset-0` olduğundan bu değişiklikten etkilenmedi. **Son durum:** tsc temiz, konsol hatası yok, dev sunucuda hatasız yükleniyor; değişiklik (`app/(panel)/layout.tsx` + `components/panel/SolListe.tsx`) lokaldir, görsel teyit ve commit İskender'e bırakıldı.

### Zaman uyumlandırması — tek kaynak, bekçi ve DB TR günü (06.08.2026)

*Kaynak: başka bir oturumda tespit edilen zaman kayması (sistemde hesaplanan zamanlamalar kayıyordu); Opus 5'in keşif raporu + iş planı bu oturumda gözden geçirilip revize edilerek uygulandı.* B-12, `lib/zaman/kontrol.ts`'i kurmuştu (`Intl` + Europe/Istanbul ile takvim parçaları; TR duvar saati → mutlak UTC an) ama beş gün sonra **17 dosyada** makine saatiyle (`getHours`/`getDay`/`getDate`/`getMonth`/`getFullYear`/`setHours`/`setDate` + `toISOString().slice` gün kesme) elle takvim hesabı kalmıştı — local'de TR (doğru), Vercel'de UTC (gün/hafta/ay/çeyrek/yıl sınırları 3 saat kayar). Üç somut hata: **öneri kuralı** (`lib/oneri/tarihKurali.ts` varsayılan "bugün"ü UTC'den kesiyordu → TR 00:00–02:59 arası bugüne öneri yanlışlıkla **kabul**), **hafta başı 5 kopyası** (`getDate()-getDay()+1` Pazar günü `getDay()=0` ile +1 verip **gelecek** haftanın Pazartesi'sine atlıyordu; ayrıca alt sınırı 03:00 TR'ye kaydırıyordu), **grafik ekseni** (`periyotAltKirilim` etiketi sabit metin, sınırı makine saati → "12" dilimi TR 06:00–12:00 yerine 09:00–15:00'i kapsıyordu).

**Üç kalıcılık kararı:** (1) *Kaynak ham parça değil KAVRAM yayınlar* — `trParcalari` ve `trAnUtc` bilinçle özel kaldı; dışarı `gunBaslangici`/`ceyrekBaslangici`/`trGunu`/`trGunEkle`/`haftaNo`/`yilinHaftalari`/`aktifPeriyot`/`ayKaydir` gibi tamamlanmış kavramlar açıldı (bir tüketici ham parçaya uzanıyorsa kavram eksiktir; çözüm kavramı eklemektir, yüzeyi açmak değil). (2) *Sözleşme metin değil test + bekçi* — `tests/zaman.sinir.smoke.test.ts` doğruyu ölçer (iki uç TZ: `TZ=UTC` ve `TZ=Pacific/Kiritimati` = UTC+14), `hapbilgi-mimari/zaman-tek-kaynak` (§6.2) yanlışı engeller. (3) *Temizlik ratchet'le* — 17 ihlalli dosya baseline'da tanındı (`warn`), her modül tek kaynağa bağlandıkça düştü, baseline boşalınca kural `error`'a çekildi.

Dokuz adım tek tek yürüdü; her biri üçlü doğrulama (tsc + denetim + lint:mimari) + iki uç TZ smoke'tan geçti. Aktif hatalarda **önce-kırmızı** test (Adım 3 öneri: gece 01:00'e dondurulmuş zaman; Adım 5 grafik: TZ=UTC'de eksen kayması), davranış-korur devirlerde **önce/sonra** kanıtı (Adım 4/7 throwaway kıyas — eski formül ≡ kavram, iş sonunda silindi). Bekçi kapsamı `components/`'e genişletildi (o bölge hiç lint edilmiyordu; genişletince zaman-dışı mimari ihlal çıkmadı — 3. bölge sağlam). Test koşucusuna `@/` alias çözücü eklendi (`tests/_alias.mjs` + hooks; çıplak `node --test` tsconfig path'ini çözemiyor, yalnız test ortamı, üretime gitmez). Grafik ay sınırları için `ayKaydir(tarih,n)` kavramı eklendi (`trAnUtc`'yi açmak yerine — `Date.UTC` ay/yıl taşmasını normalize eder). Sonuç: baseline **17→0**, kural `error` — makine saatiyle yeni takvim hesabı derlemeyi durdurur. **13 commit**, lokal.

**Neden bugüne dek fark edilmedi (maskeleme):** puan yalnız UTT'de hafta içi 07:00–20:29 yazılır (`puanKazanilabilirMi`, tek çağıran `app/izle/api/bitir/route.ts`); kayan dilim (TR 00:00–02:59) bu "puansız ölü bölge"ye düşer, hata kendini gizler. Ama **E-Club, Eczanem ve CC 7/24 puan yazar** (günlük pencere yok — dış müşteri/BM için mesai kısıtı anlamsız, bilinçli tasarım); o üç düzlemde maskeleme yoktur, kayma aktif olarak gerçekleşebilir.

**DB tarafı (ayrı commit `b439cfb`):** oturum UTC; gün kovaları `(created_at)::date` ile günü UTC'den kesiyordu. Ölçüm (salt-okuma, İskender koştu): üç 7/24 tablo (`eclub_kazanilan_puanlar`/`eczanem_puan_kayitlari`/`cc_kazanilan_puanlar`) **boş**, UTT tablosu 13 kayıt (hepsi öğleden sonra → kaymasız). Veri yokken **proaktif** düzeltme: 5 yazma noktası — `hbligi_v2_ozet` + `cc_ligi_ozet` trigger'ları, `hbligi_v2_backfill` + `cc_ligi_backfill`, `test_veri_temizle` — `(created_at AT TIME ZONE 'Europe/Istanbul')::date`'e çevrildi; **okuma katmanı** (`hbligi_v2_okuma`/`cc_ligi_okuma`'da `make_date`/`date_trunc` = TR takvim günü sınırları) zaten doğruydu, dokunulmadı — iki taraf artık tutarlı. İki trigger canlıda `pg_get_functiondef ... LIKE '%Europe/Istanbul%'` ile doğrulandı (`true`); İskender 4 sorguyu koştu (4/4 başarılı), HB backfill'de fark 0 (kaymasız veri), CC backfill gerekmedi (boş tablo).

**Açık kalan (bilinçli, notlandı):** `hapbilgi-mimari/zaman-tek-kaynak` bekçisi `toLocaleDateString`/`Intl` `timeZone`'suz çağrıları, `new Date(yıl,ay,gün)` yerel kurucusunu ve `scripts/sql/` dosyalarını **yakalamaz**; ayrıca "Türkiye kalıcı UTC+3, DST yok" varsayımına ve puan penceresine (maskeleme) bağımlıdır. Tümü lokal; DB işlemleri İskender tarafından koşuldu; push yok.

### HBLigi üst rol kapsam güvenliği ve Saha Perspektifi (11.08.2026)

*Kaynak: BM/TM/PM/GM fiziksel rol turu + kanonik SQL doğrulamaları.* Üst rol HBLigi ekranlarının eski ortak "genel" kolu RPC'nin sistem genelindeki bütün UTT satırlarını doğrudan istemciye veriyor, firma/takım/bölge filtrelerini URL'ye yazmasına rağmen API bu parametreleri hiç uygulamıyordu. Canlı turda PM ve GM'nin üç firmadaki **19 UTT'yi**, TM'nin de başka firmalara ait aynı adlı takımları gördüğü kanıtlandı; BM'nin kendi bölge toplamı doğruydu. Önce veri motoru ayrıştırıldı: Q3'te altı hepifarma UTT'sinin bütün kazanım/kayıp bileşenleri olay tablolarıyla birebir çıktı; rol kapsamı sayımları BM=3, TM=6, üretici=6, yönetici=6 olarak doğrulandı; hafta/ay/çeyrek/yıl dört RPC'sinde kanonik toplam ile fark **0** bulundu. Dolayısıyla DB ve günlük özet değiştirilmedi.

Kapsam hatası `getSahaLig` ile sunucu tarafında kapatıldı: rolün firma/takım/bölge kimlikleri oturum kullanıcısından alınır, RPC sistem genelini döndürse bile yalnız yetkili karşılaştırma havuzu response'a çıkar; eski `getBmLig`/`getTmLig`/`getGenelLig` ve istemci filtresi yolu emekliye ayrıldı. Üst rol arayüzü UTT'nin güçlü dashboard çizgisini ayrı bir **HBLigi — Saha Perspektifi** yüzeyine taşır: net saha puanı, aktif/kapsam UTT, kazanım, gerçekleşmiş kayıp, birim ligi, gerçek puan bileşimi, UTT detayları ve veri-türevli saha sinyalleri. Kişisel Liderlik DNA/skor/hedef stub'ları bu yüzeye taşınmaz. Ürün kararları: üretici kapsamı kendi takımıdır; eşit net puan aynı sırayı paylaşır; sıfır puanlı saha görünür kalır.

### Analiz modülünün emekliye ayrılması (14.08.2026)

*Kaynak: ürün değerlendirmesi ve canlı kullanım kapsamı.* Analiz modülü; raporlar ve liglerin zaten sağladığı güçlü ölçüm yüzeyleriyle çakışması, anlamlı yorum üretecek değişken havuzunun sınırlı kalması ve erişebilen sınırlı kullanıcı grubuna karşılık platforma ek bakım/yük getirmesi nedeniyle tamamen kaldırıldı. Sayfalar, API uçları, veri katmanı, AI istemcisi, rol ve menü kuralları, analiz tabloları/RPC'leri ve kurulum SQL'leri sistemden çıkarıldı. Ölçüm mimarisinin aktif kaynakları rol bazlı **Raporlar** ile karşılaştırmalı **Ligler**dir; ayrı bir analiz fonksiyonu bulunmaz.

---

## 8. Kullanıcı Bilgilendirme Ekleri

Bu bölüm, kullanıcıya açıklanması gereken davranış kurallarını senaryolar üzerinden tanımlar. Buradaki kurallar ürün kararıdır; teknik uygulama bu davranışlarla birebir uyumlu olmak zorundadır.

### 8.1 UTT video izleme, ileri sarma ve soru hakkı

**Temel kural:** Soru hakkı yalnızca **geçerli yayın turundaki** ilk gerçek izleme denemesinde, video baştan sona tamamlandığında ve hiç ileri sarılmadığında doğar. Bir video geçerli turda daha önce yarım bırakılmışsa veya herhangi bir denemede ileri sarılmışsa, o turun sonraki izlemelerinde soru hakkı açılmaz. Yeni yayın turu başladığında hak yeniden değerlendirilir; tekrar periyodu bulunmayan yayında tek tur ömür boyu sürdüğü için kapanan hak yeniden doğmaz.

"Bir kerede izleme", aynı oynatma oturumu içinde baştan sona tamamlamaktır. Kullanıcının videoyu duraklatıp aynı oturumda devam etmesi bu bütünlüğü bozmaz. Sayfadan çıkmak, sekmeyi kapatmak, başka bir videoya geçmek veya oynatma oturumunu sonlandırmak ise videoyu yarım bırakmak sayılır. Video yalnızca açıldığında değil, gerçek oynatma başladığında izleme denemesi başlar.

| İzleme biçimi | İzleme puanı | İleri sarma kaybı | Sorular |
|---|---:|---:|---|
| İlk denemede, ileri sarmadan bitirdi | Tam puan | Yok | Gösterilir |
| İlk denemede ileri sardı ve bitirdi | Tam puan | Anında kaydedilir | Gösterilmez |
| İleri sardı, yarım bıraktı, bir daha dönmedi | Yok | Anında kaydedilir | Gösterilmez |
| İleri sardı, yarım bıraktı, döndü ve ileri sarmadan bitirdi | Tam puan | Önceki kayıp korunur | Gösterilmez |
| İleri sardı, yarım bıraktı, döndü, tekrar ileri sardı ve bitirdi | Tam puan | Her iki kayıp da korunur | Gösterilmez |
| İleri sardı, yarım bıraktı, döndü, tekrar ileri sardı ve yine bitirmedi | Yok | Her iki kayıp da korunur | Gösterilmez |
| İleri sarmadan yarım bıraktı, döndü ve bitirdi | Tam puan | Yok | Gösterilmez |
| Birkaç kez yarım bırakıp sonunda bitirdi | Tam puan | Varsa tüm ileri sarma kayıpları korunur | Gösterilmez |

**Puan muhasebesi:** İzleme kazanımı ile ileri sarma kaybı birbirine gömülmez; ayrı olaylar olarak kaydedilir. Kullanıcı bir denemede `-3` puanlık ileri sarma kaybı oluşturup videoyu yarım bırakır, sonraki denemede videoyu baştan sona tamamlayarak `+10` izleme puanı kazanırsa videonun net etkisi `+7` puandır. Sonraki tamamlamada "kalan 7 puan" yazılmaz; tam izleme kazanımı yazılır ve daha önce oluşan kayıp ayrıca düşülür.

**İleri ve geri sarma sınırları:** Geri sarma kayıp oluşturmaz. Aynı oynatma oturumunda daha önce izlenmiş bir bölgeye yeniden ilerlemek ikinci kez kayıp doğurmaz. Yeni bir izleme denemesinde yeniden ileri sarılırsa yeni bir kayıp oluşur. İleri sarma kaybı, videonun daha sonra tamamlanıp tamamlanmamasından bağımsız olarak ileri sarma gerçekleştiği anda kaydedilir; böylece çıkış yaparak kayıptan veya soru kısıtından kaçılması önlenir.

**Puansız zaman penceresi:** §3.1'deki mevcut kural korunur. Hafta sonu ve hafta içi 07.00–20.29 dışındaki izlemelerde kazanım, pozitif kayıp ve soru yoktur; pencere izleme başlangıç anına göre belirlenir. Bu pencerede ileri sarma davranışı yine o turun soru hakkını kapatır, ancak pozitif `kaybedilen_puan` kaydı üretilmez.

**Yarım bırakılan videoya dönüş:** Yarım bırakılan video yeniden açıldığında kaldığı yerden sürmez, baştan başlar. Kullanıcı videoyu sonraki bir denemede tamamladığında tam izleme puanını alabilir; ancak ilk deneme bütünlüğü bozulduğu için sorular gösterilmez. İlk tamamlamadan sonraki tekrar izlemeler, mevcut extra puan kurallarına tabidir ve ilk izleme sorularını yeniden açmaz.

**Ana sayfa ayrımı:** "Yeni Videolar" ile yarım bırakılmış videolar tek listede birleştirilmez. Video yalnızca gerçek oynatma başladıktan sonra yarım bırakılmış sayılır; sadece video yüzeyini açıp kapatmak "Yeni Videolar" durumunu değiştirmez. Ana sayfadaki görsel düzen ve adlandırma bu iş kuralından ayrı ele alınır.
