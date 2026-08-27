# Öğrenme Aracı Upload Edge Script

Bu script büyük öğrenme aracı dosyalarını Vercel üzerinden geçirmeden doğrudan
Bunny Storage'a aktarır. Tarayıcı yalnız HapBilgi API'sinin verdiği tek nesneye,
tek kullanıcıya, MIME türüne, boyuta ve kısa süreye bağlı yükleme tokenını görür.
Tarayıcının hesapladığı SHA-256 özeti tokena bağlanır; Bunny Storage `Checksum`
başlığıyla yüklenen gövdeyi ayrıca doğrular.

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
