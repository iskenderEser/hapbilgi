# Öğrenme Aracı Upload Edge Script

Bu script büyük öğrenme aracı dosyalarını Vercel üzerinden geçirmeden doğrudan
Bunny Storage'a aktarır. Tarayıcı yalnız HapBilgi API'sinin verdiği tek nesneye,
tek kullanıcıya, MIME türüne, boyuta ve kısa süreye bağlı yükleme tokenını görür.
Tarayıcının hesapladığı SHA-256 özeti tokena bağlanır; Bunny Storage `Checksum`
başlığıyla yüklenen gövdeyi ayrıca doğrular.

Storage yüklemesi başarıyla tamamlandığında Edge Script aynı kullanıcı, araç,
dosya yolu, MIME türü, boyut, checksum ve süre kapsamına bağlı imzalı bir
`yukleme_makbuzu` döndürür. HapBilgi API'si dosyayı üretim zincirine almadan
önce bu makbuzu doğrular. Storage okuma yanıtında checksum başlığı bulunmasa
bile tarayıcının tek başına üretemeyeceği bu makbuz, Bunny'nin `Checksum`
kontrolünü kabul ederek yüklemeyi tamamladığını kanıtlar.

## Bunny yapılandırması

Environment variable:

- `ALLOWED_ORIGIN`: HapBilgi production origin'i.
- `STORAGE_ZONE`: Öğrenme araçları Storage Zone adı.
- `STORAGE_HOST`: Bölgesel Storage API host'u; varsayılan `storage.bunnycdn.com`.

Environment secret:

- `STORAGE_ACCESS_KEY`: Storage Zone erişim anahtarı.
- `UPLOAD_SHARED_SECRET`: HapBilgi/Vercel tarafındaki
  `BUNNY_LEARNING_UPLOAD_SHARED_SECRET` ile aynı, rastgele üretilmiş gizli değer.

Deploy edilen script adresi Vercel'de `BUNNY_LEARNING_UPLOAD_ENDPOINT` olarak
tanımlanır. Storage anahtarı Vercel'e de tarayıcıya da aktarılmaz.
