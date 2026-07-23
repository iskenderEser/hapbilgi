# Talep/Yayın Silme — Geliştirme Belgesi (24.07.2026)

## Amaç ve kural
Admin'in bir talebi/yayını **görünen ID** ile silebilmesi. Her yerde tek kural:

- **bekleyen** (yayını doğmamış) → sil
- **puansız yayın** → sil (tüm bağlı tüketici kayıtlarıyla)
- **puanlı yayın** → **silme, koru** (tekilde "durdur" önerilir)

"Puan" = kazanç **ve** kayıp; herhangi bir puan defterinde bu yayına kayıt varsa yayın puanlıdır.
Mekanizma: atomik RPC. Girdi: görünen ID (`FirmaAdı_talep_no`, ör. `hepifarma_30008`). Yetki: admin.

---

## Adım 0 — Keşif (salt okuma)

**Puan defterleri (4 kanal, 14 tablo)** ve yayına bağlanma yolu:

| Kanal | Defterler | Bağ |
|---|---|---|
| T-Club | kazanilan_puanlar, yanlis_cevap_kayitlari, ileri_sarma_kayitlari, oneri_kayip_kayitlari | `yayin_id` |
| C-Club | cc_kazanilan_puanlar, cc_ileri_sarma_kayitlari, cc_yanlis_cevap_kayitlari, challenge_kayip_kayitlari | `yayin_id` |
| E-Club | eclub_kazanilan_puanlar, eclub_utt_puanlari, eclub_dogru_cevap_kayitlari, eclub_yanlis_cevap_kayitlari, eclub_oneri_kayip_kayitlari | `yayin_id` |
| Eczanem | eczanem_puan_kayitlari | **`yayin_id` YOK** → `izleme_id → eczanem_izleme_kayitlari.yayin_id` |

**Kritik bulgular:**
1. Eczanem puan kaydı yayına doğrudan bağlı değil (ürün-firma-eczane bazlı harcanabilir sadakat parası; İş Planı §5.5/§6.1/§9.2 gereği bilinçli tasarım) — kontrol izleme üzerinden JOIN ister.
2. **FK'siz `yayin_id` kolonu taşıyan 3 tablo:** `ileri_sarma_kayitlari`, `eclub_dogru_cevap_kayitlari`, `eclub_utt_puanlari`. Cascade/ters-FK bunları yakalamaz → RPC elle silmeli/kontrol etmeli.
3. `video_puanlari` / `soru_seti_puanlari` "puan" değil (üretim artefaktı kalite oylaması) — puan kontrolüne girmez, ama tekil silmede üretim zincirinin çocuğu olarak silinir.
4. `bildirimler` ve `eclub_bildirimler` FK'siz (polymorphic `kayit_turu`+`kayit_id`) → tekil silmede hedefli temizlenir.
5. `eczanem_gonderimler` / `eczanem_eczane_gonderimleri` de yayına bağlı → tekil kapsamda.

**Üretim zinciri (silme sırası çocuk→ebeveyn):**
```
[yayın-bağlı çocuklar: izleme/puan/kayıp/beğeni/favori/gönderim + soru_cevaplari]
 → challenge_kayitlari / oneri_kayitlari / eclub_oneri_kayitlari / *_izleme / yayin_tekrar_kayitlari
  → yayin_yonetimi
   → soru_seti_durumu → soru_setleri → video_durumu → videolar → senaryo_durumu → senaryolar → talepler
```

**Durdur akışı (mevcut, yeniden kullanıldı):** `yayin_yonetimi.durum='Durduruldu'` + `durdurma_tarihi=now`.
**ID çözümü:** görünen ID'nin son segmentindeki sayı = `talep_no` (global benzersiz) → `talepler WHERE talep_no=?`.

---

## Adım 1 — RPC tasarımı (onaylandı)

1. **`yayin_puan_var_mi(yayin_id) → boolean`** — 14 defterde OR'lu `EXISTS`, ilk kayıtta kısa devre.
2. **`tekil_talep_sil(talep_id) → jsonb`** — atomik; bekleyen/puansız→sil, puanlı→`durdurulabilir` sinyali (silmeden önce kontrol).
3. **`toplu_test_sil() → jsonb`** — atomik; puanlı yayınları ve zincirini koru, gerisini sil (eski `test-verileri-sil` mantığı + stok iadesi buraya taşındı).

