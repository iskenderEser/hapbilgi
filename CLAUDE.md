# Çalışma Kuralları (her oturumda geçerli)

## Doğrulama tavanı
- Her iş adımında EN FAZLA 1 smoke test: 1 mutlu yol + 1 red senaryosu. Fazlası YASAK.
- Rol matrisi taraması (her rolle ayrı deneme) YAPMA — o iş insan yürütümlü fiziksel testlerin (U10/U7).
- tsc + npm run denetim + npm run lint:mimari temiz ise adım kapanmış sayılır.

## Takılma kuralı
- Aynı işte 2 deneme başarısız olursa DUR, durumu 3 cümleyle özetle, talimat bekle.
- 2 dakikayı aşan hiçbir doğrulama döngüsüne girme — süre dolunca DUR ve sor.

## Onay disiplini
- Kod değişikliği öncesi planı özetle, onay al.
- Canlı DB'ye YAZAN hiçbir komutu kendin çalıştırma — SQL'i kullanıcıya ver.
- Test verisi yarattıysan işin sonunda temizle.

## Kaynaklar
- Proje bilgisi: docs/ altındaki üç belge. Kararlar oradadır, yeniden sorgulama.
