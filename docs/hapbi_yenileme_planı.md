# HapBi Yenileme Planı

## Değişmez sınırlar

- HapBi maskotu ve mevcut sohbet alanı korunacak.
- Sohbet alanı yeniden tasarlanmayacak.
- İçerik Üreticisi, Admin ve Eczanem üyesi HapBi geliştirme kapsamına alınmayacak.
- HapBilgi’nin mevcut veri üretme, yetkilendirme ve iş süreçleri değiştirilmeyecek.
- Gemini veritabanını sorgulamayacak, sorgu planlamayacak ve çalıştırılacak sorguya karar vermeyecek.
- Sayısal sonuçlar yalnız deterministik kod ve veritabanı işlemleriyle üretilecek.
- Sayısal sorularda Gemini çağrısı `0` olacak.
- Yorum gereken sorularda Gemini en fazla `1` kez çağrılacak.
- Sabit soru tarifleri oluşturulmayacak.
- Temel sorgu yapısı şu olacak:

> **Rol kapsamı + zaman + ölçüt + kırılım + sorgu işlem kategorisi + sıralama/filtre koşulu**

- Her faz ve her alt iş için başlamadan önce ayrı onay alınacak.
- Her faz sonunda yapılan işler belgeye yazılacak, tamamlanma işareti konulacak ve commit için ayrıca onay istenecek.

---

## - [ ] Faz 1 — Gerçek veri kaynaklarının çıkarılması

### Amaç

HapBi’nin kullanacağı gerçek HapBilgi verilerini ve bunların teknik anlamlarını kesinleştirmek.

### Yapılacak işler

1. İlgili veritabanı tabloları, görünümleri ve mevcut ortak işlevler belirlenecek.
2. Her veri kaynağı için şu bilgiler çıkarılacak:

   - Kaynağın adı
   - Ürettiği veri
   - Ana kimlik alanı
   - İlişki kurduğu diğer kaynaklar
   - Kullanılacak zaman alanı
   - Boş bırakılabilen alanlar
   - Toplanabilir ve sayılamaz alanlar
   - Veriyi üreten kullanıcı veya olay
3. Ürün, yayın, izleme, beğeni, favori, soru-cevap ve puan kayıtlarının birbirleriyle ilişkisi çıkarılacak.
4. Aynı ürünün farklı yayınlarının ayrı yayın kimlikleri taşıdığı kesin biçimde korunacak.
5. Kullanılabilir veriler ile henüz üretilemeyen veriler ayrılacak.
6. Salt okunur SQL komutları hazırlanacak; komutları kullanıcı çalıştıracak.
7. Sonuçlar bir veri kaynakları tablosuna dönüştürülecek.

### Çıkış koşulu

HapBi’nin hangi sonucu hangi gerçek kaynaktan üreteceği belirsiz kalmayacak.

---

## - [ ] Faz 2 — Rol ve kapsam haritasının kurulması

### Amaç

Her kullanıcının hangi kişi, takım, bölge, firma, ürün ve yayın verilerini görebileceğini belirlemek.

### Yapılacak işler

1. Rol ve yetkiler için tek geçerli kaynak olarak Bluebook kullanılacak.
2. Gerçek oturum ve rol çözümleme kodları Bluebook ile karşılaştırılacak.
3. Her kapsam içindeki izinli kimlikler sunucuda çözülecek:

   - Kullanıcının kendi kimliği
   - Bağlı olduğu takım
   - Bağlı olduğu bölge
   - Bağlı olduğu firma
   - Sorumlu olduğu ürünler
   - Görebileceği yayınlar
4. Kullanıcının yazdığı firma, takım, bölge veya kişi kimliği doğrudan güvenilir kabul edilmeyecek.
5. Kapsam dışı kimlikler sorguya eklenmeden reddedilecek.
6. İçerik Üreticisi, Admin ve Eczanem üyesi bu haritaya dahil edilmeyecek.
7. Rol × görülebilir kırılım tablosu hazırlanacak.

### Planlanan kod alanı

- `lib/hapbi/kapsam.ts`
- `lib/hapbi/roller.ts`

### Çıkış koşulu

Her desteklenen rol için görülebilir veri kapsamı sunucu tarafından kesin olarak üretilecek.

---

## - [ ] Faz 3 — Zaman modelinin kurulması

### Amaç

Kullanıcının zaman ifadelerini HapBilgi zaman kurallarına göre kesin başlangıç ve bitiş aralığına çevirmek.

### Yapılacak işler

