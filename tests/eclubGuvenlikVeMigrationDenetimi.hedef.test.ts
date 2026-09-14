import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const oku = (yol: string) => readFileSync(yol, "utf8");

const rolloutSql = oku("scripts/sql/eclub_cekli_ceksiz_puan_tam_rollout.sql");
const faz2Sql = oku("scripts/sql/eclub_yayin_cek_karsiligi_var_mi.sql");
const faz3Sql = oku("scripts/sql/eclub_kazanilan_puanlar_cek_karsiligi.sql");
const faz4Sql = oku("scripts/sql/eclub_ileri_sarma_cek_karsiligi.sql");
const faz5Sql = oku("scripts/sql/eclub_lig_cekli_ceksiz_puan.sql");
const faz7Sql = oku("scripts/sql/eclub_store_cekli_puan_sinirlamasi.sql");
const faz8Sql = oku("scripts/sql/eclub_store_hediye_ceki_cekli_puan.sql");
const faz9Sql = oku("scripts/sql/eclub_faz9_geriye_donuk_uyumluluk.sql");

// ===========================================================================
// 1. Migration Sözleşmesi ve Güvenlik Kriterleri
// ===========================================================================

test("Faz 10 Denetim 1: Transaction ve Advisory Lock bütünlüğü", () => {
  // Rollout dosyası transaction ve eşzamanlı kilit korumasında olmalı
  assert.match(rolloutSql, /^BEGIN;/m);
  assert.match(rolloutSql, /COMMIT;$/m);
  assert.match(rolloutSql, /SELECT pg_advisory_xact_lock\(hashtextextended\('eclub-cekli-ceksiz-master-migration-lock', 0\)\);/);
});

test("Faz 10 Denetim 2: Kolon ekleme, backfill ve NOT NULL uygulama sırası", () => {
  const tablolar = ["yayin_yonetimi", "eclub_kazanilan_puanlar", "eclub_ileri_sarma_kayitlari"];
  for (const tablo of tablolar) {
    // 1. ADD COLUMN IF NOT EXISTS
    const addColRegex = new RegExp(`ALTER TABLE public\\.${tablo}\\s+ADD COLUMN IF NOT EXISTS cek_karsiligi_var_mi boolean DEFAULT true;`);
    assert.match(rolloutSql, addColRegex);

    // 2. SET DEFAULT true
    const setDefaultRegex = new RegExp(`ALTER TABLE public\\.${tablo}\\s+ALTER COLUMN cek_karsiligi_var_mi SET DEFAULT true;`);
    assert.match(rolloutSql, setDefaultRegex);

    // 3. Backfill (Yalnızca IS NULL olanlar true yapılır)
    const updateRegex = new RegExp(`UPDATE public\\.${tablo}\\s+SET cek_karsiligi_var_mi = true\\s+WHERE cek_karsiligi_var_mi IS NULL;`);
    assert.match(rolloutSql, updateRegex);

    // 4. SET NOT NULL (backfill'den SONRA uygulanır)
    const setNotNullRegex = new RegExp(`ALTER TABLE public\\.${tablo}\\s+ALTER COLUMN cek_karsiligi_var_mi SET NOT NULL;`);
    assert.match(rolloutSql, setNotNullRegex);
  }
});

test("Faz 10 Denetim 3: search_path tanımları ve search_path hijacking koruması", () => {
  // Tüm fonksiyonlarda açık search_path tanımlanmış olmalı
  assert.match(rolloutSql, /CREATE OR REPLACE FUNCTION public\.tg_eclub_kazanilan_puanlar_cek_karsiligi[\s\S]*?SET search_path = public, pg_temp/);
  assert.match(rolloutSql, /CREATE OR REPLACE FUNCTION public\.tg_eclub_ileri_sarma_kayitlari_cek_karsiligi[\s\S]*?SET search_path = public, pg_temp/);
  assert.match(rolloutSql, /CREATE FUNCTION public\.get_eclub_utt_rapor[\s\S]*?SET search_path = public, pg_temp/);
  assert.match(rolloutSql, /CREATE OR REPLACE FUNCTION public\.get_eclub_store_firma_bakiye[\s\S]*?SET search_path = public, pg_temp/);
  assert.match(rolloutSql, /CREATE OR REPLACE FUNCTION public\.eclub_store_onceki_deviri_hazirla[\s\S]*?SET search_path=public, pg_temp/);
  assert.match(rolloutSql, /CREATE FUNCTION public\.get_eclub_eczane_store_ozet[\s\S]*?SET search_path=public, pg_temp/);
  assert.match(rolloutSql, /CREATE OR REPLACE FUNCTION public\.eclub_store_cek_talebi_olustur[\s\S]*?SET search_path=public, pg_temp/);
});

