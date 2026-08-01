# Toplu ve Tekil Silme — İş Planı

*Oluşturma: 01.08.2026. Bu belge **yaşayan** iş planıdır: her aşama tamamlandıkça
durum ✅ **yapıldı** olarak işaretlenir ve belge güncel tutulur. Karar değişiklikleri
en alttaki Değişiklik Günlüğü'ne yazılır.*

**Durum efsanesi:** ⬜ beklemede · 🟨 yapılıyor · ✅ yapıldı

---

## 0. Amaç

Test ortamındaki **niteliksiz girdileri ve üretilen sonuçları** kolayca, uçtan uca
ve **iz bırakmadan** silmek. Yetki yalnız **admin**'de.

Silme **yalnız ÜRETİLEN veriyi** hedefler; iskelet (kimlik + master + ürün içeriği)
ve **onaylı siparişler** her modda korunur.

---

## 1. Aşama Takibi (özet)

| # | Aşama | Sorumlu | Durum |
|---|---|---|---|
| 0 | Açık kararların kapatılması (3 madde) | İskender | ✅ |
| 1 | RPC `test_veri_temizle` (SQL) | Claude yazar · İskender koşar | ✅ (kuruldu) |
| 2 | RPC `test_veri_sayim` (önizleme) | Claude yazar · İskender koşar | ✅ (kuruldu) |
| 3 | API route `app/admin/api/veri-sil/route.ts` | Claude | ✅ (yazıldı) |
| 4 | Navbar modal (Toplu=tüm · Tekil=talep_id) | Claude | ✅ (yazıldı, tsc+lint temiz) |
| 5 | Firma kartı butonu + onay modalı (FirmaSidebar) | Claude | ✅ (yazıldı, tsc+denetim+lint temiz) |
| 6 | Doğrulama + test verisi temizliği | Claude · İskender | ⬜ |

Bağımlılık: 0 → 1,2 → 3 → 4,5 → 6.

---

## 2. Kapsam İlkesi — KORUNAN / SİLİNEN

**KORUNUR (hiç DELETE edilmez):**
- **Kimlikler:** `kullanicilar`, `eclub_kisiler`, `eczanem_musteriler` (+ Supabase Auth kullanıcıları)
- **Master:** `firmalar`, `takimlar`, `bolgeler`, `urunler`, `teknikler`, `eclub_eczane_master`, `eclub_eczaneler`
- **İçerik + üretim zinciri:** `talepler` → `senaryolar` → `videolar` → `soru_setleri` → `yayin_yonetimi` (+ durum tabloları) ve **Bunny video dosyaları**
- **İçerik puan-değerleri:** `video_puanlari`, `soru_seti_puanlari` — bir videonun/sorunun **kaç puan ettiğini** tutar (yayına alırken girilir), içeriğin parçasıdır
- **Onaylı/tamamlanmış siparişler** (+ fiş, + tüketilmiş stok)

**SİLİNİR (üretilen):** izlemeler · puan/kayıp defterleri · cevaplar · beğeni/favori ·
öneri/challenge/tekrar · gönderimler · onaysız siparişler + adres/harcama · davet/OTP/üyelik ·
bildirimler · **push abonelik + gönderim** · lig özet-cache'leri. (Tam liste §5'te.)

**İz bırakmama:** Push kayıtları DB'de olduğundan RPC siler (eski aracın açığı buradaydı).
Bunny/Auth/ürün dosyaları korunan iskelet olduğu için dış çağrı gerekmez.

---

## 3. Mimari

Tek parametrik çekirdek + önizleme + API + iki UI tetikleyici. **RPC/API katmanı üç
mod için ortaktır**; yalnız çağıran nokta ve kapsam parametresi değişir.

```
UI (2 giriş)                         API                         DB (RPC)
─────────────────────────────────────────────────────────────────────────
Navbar "Toplu/Tekil Sil" ─┐
  Toplu → mod='tum'        ├─► /admin/api/veri-sil ─► test_veri_sayim() (önizleme)
  Tekil → mod='tekil'      │        (adminGirisKontrol)   test_veri_temizle() (silme)
Firma kartı "Sil" ─────────┘
  → mod='firma', firma_id (karttan, elle giriş YOK)
```