1. HapBi kapsamında şu zaman birimleri desteklenecek:

   - Hafta
   - Ay
   - Dönem
   - Yıl

2. Gün, HapBi deterministik sorgu kapsamına alınmayacak.
3. Zaman sınırları Türkiye saatine göre hesaplanacak.
4. Hafta pazartesi başlayıp pazar günü bitecek.
5. Ay, takvim ayının ilk ve son gününü kapsayacak.
6. Dönemler şöyle hesaplanacak:

   - Ocak–şubat–mart
   - Nisan–mayıs–haziran
   - Temmuz–ağustos–eylül
   - Ekim–kasım–aralık

7. Yıl, 1 Ocak ile 31 Aralık arasını kapsayacak.
8. “Son” ifadesi en son tamamlanmış zaman aralığını gösterecek.
9. `dönem`, `çeyrek`, `kuartır` ve `quarter` aynı zaman türüne bağlanacak.
10. `3 ay` ifadesi dönem eş anlamlısı olarak kullanılmayacak.
11. Veritabanı sorgularında başlangıç dahil, bitiş hariç zaman aralığı kullanılacak.
12. Bağımsız yeni soru, önceki sorunun zamanını kendiliğinden devralmayacak.
13. Yalnız devam sorusu olduğu kesinleşen ifadeler önceki zaman bilgisini kullanabilecek.

### Planlanan kod alanı

- `lib/hapbi/zaman.ts`
- `lib/hapbi/zamanSozlesmesi.ts`

### Çıkış koşulu

Desteklenen bütün zaman ifadeleri kesin başlangıç ve bitiş değerine dönüşecek.

---

## - [ ] Faz 4 — Ölçüt kataloğunun oluşturulması

### Amaç

HapBi’nin hesaplayabileceği değerleri tek ve denetlenebilir bir katalogda toplamak.

### Başlangıç ölçütleri

- Net puan
- Kazanılan puan
- Kaybedilen puan
- İzleme sayısı
- Tamamlanan izleme sayısı
- Beğeni sayısı
- Favori sayısı
- Doğru cevap sayısı
- Yanlış cevap sayısı
- İleri sarılan süre
- Katkı değeri

### Her ölçüt için tanımlanacak bilgiler

1. Ölçütün ortak adı
2. Kullanıcının kullanabileceği eş anlamlı ifadeler
3. Gerçek veri kaynağı
4. Hesaplamada kullanılacak alan
5. Sayma, toplama veya başka hesaplama yöntemi
6. Kullanılacak zaman alanı
7. Kullanılabileceği kırılımlar
8. Kullanılabileceği roller
9. Boş değerin anlamı
10. Sıfır değerin anlamı
11. Sıralama yönü
12. Sonuca dahil edilmeyecek kayıtlar

### Kurallar

- Eksik değer kendiliğinden `0` yapılmayacak.
- Olay sayısı ile farklı yayın sayısı birbirine karıştırılmayacak.
- Ürün toplamı ile tek yayın değeri birbirine karıştırılmayacak.
- Aynı adlı ürünlerin farklı yayınları kimlikleri üzerinden korunacak.

### Planlanan kod alanı

- `lib/hapbi/olcutler.ts`
- `lib/hapbi/olcutSozlesmesi.ts`

### Çıkış koşulu

Her ölçütün nereden ve nasıl hesaplandığı kesin olarak tanımlanacak.

---

## - [ ] Faz 5 — Kırılım kataloğunun oluşturulması

### Amaç

Sonuçların hangi varlıklar üzerinden gruplanabileceğini belirlemek.

### Başlangıç kırılımları

- Kullanıcı
- UTT
- Ürün
- Yayın
- Takım
- Bölge
- Firma

### Yapılacak işler

1. Her kırılımın ortak kimliği belirlenecek.
2. Görüntülenecek ad alanı belirlenecek.
3. Diğer veri kaynaklarına bağlantı alanları belirlenecek.
4. Her kırılımın kullanılabileceği roller tanımlanacak.
5. Her kırılımın kullanılabileceği ölçütler tanımlanacak.
6. Ürün ile yayın ayrı kırılımlar olarak korunacak.
7. Takım, bölge ve firma ilişkisi Bluebook’a göre kurulacak.
8. Kapsam dışında kalan kırılım birleşimleri açıkça reddedilecek.

### Planlanan kod alanı

- `lib/hapbi/kirilimlar.ts`
- `lib/hapbi/kirilimSozlesmesi.ts`

### Çıkış koşulu

Her ölçütün hangi varlıklar üzerinden gruplanabileceği kesinleşecek.

---

