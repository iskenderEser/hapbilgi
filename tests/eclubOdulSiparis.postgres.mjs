// Canlı DB kullanmaz. Yerel WASM PostgreSQL ile gerçek SQL/RPC testi.
// npm install --prefix /tmp/hapbilgi-pgtest --no-save @electric-sql/pglite
// HAPBILGI_PGLITE_ROOT=/tmp/hapbilgi-pgtest node tests/eclubOdulSiparis.postgres.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";

if (!process.env.HAPBILGI_PGLITE_ROOT) throw new Error("Yerel PGlite paket klasörünü HAPBILGI_PGLITE_ROOT ile belirtin.");
const require = createRequire(resolve(process.env.HAPBILGI_PGLITE_ROOT, "package.json"));
const { PGlite } = require("@electric-sql/pglite");
const db = new PGlite();
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const sql = (path) => readFile(path, "utf8");
const run = (s, params = []) => db.query(s, params);
let kontroller = 0;
const kontrol = (v) => { assert.ok(v); kontroller++; };
const reddet = async (s, params, desen) => { await assert.rejects(run(s, params), desen); kontroller++; };

try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE firmalar (firma_id uuid PRIMARY KEY, firma_adi text, eclub_aktif boolean DEFAULT true, eclub_store_aktif boolean DEFAULT true);
    CREATE TABLE kullanicilar (kullanici_id uuid PRIMARY KEY, firma_id uuid REFERENCES firmalar, ad text, soyad text, rol text, aktif_mi boolean DEFAULT true);
    CREATE TABLE eclub_eczane_master (gln text PRIMARY KEY, onay_durumu text);
    CREATE TABLE eclub_eczaneler (eczane_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), gln text UNIQUE REFERENCES eclub_eczane_master);
    CREATE TABLE eclub_eczane_firma (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), eczane_id uuid REFERENCES eclub_eczaneler, firma_id uuid REFERENCES firmalar, baglayan_utt_id uuid, aktif_mi boolean DEFAULT true, created_at timestamptz DEFAULT now());
    CREATE TABLE eclub_utt_eczane (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), eczane_firma_id uuid REFERENCES eclub_eczane_firma, utt_id uuid, aktif_mi boolean DEFAULT true, created_at timestamptz DEFAULT now(), bitis_tarihi timestamptz);
    CREATE TABLE eclub_kisiler (kisi_id uuid PRIMARY KEY, auth_user_id uuid, ad text, soyad text, rol text, eposta text);
    CREATE TABLE eclub_kisi_eczane (kisi_id uuid REFERENCES eclub_kisiler, eczane_id uuid REFERENCES eclub_eczaneler, aktif_mi boolean DEFAULT true);
    CREATE TABLE urunler (urun_id uuid PRIMARY KEY, urun_adi text);
    CREATE TABLE v_yayin_kunye (yayin_id uuid PRIMARY KEY, urun_id uuid REFERENCES urunler);
    CREATE TABLE sistem_ayarlari (anahtar text PRIMARY KEY, deger jsonb, aciklama text);
    CREATE TABLE eclub_store_cek_talepleri (
      talep_id uuid PRIMARY KEY, eczane_id uuid REFERENCES eclub_eczaneler, firma_id uuid REFERENCES firmalar,
      yayin_id uuid REFERENCES v_yayin_kunye, talep_eden_kisi_id uuid REFERENCES eclub_kisiler,
      siparis_verildi_mi boolean NOT NULL, siparis_adet integer, siparis_mal_fazlasi integer,
      durum text DEFAULT 'beklemede', utt_id uuid REFERENCES kullanicilar, tm_id uuid, tm_onay_tarihi timestamptz,
      cek_kodu text, cek_gonderim_tarihi timestamptz, talep_edilen_cek_tl numeric,
      created_at timestamptz DEFAULT now(), guncellenme_at timestamptz DEFAULT now()
    );
    CREATE TABLE eclub_bildirimler (bildirim_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), alici_kisi_id uuid REFERENCES eclub_kisiler, gonderen_id uuid REFERENCES kullanicilar, kayit_turu text, kayit_id uuid, mesaj text, goruldu_mu boolean, created_at timestamptz DEFAULT now());
  `);
  const bind = await sql("scripts/sql/eclub_utt_eczane_uyeligi.sql");
  await db.exec(bind.slice(bind.indexOf("CREATE OR REPLACE FUNCTION public.eclub_utt_eczaneye_bagla"), bind.indexOf("CREATE OR REPLACE FUNCTION public.eclub_utt_eczaneden_cikar")));
  for (const path of ["scripts/sql/ecza_depo_katalogu_sema.sql", "scripts/sql/ecza_depo_katalogu_veri_20260929.sql", "scripts/sql/eclub_cek_teslimat_outbox.sql", "scripts/sql/eclub_cek_eposta_worker.sql", "scripts/sql/eclub_cek_push_worker.sql", "scripts/sql/eclub_cek_uygulama_bildirimleri.sql", "scripts/sql/eclub_odul_siparis_takibi.sql"]) await db.exec(await sql(path));
  kontrol((await run("SELECT count(*)::int AS n FROM ecza_depo_subeleri")).rows[0].n === 585);
  // Tekrar uygulanabilirlik, aynı katalog/migrasyon aynı veriyi korur.
  await db.exec(await sql("scripts/sql/eclub_odul_siparis_takibi.sql"));
  await run("INSERT INTO firmalar VALUES ($1,'Firma A',true,true),($2,'Firma B',true,true)",[uuid(1),uuid(2)]);
  await run("INSERT INTO kullanicilar VALUES ($1,$2,'Ali','Temsilci','utt',true),($3,$2,'Başka','UTT','utt',true),($4,$5,'Diğer','Firma','utt',true),($6,$2,'Bölge','Müdürü','bm',true),($7,$2,'Takım','Müdürü','tm',true),($8,$2,'Admin','HapBilgi','admin',true)",[uuid(11),uuid(1),uuid(12),uuid(13),uuid(2),uuid(14),uuid(15),uuid(16)]);
  await run("INSERT INTO eclub_eczane_master VALUES ('1111111111111','onayli'),('2222222222222','onayli')");
  const uygunlar = (await run("SELECT depo_sube_id FROM ecza_depo_subeleri WHERE eclub_depo_konumu_uygun(depo_sube_id) LIMIT 4")).rows.map((x) => x.depo_sube_id);
  kontrol(uygunlar.length === 4);
  const bagla = "SELECT eclub_utt_eczaneye_depolar_ile_bagla($1,$2,$3::uuid[]) AS b";
  await reddet(bagla,[uuid(11),'1111111111111',[]],/En az 1/);
  kontrol((await run("SELECT count(*)::int AS n FROM eclub_eczaneler")).rows[0].n === 0);
  const eczane = (await run(bagla,[uuid(11),'1111111111111',uygunlar.slice(0,2)])).rows[0].b.eczane_id;
  await run(bagla,[uuid(13),'1111111111111',uygunlar.slice(0,2)]);
  kontrol((await run("SELECT count(*)::int AS n FROM eclub_eczane_depo_tercihleri WHERE eczane_id=$1",[eczane])).rows[0].n === 2);
  const tercih = "SELECT eclub_depo_tercihlerini_kaydet($1,$2,$3::uuid[])";
  await reddet(tercih,[uuid(12),eczane,uygunlar.slice(0,1)],/yetkiniz yok/);
  await reddet(tercih,[uuid(11),eczane,uygunlar],/En az 1/);
  await reddet(tercih,[uuid(11),eczane,[uygunlar[0],uygunlar[0]]],/En az 1/);
  const adsizSubeli = (await run("SELECT s.depo_sube_id FROM ecza_depo_subeleri s WHERE s.sube_adi IS NULL AND EXISTS (SELECT 1 FROM ecza_depo_subeleri x WHERE x.depo_id=s.depo_id AND x.sube_adi IS NOT NULL) LIMIT 1")).rows[0].depo_sube_id;
  await reddet(tercih,[uuid(11),eczane,[adsizSubeli]],/konum belirsiz/);
  await run("INSERT INTO eclub_kisiler VALUES ($1,$2,'Ayşe','Eczacı','eczaci','eczaci@example.test'),($3,$4,'Teknisyen','Kişi','eczane_teknisyeni','tek@example.test')",[uuid(21),uuid(121),uuid(22),uuid(122)]);
  await run("INSERT INTO eclub_kisi_eczane VALUES ($1,$2,true),($3,$2,true)",[uuid(21),eczane,uuid(22)]);
  await run("INSERT INTO urunler VALUES ($1,'Örnek Ürün & Test')",[uuid(31)]);
  await run("INSERT INTO v_yayin_kunye VALUES ($1,$2)",[uuid(32),uuid(31)]);
  const insert = "INSERT INTO eclub_store_cek_talepleri (talep_id,eczane_id,firma_id,yayin_id,talep_eden_kisi_id,siparis_verildi_mi,siparis_adet,siparis_mal_fazlasi,utt_id,durum,tm_id,tm_onay_tarihi,talep_edilen_cek_tl) VALUES ($1,$2,$3,$4,$5,$6,10,2,$7,'onaylandi',$8,now(),500)";
  const params = (id, siparis = true) => [uuid(id),eczane,uuid(1),uuid(32),uuid(21),siparis,uuid(11),uuid(15)];
  await run("DELETE FROM eclub_eczane_depo_tercihleri WHERE eczane_id=$1",[eczane]);
  await reddet(insert,params(40),/Depo tercihlerinizi/);
  await reddet("INSERT INTO eclub_kisi_eczane VALUES ($1,$2,true)",[uuid(21),eczane],/Eczacı kaydından önce/);
  await run(insert,params(40,false));
  await run(tercih,[uuid(11),eczane,uygunlar.slice(0,2)]);
  await run(insert,params(41)); await run(insert,params(42,false));
  const teslim = "SELECT * FROM eclub_store_admin_kod_teslim($1,$2,$3)";
  await reddet(teslim,[uuid(16),uuid(41),'TEST-CEK-KODU'],/Okundu olmadan/);
  kontrol((await run("SELECT count(*)::int AS n FROM eclub_cek_teslimat_outbox")).rows[0].n === 0);
  const oku = "SELECT eclub_odul_siparis_oku($1,$2,$3)";
  await run(insert,params(43));
  await run("UPDATE eclub_store_cek_talepleri SET durum='iptal' WHERE talep_id=$1",[uuid(43)]);
  await reddet(oku,[uuid(11),uuid(43),uygunlar[0]],/iptal edilmiş/);
  for (const aktor of [uuid(12),uuid(13),uuid(14),uuid(15)]) await reddet(oku,[aktor,uuid(41),uygunlar[0]],/yetkiniz yok/);
  await reddet(oku,[uuid(11),uuid(41),uygunlar[3]],/kayıtlı aktif/);
  await reddet(oku,[uuid(11),uuid(42),uygunlar[0]],/Siparişsiz/);
  await run(oku,[uuid(11),uuid(41),uygunlar[0]]);
  await run(oku,[uuid(11),uuid(41),uygunlar[0]]);
  await reddet(oku,[uuid(11),uuid(41),uygunlar[1]],/değiştirilemez/);
  kontrol((await run("SELECT count(*)::int AS n FROM eclub_odul_siparis_outbox")).rows[0].n === 2);
  kontrol((await run("SELECT count(*)::int AS n FROM eclub_bildirimler WHERE kayit_turu='odul_siparis'")).rows[0].n === 1);
  const bildirim = (await run("SELECT mesaj FROM eclub_bildirimler WHERE kayit_turu='odul_siparis'")).rows[0].mesaj;
  kontrol(bildirim.includes('10 adet + 2 mal fazlası') && bildirim.includes('Örnek Ürün & Test') && bildirim.includes('Ali Temsilci'));
  await run(tercih,[uuid(13),eczane,[uygunlar[1]]]);
  kontrol((await run("SELECT depo_sube_id FROM eclub_store_cek_talepleri WHERE talep_id=$1",[uuid(41)])).rows[0].depo_sube_id === uygunlar[0]);
  await run(teslim,[uuid(16),uuid(41),'TEST-CEK-KODU']);
  await run(teslim,[uuid(16),uuid(42),'SIPARISSIZ-CEK']);
  // Eski çek teslimat kuralı: her talep için 1 e-posta + 2 çalışan push'u.
  kontrol((await run("SELECT count(*)::int AS n FROM eclub_cek_teslimat_outbox")).rows[0].n === 6);
  const is = (await run("SELECT eclub_odul_siparis_isi_al('eposta') AS i")).rows[0].i;
  kontrol(is.alici_auth_user_id === uuid(121));
  const bitir = "SELECT eclub_odul_siparis_isi_bitir($1,$2,$3) AS ok";
  kontrol((await run(bitir,[is.outbox_id,uuid(999),null])).rows[0].ok === false);
  await run(bitir,[is.outbox_id,is.claim_token,'TEST_HATA']);
  await run("UPDATE eclub_odul_siparis_outbox SET sonraki_deneme_at=now() WHERE outbox_id=$1",[is.outbox_id]);
  const tekrarIs = (await run("SELECT eclub_odul_siparis_isi_al('eposta') AS i")).rows[0].i;
  kontrol(tekrarIs.claim_token !== is.claim_token);
  kontrol((await run(bitir,[is.outbox_id,is.claim_token,null])).rows[0].ok === false);
  await run(bitir,[tekrarIs.outbox_id,tekrarIs.claim_token,null]);
  kontrol((await run("SELECT durum FROM eclub_store_cek_talepleri WHERE talep_id=$1",[uuid(41)])).rows[0].durum === 'teslimat_bekliyor');
  await run("UPDATE eclub_kisi_eczane SET aktif_mi=false WHERE kisi_id=$1",[uuid(21)]);
  const push = (await run("SELECT eclub_odul_siparis_isi_al('push') AS i")).rows[0].i;
  kontrol(push.alici_auth_user_id === null);
  await run("UPDATE eclub_odul_siparis_outbox SET deneme_sayisi=max_deneme, lease_bitis=now()-interval '1 second' WHERE outbox_id=$1",[push.outbox_id]);
  kontrol((await run("SELECT eclub_odul_siparis_isi_al('push') AS i")).rows[0].i === null);
  const tukendi = (await run("SELECT durum,son_hata_kodu FROM eclub_odul_siparis_outbox WHERE outbox_id=$1",[push.outbox_id])).rows[0];
  kontrol(tukendi.durum === 'basarisiz' && tukendi.son_hata_kodu === 'LEASE_DENEME_TUKENDI');
  kontrol((await run(bitir,[push.outbox_id,push.claim_token,null])).rows[0].ok === false);
  kontrol((await run("SELECT has_function_privilege('authenticated','eclub_odul_siparis_oku(uuid,uuid,uuid)','EXECUTE') AS izin")).rows[0].izin === false);
  console.log(`Yerel PostgreSQL: ${kontroller} kontrol geçti; canlı DB kullanılmadı.`);
} finally { await db.close(); }
