# Senaryo Tek Metin + Fark (Diff) Gösterimi Geliştirme İş Planı

*20.07.2026. Kaynak: fiziksel testlerde gözlemlenen gerçek kullanım — IU revizyon turlarında pratikte sıfırdan yeni senaryo yazmıyor, önceki metin üzerinde düzeltme yapıyor. Mevcut ekran (`app/senaryolar/[talep_id]/page.tsx`) her revizyonu tam yeni bir "Versiyon" (ayrı `senaryolar` satırı) olarak gösteriyor — sohbet gibi akıyor. İlk kurgu (tek metin, üzerinde düzeltme) doğruydu; teknik nedenlerle sonradan versiyon akışına dönülmüştü. Tasarım İskender'e mockup ile gösterildi ve onaylandı (20.07). Hiçbir dosya değiştirilmedi.*

## Onaylanan tasarım (özet)

- **IU ekranı:** Textarea önceki (temiz) metinle önceden dolu gelir — sıfırdan yazılmaz, üzerinde düzeltilir. PM'in revizyon notu üstte ayrı bir kutuda gösterilir.
- **PM ekranı:** IU'nun gönderdiği yeni metin ile PM'in en son gördüğü metin karşılaştırılır. **Çıkarılan/değiştirilen kısım silinmez — üstü çizili olarak kalır.** **Eklenen/yeni yazılan kısım kırmızı vurgulu gösterilir.** Değişmeyen kısımlar düz metin. Altta PM'in geçmiş revizyon notları kronolojik bir listede (chat kartları değil).
- **Onay sonrası:** Durum "onaylandi" olunca üstü çizili kısımlar nihai metinden tamamen kalkar, vurgulu eklemeler düz metne döner — sonuç, IU'nun son yazdığı temiz metindir (zaten DB'de bu şekilde duruyor, yalnız GÖRÜNÜM değişir).

## Tespitler

- **T-1 | Mevcut versiyon modeli gerçek kullanımla uyuşmuyor:** Her revizyon turu tam yeni bir `senaryolar` satırı (`POST /senaryolar/api`) üretiyor; ekranda "Versiyon 1, 2, 3..." olarak yığılıyor (`app/senaryolar/[talep_id]/page.tsx:213-296`). Fiziksel testte görülen gerçek kullanım: IU küçük düzeltmeler yapıyor, sıfırdan yazmıyor — versiyon yığını gereksiz bilişsel yük.
- **T-2 | Değişikliğin NE olduğu hiç görünmüyor:** PM, yeni versiyonu baştan okuyup eskisiyle zihninde karşılaştırmak zorunda; hangi cümle çıktı/değişti/eklendi diye bir işaret yok.
- **T-3 | Revizyon notları versiyon kartlarına gömülü:** Her notun gösterimi ilgili versiyon kartının altında (`son_durum_notlar`, satır 240-245) — ayrı, kronolojik bir "not geçmişi" görünümü yok.

## Geliştirme Adımları

