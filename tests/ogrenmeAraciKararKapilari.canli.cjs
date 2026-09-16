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
      SELECT t.uretici_id, t.firma_id, t.takim_id, t.egitim_turu,
             t.hedef_roller, t.icerik_turu, t.urun_id, t.teknik_id,
             COALESCE(t.urun_adi, 'Canlı rollback testi') AS urun_adi
      FROM public.talepler t
      JOIN public.kullanicilar k ON k.kullanici_id=t.uretici_id AND k.aktif_mi=true
      WHERE t.ogrenme_araci_turu='gorsel'
      ORDER BY t.created_at DESC
      LIMIT 1
    `)).rows[0];
    assert.ok(aday, "Fixture için uygun üretici talebi bulunamadı.");

    const baskaUretici = (await client.query(`
      SELECT kullanici_id FROM public.kullanicilar
      WHERE aktif_mi=true AND rol IN ('pm','med_md','ik_md') AND kullanici_id<>$1
      LIMIT 1
    `, [aday.uretici_id])).rows[0];
    assert.ok(baskaUretici, "Yetki testi için ikinci üretici bulunamadı.");

    const araclar = [
      {
        tur: "gorsel",
        sql: "SELECT public.uretim_gorsel_uretici_karar_ver($1,$2,$3,$4,$5,$6) AS sonuc",
        ek: [],
      },
      {
        tur: "flip_pdf",
        sql: "SELECT public.uretim_flip_pdf_uretici_karar_ver($1,$2,$3,$4,$5,$6) AS sonuc",
        ek: [],
      },
      {
        tur: "podcast",
        sql: "SELECT public.uretim_podcast_uretici_karar_ver($1,$2,$3,$4,$5,$6,$7) AS sonuc",
        ek: [false],
      },
    ];
    const sonuclar = [];

    for (const arac of araclar) {
      await client.query("SAVEPOINT arac_testi");
      const talepVerisi = {
        firma_id: aday.firma_id,
        takim_id: aday.takim_id,
        egitim_turu: aday.egitim_turu,
        hedef_roller: aday.hedef_roller,
        icerik_turu: aday.icerik_turu,
        ogrenme_araci_turu: arac.tur,
        ogrenme_araci_tercihleri: arac.tur === "podcast" ? { transkript_istendi: false } : {},
        urun_id: aday.urun_id,
        teknik_id: aday.teknik_id,
        urun_adi: aday.urun_adi,
        aciklama: "Canlı rollback üretim testi",
        hazir_video: false,
        hazir_soru_seti: false,
        hazir_soru_seti_verisi: null,
        soru_seti_buyuklugu: 10,
        secenek_sayisi: 4,
        video_basi_soru_sayisi: 2,
      };
      const talepSonucu = (await client.query(
        "SELECT public.talep_atomik_olustur($1,$2,$3::jsonb) AS sonuc",
        [aday.uretici_id, randomUUID(), JSON.stringify(talepVerisi)],
      )).rows[0].sonuc;
      const ilkGorev = (await client.query(`
        SELECT gorev_id,atanan_iu_id FROM public.uretim_gorevleri
        WHERE talep_id=$1 AND asama='senaryo'
        ORDER BY created_at DESC LIMIT 1
      `, [talepSonucu.talep_id])).rows[0];
      assert.ok(ilkGorev, `${arac.tur} için ilk senaryo görevi açılmadı.`);
      assert.ok(ilkGorev.atanan_iu_id, `${arac.tur} senaryo görevi İÜ'ye atanmadı.`);
      await client.query(
        "SELECT public.uretim_senaryo_teslim_et($1,$2,$3,$4)",
        [ilkGorev.gorev_id, ilkGorev.atanan_iu_id, "Canlı rollback senaryosu", randomUUID()],
      );
      await client.query(
        "UPDATE public.uretim_gorevleri SET surum=41, son_islem_anahtari=NULL WHERE gorev_id=$1",
        [ilkGorev.gorev_id],
      );

      const parametreler = (uretici, anahtar, surum) => [
        ilkGorev.gorev_id,
        uretici,
        "revizyon bekleniyor",
        "Canlı rollback araç testi",
        anahtar,
        surum,
        ...arac.ek,
      ];
      await hataBekle(client, arac.sql, parametreler(aday.uretici_id, randomUUID(), 40), "23514");
      await hataBekle(client, arac.sql, parametreler(baskaUretici.kullanici_id, randomUUID(), 41), "42501");

      const islemAnahtari = randomUUID();
      const dogruParametreler = parametreler(aday.uretici_id, islemAnahtari, 41);
      const ilk = (await client.query(arac.sql, dogruParametreler)).rows[0].sonuc;
      assert.equal(ilk.karar, "revizyon bekleniyor");
      const gorevDurumu = (await client.query(
        "SELECT durum,surum FROM public.uretim_gorevleri WHERE gorev_id=$1",
        [ilkGorev.gorev_id],
      )).rows[0];
      assert.deepEqual(gorevDurumu, { durum: "revizyon_bekliyor", surum: 42 });
      const tekrar = (await client.query(arac.sql, dogruParametreler)).rows[0].sonuc;
      assert.deepEqual(tekrar, ilk);

      sonuclar.push({
        arac: arac.tur,
        eskiSurumReddedildi: true,
        baskaUreticiReddedildi: true,
        revizyonGecisiDogrulandi: true,
        idempotencyDogrulandi: true,
      });
      console.log(JSON.stringify(sonuclar.at(-1)));
      await client.query("ROLLBACK TO SAVEPOINT arac_testi");
      await client.query("RELEASE SAVEPOINT arac_testi");
    }

    console.log(JSON.stringify({ sonuclar, rollback: true }));
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    await client.end();
  }
}

main().catch((hata) => {
  console.error(hata instanceof Error ? hata.message : hata);
  process.exitCode = 1;
});
