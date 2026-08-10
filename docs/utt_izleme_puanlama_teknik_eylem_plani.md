# UTT İzleme ve Puanlama — Teknik Eylem Planı

**Tarih:** 10.08.2026  
**Durum:** Plan — uygulama başlamadı  
**Kapsam:** UTT / KD-UTT video izleme, ileri sarma, tamamlama, izleme puanı ve soru hakkı  
**Kapsam dışı:** Ana sayfanın görsel düzeni; Challenge Club, E-Club ve Eczanem izleme davranışları

---

## 1. Amaç

UTT izleme akışını aşağıdaki ürün kararlarıyla birebir uyumlu hale getirmek:

1. Video yalnızca açıldığında izleme denemesi başlamaz; gerçek oynatma başladığında başlar.
2. Yarım bırakılan video yeniden açıldığında kaldığı yerden sürmez, sıfırdan başlar.
3. İleri sarma kaybı ileri sarma onaylandığı anda kaydedilir; videonun tamamlanması beklenmez.
4. Yarım bırakılan izleme izleme puanı kazandırmaz.
5. Video daha sonraki bir denemede tamamlanırsa, ilgili turdaki ilk izleme kazanımı olarak tam video puanı yazılır. Önceki ileri sarma kayıpları ayrıca korunur.
6. Soru hakkı yalnızca geçerli yayın turundaki ilk gerçek denemenin, ileri sarılmadan ve tek oynatma oturumunda tamamlanmasıyla doğar.
7. İlk gerçek deneme yarım bırakılırsa veya herhangi bir denemede ileri sarılırsa o turdaki soru hakkı kapanır.
8. Yeni yayın turu açıldığında soru hakkı yeniden değerlendirilir. Tekrar periyodu bulunmayan yayında tek tur ömür boyu sürdüğü için kapanan hak yeniden doğmaz.
9. "Yeni Videolar" ile yarım bırakılmış videolar birleştirilmeyecek; ana sayfa düzeni ayrı çalışmada ele alınacaktır.

### 1.1 Puan muhasebesi

Kazanım ve kayıp birbirine gömülmez:

- Tamamlanan ilk puanlı izleme: tam video puanı.
- Her onaylı ileri sarma: ayrı kayıp kaydı.
- Net etki: toplam kazanım − toplam kayıp.

Örnek: İlk denemede `-3` ileri sarma kaybı, sonraki temiz tamamlamada `+10` izleme puanı → net `+7`. Sonraki tamamlamada "kalan 7 puan" yazılmaz.

### 1.2 Puanlı zaman penceresi

Mevcut Redbook kuralı korunur:

- Hafta içi 07.00–20.29: kazanım ve kayıp uygulanabilir.
- Hafta sonu ve hafta içi pencere dışında: izleme analitik olarak kaydedilir; kazanım, kayıp ve soru yoktur.
- Pencere kararı mevcut davranış gibi izleme başlangıç anına göre verilir.
- Pencere dışında ileri sarma davranışı soru hakkını kapatır; puan kaybı `0` olur ve kayıp defterine pozitif puanlı satır yazılmaz.

---

## 2. Mevcut Durum ve Kök Nedenler

### B-01 — Video açılışı gerçek deneme sayılıyor

**Kanıt:** `components/izle/VideoOynatici.tsx` video değiştiğinde doğrudan `handleIzlemeBaslat()` çağırıyor. `app/izle/api/baslat/route.ts` her çağrıda yeni `izleme_kayitlari` satırı açıyor.

**Sonuç:** Oynatılmadan kapatılan video "Devam Eden" sayılıyor; gerçek yarım izleme ile yalın açılış ayırt edilemiyor.

### B-02 — İleri sarma kaybını istemci belirliyor

**Kanıt:** Oynatıcı `kaybedilen_puan` dahil bütün değerleri gönderiyor; `app/izle/api/ileri-sarma/route.ts` sahiplik, yayın eşleşmesi, açık oturum ve hesap doğrulaması yapmadan kaydı yazıyor.

**Sonuç:** Puan kaybı tarayıcı isteği değiştirilerek azaltılabilir veya sıfırlanabilir.

### B-03 — Tamamlama ve ileri sarma kararı istemciye bağlı