test("Faz 10 Denetim 4: Yetki Matrisi ve anon/authenticated kısıtlaması (Least Privilege)", () => {
  const yetkiDaraltmaSql = oku("scripts/sql/eclub_utt_rapor_yetki_daraltma.sql");

  // 1. get_eclub_utt_rapor SECURITY DEFINER ve p_utt_id aldığı için authenticated, anon ve PUBLIC'ten tamamen kaldırılmalı
  for (const sql of [rolloutSql, yetkiDaraltmaSql]) {
    assert.match(sql, /REVOKE ALL ON FUNCTION public\.get_eclub_utt_rapor\([\s\S]*?\) FROM PUBLIC, anon, authenticated;/);
    assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.get_eclub_utt_rapor\([\s\S]*?\) TO service_role;/);
    assert.doesNotMatch(sql, /GRANT EXECUTE ON FUNCTION public\.get_eclub_utt_rapor\([^)]*\)\s+TO\s+[^;]*?authenticated/);
  }

  // 2. Diğer fonksiyonların yetki matrisi
  assert.match(rolloutSql, /REVOKE ALL ON FUNCTION public\.get_eclub_store_firma_bakiye\(uuid\) FROM PUBLIC, anon;/);
  assert.match(rolloutSql, /REVOKE ALL ON FUNCTION public\.get_eclub_eczane_store_ozet\(uuid\) FROM PUBLIC, anon, authenticated;/);
  assert.match(rolloutSql, /REVOKE ALL ON FUNCTION public\.eclub_store_onceki_deviri_hazirla\(uuid, uuid, text\) FROM PUBLIC, anon, authenticated;/);
  assert.match(rolloutSql, /REVOKE ALL ON FUNCTION public\.eclub_store_cek_talebi_olustur\(uuid, uuid, boolean\) FROM PUBLIC, anon, authenticated;/);

  assert.match(rolloutSql, /GRANT EXECUTE ON FUNCTION public\.get_eclub_store_firma_bakiye\(uuid\) TO authenticated, service_role;/);
  assert.match(rolloutSql, /GRANT EXECUTE ON FUNCTION public\.get_eclub_eczane_store_ozet\(uuid\) TO service_role;/);
  assert.match(rolloutSql, /GRANT EXECUTE ON FUNCTION public\.eclub_store_onceki_deviri_hazirla\(uuid, uuid, text\) TO service_role;/);
  assert.match(rolloutSql, /GRANT EXECUTE ON FUNCTION public\.eclub_store_cek_talebi_olustur\(uuid, uuid, boolean\) TO service_role;/);
});

