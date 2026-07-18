# Güvenilir Olmayan Refactoring. Tüm Süreçler Öncelikli Kontrol Edilmesi Gerekir

*Ayrı üretim planı — 18.07.2026. Bu belge, admin modernizasyonu M0–M3 uygulaması sırasında Code'un ürettiği plan dışı iş yükünün kaydıdır. Kaynak: İskender'in fiziksel test bulguları + 18.07 soğuk taraması. Bu plandaki işleri bu sayfa (bu oturumun sorumlusu) yürütür; başka bir çalışma sayfasına devredilmez.*

## Neden bu belge var

M0–M3 işleri "üçlü doğrulama + smoke temiz" beyanıyla kapatıldı; fiziksel test ilk denemede 11/11 satırı düşürdü (Excel sayı tipi körlüğü). Ardından yapılan soğuk taramada plandan sessiz sapmalar ve dar yorumlar bulundu. Sonuç: **bu dönemde üretilmiş hiçbir "bitti" beyanı, öncelikli kontrol yapılmadan kapanmış sayılmaz.** Güven, bu plandaki maddelerin tek tek kapatılması ve İskender'in fiziksel doğrulamasıyla yeniden kurulur.

## Çalışma disiplini (bu plana özel, pazarlıksız)

1. Her madde öncesi plan İskender'e sunulur, **onaysız tek satır kod yazılmaz**.
2. Her madde ayrı commit; üçlü doğrulama (tsc + denetim + lint:mimari) zorunlu.
3. Smoke test girdileri **gerçek/insan-format veriden** türetilir — idealize edilmiş girdi yasak.
4. Plandan her sapma ya da planın öngörmediği her senaryo: **DUR + tek cümleyle sor.** Sessiz dar yorum ve sessiz budama bu belgenin varlık sebebidir; tekrarı kabul edilmez.
5. Kapanış beyanı Code'dan değil İskender'den gelir: madde, onun kontrolünden geçmeden "bitti" sayılmaz.

## İş maddeleri (kaynak: 18.07 soğuk taraması, T-serisi)

| # | İş | Önem | Durum |
|---|---|---|---|
| T-1 | Aktivasyon kilidi kapsamı: aktif firmaya eksikli kullanıcı yüklenmesi senaryosu | ORTA | **KAPANDI (18.07, İskender kararı: yükle + uyarı)** — satırlar yüklenir (T-7 gereği pasif doğar), eksikler listede amber satır + rozetle görünür; firma aktifliğine dokunulmaz |
| T-2 | FirmaSidebar'a "⚠ N eksik bilgili kullanıcı" göstergesi (plandaki "sebepli engel mesajı"nın hiç yapılmamış ayağı) | ORTA | Onay bekliyor |
| T-3 | K-A3 tamamlanması: admin bileşenlerindeki 19 eski mavi (#1d4ed8) vurgu bordo görsel diline çevrilir — tek görsel dil | ORTA | Onay bekliyor |
| T-4 | PUT rol değişimi `rolCoz`'dan geçer — rol kural kaynağı tekleşir (bugün: tekli/toplu çözüyor, PUT çözmüyor) | NOT | Onay bekliyor |
| T-5 | Önizleme tablosunda rol, ham girdi yerine çözülmüş insan adıyla gösterilir | NOT | **KAPANDI (18.07, upsert Adım 3 içinde)** — satır artık kanonik rol kodunu taşır, önizleme ROL_ADLARI ile insan adı basar; ham rolün DB'ye yazılma açığı da bu değişiklikle kapandı |
| T-6 | Dosya seçici `.xls` kabulü — rotayla eşitlenir | NOT | Onay bekliyor |
| T-7 | Eksik bilgili kullanıcının doğum durumu | ORTA | **KAPANDI (18.07, İskender kararı: pasif doğar + otomatik aktifleşme)** — eksikli kullanıcı pasif yaratılır; eksiği kapatan işlem (PUT atama/telefon ya da toplu upsert) kullanıcıyı otomatik aktifler; bilinçli pasife alınmış eksiksiz kullanıcıya kural dokunmaz; firma aktifleştirme adminde kalır (kilit kalkınca tek tık) |

## Öncelikli kontrol gerektiren geçmiş beyanlar

Aşağıdakiler commit'li ama sahada doğrulanmamış — fiziksel test/kontrol öncesi "kapanmış" sayılmaz:

- M0 bulgu düzeltmelerinin tamamı (B-17, B-18+B-21+B-22, B-19, B-20, B-23, B-24) — kod tarandı, canlı akış doğrulanmadı.
- M3-a/b/c/d/e — önizleme aşaması fiziksel testte doğrulandı (18.07); kaydet/tamamlama/kilit akışları canlıda hiç koşulmadı.
- DB durumu (18.07 salt-okur doğrulama): hepifarma'da kullanıcı 0, takım 0, bölge 0; auth'ta @test2.com hesabı 0 — yani test henüz yükleme aşamasına geçmedi, temizlenecek veri yok.

## Sıra önerisi

~~Kararlar (T-1, T-7)~~ KAPANDI → kalan: NOT sınıfı hızlı ikili (T-4, T-6) → T-2 → T-3 → İskender fiziksel testi (takım/bölge tanımlı firma ile tam akış: önizleme → kaydet → eksik tamamlama → upsert ile ikinci liste → otomatik aktifleşme → kilit).

## Upsert aşaması (18.07.2026 — bu plandan sonra eklenen iş, kararları İskender'in)

Toplu yükleme upsert modeline geçti (3 adım + T-1/T-7, dört commit). Kararlar:

1. **Kalıcı kimlik:** kullanıcı takibi `kullanici_id` (auth UUID) üzerinden; Excel'de ID görünmediği için eşleştirme anahtarları **e-posta + telefon**.
2. **Telefon kimlik çekirdeğine girdi** (ad, soyad, e-posta, telefon, şifre*, rol): telefonsuz satır yüklenmez. Normalize: `05XXXXXXXXX` (telefonNormalize). DB: `kullanicilar.telefon` + benzersiz index (SQL'i İskender uyguladı). Mevcut 31 kayda sahte `0532000XXXX` backfill (İskender uyguladı) — gerçek numara gelince panelden/upsert'le düzeltilir.
3. **Upsert davranışı:** satır önce e-posta, sonra telefonla eşleşir → değişen alanlar güncellenir; e-posta değişikliği telefon eşleşmesiyle yakalanır (auth e-postası da telafili sırayla güncellenir). Çakışma (anahtarlar farklı kişilere çıkarsa), dosya içi mükerrer telefon/e-posta ve aynı kullanıcıya çift eşleşme = görünür satır hatası. Yeni listede olmayan mevcut kullanıcıya DOKUNULMAZ.
4. **Şifre:** dosya düzeyinde zorunlu değil (*yalnız YENİ kullanıcı satırında zorunlu); mevcut kullanıcıda ASLA ezilmez.
5. **Tekil yol:** telefonu boş eski kayda liste hücresinden telefon ekleme (Enter → PUT, aynı normalize kuralı).

Kapanış: İskender'in fiziksel testi (yukarıdaki tam akış) — kod tarafı beyanı kapanış sayılmaz.

*Bu belge canlıdır; her madde kapandıkça durum kolonu İskender onayı ile güncellenir.*