**Kanıt:** `bitir` endpoint'i `ileri_sarilan_sure` değerini istemciden alıyor; izleme defterindeki ileri sarma kayıtlarından türetmiyor. Videonun gerçekten sona ulaştığı sunucuda doğrulanmıyor.

**Sonuç:** Doğrudan API çağrısıyla ileri sarma gizlenebilir veya video erken tamamlanabilir.

### B-04 — Önceki yarım deneme soru hakkına katılmıyor

**Kanıt:** `ilkIzleme`, önceki gerçek denemeden değil, geçerli turdaki `puan_turu='izleme'` kazanımının bulunmamasından türetiliyor.

**Sonuç:** İlk deneme yarım bırakıldıktan sonra ikinci temiz denemede sorular açılabiliyor.

### B-05 — Soru yasağı yalnız arayüz davranışı

**Kanıt:** `sorular` ve `cevap` endpoint'leri yalnızca `tamamlandi_mi=true` kontrolü yapıyor; soru hakkını ve ileri sarma geçmişini doğrulamıyor.

**Sonuç:** Arayüz soruları göstermese bile endpoint'ler doğrudan çağrılabilir.

### B-06 — İleri sarma yazım hatası oynatmayı durdurmuyor

**Kanıt:** Oynatıcı ileri sarma isteğinin HTTP sonucunu kontrol etmeden hedef saniyeye geçiyor.

**Sonuç:** Kayıp yazılmadığı halde içerik atlanabilir.

### B-07 — Soru seçimi sabit ve doğrulanabilir değil

**Kanıt:** `sorular` her GET çağrısında yeniden rastgele seçim yapıyor; `cevap` gönderilen indekslerin kullanıcıya sunulan set olduğunu doğrulamıyor.

**Sonuç:** Kullanıcı tekrar çağrılarla farklı soru kümeleri görebilir veya sunulmayan sorulara cevap gönderebilir.

### B-08 — Tamamlama ve puan yazımı atomik/idempotent değil

**Kanıt:** `bitir` önce izlemeyi tamamlıyor, ardından yayın/tur/puan sorgularını ve puan INSERT'lerini yürütüyor. Eşzamanlı veya tekrarlanan istekleri DB seviyesinde engelleyen işlem anahtarı görünmüyor.

**Sonuç:** Ara hata tamamlanmış fakat puansız kayıt bırakabilir; yarışan istekler mükerrer puan riski oluşturur.

---

## 3. Hedef Durum Modeli

### 3.1 İzleme denemesi durumları

| Durum | Tanım | Puan etkisi | Soru etkisi |
|---|---|---:|---|
| Açıldı | Video yüzeyi açıldı, oynatma başlamadı | Yok | Yok |
| Aktif deneme | İlk gerçek `play` alındı, izleme kaydı açıldı | Henüz yok | İlk deneme olasılığı korunur |
| Yarım bırakıldı | Aktif deneme video sonuna ulaşmadan kapandı | Varsa anlık ileri sarma kayıpları kalır | Geçerli turda soru hakkı kapanır |
| Tamamlandı | Sunucu tamamlamayı doğruladı | İlk puanlı tamamlama ise tam puan | Yalnız ilk temiz denemede açılır |

Sayfadan çıkarken güvenilmez `beforeunload` isteğine iş kuralı bağlanmayacaktır. Yeni bir deneme başlatıldığında veya tamamlama değerlendirilirken daha önceki tamamlanmamış gerçek kayıtların varlığı, önceki denemenin yarım bırakıldığını kanıtlamaya yeterlidir.

### 3.2 Soru hakkı kararı

Geçerli tur için aşağıdaki koşulların tamamı sağlanmalıdır:

1. Mevcut kayıt gerçek oynatma ile başlamış olmalı.
2. Mevcut kayıttan önce gerçek izleme denemesi bulunmamalı.
3. Mevcut denemede ileri sarma kaydı bulunmamalı.
4. İzleme puanlı zaman penceresinde başlamış olmalı.
5. Video sunucu kurallarına göre tamamlanmış olmalı.
6. Aynı izleme için soru hakkı daha önce tüketilmemiş olmalı.

Karar istemciye bırakılmayacak; tamamlamada sunucuda hesaplanıp izleme kaydında kalıcı olarak saklanacaktır. `sorular` ve `cevap` uçları aynı alanı zorunlu olarak doğrulayacaktır.

### 3.3 Yeni tur sınırı