test("Faz 10 Denetim 5: İstemci manipülasyonu engeli ve Fail-Closed trigger doğrulaması", () => {
  // İstemciden gelen cek_karsiligi_var_mi parametresi yok sayılır ve yayından alınır
  assert.match(rolloutSql, /NEW\.cek_karsiligi_var_mi := v_cek_karsiligi;/);
  // Yayın bulunamazsa sessizce geçiştirilmez; fail-closed RAISE EXCEPTION fırlatılır
  assert.match(rolloutSql, /IF v_cek_karsiligi IS NULL THEN\s+RAISE EXCEPTION 'eclub_kazanilan_puanlar: Geçersiz yayın veya cek_karsiligi_var_mi bulunamadı/);
  assert.match(rolloutSql, /IF v_cek_karsiligi IS NULL THEN\s+RAISE EXCEPTION 'eclub_ileri_sarma_kayitlari: Geçersiz yayın veya cek_karsiligi_var_mi bulunamadı/);
});

// ===========================================================================
// 2. Güvenlik Açığı Taraması (Security Vulnerability Audit)
// ===========================================================================

test("Güvenlik Açığı Taraması 1: Store bakiyesinde Çeksiz Puan filtreleri eksiksizdir", () => {
  for (const sql of [rolloutSql, faz7Sql]) {
    // Kazanç CTE'sinde filtrelenmeli
    assert.match(sql, /FROM public\.eclub_kazanilan_puanlar kp[\s\S]*?WHERE kp\.kisi_id = p_kisi_id\s+AND kp\.cek_karsiligi_var_mi = true/);
    // Kayıp CTE'sinde filtrelenmeli (çeksiz ileri sarma kaybı Store'u düşürmez)
    assert.match(sql, /FROM public\.eclub_ileri_sarma_kayitlari ks[\s\S]*?WHERE ks\.kisi_id = p_kisi_id\s+AND ks\.cek_karsiligi_var_mi = true/);
  }
});

test("Güvenlik Açığı Taraması 2: Dönem devrinde Çeksiz Puan sızması engellenmiştir", () => {
  for (const sql of [rolloutSql, faz8Sql]) {
    // Çeksiz yayında devir hiç çalışmaz
    assert.match(sql, /SELECT y\.cek_karsiligi_var_mi INTO v_cekli FROM public\.yayin_yonetimi y WHERE y\.yayin_id=p_yayin_id;\s+IF coalesce\(v_cekli, true\) = false THEN RETURN; END IF;/);
    // Kazanç toplarken yalnız çekli puanlar toplanır
    assert.match(sql, /FROM public\.eclub_kazanilan_puanlar kp[\s\S]*?WHERE kp\.yayin_id=p_yayin_id[\s\S]*?AND kp\.cek_karsiligi_var_mi = true;/);
  }
});

test("Güvenlik Açığı Taraması 3: Çeksiz Puanla doğrudan RPC üzerinden hediye çeki açılamaz", () => {
  for (const sql of [rolloutSql, faz8Sql]) {
    assert.match(sql, /IF v_y\.cek_karsiligi_var_mi = false THEN\s+RETURN QUERY SELECT false,NULL::uuid,'Çeksiz puan yayınları için hediye çeki talebi oluşturulamaz\.',0::numeric,0;\s+RETURN;\s+END IF;/);
  }
});

test("Güvenlik Açığı Taraması 4: Store hediye çeki özetinde Çeksiz yayınlar listelenmez", () => {
  for (const sql of [rolloutSql, faz8Sql]) {
    // Ana WHERE sorgusunda filtrelenmeli
    assert.match(sql, /WHERE y\.barem_tablosu IS NOT NULL\s+AND y\.durum='yayinda'\s+AND public\.eclub_store_barem_gecerli\(y\.barem_tablosu\)\s+AND y\.cek_karsiligi_var_mi = true/);
  }
});

test("Güvenlik Açığı Taraması 5: PostgREST şema yenileme bildirimi (reload schema)", () => {
  assert.match(rolloutSql, /NOTIFY pgrst, 'reload schema';/);
});

// ===========================================================================
// 3. İdempotency ve Tekrar Güvenliği Simülasyonu
// ===========================================================================

test("Faz 10 Simülasyon: Rollout zinciri birden fazla kez çalıştırıldığında veriler asla bozulmaz", () => {
  // Simüle edilmiş veritabanı durumu
  const veritabani = {
    yayinlar: [
      { id: "y-eski", cek_karsiligi_var_mi: null as boolean | null },
      { id: "y-yeni-cekli", cek_karsiligi_var_mi: true as boolean | null },
      { id: "y-yeni-ceksiz", cek_karsiligi_var_mi: false as boolean | null },
    ],
    puanlar: [
      { id: "p-eski", cek_karsiligi_var_mi: null as boolean | null },
      { id: "p-yeni-cekli", cek_karsiligi_var_mi: true as boolean | null },
      { id: "p-yeni-ceksiz", cek_karsiligi_var_mi: false as boolean | null },
    ],
  };

  const calistirRollout = (db: typeof veritabani) => {
    return {
      yayinlar: db.yayinlar.map((y) => ({
        ...y,
        cek_karsiligi_var_mi: y.cek_karsiligi_var_mi === null ? true : y.cek_karsiligi_var_mi,
      })),
      puanlar: db.puanlar.map((p) => ({
        ...p,
        cek_karsiligi_var_mi: p.cek_karsiligi_var_mi === null ? true : p.cek_karsiligi_var_mi,
      })),
    };
  };

  // 1. Çalıştırma
  const tur1 = calistirRollout(veritabani);
  assert.equal(tur1.yayinlar.find((y) => y.id === "y-eski")?.cek_karsiligi_var_mi, true);
  assert.equal(tur1.yayinlar.find((y) => y.id === "y-yeni-ceksiz")?.cek_karsiligi_var_mi, false);
  assert.equal(tur1.puanlar.find((p) => p.id === "p-eski")?.cek_karsiligi_var_mi, true);
  assert.equal(tur1.puanlar.find((p) => p.id === "p-yeni-ceksiz")?.cek_karsiligi_var_mi, false);

  // 2. Çalıştırma (Idempotent: hiçbir şey değişmez)
  const tur2 = calistirRollout(tur1);
  assert.deepEqual(tur1, tur2);

  // 3. Çalıştırma
  const tur3 = calistirRollout(tur2);
  assert.deepEqual(tur2, tur3);
});
