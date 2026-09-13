import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function oku(goreceliYol: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), goreceliYol), "utf8");
}

// ============================================================================
// KOMUT 1: HAZIR PODCAST V2/V4 KALICI TASLAK ALTYAPISI HEDEF TESTLERİ
// ============================================================================

test("Hedef 1: Çift taslak oluşturma tek taslak döndürür — Idempotent oturum anahtarı", () => {
  const sql = oku("scripts/sql/ogrenme_araclari_faz3_podcast_taslak.sql");

  // 1a. Şema ve Unique Index sözleşmesi
  assert.match(sql, /taslak_mi boolean NOT NULL DEFAULT false/);
  assert.match(sql, /taslak_oturum_anahtari uuid/);
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS uq_talepler_uretici_taslak_oturumu/);
  assert.match(sql, /ON public\.talepler \(uretici_id, taslak_oturum_anahtari\)/);

  // 1b. RPC içinde mevcut taslağın bulunup tekil dönmesi (yalnız taslak_mi = true olanlar döner)
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.podcast_taslak_atomik_olustur/);
  assert.match(sql, /WHERE t\.uretici_id = p_uretici_id\s+AND t\.taslak_oturum_anahtari = p_oturum_anahtari\s+AND t\.taslak_mi = true/);
  assert.match(sql, /'mevcut', true/);
  assert.match(sql, /'taslak_mi', true/);

  // 1c. API rotası: oturum_anahtari ile tekrar güvenliği
  const api = oku("app/(panel)/talepler/api/taslak/route.ts");
  assert.match(api, /oturum_anahtari/);
  assert.match(api, /uuidGecerliMi\(oturum_anahtari\)/);
  assert.match(api, /podcast_taslak_atomik_olustur/);
  assert.match(api, /mevcut:\s*Boolean\(sonuc\.mevcut\)/);
});

test("Hedef 2: Taslak aktif operasyon listesine girmez — Listelerden filtrelenir", () => {
  // 2a. Üretici rol talep listesi (app/(panel)/talepler/api/uretici-rol/route.ts)
  const ureticiRolRoute = oku("app/(panel)/talepler/api/uretici-rol/route.ts");
  assert.match(
    ureticiRolRoute,
    /\.eq\("taslak_mi",\s*false\)/,
    "Üretici rol listesi taslak_mi: false filtresi uygulamalıdır"
  );

  // 2b. Talep detay rotası (app/(panel)/talepler/api/detay/route.ts)
  const detayRoute = oku("app/(panel)/talepler/api/detay/route.ts");
  assert.match(
    detayRoute,
    /\.eq\("taslak_mi",\s*false\)/,
    "Talep detay ucu taslak talepleri operasyonel veri olarak açmamalıdır"
  );
});

test("Hedef 3: Taslak üretim/yayın zinciri başlatmaz — Görev oluşturulmaz, yayınlanamaz", () => {
  const sql = oku("scripts/sql/ogrenme_araclari_faz3_podcast_taslak.sql");

  // 3a. Taslak oluşturma RPC'sinde uretim_talep_ilk_gorevini_ac ASLA çağrılmaz
  const taslakOlusturFonksiyonu = sql.slice(
    sql.indexOf("podcast_taslak_atomik_olustur"),
    sql.indexOf("podcast_taslak_atomik_kesinlestir")
  );
  assert.doesNotMatch(
    taslakOlusturFonksiyonu,
    /uretim_talep_ilk_gorevini_ac/,
    "podcast_taslak_atomik_olustur üretim görevi açamaz"
  );

  // 3b. Yayınlama kapısında taslak kontrolü
  const yayinlarRoute = oku("app/(panel)/yayin-yonetimi/api/yayinlar/route.ts");
  assert.match(yayinlarRoute, /talepTaslakKontrol\?\.taslak_mi/);
  assert.match(yayinlarRoute, /Taslak talep yayına alınamaz/);
});

test("Hedef 4: Başka kullanıcı veya firma taslağa erişemez — Çok kiracılı izolasyon", () => {
  // 4a. Taslak API rotasında firma ve sahiplik doğrulaması
  const taslakApi = oku("app/(panel)/talepler/api/taslak/route.ts");
  assert.match(taslakApi, /urunFirmayaAitMi/);
  assert.match(taslakApi, /teknikFirmayaAitMi/);
  assert.match(taslakApi, /kullaniciKaydi\.firma_id/);

  // 4b. Kesinleştirme RPC'sinde yetki kontrolü
  const sql = oku("scripts/sql/ogrenme_araclari_faz3_podcast_taslak.sql");
  assert.match(sql, /IF v_uretici_id IS DISTINCT FROM p_uretici_id THEN/);
  assert.match(sql, /Bu taslak talebi kesinleştirme yetkiniz yok/);
});