Önceki deneme, ileri sarma ve soru hakkı kontrolleri `gecerliTur()` tarafından döndürülen tur başlangıcıyla sınırlandırılır. Önceki turun kayıtları tarihçede kalır fakat yeni turun soru kararını kapatmaz.

---

## 4. Veri Modeli ve SQL Geçişi

Canlı DB işlemlerinin tamamı İskender tarafından yürütülecektir. Uygulama yalnız yeniden çalıştırılabilir SQL dosyalarını hazırlayacaktır.

### 4.1 `izleme_kayitlari` ek alanları

Önerilen alanlar:

| Alan | Tip | Amaç |
|---|---|---|
| `gercek_oynatma_mi` | boolean, NOT NULL, default false | Eski yalın açılış kayıtlarını gerçek denemeden ayırmak |
| `soru_hakki_var_mi` | boolean, nullable | Aktifte NULL; tamamlamada kesin karar true/false |
| `soru_indeksleri` | integer[], nullable | Kullanıcıya atanmış sabit soru kümesi |
| `video_suresi_saniye` | integer, nullable | Deneme için kullanılan güvenilir süre anlık görüntüsü |

Mevcut `tamamlandi_mi` alanı uyumluluk için korunur. Yeni alanlarla birlikte anlamı:

- `gercek_oynatma_mi=false`: yalın açılış / eski belirsiz kayıt.
- `gercek_oynatma_mi=true, tamamlandi_mi=false`: gerçek yarım/aktif deneme.
- `gercek_oynatma_mi=true, tamamlandi_mi=true`: tamamlanmış deneme.

### 4.2 Video süresi kaynağı

Sunucu, kayıp ve bitirme hesabında istemcinin gönderdiği puana güvenmeyecektir. Süre Bunny metadata cevabından alınacaktır.

Tercih edilen kalıcı model:

1. `videolar.video_suresi_saniye` alanı eklenir.
2. Bunny encode durumu başarıyla okunduğunda süre de kaydedilir.
3. Mevcut videolar için GUID üzerinden kontrollü backfill SQL/yardımcı akışı hazırlanır.
4. İzleme başlangıcında güncel süre `izleme_kayitlari.video_suresi_saniye` alanına kopyalanır; sonraki metadata değişikliği geçmiş denemenin hesabını değiştirmez.

Süre bulunamıyorsa puanlı izleme başlatılmayacak; kullanıcıya teknik hata açıkça gösterilecektir. İstemci süresiyle sessiz geri düşüş yapılmayacaktır.

### 4.3 İdempotency ve tekillik

Hazırlanacak DB korumaları:

1. İleri sarma isteğine istemcide üretilen `olay_id` eklenir; kayıp tablosunda UNIQUE tutulur.
2. Aynı izleme için `puan_turu='izleme'` kazanımı tekilleştirilir.
3. Aynı izleme için `extra` ve `oneri` kazanımlarının mükerrer yazımı engellenir.
4. Aynı izleme ve soru indeksi için cevap/kayıp/kazanım tekrarları engellenir.
5. Tamamlama geçişi yalnız `tamamlandi_mi=false` satırını değiştiren koşullu işlemle yapılır.

Mevcut şemada olabilecek mükerrer kayıtlar, UNIQUE eklenmeden önce salt-okuma teyit sorgularıyla kontrol edilecektir. Bu sorguları İskender çalıştıracak; sonuç temiz değilse veri kararı alınmadan silme yapılmayacaktır.

### 4.4 Eski kayıtların geçişi

Eski kod yalın açılışta satır açtığı için tüm tamamlanmamış kayıtlar gerçek yarım izleme kabul edilmeyecektir.

Backfill kuralı:

- Tamamlanmış eski kayıt → `gercek_oynatma_mi=true`.
- İleri sarma kaydı bulunan eski tamamlanmamış kayıt → `gercek_oynatma_mi=true`.
- Tamamlanmamış ve ileri sarma kaydı bulunmayan eski kayıt → `gercek_oynatma_mi=false`; geçmiş belirsizlik kullanıcı aleyhine yorumlanmaz.
- Mevcut soru cevap kaydı olan tamamlanmış izleme → soru hakkı tüketilmiş kabul edilir.
- Diğer tarihî tamamlanmış kayıtların soru hakkı, canlı veri sayımı görüldükten sonra ayrıca teyit edilir; kör toplu true/false backfill yapılmaz.

