require("dotenv").config({ path: ".env.local" });
const { Client } = require("pg");

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error(".env.local içinde DATABASE_URL tanımlı değil.");

  const client = new Client({ connectionString, connectionTimeoutMillis: 15_000 });
  await client.connect();
  await client.query("SET statement_timeout = '15s'");

  const { rows } = await client.query(`
    WITH sayim AS (
      SELECT
        (SELECT count(*) FROM public.talepler)::int AS talep_toplam,
        (SELECT count(*) FROM public.talepler
          WHERE hedef_roller = ARRAY['eczaci','eczane_teknisyeni']::text[])::int AS cift_hedefli_talep,
        (SELECT count(*) FROM public.talepler
          WHERE hedef_roller IS NULL OR hedef_roller = '{}'
             OR hedef_roller NOT IN (
               ARRAY['utt']::text[], ARRAY['bm']::text[], ARRAY['eczanem']::text[],
               ARRAY['eczaci']::text[], ARRAY['eczane_teknisyeni']::text[],
               ARRAY['eczaci','eczane_teknisyeni']::text[]
             ))::int AS gecersiz_talep,
        (SELECT count(*) FROM public.talepler
          WHERE hedef_rol IS DISTINCT FROM hedef_roller[1])::int AS gecis_uyumsuzlugu,
        (SELECT count(*) FROM public.yayin_yonetimi
          WHERE hedef_roller IS NULL OR hedef_roller = '{}'
             OR hedef_roller NOT IN (
               ARRAY['utt']::text[], ARRAY['bm']::text[], ARRAY['eczanem']::text[],
               ARRAY['eczaci']::text[], ARRAY['eczane_teknisyeni']::text[],
               ARRAY['eczaci','eczane_teknisyeni']::text[]
             ))::int AS gecersiz_yayin,
        (SELECT count(*) FROM (
          SELECT oneri_id FROM public.eclub_izleme_kayitlari
          WHERE oneri_id IS NOT NULL GROUP BY oneri_id HAVING count(*) > 1
        ) x)::int AS mukerrer_oneri_izlemesi,
        (SELECT count(*) FROM (
          SELECT izleme_id, puan_turu FROM public.eclub_kazanilan_puanlar
          GROUP BY izleme_id, puan_turu HAVING count(*) > 1
        ) x)::int AS mukerrer_puan,
        (SELECT count(*) FROM (
          SELECT izleme_id, soru_index FROM public.eclub_dogru_cevap_kayitlari
          GROUP BY izleme_id, soru_index HAVING count(*) > 1
        ) x)::int AS mukerrer_dogru_cevap,
        (SELECT count(*) FROM (
          SELECT izleme_id, soru_index FROM public.eclub_yanlis_cevap_kayitlari
          GROUP BY izleme_id, soru_index HAVING count(*) > 1
        ) x)::int AS mukerrer_yanlis_cevap
    ), yapi AS (
      SELECT
        EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_talepler_hedef_roller') AS talep_kisiti,
        EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_yayin_yonetimi_hedef_roller') AS yayin_kisiti,
        EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'talepler_hedef_roller_esitle_trg' AND NOT tgisinternal) AS gecis_tetikleyicisi,
        EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'eclub_izleme_oneri_uq') AS izleme_tekilligi,
        EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'eclub_puan_izleme_tur_uq') AS puan_tekilligi,
        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'v_yayin_detay' AND column_name = 'hedef_roller') AS detay_view_cogul,
        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'v_yayin_kunye' AND column_name = 'hedef_roller') AS kunye_view_cogul
    )
    SELECT sayim.*, yapi.* FROM sayim CROSS JOIN yapi;
  `);
  await client.end();

  const sonuc = rows[0];
  const temiz =
    sonuc.gecersiz_talep === 0 &&
    sonuc.gecis_uyumsuzlugu === 0 &&
    sonuc.gecersiz_yayin === 0 &&
    sonuc.mukerrer_oneri_izlemesi === 0 &&
    sonuc.mukerrer_puan === 0 &&
    sonuc.mukerrer_dogru_cevap === 0 &&
    sonuc.mukerrer_yanlis_cevap === 0 &&
    sonuc.talep_kisiti && sonuc.yayin_kisiti && sonuc.gecis_tetikleyicisi &&
    sonuc.izleme_tekilligi && sonuc.puan_tekilligi &&
    sonuc.detay_view_cogul && sonuc.kunye_view_cogul;

  console.log(JSON.stringify({ ...sonuc, sonuc: temiz ? "TEMİZ" : "HATALI" }, null, 2));
  if (!temiz) process.exitCode = 1;
}

main().catch((error) => {
  console.error("Hedef roller doğrulaması çalıştırılamadı:", error.message);
  process.exitCode = 1;
});