- **G-1 | Diff hesaplama (çekirdek iş):** `diff` npm paketine (küçük, bağımlılık ağacı hafif) `diffWords` fonksiyonu eklenir. Girdi: PM'in en son gördüğü metin (bir önceki onaylı/incelemedeki versiyon) + IU'nun yeni gönderdiği metin. Çıktı: `{eklendi, cikarildi, degismedi}` parçalarının sıralı listesi — saf fonksiyon, `lib/utils/senaryo/diffHesapla.ts` gibi ayrı bir dosyada, React/DB'den bağımsız test edilebilir.
- **G-2 | PM inceleme ekranında gösterim:** Diff çıktısı satır içi render edilir — `cikarildi` parçaları `<s>` (üstü çizili, silinmez) + soluk renk, `eklendi` parçaları kırmızı vurgulu arka plan, `degismedi` düz metin. Mevcut Onayla/Revizyon İste/İptal buton mantığına dokunulmaz.
- **G-3 | IU düzenleme ekranında önceden doldurma:** `handleSenaryoGonder`'ın çağrıldığı textarea artık boş başlamaz — bir önceki (temiz) metinle önceden doldurulur (mevcut `beklemedekiSenaryoId`/G-1 mantığı — bkz. `docs/talep_senaryo_is_sureci_gelistirme_is_plani.md` — ile birlikte çalışır, çakışmaz).
- **G-4 | Onay sonrası temizlenme:** Durum "onaylandi" olduğunda ekran diff/vurgu göstermez — yalnız son (nihai) düz metin gösterilir. Bu, DB'de zaten var olan `senaryo_metni` alanının doğrudan render'ı; ekstra hesaplama gerekmez.
- **G-5 | Revizyon notları ayrı bölüm:** Versiyon kartlarına gömülü not gösterimi kalkar; talebe bağlı tüm `senaryo_durumu.notlar` (revizyon bekleniyor kayıtları) kronolojik, ayrı bir "Revizyon Notları" listesinde toplanır.
- **G-6 | Veri modeli — DEĞİŞMEZ:** DB'deki çoklu-satır (her revizyon ayrı `senaryolar` satırı) modeli **korunur** — denetim/geri dönüş geçmişi kaybolmaz. Yalnız EKRAN, bu satırları "versiyon yığını" yerine "tek metin + diff + ayrı not listesi" olarak yorumlar. Sunucu uçlarına (`app/senaryolar/api/*`) dokunulmaz.
- **G-7 | Doğrulama disiplini:** tsc + `npm run denetim` + `npm run lint:mimari` temiz. En fazla 1 smoke: `diffHesapla` saf fonksiyonu için mutlu (bir cümle değişince doğru eklendi/çıkarıldı/değişmedi ayrımı) + red/sınır (boş metin, birebir aynı metin → hiç fark yok) senaryosu.

Sıra: G-1 (çekirdek diff) → G-2+G-3 (iki ekranın render'ı, aynı pakette) → G-4+G-5 → G-6 zaten tasarım gereği sağlanıyor (kod değişikliği gerektirmez, yalnız doğrulanır). Fiziksel teyit İskender'in test turunda: gerçek bir revizyon turu — üstü çizili/vurgulu gösterimin doğru çalıştığı, onay sonrası temizlendiği.

## G-1..G-6 SONUÇ (20.07.2026 — KOD BİTTİ, commit `e7042ec`)

- **G-1:** `lib/utils/senaryo/diffHesapla.ts` — `diff` paketi (`diffWords`) ile saf çekirdek; çıkarılan "cikar", eklenen "ekle", değişmeyen "ayni" olarak ayrıştırılıyor. `onceki` boşsa (ilk gönderim) tüm metin "ayni" kabul edilir, karşılaştırma yapılmaz.
- **G-2:** `components/SenaryoMetniGoster.tsx` — "cikar" üstü çizili + soluk, "ekle" kırmızı vurgulu, "ayni" düz render. PM inceleme ekranında yalnız `sonSenaryo.son_durum === "inceleme bekleniyor"` VE bir önceki versiyon varsa devreye giriyor; onaylı/iptal/ilk gönderimde düz metin.
- **G-3:** IU'nun textarea'sı artık boş başlamıyor — taslak yoksa ve son durum "revizyon bekleniyor" ise önceki metinle önceden dolduruluyor (veri yüklendikten sonra yalnız bir kez, `useRef` kilidiyle).
- **G-4:** Onay sonrası temizlenme ekstra kod gerektirmedi — diff yalnız "inceleme bekleniyor" durumunda hesaplanıyor, onaylı halde zaten düz metin gösteriliyor.
- **G-5:** Revizyon notları artık versiyon kartlarından bağımsız, `senaryo_durumu` üzerinden tüm `talep`'e ait `durum="revizyon bekleniyor"` kayıtları kronolojik toplanıp ayrı bir "Revizyon Notları" bölümünde gösteriliyor.
- **G-6 (doğrulandı):** Veri modeli değişmedi — `senaryolar` hâlâ her revizyonda yeni satır; yalnız ekran `sonSenaryo` + `oncekiSenaryo`'yu okuyor. Sunucu uçlarına dokunulmadı.
- Yeni bağımlılık: `diff` (+ `@types/diff` devDependency). Üçlü doğrulama temiz (`denetim`: DB şemasıyla uyuşmazlık yok). Smoke: `senaryoDiffHesapla` mutlu + red/sınır geçti. Dev sunucu konsol hatasız derledi.
- **Fiziksel teyit bekliyor** — İskender'in test turunda gerçek bir revizyon turu.