---

## 5. Kodlama Adımları

### Adım 0 — Redbook sözleşmesini netleştirme

**Dosya:** `docs/REDBOOK.MD`

1. §8.1'deki soru hakkının "geçerli yayın turu içinde" olduğu açıkça yazılır.
2. Puansız pencere ile anlık ileri sarma ilişkisi eklenir.
3. Yeni turda soru hakkının yeniden değerlendirildiği, tekrar periyodu olmayan yayında kilidin kalıcı olduğu belirtilir.
4. "Yeni Videolar" birleştirmesinin terk edildiği kaydedilir.

**Kapanış ölçütü:** §2.5, §3.1 ve §8.1 arasında çelişki kalmaması.

### Adım 1 — Saf karar çekirdeği ve önce-kırmızı smoke testi

**Yeni dosya önerileri:**

- `lib/izleme/karar.ts`
- `lib/izleme/tipler.ts`
- `tests/izlemeKarari.smoke.test.ts`

Saf fonksiyonlar:

- `soruHakkiBelirle(...)`
- `izlemeKazanimKarariBelirle(...)`
- `ileriSarmaKaybiHesapla(...)`
- `tamamlamaYeterliMi(...)`

Test iki ana blokla sınırlandırılır:

- Mutlu yol: ilk gerçek, temiz, tam izleme → tam puan + soru.
- Red matrisi: Redbook tablosundaki yarım/seek/dönüş varyasyonları → doğru tam puan/kayıp/soru sonucu.

**Kapanış ölçütü:** Önce mevcut mantığı temsil eden test beklenen yeni kuralda kırmızı; saf çekirdek sonrası yeşil.

### Adım 2 — SQL zemini

**Yeni SQL dosyası önerisi:** `scripts/sql/utt_izleme_oturum_modeli.sql`

İçerik:

1. Yeni kolonlar.
2. Check constraint'ler.
3. İdempotency alanı ve unique index'ler.
4. Eski kayıt backfill'i.
5. Ön kontrol ve son doğrulama SELECT'leri ayrı bloklarda.
6. Yeniden koşum güvenliği.

Kod bu adımdan sonra yeni kolon sözleşmesine göre yazılır. SQL canlıda uygulanmadan uygulama dağıtılmaz.

**Kapanış ölçütü:** SQL dosyası statik inceleme temiz; canlı koşum bekliyor olarak işaretli.

### Adım 3 — Video metadata süresi

**Dosyalar:**

- `lib/video/bunnyYukleme.ts`
- Bunny durumunu tüketen ilgili route/hook dosyaları
- `scripts/sql/utt_izleme_oturum_modeli.sql`

İşlemler:

1. `bunnyVideoDurumu()` dönüşüne doğrulanmış süre eklenir.
2. Encode tamamlandığında süre video kaydında saklanır.
3. İzleme başlangıcı yayın zincirinden güvenilir süreyi çözer.
4. Süresiz videoda puanlı oturum açılması reddedilir.

**Kapanış ölçütü:** İstemci `kaybedilen_puan` üretemez; sunucu aynı video/süre için deterministik kayıp hesaplar.

### Adım 4 — Oynatıcıyı gerçek `play` başlangıcına taşıma

**Dosyalar:**

- `lib/video/videoPlayer.ts`
- `components/izle/VideoOynatici.tsx`

İşlemler:

1. `VideoPlayer` sözleşmesine `onPlay`, `pause` ve gerektiğinde `play` eklenir.
2. Player video yüzeyi açılır açılmaz kurulur; izleme kaydı açılmaz.
3. İlk `play` olayında `baslat` bir kez çağrılır.
4. Oturum kimliği dönene kadar player duraklatılır; kayıt başarıyla açılınca sıfırdan oynatılır.
5. `timeupdate` ilk ilerleme olayı, `onPlay` kaçarsa güvenli yedek tetikleyici olur.
6. Provider'ın hatırladığı konum varsa başlangıçta sıfıra çekilir; bu sistem işlemi ileri sarma sayılmaz.

**Kapanış ölçütü:** Videoyu açıp kapatmak DB kaydı doğurmaz; ilk oynatma tam bir kayıt doğurur; tekrar açma sıfırdan başlar.

### Adım 5 — `baslat` endpoint'ini güçlendirme

**Dosyalar:**

