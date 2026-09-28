import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  "scripts/sql/eclub_puan_yazma_fonksiyonlari_eczane.sql",
  "utf8"
);

function fonksiyonBloku(ad: string): string {
  const baslangic = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${ad}(`);
  assert.notEqual(baslangic, -1, `${ad} tanımı bulunamadı`);

  const bitis = sql.indexOf("$fonksiyon$;", baslangic);
  assert.notEqual(bitis, -1, `${ad} gövde sonu bulunamadı`);
  return sql.slice(baslangic, bitis + "$fonksiyon$;".length);
}

const izleme = fonksiyonBloku("eclub_izleme_tamamla");
const cevap = fonksiyonBloku("eclub_cevaplari_kaydet");

test("Faz 1B transaction korumalıdır ve Faz 1A bağımlılığını doğrular", () => {
  assert.match(sql, /^BEGIN;/m);
  assert.match(sql, /COMMIT;\s*$/);
  assert.match(
    sql,
    /hashtextextended\('eclub-puan-yazma-fonksiyonlari-faz-1b', 0\)/
  );
  assert.match(
    sql,
    /table_name = 'eclub_kazanilan_puanlar'[\s\S]*?column_name = 'eczane_id'[\s\S]*?data_type = 'uuid'[\s\S]*?is_nullable = 'NO'/
  );
});

test("yalnız iki kanonik puan yazma RPC'si yeniden tanımlanır", () => {
  const tanimlar = sql.match(/CREATE OR REPLACE FUNCTION public\./g) ?? [];
  assert.equal(tanimlar.length, 2);
  assert.match(sql, /FUNCTION public\.eclub_izleme_tamamla\(/);
  assert.match(sql, /FUNCTION public\.eclub_cevaplari_kaydet\(/);
  assert.doesNotMatch(sql, /FUNCTION public\.eclub_store_/);
  assert.doesNotMatch(sql, /FUNCTION public\.get_eclub_/);
});

for (const [ad, blok] of [
  ["eclub_izleme_tamamla", izleme],
  ["eclub_cevaplari_kaydet", cevap],
] as const) {
  test(`${ad} aktif eczaneyi kilitleyerek tekil çözer`, () => {
    assert.match(blok, /v_aktif_eczaneler uuid\[\];/);
    assert.match(blok, /v_eczane_id uuid;/);
    assert.match(
      blok,
      /FROM public\.eclub_kisi_eczane ke[\s\S]*?ke\.kisi_id = p_kisi_id[\s\S]*?ke\.aktif_mi = true[\s\S]*?FOR SHARE/
    );
    assert.match(
      blok,
      /coalesce\(cardinality\(v_aktif_eczaneler\), 0\) = 0[\s\S]*?RAISE EXCEPTION/
    );
    assert.match(
      blok,
      /cardinality\(v_aktif_eczaneler\) > 1[\s\S]*?RAISE EXCEPTION/
    );
    assert.match(blok, /v_eczane_id := v_aktif_eczaneler\[1\];/);
  });

  test(`${ad} kazanılan puana eczane_id değerini açıkça yazar`, () => {
    assert.match(
      blok,
      /INSERT INTO public\.eclub_kazanilan_puanlar\s+\(kisi_id, eczane_id, yayin_id, izleme_id, puan_turu, puan, urun_id\)/
    );
    assert.match(blok, /VALUES\s+\(p_kisi_id, v_eczane_id, v_izleme\.yayin_id/);
  });

  test(`${ad} SECURITY INVOKER ve sabit search_path kullanır`, () => {
    assert.match(blok, /SECURITY INVOKER/);
    assert.match(blok, /SET search_path = public, pg_temp/);
    assert.doesNotMatch(blok, /SECURITY DEFINER/);
  });
}

test("izleme RPC'si dört araç türünün kanıt ve puan davranışını korur", () => {
  for (const aracTuru of ["video", "podcast", "gorsel", "flip_pdf"]) {
    assert.match(izleme, new RegExp(`v_arac_turu = '${aracTuru}'`));
  }
  assert.match(izleme, /v_arac_puani > 0 AND NOT EXISTS/);
  assert.match(izleme, /ON CONFLICT \(izleme_id, puan_turu\) DO NOTHING;/);
  assert.match(izleme, /INSERT INTO public\.eclub_utt_puanlari/);
});

test("cevap RPC'si soru kapısını, tek kullanımı ve cevaplama puan türünü korur", () => {
  assert.match(cevap, /soru_hakki_var_mi/);
  assert.match(cevap, /soru_erisimi_acik_mi/);
  assert.match(cevap, /Cevaplar atanmış soru kümesiyle eşleşmiyor/);
  assert.match(cevap, /'cevaplama', v_toplam/);
  assert.match(
    cevap,
    /UPDATE public\.eclub_izleme_kayitlari\s+SET soru_erisimi_acik_mi = false/
  );
});

test("RPC çalıştırma yetkileri yalnız service_role için bırakılır", () => {
  for (const imza of [
    "eclub_izleme_tamamla\\(uuid, uuid, timestamptz, integer\\[\\]\\)",
    "eclub_cevaplari_kaydet\\(uuid, uuid, jsonb\\)",
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
