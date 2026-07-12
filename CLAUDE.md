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

## Kalite taraması frenleri (docs/teknik_kalite_kontrol_is_plani.md §4)
- **Q0 kuralı — SIFIR DEĞİŞİKLİK:** Tarama aşamasında hiçbir dosya değiştirilmez, hiçbir DB yazımı yapılmaz. Çıktı yalnızca `docs/kalite_bulgu_raporu.md`.
- **Bulgu formatı:** `B-## | kategori (T-K/T-D/T-B) | kanıt (dosya:satır ya da SQL çıktısı) | önem (KRİTİK/ORTA/NOT) | önerilen düzeltme (1-2 cümle)`.
- Tarama maddeleri tek tek koşulur; madde başına tek geçiş; bir maddede 2 takılmada dur-sor.
- Bulgu başına derinleşme yok — kanıtla, raporla, geç.
- DB'ye yalnızca salt-okuma; toplam tarama tek oturum hedefi.
- **Düzeltme disiplini (Q2 onayı sonrası):** yalnızca İskender'in KRİTİK/ORTA onayladığı bulgular; bir bulgu = bir commit; her commit üçlü doğrulamadan geçer; davranış değiştiren düzeltmelerde önce/sonra kanıtı rapora eklenir.

## Kaynaklar
- Proje bilgisi: docs/ altındaki üç belge. Kararlar oradadır, yeniden sorgulama.