## - [ ] Faz 6 — Sorgu işlem kategorilerinin kurulması

### Amaç

Kullanıcının veri üzerinde yapmak istediği işlemi ortak kurallara bağlamak.

### İşlem kategorileri

| İşlem kategorisi | Teknik karşılığı |
|---|---|
| Doğrudan değer | Tek ölçütün değerini getirir |
| Toplam | Seçilen kapsamdaki değerleri toplar |
| Bütünleşik | Bir ölçütle seçim yapıp başka ölçütün değerini getirir |
| Karşılaştırma | İki varlığı veya zamanı karşılaştırır |
| Sıralama | Varlıkları seçilen ölçüte göre sıralar |
| Göreli hesaplama | Oran, pay veya dağılım üretir |
| Fark | İki değer arasındaki sayısal farkı hesaplar |
| Katkı | Toplamı oluşturan kaynakları gösterir |
| Eğilim | Değerin zaman içindeki yönünü hesaplar |
| Koşullu seçim | Belirtilen koşulu sağlayan varlıkları getirir |

### Yapılacak işler

1. Her işlem kategorisinin zorunlu alanları tanımlanacak.
2. Kullanılabilecek ölçüt ve kırılım birleşimleri belirlenecek.
3. Sıralama yönü, sonuç sınırı ve filtre koşulları tanımlanacak.
4. Bütünleşik sorgularda seçim ölçütü ile sonuç ölçütü ayrı tutulacak.
5. Karşılaştırmalı sorgularda iki tarafın kapsamı ve zamanı ayrı tanımlanacak.
6. Geçersiz birleşimler veritabanı çalıştırılmadan reddedilecek.

### Planlanan kod alanı

- `lib/hapbi/islemTurleri.ts`
- `lib/hapbi/sozlesme.ts`

### Ortak sorgu yapısı

```ts
type HapbiSorgu = {
  kapsam: RolKapsami;
  zaman: ZamanAraligi;
  olcut: Olcut;
  sonucOlcutu?: Olcut;
  kirilim: Kirilim;
  islem: IslemTuru;
  filtreler: Filtre[];
  siralama?: Siralama;
  sonucSiniri?: number;
};
```

### Çıkış koşulu

Bütün desteklenen veri soruları tek ortak sorgu yapısıyla ifade edilebilecek.

---

## - [ ] Faz 7 — Türkçe soru çözümleyicisinin kurulması

### Amaç

Kullanıcının doğal Türkçe sorusunu ortak sorgu yapısına dönüştürmek.

### Yapılacak işler

1. Türkçe büyük-küçük harf dönüşümü uygulanacak.
2. Noktalama ve gereksiz boşluklar temizlenecek.
3. Yaygın yazım farklılıkları ortak biçime çevrilecek.
4. Zaman ifadeleri çıkarılacak.
5. Ölçüt ifadeleri çıkarılacak.
6. Kırılım ifadeleri çıkarılacak.
7. İşlem kategorisi çıkarılacak.
8. Sıralama yönü ve sonuç sınırı çıkarılacak.
9. Açıkça yazılan ürün, yayın, takım veya bölge ifadeleri çözülecek.
10. Birden fazla ifadeyle eşleşen parçalar en özel anlam üzerinden değerlendirilecek.
11. Basit kelime içerme kontrolü yerine tanımlı ifade ve bağlam kuralları kullanılacak.
12. Çözülen parçalar `HapbiSorgu` yapısına dönüştürülecek.
13. Tahmin gerektiren alanlar doldurulmayacak.

### Planlanan kod alanı

- `lib/hapbi/dil/normalizasyon.ts`
- `lib/hapbi/dil/sozluk.ts`
- `lib/hapbi/dil/derleyici.ts`

### Çıkış koşulu

Aynı anlamdaki farklı Türkçe sorular aynı ortak sorgu yapısına dönüşecek.

---

## - [ ] Faz 8 — Deterministik sorgu motorunun kurulması

### Amaç

Ortak sorgu yapısını güvenli veritabanı işlemine dönüştürmek.

### Yapılacak işler

