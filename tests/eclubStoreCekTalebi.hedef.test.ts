import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { baremBul, cekTutariHesapla, type BaremSatiri } from "@/lib/eclub/store/eclubStoreTipler";

const baremler: BaremSatiri[] = [
  { min_puan: 60, max_puan: 159, adet: 5, mal_fazlasi: 1 },
  { min_puan: 160, max_puan: 525, adet: 18, mal_fazlasi: 6 },
];

test("dinamik barem ve puan/TL karşılığı sabit eşik kullanmaz", () => {
  assert.equal(baremBul(59, baremler), null);
  assert.equal(baremBul(400, baremler)?.adet, 18);
  const sonuc = cekTutariHesapla({ puan: 600, satis_sarti_tipi: "serbest_siparis", siparis_verildi: true, katlama_orani: 10, karsilik_puan: 3, karsilik_tl: 2, baremler });
  assert.equal(sonuc.kullanilan_puan, 525);
  assert.equal(sonuc.devreden_puan, 75);
  assert.equal(sonuc.cek_tutari_tl, 385);
});

test("SQL dönem, yarış, yetki, devir ve teslim kapılarını birlikte uygular", async () => {
  const sql = await readFile(new URL("../scripts/sql/eclub_store_yeni_donem_satis_sartli_cek.sql", import.meta.url), "utf8");
  assert.match(sql, /Europe\/Istanbul/);
  assert.ok(sql.includes("'^[0-9]{4}-P[1-6]$'"));
  assert.match(sql, /created_at>=v_d\.donem_baslangic AND kp\.created_at<v_d\.donem_bitis_haric/);
  assert.match(sql, /eclub_cek_talep_tekil_donem_idx/);
  assert.match(sql, /pg_advisory_xact_lock\(hashtextextended\('eclub-talep:/);
  assert.match(sql, /ef\.firma_id=v_firma/);
  assert.match(sql, /t\.utt_id IS DISTINCT FROM p_utt_id/);
  assert.match(sql, /t\.bm_id IS DISTINCT FROM p_bm_id/);
  assert.match(sql, /v_t\.durum<>'onaylandi'/);
  assert.match(sql, /UPDATE public\.eclub_store_puan_devirleri SET kullanildi_mi=false/);
  assert.match(sql, /REVOKE ALL ON FUNCTION[\s\S]+FROM PUBLIC,anon,authenticated/);
});