test("Hedef 5: V1/V3 bu API’yi kullanamaz — Yalnız hazır podcast V2/V4 desteklenir", () => {
  // 5a. API rotasında V1/V3 engeli
  const taslakApi = oku("app/(panel)/talepler/api/taslak/route.ts");
  assert.match(taslakApi, /if \(ogrenme_araci_turu !== "podcast"\)/);
  assert.match(taslakApi, /if \(hazir_video !== true\)/);
  assert.match(taslakApi, /V1 ve V3 bu API'yi kullanamaz/);

  // 5b. SQL RPC'de V1/V3 engeli
  const sql = oku("scripts/sql/ogrenme_araclari_faz3_podcast_taslak.sql");
  assert.match(sql, /IF v_ogrenme_araci_turu IS DISTINCT FROM 'podcast' THEN/);
  assert.match(sql, /IF NOT v_hazir_video THEN/);
  assert.match(sql, /V1\/V3 kapsam dışıdır/);
});

test("Hedef 6: Taslak kesinleştirme işlemi atomik ve tekrar güvenlidir", () => {
  const sql = oku("scripts/sql/ogrenme_araclari_faz3_podcast_taslak.sql");

  // 6a. RPC tanımı ve kilit
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.podcast_taslak_atomik_kesinlestir/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /taslak_mi = false/);
  assert.match(sql, /uretim_talep_ilk_gorevini_ac/);

  // 6b. İdempotent kesinleşme kontrolü: aynı işlem anahtarı ile tekrar çağrıda mevcut görevi döner
  assert.match(sql, /IF v_mevcut_anahtar = p_islem_anahtari THEN/);
  assert.match(sql, /'kesinlesmis', true/);

  // 6c. Kesinleştirmede taslak_oturum_anahtari NULL yapılır
  assert.match(sql, /taslak_oturum_anahtari = NULL/);

  // 6d. Ana talepler API'sinde taslak_talep_id entegrasyonu
  const taleplerApi = oku("app/(panel)/talepler/api/route.ts");
  assert.match(taleplerApi, /taslak_talep_id/);
  assert.match(taleplerApi, /podcast_taslak_atomik_kesinlestir/);
});

test("Hedef 7: Kesinleştirilmiş talep aynı oturum anahtarıyla yeniden taslak olarak döndürülmez", () => {
  const sql = oku("scripts/sql/ogrenme_araclari_faz3_podcast_taslak.sql");

  // 7a. SQL sözleşmesi: taslak sorgusu t.taslak_mi = true şartı koşar, kesinleştirme taslak_oturum_anahtari'nı sıfırlar
  assert.match(sql, /AND t\.taslak_mi = true/);
  assert.match(sql, /taslak_oturum_anahtari = NULL/);

  // 7b. Davranışsal Durum Simülasyonu
  interface MockTalep {
    talep_id: string;
    uretici_id: string;
    taslak_mi: boolean;
    taslak_oturum_anahtari: string | null;
  }

  class MockTaslakMotoru {
    talepler: MockTalep[] = [];

    taslakOlustur(uretici_id: string, oturum_anahtari: string): { talep_id: string; mevcut: boolean } {
      const mevcut = this.talepler.find(
        (t) =>
          t.uretici_id === uretici_id &&
          t.taslak_oturum_anahtari === oturum_anahtari &&
          t.taslak_mi === true
      );

      if (mevcut) {
        return { talep_id: mevcut.talep_id, mevcut: true };
      }

      const yeni: MockTalep = {
        talep_id: `talep-${Math.random().toString(36).slice(2, 8)}`,
        uretici_id,
        taslak_mi: true,
        taslak_oturum_anahtari: oturum_anahtari,
      };
      this.talepler.push(yeni);
      return { talep_id: yeni.talep_id, mevcut: false };
    }

    kesinlestir(talep_id: string): boolean {
      const talep = this.talepler.find((t) => t.talep_id === talep_id);
      if (!talep || !talep.taslak_mi) return false;
      talep.taslak_mi = false;
      talep.taslak_oturum_anahtari = null;
      return true;
    }
  }

  const motor = new MockTaslakMotoru();
  const oturumAnahtari = "550e8400-e29b-41d4-a716-446655440000";

  // 1. Taslak oluşturma
  const ilk = motor.taslakOlustur("uretici-1", oturumAnahtari);
  assert.equal(ilk.mevcut, false);

  // 2. Henüz kesinleşmemişken tekrar çağrı: aynı taslağı döner
  const tekrar = motor.taslakOlustur("uretici-1", oturumAnahtari);
  assert.equal(tekrar.mevcut, true);
  assert.equal(tekrar.talep_id, ilk.talep_id);

  // 3. Taslak kesinleştirilir (Gönderiniz tamamlandı)
  const kesinlesti = motor.kesinlestir(ilk.talep_id);
  assert.equal(kesinlesti, true);

  // 4. Kesinleşmiş talebin bulunduğu oturum anahtarı ile tekrar çağrı yapılır:
  // KESİNLİKLE eski kesinleşmiş talep dönmemeli!
  const sonrakiCagri = motor.taslakOlustur("uretici-1", oturumAnahtari);
  assert.equal(sonrakiCagri.mevcut, false, "Kesinleştirilmiş talep taslak olarak dönmemelidir");
  assert.notEqual(
    sonrakiCagri.talep_id,
    ilk.talep_id,
    "Kesinleşmiş talep ID'si yerine yeni taslak üretilmelidir"
  );
});
