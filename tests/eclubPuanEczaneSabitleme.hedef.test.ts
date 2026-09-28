import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "scripts/sql/eclub_puan_eczane_sabitleme.sql",
  "utf8"
);
const temizleme = readFileSync(
  "scripts/sql/eclub_puan_eczane_test_verisi_temizle.sql",
  "utf8"
);

test("Faz 1A migration transaction, advisory lock ve tablo kilidi içerir", () => {
  assert.match(migration, /^BEGIN;/m);
  assert.match(migration, /COMMIT;\s*$/);
  assert.match(
    migration,
    /pg_advisory_xact_lock\(\s*hashtextextended\('eclub-puan-eczane-sabitleme-faz-1a', 0\)\s*\)/
  );
  assert.match(
    migration,
    /LOCK TABLE public\.eclub_kazanilan_puanlar IN ACCESS EXCLUSIVE MODE;/
  );
});

test("Migration mevcut test puanını sessizce silmez", () => {
  assert.match(
    migration,
    /IF NOT EXISTS \([\s\S]*?column_name = 'eczane_id'[\s\S]*?AND EXISTS \(SELECT 1 FROM public\.eclub_kazanilan_puanlar\) THEN[\s\S]*?RAISE EXCEPTION/
  );
  assert.match(
    migration,
    /scripts\/sql\/eclub_puan_eczane_test_verisi_temizle\.sql/
  );
  assert.doesNotMatch(migration, /DELETE FROM public\.eclub_kazanilan_puanlar/i);
});

test("eczane_id uuid ve NOT NULL olarak tanımlanır; varsayılan değer kullanılmaz", () => {
  assert.match(
    migration,
    /ALTER TABLE public\.eclub_kazanilan_puanlar\s+ADD COLUMN IF NOT EXISTS eczane_id uuid;/
  );
  assert.match(
    migration,
    /ALTER TABLE public\.eclub_kazanilan_puanlar\s+ALTER COLUMN eczane_id SET NOT NULL;/
  );
  assert.doesNotMatch(migration, /eczane_id uuid\s+DEFAULT/i);
});

test("eczane foreign key kontrolü doğru tabloya bağlıdır ve silmeyi kısıtlar", () => {
  assert.match(
    migration,
    /c\.conname = 'fk_eclub_kazanilan_puanlar_eczane'[\s\S]*?c\.conrelid = 'public\.eclub_kazanilan_puanlar'::regclass/
  );
  assert.match(
    migration,
    /FOREIGN KEY \(eczane_id\)\s+REFERENCES public\.eclub_eczaneler \(eczane_id\)\s+ON DELETE RESTRICT;/
  );
});

test("eczane tabanlı iki sorgu indeksi oluşturulur", () => {
  assert.match(
    migration,
    /idx_eclub_kazanilan_puanlar_eczane_yayin_cek_tarih[\s\S]*?\(eczane_id, yayin_id, cek_karsiligi_var_mi, created_at\);/
  );
  assert.match(
    migration,
    /idx_eclub_kazanilan_puanlar_eczane_tarih[\s\S]*?\(eczane_id, created_at\);/
  );
});

test("INSERT trigger'ı aktif eczaneyi kilitleyerek sunucu tarafında belirler", () => {
  const fonksiyon = migration.match(
    /CREATE OR REPLACE FUNCTION public\.tg_eclub_kazanilan_puanlar_eczane_sabitle\(\)[\s\S]*?END;\n\$\$;/
  )?.[0];

  assert.ok(fonksiyon);
  assert.match(fonksiyon, /SECURITY DEFINER/);
  assert.match(fonksiyon, /SET search_path = public, pg_temp/);
  assert.match(
    fonksiyon,
    /FROM public\.eclub_kisi_eczane ke[\s\S]*?ke\.kisi_id = NEW\.kisi_id[\s\S]*?ke\.aktif_mi = true[\s\S]*?FOR SHARE/
  );
  assert.match(fonksiyon, /NEW\.eczane_id := v_aktif_eczane_id;/);
  assert.match(
    migration,
    /CREATE TRIGGER trg_eclub_kazanilan_puanlar_eczane_sabitle\s+BEFORE INSERT ON public\.eclub_kazanilan_puanlar/
  );
});

test("aktif eczane yokluğu, çoğulluğu ve sahte eczane_id reddedilir", () => {
  assert.match(
    migration,
    /coalesce\(cardinality\(v_aktif_eczaneler\), 0\) = 0[\s\S]*?RAISE EXCEPTION/
  );
  assert.match(
    migration,
    /cardinality\(v_aktif_eczaneler\) > 1[\s\S]*?RAISE EXCEPTION/
  );
  assert.match(
    migration,
    /NEW\.eczane_id IS NOT NULL[\s\S]*?NEW\.eczane_id <> v_aktif_eczane_id[\s\S]*?RAISE EXCEPTION/
  );
});

test("eczane snapshot alanı UPDATE ile değiştirilemez", () => {
  assert.match(
    migration,
    /CREATE OR REPLACE FUNCTION public\.tg_eclub_kazanilan_puanlar_eczane_degismez\(\)[\s\S]*?END;\n\$\$;/
  );
  assert.match(
    migration,
    /NEW\.eczane_id IS DISTINCT FROM OLD\.eczane_id[\s\S]*?RAISE EXCEPTION/
  );
  assert.match(
    migration,
    /CREATE TRIGGER trg_eclub_kazanilan_puanlar_eczane_degismez\s+BEFORE UPDATE OF eczane_id ON public\.eclub_kazanilan_puanlar/
  );
  assert.doesNotMatch(migration, /END\n\$\$;/);
});

test("iki SECURITY DEFINER trigger fonksiyonunun doğrudan çalıştırma yetkisi kapalıdır", () => {
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION public\.tg_eclub_kazanilan_puanlar_eczane_sabitle\(\)\s+FROM PUBLIC, anon, authenticated;/
  );
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION public\.tg_eclub_kazanilan_puanlar_eczane_degismez\(\)\s+FROM PUBLIC, anon, authenticated;/
  );
});

test("Faz 1A başka tablolara veya Faz 1B/1C RPC'lerine müdahale etmez", () => {
  assert.doesNotMatch(migration, /CREATE UNIQUE INDEX[\s\S]*?eclub_kisi_eczane/i);
  assert.doesNotMatch(migration, /CREATE(?: OR REPLACE)? FUNCTION public\.eclub_store_/i);
  assert.doesNotMatch(migration, /CREATE(?: OR REPLACE)? FUNCTION public\.get_eclub_/i);
  assert.doesNotMatch(migration, /INSERT INTO public\.eclub_kazanilan_puanlar/i);
});

test("temizleme SQL'i yalnız kazanılan puan test verisini siler", () => {
  assert.match(temizleme, /^BEGIN;/m);
  assert.match(temizleme, /COMMIT;\s*$/);
  assert.match(
    temizleme,
    /LOCK TABLE public\.eclub_kazanilan_puanlar IN ACCESS EXCLUSIVE MODE;/
  );
  assert.match(temizleme, /DELETE FROM public\.eclub_kazanilan_puanlar;/);

  const silmeler = temizleme.match(/DELETE FROM/gi) ?? [];
  assert.equal(silmeler.length, 1);
  assert.doesNotMatch(temizleme, /eclub_store_cek_talepleri/i);
  assert.doesNotMatch(temizleme, /eclub_bildirimler/i);
  assert.doesNotMatch(temizleme, /eclub_kisi_eczane/i);
});
