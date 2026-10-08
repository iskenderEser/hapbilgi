# Ortak yapı dışında kalan kontroller

8 Ekim 2026. Kod incelemesi: sayfalarda çalışan seçim, filtre, toggle ve sekmeler. Bu kayıt geliştirme öncesi envanterdir; ekranların görsel doğrulaması değildir. Aynı sayfada ortak yapıya bağlı ve bağlı olmayan kontroller birlikte bulunabilir.

| Sayfa | Ortak yapı dışında kalan kontrol | Kod kaynağı |
|---|---|---|
| Ana sayfa — TM | İstatistik kartlarının altındaki “T Club Yayınları” / “C Club Yayınları” butonları | [Dosya](/Users/iskendereser/Desktop/hapbilgi/components/ana-sayfa/TmAnaSayfa.tsx:242) |
| Öneri takibi — BM | Öneri Konusu, UTT Listesi, Öneri Durumları açılır listeleri | [Dosya](/Users/iskendereser/Desktop/hapbilgi/app/(panel)/oneriler/_components/BmOneriTakibi.tsx:197) |
| Öneri takibi — TM | Tablo içindeki temsilci seçimi | [Dosya](/Users/iskendereser/Desktop/hapbilgi/app/(panel)/oneriler/_components/TmOneriTakibi.tsx:118) |
| T-Club Ligi — üretici | “T-Club Ligi” / “Yayınlarımın Ligi” ve “Bölge” / “Takım” / “Firma” butonları | [Dosya](/Users/iskendereser/Desktop/hapbilgi/components/hbligi/producer/ProducerLeaguePage.tsx:230) |
| T-Club Ligi — UTT/BM/TM/yönetici | Kapsam toggle’ları; karşılaştırmada takım/bölge seçimleri (masaüstü ve mobil) | [Dosya](/Users/iskendereser/Desktop/hapbilgi/components/hbligi/league/CompetitorComparison.tsx:176) |
| C-Club / Challenge Club | “Yayınlar” / “Challenge Gönder” / “Gönderilen Challengelar” / “Gelen Challengelar” butonları; Challenge Gönder bölümündeki BM alıcı listesi | [Dosya](/Users/iskendereser/Desktop/hapbilgi/app/(panel)/challenge-club/page.tsx:426) |
| BM/TM/UTT raporları | “Rapor” / “Karşılaştırma”; eğitim türü adlarının yazdığı kategori butonları; “Tümü” / “Kazandıranlar” / “Kaybettirenler” | [Dosya](/Users/iskendereser/Desktop/hapbilgi/components/raporlar/DavranisRaporu.tsx:112) |
| Yönetici ve T-Club üretici raporu | Pasta/Sütun/Çizgi/Tablo görünüm seçimleri | [Dosya](/Users/iskendereser/Desktop/hapbilgi/components/raporlar/DagilimGrafik.tsx:190) |
| T-Club üretici raporu | Öğrenme Araçları/Eğitim Konuları/Ürünler ve Takımlar/Bölgeler/UTT’ler seçimleri | [Dosya](/Users/iskendereser/Desktop/hapbilgi/app/(panel)/raporlar/tclub-uretici/page.tsx:252) |
| Yayın raporları ve T-Club üretici raporu | Detay penceresindeki Öğrenme Aracı Önizleme / Sorular sekmeleri | [Dosya](/Users/iskendereser/Desktop/hapbilgi/components/raporlar/YayinDetayModal.tsx:214) |
| Yayın Takip | Üretim aşaması; ürün/teknik/takım; soru sayısı/seçenek sayısı/video başına soru seçimleri; öğrenme aracı ve eğitim türü seçimleri | [Dosya](/Users/iskendereser/Desktop/hapbilgi/app/(panel)/talepler/_components/IsListesi.tsx:66) |
| Yayın Yönetimi | Hedef grup seçimi; yayın bitirme puanı, extra puan, yayın sıklığı ve soru puanı listeleri | [Dosya](/Users/iskendereser/Desktop/hapbilgi/app/(panel)/yayin-yonetimi/_components/BekleyenSatir.tsx:203) |
| Senaryolar / Videolar / Soru Setleri | Durum filtreleri | [Dosya](/Users/iskendereser/Desktop/hapbilgi/components/DurumAnahtari.tsx:78) |
| BM eğitim yayınları — kategori sayfası | Öneri gönderilecek UTT seçimi | [Dosya](/Users/iskendereser/Desktop/hapbilgi/components/yayin/BmEgitimYayinlari.tsx:183) |
| E-Club Yayınları | BM/TM görünümündeki isim/kapsam açılır listeleri; gönderim alanındaki “Alıcıları seçin” / “… alıcı seçildi” butonu ve kişi listesi; yayın gönderim ayrıntısındaki kişi sayılı durum butonları | [Dosya](/Users/iskendereser/Desktop/hapbilgi/app/(panel)/eclub/yayinlar/page.tsx:272) |
| Eczanem Yayınları | “Eczaneleri seçin” / “… eczane seçildi” butonu ve açılan eczane listesi | [Dosya](/Users/iskendereser/Desktop/hapbilgi/app/(panel)/eczanem/yayinlar/page.tsx:331) |
| Eczanem mutabakat — BM/TM/UTT | Üstte seçili ayın yazdığı buton ve açılan ay listesi; işlem tablosunda ürün adına tıklanınca açılan ürün listesi | [Dosya](/Users/iskendereser/Desktop/hapbilgi/app/(panel)/eczanem/_components/MutabakatIslemTablosu.tsx:84) |
| Eczanem eczane siparişleri | Onay Bekleyenler / Geçmiş sekmeleri | [Dosya](/Users/iskendereser/Desktop/hapbilgi/app/(panel)/eczanem/eczane/_components/EczanemSiparisKuyrugu.tsx:141) |
| E-Club Eczanelerim | Depo/şube seçimleri ve aramalı depo seçimi | [Dosya](/Users/iskendereser/Desktop/hapbilgi/components/eclub/DepoTercihFormu.tsx:64) |
| E-Club Hediye Takibi | “Çek Takibi” / “Sipariş Takibi”; Çek Takibi filtrelerinde “UTT”, “Eczane”, “Üye”, “Ürün”, “Durum”; Sipariş Takibi filtrelerinde “UTT”, “Eczane”, “Ürün”, “Durum” | [Dosya](/Users/iskendereser/Desktop/hapbilgi/app/(panel)/eclub/hediye-takip/_components/CekTakipFiltreleri.tsx:61) |
| Store Siparişler | Firma, takım, bölge, kullanıcı ve durum filtreleri | [Dosya](/Users/iskendereser/Desktop/hapbilgi/app/(panel)/store/siparisler/_components/SiparisFiltreleri.tsx:145) |
| Store ürün detayı | Teslimat adresi seçimi | [Dosya](/Users/iskendereser/Desktop/hapbilgi/app/(panel)/store/[urun_id]/page.tsx:372) |
| Store | Kategori seçimi | [Dosya](/Users/iskendereser/Desktop/hapbilgi/app/(panel)/store/page.tsx:411) |
| Kullanıcılar | Rol, firma, takım ve bölge seçimleri | [Dosya](/Users/iskendereser/Desktop/hapbilgi/app/(panel)/kullanicilar/page.tsx:195) |
| Admin | Modül sekmeleri; kullanıcı rol/takım/bölge/durum filtreleri, atama ve form seçimleri; ürün için takım; üretim için içerik üreticisi seçimi | [Dosya](/Users/iskendereser/Desktop/hapbilgi/app/admin/_components/KullaniciListesi.tsx:191) |
| Admin Store | “Ürünler” / “Kategoriler” / “Siparişler”; ürün formundaki kategori listesi; sipariş düzenlemedeki kargo firması listesi | [Dosya](/Users/iskendereser/Desktop/hapbilgi/app/admin/store/_components/UrunModal.tsx:320) |
| Admin E-Club | Firma seçimi | [Dosya](/Users/iskendereser/Desktop/hapbilgi/app/admin/eclub/_components/EclubYonetimPaneli.tsx:267) |
| Admin E-Club çek teslimatı | Çek durum filtreleri | [Dosya](/Users/iskendereser/Desktop/hapbilgi/app/admin/eclub-cek-teslimat/_components/EclubStoreSiparislerSekmesi.tsx:64) |

