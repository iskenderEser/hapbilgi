# bi — Kontrollü Temizlik Planı

Tarih: 9 Eylül 2026  
Başlangıç sürümü: `b20df69`  
Durum: YEREL KOD TEMİZLİĞİ TAMAMLANDI — deterministik iyileştirmeler sırada

## Karar ve amaç

Kullanıcının aktardığı ölçüme göre önceki asistan geliştirmesi 120 saati aşmış, HapBilgi'nin diğer işlerinin ilerlemesini de geciktirmiştir. Soruyu anlamlandırma ve AI yorumu ayrımı istenen biçimde kurulamamış; kelime bağımlılığı, fazla kısıt, tutarsız yorumlar ve benzer sorularda gelişmeyen davranış nedeniyle Gemini ilişkisi Antigravity ile kaldırılmıştır. Bu kayıt kullanıcının deneyimidir; koddan çıkarılmış bir süre ölçümü değildir.

bi'nin başlangıç kapsamı: kavramları açıklamak, ilgili ekranı göstermek ve yetkili HapBilgi verilerinden basit sayısal soruları yanıtlamak. AI'yı geri bağlamak bu çalışmanın hedefi değildir. İleride ancak belirli bir ihtiyaca ölçülebilir katkı sağlayan ayrı bir çalışma olarak değerlendirilebilir.

## 1. Korunacak çalışan bölüm

- Mevcut bi görünümü, sohbet açma/kapatma, mesaj listesi, temizleme ve istek iptali.
- `/api/hapbi/sor` adresi; Supabase oturumu, aktif kimlik, rol ve organizasyon kapsamı kontrolleri.
- Rehber kataloğu, basit sorgu çözücü, ölçüt/kırılım/zaman sözleşmeleri.
- Veri kaynağı izinleri, sorgu planı, hesaplama, eksik veri kontrolü, kanıt ve kaynaklı sayısal cevap.
- Ortak HapBilgi rolleri, lig, rapor, üretim ve öğrenme verileri.

Teknik `hapbi` dosya ve fonksiyon adları topluca yeniden adlandırılmayacak. Bu turda deterministik motorun ortak kullanılan dalları yeniden yazılmayacak.

## 2. Kaldırılacak kullanım dışı kod

Aktif API ve arayüzden çağrılmadığı, başka modüllerin de kullanmadığı doğrulanan dosyalar:

1. `lib/hapbi/anlamaSozlesmesi.ts`
2. `lib/hapbi/anlama/dogrula.ts`
3. `lib/hapbi/anlama/gemini.ts`
4. `lib/hapbi/anlama/sorguyaCevir.ts`
5. `lib/hapbi/yanit/yorum.ts`
6. `lib/hapbi/yanit/yorumDogrulama.ts`
7. `lib/hapbi/yanit/yorumPaketi.ts`
8. `lib/hapbi/yanit/performans.ts`

Git geçmişi geri dönüş kaynağıdır; silinen kodun yeni bir yedek kopyası uygulamada tutulmayacak.

## 3. API ve arayüz artıklarını sadeleştirme

- Anlam veya konuşma geçmişi taşımayan HMAC sohbet belirtecini, imzalama yardımcılarını ve `HAPBI_SOHBET_SECRET` bağımlılığını kaldır. Kimlik doğrulama her istekte Supabase oturumuyla devam eder; belirteç erişim yetkisi kaynağı değildir.
- Kullanılmayan `pathname` aktarımını kaldır. Eski açık sekmelerin ek alan göndermesi normal soruları bozmasın; bu alanlar yetki veya bağlam olarak kullanılmasın.
- Sürekli `null`/`0` olan model ve model çağrısı alanlarını kaldır; yanıt yolu bilgisini koru.
- API'nin üretmediği eğitim önerisi kartlarını ve türlerini kaldır.
- Referansı olmayan `public/hapbi.png` ve `public/hapbi-wink.png` görsellerini kaldır.
- Kullanıcıya sunulan asistan açıklamasını kavram, ekran ve basit veri kapsamıyla hizala; analitik danışmanlık vaadini çıkar.

## 4. Belgeleri güncelleme

- BLUEBOOK'un asistan bölümü ve asistan dosya envanteri mevcut deterministik yapıyı anlatsın.
- Önceki iki HapBi planı tarihsel kayıt olarak işaretlensin. Eski Gemini hedefleri ve faz onay kuralları yeni temizlik işinin talimatı olarak okunmasın.
- Hukuki metinlerdeki eski AI aktarımı ve 30 dakikalık sohbet anlatımı ayrı içerik incelemesi gerektiren kayıt olarak belirtilecek; bu teknik temizlikte hukuki metin veya canlı yapılandırma değiştirilmeyecek.
- Şema anlık kaydı canlı veritabanının yerine geçmez. Eski RPC'ler hakkında canlı doğrulama yapılmadan silme işlemi uygulanmayacak.