1. Ölçüt, kırılım, kapsam ve zaman bileşenleri ayrı ayrı doğrulanacak.
2. Sorgular kullanıcı cümlesine göre değil, ortak sorgu yapısına göre oluşturulacak.
3. İzin verilen tablo, görünüm, alan ve bağlantılar beyaz listeyle sınırlandırılacak.
4. Kullanıcı metni doğrudan SQL içine yazılmayacak.
5. Bütün değişken değerler güvenli sorgu parametresi olarak gönderilecek.
6. Rol kapsamı bütün sorgulara zorunlu koşul olarak eklenecek.
7. Zaman aralığı doğru olay alanına uygulanacak.
8. Ölçüte göre toplama, sayma, gruplama ve sıralama işlemleri kurulacak.
9. Her işlem kategorisi aynı bileşenleri kullanacak.
10. Doğal dil sorularına özel sabit sorgu tarifleri oluşturulmayacak.
11. Veri alanları için konu bazlı bağlantı katmanları kullanılacak.
12. Sonuç ortak bir veri yapısında döndürülecek.

### Planlanan kod alanı

- `lib/hapbi/motor/sorguOlustur.ts`
- `lib/hapbi/motor/calistir.ts`
- `lib/hapbi/motor/veriKaynaklari.ts`

### Çıkış koşulu

Geçerli ortak sorgular Gemini kullanılmadan veritabanında çalıştırılabilecek.

---

## - [ ] Faz 9 — Veri doğrulama ve kanıt katmanının kurulması

### Amaç

Üretilen sayısal sonuçların kaynağını ve doğruluğunu denetlenebilir hale getirmek.

### Yapılacak işler

1. Boş değer ile gerçek `0` birbirinden ayrılacak.
2. Tekil kayıt sayısı ile olay sayısı ayrılacak.
3. Ürün, yayın ve kullanıcı kimlikleri üzerinden mükerrer kayıt denetimi yapılacak.
4. Toplamın alt satırlarla uyumu kontrol edilecek.
5. Sıralama sonucunun kullanılan ölçütle uyumu kontrol edilecek.
6. Karşılaştırma ve fark işlemleri iki doğrulanmış değer üzerinden hesaplanacak.
7. Her sonuç için kullanılan veri kaynağı kaydedilecek.
8. Sonucu destekleyen kısa kanıt satırları oluşturulacak.
9. Doğrulanamayan sonuç kullanıcıya kesin bilgi olarak verilmeyecek.

### Planlanan kod alanı

- `lib/hapbi/motor/dogrula.ts`
- `lib/hapbi/motor/kanit.ts`

### Çıkış koşulu

Her sayısal sonuç, kaynağı ve hesaplama bileşenleriyle doğrulanabilir olacak.

---

## - [ ] Faz 10 — Deterministik cevap ve belirsizlik yönetimi

### Amaç

Doğrulanmış sonucu kullanıcıya kısa ve doğru biçimde aktarmak.

### Yapılacak işler

1. Tek değer cevapları hazırlanacak.
2. Toplam cevapları hazırlanacak.
3. Sıralama cevapları hazırlanacak.
4. Karşılaştırma ve fark cevapları hazırlanacak.
5. Dağılım, oran ve katkı cevapları hazırlanacak.
6. Eğilim cevapları hazırlanacak.
7. Sonuç bulunamaması ile sorgunun desteklenmemesi ayrılacak.
8. Yalnız eksik olan bilgi sorulacak.
9. Eksik kırılım için zaman sorulmayacak.
10. Eksik zaman için kırılım sorulmayacak.
11. Bağımsız soru önceki sorgunun bilgilerini devralmayacak.
12. Devam soruları yalnız önceki eksik alanı tamamlayacak.
13. Sayısal cevaplar Gemini’ye gönderilmeyecek.
14. Cevapta kullanılan kapsam ve zaman açıkça belirtilecek.

### Planlanan kod alanı

- `lib/hapbi/yanit/sayisal.ts`
- `lib/hapbi/yanit/belirsizlik.ts`
- `lib/hapbi/yanit/kaynaklar.ts`

### Çıkış koşulu

Desteklenen sayısal sorular doğrudan ve tek anlamlı cevaplanacak.

---

## - [ ] Faz 11 — Tek çağrılı yorum katmanının kurulması

### Amaç

Yalnız değerlendirme ve öneri isteyen sorularda Gemini’den yararlanmak.

### Yapılacak işler

1. Önce deterministik sonuç üretilecek.
2. Doğrulanmış kısa bir yapılandırılmış veri paketi hazırlanacak.
3. Pakette yalnız şunlar bulunacak:

   - Kullanıcının sorusu
   - Sunucunun belirlediği kapsam
   - Zaman
   - Doğrulanmış bulgular
   - Seçilmiş kanıtlar
   - Yorum sınırları
4. Gemini’ye şunlar verilmeyecek:

   - SQL erişimi
   - Sorgu oluşturma yetkisi
   - Veri kaynağı seçme yetkisi
   - Rol veya kapsam belirleme yetkisi
   - Büyük ham veri
   - Birden fazla çağrı döngüsü