## Birden fazla sayfada ortak kalan eski seçim

`ListeArama` içindeki arama alanı listesi ortak kullanılan mevcut yapıdır, ancak yeni standart yapıya bağlı değildir. Yalnız birden fazla arama alanı verilen sayfalarda görünür. Kod kaynağı: [ListeArama](/Users/iskendereser/Desktop/hapbilgi/components/liste/ListeArama.tsx:37).

Kullanıldığı sayfalar: Kullanıcılar, Onaylanan Talepler, Öneriler/Biten Öneriler, Senaryolar, Sizin Yayınlarınız, Tüm Yayınlar, Soru Setleri, Videolar, Videolarım kategori sayfası, Yayın Takip, Yayın Yönetimi, Yayındaki Videolar kategori sayfası.

## Ortak yapıyı kullanıp yerel görünüm tanımı kalan yerler

Eczanem eczane sipariş kuyruğundaki durum Select’i `h-8` ve `text-xs` sınıflarını taşır. Müşterilerim durum Select’inde sayfaya özel renk/kenarlık sınıfları bulunur. Ortak yapı içinde olmalarına rağmen bu sınıflar sayfa geçişinde incelenmelidir.

## Ayrı değerlendirilmesi gereken mevcut kontroller

Durum/sayı kartlarıyla yapılan filtreler (ana sayfalar, öneriler, yayın katalogları, yayın yönetimi), liste/akordeon satırları, menü ağacı ve eğitim sorusu cevapları da yeni altı kontrolü kullanmıyor. Bunların tümünü kapsül kontrole dönüştürmek bu envanterden çıkarılan bir karar değildir. Mevcut işlevleri incelenerek standart yapıdaki karşılığı belirlenmelidir. İşlem butonlarına ait ayrı standart henüz tanımlı değildir.

