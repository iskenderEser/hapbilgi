# HapBilgi

HapBilgi; öğrenme içeriklerinin talep, üretim, yayın, tüketim, ölçüm ve ödül süreçlerini rol temelli olarak yöneten bir Next.js uygulamasıdır.

## Yerel geliştirme

Gerekli ortam değişkenlerini `.env.example` dosyasını temel alarak `.env.local` içinde tanımlayın. Ardından:

```bash
npm install
npm run dev
```

Uygulama varsayılan olarak `http://localhost:3000` adresinde çalışır.

## Temel kontroller

```bash
npm run typecheck:build
npm run lint
npm run test:smoke
npm run build
```

Veritabanı şema anlık görüntüsü ve kod kullanımı denetimleri için:

```bash
npm run denetim:sema
npm run denetim
npm run denetim:tutarlilik
```

`denetim:sema` canlı veritabanını yalnız şema anlık görüntüsünü yenilemek amacıyla okur ve geçerli bağlantı bilgileri gerektirir.

## Proje kayıtları

- Sistem mimarisi ve iş kuralları: `docs/BLUEBOOK.MD`
- Açık işler ve teknik borçlar: `docs/REDBOOK.MD`
- Hukuki metinler ve KVKK takip kaydı: `docs/hukuki/`
- Tekrar çalıştırılabilir veritabanı değişiklikleri: `scripts/sql/`

SQL dosyalarının repoda bulunması, canlı veritabanına uygulandıkları anlamına gelmez. Canlı veritabanı komutları proje sahibi tarafından çalıştırılır ve sonuç ayrıca doğrulanır.
