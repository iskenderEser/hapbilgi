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
| T-1 | Aktivasyon kilidi kapsamı: aktif firmaya eksikli kullanıcı yüklenmesi senaryosu — **İskender kararı bekliyor:** (A) yükle + belirgin uyarı/gösterge, (B) reddet (K-A6 metni birlikte güncellenir) | ORTA | Karar bekliyor |
| T-2 | FirmaSidebar'a "⚠ N eksik bilgili kullanıcı" göstergesi (plandaki "sebepli engel mesajı"nın hiç yapılmamış ayağı) | ORTA | Onay bekliyor |
| T-3 | K-A3 tamamlanması: admin bileşenlerindeki 19 eski mavi (#1d4ed8) vurgu bordo görsel diline çevrilir — tek görsel dil | ORTA | Onay bekliyor |
| T-4 | PUT rol değişimi `rolCoz`'dan geçer — rol kural kaynağı tekleşir (bugün: tekli/toplu çözüyor, PUT çözmüyor) | NOT | Onay bekliyor |
| T-5 | Önizleme tablosunda rol, ham girdi yerine çözülmüş insan adıyla gösterilir | NOT | Onay bekliyor |
| T-6 | Dosya seçici `.xls` kabulü — rotayla eşitlenir | NOT | Onay bekliyor |
| T-7 | Eksik bilgili kullanıcının doğum durumu — **İskender kararı bekliyor:** aktif mi pasif mi doğsun (pasif = eksik tamamlanınca admin aktifler) | ORTA | Karar bekliyor |

## Öncelikli kontrol gerektiren geçmiş beyanlar

Aşağıdakiler commit'li ama sahada doğrulanmamış — fiziksel test/kontrol öncesi "kapanmış" sayılmaz:

- M0 bulgu düzeltmelerinin tamamı (B-17, B-18+B-21+B-22, B-19, B-20, B-23, B-24) — kod tarandı, canlı akış doğrulanmadı.
- M3-a/b/c/d/e — önizleme aşaması fiziksel testte doğrulandı (18.07); kaydet/tamamlama/kilit akışları canlıda hiç koşulmadı.
- DB durumu (18.07 salt-okur doğrulama): hepifarma'da kullanıcı 0, takım 0, bölge 0; auth'ta @test2.com hesabı 0 — yani test henüz yükleme aşamasına geçmedi, temizlenecek veri yok.

## Sıra önerisi

Kararlar (T-1, T-7) → NOT sınıfı hızlı üçlü (T-4, T-5, T-6) → T-2 → T-3 → İskender fiziksel testi (takım/bölge tanımlı firma ile tam akış: önizleme → kaydet → eksik tamamlama → kilit).

*Bu belge canlıdır; her madde kapandıkça durum kolonu İskender onayı ile güncellenir.*