## 5. Doğrulama ve durma ölçütü

- Temizlik öncesi/sonrası aynı yerel örneklerle rehber, basit puan hesabı ve kaynak gösterimini karşılaştır.
- Oturumsuz, kapsam dışı, eksik veri ve veri okuma hatası yollarını doğrula.
- Uygulama tür denetimi ve değişen kodun ESLint kontrolünü çalıştır.
- Silinen modüllere kod bağlantısı veya asistan içinde Gemini istemcisi kalmadığını tara.
- Canlı Supabase/Gemini çağrısı, SQL uygulaması, deploy veya otomatik commit yapma.

## 6. Temizlikten sonraki deterministik iyileştirmeler

Bu turda uygulanmayacak; ayrı davranış değişiklikleri olarak sırayla ele alınacak:

1. Rehberin sayısal soruları genel açıklamaya yönlendirmesini düzelt: “C-Club puanım kaç?” ile “C-Club nedir?” ayrımı.
2. İlgisiz veya desteklenmeyen soruyu varsayılan net puan sorgusuna dönüştürme; kısa yardım yanıtı ver.
3. Atanmış izleme puanı / kazanılan izleme puanı / izleme sayısı ayrımını düzelt.
4. Ürün adı, kapsam, sıralama ve sonuç sayısı seçimlerini basit kabul örnekleriyle doğrula.
5. Dönem ifadesi yokken kullanılan varsayılanı açıklaştır; desteklenmeyen tarihleri sessizce başka döneme çevirmeme davranışını belirle.

Başarı ölçütü özellik sayısı değil, üzerinde anlaşılan az sayıdaki gerçek kullanıcı sorusunun doğru ve tutarlı karşılanmasıdır.

## Uygulama kaydı

- [x] Başlangıç sürümü ve temiz çalışma dizini doğrulandı.
- [x] Kullanım dışı 8 modül ve arayüz/API artıkları belirlendi.
- [x] Temizlik öncesi 6 yerel davranış kontrolü geçti.
- [x] 8 kullanım dışı modül, 2 eski maskot görseli, kullanılmayan API/arayüz alanları kaldırıldı; güncel belgeler düzeltildi.
- [x] Temizlik sonrası 7 yerel davranış kontrolü, uygulama tür denetimi ve değişen kodun ESLint kontrolü geçti.


### Doğrulama sonucu — 9 Eylül 2026

- Önce: `HAPBI_SOHBET_SECRET=yerel-kontrol node --test tests/biTemizlik.smoke.test.ts` — 6/6 geçti. Anahtar yalnız eski API davranışını yerel örnekle çalıştırmak için kullanıldı.
- Sonra: `node --test tests/biTemizlik.smoke.test.ts` — 7/7 geçti; asistanın ayrı sohbet anahtarına ihtiyacı kalmadı. Önceki 6 davranış korundu; eski sekmenin ek alanlarının erişimi veya hesabı değiştirmediği ayrıca doğrulandı.
- `npm run typecheck:build` — geçti.
- Değişen TypeScript/TSX dosyaları ve yeni sınama üzerinde ESLint — geçti.
- Silinen modüllere, eski görsellere veya Gemini uç noktasına uygulama kodunda bağlantı kalmadı.
- 100 puanlık yerel örnekte başka kişinin 9000 puanı sonuca girmedi; kaynaklı 100 puan yanıtı temizlik öncesi ve sonrasında korundu.
- Tarayıcı/canlı ortam kontrolü yapılmadı. Veritabanı, ortam dosyaları ve hukuki metinler değiştirilmedi. Commit veya deploy yapılmadı.

### Ayrı takip gerektiren kayıtlar

- `docs/hukuki/KVKK_AYDINLATMA_METNI.md`: eski AI aktarımı ve 30 dakikalık sohbet belirteci ifadeleri güncel teknik durumla hizalanmalı. Bu tur yalnız farkı kaydeder.
- Canlı ortamda bulunabilecek eski Gemini/sohbet ayarları ve eski HapBi RPC'leri, canlı durum doğrulanmadan silinmiş kabul edilmez.
- Bölüm 6'daki deterministik davranış iyileştirmeleri henüz uygulanmadı. Mevcut anlama sınırlamalarının giderildiği iddia edilmez.
