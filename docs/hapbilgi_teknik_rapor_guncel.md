# HapBilgi — Teknik Rapor

*Üç katmanlı öğrenme ekosisteminin veritabanı, backend ve frontend yapısı*

*Sürüm: Tamamlandı — Bölüm 1–6. Temmuz 2026. Güncellemeler (18.07.2026): **Admin modernizasyonu işlendi** (M0–M3 + M2 bilgi mimarisi + upsert aşaması + T-serisi; değişen kesitler: §2.2, §2.4, §6.1 yeniden yazıldı, §6.2, §6.4 — uygulama kaydı: `admin_guncellestirme.md`) ve **Web Push kod üretimi tamam** (P0–P7 + K-P12, 16–18.07 — plan: `hapbilgi_push_teknik_is_plani.md`; "push bekletiliyor" durumu artık yalnız canlıya alma içindir). Önceki güncellemeler: Eczanem üçüncü müşteri katmanı (12.07.2026 — yeni Bölüm 5 + değişen kesitler: §1.2, §2.2–2.4, §2.8, §6.4; U0–U9 kod üretimi tamam, commit'lerde), Tekrar Gönderim Modeli + Ekstra İzlediklerim (10.07.2026). Fiziksel insan testleri (U10/U11 + Tekrar Gönderim U10 + Ekstra U7 + admin toplu yükleme), RLS ve diğer deploy-öncesi mecburi işler §6.4'te teknik borç olarak listelidir.*

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
  - [2.7 Ortak servis soyutlamaları — provider-agnostik video ve AI](#27-ortak-servis-soyutlamaları--provider-agnostik-video-ve-ai)
  - [2.8 İçerik Üretim Hattı — üç katmanı besleyen tek motor](#28-i̇çerik-üretim-hattı--üç-katmanı-besleyen-tek-motor)
- [3. İç Müşteri Katmanı — Saha Ekibi (UTT + BM)](#3-i̇ç-müşteri-katmanı--saha-ekibi-utt--bm)
  - [3.1 Tüketim — izleme, puanlama, öneri](#31-tüketim--izleme-puanlama-öneri)
  - [3.2 Rapor & Analiz](#32-rapor--analiz)
    - [3.2.1 Rol bazlı raporlar (UTT / BM / TM / üretici / yönetici)](#321-rol-bazlı-raporlar-utt--bm--tm--üretici--yönetici)
    - [3.2.2 Analiz (kombinasyon + AI yorum)](#322-analiz-kombinasyon--ai-yorum)
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

**Üçüncü katman — Eczanem (Temmuz 2026).** Zincir bir halka daha uzadı: eczanenin **kendi müşterisi**. Eczacı, sözlü rızasını aldığı müşterisini telefonla davet eder; müşteri kendisine gönderilen ürün videosunu izleyip puan kazanır ve bu puanı aynı eczanede, aynı üründe TL indirimi olarak kullanır. Bu katman ne iç müşteridir ne E-Club kişisi — üçüncü bir kimlik düzleminde (telefon+OTP) yaşar, kendi puan-yaşlandırma modeli (180 gün + FIFO) ve kendi kasa akışı vardır. Aynı üretim motoru üçüncü hedefi de besler (`hedef_rol = eczanem`). Ayrıntı Bölüm 5'tedir; iş kuralları `docs/eczanem_is_plani_guncel.md`'de yaşar.

### 1.3 Öğrenme zinciri: üretim → tüketim → ölçüm → ödül

Her iki katman da aynı dört halkalı döngü üzerinde çalışır; katmanlar arasındaki fark, halkaların hangi yapılar ve roller üzerinden döndüğüdür.

**Üretim** — bilginin doğduğu yer. Sahaya inecek her içerik özenle hazırlanır, gözden geçirilir ve onaylanır (talep → senaryo → video → soru seti → yayın). Buradaki değer görünmezdir ama belirleyicidir: sahaya yanlış hiçbir şeyin inmemesini sağlar. Bu tek motor, hedeflenen role göre hem iç hem dış müşteri içeriğini üretir.

**Tüketim** — öğrenmenin gerçekleştiği an. İçerik izlenir, sorular çözülür, puan kazanılır. Amaç, öğrenmeyi bir zorunluluktan bir alışkanlığa çevirmek; ezberi değil anlamayı hedeflemek.

**Ölçüm** — görünmeyeni görünür kılmak. Kimin ne öğrendiği, kimin nerede desteğe ihtiyacı olduğu şeffaf biçimde ortaya konur. Ama bunu bir "denetim" soğukluğuyla değil, bir "gelişim aynası" sıcaklığıyla yapar; kimse karanlıkta kalmaz.

**Ödül** — emeğin takdir görmesi. Öğrenme emeği görülüp karşılık bulmadığında sürdürülemez. Ligler emeği bir toplulukta görünür kılar, mağazalar ise somut takdire dönüştürür. Buradaki rekabet bir baskı aracı değil, motivasyon kaynağıdır — herkes başkasıyla değil, dünkü kendisiyle yarışır.

Sonuçta ortaya çıkan bir yazılım değil bir kültürdür: öğrenmenin sürekli, adil, ölçülebilir ve karşılıklı olduğu bir kültür.

### 1.4 Raporun kapsamı ve okuma rehberi

Bu rapor HapBilgi'nin güncel teknik yapısını — veritabanı, backend ve frontend katmanlarını — belgeler. Ancak amaç yalnızca bir tablo, dosya ve endpoint listesi çıkarmak değil; sistemi kendi çalışma mantığına, yani iki müşteri katmanlı öğrenme ekosistemine sadık biçimde anlatmaktır. Bu nedenle rapor teknik envanteri modüllerin işlevi etrafında örgütler.

**Yapı.** Rapor iki müşteri katmanını omurga alır. Önce her iki katmanın üzerinde durduğu **ortak temel** (altyapı, kimlik, güvenlik, veri modeli felsefesi ve iki katmanı birden besleyen içerik üretim hattı) gelir. Ardından **iç müşteri katmanı** (saha ekibinin tüketim, rapor-analiz, challenge, lig ve store modülleri) ve **dış müşteri katmanı** (eczane tarafının E-Club modülleri) ayrı ayrı ele alınır. En sonda iki katmana birden hizmet eden **kesişen/operasyonel** konular (yönetim paneli, kalite-denetim altyapısı, dağıtım, açık işler) yer alır.

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
| Grafik | Recharts | 3.8.1 | Analiz/rapor grafikleri |
| Elektronik tablo | SheetJS (xlsx) | 0.18.5 | Excel dışa aktarma (firma yaşam döngüsü, E-Club Ligi) |
| Video CDN | Bunny.net | (SDK yok — env/HTTP) | Video barındırma ve oynatma |
| AI yorum | Provider-agnostik (Gemini vb.) | (SDK yok — env/HTTP) | Analiz sayfası AI yorumu |
| Dağıtım | Vercel | — | Production deploy |

**Yapılandırma notları.** Proje `reactCompiler: true` ile React Compiler'ı etkinleştirir; bunun dışında `next.config.ts` sade tutulmuştur. TypeScript tarafında `strict` mod açık, modül çözümlemesi `bundler`, ve `@/*` path alias'ı proje köküne işaret eder (`@/lib/...`, `@/components/...` importlarının temeli). Kök dizinde Next.js 16 middleware'i `proxy.ts` olarak bulunur (Edge değil, Node.js runtime) ve tüm erişim kontrolünün merkezidir (bkz. §2.4).

**Bağımlılık felsefesi — ince dış bağımlılık.** Dikkat çeken nokta, üçüncü taraf servislerin (Bunny.net video, AI sağlayıcıları) npm bağımlılığı olarak **bulunmamasıdır**. Bu servisler SDK ile değil, kendi soyutlama katmanları üzerinden env değişkenleri ve HTTP çağrılarıyla kullanılır (bkz. §2.7). Bu bilinçli tercih, sağlayıcı değişiminde uygulamayı bir kütüphaneye kilitlenmekten korur.

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

Sistemdeki tüm rol tanımları ve yetki kümeleri tek bir dosyada, `lib/utils/roller.ts` içinde merkezîleştirilmiştir. Bu, projenin temel mimari ilkelerinden biridir: bir rolün nereye erişebileceği kod içine dağılmış `if` kontrollerinde değil, adlandırılmış sabit listelerde tanımlanır. Yeni bir rol eklemek ya da bir yetkiyi genişletmek, ilgili listeye tek satır eklemekle tüm route ve sayfalara otomatik yansır.

**Üç kimlik düzlemi, tek geçerlilik listesi.** Roller, §2.2'deki kimlik ayrımını yansıtacak biçimde üç düzlemde yaşar. İç müşteri rolleri (`kullanicilar` tablosu) `TUM_ROLLER` altında toplanır ve kullanıcı doğrulamalarında "geçerli rol mü?" kontrolünün kaynağıdır. Dış müşteri rolleri (`eczaci`, `eczane_teknisyeni` — `ECLUB_TUKETICI_ROLLERI`) ve Eczanem müşterisi (`musteri` — `MUSTERI_ROLU`) ayrı tutulur ve **bilinçli olarak `TUM_ROLLER`'a dahil edilmez** — çünkü bu roller `kullanicilar` değil kendi tablolarında (`eclub_kisiler`, `eczanem_musteriler`) yaşar ve ayrı yetki düzlemlerine aittir.

**Hedef rol — kullanıcı rolü değil, içerik ekseni.** `talepler.hedef_rol` değerleri de `roller.ts`'te tek kaynaktır ama kavramsal olarak ayrıdır: bunlar kişilerin rolü değil, üretilen içeriğin hedef kitlesidir. `HedefRol` tipi beş değer alır (`utt`, `bm`, `eczaci`, `eczane_teknisyeni`, `eczanem`) ve DB CHECK constraint'iyle birebirdir. Eczanem hedefli talebi yalnız ürün müdürü ailesi açabilir (`ECZANEM_TALEP_ACAN_ROLLER` = pm/jr_pm/kd_pm — Bölüm 5.2).

**Temel rol grupları.** İç müşteri rolleri, hiyerarşideki konumlarına ve işlevlerine göre gruplanır:

| Grup | Roller | İşlev / hiyerarşi seviyesi |
|---|---|---|
| `URETICI_ROLLER` | pm, jr_pm, kd_pm, med_md, egt_md, egt_yrd_md, egt_yon, egt_uz, ik_drk, ik_md, ik_yrd_md, ik_uz, ik_per (13 rol) | İçerik üretir: talep açar, senaryo/video/soru seti onaylar, yayınlar (takım seviyesi) |
| `YONETICI_ROLLER` | gm, gm_yrd, drk, paz_md, blm_md, grp_pm, sm | Yönetici raporu + analiz erişimi (firma seviyesi) |
| `ADMIN_ROLLER` | admin | Tüm firmalar + admin paneli + tüm raporlar |
| `YONLENDIRICI_ROLLER` | tm, bm | UTT performansını izler/yönlendirir; öneri gönderir (TM takım, BM bölge) |
| `TUKETICI_ROLLER` | utt, kd_utt | Sahada video tüketir, soru cevaplar, puan kazanır (bölge seviyesi) |
| `IU_ROLU` | iu (tekil) | İçerik Uzmanı — talebe cevaben senaryo/video/soru seti üretir; firma bağımsız |

`URETICI_ROLLER`'ın "PM-merkezli" olmaktan çıkıp 13 rolü kapsaması, projenin geçirdiği önemli bir mimari dönüşümdür: içerik üretimi artık yalnızca Ürün Müdürü'nün değil, medikal, eğitim ve İK rollerinin de ortak akışıdır (üretici roller mimarisi). Her üretici rolün hangi talep türlerini açabileceği ayrı bir yetenek profili katmanında tanımlanır (bkz. §2.8).

**Türetilmiş / modül bazlı görünürlük kümeleri.** Temel grupların üzerine, her modülün "kim görür, kim erişir" kuralını tanımlayan türetilmiş kümeler kurulur. Bunlar temel grupları birleştirerek oluşturulur — yani tek kaynak korunur:

| Küme | Kapsam |
|---|---|
| `URETIM_HATTI_GORENLER` | Üretim hattı sayfaları (talepler/senaryolar/videolar/soru-setleri): üretici roller + İU |
| `ANALIZ_TUKETICI/URETICI/YONETICI_ROLLERI` | Analiz sayfası 3 kategorisi; `analizRolKategorisi()` helper'ı rolü kategoriye dispatch eder (İK hariç, admin yönetici sayılır) |
| `CCLIGI_GORENLERLER` | Challenge Club Ligi: BM (asıl) + TM/üretici/yönetici/admin (gözlemci) |
| `STORE_ALABILEN_ROLLER` | HBStore'dan puan harcayabilen: UTT/KD_UTT + BM |
| `STORE_GORENLERLER` / `STORE_GENEL_GOREN_ROLLER` | HBStore sipariş görüntüleme; kapsam role göre daralır (kendi / takım / firma) |
| `ECLUB_GOREN_ROLLER` | E-Club liste yönetimi: şimdilik UTT/KD_UTT (cascade ile BM/TM'e genişleyecek) |
| `ECLUB_LIGI_GOREN_ROLLER` | E-Club Ligi: UTT/KD_UTT + BM + TM |
| `ECLUB_STORE_RAPOR_GOREN_ROLLER` | E-Club Store raporu: UTT/KD_UTT + BM + TM (alışveriş yapmaz, rapor görür) |

Bu kümelerin ortak deseni, kapsamın role göre daralmasıdır: aynı sayfayı gören iki rol farklı genişlikte veri görür (UTT kendi verisini, BM bölgesini, TM takımını, yönetici tüm firmayı). Bu "aynı sayfa, rol-bağımlı kapsam" ilkesi §3 ve §4'teki modüllerde tekrar tekrar karşımıza çıkacaktır.

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

**İlke 3 — Tek kaynak.** Bir alan adına ait değer sistemde tek bir yerde tanımlanır ve her yer oradan okur. Puan miktarları (izleme puanı, öneri puanı vb.) koda gömülü sabitler değil, `sistem_ayarlari` tablosundaki anahtar-değer kayıtlarıdır (`anahtar`, `deger`). Örneğin öneri kaybı işleyen fonksiyon, kaybedilen puanı sabit `10` yerine `sistem_ayarlari`'ndan okur; değer değişirse tüm sistem tek satırla güncellenir. Aynı ilke rol tanımlarında (`lib/utils/roller.ts`, §2.3), firma kolon listesinde (`lib/firma/kolonlar.ts`, §6.1) ve puan kayıt mantığında (`lib/puan/`, §2.6) de geçerlidir. Tek kaynak ilkesi, bir kavramın iki yerde farklı tanımlanıp tutarsızlaşmasını yapısal olarak engeller. Tekrar Gönderim Modeli ile `sistem_ayarlari`'na üç anahtar daha eklendi (`tekrar_periyot_secenekleri`, `eclub_gonderim_araligi_gun`, `eclub_alici_haftalik_limit`; `deger` kolonu jsonb'dir, dizi değerler gerçek JSON dizisi olarak yazılır) ve tablo ilk kez kod tarafından da yazılır oldu: admin panelindeki Sistem Ayarları ekranı (§6.1) mevcut anahtarları günceller — yeni anahtar eklemek migration işidir.

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
| `lib/utils/anaSayfa/` | Ana sayfa veri katmanı — rol başına dosya (`bm`, `utt`, `tm`, `iu`, `uretici`, `yonetici` + `bmAktivite`). Eski tek dosya `anaSayfaVeri.ts` (542 satır, altı rolün fonksiyonu) bölünüp silindi; tek tüketici `app/ana-sayfa/api` doğrudan rol dosyalarından import eder. Üreticideki döngü-içi sıralı sorgu (N+1) deseni bilinçli olarak iyileştirilmeden taşındı — ayrı performans işidir (§6.4) |
| `lib/rapor/` | Rol bazlı rapor veri katmanı (`utt`, `bm`, `tm`, `uretici`, `yonetici` + `paylasilan`) |
| `lib/analiz/` | Analiz veri katmanı (aynı rol bölünmesi + `paylasilan` prompt/kombinasyon) |
| `lib/cc/` | Challenge Club (`izleme`, `puan`, `soru` alt katmanları) |
| `lib/eclub/` | E-Club iş mantığı (`store` alt katmanı dahil) |
| `lib/uretici/` | Üretici rol yetenek profilleri (§2.8) |
| `lib/hbligi/`, `lib/oneri/`, `lib/soru/`, `lib/zaman/` | Lig, öneri, soru seçimi, zaman/periyot yardımcıları |
| `lib/firma/`, `lib/store/`, `lib/video/`, `lib/utils/`, `lib/types/` | Firma kolonları, HBStore, video oynatıcı, ortak yardımcılar, tipler |

**Örnek desen — `lib/puan/`.** Puan katmanının dört dosyaya bölünmesi ayrımı somutlaştırır: `tipler.ts` (parametre tipleri), `strateji.ts` (izleme/extra kararı, eşik mantığı), `kayit.ts` (iç müşteri kazanım + kayıp INSERT fonksiyonları), `eclubKayit.ts` (dış müşteri karşılığı). İzleme akışındaki `bitir` route'u puanı kendisi hesaplamaz; `strateji.ts`'e "bu izleme puan getirir mi" diye sorar, sonra `kayit.ts`'in ilgili fonksiyonunu çağırır. Puan formülü yarın değişirse route'a dokunulmaz — yalnızca bu iki dosya güncellenir. Aynı ikizlik iç/dış müşteri arasında da korunur: `kayit.ts` ile `eclubKayit.ts` paralel yapıdadır, çünkü iki katman aynı öğrenme iskeletini ayrı düzlemlerde yaşar (§1.2).

**Rapor ve analiz'de tekrarlanan alt-desen.** `lib/rapor/` ve `lib/analiz/` altında her rolün kendi klasörü (`bm`, `tm`, `uretici`, `yonetici`, `utt`) ve bir `paylasilan/` klasörü bulunur. Bu, "her rol kendi veri kaynağından beslenir, ortak hesaplar tek yerde" ilkesinin klasör düzeyindeki karşılığıdır; ayrıntısı §3.2'de ele alınır.

### 2.7 Ortak servis soyutlamaları — provider-agnostik video ve AI

HapBilgi, dış servislere bağımlılığını iki soyutlama katmanıyla yönetir. Ortak felsefe şudur: tüketici kod belirli bir sağlayıcıya (Bunny.net, Gemini vb.) değil, bir *arayüze* bağlanır. Bu, §2.1'de not edilen "ince dış bağımlılık" tercihinin — sağlayıcı SDK'ları yerine kendi soyutlamaları — teknik karşılığıdır ve sistemi tek bir sağlayıcıya kilitlenmekten korur.

**Video oynatıcı — `lib/video/videoPlayer.ts`.** Video oynatma teknik detayları (script yükleme, `postMessage` protokolü, event isimleri, URL format dönüşümü) tüketici bileşenden (VideoOynatici) tamamen soyutlanır. Mimari üç parçadır:

- **`VideoPlayer` arayüzü** — tüm sağlayıcı adapter'larının uyduğu ortak sözleşme. Yedi metot tanımlar: `onReady`, `onTimeUpdate`, `onEnded`, `onSeeked`, `getDuration`, `getCurrentTime`, `setCurrentTime`, `destroy`. Sağlayıcıya özgü detaylar bu arayüzün arkasında gizlenir.
- **Adapter sınıfları** — her sağlayıcı için bir tane; şu an yalnızca Bunny.net aktiftir.
- **`createVideoPlayer(iframe, url)` fabrikası** — URL deseninden hangi sağlayıcı olduğunu tespit eder ve doğru adapter'ı kurar.

Yeni bir sağlayıcı (Mux, Cloudflare Stream, Vimeo, YouTube, JW Player, Wistia) eklemek üç adımdır: URL desenini tanıt, arayüzü uygulayan adapter'ı yaz, fabrikaya `case` ekle. VideoOynatici'ye hiç dokunulmaz. Bu genişleme noktaları dosyanın başında yorum olarak hazır bekler — ama kod yazılmamıştır; ilkesi, "test edilemeyen sağlayıcı için kod yazmak sahte güvence yaratır" olarak benimsenmiştir.

Soyutlamanın bir önemli tasarım notu: `onEnded` event'ı bazı sağlayıcılar tarafından her zaman gönderilmez. Bu yüzden tüketici kod, kritik iş mantığını (izleme tamamlandı mı) yalnızca sağlayıcının gönüllü event'ına bağlamaz; `timeupdate` + `duration` ile kendi manuel bitiş tespitini de yapar. İlke: kritik iş mantığı üçüncü taraf sağlayıcının davranışına emanet edilmez, sağlayıcı event'ları yalnızca yedektir.

**AI istemcisi — `lib/utils/aiIstemci.ts`.** Analiz sayfasındaki AI yorumu, sağlayıcı bağımsız bir servisten geçer. Dört sağlayıcı desteklenir (anthropic, openai, gemini, deepseek); seçim ve yapılandırma `.env.local` üzerinden yapılır (`AI_PROVIDER`, ilgili `_API_KEY` ve `_MODEL` değişkenleri). Sağlayıcı değiştirmek için kod değişikliği gerekmez — yalnızca env.

İstemcinin ikinci katmanı dayanıklılıktır: tüm sağlayıcı çağrıları `denemeliFetch()` sarmalayıcısından geçer. Geçici hatalarda (429, 500, 502, 503, 504 ve ağ hataları) exponential backoff ile otomatik yeniden deneme yapılır (3 deneme: 500ms, 1000ms); kalıcı hatalarda (400/401/403/404) yeniden deneme yapılmaz, ilk yanıt döner. Bu, bir AI sağlayıcısının geçici kesintisinin analiz sayfasını çökertmesini önler.

**Ortak ilke.** İki soyutlama da aynı deseni izler: sağlayıcıya özel her şey tek bir dosyada izole edilir, geri kalan sistem yalnızca arayüzü görür. Video tarafında bu bir sınıf hiyerarşisi (adapter), AI tarafında bir fonksiyon fabrikası (provider dispatch) olarak somutlaşır; ama mantık aynıdır — değişebilir olanı değişmez olandan ayırmak.

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

**`hedef_rol` — üç katmana dallanma noktası.** `talepler` tablosundaki `hedef_rol` kolonu, üretilen içeriğin hangi kitleye gideceğini belirler ve tek motorun katmanlara dallandığı yerdir. Beş değer alır: `utt` ve `bm` (iç müşteri), `eczaci` ve `eczane_teknisyeni` (dış müşteri), `eczanem` (eczanenin kendi müşterisi — Bölüm 5). Tip tanımı tek kaynaktır (`HedefRol`, `lib/utils/roller.ts`, §2.3) ve DB CHECK constraint'iyle birebirdir. Yayın tarafında bunun çoğul karşılığı `yayin_yonetimi.hedef_roller` dizisidir; bir yayın birden fazla role hedeflenebilir. Böylece aynı talep→senaryo→video→soru seti→yayın hattı, `hedef_rol`'e göre saha ekibine, eczane tarafına ya da eczane müşterisine açılır — ayrı bir üretim sistemi kurulmaz. Eczanem hedefli yayının farkları (tekrar periyodu NULL zorlaması, barkod+tarife zorunluluğu) Bölüm 5.2'dedir.

**`talepler` tablosunun zenginliği.** 20 kolonluk `talepler` tablosu, hattın yapılandırma merkezidir. Kimlik ve sahiplik (`talep_id`, `uretici_id`, `firma_id` — denormalize), hedefleme (`hedef_rol`, `icerik_turu`, `egitim_turu`), içerik bağı (`urun_id`, `teknik_id`), soru yapılandırması (`soru_seti_buyuklugu`, `video_basi_soru_sayisi`) ve özel akış bayrakları (`hazir_video`, `hazir_soru_seti`) burada tutulur. Not: `uretici_id` kolonu eski `pm_id`'nin yeniden adlandırılmış hâlidir — üretici rollerin PM'den 13 role genişlemesinin veri tabanındaki izidir.

**Üretici yetenek profili — kimin ne üretebileceği.** Hangi rolün hangi talep türünü açabileceği, hangi içerik türünü ürettiği, takıma bağlı mı yoksa firma kapsamlı mı çalıştığı koda gömülü `if`'lerle değil, tek bir dosyada — `lib/uretici/yetenekler.ts` — profil olarak tanımlanır. Bu dosya bilinçli olarak DB'de değil koddadır; gerekçesi dosyanın kendi başında açıkça yazılıdır: bu profiller Türkiye ilaç sektörünün rol hiyerarşisini ve HapBilgi'nin üretim hattı tasarımını yansıtır, firmadan firmaya değişmez. Bir firmaya özel yetenek özelleştirmesi, konfigürasyon değişikliği değil, platformun temel tasarımının dışına çıkmak (ayrı bir ürün) sayılır. Dosya üç katmanı ayırır: sektör katmanı (sabit) ve HapBilgi katmanı (sabit) kodda, firma katmanı (değişken) DB'de. Ayrıca içerik/görünürlük türevleri (`lib/video/icerikTuru.ts`, `gorunurluk.ts`) bu profilden türetilir — orada tekrar eden rol listesi yoktur (tek kaynak ilkesi).

**Tekrar gönderim — yayına almada tur.** Yayına alma anında üretici rol, yayın için bir tekrar periyodu seçebilir. Form dropdown'ı seçenekleri client sabitinden değil, `app/yayin-yonetimi/api/tekrar-secenekleri` endpoint'i aracılığıyla `sistem_ayarlari.tekrar_periyot_secenekleri` anahtarından alır (tek kaynak DB); "Tekrar yok" varsayılandır ve zorunlu alan değildir. Yayın INSERT'i `tekrar_periyot_gun` kolonunu taşır (ayar listesine karşı doğrulanır) ve INSERT'ten hemen sonra tur-1 kaydı `turKaydiAc()` ile açılır (`acilis_turu = ilk_yayin`, başlangıç = yayın tarihi); tur açılışı başarısız olursa yayın geri alınmaz, uyarı loglanır — `gecerliTur()` kendini onarma davranışıyla eksik tur-1'i sonradan tamamlar. Not: `tekrar_periyot_gun` değeri `v_yayin_detay` gibi view'lara eklenmez; tek doğru kaynağı `yayin_yonetimi`'dir (§3.3'teki CC vakasının dersi). Kritik karar: **tur takvimi durdurmadan bağımsızdır.** Yayını durdurup başlatmak `yayin_tarihi`'ni değiştirir ama tur başlangıcını değiştirmez — aksi hâlde durdur-başlat ile 15 günlük alt sınır delinip sınırsız puan turu açılabilirdi. Yayın geri açıldığında periyot dolmuşsa otomatik mekanizma yeni turu zaten açar.

**Tarih bazlı yayınlama (13.07.2026).** Yayına alma anında üretici rol, opsiyonel bir **yayın günü** seçebilir (boş = hemen yayın, bugünkü davranış). Gün seçilirse yayın `durum='planlandi'` ve `yayin_tarihi = seçilen gün 07:00` (Europe/Istanbul — puan penceresi açılışı) ile doğar; tüm tüketici sorguları `durum='yayinda'` süzdüğünden tarihi gelmemiş yayın hiçbir ekranda yapısal olarak görünmez ve "yayına bekleyenler" rozet sayımından düşer. Aktivasyon **tek kaynaktan** koşar: `yayin_planlananlari_aktive()` DB fonksiyonu (`scripts/sql/yayin_aktivasyon.sql`) durumu `yayinda`'ya çevirir, tur-1 kaydını açar ve hedef kullanıcılara "Yeni video yayında" bildirimlerini üretir — yani tur-1 ve bildirimler yayına almada değil aktivasyon anında doğar. Tetikleyici pg_cron'dur (`yayin_aktivasyon` job'ı, her gün 07:00 + 07:10 TR; `oneri_kaybi_tarama` ailesiyle aynı desen); fonksiyon mükerrer-korumalıdır (durum süzgeci + tur-1 `ON CONFLICT`). Planlanmış yayın "Yayında" sekmesinde **Planlandı** rozetiyle listelenir ve üç aksiyon tanır: Tarihi Değiştir, Hemen Yayınla (aynı fonksiyonu tek yayın için `p_yayin_id` ile çağırır — app'te aktivasyon kopyası yoktur), Planı İptal (kayıt silinir, video bekleme kuyruğuna döner); durdur/başlat aksiyonlarına kapalıdır. `durum` kolonunda CHECK olmadığından `planlandi` değeri migration gerektirmemiştir.

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

**Öneri mekanizması.** BM (bölgesindeki) ve TM (takımındaki) UTT'lere video izleme önerisi gönderir; öneri `oneri_kayitlari` tablosuna geçerlilik penceresiyle (`oneri_baslangic`, `oneri_bitis`) yazılır. Öneri iş kuralları `lib/oneri/` altında üç dosyaya ayrılır: `tarihKurali.ts` (geçerli tarih aralığı), `limitKontrol.ts` (kotalar — haftalık limit ve aylık kota, `MAKS_ALICI_HAFTA` gibi sabitler), `pencereKontrol.ts` (izleme anının öneri penceresinde olup olmadığı). Öneri listesi `get_oneri_listesi` RPC'siyle tek sorguda çekilir (N+1 önlenmiş) ve role göre farklı kapsam döner. Öneri döngüsü tüketimle kapanır: UTT öneriyi penceresi içinde izlerse öneri puanı kazanır (yukarıda); süresi geçer de izlemezse `oneri_kayip_kayitlari`'na kayıp düşer (§2.5 tablosu). Tekrar modeliyle birlikte, önceki turda izlenmiş bir video yeni turda yeniden önerilebilir ve penceresi içinde izlenirse izleme + cevaplama + öneri puanı doğal olarak yeniden doğar; kayıp simetrisi bozulmaz. Bu iş için öneri tarafında kod değişikliği gerekmemiştir: gönderme listesinde "izlenmemiş" süzgeci zaten yoktur (durum + hedef_rol filtresi) ve `get_oneri_listesi` süzgeç değil kayıt listesidir — davranış, `bitir` route'undaki dört tekillik sorgusunun tur bazına alınmasıyla kendiliğinden doğru işler.

**Üretim onay akışı ve bildirimler.** Tüketimin beslendiği içerik, §2.8'deki üretim hattından gelir; bu hattın operasyonel akışı — kimin ne zaman ne göreceği — bildirim ve badge sistemiyle yürür. Her aşamanın bir durum route'u vardır (`senaryolar/api/durum`, `videolar/api/durum`, `soru-setleri/api/durum`) ve hepsi aynı deseni paylaşır: geçerli durum sözlüğü (IU'nun set edebileceği durumlar ile üretici rolün set edebileceği durumlar ayrıdır), rol kontrolü, durum kaydı INSERT'i ve bildirim yönetimi. Bildirimler `lib/utils/bildirimOlustur.ts` ile oluşturulur; alıcısız geçişlerde (onay/iptal) `gonderenBildirimleriOkunduIsaretle()` ile gönderenin badge'i yeni bildirim üretmeden kapatılır. Badge'ler, kullanıcının okunmamış bildirimlerini periyodik olarak sorgulayan bir hook üzerinden Navbar'da görünür. Zincir yardımcıları (`lib/utils/talepZinciri.ts`) senaryo/video/soru seti kayıtlarından ilgili talebe ulaşmayı sağlar. Revizyon her aşamada sınırlıdır (maksimum iki revizyon), ve iki özel akış vardır: "hazır video" (senaryo aşaması atlanır) ve "hazır soru seti" (İU kendi yazmak yerine talepçinin verdiği seti işler); her ikisi de açıksa en kısa üretim akışı oluşur.

### 3.2 Rapor & Analiz

Öğrenme ölçülemezse geliştirilemez. Bu iki modül — Rapor ve Analiz — §1.3'teki "ölçüm" halkasının teknik karşılığıdır: kimin ne kadar öğrendiğini, nerede güçlü nerede desteğe ihtiyaç olduğunu görünür kılar. İkisi ayrı sayfalardır ve farklı sorulara cevap verir: Rapor "kim ne yaptı, kim nerede duruyor" (kişi/kapsam bazlı performans), Analiz ise "hangi değişken hangi sonucu üretiyor" (metrik kombinasyonu + yorum).

#### 3.2.1 Rol bazlı raporlar (UTT / BM / TM / üretici / yönetici)

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

#### 3.2.2 Analiz (kombinasyon + AI yorum)

Analiz modülü, raporun "kim ne yaptı" sorusunu bir adım öteye taşır: "hangi değişkenler bir araya geldiğinde hangi sonuç çıkıyor, ve bu ne anlama geliyor?" Kullanıcı, önceden tanımlı değişkenleri (pill'ler) seçer; sistem o kombinasyona karşılık gelen sayısal sonucu getirir, grafiğe döker ve bir AI yorumuyla yorumlar. Modül dört rol için ayrı sayfadan oluşur (`app/analiz/` altında `yonetici`, `uretici`, `tm`, `bm`); UTT/KD_UTT ve İK rolleri analiz sayfası görmez (kendi performanslarını rapor üzerinden görürler).

**Rol → sayfa dağılımı.** §2.3'teki `analizRolKategorisi()` helper'ı rolü üç kategoriye ayırır ve her kategori kendi sayfasına gider: yönetici (gm/gm_yrd/direktör vb. + admin, tüm firma), üretici (pm/med_md/egt_* — takım-bağlı olan kendi takımını, takım-bağımsız olan firmayı görür), TM (takımı) ve BM (bölgesi). Yönetici ve üretici hem üretim hem tüketim metriklerini görür; TM ve BM yalnızca tüketim görür (üretim varlığı bu roller için anlamlı değildir).

**DB tabanlı kombinasyon mimarisi — çekirdek karar.** Analiz'in en özgün yanı, hangi değişkenlerin var olduğu ve hangi kombinasyonların anlamlı olduğu bilgisinin koda değil **veritabanına** gömülü olmasıdır. Dört tablo bunu taşır:

| Tablo | İçerik |
|---|---|
| `analiz_uretim_degiskenleri` | Üretim tarafı pill'leri (`degisken_id`, `ad`, `sira`) |
| `analiz_uretim_kombinasyonlari` | Anlamlı üretim kombinasyonları (`degisken_idleri` uuid[], `boyut`, `tanim`, `tamamlayici_mi`) |
| `analiz_tuketim_degiskenleri` | Tüketim pill'leri (+ `alt_kategori` ile kazanım/kayıp ayrımı, `kombinasyon_havuzunda`) |
| `analiz_tuketim_kombinasyonlari` | Anlamlı tüketim kombinasyonları (aynı yapı) |

Bunun sonucu şudur: yeni bir pill veya kombinasyon eklemek için kod değişikliği gerekmez — DB'ye satır eklenir. Bir kombinasyon seçildiğinde, `degisken_idleri` dizisiyle eşleşen tanım ve grafik türü (`tamamlayici_mi` — tamamlayıcı metrik mi, bağımsız mı) DB'den okunur ve bu bilgi hem sorguya hem AI prompt'una beslenir. Bu erişim `lib/analiz/paylasilan/kombinasyonlar.ts` üzerinden yapılır.

**Sorgu akışı — kapsam + sorgu ikilisi.** Her rolün iki route'u vardır. `kapsam/route.ts` filtre dropdown'larını dolduran listeleri (takımlar, bölgeler, ürünler, UTT'ler, eğitim türleri) döndürür — role göre daralmış olarak (BM yalnızca kendi bölgesinin UTT'lerini görür). `sorgu/route.ts` ise seçilen kombinasyon + filtreler için sayısal sonucu üretir. Sonuç veri katmanı `lib/analiz/<rol>/get<Rol>AnalizData.ts`'te, kayıt-anı simetrisine sadık biçimde (kazanım tablosu + üç kayıp tablosundan SUM) hesaplanır. Kombinasyon tabloları rol-bağımsız paylaşımlıdır: aynı pill kombinasyonu BM için "bölgemdeki", TM için "takımımdaki", yönetici için "firmadaki" anlamına gelir — pill semantiği değişmez, bağlam değişir.

**AI yorum — paylaşımlı endpoint, rol-aware prompt.** Sonuç üretildikten sonra bir de metinsel yorum üretilir. Bu, tüm roller için tek paylaşımlı endpoint (`app/analiz/api/yorumla/route.ts`) üzerinden çalışır; ama prompt role duyarlıdır: `lib/analiz/paylasilan/promptOlustur.ts`, role (yönetici/üretici/TM/BM), kapsama, periyoda ve seçilen ürün/takım/bölge adlarına göre prompt'ı oluşturur, DB'den gelen kombinasyon tanımını yoruma katar. AI çağrısının kendisi §2.7'deki provider-agnostik `aiIstemci.ts` üzerinden gider (retry korumalı, sağlayıcı env ile seçilir). Sonuç, sayfadaki `SonucGrafigi` (Recharts çizgi/bar karma) ve `AiYorum` bileşenlerinde gösterilir.

**Ortak bileşen katmanı.** Dört rol sayfası, beş paylaşımlı bileşeni (`UretimKart`, `TuketimKart`, `FiltreBari`, `SonucGrafigi`, `AiYorum`) yeniden kullanır. Rol farkları prop'larla verilir: örneğin `FiltreBari`, sabit kapsam için opsiyonel prop'lar alır (TM'de takım kilitli, BM'de takım+bölge kilitli). Böylece dört sayfa aynı bileşen setinden, farklı kısıtlarla türer.

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

**Canlı hesap mimarisi — ayrı lig tablosu yok.** İki liginde de belirleyici tasarım kararı, sıralamanın önceden hesaplanıp saklanmaması, her sorguda kayıt tablolarından canlı üretilmesidir. HBLigi için bu `v_hbligi_sirali` view'ı üzerinden yürür: view, kayıt-anı simetrisine sadık biçimde `kazanilan_puanlar`'dan dört kazanım türünü (izleme/cevaplama/oneri/extra) ve üç kayıp tablosundan kayıpları toplar, net puanı (`toplam_puan`) çıkarır, kullanıcıyı firma/takım/bölge bilgisiyle birleştirir ve üç sıra kolonu (`firma_sirasi`, `bolge_sirasi`, `takim_sirasi`) üretir. Bunun sonucu tutarlılıktır: bir UTT'nin kendi raporundaki net puanı ile lig sıralamasındaki puanı **aynı kaynaktan** gelir, asla sapmaz. Çift sayım ya da gecikmeli snapshot sorunu yapısal olarak yoktur. Bu mimarinin Tekrar Gönderim Modeli'ndeki karşılığı sessiz ama önemlidir: puanlar tur bazlı çoğaldığında SUM'a dayalı tüm türetilmiş katmanlar — lig view'ları, rapor ve analiz veri katmanları (`getUttData.ts` dahil) — **kod değişikliği olmadan** doğru kalmıştır; yeni kayıtlar aynı tablolara aynı türlerle yazılır. Store bakiyelerinin puan artışıyla büyümesi ise iş modelinin doğal sonucudur, teknik sorun değildir.

**Periyot boyutu — parametreli RPC ailesi.** Lig, sabit bir "tüm zamanlar" sıralaması değildir; üç periyotta görülebilir. Her lig için üç RPC vardır: `get_hb_ligi_aylik`, `get_hb_ligi_donemlik`, `get_hb_ligi_yillik` (ve CC tarafında `get_cc_ligi_aylik/donemlik/yillik` + dönem/yıl lideri fonksiyonları). Sayfa bir periyot seçici sunar; seçime göre `lib/hbligi/ligRpcCagir.ts` doğru RPC'yi çağırır. Bu, "yarış çeyrekte (periyotta), takip anlık" ilkesini uygular: profil ve UTT raporundaki anlık puan tüm-zaman view'ından beslenirken, lig sıralaması seçilen periyodun penceresinden hesaplanır.

**Puan çeyrek-sıfırlaması ve kalan sipariş puanı.** Lig periyot mantığıyla ilişkili bir iş kuralı, puanların takvim çeyreği bazlı değerlendirilmesidir. UTT/BM raporlarında "Kalan Sipariş Puanı" gösterimi, periyottan bağımsız olarak anlık çeyrek bakiyesini yansıtır — bu, kazanılan puanın hem yarışmada (lig) hem ödülde (store bakiyesi, §3.5) nasıl kullanıldığının kesişim noktasıdır.

**Rol bazlı cascade görünüm.** HBLigi, §2.3'teki kapsam-daralması ilkesini lig sıralamasına uygular. Veri katmanı role göre bölünür (`lib/hbligi/` altında `getUttLig`, `getBmLig`, `getTmLig`, `getGenelLig`): UTT kendi takımını detaylı, diğer UTT'leri toplam olarak görür; BM bölge sıralamasını; TM takım-bölge kırılımını; yönetici/genel firma genelini. Sıralama düğümleri açıldıkça derinleşen bir cascade olarak sunulur. `lib/hbligi/agregasyonlar.ts` üst seviyelerin (bölge/takım toplamı) alt seviye satırlarından türetilmesini sağlar — ama her zaman aynı canlı kaynaktan.

**Challenge Club Ligi.** Aynı gelişim ruhunu yönetim katmanına taşır: BM'ler challenge performanslarında yarışır. `app/cc-ligi/` altında ayrı sayfa/route olarak durur, `cc_` puan tablolarından (§3.3) canlı hesaplanır ve `CCLIGI_GORENLERLER` kümesindeki rollere (BM asıl, TM/üretici/yönetici/admin gözlemci) açıktır. Periyot ve lider mantığı HBLigi ile aynı desendedir (aylık/dönemlik/yıllık + dönem/yıl lideri). Firma bazında `cc_aktif` kapalıysa lig de görünmez.

### 3.5 HBStore (iç ödül)

Firmanın kendi insanları da emeklerinin karşılığını hissetmelidir. HBStore, §1.3'teki "ödül" halkasının somut boyutudur: UTT, KD_UTT ve BM'in öğrenme yolculuğunda kazandıkları puanı fiziksel ürünlerle takdire dönüştürdüğü mağazadır. Öğrenmeyi bireysel bir yük olmaktan çıkarıp kazanıma bağlar — "öğrendikçe kazanıyorum".

**İki taraf — alışveriş ve izleme.** Modül `app/store/` altında iki yüzü barındırır. Alışveriş tarafı (vitrin `page.tsx`, ürün detayı `[urun_id]`, adres yönetimi `adreslerim`, kendi siparişleri `siparislerim`) puan harcayabilen roller (`STORE_ALABILEN_ROLLER`: UTT/KD_UTT + BM) içindir. İzleme tarafı (`siparisler/`, filtreli tablo + hiyerarşi) ise başkalarının siparişlerini kapsam dahilinde gören roller (`STORE_GENEL_GOREN_ROLLER`) içindir: BM bölgesindeki, TM takımındaki, üretici/yönetici firma genelindeki siparişleri görür. Bu yine §2.3'teki kapsam-daralması ilkesidir.

**Beş tablo.** Mağazanın veri modeli beş tablodan oluşur:

| Tablo | Rol |
|---|---|
| `store_kategoriler` | Ürün kategorileri (`ad`, `sira`, `aktif_mi`) |
| `store_urunler` | Ürünler (`puan_fiyati`, `stok`, `gorsel_url`, `aktif_mi`) |
| `store_adresler` | Kullanıcı teslimat adresleri (`varsayilan_mi`) |
| `store_siparisler` | Siparişler (`adet`, `toplam_puan`, `durum`, kargo bilgisi, `adres_snapshot`) |
| `store_puan_harcamalari` | Puan harcama kayıtları (`puan_miktari`, `tur`, `siparis_id`) |

Dikkat çeken iki tasarım detayı: `store_siparisler.adres_snapshot` sipariş anındaki adresi jsonb olarak dondurur (adres sonradan değişse bile sipariş kaydı bozulmaz), ve harcama ayrı bir tabloda (`store_puan_harcamalari`) tutulur — bu, kayıt-anı simetrisinin (§2.5) ödül tarafındaki karşılığıdır: puanın kazanımı ayrı, harcaması ayrı kayıtta durur.

**Bakiye — çeyrek penceresi.** Harcanabilir puan (sipariş bakiyesi), `get_harcama_bakiyesi` RPC'siyle hesaplanır. Kritik iş kuralı: bakiye, tüm-zaman puanı değil, takvim çeyreği penceresindeki kazanımdan harcamaları düşen anlık değerdir. Bu §3.4'teki "yarış çeyrekte, takip anlık" ilkesiyle uyumludur ve UTT/BM raporlarındaki "Kalan Sipariş Puanı" gösterimini besler. Puanın hem yarışmada (lig) hem ödülde (store) değerlendirilmesi bu çeyrek penceresi üzerinden koordine edilir.

**Sipariş yaşam döngüsü — atomik RPC'ler.** Sipariş işlemleri, tutarlılık gerektirdiği için tek tek atomik RPC'lerle yürür (`lib/store/` orkestrasyonu üzerinden):

- `store_siparis_olustur` — stok kilidi + bakiye kontrolü + adres snapshot + sipariş kaydı + puan düşme + stok azaltma, hepsi tek atomik işlemde.
- `store_siparis_iptal` — stok iadesi + durum güncelleme (harcama kaydı iptal mantığıyla bakiyeye geri döner).
- `store_teslim_aldim` — kargodaki siparişi teslim edildi olarak işaretler.

İzleme tarafı için `get_kapsamli_siparisler` (role göre kapsamlı sipariş listesi) ve `get_siparis_filtre_hiyerarsi` (filtre dropdown'ları için takım/bölge hiyerarşisi) RPC'leri kullanılır. Lib katmanı bunları domain'lere böler: `bakiye.ts`, `siparis.ts`, `adres.ts`, `kargo.ts`, `storage.ts` (ürün görselleri), `sabitler.ts`, `tipler.ts`.

**Firma bazlı aç/kapa.** HBStore firma düzeyinde `hbstore_aktif` bayrağıyla açılıp kapatılır; kapalı firmada hiçbir kullanıcı (ne alışveriş yapan ne izleyen) mağazaya erişemez — proxy bekçisi (§2.4) ve Navbar görünürlük gizlemesi birlikte çalışır.

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

**Görünürlük ve açık iş.** Şu an listeyi yalnızca ekleyen UTT görür (`ECLUB_GOREN_ROLLER`: utt/kd_utt). BM/TM'in altındaki UTT'lerin listelerini görebildiği cascade liste görünümü henüz kurulmamıştır; bu bir açık iştir (§6.4). Not: bu cascade, §4.4'teki E-Club Ligi cascade'inden ayrıdır — biri liste yönetimi, diğeri sıralama tarafıdır.

### 4.2 E-Club — Öneri ve tüketim (izleme/puanlama)

Dış müşteri öğrenmesi, UTT'nin bir videoyu bir kişiye (eczacı/teknisyen) önermesiyle başlar ve kişinin o videoyu izleyip sorularını çözmesiyle tamamlanır. Bu, §3.1'deki UTT tüketim akışının dış müşteri düzlemindeki karşılığıdır — aynı iskelet, `eclub_` tabloları üzerinde.

**Öneri akışı — UTT → kişi.** UTT, `app/eclub/oneriler/` üzerinden bir yayını seçili kişiye önerir. Öneri `eclub_oneri_kayitlari` tablosuna yazılır: `oneren_id` (UTT — `kullanicilar`), `kisi_id` (alıcı — `eclub_kisiler`), `yayin_id`, geçerlilik penceresi (`oneri_baslangic`, `oneri_bitis`) ve `izlendi_mi`. Yayın seçimi `hedef_rol` filtresiyle sınırlıdır: yalnızca `eczaci`/`eczane_teknisyeni` hedefli yayınlar önerilebilir (§2.8). Öneri iş kuralları (kredi/kota, tekrar penceresi, alıcı limiti) UTT tarafındaki mantığa paralel çalışır; modül `OneriGonder` ve `OneriGecmisi` bileşenleriyle gönderme ve geçmiş görüntülemeyi sunar. Kişi-koruma kurallarının iki değeri artık koda gömülü sabit değildir: aynı UTT→aynı kişi gönderim aralığı `sistem_ayarlari.eclub_gonderim_araligi_gun`'den, kişinin haftalık toplam kabul limiti `eclub_alici_haftalik_limit`'ten okunur (`lib/eclub/oneriLimit.ts`; okuma hatasında varsayılan sabitlere güvenli geri düşüş — akış kilitlenmez, fonksiyon imzaları değişmemiştir). Bu değerler admin'in Sistem Ayarları ekranından (§6.1) yönetilir ve **tüm firmalara aynı** uygulanır — alıcıyı koruyan kurallar firma rekabetine alet edilmez, firma bazlı frekans farklılaştırması yapılmaz. Kapsam sınırı bilinçlidir: öneri süresi (7 günlük kazanım penceresi) ve aylık kredi sabit kalmıştır. Video-bazlı tur kuralı bu kuralların üstüne gelir; iki mekanizma farklı işler görür (spam koruması ≠ içerik yenileme).

**Tüketim akışı — kişi paneli.** Kişi, kendisine önerilen videoları `app/eclub/panel/` üzerinden izler. Panel API'si dört adımdan oluşur (UTT akışının paraleli): `baslat` (izleme kaydı — `eclub_izleme_kayitlari`, `izleme_turu = 'oneri'`), `sorular` (setten rastgele soru seçimi, doğru cevap sızdırılmadan), `cevapla` (her cevap), `bitir` (izleme tamamlama + puanlama). Video oynatma §2.7'deki provider-agnostik oynatıcıyla (`EclubVideoOynatici`) yapılır. Kişi yalnızca kendine önerilen ve `hedef_rol`'ü kendi rolüne uyan yayınları görür (çift filtre).

**Puanlama — kayıt-anı simetrisinin dış karşılığı.** Puan yazımı `lib/puan/eclubKayit.ts`'te dört fonksiyonla yapılır ve §2.5 ilkesini birebir izler:

| Fonksiyon | Tablo | Karşılığı |
|---|---|---|
| `eclubPuanKaydet` | `eclub_kazanilan_puanlar` | izleme kazanımı |
| `eclubDogruCevapKaydet` | `eclub_dogru_cevap_kayitlari` | cevaplama kazanımı |
| `eclubYanlisCevapKaydet` | `eclub_yanlis_cevap_kayitlari` | yanlış cevap kaybı |
| `eclubUttPuanKaydet` | `eclub_utt_puanlari` | UTT koçluk puanı (+10) |

Her kayıt `urun_id` denormalizasyonunu taşır (§2.5, İlke 2); `urun_id`, `get_urun_from_yayin()` ile çözülür. Süre penceresi kuralı da geçerlidir: öneri süresi geçmişse izleme kaydedilir ama puan verilmez.

Tekrar Gönderim Modeli bu düzlemde de geçerlidir: `bitir` route'undaki `ilkIzleme` kontrolü tur bazına alınmıştır (`gte` tur başı; `gecerliTur()` + güvenli geri düşüş). Yeni turda yapılan yeni öneriyle kişinin izleme ve cevaplama puanı ile öneriyi gönderen UTT'nin +10 GönderiPuanı kendiliğinden yeniden doğar — GönderiPuanı aynı ilk-izleme koşuluna bağlı olduğundan ayrı bir dokunuş gerekmemiştir. `cevapla` route'una dokunulmamıştır: tekilliği `izleme_id` bazlıdır ve yeni turda yeni izleme kaydıyla cevaplama puanı + doğru/yanlış cevap kayıtları simetrik biçimde yeniden doğar; süre kontrolü öneri penceresine bağlıdır, tur bilmez. Önerilebilirlik "bu turda önerildi mi" sorusudur.

**İç müşteriden iki fark.** Dış müşteri tüketimi UTT akışının kopyası olsa da iki bilinçli fark taşır. Birincisi, **kayıp modeli daha sadedir**: yanlış cevap kaybı ve öneri kaybı (`eclub_oneri_kayip_kayitlari`) vardır, ama Challenge Club kaybı gibi kavramlar yoktur — dış müşteri düzleminde challenge yoktur. İkincisi ve en özgünü, **UTT koçluk puanı (GönderiPuanı)**: bir kişi önerilen videoyu izlediğinde, öneriyi gönderen UTT'ye +10 puan yazılır (`eclub_utt_puanlari`). Bu, iç müşteride bulunmayan, dış müşteri katmanına özgü bir mekanizmadır — temsilciyi "içerik gönderen"den "öğrenme koçu"na dönüştürür. Bu puanın ayrı bir tabloda tutulmasının teknik nedeni, kişinin izlemesinin iç müşteri izleme kayıtlarına FK ile bağlanamamasıdır; ayrı tablo hem bu bütünlük sorununu çözer hem de koçluk gelirini temiz biçimde ayırır. GönderiPuanı'nın lig tarafındaki rolü §4.4'te ele alınır.

### 4.3 E-Club — Kimlik, bildirim, kişi paneli

Dış müşterinin sisteme girişi, iç kullanıcılardan farklı bir yol izler: eczacı/teknisyen kendini kaydetmez, UTT tarafından sisteme eklenir ve sonradan bir giriş kimliği kazanır. Bu bölüm o kimlik köprüsünü, kişinin gördüğü paneli ve bildirim mekanizmasını ele alır.

**Kimlik köprüsü — `v_auth_kimlik`.** §2.2'de tanıtılan birleşik kimlik view'ı burada işlevini gösterir. AuthProvider, giriş yapan herkesi tek sorguyla `v_auth_kimlik`'ten çözer ve `kimlik_turu` kolonuna bakar: `'kullanici'` ise iç müşteri, `'eclub_kisi'` ise dış müşteri. Buna göre kişi giriş sonrası kendi paneline (`/eclub/panel`) yönlendirilir; iç kullanıcıların firma-aktiflik kontrolü kişiyi atlar (kişinin `firma_id`'si yoktur, çok firmalıdır). Kişi ekleme akışı (`listem/api/kisiler`) auth kaydını oluşturur: `auth.admin.createUser` ile bir auth kullanıcısı açılır, `eclub_kisiler.auth_user_id`'ye bağlanır; herhangi bir adım başarısız olursa rollback yapılır. `auth_user_id`'nin nullable olması (§2.2), kişinin giriş kimliği kazanmadan da listeye eklenebilmesini sağlar.

**Geçici auth ve OTP açık işi.** Şu anki giriş modeli geçicidir: UTT kişi için e-posta + şifre belirler, kişi bununla girer. Hedeflenen gerçek akış — kişiye tek kullanımlık kod (OTP) + giriş linki, ilk girişte zorunlu şifre değiştirme — henüz kurulmamıştır; bu bir açık iştir (§6.4). Ayrıca bir güvenlik inceliği: `v_auth_kimlik` view'ı, giriş yapan her kullanıcının yalnızca kendi kimlik satırını görebilmesi için `auth.uid()` filtresiyle daraltılmıştır (aksi halde birleşik view tüm kimlikleri sorgulanabilir kılardı).

**Kişi paneli.** Kişi, `app/eclub/panel/` üzerinden yalnızca kendine önerilen videoları ve izleme akışını görür (§4.2). Panel API'si (`panel/api/route.ts`) giriş yapan kişiyi çözer, `kisi_id`'sine bağlı aktif önerileri yayın detaylarıyla birlikte döndürür. Panel bilinçli olarak sadedir — dış müşteri için karmaşık bir arayüz değil, "sana önerilen videolar burada, izle" netliği hedeflenir.

**Bildirim.** UTT bir öneri gönderdiğinde, kişiye bir bildirim yazılır: `eclub_bildirimler` tablosuna (`alici_kisi_id`, `gonderen_id`, `kayit_turu`, `mesaj`, `goruldu_mu`) `lib/utils/eclubBildirim.ts` üzerinden kayıt düşülür (tekil ve çoklu bildirim fonksiyonları). Mevcut durumun dürüst tespiti: **bildirim yazılıyor ama kişi tarafında henüz gösterilmiyor.** Öneri zaten panelde göründüğü için ayrı bir zil/rozet gösterimi kurulmamıştır; okundu işaretleme mekanizması ve harici kanal (WhatsApp/SMS) bildirimi de henüz yoktur. Bunlar açık işlerdir (§6.4). Yani altyapı (tablo + yazım) hazırdır; görüntüleme katmanı eksiktir.

### 4.4 E-Club Ligi (UTT koçluk sıralaması, GönderiPuanı)

E-Club Ligi, iç müşteri liglerinin (§3.4) dış müşteri düzlemindeki karşılığıdır — ama kritik bir kavramsal farkla. Bu lig, **eczacıların kendi aralarında yarıştığı bir sıralama değildir.** Yarışan, eczacıya rehberlik eden UTT'dir. Yani E-Club Ligi bir "öğrenme koçluğu" ligidir: hangi UTT, önerdiği içeriklerle dış müşterisini ne kadar öğrenmeye yönlendirdi? Bu, temsilciyi "içerik gönderen"den "öğrenme koçu"na yükselten §4.2'deki GönderiPuanı fikrinin sahnesidir.

**Sıralamanın temeli — GönderiPuanı.** Ligin ana metriği, UTT'nin dış müşterisinin izlemesiyle kazandığı koçluk puanıdır. Bir kişi önerilen videoyu izlediğinde öneren UTT'ye +10 puan yazılır (`eclub_utt_puanlari`, §4.2). Sıralama bu GönderiPuanı ile birlikte, kişilerin izleme ve doğru cevap performansını da yansıtır. Böylece bir UTT'nin lig sırası, kendi izlemesiyle değil, dış müşterisini öğrenmeye ne kadar iyi yönlendirdiğiyle belirlenir.

**İki katmanlı RPC ailesi.** Lig verisi iki düzeyde, her biri üç periyotta (aylık/dönemlik/yıllık) çekilir:

- **UTT toplam** (`get_eclub_ligi_utt_aylik/donemlik/yillik`) — sıralama satırları: her UTT'nin toplam koçluk performansı.
- **Kişi + ürün detay** (`get_eclub_ligi_detay_aylik/donemlik/yillik`) — bir UTT açıldığında, o UTT'nin dış müşterilerinin ürün bazında dökümü.

Bu ayrım (özet + detay), lig sayfasının performans dostu şekilde önce toplamı gösterip, kullanıcı bir UTT'yi açtığında detayı lazy-load etmesini sağlar. Periyot seçimi ve RPC dispatch `lib/eclub/ligRpcCagir.ts` üzerinden yapılır — §3.4'teki HBLigi `ligRpcCagir` deseninin ikizi.

**Rol bazlı cascade.** Lig, `ECLUB_LIGI_GOREN_ROLLER` (utt/kd_utt + bm + tm) rollerine açıktır ve §2.3'teki kapsam-daralması ilkesini uygular: UTT kendi koçluk performansını ve dış müşteri detayını görür; BM bölgesindeki UTT'leri; TM takımındaki UTT'leri. Sayfa (`app/eclub/ligi/page.tsx` + `useEclubLigi` hook) bu cascade'i düğüm açıldıkça derinleşen bir yapıda sunar.

**Takım adı ve dışa aktarma.** İki yardımcı özellik ligi tamamlar. `eclub_takim_adlari` tablosu, UTT'nin kendi dış müşteri "takımına" verdiği adı tutar (`app/eclub/ligi/api/takim-adi`) — böylece koçluk sıralaması kişisel bir kimlik kazanır. Ayrıca `api/export` endpoint'i, görülen kapsamı Excel'e (SheetJS, §2.1) döker; her lig gören rol kendi kapsamını indirir. Firma bazında `eclub_aktif` kapalıysa lig görünmez (proxy bekçisi + Navbar, §2.4).

**Canlı hesap.** İç müşteri ligleri gibi, E-Club Ligi de ayrı bir sıralama tablosu tutmaz; `eclub_kazanilan_puanlar`, `eclub_dogru_cevap_kayitlari` ve `eclub_utt_puanlari` tablolarından periyot penceresiyle canlı hesaplanır. Tutarlılık ve anlık takip aynı kaynaktan gelir (§2.5).

### 4.5 E-Club Store (dış ödül, çok-firmalı bakiye)

E-Club Store, dış müşterinin öğrenme emeğinin karşılık bulduğu mağazadır — §3.5'teki HBStore'un dış müşteri katmanındaki ikizi. Kişi, izleme ve doğru cevaplarla kazandığı puanı ürünlere dönüştürür. Modül `app/eclub/store/` altında yaşar: vitrin (`page.tsx`), adres yönetimi (`adreslerim`), kendi siparişleri (`siparislerim`) kişi tarafını; `rapor/` ise UTT/BM/TM'in kimin ne aldığını gördüğü izleme tarafını oluşturur.

**Yapısal paralellik, tek kritik fark.** Beş tablo HBStore'un birebir karşılığıdır (`eclub_store_kategoriler`, `urunler`, `adresler`, `siparisler` — aynı kolon deseni, `kisi_id` ile). Ama bir tablo fazladır ve bu fazlalık E-Club Store'un asıl mimari sorununu çözer: `eclub_store_siparis_firma_puan` (`siparis_id`, `firma_id`, `kullanilan_puan`). Bu tablonun varlığı, dış müşterinin **çok firmalı** olmasının (§1.2) ödül tarafındaki doğrudan sonucudur.

**Çok-firmalı bakiye — puanın kaynağı firmaya bağlı.** Bir kişinin puanı tek bir havuzda değil, firma bazında ayrı ayrı birikir: `eclub_kazanilan_puanlar.urun_id`, ürün üzerinden `firma_id`'ye çözülür (§2.5, İlke 2), yani bir kişinin kazandığı her puan hangi firmanın içeriğinden geldiği bilinerek tutulur. `get_eclub_store_firma_bakiye` RPC'si, bu şekilde kişinin **firma bazında ayrıştırılmış** bakiyesini döner ve sorgu yalnızca `eclub_store_aktif = true` olan firmaları kapsar — bir firma modülü kapatırsa o firmanın puanı bakiyede görünmeye devam etmez.

**Sipariş anında birleştirerek harcama.** Kişi sipariş verdiğinde, ürünün puan fiyatı tek bir firmanın bakiyesini aşabilir. `eclub_store_siparis_olustur` RPC'si bu durumu firma bakiyelerini **yüksekten düşüğe sıralayıp birleştirerek** çözer: gereken puan, en yüksek bakiyeli firmadan başlayarak sırayla düşülür, her düşülen miktar `eclub_store_siparis_firma_puan`'a ayrı satır olarak yazılır. Böylece tek bir sipariş, birden fazla firmanın puanından beslenmiş olabilir — ama her firmanın payı ayrı ayrı, denetlenebilir biçimde kayıt altındadır. Bu, §2.5'teki kayıt-anı simetrisi ilkesinin çok-firmalı bir varyasyonudur: harcama anında hangi kaynaktan ne kadar alındığı donar.

**Sipariş yaşam döngüsü.** Geri kalan akış HBStore ile aynıdır: `eclub_store_siparis_olustur` (stok + bakiye kontrolü + adres snapshot + firma_puan dağılımı, atomik), `eclub_store_siparis_iptal` (stok iadesi + firma bazlı puan iadesi), `eclub_store_teslim_aldim`. Lib katmanı `lib/eclub/store/` altında `eclubStoreBakiye.ts`, `eclubStoreSiparis.ts`, `eclubStoreStorage.ts` (ürün görselleri), `eclubStoreTipler.ts` olarak sadeleşmiş biçimde durur.

**Rapor — firma payına göre görünürlük.** `app/eclub/store/rapor/` sayfası, kimin ne aldığını gösterir; ama görünürlük firma sınırlıdır. Bir firmanın yetkilisi (UTT/BM/TM, `ECLUB_STORE_RAPOR_GOREN_ROLLER`) yalnızca **kendi firmasının payına düşen** harcamayı görür — bir siparişin diğer firmalardan gelen kısmı ona görünmez. Admin ise tüm firmaların tam resmini görür (§6.1). Bu, `eclub_store_siparis_firma_puan`'ın raporlamadaki asıl faydasıdır: çok-firmalı bir siparişi, her firmanın kendi gördüğü kısma bölebilmek.

---

## 5. Üçüncü Müşteri Katmanı — Eczanem (Eczanenin Kendi Müşterisi)

Eczanem, Temmuz 2026'da eklenen üçüncü müşteri katmanıdır ve ekosistemin zincirini bir halka daha uzatır: eczanenin **kendi müşterisi** (hasta/danışan), eczanesinin gönderdiği ürün videosunu izler, puan kazanır ve bu puanı **aynı eczanede, aynı üründe** TL indirimi olarak kullanır. İş kuralları ve gerekçeler iki canlı belgede yaşar: işleyiş belgesi (`docs/eczanem_is_plani_guncel.md` — "İP") ve teknik iş planı (`docs/eczanem_teknik_is_plani.md` — KONTROL bulguları, kapalı kararlar, U0–U12 durum takibi). Bu bölüm mimari özeti verir; kural ayrıntısı oraya bırakılır.

Katman beş yeni yapı taşı getirmiştir: **(a)** üçüncü kimlik düzlemi (telefon+OTP), **(b)** sistemdeki ilk puan-yaşlandırma modeli (180 gün kayan pencere + FIFO harcama), **(c)** atomik düşüm RPC'si, **(d)** üretim hattında üçüncü hedef (`eczanem`), **(e)** proxy'de altıncı bekçi. Modül bağımsızdır ve kendi kökünde yaşar: müşteri paneli `/eczanem`, eczacı tarafı `/eczanem/eczane` (E-Club oturumuyla girilir ama yol E-Club prefix'inde değildir — modül bağımsızlığı kararı), UTT dağıtım ekranı `/eczanem/utt`. İş mantığının tamamı `lib/eczanem/` tek-kaynak ailesindedir (`otp`, `oturum`, `telefon`, `davet`, `silme`, `tarife`, `gonderim`, `kazanim`, `kasa`, `dokum`); route'lar yalnızca auth + orkestrasyondur (§2.6 ilkesi). Veri modeli 11 yeni `eczanem_*` tablosudur (`eczanem_giris_otp` dahil — B-14 düzeltmesi); parasal üçlü (`eczanem_puan_kayitlari`, `eczanem_harcama_kayitlari`, `eczanem_siparisler`) + `eczanem_urun_tarifeleri` korumalı tablolardır (`lint:mimari` yazımı `lib/eczanem/` dışında engeller, §6.2).

### 5.1 Kimlik ve üyelik — telefon+OTP, davet, KVKK tam silme

**Üçüncü kimlik düzlemi.** Müşteri `eczanem_musteriler`'de yaşar (tek kişi = tek telefon, UNIQUE); eczane bağı `eczanem_uyelikler` ile çokludur (aynı kişi farklı eczanelerde üye olabilir; her bakiye kendi eczanesine kilitli). `kullanicilar` ve `eclub_kisiler`'den sonra üçüncü düzlem olarak `v_auth_kimlik`'e UNION'landı; `rolCozucu` artık `"musteri"` dönebilir (`MUSTERI_ROLU`, bilinçli olarak `TUM_ROLLER` dışında — §2.3 deseni).

**OTP mimarisi (K1 kararı).** Supabase native phone auth DEĞİL — custom OTP tablosu (`eczanem_giris_otp`) + Supabase session: SMS sağlayıcısını Supabase'e bağlamak K-E1 kararını bloklar ve ince-bağımlılık felsefesine (§2.1) aykırı olurdu. Oturum üretimi `auth.admin.generateLink(magiclink)` → SSR `verifyOtp(token_hash)` → çerez; müşteri auth kaydı sentetik e-posta ile açılır, `eczanem_musteriler.auth_user_id` bağı kendini-onarandır. SMS gönderimi provider-agnostik `lib/sms/gonderici.ts`'tedir (§2.7 deseni); sağlayıcı seçimi (K-E1) canlıya çıkışın tek gerçek blokörüdür. **Test modu (K-E8):** canlı-dışı her ortamda SMS'siz sabit kod `123456` geçerlidir; çift kilit (`lib/utils/ortam.ts` — `VERCEL_ENV`/`NODE_ENV`) sabit kodu production'da yapısal olarak devre dışı bırakır, "kaldırmayı unutma" riski yoktur.

**Davet akışı (İP-§3).** Üyelik yalnızca eczacının davetiyle başlar: eczacı ad-soyad + telefon girer, müşteriye SMS ile kod gider, müşteri `/eczanem/davet`'te KVKK onayı + kodla üye olur. Doğrulamalar server'dadır: davet telefonu o eczanenin eczacı/teknisyen telefonlarıyla çakışamaz (İP-§3.4), süresi dolan davet sorgu-anında geçersizdir, deneme sınırı vardır. Ad-soyad yalnızca davet anında girilir; **hiçbir görüntüleme katmanında gösterilmez** (eczacı ekranları dahil her yerde telefon son-4-hane).

**KVKK tam silme (K-E5).** Sistemdeki ilk gerçek fiziksel silme akışı: OTP teyitli silmede müşteri satırı, auth kaydı, üyelikler, gönderimler, davetler, izleme ve puan kayıtları **fiziksel silinir**; yalnızca parasal tarihçe (sipariş + harcama) mutabakat dayanağı olarak kalır — `musteri_id` NULL'lanır, satır "Eczane X Müşteri N" anonim etiketine döner. Mutabakat toplamları bozulmaz, kişi verisi kalmaz. ("Fiziksel DELETE yok" felsefesinin (§2.5) bilinçli istisnasıdır; yasal gereklilik tasarım ilkesinin önündedir.)

### 5.2 Üretim ve dağıtım — eczanem hedefi, tarife, iki kademeli gönderim

**Üretim hattı değişmedi, hedef genişledi.** Talep→senaryo→video→soru seti→yayın zinciri (§2.8) aynen kullanılır; `hedef_rol` beşinci değeri `eczanem`'i aldı ve tip tek kaynağa bağlandı (`HedefRol`, `lib/utils/roller.ts` — eski `TakipSatiri` dar tipi borcu bu işle kapandı). Eczanem hedefli talebi yalnızca ürün müdürü ailesi açabilir (`ECZANEM_TALEP_ACAN_ROLLER` = pm/jr_pm/kd_pm; İP-§4.1) — Karşılık tanımı PM'in ürün maliyet kararıdır. Talep üründen bağımsız olamaz (dörtlü kilidin tohumu), teknik alanı zorlanmaz.

**Yayına almada barkod + Karşılık (K-E3).** Eczanem hedefli yayında tekrar periyodu / extra puan / ileri sarma alanları gizlenir ve server'da NULL'a zorlanır (İP-§4.4 — tur modeli bu katmanda yoktur); yerine barkod + Karşılık (puan=TL) zorunludur. Saklama ürün seviyesindedir: `urunler.barkod` + `eczanem_urun_tarifeleri` append-only tarihçe (güncel tarife = max(gecerlilik_baslangic ≤ now); değer değişmediyse satır açılmaz; yeni tarife yalnız ileriye işler — "müşteri aleyhine değişmez"). Tarife yayından ÖNCE yazılır: canlı yayının daima tarifesi vardır.

**İki kademeli dağıtım, yapısal teklik (İP-§5).** Video müşteriye iki adımda ulaşır: UTT → eczane (`eczanem_eczane_gonderimleri`, UNIQUE(yayin_id, eczane_id)) ve eczacı → müşteri (`eczanem_gonderimler`, UNIQUE(yayin_id, musteri_id) — **ömür boyu teklik**, E-Club'ın tur bazlı modelinden bilinçli farklı). UTT yalnızca kendi bağladığı eczanelere (`eclub_eczane_firma.baglayan_utt_id`) ve yalnızca aktif üye eşiğini (`sistem_ayarlari.eczanem_aktif_uye_esigi`) geçen eczanelere gönderebilir; eşik server'da yeniden doğrulanır. Eczacı tekil/toplu gönderir; UNIQUE çakışmaları sessizce atlanır. Firma bayrağı `firmalar.eczanem_aktif` (beşinci modül anahtarı) UTT ekranlarını açıp kapatır.

### 5.3 Tüketim ve puan — kayıpsız model, dörtlü kilit, 180 gün + FIFO

**Kayıpsız izleme (İP-§6.1).** Müşteri paneli, E-Club oynatıcısının sade uyarlamasıdır: izle → tamamla → soruları cevapla. İç müşterinin kayıp mekanizmaları (ileri sarma, yanlış cevap) burada YOKTUR — yanlış cevap hiç kayıt üretmez, yalnız doğru cevap kazandırır. Kazanım puanları yayın başına PM ailesince belirlenir (K-E4: mevcut `video_puani` + soru puanları; sistem ayarı değil). **İzlenme metriği hiçbir katmanda üretilmez** (İP-§6.2): Eczanem izleme verisi rapor/analiz katmanlarına bilinçli olarak bağlanmaz — eksik değil, karardır.

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

*Bu kesit 18.07.2026'da yeniden yazıldı: admin tam kalite taraması (`kalite_bulgu_raporu.md` §5, B-17..B-38) ve İskender'in yapısal tespiti ("HapBilgi modüler olarak genişlerken admin geride kalmıştır — gerçek anlamda ortada bir admin yoktur") üzerine panel modernize edildi. Plan: `admin_modernizasyon_is_plani.md` (M0–M5 + K-A kararları); uygulamanın commit-kanıtlı kaydı: `admin_guncellestirme.md`.*

Admin paneli, HapBilgi'nin yönetim beynidir: bir firma seçilir; o firmanın kullanıcıları, yapısı ve modüllerinin işleyişi aynı panelden yönetilir; firma-üstü işler ayrı "global" bağlamda toplanır. Önceki mimarinin dört parçalı yüzeyi (`/admin` + Navbar'a dağılmış `eclub`/`eclub-store` panelleri + hiçbir yerden bağlantısız yetim `/admin/store`) M2 bilgi mimarisiyle tek kabukta birleştirilmiştir.

**Tek kabuk — M2 bilgi mimarisi (KAPANDI, 18.07.2026).** `app/admin/page.tsx` orkestratördür (sayfa ince, hook'lar kalın — §2.6'nın frontend karşılığı): üstte **global bölümler** barı (HBStore | E-Club Store | Sistem Ayarları + onay modallı test-verisi-sil butonu), solda `FirmaSidebar`, içerikte **iki gruplu sekme çubuğu** — Firma bağlamı (Kullanıcılar | Organizasyon | Ürün & Teknik) ‖ Modüller (T-Club | C-Club | E-Club | Eczanem). Sekme/bölüm tanımları tek kaynaktadır (`_constants.ts` — `MODUL_SEKMELERI`/`GLOBAL_BOLUMLER`; her kayıttaki `firmaAdminGorur` bayrağı, ileride eklenecek "firma admini" rolüne yetki kapatmanın tek yerden yapılabilmesi içindir, K-A1). Eski bağımsız paneller sekmelere/bölümlere gömüldü; eski URL'ler (`/admin/store`, `/admin/eclub`, `/admin/eclub-store`) `/admin`'e redirect olur ve Navbar'da admin'e giden hiçbir link kalmamıştır (canlı doğrulama İskender — girişsiz ziyaretçi `/login`'e düşer). Görsel dil login neslindendir (K-A3): tüm vurgular `_constants.ts` bordo ailesinden (`RENK_BORDO` + zemin/kenar tonları) okunur; anlamsal renkler (sipariş durum etiketleri, modül switch renkleri, amber eksik dili, kırmızı hata dili) bilinçli olarak bu dile dahil değildir.

**Kullanıcı yönetimi — M0 güvenilirlik tabanı + M3 modernizasyonu + upsert.** Panelin en temel işi üç dalgada yeniden kurulmuştur. **M0 (B-17..B-24):** toplu yükleme/silme/pasifleme artık kısmi başarısızlığı gizlemez (sonuç yalanları bitti), doğrulama kural kitabı tek kaynaktır (`lib/admin/kullaniciDogrulama.ts` — tekil, toplu ve PUT aynı fonksiyonları çağırır; bölge çözümü firma kapsamına kilitli), export sorgu hatasında kesilir, silme sırası telafilidir (arşiv → DB → Auth). **M3 (K-A6 + B-25 + B-31):** toplu yükleme insan-format dosyayı kabul eder (`turkceKatla` esnek başlık eşleme, `rolCoz` insan adı→kod çözümü, görünür satır hatası, XLSX şablon indirme; Excel'in sayı tipine çevirdiği hücreler tip-bağımsız okunur — fiziksel test bulgusu); **eksik kabul modeli** kurulmuştur: kimlik çekirdeği tam satır, takım/bölge eksik olsa da yüklenir ve "eksik bilgili" işaretlenir — tanımın tek kaynağı `kullaniciEksikMi`'dir (DB kolonu yoktur, koddan türetilir), listede amber rozet + hücre içi tamamlama seçicisi, `FirmaSidebar`'da firma kartına "⚠ N eksik bilgili" göstergesi (T-2) ve **firma aktivasyon kilidi** (eksikli kullanıcı varken `aktif=true` isim isim sebeple reddedilir) aynı kaynaktan beslenir. **Upsert aşaması (K-A7):** toplu yükleme artık ekleme değil upsert'tir — kullanıcı takibi kalıcı `kullanici_id` üzerinden, Excel eşleştirmesi e-posta + telefon anahtarlarıyla (telefon kimlik çekirdeğinde, §2.2); ikinci liste mevcut kayıtları günceller, şifre ASLA ezilmez (yalnız yeni kullanıcıda zorunlu), listede olmayana dokunulmaz, çakışma/mükerrer görünür satır hatasıdır; eksikli kullanıcı PASİF doğar ve eksiği kapanınca otomatik aktifleşir (T-7 — bilinçli pasif korunur), aktif firmaya eksikli yükleme yükle+uyarıdır (T-1). Önizleme tablosu İşlem sütunuyla (yeni/güncelle/değişiklik-yok) kaydetmeden önce ne olacağını gösterir.

**Sistem Ayarları — global bölüm.** Tekrar Gönderim Modeli'yle eklenen firma-bağımsız ayar paneli, M2 ile üst bardaki global bölümlerden biri olmuştur (önceki "firma görünümünün alternatifi panel" yerleşimi kalktı; global iş global yerde ilkesi korunur). Panel davranışı aynıdır: `sistem_ayarlari` tablosunu anahtar + açıklama + değerle listeler, PUT yalnızca mevcut anahtarı günceller (yeni anahtar migration işidir), değer doğrulaması pozitif sayı/sayı dizisidir. Jsonb-nesne değer desteği (B-28 — push olay ayarının panelden yönetimi) M5'te açık iştir.

**Firma yaşam döngüsü.** `FirmaSidebar` yaşam döngüsünün tüm aşamalarını tek yerde toplar: oluştur, aktif/pasif (aktivasyon kilidi dahil), modül aç/kapa toggle'ları (§2.2/§2.4'teki bayrakların arayüz karşılığı), silmeden önce Excel dışa aktarma (`son_export_at` damgası) ve kalıcı silme. Sıralama bilinçlidir: silme, export edilmemiş firmada engellenir.

**Eczane onayı — E-Club sekmesinde.** `eclub_eczane_master`'a elle girilen eczanelerin onaylanması (§4.1) artık ayrı panel değil, ana kabuğun E-Club sekmesidir (M2-b taşıması; hook'lar aynı: `useEclubKayitli` + `useEclubOnaylar`). Akış firma bağımsızdır; eski `/admin/eclub` URL'si redirect'tir.

**Mağaza yönetimleri — global bölümlerde paralel çift panel.** HBStore ve E-Club Store yönetimleri aynı üç sekme (Kategoriler/Ürünler/Siparişler) ve aynı hook desenini koruyarak global bölümlere gömülmüştür — §3.5/§4.5'teki ikizliğin admin yansıması. Önemli açık karar kapanmıştır (K-A2): bugünkü global katalog şeması hedefe uymuyor — **katalog firma bazlı olacak** (her firma farklı ürün yelpazesi isteyebilir); şema değişikliği gerektirdiğinden M4'ün ayrı planlanacak alt-işidir.

**Güvenlik — çift katman.** Tüm admin route handler'ları route-içi tek bekçiden (`adminGirisKontrol`) geçer; proxy admin bekçisi ikinci katmandır (B-26, §2.4). Sayfa kapıları `ADMIN_ROLLER` tek kaynağına bağlıdır (B-33); eski hook'lar ağ hatasına dayanıklıdır (B-32); şifre politikası tekil+topluda aynı kural kitabındandır (B-36).

**Durum.** M0/M1/M2 kapandı; M3 + upsert + T-serisinin kod tarafı bitti — kapanış İskender'in fiziksel toplu yükleme testine (11 kişilik gerçek dosyayla tam akış) ve T-3 görsel onayına bağlıdır (§6.4 Doğrulama). M4 (modül sekmelerinin görünürlük + müdahale katmanları — bugün sekmeler modül-kapalı/durum kartı gösterir) ve M5 (kalan bulgular) plandadır.

### 6.2 Kalite & denetim altyapısı

HapBilgi, mimari ilkelerin (§2.5, §2.6) zamanla erozyona uğramaması için iki bağımsız otomatik denetim katmanı işletir. Biri kod ile veritabanı arasındaki **doğruluğu**, diğeri kod içindeki **mimari disiplini** kontrol eder. İkisi de `package.json` script'leri olarak çalışır (§2.1) ve CI/deploy öncesi kontrol noktalarıdır.

**Kod↔DB denetimi (`npm run denetim`).** Bu katman, koddaki veritabanı erişiminin gerçek şemayla tutarlı olduğunu doğrular. Üç adımlı bir zincirdir:

1. `sema-cek.js` — canlı DB'ye bağlanır (`pg`), tüm tablo/view/kolon/RPC/FK bilgisini çeker, `sema.json`'a yazar (bu rapor boyunca kullanılan kaynak).
2. `kod-tara.js` — kod tabanını `ts-morph` ile AST seviyesinde tarar, her `.from()`, `.select()`, `.rpc()` çağrısını `kullanim.json`'a çıkarır.
3. `denetle.js` — ikisini karşılaştırır, dört tür uyuşmazlığı raporlar: var olmayan tablo/view (`.from`), var olmayan RPC (`.rpc`), var olmayan kolon (`.select` — üst seviye + nested embed), FK'si olmayan nested embed.

Denetleyicinin dikkat çeken tasarım kararı **muhafazakârlıktır**: `.from` ve `.select` ayrı çağrılar olduğu için AST bir `.select`'in hangi tabloya ait olduğunu her zaman kesin eşleyemez. Sahibi belirsiz kolonlar, yalnızca *hiçbir* tabloda bulunmuyorsa hataya düşer — böylece yanlış-pozitif (aslında doğru olan bir kolonu hatalı göstermek) riski, bazı gerçek hataları kaçırma pahasına bilinçli olarak azaltılır.

**Mimari kural denetimi (`npm run lint:mimari`).** Bu katman şema doğruluğuna değil, projenin kendi tasarım ilkelerine kod düzeyinde uyulup uyulmadığına bakar. `tools/eslint-rules/index.mjs` içinde tek bir ESLint eklentisi (`hapbilgi-mimari`) altında dört kural tanımlıdır:

| Kural | Kontrol ettiği |
|---|---|
| `olu-rpc` | Kodun çağırdığı bir RPC'nin DB'de artık var olmaması — canlı şemayı (`sema.json`) okuyarak kontrol eder (denetim katmanıyla aynı kaynağı paylaşır). |
| `firma-kolonlari` | `FIRMA_KOLON_ESIK` (5) üzerinde kolon değişikliğinin `lib/firma/kolonlar.ts` tek-kaynağından geçip geçmediği — bu eşiğin altında kalan değişiklikler kural dışıdır. |
| `kayit-tek-kaynak` | Belirli **korumalı tablolara** (`KORUMALI_TABLOLAR` — puan/kayıt tabloları ve `yayin_tekrar_kayitlari`) doğrudan `.insert()` yapılmaması; yazım yalnızca tek-kaynak fonksiyonlar üzerinden geçmeli (muafiyet: `/lib/puan/` + `/lib/tur/` + `/lib/eczanem/` — her biri kendi tablolarının meşru tek yazım noktasıdır; B-07 ifade düzeltmesi). |
| `dogru-client` | Doğru Supabase client'ın (anon vs service_role, §2.4) doğru bağlamda kullanılması. |

Bu kuralların ortak paydası, §2.5'teki "tek kaynak" ilkesini derleme zamanında zorunlu kılmalarıdır — bir geliştirici (ya da gelecekte bir LLM) korumalı bir tabloya doğrudan yazmaya kalkarsa, ya da kolon listesini tek-kaynak dosyasından geçirmeden değiştirirse, `lint:mimari` bunu daha kod incelemesine gelmeden yakalar.

**İki katmanın tamamlayıcılığı.** Kod↔DB denetimi "kod, DB'nin bugünkü haliyle uyumlu mu?" sorusuna cevap verir; mimari kural denetimi "kod, projenin kendi ilkelerine sadık mı?" sorusuna cevap verir. Biri dış tutarlılığı, diğeri iç disiplini korur. §2.4'te temizlenen ölü proxy bloğunun hiçbiri tarafından yakalanamamış olması (çünkü ne bir şema hatasıydı ne de mevcut dört kuralın kapsamındaydı), bu iki katmanın sınırlarını da ortaya koyar — kapsamları geniş ama sınırsız değildir. Tekrar Gönderim Modeli'nin kapanışında iki katman da temiz geçmiştir: `denetim` scripti tamamen otomatiktir (elle liste yoktur — `sema-cek` DB'den çeker, `kod-tara` kodu tarar, `denetle` karşılaştırır). Push uygulaması ve admin modernizasyonu boyunca da her commit aynı üçlü doğrulamadan (tsc + denetim + lint:mimari) geçmiştir; son koşum (18.07.2026) 699 `.from` / 576 `.select` / 76 `.rpc` üzerinde hiçbir uyuşmazlık raporlamamış, `lint:mimari` ihlal bulmamıştır. Denetim ailesinin ürettiği ikinci büyük çıktı, admin panelinin **tam kalite taramasıdır** (18.07.2026): `kalite_bulgu_raporu.md` §5'e işlenen 22 bulgu (B-17..B-38), admin modernizasyon planının tetikleyicisi ve M0/M1/M5 iş listesinin kaynağı olmuştur (§6.1).

### 6.3 Dağıtım & ortam

**Vercel — varsayılan yapılandırma.** Proje, özel bir `vercel.json` taşımaz; `.vercel/project.json` yalnızca Vercel CLI'nin projeyi bağladığı kaydı tutar. Bu, Next.js App Router'ın Vercel'in varsayılan build/deploy algılamasıyla ek yapılandırma gerektirmeden çalıştığı anlamına gelir — route'lar, ortam değişkenleri ve build adımı platformun standart davranışına bırakılmıştır.

**Ortam değişkenleri.** Sistemin dış bağımlılıkları (Supabase, Bunny.net, AI sağlayıcı) env üzerinden yönetilir; yerelde `dotenvx` (`.env.local`, `devDependencies`'te görülen `dotenv`, §2.1) ile enjekte edilir. Production'da bu değerlerin Vercel proje ayarlarında tanımlı olması gerekir; anahtar değişken grupları şunlardır: Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`), AI sağlayıcı (`AI_PROVIDER` + ilgili `_API_KEY`/`_MODEL`, §2.7), Web Push VAPID (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_SUBJECT` her ortamda; `VAPID_PRIVATE_KEY` YALNIZ production — K-P7 çift kilidi, push iş planı).

**Commit disiplini.** Proje geçmişi, tutarlı ve tek-amaçlı commit mesajları izler (`refactor:`, `feat:`, `fix:` önekleriyle, Türkçe açıklama) — örneğin `refactor: FIRMA_KOLONLARI lib/firma/kolonlar.ts'e tasindi (tek-kaynak)` ya da `fix: CC ileri_sarma_acik/extra_puan v_yayin_detay yerine yayin_yonetimi`. Bu commit'ler, raporun kendisinde de tekrar tekrar görülen "tek kaynak" ve "doğru veri kaynağından okuma" ilkelerinin geçmişte de aktif olarak düzeltildiğinin izidir.

**Push disiplini — deploy-öncesi mecburi işler bitmeden push yok.** Kritik bir çalışma kuralı, kod değişikliklerinin mecburi deploy-öncesi işler (§6.4) tamamlanmadan push edilmemesidir. Tekrar Gönderim Modeli'nin tüm kod işleri bu disiplin içinde tamamlanmış ve mantıksal gruplar hâlinde dokuz commit olarak alınmıştır (`proxy.ts` temizliği dahil); ardından Ekstra İzlediklerim işi üç commit daha eklemiştir (ana sayfa veri katmanının bölünmesi, tam tekrar sayımının tek kaynağa çıkarılması, bölümün kendisi). Hepsi `tsc` + `lint:mimari` + `denetim` doğrulamasından geçmiştir. Ardından Eczanem geliştirmesi (U0–U9, 12.07.2026) aynı disiplin içinde bir commit serisi daha eklemiştir. Local'de push bekleyen tüm commit'ler, fiziksel insan testleri (§6.4 Doğrulama bloğu) tamamlanana kadar bekletilir; Vercel push/deploy, mecburi işler listesi kapandığında tek bir hazır durum olarak yapılır. Bu bilinçli bir tercihtir — deploy bir dizi ayrık değişiklik değil, doğrulanmış tek bütündür.

### 6.4 Açık işler, teknik borç, deploy-öncesi mecburi işler

Bu rapor hazırlanırken sistemin farklı katmanlarında karşılaşılan, bilinçli olarak ertelenmiş ya da henüz tamamlanmamış işler burada tek yerde toplanır. Amaç, bunların dağınık notlar olarak kaybolmaması; deploy öncesi tek bir kontrol listesi oluşturmasıdır.

**Kapananlar — Tekrar Gönderim Modeli kapsamında (10.07.2026).**
- **`proxy.ts` temizliği** (§2.4): Ölü senaryo API bloğu kaldırıldı, `tsc` ile doğrulandı ve commit edildi.
- **Rol okumanın tekleştirilmesi** (§2.4): 65 dosyadaki `user_metadata.rol` okuması `rolCozucu` → `v_auth_kimlik` kaynağına taşındı; yazma tarafına dokunulmadı.
- **UTT extra kuralının güncellenmesi** (§3.1): Kayan-hafta modeli (4 tam seyretme), ay-bazlı tek hak modeline (ilk izleme hariç 3. tam tekrarda TEK extra) çevrildi; CC extra kuralı da tanımlanıp aynı desene oturtuldu (§3.3).
- **Ekstra İzlediklerim bölümü** (§3.1): Ertelenen işler listesindeki "En Çok İzlediklerim" işi, "Ekstra İzlediklerim" adıyla UTT ana sayfasına eklendi; yalnızca fiziksel test (U7) bekliyor.
- **Ana sayfa veri katmanının bölünmesi** (§2.6): 542 satırlık `anaSayfaVeri.ts` rol başına dosyalara ayrılıp silindi; saf taşıma — denetim kullanım profili birebir aynı kaldı.
- **Tam tekrar sayımının tek kaynağa çıkarılması** (§2.6, §3.1): `lib/puan/tekrarSayim.ts`; `bitir` refactor edildi, davranış birebir.

**Kapananlar — Eczanem üçüncü katman kapsamında (12.07.2026, Bölüm 5).**
- **U0–U9 kod üretimi tamam**: zemin (`HedefRol` tek kaynak + 10 tablo + ayarlar), OTP altyapısı (K-E8 test modu gömülü), davet + `v_auth_kimlik` müşteri düzlemi, altıncı bekçi + müşteri paneli + KVKK tam silme, PM talep hedefi, yayına alma barkod+tarife, UTT/eczane dağıtımı, izleme+kazanım ledger'ı (dörtlü kilit), kasa + atomik FIFO onay RPC'si (canlıda), görünürlük katmanları. Tümü commit'lerde; her adım `tsc` + `denetim` + `lint:mimari` temiz.
- **`rolCozucu` service_role bug'ının onarımı** (§2.2, §2.4): `auth.uid()` filtreli view'ın service_role'de boş dönmesi — `v_auth_kimlik_admin` ile kapandı (Eczanem U2'nin yan kazanımı; 66 dosyadaki rol kontrolünü etkileyen canlı bug'dı).
- **`TakipSatiri.hedef_rol` dar tipi borcu**: U0'da `HedefRol` tek kaynağıyla kapandı.

**Kapananlar — Teknik kalite kontrol taraması kapsamında (12.07.2026, `docs/kalite_bulgu_raporu.md`).**
- **Q1 taraması + onaylı düzeltmeler**: T-K1..8 / T-B1..5 / T-D1..12 tek oturumda koşuldu (16 bulgu). KRİTİK+ORTA sekiz bulgu birer commit'le kapandı: kd_utt boş /izle listesi (B-01), izleme başlat/detay uçlarına pozitif hedef süzgeci (B-02/B-03), talep formu-API hedef eşitlemesi — eczaci/eczane_teknisyeni kabul edilir (B-05), login temizliği + ölü "Şifremi unuttum" linki (B-06/D3), `user_metadata.rol` dallanmalarının kaldırılması — analiz guard'ları `rolCozucu`, client sayfalar `useAuth` (B-04), puan yazım hatalarının yanıtta dürüst bildirimi (B-08), puan penceresinin `Europe/Istanbul`'a sabitlenmesi — Vercel UTC kayması (B-12).
- **`denetim:tutarlilik` script ailesi (Q4)**: `scripts/denetim/tutarlilik/` altında 12 salt-okuma SQL + koşucu (READ ONLY oturum, ihlalde exit 1); üçlü doğrulamanın yanına dördüncü katman olarak eklendi. İşlem verisi geldikçe değeri artar.

**Kapananlar — yayın yönetimi iyileştirmeleri (13.07.2026).**
- **Yayın Yönetimi pill rozeti**: Navbar'daki pill'e diğerleriyle aynı görünümde rozet eklendi; sayı bildirim değil **canlı "yayına alınmayı bekleyen" sayımıdır** (`bekleyenler?sayi=1` hafif modu) — kuyruk ortak olduğundan (herhangi bir üretici yayınlayabilir) ve okunma durumundan bağımsız gerçeği göstermesi gerektiğinden bilinçli olarak bildirim tabanlı yapılmadı.
- **Tarih bazlı yayınlama**: yukarıda §2.8'de; SQL `scripts/sql/yayin_aktivasyon.sql`, cron kaydı canlıda (İskender, 13.07.2026). Fiziksel test kapsamındadır.
- **Bekleyen kartı yerleşimi**: ayarlar (video/extra puan, tekrar periyodu, ileri sarma, yayın günü; Eczanem'de barkod+karşılık) dar dikey sütundan tam genişlik yatay **ayar bandına** taşındı; kart yüksekliği düştü. Tekrar periyodu seçeneklerine 7 gün eklendi (`sistem_ayarlari` — veri değişikliği, İskender).
- **Giriş sayfası yeniden tasarımı** (`app/login/page.tsx`): iki panelli yerleşim — solda düz baykuş grisi (#737373, logodan örneklendi; GRI_METIN ile aynı) zeminde marka anlatısı: "Öğrenmenin V Hali / Öğretirken Kazandırır" + dört modül tanıtımı (**T-Club** temsilciler, **C-Club** değişim liderleri, **E-Club** eczaneler, **Eczanem** eczane danışanları; Club'lar baş harf ikonlu, Eczanem kalp — adlar/ifadeler İskender onaylı); sağda sade giriş formu (şifre göster/gizle gözü, tek vurgu rengi bordo, logo büyütüldü). Emoji özellik şeridi kaldırıldı. Giriş akışı mantığı (B-06 — kimlik kaynağı useAuth) değişmedi. Not: D3'ün "ölü Şifremi unuttum linki kaldırılır" maddesi İskender talebiyle geri alındı — link görsel olarak döndü, işlevlendirme hâlâ bu listedeki açık iştir.

**Kapananlar — Web Push uygulaması (16–18.07.2026, plan: `hapbilgi_push_teknik_is_plani.md`).**
- **P0–P7 kod üretimi tamam**: zemin (web-push bağımlılığı, tip tek kaynağı, tablolar+ayarlar SQL'i canlıda), service worker + PWA manifesti (push-only `sw.js`), istemci abonelik akışı (yumuşak izin kartı, 7 gün erteleme), abonelik saklama (route ince + lib kalın, endpoint UNIQUE upsert), gönderici (VAPID transport arayüz arkasında, denemeli retry, 404/410 ölü budama, canlı-dışı no-op çift kilit), orkestrasyon + rol-aware içerik (`pushYayinla`, gönderim-anı rol çözümü, `after()` sarmalayıcıları), entegrasyonlar (`bildirimOlustur`/`eclubBildirim` yan etkisi + Eczanem doğrudan olaydan — K-P3 istisnası) ve push tablolarının lint korumasına alınması. **K-P12 (18.07.2026)**: hesap-düzeyi ilk rıza — cihaz izni olsa da rıza vermemiş hesap adına sessiz abonelik yapılmaz; anahtarlar hesaba özeldir. Canlıya alma, fiziksel testlere ve `VAPID_PRIVATE_KEY`'in yalnız production env'inde tanımlanmasına bağlıdır (§6.3).

**Kapananlar — Admin modernizasyonu (17–18.07.2026, commit-kanıtlı kayıt: `admin_guncellestirme.md`).**
- **M0–M3 + M2 + upsert + T-serisi**: §6.1 bu işle yeniden yazıldı. M0 güvenilirlik tabanı (B-17/B-19/B-18+21+22/B-20/B-23/B-24 — her biri ayrı commit), M1 ortak çekirdek (B-26/B-32/B-33/B-36), M2 bilgi mimarisi (KAPANDI — İskender canlı teyidi), M3 kullanıcı yönetimi (K-A6 + B-25 + B-31), upsert aşaması (K-A7 — telefon kimlik çekirdeği + upsert modeli) ve 18.07 soğuk taramasının 7 T-maddesinin tamamı. Kod tarafı bitti; **kapanış İskender'in fiziksel testine bağlıdır** (Doğrulama bloğu). M4 (modül sekmeleri: görünürlük + müdahale, K-A1; Store firma-bazlılık alt-işi K-A2) ve M5 (B-27, B-28, B-29/30/38, B-34, B-35, B-37) `admin_modernizasyon_is_plani.md`'de açık iştir.

**Güvenlik — deploy öncesi mecburi.**
- **RLS eksikliği** (§2.4): Tabloların büyük çoğunluğunda Row Level Security kapalı; şu an tek savunma katmanı API/proxy seviyesindeki manuel rol kontrolüdür (service_role RLS'i bypass eder). Yaklaşık 30 tabloya (`yayin_tekrar_kayitlari` dahil) **+ 11 yeni `eczanem_*` tablosuna + 2 push tablosuna (`push_abonelikleri`, `push_gonderim_kayitlari` — K-E7 deseniyle RLS'siz doğdu)** RLS eklenmesi ve hangi işlemlerin service_role, hangilerinin anon+RLS ile yapılacağının netleştirilmesi gerekiyor. (Eczanem K-E7 kararı fiilen bu genel işe katlandı: tablolar RLS'siz doğdu, service_role'e açık GRANT'li, anon/authenticated'a bilinçli kapalı.) Girdi envanteri hazır: kalite raporu B-10 — anon'a SELECT açık 19 tablo (soru setleri cevaplarıyla dahil) + RLS açılınca kırılacak 16 istemci okuma noktası; B-16'daki toplu `REVOKE TRUNCATE/REFERENCES/TRIGGER FROM anon, authenticated` da bu işle birlikte ele alınır.
- **Test endpoint'lerinin kaldırılması** (§2.4, §6.1): `admin/api/test-verileri-sil` ve `app/admin/test-temizlik/` test araçlarıdır; 12.07.2026'da girişsiz olmaktan çıkarılıp proxy admin bekçisinin arkasına alındı (canlıda girişsiz silme ucu bırakılamazdı) ve admin üst barına onay modallı "Test Verilerini Sil" butonu eklendi. Deploy öncesi araç bütünüyle (buton + modal + sayfa + endpoint) yine de kaldırılmalı.
- **`@test.com` verilerinin temizliği**: Geliştirme sürecinde oluşturulan test kullanıcı/verilerinin production'a taşınmadan temizlenmesi gerekiyor. Kalite taraması somutladı (B-15): `auth.users`'ta hiçbir kimlik düzlemine bağlı olmayan 3 sahipsiz kullanıcı (`utt/pm/bm@test.com`); silme SQL'i kalite raporu §4'te, İskender koşar (`denetim:tutarlilik` td10 yeşile döner).

**Kalite taraması NOT'ları (12.07.2026 — ayrıntı: `docs/kalite_bulgu_raporu.md`).**
- **Lint `kayit-tek-kaynak` kapsam genişletme (B-07)**: kural yalnız `.insert`'i yakalar; `.update/.delete/.upsert` kör nokta (bugün fiilî kaçak yok). Kural genişletilecek.
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
- **HB Ligi ölçeklenmesi** (§2.5, §3.4): Sıralama şu an `v_hbligi_sirali` view'ından canlı SUM ile hesaplanıyor; bu yaklaşım ~500–1000 UTT'ye kadar yeterli, daha büyük ölçekte materialized view veya artımlı güncelleme stratejisine geçiş gerekecek.

**Ertelenen işler (bilinçli).**
- **`tekrar_id` FK kolonu** (§2.5): Tüm tekillik sorguları tarih karşılaştırmasıyla çözüldüğünden ertelendi; raporlama JOIN ihtiyacı doğarsa kolon eklenip geçmiş tarihten geriye doldurulur.
- **E-Club kişi tarafı sayacı ve UTT "gönderime hazır" durumları (v2)** (§3.1): Sayaç UTT gönderim ekranına aittir; o ekran Eczanem geliştirmesiyle şekillenecek.
- **Ekstra İzlediklerim'in CC/BM karşılığı**: BM'in "İzlenecek Videolar" düzleminde aynı bölümün eşik-2 karşılığı; ihtiyaç doğarsa aynı desen (tekrarSayim'in CC eşdeğeriyle) birebir uygulanır.
- **Üretici ana sayfa N+1 deseni**: `lib/utils/anaSayfa/uretici.ts`'teki talep başına sıralı sorgu zinciri; bölünme sırasında bilinçli olarak iyileştirilmeden taşındı — ayrı performans işi.

**Doğrulama.**
- **U10 — Tekrar Gönderim uçtan uca fiziksel test (push öncesi şart)**: 12 senaryoluk liste üretim ortamında koşulur — yayına alma/tur-1, ilk izleme, yeni extra kuralı (UTT ve CC), tur dönüşü, sayaç rozetleri, BM/CC akışı, öneri (BM/TM→UTT), E-Club (yeni öneri + ayar değişiminin davranışa etkisi), durdur/başlat tur bağımsızlığı, challenge etkilenmezliği, Sistem Ayarları paneli, puansız zaman penceresi. Rol değişikliğinin yeniden giriş gerektirmeden anında etki ettiği (rolCozucu, §2.4) de bu kapsamda doğrulanır. Local'de bekleyen commit'ler bu test tamamlanmadan push edilmez (§6.3).
- **U7 — Ekstra İzlediklerim fiziksel testi (push öncesi şart)**: 9 senaryo — liste/sıralama doğruluğu, tur dönüşünde "bu turda" sayacının sıfırlanması (ömür boyu süzgeci değişmeden), "extra'ya X kaldı" ile bitir kararının birebirliği (X=1 iken bir tam tekrar → extra düşer, satır "bu ay kazanıldı"ya döner), ay dönümünde hak yenilenmesi, ileri sarmalı / puansız-pencere izlemelerinin sayaca girmemesi, refactor sonrası bitir davranışının birebirliği, durdurulan yayının bölümden düşmesi, boş durum teşviki, beğeni/favori senkronu. U10 oturumuyla birleşik koşulabilir.
- **Eczanem U10/U11 — faz sonu ara testler + uçtan uca fiziksel test (push öncesi şart, İskender)**: Eczanem'in U5–U9 adımları duman testi yapılmadan kapandı (mutlu yol canlı fixture — onaylı sipariş, tam dağıtım zinciri, çoklu rol oturumu — gerektiriyordu); doğrulama bilinçli olarak bu insan-yürütümlü testlere bırakıldı. Kapsam (teknik iş planı U11): davet→OTP→üyelik, eşik, gönderim teklikleri, izleme→kazanım, dörtlü kilit sızmazlığı, FIFO/180 gün senaryosu, sipariş→onay→fiş→mükerrer onay reddi, KVKK silme sonrası toplamların korunumu, görünürlük sınırları (kişi verisi sızmıyor, İP-§9), İP-§11 risk tablosunun satır satır sağlaması.
- **Admin toplu yükleme fiziksel testi (İskender — M0+M3+upsert birlikte)**: 11 kişilik gerçek insan-format dosyayla, takım/bölge tanımlı firmada tam akış — önizleme → kaydet → eksik tamamlama → upsert ile ikinci liste → otomatik aktifleşme → firma kilidi/aktivasyon. Önizleme aşaması 18.07'de fiziksel testte doğrulandı; kaydet/tamamlama/kilit akışları canlıda hiç koşulmadı. T-2 rozet tazelenmesi aynı oturumda görülür; T-3 bordo dilinin görsel onayı (K-A3/K-A4) da bu kapsamdadır. Ayrıntılı kapanış koşulları: `admin_guncellestirme.md` §C.
- **Final test**: Deploy öncesi uçtan uca doğrulama — üç müşteri katmanının kritik akışlarının (üretim→tüketim→puan→lig→store zinciri; iç müşteri, E-Club ve Eczanem için) manuel/otomatik testi.
- **Vercel push/deploy**: Yukarıdaki doğrulama bloğu + güvenlik bloğu (RLS, test endpoint'leri, test verisi temizliği) + Eczanem canlı ön koşulları (K-E1 başta) kapanmadan `origin`'e push yapılmaz (§6.3). Push, biriken commit serisinin tek hazır durum olarak yayınlanmasıdır; Eczanem için ayrıca üretim ortamı env'inde SMS sağlayıcı anahtarlarının tanımlanması gerekir.