5. Yorum sorusunda model en fazla bir kez çağrılacak.
6. Modelin yeni sayı üretmesi engellenecek.
7. Kanıtsız neden üretmesi engellenecek.
8. Kapsam dışı kişi, takım, bölge veya firma bilgisi üretmesi engellenecek.
9. Puan satış başarısı veya mesleki yeterlilik olarak yorumlanmayacak.
10. Desteklenmeyen veri sorgusu doğrulanmamış cevap üretmesi için Gemini’ye bırakılmayacak.

### Planlanan kod alanı

- `lib/hapbi/yanit/yorumPaketi.ts`
- `lib/hapbi/yanit/yorum.ts`
- `lib/hapbi/yanit/yorumDogrulama.ts`

### Çıkış koşulu

Sayısal sorularda model çağrısı `0`, yorum sorularında en fazla `1` olacak.

---

## - [ ] Faz 12 — Sunucu ve sohbet bağlantısının kurulması

### Amaç

Yeni motoru korunan HapBi sohbet alanına bağlamak.

### İşlem sırası

1. Oturum doğrulanacak.
2. Rol kapsamı çözülecek.
3. Kullanıcı sorusu ortak sorgu yapısına dönüştürülecek.
4. Zorunlu alanlar doğrulanacak.
5. Deterministik sorgu çalıştırılacak.
6. Sonuç ve kanıtlar doğrulanacak.
7. Sayısal cevap doğrudan üretilecek.
8. Yorum gerekiyorsa tek çağrılı yorum katmanı çalıştırılacak.
9. Cevap sohbet alanına gönderilecek.

### Yapılacak dosya çalışmaları

- `app/api/hapbi/sor/route.ts` yeni motora bağlanacak.
- Korunan HapBi sağlayıcısı yeni cevap sözleşmesine bağlanacak.
- Korunan sohbet alanı yeni cevapları gösterecek.
- Maskotun görünümü ve açılma davranışı değiştirilmeyecek.
- Geçici “motor kapalı” cevabı kaldırılacak.
- Bağımsız soru ve devam sorusu ayrımı uygulanacak.

### Çıkış koşulu

Yeni motor mevcut HapBi maskotu ve sohbet alanı üzerinden kullanılabilir olacak.

---

## - [ ] Faz 13 — Kapsam matrisi, sınamalar ve canlı doğrulama

### Amaç

Sistemin desteklediği bütün birleşimleri görünür ve doğrulanabilir hale getirmek.

### Yapılacak işler

1. Şu birleşimlerin tamamı tabloya dökülecek:

> **Rol × zaman × ölçüt × kırılım × işlem kategorisi**

2. Her birleşim için şu durumlardan biri yazılacak:

   - Destekleniyor
   - Veri kaynağı yok
   - Rol kapsamı dışında
   - Ölçüt ve kırılım uyumsuz
   - Henüz geliştirilmedi
3. Her desteklenen birleşim için en az bir doğru soru hazırlanacak.
4. Aynı sorunun farklı Türkçe yazımları sınanacak.
5. Yetkisiz kapsam sorguları sınanacak.
6. Eksik bilgi soruları sınanacak.
7. Bağımsız soru ile devam sorusu ayrımı sınanacak.
8. Boş değer ve gerçek sıfır ayrımı sınanacak.
9. Ürün ile yayın ayrımı sınanacak.
10. Sayısal sorularda Gemini çağrısının `0` olduğu doğrulanacak.
11. Yorum sorularında model çağrısının en fazla `1` olduğu doğrulanacak.
12. Modelin yeni sayı veya kanıtsız neden üretemediği doğrulanacak.
13. Her desteklenen rol ile canlı soru-cevap denemeleri yapılacak.
14. Sonuçlar doğrudan veritabanı sorgularıyla karşılaştırılacak.
15. Cevap süresi ve model maliyeti ölçülerek raporlanacak.

### Son çıkış koşulu

- Desteklenen bütün sayısal sorular doğrulanmış veriden cevaplanacak.
- Sayısal sorularda Gemini kullanılmayacak.
- Yorum sorularında yalnız doğrulanmış kanıtlar kullanılacak.
- Rol ve veri kapsamı ihlal edilemeyecek.
- Desteklenen ve desteklenmeyen sorgular açık kapsam tablosunda görülebilecek.
- HapBi maskotu ve mevcut sohbet alanı korunmuş olacak.

Bu plan henüz uygulamaya alınmadı.