## Sonraki geçiş için kaynaklar

- Yayın Takip: `IsListesi`, `YeniTalepFormV2`, `UrunTeknikSecici`, `SoruSetiAyarlari`.
- T-Club Ligi: `LeaguePage`, `BmLeaguePage`, `TmLeaguePage`, `ProducerLeaguePage`, `CompetitorComparison`.
- Challenge çoklu alıcı: `components/challenge-club/ChallengeGonderPaneli.tsx:143`.
- E-Club BM/TM kapsam seçimi: `app/(panel)/eclub/yayinlar/_components/BmEclubYayinlari.tsx:31`.
- Mutabakat ay seçimi: UTT sayfası ve BM/TM için `BmMutabakatTakipClient.tsx`.
- Hediye Takibi: `HediyeTakipToggle`, `SiparisTakipFiltreleri`, `CekTakipFiltreleri`.

Hediye Takibi test verileri kullanıcı açıkça temizlik başlatana kadar korunur; bu inceleme herhangi bir test veya temizlik başlatmaz.

## Okuma biçimi

Kontroller ekranda görünen yazıları ve yerleriyle belirtilir. İsmi veriden gelen bir kontrol için sabit isim uydurulmaz; hangi adın gösterildiği ve nerede bulunduğu anlatılır. Ayrı çizilmiş sayı kartları, akordeonlar ve gezinme alanları, sırf tıklanabilir oldukları için standart kapsüle dönüştürülmez.
