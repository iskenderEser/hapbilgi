# E9 — HBLigi Geliştirme İş Planı

*31.07.2026. Kaynak: açık işler md.9 (HB Ligi ölçeklenmesi) + bu tarihte yapılan
kod ve DB keşfi. Bu belge yalnız E9 çalışmasının adımlarını taşır; her geçilen
başarılı adım "yapıldı" işaretlenir ve tek commit atılır (push yok).*

---

## Çalışma düzeni

- **Lokal çalışma, `origin`'e push YOK.** HBLigi'nin birebir `_v2` kopyası kurulur,
  geliştirme orada yapılır, v1 hiç durmadan çalışır (talepler_v2 mantığı).
- **Kapsam (Kural 1a):** yalnız **lig/hesaplama katmanı**. Olay tablolarının yazım
  katmanına (izleme→puan) dokunulmaz — o çekirdeğin ayrı düğümüdür.
- **Kaynak:** 4 olay tablosu (kazanılan puanlar + 3 kayıp) paylaşılır, kopyalanmaz;
  v2 aynı tablolardan okur.
- **Doğrulama (Kural 6b):** her adım tsc + denetim + lint:mimari + tek smoke test.
- **DB (Kural 5):** yapı/veri değiştiren SQL'i İskender koşar; Claude SQL'i verir ve
  kod tarafını yazar.

## Hedef

Bugün lig, her okumada 4 tablonun tamamını sıfırdan `GROUP BY` ile toplayan `hb_ligi`
üzerinden çalışıyor (ilkel çekirdek). Ölçekten bağımsız olarak bu ilkel yöntem
istenmiyor; toplamı önceden tutan **özet tablo** ile değiştirilecek. Sıralama
(`row_number`) zaten ucuz, korunur.

---

## Keşif özeti (doğrulanmış)

- **İki okuma yolu, aynı 22 kolon:** tüm-zaman (`v_hbligi_sirali`) + periyot
  (`get_hb_ligi_aylik/donemlik/yillik`).
- **Tüm-zaman tüketicileri:** `app/profil/api/route.ts` (3 sıra kolonu),
  `lib/rapor/utt/getUttData.ts` ×3 (kişisel sıra, bölge listesi, takım toplamı).
- **Periyot tüketicileri:** lig sayfası → `lib/hbligi/ligRpcCagir.ts` → 4 rol
  fonksiyonu (`getUttLig/getBmLig/getTmLig/getGenelLig`) + `agregasyonlar.ts`.
- **İki katman:** `hb_ligi` (SUM) → `v_hbligi_sirali` (JOIN + `row_number` sıralar).
- **Periyot = takvim `created_at` penceresi** (ay/çeyrek/yıl). Bu yüzden tek toplam
  tutan özet tablo yetmez → **ay bazlı kova** gerekir.
- **Yazım:** 3 tablo canlı (`lib/puan/kayit.ts` → izle/bitir/cevap/ileri-sarma).

## Kararlar (mutabık)

1. **Bakım yöntemi:** DB trigger — 4 tabloya `AFTER INSERT`, kaynaktan bağımsız her
   yazımı yakalar, özet asla sapmaz.
2. **Kova granülerliği:** ay bazlı (kişi × yıl × ay). Çeyrek = 3 ay, yıl = 12 ay,
   tüm-zaman = tüm aylar toplamı.
3. **Öneri kaybı:** ön koşul olarak v1'de düzeltildi (aşağıda) → kopya temiz.

---

## Ön koşul — v1 öneri kaybı düzeltmesi

- [x] **Ö.1** `oneri_kaybi_tara()` fonksiyonu DB'ye kuruldu; `td07` simetri denetimi
  temiz; repo'ya alındı (`scripts/sql/oneri_kaybi_tara.sql`). *(commit 683c3b5)*

## Faz 1 — Birebir kopya (v2 = v1)

- [x] **1.1** DB kopyası: `hb_ligi_v2`, `v_hbligi_sirali_v2`,
  `get_hb_ligi_aylik/donemlik/yillik_v2` — v1'in aynısı, `_v2` ekiyle. Kuruldu;
  SQL repo'da (`scripts/sql/hbligi_v2_kopya.sql`). *(SQL — İskender)*
- [x] **1.2** Kod kopyası: `lib/hbligi_v2/` (6 dosya), `_v2` RPC'lerine bağlı.
  Teknik üçlü temiz (tsc / denetim / lint:mimari). *(Claude)*
- [x] **1.3** Sadakat doğrulaması: v2 çıktısı v1 ile birebir aynı — tüm-zaman +
  3 periyot `EXCEPT` farkı dört yönde de 0. *(SQL — İskender)*

## Faz 2 — Özet tablo (ölçek geliştirmesi)

- [ ] **2.1** `hb_ligi_ozet_v2` tablosu: `kullanici_id + yil + ay + 4 kazanım +
  3 kayıp`. Sıra kolonu YOK (okuma anında `row_number`). *(SQL — İskender)*
- [ ] **2.2** Backfill: mevcut 4 tablodan `INSERT…SELECT…GROUP BY kullanici_id,
  date_trunc('month')`. *(SQL — İskender)*
- [ ] **2.3** Bakım tetikleyicisi: 4 tabloya `AFTER INSERT` → ilgili (kullanıcı,
  yıl, ay) kovasını günceller. *(SQL — İskender)*
- [ ] **2.4** `hb_ligi_v2` + periyot RPC'leri özet tablodan okuyacak şekilde yeniden
  yazılır (SUM yerine hazır toplam + `row_number`). Çıktı yine 22 kolon. *(SQL — İskender)*
- [ ] **2.5** Koruma: `hb_ligi_ozet_v2` → `KORUMALI_TABLOLAR`; sema.json yenilenir.
  *(Kod: Claude / sema-cek: İskender)*
- [ ] **2.6** Paralel doğrulama (doğruluk kapısı): özet tabanlı v2, canlı-SUM v1 ile
  birebir tutuyor mu — tüm-zaman + tüm periyotlar. Tutmadan sonraki faza geçilmez.

## Faz 3 — Karşılaştırma raporu

- [ ] **3.1** v1 ↔ v2 tam fark raporu. Fark çıkarsa gerçek hata kanıtıdır → tek tek
  incelenir.

## Faz 4 — Geçiş (cutover) — lokal, ayrı onay

- [ ] **4.1** Tüketiciler (`profil/api`, `getUttData`, `lib/hbligi` kullanımı) v2'ye
  yönlendirilir. Push yok; lokal doğrulama.

## Faz 5 — v1 emekli — ayrı onay

- [ ] **5.1** v2 kanıtlanınca v1 nesneleri (`hb_ligi`, `v_hbligi_sirali`, 3 RPC,
  `lib/hbligi`) kaldırılır; `_v2` ekleri sadeleştirilir.
