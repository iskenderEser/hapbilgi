require("dotenv").config({ path: ".env.local" });
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { Client } = require("pg");

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  let sonuc;
  try {
    await client.query("BEGIN");

    const aday = (await client.query(`
      SELECT k.kullanici_id,k.firma_id,i.izleme_id,i.yayin_id
      FROM public.kullanicilar k
      JOIN public.firmalar f ON f.firma_id=k.firma_id AND f.hbstore_aktif=true
      JOIN LATERAL (
        SELECT izleme_id,yayin_id FROM public.cc_izleme_kayitlari
        WHERE bm_id=k.kullanici_id ORDER BY created_at DESC LIMIT 1
      ) i ON true
      WHERE k.rol='bm' AND k.aktif_mi=true
      ORDER BY public.get_harcama_bakiyesi(k.kullanici_id) DESC
      LIMIT 1
    `)).rows[0];
    assert.ok(aday, "Aktif HBStore BM ve geçerli izleme kaydı bulunamadı.");

    const urun = (await client.query(`
      SELECT u.urun_id
      FROM public.store_urunler u
      LEFT JOIN public.store_urun_firma_ayarlari a
        ON a.urun_id=u.urun_id AND a.firma_id=$1
      WHERE u.aktif_mi=true AND u.stok>=2 AND COALESCE(a.aktif_mi,true)=true
      ORDER BY u.stok DESC LIMIT 1
      FOR UPDATE OF u
    `, [aday.firma_id])).rows[0];
    assert.ok(urun, "Teste uygun aktif ve stoklu HBStore ürünü bulunamadı.");

    const bakiye = async () => Number((await client.query(
      "SELECT public.get_harcama_bakiyesi($1) AS bakiye", [aday.kullanici_id]
    )).rows[0].bakiye);
    const ilkBakiye = await bakiye();

    await client.query(`
      INSERT INTO public.cc_kazanilan_puanlar
        (puan_id,bm_id,yayin_id,puan_turu,puan,izleme_id,created_at)
      VALUES ($1,$2,$3,'cevaplama',777,$4,date_trunc('quarter',clock_timestamp())-interval '1 second')
    `, [randomUUID(), aday.kullanici_id, aday.yayin_id, aday.izleme_id]);
    assert.equal(await bakiye(), ilkBakiye, "Önceki çeyrek puanı güncel bakiyeye katıldı.");

    await client.query(`
      INSERT INTO public.cc_kazanilan_puanlar
        (puan_id,bm_id,yayin_id,puan_turu,puan,izleme_id,created_at)
      VALUES ($1,$2,$3,'cevaplama',10000,$4,clock_timestamp())
    `, [randomUUID(), aday.kullanici_id, aday.yayin_id, aday.izleme_id]);

    const atlama = (await client.query(`
      SELECT COALESCE(MAX(atlama_bitis),0)+1000 AS baslangic
      FROM public.cc_ileri_sarma_kayitlari WHERE izleme_id=$1
    `, [aday.izleme_id])).rows[0];
    await client.query(`
      INSERT INTO public.cc_ileri_sarma_kayitlari
        (kayit_id,bm_id,yayin_id,izleme_id,atlama_baslangic,atlama_bitis,atlanan_sure,kaybedilen_puan,created_at)
      VALUES ($1,$2,$3,$4,$5,$5+1,1,7,clock_timestamp())
    `, [randomUUID(), aday.kullanici_id, aday.yayin_id, aday.izleme_id, Number(atlama.baslangic)]);

    const ayarliBakiye = await bakiye();
    assert.equal(ayarliBakiye, ilkBakiye + 9993, "BM C-Club kazanç/kayıp hesabı yanlış.");

    const fiyat = Math.floor(ayarliBakiye / 2) + 1;
    assert.ok(fiyat > 0, "Sipariş testi için pozitif bakiye oluşmadı.");
    await client.query("UPDATE public.store_urunler SET puan_fiyati=$1,stok=GREATEST(stok,2) WHERE urun_id=$2", [fiyat, urun.urun_id]);

    const adresId = randomUUID();
    await client.query(`
      INSERT INTO public.store_adresler
        (adres_id,kullanici_id,baslik,alici_adi,telefon,il,ilce,adres_detay,varsayilan_mi,created_at)
      VALUES ($1,$2,'Faz 6 test','Faz 6 Test','0000000000','İstanbul','Test','Rollback adresi',false,clock_timestamp())
    `, [adresId, aday.kullanici_id]);

    const birinci = (await client.query(
      "SELECT * FROM public.store_siparis_olustur($1,$2,$3,1)",
      [aday.kullanici_id, urun.urun_id, adresId]
    )).rows[0];
    assert.equal(birinci.ok, true, birinci.hata || "İlk sipariş reddedildi.");
    assert.equal(await bakiye(), ayarliBakiye - fiyat, "İlk sipariş bakiyeden doğru düşmedi.");

    const ikinci = (await client.query(
      "SELECT * FROM public.store_siparis_olustur($1,$2,$3,1)",
      [aday.kullanici_id, urun.urun_id, adresId]
    )).rows[0];
    assert.equal(ikinci.ok, false, "Yetersiz bakiyeli ikinci sipariş kabul edildi.");

    const iptal = (await client.query(
      "SELECT * FROM public.store_siparis_iptal($1,$2,false,'Faz 6 rollback testi')",
      [birinci.siparis_id, aday.kullanici_id]
    )).rows[0];
    assert.equal(iptal.ok, true, iptal.hata || "Test siparişi iptal edilemedi.");
    assert.equal(await bakiye(), ayarliBakiye, "İptal/iade bakiyeyi geri yüklemedi.");

    const govde = (await client.query(`
      SELECT pg_get_functiondef('public.store_siparis_olustur_cekirdek(uuid,uuid,uuid,integer)'::regprocedure) AS tanim
    `)).rows[0].tanim;
    assert.match(govde, /FOR UPDATE|pg_advisory_xact_lock/i, "Sipariş çekirdeğinde eşzamanlılık kilidi bulunamadı.");

    sonuc = { ilkBakiye, ayarliBakiye, fiyat, ikinciReddedildi: true, iadeDogrulandi: true, kilitDogrulandi: true };
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    await client.end();
  }
  process.stdout.write(`${JSON.stringify(sonuc)}\n`);
}

main().catch((hata) => {
  console.error(hata instanceof Error ? hata.message : hata);
  process.exitCode = 1;
});
