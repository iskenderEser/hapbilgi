-- scripts/sql/tekil_talep_sil.sql
--
-- Talep/Yayın Silme — Adım 2, RPC 2/3 (24.07.2026).
-- Tek bir talebi kurala göre atomik siler:
--   • bekleyen (yayını doğmamış)      → yalnız üretim zinciri silinir
--   • yayın var + puan YOK            → tüketici kayıtları + yayın + zincir silinir
--   • yayın var + puan VAR            → HİÇBİR ŞEY silinmez, 'durdurulabilir' döner
--                                       (UI durdurmayı önerir; puanlı yayın korunur)
--
-- Atomiklik: fonksiyon tek transaction'da koşar. Puan kontrolü SİLMEDEN ÖNCE
-- yapılır; puanlıysa erken döner, hiç yazma olmaz (rollback'e gerek kalmaz).
--
-- Silme sırası çocuk→ebeveyn (Adım 0 topolojik keşfi; test-verileri-sil ile aynı
-- kanıtlı sıra, talep/yayın kapsamına daraltılmış). Kapsam yayin_id kolonundan
-- (FK'siz olanlar dahil: ileri_sarma_kayitlari, eclub_dogru_cevap_kayitlari,
-- eclub_utt_puanlari), yayin_id taşımayanlar izleme/durum üzerinden çözülür.
-- Bildirimler FK'siz (polymorphic kayit_turu+kayit_id) → hedefli silinir.
--
-- Girdi: p_talep_id (talepler.talep_id). Görünen ID→talep_id çözümü backend'de.
-- Yetki: fonksiyon içinde YOK; route'ta adminGirisKontrol + service_role çağrısı.
--
-- KOŞUM: Supabase SQL editöründe bir kez. Yeniden koşum güvenli (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION public.tekil_talep_sil(p_talep_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fonk$
DECLARE
  v_yayin_idler        uuid[];
  v_senaryo_idler      uuid[];
  v_video_idler        uuid[];
  v_soru_seti_idler    uuid[];
  v_oneri_idler        uuid[];
  v_eclub_oneri_idler  uuid[];
  v_challenge_idler    uuid[];
  v_puanli             uuid[] := ARRAY[]::uuid[];
  v_y                  uuid;
BEGIN
  -- 0) Talep var mı?
  IF NOT EXISTS (SELECT 1 FROM talepler WHERE talep_id = p_talep_id) THEN
    RETURN jsonb_build_object('durum', 'bulunamadi');
  END IF;

  -- 1) Kapsam id'lerini topla (silmeden ÖNCE — sonra zincir bozulur).
  v_yayin_idler := ARRAY(
    SELECT y.yayin_id
    FROM yayin_yonetimi y
    JOIN soru_seti_durumu ssd ON ssd.soru_seti_durum_id = y.soru_seti_durum_id
    JOIN soru_setleri     ss  ON ss.soru_seti_id        = ssd.soru_seti_id
    WHERE ss.talep_id = p_talep_id
  );
  v_senaryo_idler   := ARRAY(SELECT senaryo_id  FROM senaryolar   WHERE talep_id = p_talep_id);
  v_video_idler     := ARRAY(SELECT video_id    FROM videolar     WHERE talep_id = p_talep_id);
  v_soru_seti_idler := ARRAY(SELECT soru_seti_id FROM soru_setleri WHERE talep_id = p_talep_id);
  v_oneri_idler       := ARRAY(SELECT oneri_id     FROM oneri_kayitlari       WHERE yayin_id = ANY(v_yayin_idler));
  v_eclub_oneri_idler := ARRAY(SELECT oneri_id     FROM eclub_oneri_kayitlari WHERE yayin_id = ANY(v_yayin_idler));
  v_challenge_idler   := ARRAY(SELECT challenge_id FROM challenge_kayitlari    WHERE yayin_id = ANY(v_yayin_idler));

  -- 2) Yayın varsa puan kontrolü — herhangi biri puanlıysa DUR, silme.
  IF array_length(v_yayin_idler, 1) > 0 THEN
    FOREACH v_y IN ARRAY v_yayin_idler LOOP
      IF public.yayin_puan_var_mi(v_y) THEN
        v_puanli := array_append(v_puanli, v_y);
      END IF;
    END LOOP;
    IF array_length(v_puanli, 1) > 0 THEN
      RETURN jsonb_build_object(
        'durum', 'durdurulabilir',
        'puanli_yayinlar', to_jsonb(v_puanli)
      );
    END IF;
  END IF;

  -- ─── Buradan sonrası siler. Yayın yoksa (bekleyen) yayın-bağlı DELETE'ler
  --     boş dizi filtresiyle no-op olur; yalnız üretim zinciri silinir. ───

  -- 3a) Bildirimler (polymorphic, hedefli) — FK yok, cascade yakalamaz.
  DELETE FROM bildirimler WHERE
       (kayit_turu = 'talep'     AND kayit_id = p_talep_id)
    OR (kayit_turu = 'senaryo'   AND kayit_id = ANY(v_senaryo_idler))
    OR (kayit_turu = 'video'     AND kayit_id = ANY(v_video_idler))
    OR (kayit_turu = 'soru_seti' AND kayit_id = ANY(v_soru_seti_idler))
    OR (kayit_turu = 'yayin'     AND kayit_id = ANY(v_yayin_idler))
    OR (kayit_turu = 'oneri'     AND kayit_id = ANY(v_oneri_idler))
    OR (kayit_turu = 'challenge' AND kayit_id = ANY(v_challenge_idler));
  DELETE FROM eclub_bildirimler WHERE kayit_turu = 'oneri' AND kayit_id = ANY(v_eclub_oneri_idler);

  -- 3b) En derin çocuklar — puan/kayıp defterleri (yayin_id ∈ Y).
  DELETE FROM cc_ileri_sarma_kayitlari     WHERE yayin_id = ANY(v_yayin_idler);
  DELETE FROM cc_kazanilan_puanlar         WHERE yayin_id = ANY(v_yayin_idler);
  DELETE FROM cc_yanlis_cevap_kayitlari    WHERE yayin_id = ANY(v_yayin_idler);
  DELETE FROM challenge_kayip_kayitlari    WHERE yayin_id = ANY(v_yayin_idler);
  DELETE FROM ileri_sarma_kayitlari        WHERE yayin_id = ANY(v_yayin_idler);  -- FK'siz kolon
  DELETE FROM kazanilan_puanlar            WHERE yayin_id = ANY(v_yayin_idler);
  DELETE FROM oneri_kayip_kayitlari        WHERE yayin_id = ANY(v_yayin_idler);
  DELETE FROM yanlis_cevap_kayitlari       WHERE yayin_id = ANY(v_yayin_idler);
  DELETE FROM video_begeniler              WHERE yayin_id = ANY(v_yayin_idler);
  DELETE FROM video_favoriler              WHERE yayin_id = ANY(v_yayin_idler);
  DELETE FROM eclub_kazanilan_puanlar      WHERE yayin_id = ANY(v_yayin_idler);
  DELETE FROM eclub_yanlis_cevap_kayitlari WHERE yayin_id = ANY(v_yayin_idler);
  DELETE FROM eclub_dogru_cevap_kayitlari  WHERE yayin_id = ANY(v_yayin_idler);  -- FK'siz kolon
  DELETE FROM eclub_utt_puanlari           WHERE yayin_id = ANY(v_yayin_idler);  -- FK'siz kolon
  DELETE FROM eclub_oneri_kayip_kayitlari  WHERE yayin_id = ANY(v_yayin_idler);
  -- yayin_id taşımayanlar → izleme/durum üzerinden
  DELETE FROM soru_cevaplari
    WHERE izleme_id IN (SELECT izleme_id FROM izleme_kayitlari WHERE yayin_id = ANY(v_yayin_idler));
  DELETE FROM eczanem_puan_kayitlari
    WHERE izleme_id IN (SELECT izleme_id FROM eczanem_izleme_kayitlari WHERE yayin_id = ANY(v_yayin_idler));
  DELETE FROM video_puanlari
    WHERE video_durum_id IN (SELECT video_durum_id FROM video_durumu WHERE video_id = ANY(v_video_idler));
  DELETE FROM soru_seti_puanlari
    WHERE soru_seti_durum_id IN (SELECT soru_seti_durum_id FROM soru_seti_durumu WHERE soru_seti_id = ANY(v_soru_seti_idler));

  -- 3c) Orta katman — izleme'ler (çocuklarından sonra), sonra gönderim'ler.
  DELETE FROM izleme_kayitlari         WHERE yayin_id = ANY(v_yayin_idler);
  DELETE FROM cc_izleme_kayitlari      WHERE yayin_id = ANY(v_yayin_idler);
  DELETE FROM eclub_izleme_kayitlari   WHERE yayin_id = ANY(v_yayin_idler);
  DELETE FROM eczanem_izleme_kayitlari WHERE yayin_id = ANY(v_yayin_idler);  -- gonderimler'den önce
  DELETE FROM eczanem_gonderimler          WHERE yayin_id = ANY(v_yayin_idler);
  DELETE FROM eczanem_eczane_gonderimleri  WHERE yayin_id = ANY(v_yayin_idler);

  -- 3d) izleme/kayıp ebeveynleri — challenge / öneri / tekrar.
  DELETE FROM challenge_kayitlari   WHERE yayin_id = ANY(v_yayin_idler);
  DELETE FROM oneri_kayitlari       WHERE yayin_id = ANY(v_yayin_idler);
  DELETE FROM eclub_oneri_kayitlari WHERE yayin_id = ANY(v_yayin_idler);
  DELETE FROM yayin_tekrar_kayitlari WHERE yayin_id = ANY(v_yayin_idler);

  -- 3e) Yayın.
  DELETE FROM yayin_yonetimi WHERE yayin_id = ANY(v_yayin_idler);

  -- 3f) Üretim zinciri (çocuk→ebeveyn).
  DELETE FROM soru_seti_durumu WHERE soru_seti_id = ANY(v_soru_seti_idler);
  DELETE FROM soru_setleri     WHERE talep_id = p_talep_id;
  DELETE FROM video_durumu     WHERE video_id = ANY(v_video_idler);
  DELETE FROM videolar         WHERE talep_id = p_talep_id;
  DELETE FROM senaryo_durumu   WHERE senaryo_id = ANY(v_senaryo_idler);
  DELETE FROM senaryolar       WHERE talep_id = p_talep_id;
  DELETE FROM talepler         WHERE talep_id = p_talep_id;

  RETURN jsonb_build_object(
    'durum', 'silindi',
    'tur', CASE WHEN array_length(v_yayin_idler, 1) > 0 THEN 'puansiz_yayin' ELSE 'bekleyen' END,
    'yayin_idler', to_jsonb(v_yayin_idler)
  );
END;
$fonk$;

GRANT EXECUTE ON FUNCTION public.tekil_talep_sil(uuid) TO service_role;

-- Doğrulama (isteğe bağlı, GERİ ALINAMAZ — önce test talebiyle):
-- SELECT public.tekil_talep_sil('<talep_id>');
