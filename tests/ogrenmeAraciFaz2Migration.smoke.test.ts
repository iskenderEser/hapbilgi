import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("scripts/sql/ogrenme_araclari_faz2_ortak_omurga.sql", "utf8");
const gorunum = readFileSync("scripts/sql/ogrenme_araclari_faz2_yayin_gorunumu.sql", "utf8");
const onKontrol = readFileSync("scripts/sql/ogrenme_araclari_faz2_on_kontrol.sql", "utf8");

test("migration eklemelidir ve eski video tablolarını kaldırmaz", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.ogrenme_araclari/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.ogrenme_araci_durumu/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.ogrenme_araci_puanlari/);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|TRUNCATE/);
});

test("talep, soru seti, yayın, görev ve tüketim tabloları ortak kimlikleri taşır", () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS ogrenme_araci_turu text/);
  assert.match(migration, /public\.soru_setleri[\s\S]*ADD COLUMN IF NOT EXISTS arac_durum_id/);
  assert.match(migration, /public\.yayin_yonetimi[\s\S]*ADD COLUMN IF NOT EXISTS arac_durum_id/);
  assert.match(migration, /public\.uretim_gorevleri[\s\S]*ADD COLUMN IF NOT EXISTS arac_id/);
  for (const tablo of ["izleme_kayitlari", "cc_izleme_kayitlari", "eclub_izleme_kayitlari", "eczanem_izleme_kayitlari"]) {
    assert.match(migration, new RegExp(`ALTER TABLE public\\.${tablo}[\\s\\S]*?tamamlama_kaniti jsonb`));
  }
});

test("video geri doldurma ve eski kimlik eşlemeleri idempotenttir", () => {
  assert.match(migration, /'video'[\s\S]*legacy_video_id/);
  assert.match(migration, /ON CONFLICT \(legacy_video_id\) DO UPDATE/);
  assert.match(migration, /ON CONFLICT \(legacy_video_durum_id\) DO NOTHING/);
  assert.match(migration, /ON CONFLICT \(legacy_video_puan_id\) DO UPDATE/);
  assert.match(migration, /legacy_video_id\s+uuid UNIQUE/);
  assert.match(migration, /legacy_video_durum_id\s+uuid UNIQUE/);
  assert.match(migration, /legacy_video_puan_id\s+uuid UNIQUE/);
});

test("eski video yazıları ortak modele aynı transaction içinde yansır", () => {
  assert.match(migration, /videolar_ogrenme_araci_trg/);
  assert.match(migration, /video_durumu_ogrenme_araci_trg/);
  assert.match(migration, /video_puanlari_ogrenme_araci_trg/);
  assert.match(migration, /soru_setleri_arac_durumu_trg/);
  assert.match(migration, /uretim_gorevleri_arac_trg/);
});

test("yayın kapısı ve araç türü değişmezliği veritabanında uygulanır", () => {
  assert.match(migration, /yayin_yonetimi_arac_kapisi_trg/);
  assert.match(migration, /v_durum <> 'onaylandi'/);
  assert.match(migration, /v_metadata_dogrulandi IS NOT TRUE/);
  assert.match(migration, /talepler_arac_turu_sabitle_trg/);
  assert.match(migration, /öğrenme aracı türü değiştirilemez/);
});

test("atomik yükleme başlangıcı tek talep ve yalnız service_role sınırındadır", () => {
  assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\(p_talep_id::text, 1\)\)/);
  assert.match(migration, /IF EXISTS \(SELECT 1 FROM public\.ogrenme_araclari a WHERE a\.talep_id = p_talep_id\)/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.ogrenme_araci_yukleme_baslat[\s\S]*FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.ogrenme_araci_yukleme_baslat[\s\S]*TO service_role/);
});

test("ortak tablolar RLS ile kapalı ve service role'a özeldir", () => {
  for (const tablo of ["ogrenme_araclari", "ogrenme_araci_durumu", "ogrenme_araci_puanlari"]) {
    assert.match(migration, new RegExp(`ALTER TABLE public\\.${tablo} ENABLE ROW LEVEL SECURITY`));
    assert.match(migration, new RegExp(`REVOKE ALL ON public\\.${tablo} FROM anon, authenticated`));
  }
});

test("yayın görünümü eski kolonları koruyup ortak alanları sona ekler", () => {
  const videoSure = gorunum.indexOf("AS video_suresi_saniye");
  const aracId = gorunum.indexOf("oa.arac_id");
  assert.ok(videoSure >= 0 && aracId > videoSure);
  assert.match(gorunum, /COALESCE\(oa\.arac_turu, t\.ogrenme_araci_turu, 'video'\) AS arac_turu/);
  assert.match(gorunum, /AS ogrenme_araci_puani/);
  assert.match(gorunum, /AS arac_metadata_dogrulandi/);
});

test("ön kontrol yalnız okur ve bilinmeyen tarihî durumları görünür kılar", () => {
  assert.match(onKontrol, /WHERE durum NOT IN/);
  assert.match(onKontrol, /talebi_olmayan_tarihi_video/);
  assert.doesNotMatch(onKontrol, /INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE/);
});

