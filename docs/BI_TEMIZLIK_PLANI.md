# bi — Küçültme ve Yeniden Kurma Kaydı

Tarih: 9 Eylül 2026  
Başlangıç sürümü: `b20df69`  
İlk temizlik: `2172c41`
Durum: ESKİ MOTOR KALDIRILDI — YENİ SÖZLEŞME KURULUYOR

## Karar

Önceki asistan geliştirmesi kullanıcı ölçümüne göre 120 saati aştı ve HapBilgi'nin diğer işlerini geciktirdi. Gemini ile soru anlamlandırma, deterministik işlem ve AI yorumu arasındaki ayrım istenen güvenilirliğe ulaşmadı. Kelime bağımlılığı, fazla kısıt, tutarsız yorum ve benzer sorularda gelişmeyen davranış nedeniyle Gemini ilişkisi Antigravity ile sonlandırıldı.

İlk teknik temizlikte kullanılmayan AI/anlama/yorum modülleri, sohbet belirteci ve arayüz artıkları kaldırıldı. Sonraki inceleme, geride kalan deterministik motorun da yeni başlangıç kapsamından büyük olduğunu ve rehber, ölçüt, kırılım, zaman, plan, kanıt ve yanıt katmanlarında eski karmaşıklığı taşıdığını gösterdi.

Bu nedenle motoru yerinde daraltma kararı bırakıldı. Uygulama önce eski soru motorundan temizlenecek, ardından yalnız iki açık sözleşmeyle yeniden kurulacak:

- **NEDİR:** Onaylı HapBilgi kavramını sabit metinle açıklar; varsa ilgili sayfayı gösterir. Kullanıcı verisi okumaz.
- **KAÇ:** Açıkça tanınan ölçüt, dönem ve sunucunun belirlediği yetki kapsamı ile sayısal sonuç verir. Eksik öğeyi tahmin etmez ve sessiz varsayılan sorgu üretmez.

Bu iki sözleşmeye girmeyen sorular veri sorgusu çalıştırmadan desteklenen örnekleri gösterir. AI yorumlama, sıralama, karşılaştırma, neden analizi, öneri, eğilim, serbest sohbet ve konuşmadan öğrenme bu başlangıç kapsamının dışındadır.

## Korunan sınırlar

- Sağ alttaki `bi` düğmesi, sohbet penceresi, istemci mesajları ve istek iptali.
- `/api/hapbi/sor` adresi ve yalnız `soru` alanını taşıyan istek biçimi.
- Her istekte Supabase oturumu, aktif kimlik ve rol doğrulaması.
- `kullanici` kimlik türündeki desteklenen iç roller için erişim; admin, İçerik Üreticisi, E-Club kişi ve Eczanem üye kimlikleri dışarıda kalır.
- İstemciden gelen rol veya organizasyon bilgisini yetki kaynağı kabul etmeme.

## Kaldırılan eski motor

Bağımlılık denetiminde `lib/hapbi` dışındaki tek çalışma zamanı bağlantılarının API route'u ile maskot erişim kontrolü olduğu doğrulandı. Erişim kuralı küçük ve bağımsız `lib/bi/erisim.ts` modülüne taşındı; ardından aşağıdaki eski katmanlar tümüyle kaldırıldı:

- Basit sorgu çözücü ve ortak sorgu sözleşmesi.
- Kapsam, rol, ölçüt, kırılım, zaman ve işlem katalogları.
- Kaynak planlama, sorgu çalıştırma, doğrulama ve kanıt motoru.
- Rehber çözücü ile rehber kataloğu.
- Sayısal yanıt, kaynak ve belirsizlik üreticileri.
- Eski motorun davranışını koruyan geçici temizlik sınaması.

Git geçmişi geri dönüş kaynağıdır; silinen kod uygulama içinde yedeklenmez.

## Uygulama sırası

1. Eski motorun bağımlılıklarını doğrula ve motoru ayrı commit olarak kaldır.
2. Yeni `NEDİR` sözleşmesini küçük, sabit bir katalog ve kesin kabul kalıplarıyla kur.
3. Yeni `KAÇ` sözleşmesini açık ölçüt ve dönemlerle kur; yetki kapsamını yalnız sunucuda çöz.
4. Kabul edilen örnekleri, destek dışı soruları, yetki ve veri hatalarını sınayan odaklı testler ekle.
5. Tür denetimi ve değişen kodun ESLint kontrolünü çalıştır; canlı veritabanına yazma, deploy veya AI çağrısı yapma.

## Başarı ölçütü

Başarı özellik sayısı değildir. Üzerinde anlaşılan az sayıdaki sorunun doğru, aynı girdide aynı sonucu veren, açıklanabilir ve yetki sınırlarını aşmayan cevaplar üretmesidir. Yeni bir soru ailesi ancak kendi kabul örnekleri ve veri sözleşmesi belirlendikten sonra eklenir.

## Uygulama kaydı

- [x] İlk AI/anlama/yorum temizliği tamamlandı (`2172c41`).
- [x] Eski deterministik motorun uygulama dışı bağımlılıkları denetlendi.
- [x] Görünür sohbet kabuğu ile erişim sınırı eski motordan ayrıldı.
- [x] `lib/hapbi` altındaki 21 eski motor dosyası kaldırıldı.
- [ ] Eski motoru kaldıran bağımsız commit oluşturulacak.
- [ ] Yeni `NEDİR` sözleşmesi uygulanacak ve doğrulanacak.
- [ ] Yeni `KAÇ` sözleşmesi uygulanacak ve doğrulanacak.
