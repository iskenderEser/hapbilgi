# BM, TM ve Yönetici Rapor Sayfaları Geliştirme Planı

## 1. Amaç ve ürün sınırı

BM, TM ve yönetici raporları aynı tasarım ailesine taşınacak; ancak her rolün veri kapsamı ve karar ihtiyacı ayrı tutulacaktır.

- **Raporlar:** Saha ne yaptı, hangi sonuçları üretti?
- **HBLigi:** Saha diğerlerine göre nerede, ilerlemek için hangi farkı kapatmalı?
- **Analiz:** Hangi değişkenler bu sonucu doğurdu?

Bu ayrım nedeniyle raporlardaki mükerrer HBLigi tabloları kaldırılacak; yerlerine kısa bir durum özeti ve **HBLigi'nde İncele** bağlantısı konacaktır.

## 2. Güvenli başlangıç ve mevcut durum kaydı

- Başlangıç ve geri dönüş noktası `3b259b0` commit'idir.
- BM, TM ve yönetici ekranlarının tam ekran ve dar ekran görüntüleri alınacaktır.
- Her rolün mevcut API çıktısı kaydedilecektir.
- Bu aşamada kod veya veritabanı değişikliği yapılmayacaktır.

**Exit noktası E0:** Mevcut çalışan hâl bütünüyle korunur.

## 3. Metrik doğruluk denetimi

Her sorgu Supabase'e ayrı ayrı verilecek; sonuçlar toplandıktan sonra birlikte değerlendirilecektir.

### 3.1 BM denetimi

- Bölgedeki toplam ve aktif UTT sayısı
- Tamamlanmış izleme ve gerçek izlenme fırsatı
- İzleme oranının pay ve payda doğruluğu
- Kazanım, kayıp ve net puan bileşenleri
- Bölgenin takım sonucuna katkısı
- Gönderilen, tamamlanan ve bekleyen öneriler
- Ürün bazlı performans
- Yayın sayısı ve hedeflenmiş yayın kapsamı
- Beğeni ve favorinin bölge mi takım mı kapsamında olması gerektiği
- Kalan sipariş puanının BM'in kişisel bakiyesi olduğu doğrulaması

### 3.2 TM denetimi

- Takımdaki toplam ve aktif UTT sayısı
- Bölge bazlı toplamlar
- Takım kazanım, kayıp ve net puanı
- İzleme fırsatı ve izlenme oranı
- Bölge karşılaştırmalarının alt UTT toplamlarıyla eşitliği
- Öneri performansı
- Ürün bazlı bölge dağılımı
- Yayın, beğeni ve favori kapsamı

### 3.3 Yönetici denetimi

- Firma genelindeki takım, bölge ve UTT sayıları
- Aktif UTT ve tamamlanmış izleme
- Kazanım, kayıp ve net puan bileşenleri
- Üretim türü sayılarının gerçek yayına alma aksiyonundan türemesi
- Ürün ve eğitim bazlı yayın ve tüketim sonuçları
- Takım → Bölge → UTT toplamlarının birbirini tutması
- Beğeni, favori ve extra izleme değerleri
- En çok izleyen takım, bölge ve UTT değerlerinin sayısal dayanağı
- Eczanem mutabakatının firma kapsamı

**Exit noktası E1:** Yalnızca doğruluk raporu oluşur; çalışan sisteme dokunulmaz.

## 4. Metrik sözleşmesi

Doğrulanan her değer için aşağıdaki alanları içeren açık bir sözleşme hazırlanacaktır:

- İş anlamı
- Veri kaynağı
- Tarih alanı
- Periyot filtresi
- Rol kapsamı
- Pay ve payda
- Boş veri davranışı
- Arayüz etiketi

Örnek tanımlar:

- `aktif_utt`: Seçili periyotta en az bir gerçek tamamlanmış izleme yapan UTT.
- `izlenme_orani`: Benzersiz tamamlanmış UTT-yayın çifti / uygun UTT-yayın fırsatı.
- `net_puan`: Tüm kazanımlar − tüm kayıtlı kayıplar.
- `toplam_yayin`: İlgili kapsama sunulmuş kanonik canlı yayın sayısı.

