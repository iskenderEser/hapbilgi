# Senaryo Tek Metin Ekran Kurgusu İş Planı

*20.07.2026. Önceki diff iş planı (`senaryo_tek_metin_diff_gelistirme_is_plani.md`) İskender'in talimatıyla silindi — mockup'ı ve İskender'in ihtiyacını eksik yansıtıyordu. Bu belgenin tek referansı: İskender'in orijinal talebi + onayladığı mockup (20.07).*

## İskender'in talebi (özet — onaylı anlayış)

1. Chat düzeni kalkar; alt alta versiyon/mesaj yığını olmaz.
2. Senaryo tek bir metindir; IU bir kez yazar, süreç boyunca hep o metin üzerinde çalışılır.
3. PM metne dokunamaz; yalnız okur. Kararı üç buton: Onayla / Revizyon iste / İptal et. Revizyon isterse önerisini not olarak yazar.
4. IU düzeltmeyi aynı metnin üzerinde yapar; yeni alan açılmaz.
5. PM değişikliği renkten anlar: eklenen kırmızı vurgulu; yerine yazmada eski hali silinmez üstü çizili kalır, yenisi kırmızı vurgulu.
6. Onay gelince üstü çiziler kalkar, vurgular düz metne döner — temiz nihai senaryo kalır.
7. Amaç: IU'nun ayrıca bir şey anlatmasına gerek kalmasın; düzeltme kendini renklerle göstersin.

## Mockup (onaylı — 20.07)

- **IU — düzenleme:** En üstte PM'in revizyon notu (ayrı kutu), altında önceki metinle dolu TEK düzenleme alanı. Metin ekranda bir kez görünür.
- **PM — inceleme:** Talep kartı; altında "Senaryo" kartı (durum rozeti + renkli fark gösterimi + kartın İÇİNDE metnin altında "Revizyon notları" listesi + İptal et / Revizyon iste / Onayla butonları).
- **Onaylandı:** Vurgusuz düz metin.

## Teknik iş adımları

- **A-1 | IU düzeltme ekranı:** IU + durum "revizyon bekleniyor" iken: salt-okuma metin kartı GİZLENİR; en üstte PM'in son revizyon notu ayrı kutuda; altında önceki metinle dolu tek textarea (ön-doldurma zaten çalışıyor). Birden çok tur olduysa eski notlar altta küçük bir listede.
- **A-2 | PM ekranında notların yeri:** Ayrı "Revizyon Notları" bölümü kalkar; notlar mockup'taki gibi senaryo kartının İÇİNE alınır (metnin altı, butonların üstü).
- **A-3 | Renkli fark yalnız PM'e:** IU incelemedeyken kendi metnini düz görür; üstü çizili/kırmızı görünüm PM'e özeldir.
- **A-4 | Fark hesaplama testi:** `tests/diffHesapla.smoke.test.ts` — 1 mutlu + 1 sınır; `npm run test:smoke`'a bağlanır (önceki pakette "yazıldı" denip repoya girmemişti).
- **A-5 | Doğrulama:** tsc + denetim + lint:mimari sonda tek sefer; commit sonda toptan. Fiziksel teyit İskender'in turunda: IU'da not üstte + tek metin, PM'de renkli fark, onay sonrası temiz metin.

**Değişmeyenler:** Veritabanı modeli, sunucu uçları, fark hesaplama çekirdeği (`lib/utils/senaryo/diffHesapla.ts`), gösterim bileşeni (`components/SenaryoMetniGoster.tsx`), Ç-1..Ç-7 düzeltmeleri.

## A-1..A-5 SONUÇ (20.07.2026 — KOD BİTTİ)

- **A-1:** IU + "revizyon bekleniyor" iken salt-okuma kart gizleniyor; en üstte PM'in son notu sarı kutuda, altında önceki metinle dolu tek textarea; eski notlar varsa altta soluk listede.
- **A-2:** Ayrı "Revizyon Notları" bölümü kalktı; notlar senaryo kartının içinde (metnin altı, butonların üstü) kronolojik gösteriliyor.
- **A-3:** Renkli fark artık yalnız PM'e (`diffGoster` role bağlandı); IU incelemedeyken düz metin görür.
- **A-4:** `tests/diffHesapla.smoke.test.ts` (1 mutlu + 1 sınır) yazıldı, `test:smoke` tüm smoke dosyalarını koşuyor.
- **A-5:** Doğrulama toplu tek sefer: smoke 4/4, tsc + denetim + lint:mimari temiz.
- **Fiziksel teyit İskender'in turunda:** IU'da not üstte + metin ekranda bir kez, PM'de üstü çizili/kırmızı fark + notlar kartın içinde, onay sonrası temiz düz metin.
