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

- [x] **2.1** `hb_ligi_ozet_v2` tablosu: `kullanici_id + yil + ay + 4 kazanım +
  3 kayıp`. Sıra kolonu YOK (okuma anında `row_number`). Kuruldu (boş), SQL
  repo'da (`scripts/sql/hbligi_v2_ozet.sql`). RLS geliştirme boyunca kapalı
  (genel kural — tüm RLS'ler geliştirme sonunda aktive edilir). *(SQL — İskender)*

  *Not — kalan sıra (yarış-güvenli):* **2.3 trigger → 2.2 backfill.** Trigger
  aktifken backfill yetkili tam-hesapla (SET) koşulur; backfill anındaki gerçeği
  yazar, sonraki yazımları trigger yakalar.
- [x] **2.2** Backfill: mevcut 4 tablodan kişi × ay kovaları dolduruldu (yetkili
  tam-hesap/SET). Doğrulama: özet tüm-zaman toplamı v1 `hb_ligi` ile birebir
  (`farkli=0`). SQL repo'da (`scripts/sql/hbligi_v2_backfill.sql`). *(SQL — İskender)*
- [x] **2.3** Bakım tetikleyicisi: 4 tabloya `AFTER INSERT` → ilgili (kullanıcı,
  yıl, ay) kovasını günceller. Kuruldu (tek generic fonksiyon + 4 trigger);
  yalnız INSERT (silme → backfill ile resync). *(SQL — İskender)* — sıra: 2.2'den önce koşuldu.
- [x] **2.4** `hb_ligi_v2` + periyot RPC'leri özet tablodan okur (SUM yerine hazır
  toplam + `row_number`). Çıktı yine 22 kolon. SQL repo'da
  (`scripts/sql/hbligi_v2_okuma.sql`). *(SQL — İskender)*
- [x] **2.5** Koruma: `hb_ligi_ozet_v2` → `KORUMALI_TABLOLAR` (eslint). Teknik üçlü
  temiz. sema.json yenilemesi sona ertelendi — tablo TS'te referans edilmiyor,
  denetim temiz; sema tüm iş bitince yenilenir. *(Kod: Claude)*
- [x] **2.6** Paralel doğrulama (doğruluk kapısı): özet tabanlı v2, canlı-SUM v1 ile
  **birebir** — tüm-zaman + aylık + dönemlik + yıllık `EXCEPT` farkı dört yönde de 0.

## Faz 3 — Karşılaştırma raporu

- [x] **3.1** v1 ↔ v2 tam fark raporu — fark YOK. **Statik** (2.6: tüm-zaman +
  3 periyot `EXCEPT`=0) + **canlı** (trigger smoke testi: +999 puan yazımından
  sonra tümzaman/aylık/yıllık fark 0, `ROLLBACK` ile kalıntısız). Trigger
  canlılığı doğrulandı; cutover'a hazır.

## Faz 4 — Geçiş (cutover) — lokal, ayrı onay

- [x] **4.1** Tüketiciler v2'ye yönlendirildi: `app/hbligi/api/route.ts`
  (`lib/hbligi` → `lib/hbligi_v2`), `app/profil/api/route.ts` +
  `lib/rapor/utt/getUttData.ts` (`v_hbligi_sirali` → `_v2`). Teknik üçlü temiz;
  app'te v1 referansı kalmadı. Push yok. *(Claude)*

## Faz 5 — v1 emekli — ayrı onay

- [x] **5.1** v1 kaldırıldı: DB nesneleri (`v_hbligi_sirali`, `hb_ligi`, 3 v1 RPC)
  DROP edildi (`scripts/sql/hbligi_v1_kaldir.sql`); `lib/hbligi/` (6 dosya) silindi;
  `td11` audit'i `_v2`'ye çevrildi. `_v2` ekleri korundu (rename riski alınmadı).
  Teknik üçlü temiz. *(SQL — İskender / kod — Claude)*

---

*E9 kapandı — HBLigi ölçek geçişi tamam. Kalan: REDBOOK §497/499/785 + acik_isler
md.9 v1'i "güncel" anlatıyor → ayrı doküman güncellemesi (Kural 2a, İskender onayı).*

---

## Faz 6 — Haftalık periyot + günlük özet (31.07.2026)

Karar: HBLigi'ye **haftalık** periyot eklenir. Özet **günlük** kovaya geçer (tüm
periyotlar günden türer, K1-A); hafta seçici **geçmiş haftaları** da kapsar (K2-ii).
Doğrulama: v1 yok → günlük çıktı, taban-tablo canlı-SUM ile ve mevcut aylık v2 ile
karşılaştırılır. Migrasyon sırasında (6.1–6.4 arası) lig sayfası kısa süre hata
verebilir (lokal/dev — kabul).

- [x] **6.1** Günlük özet şeması: `hb_ligi_ozet_v2` → `(kullanici_id, tarih)`. *(SQL — İskender)*
- [x] **6.2** Trigger: kova `created_at::date`. *(SQL — İskender)*
- [x] **6.3** Backfill: `GROUP BY kullanici_id, created_at::date`. *(SQL — İskender)*
- [x] **6.4** Okuma katmanı: `hb_ligi_v2` + `v_hbligi_sirali_v2` + aylık/dönemlik/yıllık,
  ortak `_hb_ligi_v2_aralik(bas,bit)` yardımcısıyla günlükten tarih-aralığı toplar. *(SQL — İskender)*
- [x] **6.5** Yeni `get_hb_ligi_haftalik_v2(p_yil, p_hafta)` — Pazartesi bazlı hafta aralığı. *(SQL — İskender)*
- [x] **6.6** Doğrulama: günlük çıktı taban-tablo canlı-SUM ile birebir — tüm-zaman +
  bu-hafta `farkli=0` (aylık/dönemlik/yıllık aynı yardımcıyı paylaşır). *(SQL — İskender)*
- [x] **6.7** UI/kod: `ligRpcCagir` (`"hafta"` + dispatch), `api/route` (`periyotParse`),
  `HbLigiPeriyotSecici` (Haftalık + tarih-etiketli hafta dropdown), `page` (hafta state).
  Teknik üçlü temiz. *(Kod — Claude)*