Bu sözleşmeler rol bazlı TypeScript tiplerine dönüştürülecek ve rapor veri katmanlarındaki `any` kullanımları kaldırılacaktır.

## 5. Veri ve API katmanının düzeltilmesi

İlgili veri katmanları:

- `lib/rapor/bm/getBmData.ts`
- `lib/rapor/tm/getTmData.ts`
- `lib/rapor/yonetici/getYoneticiData.ts`

İlgili API uçları:

- `/raporlar/api/bm`
- `/raporlar/api/tm`
- `/raporlar/api/yonetici`
- `/raporlar/api/yonetici/akordeon`

Yapılacaklar:

- Kapsam sunucuda kimlik ve rol üzerinden çözülecektir.
- İstemciden gelen firma, takım veya bölge kimliği yetki kaynağı olmayacaktır.
- BM bölge, TM takım, yönetici firma sınırında tutulacaktır.
- Üst rol toplamları tarayıcıda alt satırları toplayarak üretilmeyecektir.
- N+1 HBLigi ve özet sorguları kaldırılacaktır.
- Yönetici akordeonu seçili periyodu taşıyacaktır.
- Mevcut `2000-01-01` tarihinden bugüne kadar olan aralığı “anlık” kabul eden yaklaşım kaldırılacaktır.
- Sessizce boş diziye düşen hatalar görünür hata sözleşmesine dönüştürülecektir.
- BM, TM ve yönetici için ortak periyot tanımı kullanılacaktır.
- Eczanem'in kendi dönem seçicisi ve özel veri gizliliği korunacaktır.

**Exit noktası E2:** Yeni veri sözleşmesi eski arayüzle uyumlu çalışır. Görsel dönüşüm başlamadan doğruluk testi yapılabilir.

## 6. Paylaşılan görsel sistem

UTT ve üretici raporlarında oluşan tasarım dili referans alınacak; ekranların birebir kopyası yapılmayacaktır.

Öngörülen paylaşılan bileşenler:

- `ReportShell`
- `ReportHeader`
- `PeriodSelector`
- `MetricCard`
- `PointComposition`
- `ScopeActivity`
- `PerformanceTable`
- `DistributionChart`
- `EmptyState`
- `ErrorState`
- `HBLigiLink`
- Mevcut `EczanemDokumBolumu`

Tasarım kuralları:

- İnce ve yumuşak dış sınırlar kullanılacak; kart içinde gereksiz çizgi bulunmayacaktır.
- Sayılar güçlü, açıklamalar ikincil görsel hiyerarşide olacaktır.
- Uzun stat kart metinleri yerine kısa metrik ve bağlam gösterilecektir.
- Grafik, tablo ve kart aynı veriyi gereksiz yere tekrarlamayacaktır.
- Masaüstünde dashboard bütünlüğü, dar ekranda yatay taşma olmadan doğal akış sağlanacaktır.
- Bir kart yalnızca gerçekten detay açıyorsa etkileşimli olacaktır.

## 7. BM raporu

### 7.1 Bölge Performansı

- Net puan
- Kazanılan puan
- Gerçekleşmiş kayıp
- Aktif UTT / toplam UTT
- İzlenme oranı

### 7.2 Puanın Bileşimi

- Kazanım ve kayıp dağılımı
- Pasta veya yatay sütun grafik
- İzleme, cevaplama, öneri, ileri sarma ve yanlış cevap kırılımı

### 7.3 Bölgemde Kim Ne Yaptı?

- UTT tablosu
- İzleme, kazanım, kayıp, net puan ve aktiflik
- UTT detayına güvenli drill-down

### 7.4 Öneri Etkinliği

- Gönderilen, tamamlanan ve bekleyen öneriler
- Tamamlanma oranı
- Süresi geçen öneriler

### 7.5 Ürün Bazlı Sonuçlar

- Ürünlerin izleme ve puan dağılımı
- Ürünsüz kayıtların ayrı ve açık etiketlenmesi

### 7.6 İçerik Etkileşimi

- Beğeni ve favori
- Kapsam kararı doğrulandıktan sonra bölge veya takım düzeyi

### 7.7 Kişisel alan

