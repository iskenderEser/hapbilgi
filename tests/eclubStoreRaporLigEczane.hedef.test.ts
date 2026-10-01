import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  "scripts/sql/eclub_store_rapor_lig_eczane_snapshot.sql",
  "utf8"
);
const ligApi = readFileSync("app/(panel)/eclub/ligi/api/route.ts", "utf8");
const ligExportApi = readFileSync(
  "app/(panel)/eclub/ligi/api/export/route.ts",
  "utf8"
);

function fonksiyonBloku(ad: string): string {
  const baslangic = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${ad}(`);
  assert.notEqual(baslangic, -1, `${ad} tanımı bulunamadı`);

  const bitis = sql.indexOf("$fonksiyon$;", baslangic);
  assert.notEqual(bitis, -1, `${ad} gövde sonu bulunamadı`);
  return sql.slice(baslangic, bitis + "$fonksiyon$;".length);
}

const devir = fonksiyonBloku("eclub_store_onceki_deviri_hazirla");
const ozet = fonksiyonBloku("get_eclub_eczane_store_ozet");
const talep = fonksiyonBloku("eclub_store_cek_talebi_olustur");
const rapor = fonksiyonBloku("get_eclub_utt_rapor");

test("Faz 1C transaction korumalıdır ve zorunlu eczane_id bağımlılığını doğrular", () => {
  assert.match(sql, /^BEGIN;/m);
  assert.match(sql, /COMMIT;\s*$/);
  assert.match(
    sql,
    /hashtextextended\('eclub-store-rapor-lig-eczane-snapshot-faz-1c', 0\)/
  );
  assert.match(
    sql,
    /table_name = 'eclub_kazanilan_puanlar'[\s\S]*?column_name = 'eczane_id'[\s\S]*?data_type = 'uuid'[\s\S]*?is_nullable = 'NO'/
  );
});

test("yalnız Faz 1C kapsamındaki dört kanonik okuma RPC'si tanımlanır", () => {
  const tanimlar = sql.match(/CREATE OR REPLACE FUNCTION public\./g) ?? [];
  assert.equal(tanimlar.length, 4);
  assert.doesNotMatch(sql, /FUNCTION public\.get_eclub_store_firma_bakiye/);
  assert.doesNotMatch(sql, /FUNCTION public\.eclub_izleme_tamamla/);
  assert.doesNotMatch(sql, /FUNCTION public\.eclub_cevaplari_kaydet/);
});

test("önceki dönem devri puanı doğrudan kazanıldığı eczaneden toplar", () => {
  assert.match(
    devir,
    /FROM public\.eclub_kazanilan_puanlar kp\s+WHERE kp\.eczane_id = p_eczane_id/
  );
  assert.doesNotMatch(devir, /JOIN public\.eclub_kisi_eczane/);
  assert.match(devir, /kp\.cek_karsiligi_var_mi = true/);
});

test("eczane Store özeti puanı aktif personel listesinden değil snapshot alanından toplar", () => {
  const kazanc = ozet.match(/WITH kazanc AS \([\s\S]*?\),\s+gelen AS/)?.[0];
  assert.ok(kazanc);
  assert.match(
    kazanc,
    /FROM public\.eclub_kazanilan_puanlar kp\s+WHERE kp\.eczane_id = v_eczane/
  );
  assert.doesNotMatch(kazanc, /JOIN\s+(?:public\.)?eclub_kisi_eczane/);
  assert.doesNotMatch(kazanc, /JOIN personel/);
  assert.match(kazanc, /kp\.cek_karsiligi_var_mi = true/);
});

test("Store özeti aktif dönem alanının gerçek adını kullanır", () => {
  assert.match(ozet, /v_d\.talep_acik_mi/);
  assert.doesNotMatch(ozet, /v_d\.talep_penceresi_acik_mi/);
});

test("çek talebi bakiyeyi doğrudan talep eczanesinin snapshot puanından hesaplar", () => {
  assert.match(
    talep,
    /FROM public\.eclub_kazanilan_puanlar kp\s+WHERE kp\.eczane_id = v_eczane/
  );
  assert.doesNotMatch(
    talep,
    /FROM public\.eclub_kazanilan_puanlar kp\s+JOIN public\.eclub_kisi_eczane/
  );
  assert.match(talep, /kp\.cek_karsiligi_var_mi = true/);
  assert.match(talep, /IF NOT v_d\.talep_acik_mi THEN/);
  assert.doesNotMatch(talep, /v_d\.talep_penceresi_acik_mi/);
});

test("rapor puanlarını eczane_id boyutunda toplar", () => {
  assert.match(
    rapor,
    /puan AS \([\s\S]*?SELECT\s+kp\.eczane_id,[\s\S]*?JOIN kapsam_eczaneler kapsam ON kapsam\.eczane_id = kp\.eczane_id[\s\S]*?GROUP BY kp\.eczane_id, di\.kisi_id/
  );
  assert.match(rapor, /FILTER \(WHERE kp\.puan_turu = 'izleme'\)/);
  assert.match(rapor, /FILTER \(WHERE kp\.puan_turu = 'cevaplama'\)/);
  assert.match(rapor, /AS cekli_puan/);
  assert.match(rapor, /AS ceksiz_puan/);
});

test("rapor anahtarları ve bütün metrik birleşimleri eczane_id içerir", () => {
  assert.match(
    rapor,
    /anahtar AS \([\s\S]*?SELECT eczane_id, kisi_id, icerik_anahtari, icerik_adi FROM donem_oneri[\s\S]*?FROM puan/
  );

  for (const takmaAd of ["a", "o", "i", "d", "y", "p"]) {
    assert.match(
      rapor,
      new RegExp(`(?:ON|AND) ${takmaAd}\\.eczane_id = (?:t|a)\\.eczane_id`)
    );
  }
});

test("transfer olmuş kişi hem aktif üyelik hem tarihsel eczane anahtarıyla kayıpsız tutulur", () => {
  assert.match(
    rapor,
    /temel AS \([\s\S]*?ke\.aktif_mi = true[\s\S]*?UNION[\s\S]*?FROM anahtar a/
  );
  assert.match(
    rapor,
    /coalesce\(puan_eczane\.eczane_id, uyelik\.eczane_id, o\.eczane_id\)/
  );
  assert.match(rapor, /ke\.baslangic_tarihi/);
  assert.match(rapor, /ke\.bitis_tarihi/);
  assert.match(
    rapor,
    /LEFT JOIN LATERAL \([\s\S]*?FROM public\.eclub_kisi_eczane ke[\s\S]*?\) uyelik ON true/
  );
  assert.match(rapor, /donem_oneri AS \([\s\S]*?o\.eczane_id IS NOT NULL/);
});

test("cevap metrikleri transfer sonrası UTT kapsamı dışındaki eczaneye sızmaz", () => {
  const kapsamFiltreleri = rapor.match(
    /WHERE EXISTS \(\s*SELECT 1\s*FROM kapsam_eczaneler kapsam\s*WHERE kapsam\.eczane_id\s*= coalesce\(puan_eczane\.eczane_id, uyelik\.eczane_id, di\.eczane_id\)\s*\)/g
  ) ?? [];
  assert.equal(kapsamFiltreleri.length, 2);
});

test("lig ve lig Excel API'leri aynı eczane-boyutlu RPC'yi kullanır", () => {
  for (const api of [ligApi, ligExportApi]) {
    assert.match(api, /\.rpc\("get_eclub_utt_rapor"/);
  }
});

test("dört RPC'nin search_path ve çalıştırma yetkileri korunur", () => {
  for (const blok of [devir, ozet, talep, rapor]) {
    assert.match(blok, /SET search_path = public, pg_temp/);
  }

  for (const imza of [
    "eclub_store_onceki_deviri_hazirla\\(uuid, uuid, text\\)",
    "get_eclub_eczane_store_ozet\\(uuid\\)",
    "eclub_store_cek_talebi_olustur\\(uuid, uuid, boolean\\)",
    "get_eclub_utt_rapor\\(uuid, timestamptz, timestamptz\\)",
  ]) {
    assert.match(
      sql,
      new RegExp(
        `REVOKE ALL ON FUNCTION public\\.${imza}\\s+FROM PUBLIC, anon, authenticated;`
      )
    );
    assert.match(
      sql,
      new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${imza}\\s+TO service_role;`)
    );
  }
});

test("PL/pgSQL blokları eksik END sonlandırıcısı içermez", () => {
  assert.doesNotMatch(sql, /END\n\$(?:\$|fonksiyon\$);/);
});
