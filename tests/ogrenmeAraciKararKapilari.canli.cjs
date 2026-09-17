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
    const soruFixture = Array.from({ length: 10 }, (_, indeks) => ({
      soru_metni: `Canlı rollback sorusu ${indeks + 1}`,
      secenekler: ["A", "B", "C", "D"].map((harf, secenek) => ({
        harf,
        metin: `Seçenek ${harf}`,
        dogru: secenek === 0,
      })),
    }));

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
      for (const hazirSoru of [false, true]) {
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
        aciklama: `Canlı rollback üretim testi ${hazirSoru ? "V3" : "V1"}`,
        hazir_video: false,
        hazir_soru_seti: hazirSoru,
        hazir_soru_seti_verisi: hazirSoru ? soruFixture : null,
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
      await client.query("SAVEPOINT karar_dallari");

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

      await client.query("ROLLBACK TO SAVEPOINT karar_dallari");
      await client.query("RELEASE SAVEPOINT karar_dallari");
      const onayParametreleri = [
        ilkGorev.gorev_id,
        aday.uretici_id,
        "onaylandi",
        null,
        randomUUID(),
        41,
        ...arac.ek,
      ];
      const onay = (await client.query(arac.sql, onayParametreleri)).rows[0].sonuc;
      assert.equal(onay.karar, "onaylandi");
      const kapananGorev = (await client.query(
        "SELECT durum,surum FROM public.uretim_gorevleri WHERE gorev_id=$1",
        [ilkGorev.gorev_id],
      )).rows[0];
      assert.deepEqual(kapananGorev, { durum: "tamamlandi", surum: 42 });
      const aracGorevi = (await client.query(`
        SELECT gorev_id,asama,durum,atanan_iu_id,surum
        FROM public.uretim_gorevleri
        WHERE talep_id=$1 AND asama='video'
        ORDER BY created_at DESC LIMIT 1
      `, [talepSonucu.talep_id])).rows[0];
      assert.ok(aracGorevi, `${arac.tur} üretim görevi açılmadı.`);
      assert.equal(aracGorevi.asama, "video");
      assert.ok(["hazirlaniyor", "atama_bekliyor"].includes(aracGorevi.durum));
      assert.ok(aracGorevi.atanan_iu_id, `${arac.tur} üretim görevi İÜ'ye atanmadı.`);
      if (aracGorevi.durum === "atama_bekliyor") {
        await client.query(
          "UPDATE public.uretim_gorevleri SET durum='hazirlaniyor' WHERE gorev_id=$1",
          [aracGorevi.gorev_id],
        );
      }

      const mimeTuru = arac.tur === "gorsel"
        ? "image/png"
        : arac.tur === "flip_pdf" ? "application/pdf" : "audio/mpeg";
      const depolamaDogrulamasi = {
        dosya_imzasi: { dogrulandi: true },
        dosya_boyutu: { dogrulandi: true },
        mime_turu: { dogrulandi: true },
        checksum: { dogrulandi: true, edge_makbuzu_dogrulandi: true },
        tamamlanma_tarihi: new Date().toISOString(),
      };
      const metadata = {
        depolama_dogrulamasi: depolamaDogrulamasi,
        kapak_iptal_edildi: true,
        transkript: { durum: "yok" },
      };
      const aracKaydi = (await client.query(`
        INSERT INTO public.ogrenme_araclari
          (talep_id,senaryo_durum_id,iu_id,arac_turu,kaynak,dosya_yolu,mime_type,
           dosya_boyutu,checksum_sha256,metadata,metadata_dogrulandi)
        VALUES ($1,$2,$3,$4,'iu',$5,$6,1024,$7,$8::jsonb,$9)
        RETURNING arac_id
      `, [
        talepSonucu.talep_id,
        onay.durum_id,
        aracGorevi.atanan_iu_id,
        arac.tur,
        `test/${talepSonucu.talep_id}/${arac.tur}`,
        mimeTuru,
        "a".repeat(64),
        JSON.stringify(metadata),
        arac.tur === "podcast",
      ])).rows[0];
      await client.query(`
        INSERT INTO public.ogrenme_araci_durumu (arac_id,durum,degistiren_id,notlar)
        VALUES ($1,'dogrulama_bekliyor',$2,'Canlı rollback doğrulaması')
      `, [aracKaydi.arac_id, aracGorevi.atanan_iu_id]);

      const dogrulamaAnahtari = randomUUID();
      if (arac.tur === "gorsel") {
        await client.query(
          "SELECT public.uretim_gorsel_dogrula($1,$2,$3,$4,$5,$6)",
          [aracKaydi.arac_id, aracGorevi.atanan_iu_id, aracGorevi.gorev_id, 1200, 1600, dogrulamaAnahtari],
        );
      } else if (arac.tur === "flip_pdf") {
        await client.query(
          "SELECT public.uretim_flip_pdf_dogrula($1,$2,$3,$4,$5,$6,$7)",
          [aracKaydi.arac_id, aracGorevi.atanan_iu_id, aracGorevi.gorev_id, 4, "Test metni", "tam", dogrulamaAnahtari],
        );
      } else {
        await client.query(
          "SELECT public.uretim_podcast_dogrula($1,$2,$3,$4,$5)",
          [aracKaydi.arac_id, aracGorevi.atanan_iu_id, aracGorevi.gorev_id, 60, dogrulamaAnahtari],
        );
      }

      const incelemeGorevi = (await client.query(
        "SELECT durum,surum,arac_id FROM public.uretim_gorevleri WHERE gorev_id=$1",
        [aracGorevi.gorev_id],
      )).rows[0];
      assert.equal(incelemeGorevi.durum, "inceleme_bekliyor");
      assert.equal(incelemeGorevi.arac_id, aracKaydi.arac_id);
      const aracOnayParametreleri = [
        aracGorevi.gorev_id,
        aday.uretici_id,
        "onaylandi",
        null,
        randomUUID(),
        incelemeGorevi.surum,
        ...arac.ek,
      ];
      await client.query(arac.sql, aracOnayParametreleri);
      if (!hazirSoru) {
      const soruGorevi = (await client.query(`
        SELECT gorev_id,asama,durum,soru_seti_id,atanan_iu_id
        FROM public.uretim_gorevleri
        WHERE talep_id=$1 AND asama='soru_seti'
        ORDER BY created_at DESC LIMIT 1
      `, [talepSonucu.talep_id])).rows[0];
      assert.ok(soruGorevi, `${arac.tur} onayından sonra soru seti görevi açılmadı.`);
      assert.ok(soruGorevi.soru_seti_id, `${arac.tur} soru seti bağı kurulmadı.`);
      assert.ok(soruGorevi.atanan_iu_id, `${arac.tur} soru seti görevi İÜ'ye atanmadı.`);
      if (soruGorevi.durum === "atama_bekliyor") {
        await client.query(
          "UPDATE public.uretim_gorevleri SET durum='hazirlaniyor' WHERE gorev_id=$1",
          [soruGorevi.gorev_id],
        );
      }
      await client.query(
        "SELECT public.uretim_soru_seti_teslim_et($1,$2,$3::jsonb,$4)",
        [soruGorevi.gorev_id, soruGorevi.atanan_iu_id, JSON.stringify(soruFixture), randomUUID()],
      );
      const soruInceleme = (await client.query(
        "SELECT durum,surum FROM public.uretim_gorevleri WHERE gorev_id=$1",
        [soruGorevi.gorev_id],
      )).rows[0];
      assert.equal(soruInceleme.durum, "inceleme_bekliyor");
      await client.query(
        "SELECT public.uretim_uretici_karar_ver($1,$2,$3,$4,$5,$6)",
        [soruGorevi.gorev_id, aday.uretici_id, "onaylandi", null, randomUUID(), soruInceleme.surum],
      );
      const zincirSonu = (await client.query(`
        SELECT
          g.durum AS gorev_durumu,
          EXISTS(SELECT 1 FROM public.soru_seti_durumu d
                 WHERE d.soru_seti_id=g.soru_seti_id AND d.durum='onaylandi') AS soru_onaylandi,
          EXISTS(SELECT 1 FROM public.ogrenme_araci_durumu d
                 WHERE d.arac_id=$2 AND d.durum='onaylandi') AS arac_onaylandi
        FROM public.uretim_gorevleri g WHERE g.gorev_id=$1
      `, [soruGorevi.gorev_id, aracKaydi.arac_id])).rows[0];
      assert.deepEqual(zincirSonu, {
        gorev_durumu: "tamamlandi",
        soru_onaylandi: true,
        arac_onaylandi: true,
      });
      } else {
        const hazirZincir = (await client.query(`
          SELECT
            EXISTS(SELECT 1 FROM public.uretim_gorevleri
                   WHERE talep_id=$1 AND asama='soru_seti') AS soru_gorevi_var,
            EXISTS(SELECT 1 FROM public.soru_setleri s
                   JOIN public.soru_seti_durumu d USING(soru_seti_id)
                   WHERE s.talep_id=$1 AND s.kaynak='hazir' AND d.durum='onaylandi') AS hazir_soru_onaylandi,
            EXISTS(SELECT 1 FROM public.ogrenme_araci_durumu
                   WHERE arac_id=$2 AND durum='onaylandi') AS arac_onaylandi
        `, [talepSonucu.talep_id, aracKaydi.arac_id])).rows[0];
        assert.deepEqual(hazirZincir, {
          soru_gorevi_var: false,
          hazir_soru_onaylandi: true,
          arac_onaylandi: true,
        });
      }

      sonuclar.push({
        arac: arac.tur,
        varyant: hazirSoru ? "V3" : "V1",
        eskiSurumReddedildi: true,
        baskaUreticiReddedildi: true,
        revizyonGecisiDogrulandi: true,
        idempotencyDogrulandi: true,
        onayVeSonrakiGorevDogrulandi: true,
        aracTeslimiVeSoruGoreviDogrulandi: true,
        soruTeslimiVeYayinHazirligiDogrulandi: true,
      });
      console.log(JSON.stringify(sonuclar.at(-1)));
      await client.query("ROLLBACK TO SAVEPOINT arac_testi");
      await client.query("RELEASE SAVEPOINT arac_testi");
      }
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