- `app/izle/api/baslat/route.ts`
- yeni `lib/izleme/baslat.ts` veya eşdeğer tek-kaynak servis

İşlemler:

1. Mevcut auth, rol, hedef ve öneri kontrolleri korunur.
2. İstemcinin gönderdiği `izleme_turu` yerine sunucu `oneri_id` varlığından türü belirler.
3. Güvenilir video süresi çözülür.
4. `gercek_oynatma_mi=true` kayıt açılır.
5. Geçerli tur bilgisi ve bu kaydın turdaki deneme sırası sunucu tarafında belirlenir.
6. Aynı oynatma olayının ağ tekrarı ikinci kayıt açmaz; başlangıç istek anahtarı kullanılır.

**Kapanış ölçütü:** İstemci tür, süre veya deneme sırası belirleyemez.

### Adım 6 — İleri sarma endpoint'ini sunucu otoritesine alma

**Dosyalar:**

- `app/izle/api/ileri-sarma/route.ts`
- `lib/puan/kayit.ts`
- `lib/puan/tipler.ts`
- `components/izle/VideoOynatici.tsx`

İstemcinin göndereceği alanlar:

- `izleme_id`
- `olay_id`
- `atlama_baslangic`
- `atlama_bitis`

Sunucunun yapacağı kontroller:

1. Sayısal değerler sonlu, pozitif ve sıralı mı?
2. İzleme kullanıcıya ait mi?
3. İzleme gerçek ve tamamlanmamış mı?
4. İzlemenin yayını ile istek bağlamı tutarlı mı?
5. Atlama, video süresi sınırları içinde mi?
6. Aynı `olay_id` daha önce işlendi mi?
7. İzleme puanlı pencerede mi?

Kayıp hesabı:

`round(video_puani / video_suresi × atlanan_sure)`, pozitif puanlı pencerede minimum `1`.

Kayıp sunucuda yazılır ve kesin miktar yanıtta döner. İstemci yalnız başarılı yanıt sonrası hedef saniyeye geçer. Hata halinde eski konumda kalır ve kullanıcıya açık hata gösterilir.

**Kapanış ölçütü:** Değiştirilmiş istemci isteği puanı belirleyemez; başarısız kayıtla ileri gidilemez.

### Adım 7 — `bitir` endpoint'ini sunucu otoriteli ve idempotent yapma

**Dosyalar:**

- `app/izle/api/bitir/route.ts`
- `lib/izleme/karar.ts`
- `lib/puan/kayit.ts`
- gerekirse yeni atomik DB RPC SQL'i

İşlemler:

1. `ileri_sarilan_sure` istemci sözleşmesinden kaldırılır.
2. Mevcut denemenin ileri sarma durumu `ileri_sarma_kayitlari EXISTS` ile çözülür.
3. Önceki gerçek denemeler geçerli tur sınırında sorgulanır.
4. Sunucu süresi, başlangıç zamanı ve onaylı ileri sarma süreleriyle tamamlamanın zamansal olarak mümkün olduğu kontrol edilir.
5. Tamamlama geçişi koşullu ve tek-seferlik yapılır.
6. İlk puanlı tamamlamada tam video puanı yazılır.
7. Önceki kayıplara dokunulmaz.
8. Soru hakkı saf çekirdekten hesaplanıp kalıcı alana yazılır.
9. Soru hakkı varsa soru indeksleri bir kez seçilip izlemeye bağlanır.
10. Öneri ve extra mevcut tur kuralları korunarak değerlendirilir.
11. Aynı isteğin tekrarı yeni puan yazmadan mevcut sonucu döndürür.

Atomiklik için tercih: izleme satırını kilitleyen, tamamlama + tekil kazanım kararını transaction içinde yürüten dar kapsamlı DB RPC. Route auth ve orkestrasyonu korur; puan karar girdilerini sunucu çözer.

**Kapanış ölçütü:** Erken veya tekrarlı bitir çağrısı puan üretemez; tamamlanan ilk puanlı izleme her zaman tam puan yazar.

### Adım 8 — Soru uçlarını kapatma ve seçimi sabitleme

**Dosyalar:**

- `app/izle/api/sorular/route.ts`
- `app/izle/api/cevap/route.ts`
- `lib/soru/secim.ts`
- gerekirse yeni `lib/izleme/soruHakki.ts`

İşlemler:

