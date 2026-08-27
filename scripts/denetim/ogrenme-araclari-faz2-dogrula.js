/* eslint-disable @typescript-eslint/no-require-imports */
// Faz 2 SQL dosyalarını canlı şema üzerinde transaction içinde çalıştırır ve
// her koşulda ROLLBACK yapar. Kalıcı migration uygulamaz.

const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const { Client } = require("pg");

dotenv.config({ path: path.join(process.cwd(), ".env.local"), quiet: true });

function transactionSinirlariniKaldir(sql) {
  return sql
    .replace(/^\s*BEGIN;\s*$/gim, "")
    .replace(/^\s*COMMIT;\s*$/gim, "");
}

async function calistir() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL tanımlı değil.");
  const ortak = fs.readFileSync(path.join(process.cwd(), "scripts/sql/ogrenme_araclari_faz2_ortak_omurga.sql"), "utf8");
  const gorunum = fs.readFileSync(path.join(process.cwd(), "scripts/sql/ogrenme_araclari_faz2_yayin_gorunumu.sql"), "utf8");
  const istemci = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 15_000,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await istemci.connect();
    await istemci.query("BEGIN");
    await istemci.query("SET LOCAL lock_timeout = '10s'");
    await istemci.query("SET LOCAL statement_timeout = '60s'");
    await istemci.query(transactionSinirlariniKaldir(ortak));
    await istemci.query(transactionSinirlariniKaldir(gorunum));

    const sonuc = await istemci.query(`
      SELECT
        (SELECT count(*) FROM public.videolar WHERE talep_id IS NOT NULL)
          - (SELECT count(*) FROM public.ogrenme_araclari WHERE legacy_video_id IS NOT NULL) AS eksik_video,
        (SELECT count(*) FROM public.video_durumu)
          - (SELECT count(*) FROM public.ogrenme_araci_durumu WHERE legacy_video_durum_id IS NOT NULL) AS eksik_durum,
        (SELECT count(*) FROM public.video_puanlari)
          - (SELECT count(*) FROM public.ogrenme_araci_puanlari WHERE legacy_video_puan_id IS NOT NULL) AS eksik_puan
    `);
    const sapma = sonuc.rows[0];
    if (Object.values(sapma).some((deger) => Number(deger) !== 0)) {
      throw new Error(`Geri doldurma sapması: ${JSON.stringify(sapma)}`);
    }
    console.log(`Faz 2 migration transaction doğrulaması başarılı: ${JSON.stringify(sapma)}`);
  } finally {
    await istemci.query("ROLLBACK").catch(() => {});
    await istemci.end().catch(() => {});
  }
}

calistir().catch((hata) => {
  console.error("Faz 2 migration doğrulaması başarısız:", hata instanceof Error ? hata.message : String(hata));
  process.exitCode = 1;
});