- **Navbar butonu:** Toplu → tüm firmalar; Tekil → `talep_id`. (Firma seçeneği navbarda YOK.)
- **Firma kartı butonu (`FirmaSidebar`):** o firmanın verisi; `firma_id` bağlamdan gelir.
- Her tetiklemede: **sayım önizleme → son onay (geri alınamaz) → silme.**
- Güvenlik iki katman: proxy `/admin` bekçisi + route `adminGirisKontrol`.
- **DB işlemleri İskender tarafından koşulur (Kural 5); Claude SQL'i verir.**

---

## 4. Kapsam Çözümü (scope)

Firma bağı **`talep.urun_id → urunler.firma_id`** üzerinden (talepler'de firma_id YOK).

- **Yayın kümesi (`v_yayin`):**
  - `tum` → tüm `yayin_yonetimi`
  - `firma` → `yayin → soru_seti_durumu → soru_setleri → talepler → urunler(firma_id)`
  - `tekil` → o talebin yayınları (`soru_setleri.talep_id = p_talep_id`)
- **İç kullanıcı kümesi (`v_kul`):** `firma` modunda `kullanicilar.firma_id`; store/push/adres kapsamı için.
- **Silinecek sipariş kümesi:** durum ≠ `teslim_edildi`/`onaylandi` (bitmiş sipariş korunur); `tekil` modda boş (sipariş talep-kapsamlı değil).

---

## 5. FK-Güvenli Silme — `test_veri_temizle` (taslak SQL)

> Tek fonksiyon, `p_mod` ile 3 mod. Durum adları ve firma kapsamı §7'de kapandı.

```sql
-- scripts/sql/test_veri_temizle.sql (YENİ — sıfırdan)
CREATE OR REPLACE FUNCTION public.test_veri_temizle(
  p_mod text, p_firma_id uuid DEFAULT NULL, p_talep_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_hepsi boolean := (p_mod = 'tum');
  v_yayin uuid[];  v_kul uuid[];
  v_sipS uuid[]; v_sipE uuid[]; v_sipZ uuid[];   -- SİLİNECEK sipariş kümeleri (onaylı hariç)
BEGIN
  IF p_mod NOT IN ('tum','firma','tekil') THEN RETURN jsonb_build_object('durum','gecersiz_mod'); END IF;
  IF p_mod='firma' AND p_firma_id IS NULL THEN RETURN jsonb_build_object('durum','firma_id_gerekli'); END IF;
  IF p_mod='tekil' AND p_talep_id IS NULL THEN RETURN jsonb_build_object('durum','talep_id_gerekli'); END IF;

  -- KAPSAM: yayın kümesi (firma bağı urun üzerinden)
  v_yayin := CASE p_mod
    WHEN 'tum' THEN ARRAY(SELECT yayin_id FROM yayin_yonetimi)
    WHEN 'firma' THEN ARRAY(
      SELECT y.yayin_id FROM yayin_yonetimi y
      JOIN soru_seti_durumu ssd ON ssd.soru_seti_durum_id = y.soru_seti_durum_id
      JOIN soru_setleri ss ON ss.soru_seti_id = ssd.soru_seti_id
      JOIN talepler t ON t.talep_id = ss.talep_id
      JOIN urunler  u ON u.urun_id  = t.urun_id
      WHERE u.firma_id = p_firma_id)
    ELSE ARRAY(
      SELECT y.yayin_id FROM yayin_yonetimi y
      JOIN soru_seti_durumu ssd ON ssd.soru_seti_durum_id = y.soru_seti_durum_id
      JOIN soru_setleri ss ON ss.soru_seti_id = ssd.soru_seti_id
      WHERE ss.talep_id = p_talep_id)
  END;
  v_kul := CASE WHEN p_mod='firma'
    THEN ARRAY(SELECT kullanici_id FROM kullanicilar WHERE firma_id = p_firma_id) ELSE NULL END;

  -- SİLİNECEK siparişler (onaylı/tamamlanmış KORUNUR; tekil'de sipariş yok)
  IF p_mod <> 'tekil' THEN
    v_sipS := ARRAY(SELECT siparis_id FROM store_siparisler
      WHERE durum <> 'teslim_edildi' AND (v_hepsi OR kullanici_id = ANY(v_kul)));
    v_sipE := ARRAY(SELECT s.siparis_id FROM eclub_store_siparisler s
      WHERE s.durum <> 'teslim_edildi' AND (v_hepsi OR s.siparis_id IN
        (SELECT siparis_id FROM eclub_store_siparis_firma_puan WHERE firma_id = p_firma_id)));
    v_sipZ := ARRAY(SELECT siparis_id FROM eczanem_siparisler
      WHERE durum <> 'onaylandi' AND (v_hepsi OR urun_id IN
        (SELECT urun_id FROM urunler WHERE firma_id = p_firma_id)));
  END IF;

  -- F1) sipariş çocukları (harcama/firma_puan) — puan_kayitlari'ndan ÖNCE
  DELETE FROM eczanem_harcama_kayitlari      WHERE siparis_id = ANY(v_sipZ);
  DELETE FROM store_puan_harcamalari         WHERE siparis_id = ANY(v_sipS);
  DELETE FROM eclub_store_siparis_firma_puan WHERE siparis_id = ANY(v_sipE);

  -- F2) izleme çocukları (cevap + eczanem puan defteri)
  DELETE FROM soru_cevaplari WHERE izleme_id IN (SELECT izleme_id FROM izleme_kayitlari WHERE yayin_id = ANY(v_yayin));
  DELETE FROM eczanem_puan_kayitlari WHERE izleme_id IN (SELECT izleme_id FROM eczanem_izleme_kayitlari WHERE yayin_id = ANY(v_yayin));

  -- F3) puan/kayıp defterleri (yayin_id ile) — 15 tablo
  DELETE FROM kazanilan_puanlar        WHERE yayin_id = ANY(v_yayin);
  DELETE FROM yanlis_cevap_kayitlari   WHERE yayin_id = ANY(v_yayin);
  DELETE FROM ileri_sarma_kayitlari    WHERE yayin_id = ANY(v_yayin);
  DELETE FROM oneri_kayip_kayitlari    WHERE yayin_id = ANY(v_yayin);
  DELETE FROM cc_kazanilan_puanlar     WHERE yayin_id = ANY(v_yayin);
  DELETE FROM cc_yanlis_cevap_kayitlari WHERE yayin_id = ANY(v_yayin);
  DELETE FROM cc_ileri_sarma_kayitlari WHERE yayin_id = ANY(v_yayin);
  DELETE FROM challenge_kayip_kayitlari WHERE yayin_id = ANY(v_yayin);
  DELETE FROM eclub_kazanilan_puanlar  WHERE yayin_id = ANY(v_yayin);
  DELETE FROM eclub_yanlis_cevap_kayitlari WHERE yayin_id = ANY(v_yayin);
  DELETE FROM eclub_dogru_cevap_kayitlari  WHERE yayin_id = ANY(v_yayin);
  DELETE FROM eclub_utt_puanlari       WHERE yayin_id = ANY(v_yayin);
  DELETE FROM eclub_oneri_kayip_kayitlari WHERE yayin_id = ANY(v_yayin);
  DELETE FROM video_begeniler          WHERE yayin_id = ANY(v_yayin);
  DELETE FROM video_favoriler          WHERE yayin_id = ANY(v_yayin);

  -- F4) izleme tabloları (defterlerinden sonra, ebeveynlerinden önce)
  DELETE FROM izleme_kayitlari         WHERE yayin_id = ANY(v_yayin);
  DELETE FROM cc_izleme_kayitlari      WHERE yayin_id = ANY(v_yayin);
  DELETE FROM eclub_izleme_kayitlari   WHERE yayin_id = ANY(v_yayin);
  DELETE FROM eczanem_izleme_kayitlari WHERE yayin_id = ANY(v_yayin);

  -- F5) izleme ebeveynleri: öneri / challenge / gönderim / tekrar
  DELETE FROM oneri_kayitlari       WHERE yayin_id = ANY(v_yayin);
  DELETE FROM eclub_oneri_kayitlari WHERE yayin_id = ANY(v_yayin);
  DELETE FROM challenge_kayitlari   WHERE yayin_id = ANY(v_yayin);
  DELETE FROM eczanem_gonderimler         WHERE yayin_id = ANY(v_yayin);
  DELETE FROM eczanem_eczane_gonderimleri WHERE yayin_id = ANY(v_yayin);
  DELETE FROM yayin_tekrar_kayitlari WHERE yayin_id = ANY(v_yayin);

  -- F6) siparişler (onaysız küme) + kullanılmayan adresler
  DELETE FROM store_siparisler       WHERE siparis_id = ANY(v_sipS);
  DELETE FROM eclub_store_siparisler WHERE siparis_id = ANY(v_sipE);
  DELETE FROM eczanem_siparisler     WHERE siparis_id = ANY(v_sipZ);
  DELETE FROM store_adresler a WHERE (v_hepsi OR a.kullanici_id = ANY(v_kul))
     AND NOT EXISTS (SELECT 1 FROM store_siparisler s WHERE s.adres_id = a.adres_id);
  -- eclub adresler kişi-düzeyi (çok-firmalı) → yalnız 'tum' modunda temizlenir
  DELETE FROM eclub_store_adresler a
     WHERE v_hepsi
     AND NOT EXISTS (SELECT 1 FROM eclub_store_siparisler s WHERE s.adres_id = a.adres_id);

  -- F7) eczanem yan kayıtlar + push + bildirim (tekil'de atlanır)
  IF p_mod <> 'tekil' THEN
    DELETE FROM eczanem_uyelikler WHERE v_hepsi OR eczane_id IN
      (SELECT eczane_id FROM eclub_eczane_firma WHERE firma_id = p_firma_id);
    DELETE FROM eczanem_davetler  WHERE v_hepsi OR eczane_id IN
      (SELECT eczane_id FROM eclub_eczane_firma WHERE firma_id = p_firma_id);
    IF v_hepsi THEN DELETE FROM eczanem_giris_otp WHERE true; END IF;   -- firma bağı YOK → yalnız 'tum'
    DELETE FROM push_abonelikleri       WHERE v_hepsi OR auth_user_id = ANY(v_kul);
    DELETE FROM push_gonderim_kayitlari WHERE v_hepsi OR auth_user_id = ANY(v_kul);
  END IF;
  DELETE FROM bildirimler WHERE (v_hepsi OR alici_id = ANY(v_kul))
     OR (kayit_turu = 'yayin' AND kayit_id = ANY(v_yayin));   -- + talep/oneri/challenge türleri
  DELETE FROM eclub_bildirimler WHERE v_hepsi OR gonderen_id = ANY(v_kul);

  -- F8) özet-cache tazeleme (puan gitti → hayalet kalmasın)
  IF v_hepsi THEN
    TRUNCATE cc_ligi_ozet, hb_ligi_ozet_v2, hb_ligi_v2;
  ELSE
    DELETE FROM cc_ligi_ozet    WHERE kullanici_id = ANY(v_kul);
    DELETE FROM hb_ligi_ozet_v2 WHERE kullanici_id = ANY(v_kul);
    DELETE FROM hb_ligi_v2      WHERE kullanici_id = ANY(v_kul);
  END IF;

  RETURN jsonb_build_object('durum','silindi','mod',p_mod,
    'yayin_sayisi', COALESCE(array_length(v_yayin,1),0));
END $$;
GRANT EXECUTE ON FUNCTION public.test_veri_temizle(text,uuid,uuid) TO service_role;
```

---

## 6. Önizleme — `test_veri_sayim`

Aynı kapsam CTE'leri (`v_yayin`, `v_kul`, sipariş kümeleri), DELETE yerine `COUNT`.
Döner (JSON): `{ izleme, puan_kaydi, oneri, challenge, siparis_silinecek,
sipariş_korunacak, push, bildirim }`. Modal "son onay"dan önce bu sayıları gösterir.

---

## 7. Kapanan Kararlar (Aşama 0 — ✅ 01.08.2026)

1. **Korunacak sipariş durumu:** Bitmiş sipariş = **`teslim_edildi`** (mağazalar) /
   **`onaylandi`** (eczanem) korunur; gerisi (bekleyen, hazırlanıyor, kargoda, iptal) silinir.
   Store yaşam döngüsü: *bekliyor → (hazırlanıyor) → kargoda → teslim_edildi*.
2. **Firma kapsamı — belirsizlik yok, sipariş zaten firmaya yazılı:** HBStore → **alan kişinin
   firması** (`kullanici_id → kullanicilar.firma_id`); E-Club Store → **puanı veren firma**
   (`eclub_store_siparis_firma_puan.firma_id`). Adresler kişi-düzeyi (çok-firmalı) → firma
   modunda silinmez, yalnız `tum` modunda temizlenir.
3. **`video_puanlari` / `soru_seti_puanlari`:** "Kalite oyu" DEĞİL — bir videonun/sorunun
   **kaç puan ettiğini** tanımlar (yayına alırken girilir). İçeriğin parçası → **KORUNUR**.

---

## 8. Doğrulama (Aşama 6)

- **Smoke (1 mutlu + 1 red):**
  - Mutlu: bir firma sil → o firmanın üretileni gitti, iskelet + onaylı sipariş + diğer firmalar durdu, push temiz, lig özeti tazelendi.
  - Red: yetkisiz kullanıcı / geçersiz `firma_id`·`talep_id` → reddedilir.
- **Teknik üçlü:** `tsc` + denetim + `lint:mimari`.
- Oluşturulan test verisi iş sonunda temizlenir (Kural 6d).

---

## 9. Değişiklik Günlüğü

- **01.08.2026** — Belge oluşturuldu. Firma silme, navbar modal yerine **firma kartı
  (`FirmaSidebar`) butonuna** taşındı (firma_id bağlamdan gelir, elle giriş kalktı;
  navbar Toplu = yalnız tüm firmalar). RPC/API katmanı değişmedi.
- **01.08.2026** — Aşama 0 kapandı. Store mantığı koddan öğrenildikten sonra 3 karar netleşti:
  (1) korunan sipariş = `teslim_edildi`/`onaylandi` (`tamamlandi` yanlıştı → düzeltildi);
  (2) firma kapsamı zaten sistemde tanımlı (alıcı firması / `firma_puan.firma_id`), belirsizlik yoktu;
  (3) `video_puanlari`/`soru_seti_puanlari` = içerik puan-değeri, "kalite oyu" nitelemesi hatalıydı → KORUNUR.
  SQL'deki durum adları ve eclub adres kapsamı buna göre düzeltildi.
- **01.08.2026** — Aşama 1: `scripts/sql/test_veri_temizle.sql` yazıldı (sıfırdan, tek fonksiyon
  3 mod). Eklenen incelikler: stok iadesi (silinen, iptal-olmayan siparişler), atomik tek işlem,
  özet-cache resync fonksiyon içine gömüldü (TRUNCATE + backfill; `hb_ligi_v2` VIEW olduğu için
  dokunulmadı, E-Club Ligi cache'siz). İskender koşup doğrulayınca ✅.
- **01.08.2026** — Aşama 2: `scripts/sql/test_veri_sayim.sql` yazıldı (silmenin ikizi, salt-okuma
  sayım). Kapsam mantığı `test_veri_temizle` ile birebir → önizleme gerçek silmeyle uyuşur.
  Döner: yayın, izleme, puan_kaydi, oneri, challenge, gonderim, push, bildirim,
  siparis_silinecek, siparis_korunacak.
- **01.08.2026** — Aşama 3: `app/admin/api/veri-sil/route.ts` yazıldı. Tek POST, `islem`
  ('sayim'/'sil') + `mod` ile iki RPC'yi çağırır; `adminGirisKontrol` + UUID doğrulama;
  RPC'nin `durum` alanı hata (firma/talep bulunamadı) için kontrol edilir.
- **01.08.2026** — Aşama 5: Firma kartı. `FirmaVeriSilModal.tsx` (TopluTekilSilModal'in firma-modu
  ikizi: tip seçimi yok, `mod='firma'`, firma_id bağlamdan; Önizle → firma adını yaz onayı → Sil) +
  `FirmaSidebar`'a mevcut "Sil"in yanına ayrı **"Veri Sil"** butonu (`onVeriSil` prop) + page.tsx
  bağlama (`veriSilFirma` state). Firmayı tümüyle silen "Sil" dokunulmadı. tsc 0 hata, denetim ✓,
  mimari lint temiz. Uçtan uca doğrulama admin girişi gerektirir (Aşama 6).
- **01.08.2026** — Aşama 4: Navbar modalı. `TopluTekilSilModal.tsx` (tip seç → tekil'de talep_id
  → Önizle/sayım → Tüm Veriler için "TÜM VERİLER" onay yazımı → Sil) + AdminUstBar'a
  "Toplu/Tekil Sil" butonu + page.tsx bağlama. tsc 0 hata, mimari lint temiz. Görsel/uçtan uca
  doğrulama admin girişi gerektirir (Aşama 6).