1. Her iki uç sahiplik + tamamlanma + `soru_hakki_var_mi=true` doğrular.
2. `sorular`, izlemeye kaydedilmiş indeksleri kullanır; her GET aynı seti döndürür.
3. `cevap`, gelen indeks kümesinin atanmış kümeyle birebir eşleşmesini zorunlu kılar.
4. Eksik, fazla veya sunulmayan soru indeksi reddedilir.
5. Aynı izleme için ikinci cevap gönderimi DB tekilliğiyle engellenir.
6. Cevap, doğru puanı ve yanlış kaybını mevcut kayıt-anı simetrisiyle ayrı defterlere yazar.

**Kapanış ölçütü:** Doğrudan API çağrısıyla yasak soru alınamaz; yenilemeyle soru değişmez; aynı cevap iki kez puanlanmaz.

### Adım 9 — Oynatıcı mesajları ve hata telafisi

**Dosya:** `components/izle/VideoOynatici.tsx`

Mesajlar:

- İleri sarma onayı: tahmini değil, kuralı açıklar.
- Kayıt sonrası: kesin kayıp miktarı gösterilir.
- Yarım izleme sonrası dönüş: "Video baştan başlayacak; bu turdaki soru hakkınız kapandı."
- Bitir yazım hatası: otomatik/elle tekrar denenebilir; `izlemeBitirildiRef` kalıcı kilit olarak bırakılmaz.
- Soru hakkı yoksa neden kodu sunucudan gelir: `ileri_sarma`, `yarim_deneme`, `puan_disinda`, `tekrar_izleme`.

**Kapanış ölçütü:** Kullanıcı yalnız son durumu değil, nedenini de görür; hata başarısız işlemi başarılı gibi göstermez.

### Adım 10 — Ana sayfa veri etkisini sınırlı düzeltme

Bu adım görsel tasarım değildir.

**Dosya:** `lib/utils/anaSayfa/utt.ts`

1. `Yeni Videolar` yalnız geçerli turda gerçek oynatma kaydı olmayan yayınlardır.
2. `Devam Eden` yalnız gerçek, tamamlanmamış denemesi bulunan ve tamamlanmış denemesi bulunmayan yayınlardır.
3. Yalın eski açılış kayıtları iki sayımı da bozmaz.
4. `Tamamlanan` mevcut turda en az bir tamamlanmış kayıtla çalışmaya devam eder.
5. Liste birleştirilmez; kart adı/tasarımı sonraki ana sayfa çalışmasına bırakılır.

**Kapanış ölçütü:** Video açıp kapatma "Yeni" sayısını düşürmez; gerçek oynatıp çıkma "Devam Eden"e geçirir.

---

## 6. Test Matrisi

### 6.1 Temel ürün senaryoları

| No | Senaryo | Kazanım | Kayıp | Soru |
|---:|---|---:|---:|---|
| 1 | İlk deneme, temiz, tam | Tam | 0 | Var |
| 2 | İlk deneme, seek, tam | Tam | Anlık | Yok |
| 3 | Seek, yarım, bir daha dönmez | 0 | Anlık | Yok |
| 4 | Seek, yarım, temiz dönüş ve tam | Tam | Önceki korunur | Yok |
| 5 | Seek, yarım, ikinci seek, tam | Tam | İki kayıp | Yok |
| 6 | Seek, yarım, ikinci seek, yine yarım | 0 | İki kayıp | Yok |
| 7 | Temiz yarım, temiz dönüş ve tam | Tam | 0 | Yok |
| 8 | Birkaç yarım deneme, sonunda tam | Tam | Varsa tümü | Yok |

### 6.2 Teknik red senaryoları

1. Başkasının `izleme_id` değeriyle ileri sarma.
2. Tamamlanmış izlemeye ileri sarma.
3. Sahte `kaybedilen_puan` alanı gönderme.
4. Video süresini aşan atlama.
5. Aynı `olay_id` isteğini iki kez gönderme.
6. Video süresi dolmadan `bitir` çağırma.
7. Aynı `bitir` isteğini eşzamanlı gönderme.
8. Soru hakkı olmayan izlemeyle `sorular` çağırma.
9. Atanmamış soru indeksini `cevap` endpoint'ine gönderme.
10. Aynı cevap setini iki kez gönderme.

### 6.3 Tur ve zaman senaryoları

