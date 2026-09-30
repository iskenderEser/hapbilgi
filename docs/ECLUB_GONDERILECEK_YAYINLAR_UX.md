# Gönderilecek Yayınlar — UX çalışma notu

29 Eylül 2026: Hedef kitle kartları ilgili grubun yayındaki toplam yayın sayısını gösterir. Takvim periyodu yoktur; yayın havuzu değiştiğinde sayı değişir. Gönderim yapmak karttaki toplamı azaltmaz.

Listenin üstündeki kapsül:

- Tümü: seçili hedef kitle grubunun yayındaki yayınları.
- Gönderime Hazır: mevcut alıcı listesinde hedef role uygun, aktif ve giriş hesabı bulunan; aynı içerik için yeniden gönderim engeli bulunmayan en az bir alıcısı olan yayınlar.
- Gönderilenler: UTT'nin öneri geçmişinde yer alan ve şu anda uygun gönderim alıcısı kalmayan yayındaki yayınlar.

Kapsüldeki sayılar seçili hedef kitleye göre hesaplanır. Gönderime Hazır ile Gönderilenler birbirini dışlar: başka bir alıcıya veya tekrar süresi dolmuş alıcıya gönderim mümkünse yayın Gönderime Hazır'a geçer. Tekrar süresi sayfa açıkken dolarsa filtre kendiliğinden güncellenir. Uygun alıcısı bulunmayan ve hiç gönderilmemiş yayın yalnız Tümü'de yer alır. Gönderim geçmişi ayrı Gönderilen Yayınlar sayfasında korunur. Gönderim sonunda mevcut veri yenileme akışı filtreleri ve sayaçları günceller. Nihai gönderim uygunluğu sunucuda yeniden kontrol edilir.

Sayfa rehberi üç kısa maddeyle yeni kart ve filtre davranışına uyarlanmıştır.

Gönderim geçmişi için mevcut **Gönderilen Yayınlar** sekmesi kullanılır; ayrıca bir **Gönderdiklerim** alanı açılması planlanmıyor.

## Yayın rafı ve koşullar

UTT ana sayfasında kullanılan `YayinKarti` temel alınır. Kapak ve ürün adı altında yayın puanı ile doğrudan `yayin_yonetimi` kaydından alınan yayın koşulları gösterilir. Kişi/gönderim sayısı gönderilecek kartında gösterilmez; gönderim geçmişi ayrı Gönderilen Yayınlar sayfasında izlenir. Karttaki kutu, yayını gönderim için seçer. Mobil akışta başlangıçta iki kart gösterilir; diğerleri Daha Fazla Göster ile açılır.

Hedef kitle kartları ve durum kapsülü korunur. Kapsülün yanındaki ortak gönderim alanı seçilen yayınları sayar, alıcıları tekli/çoklu seçtirir ve seçilen yayınları mevcut atomik gönderim API'si üzerinden sırayla gönderir. Birden fazla yayın seçildiğinde yalnız hepsine uygun ve yeniden gönderim engeli olmayan kişiler seçilebilir. Gönderimden sonra seçim temizlenir; açık filtre korunur ve yayın kalan uygun alıcı durumuna göre ilgili listede görünür.

- Çeksiz Puan: yalnız lig puanına eklenir; çek dönüşümü ve sipariş baremleri gösterilmez.
- Çekli Puan: sipariş zorunlu veya isteğe bağlı bilgisi gösterilir. Puan/TL dönüşümü gönderilecek yayın kartında gösterilmez; isteğe bağlı siparişte çek tutarındaki yüzde artışı gösterilir.
- Sipariş baremleri `200–399 puan → 10+1` biçimindedir; adet ve MF sözcükleri eklenmez.

Eksik koşullar zorunlu sipariş veya yüzde 20 gibi varsayımlarla doldurulmaz. Koşul sorgusu başarısızsa API hata döndürür. E-Club üyesinin puan kazanımı ve çek talebi ekranları bu tasarım değişikliğinin kapsamında değildir.

Başlangıç/bitiş tarihleri yayına ortak bir süre gibi sunulmaz. Puan kazanma süresi alıcıya yapılan gönderime bağlıdır; üye ekranında ve gönderim/rapor takibinde değerlendirilir. Gönderilecek Yayınlar kartında tarih önizlemesi bulunmaz.