---

## Adım 2 — RPC'lerin kurulumu

Üç fonksiyon ayrı SQL dosyası olarak yazıldı, Supabase SQL editöründe kuruldu:
- `scripts/sql/yayin_puan_var_mi.sql` — doğrulandı: puanlı yayın→`true`, puansız→`false`.
- `scripts/sql/tekil_talep_sil.sql`
- `scripts/sql/toplu_test_sil.sql`

Hepsi `SECURITY DEFINER`, `search_path='public'`, `GRANT EXECUTE … service_role`, idempotent (`CREATE OR REPLACE`).
`npm run denetim:sema` ile şema tazelendi: **RPC 55 → 58**; üç imza da kayıtlı.

**Silme sırası detayı (tekil):** id'ler silmeden önce dizilere toplanır (zincir bozulmadan); yayın-bağlı tablolar `yayin_id ∈ Y`, yayın_id taşımayanlar izleme/durum üzerinden, üretim zinciri `talep_id`/chain ile, bildirimler `(kayit_turu,kayit_id)` ile hedefli.
**Eczanem zinciri:** `eczanem_puan → eczanem_izleme → eczanem_gonderimler`; `eczanem_eczane_gonderimleri` bağımsız (ikisi de doğrudan yayına).

---

## Adım 3 — Backend uçları

**Yeni:** `app/admin/api/talep-sil/route.ts`
- `GET ?id=<görünen_id>` → talep özeti (firma·ürün·teknik·durum + puan var mı). Yayın çözümü `v_yayin_detay` (talep_no taşır; bekleyen talepte satır yok → `yayin_var=false`).
- `POST { id, islem }` → `islem='sil'`: `tekil_talep_sil` RPC · `islem='durdur'`: yayında yayınları `Durduruldu` yapar (mevcut mekanizma).

**Değişen:** `app/admin/api/test-verileri-sil/route.ts` → ince sarmalayıcı (admin kontrol → `toplu_test_sil` RPC → rapor). Eski JS silme mantığı ve stok iadesi RPC'ye taşındı.

Her ikisinde yetki `adminGirisKontrol` + `createAdminClient` (service_role).

---

## Adım 4 — UI

**Yeni:** `app/admin/_components/TalepYayinSilModal.tsx` — iki mod (radyo):
- **Tekil:** ID gir → **Önizle** (özet kartı + PUANLI/Puansız rozeti) → **Sil**. Sonuç `durdurulabilir` ise "Bu yayını silemezsiniz — puanlı. Durdurmak ister misiniz?" → Evet: durdur · Hayır: iptal.
- **Toplu:** onay → Sil (`test-verileri-sil` → `toplu_test_sil`). Korunacaklar listesinde "puanlı yayınlar" vurgulanır.

**Değişen:** `app/admin/page.tsx` (yeni modal), `app/admin/_components/AdminUstBar.tsx` (buton etiketi "Test Verilerini Sil" → "Talep/Yayın Silme").
**Silinen:** eski `TestVeriSilModal.tsx` + referanssız/kırılan `app/admin/test-temizlik/` sayfası (konsolidasyon).

---

## Adım 5 — Doğrulama

- **Kod üçlüsü** her adımda temiz: `tsc` ✓ · `npm run denetim` ✓ · `npm run lint:mimari` ✓.
- **RPC 1** İskender tarafından SQL ile doğrulandı (true/false).
- **Fiziksel test** (İskender): bekleyen sil · puansız yayın sil · puanlı yayın → durdur uyarısı · toplu — **yapıldı, OK**.
- Ajans tarafında test verisi yaratılmadı → temizlenecek kayıt yok.

---

## Dosya özeti
**Yeni:** `scripts/sql/{yayin_puan_var_mi,tekil_talep_sil,toplu_test_sil}.sql`, `app/admin/api/talep-sil/route.ts`, `app/admin/_components/TalepYayinSilModal.tsx`, bu belge.
**Değişen:** `app/admin/api/test-verileri-sil/route.ts`, `app/admin/page.tsx`, `app/admin/_components/AdminUstBar.tsx`, `scripts/denetim/{sema,kullanim}.json` (yeniden üretildi).
**Silinen:** `app/admin/_components/TestVeriSilModal.tsx`, `app/admin/test-temizlik/page.tsx`.