- Kalan sipariş puanı ana bölge KPI'larından ayrılacaktır.
- BM'in kişisel kullanım bilgisi olarak ikincil bir kartta gösterilecektir.

### 7.8 Eczanem Mutabakatı

- Mevcut kapsam ve mahremiyet kuralları korunacaktır.

**Exit noktası E3:** BM raporu bağımsız geri alınabilir durumda tamamlanır.

## 8. TM raporu

Önerilen yapı:

1. Takım performans özeti
2. Kazanım ve kayıp bileşimi
3. Bölge karşılaştırma grafiği
4. Bölge → UTT açılım tablosu
5. Öneri etkinliği
6. Ürün bazlı bölge dağılımı
7. Beğeni ve favori
8. Eczanem takım mutabakatı
9. HBLigi'ne yönlendirme

TM ekranının temel karar sorusu şudur: **Hangi bölge iyi gidiyor, hangisinde ve hangi UTT'lerde müdahale gerekiyor?**

**Exit noktası E4:** TM dönüşümü BM'den bağımsız geri alınabilir.

## 9. Yönetici raporu

Yönetici ekranı iki ana perspektife ayrılacaktır.

### 9.1 Üretim

- Yayına alınan toplam içerik
- İçerik türü dağılımı
- Ürün ve eğitim bazlı yayınlar
- Üretimden tüketime dönüşüm
- Beğeni ve favori
- En çok karşılık bulan içerikler

### 9.2 Saha tüketimi

- Firma kazanım, kayıp ve net puanı
- Aktif UTT / toplam UTT
- Tamamlanan izleme / izleme fırsatı
- Takım karşılaştırması
- Takım → Bölge → UTT lazy-load tablosu
- Ürün ve içerik türü dağılımı

“En çok izleyen takım/bölge/UTT” kartları yalnız isim göstermeyecek; isim, gerçekleşen değer ve karşılaştırma bağlamı birlikte sunulacaktır.

Yönetici raporuna ortak periyot seçici eklenecektir. Üretim ve tüketim aynı seçili tarih aralığını kullanacak; Eczanem mutabakatı bağımsız dönem mantığını koruyacaktır.

**Exit noktası E5:** Yönetici raporu ayrı geri dönüş noktasına sahip olur.

## 10. HBLigi tekrarının kaldırılması

BM ve TM raporlarındaki eski lig sıralamalarının kaldırılma gerekçeleri:

- Yeni HBLigi ile aynı sıralama motorunu kullanmamaları
- Eşit puan/eşit sıra davranışından ayrışabilmeleri
- Gereksiz RPC ve N+1 sorguları üretmeleri
- Rapor ile lig görevlerini birbirine karıştırmaları

Bu bölümler kaldırılacak; yerlerine seçili periyot için kısa bir saha sinyali ve HBLigi bağlantısı konacaktır. Lig hesabı yalnız HBLigi'nde yaşayacaktır.

## 11. Kontrol ve kapanış

### 11.1 Veri kontrolü

- Arayüz ↔ API ↔ kanonik SQL eşitliği
- Alt satır toplamı ↔ üst kapsam eşitliği
- Periyot sınırları
- Sıfır veri ve boş kapsam senaryoları

### 11.2 Teknik kontrol

- TypeScript kontrolü
- Veritabanı ve mimari denetim
- Mimari lint
- Değişen dosyalarda ESLint
- Rol, kapsam ve firma sınırı testleri

### 11.3 Chrome kullanıcı kontrolü

- BM, TM ve yönetici hesabıyla gerçek ekran turu
- Tam ekran ve dar ekran kontrolü
- Bir başarılı akış ve bir ret/yetki akışı
- Son aşamada insan görsel kontrolü

## 12. Commit ve geri dönüş düzeni

Çalışma aşağıdaki bağımsız commit'lere ayrılacaktır:

1. Metrik ve API doğruluğu
2. BM raporu
3. TM raporu
4. Yönetici raporu
5. Dokümantasyon ve test düzenlemeleri

Her commit ayrı bir geri dönüş noktası olacaktır. Commitler kullanıcı onayıyla atılacak ve açık push izni olmadan uzak depoya gönderilmeyecektir.