1. Önceki turda yarım/seek, yeni turda ilk temiz tam izleme → soru var.
2. Aynı turda yarım, sonra tam → soru yok.
3. Puansız pencerede tam izleme → kazanım/kayıp/soru yok.
4. Puansız pencerede seek ve yarım bırakma → pozitif kayıp yok, soru hakkı kapalı.
5. Öneri penceresinde önceki yarım deneme sonrası temiz tamamlama → tam izleme ve uygun öneri puanı; soru yok.
6. Extra tekrar sayımı yalnız tamamlanmış, ileri sarmasız tekrarları saymaya devam eder.

---

## 7. Doğrulama ve Kapanış

Her kod adımında Claude.md sınırı uygulanır:

1. Bir mutlu yol smoke.
2. Bir red smoke.
3. `npx tsc --noEmit`.
4. `npm run denetim`.
5. `npm run lint:mimari`.

DB SQL'i İskender tarafından uygulandıktan sonra:

1. Yeni kolon ve index varlık teyidi.
2. Mükerrerlik ön sorgularının sonucu.
3. Eski kayıt backfill sayıları.
4. Bir ileri sarma INSERT'inin HBLigi günlük özetine anlık düşmesi.
5. Bir tam izlemenin tam kazanım yazması.
6. Net puanın rapor ve HBLigi tarafında aynı olması.

Chrome fiziksel testinde Berk UTT ile temel sekiz senaryodan veri kirletmeden seçilmiş mutlu/red akışları uygulanır. Test verisi üretilecekse iş sonunda mevcut test-verisi silme disipliniyle temizlenir.

### Üçlü son kontrol

1. **Kod:** TypeScript + smoke + denetim + mimari lint.
2. **İş kuralı:** Redbook tablosu ile API sonuçlarının birebirliği.
3. **Fiziksel görünüm:** Chrome UTT oturumu, konsol ve network hataları, ana sayfa sayaçlarının doğru geçişi.

---

## 8. Geri Dönüş Stratejisi

1. Her davranış değişikliği ayrı commit olur.
2. SQL, uygulama kodundan ayrı commitlenir.
3. Yeni kolonlar ilk aşamada eski alanları silmez; geri dönüşte eski kod çalışabilir.
4. `ileri_sarma_acik` gibi bayat alanların DROP işlemi bu çalışmaya dahil edilmez.
5. Yeni index/constraint canlı veride sorun çıkarırsa veri silinmez; işlem durdurulur ve teyit sonucu beklenir.
6. Push yapılmaz.

---

## 9. Önerilen Commit Sırası

1. `docs: UTT izleme ve puanlama teknik eylem planı`
2. `docs: UTT soru hakkını yayın turu kapsamında netleştir`
3. `test(izle): izleme karar senaryolarını sabitle`
4. `feat(db): UTT izleme oturum modelini hazırla`
5. `feat(video): gerçek oynatma başlangıcı ve güvenilir süre`
6. `fix(izle): ileri sarma kaybını sunucu otoritesine taşı`
7. `fix(izle): tamamlama ve izleme puanını idempotent yap`
8. `fix(izle): soru hakkını ve soru setini sunucuda kilitle`
9. `fix(ana-sayfa): UTT video durumlarını gerçek denemeden türet`

Commit'ler yalnız plan onayı ve ilgili adımın üçlü doğrulaması sonrasında atılır. Canlı DB SQL adımları committen bağımsız olarak yalnız İskender tarafından yürütülür.

---

## 10. Plan Onay Noktaları

Kodlamaya geçmeden önce aşağıdaki kararların bu planla onaylandığı kabul edilmelidir:

1. Soru hakkı ömür boyu değil, geçerli yayın turu içindedir.
2. Puansız zamanda ileri sarma soru hakkını kapatır fakat pozitif puan kaybı yazmaz.
3. Her yeni gerçek deneme sıfırdan başlar.
4. Sonraki tamamlamada tam izleme puanı verilir; eski kayıplar ayrıca kalır.
5. Pozitif ileri sarma kaybı en az 1 puandır.
6. Aynı denemede daha önce gerçekten izlenmiş bölgeye ilerlemek yeniden kayıp doğurmaz; yeni denemede aynı bölgeyi yeniden atlamak yeni olaydır.
7. "Yeni Videolar" ayrı kalır; ana sayfanın görsel tasarımı bu işin ardından yapılır.

