require("dotenv").config({ path: ".env.local", quiet: true });

const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { Client } = require("pg");

async function hataBekle(client, sql, parametreler, kod) {
  await client.query("SAVEPOINT beklenen_hata");
  try {
    await client.query(sql, parametreler);
    assert.fail(`Beklenen PostgreSQL hatası oluşmadı: ${kod}`);
  } catch (hata) {
    assert.equal(hata.code, kod, hata.message);
  } finally {
    await client.query("ROLLBACK TO SAVEPOINT beklenen_hata");
    await client.query("RELEASE SAVEPOINT beklenen_hata");
  }
}

async function main() {
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL tanımlı değil.");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    await client.query("BEGIN");

    const aday = (await client.query(`
      SELECT g.gorev_id, g.surum, t.uretici_id
      FROM public.uretim_gorevleri g
      JOIN public.talepler t ON t.talep_id = g.talep_id
      WHERE t.ogrenme_araci_turu = 'video'
        AND g.asama = 'senaryo'
        AND g.durum = 'inceleme_bekliyor'
      ORDER BY g.updated_at DESC
      LIMIT 1
      FOR UPDATE OF g
    `)).rows[0];
    assert.ok(aday, "İnceleme bekleyen Video senaryo görevi bulunamadı.");

    const baskaUretici = (await client.query(`
      SELECT kullanici_id
      FROM public.kullanicilar
      WHERE aktif_mi = true
        AND rol IN ('pm', 'med_md', 'ik_md')
        AND kullanici_id <> $1
      LIMIT 1
    `, [aday.uretici_id])).rows[0];
    assert.ok(baskaUretici, "Yetki olumsuz testi için ikinci üretici bulunamadı.");

    const rpc = `SELECT public.uretim_uretici_karar_ver($1,$2,$3,$4,$5,$6) AS sonuc`;

    await hataBekle(client, rpc, [
      aday.gorev_id,
      aday.uretici_id,
      "revizyon bekleniyor",
      "Canlı rollback testi",
      randomUUID(),
      aday.surum + 1,
    ], "23514");

    await hataBekle(client, rpc, [
      aday.gorev_id,
      baskaUretici.kullanici_id,
      "revizyon bekleniyor",
      "Canlı rollback testi",
      randomUUID(),
      aday.surum,
    ], "42501");

    const islemAnahtari = randomUUID();
    const parametreler = [
      aday.gorev_id,
      aday.uretici_id,
      "revizyon bekleniyor",
      "Canlı rollback testi",
      islemAnahtari,
      aday.surum,
    ];
    const ilk = (await client.query(rpc, parametreler)).rows[0].sonuc;
    assert.equal(ilk.karar, "revizyon bekleniyor");

    const gorev = (await client.query(
      "SELECT durum, surum FROM public.uretim_gorevleri WHERE gorev_id=$1",
      [aday.gorev_id],
    )).rows[0];
    assert.equal(gorev.durum, "revizyon_bekliyor");
    assert.equal(gorev.surum, aday.surum + 1);

    const tekrar = (await client.query(rpc, parametreler)).rows[0].sonuc;
    assert.deepEqual(tekrar, ilk, "Aynı işlem anahtarı aynı sonucu döndürmedi.");

    console.log(JSON.stringify({
      arac: "video",
      asama: "senaryo",
      eskiSurumReddedildi: true,
      baskaUreticiReddedildi: true,
      revizyonGecisiDogrulandi: true,
      idempotencyDogrulandi: true,
      rollback: true,
    }));
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    await client.end();
  }
}

main().catch((hata) => {
  console.error(hata instanceof Error ? hata.message : hata);
  process.exitCode = 1;
});
