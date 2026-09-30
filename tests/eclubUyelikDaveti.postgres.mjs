// HAPBILGI_PGLITE_ROOT=/tmp/hapbilgi-odul-pgtest node tests/eclubUyelikDaveti.postgres.mjs
// Canlı DB kullanmaz; yerel PostgreSQL ile davet yarışlarını ve yetkileri doğrular.
import { createRequire } from "node:module";
import { resolve } from "node:path";
if (!process.env.HAPBILGI_PGLITE_ROOT) throw new Error("HAPBILGI_PGLITE_ROOT gerekli.");
const require = createRequire(resolve(process.env.HAPBILGI_PGLITE_ROOT, "package.json"));
const { PGlite } = require("@electric-sql/pglite");
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const db=new PGlite();
await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, raw_app_meta_data jsonb); CREATE TABLE public.eclub_kisiler(kisi_id uuid PRIMARY KEY,auth_user_id uuid);');
await db.exec(readFileSync('scripts/sql/eclub_uyelik_daveti.sql','utf8'));
const auth='10000000-0000-4000-8000-000000000001', a='a'.repeat(64),b='b'.repeat(64),lease='20000000-0000-4000-8000-000000000001';
await db.query('INSERT INTO auth.users(id) VALUES($1)',[auth]);
// Hazır hesap değişmez; bekleyen hesapta davet satırı atomik oluşur.
await db.query('INSERT INTO eclub_kisiler VALUES($1,$1)',[auth]);
assert.equal((await db.query('SELECT * FROM eclub_uyelik_davetleri')).rows.length,0);
await db.query("UPDATE auth.users SET email='test@example.invalid',raw_app_meta_data='{\"eclub_davet_bekliyor\":true}'::jsonb WHERE id=$1",[auth]);
await db.query('UPDATE eclub_kisiler SET auth_user_id=$1 WHERE kisi_id=$1',[auth]);
assert.equal((await db.query('SELECT * FROM eclub_uyelik_davetleri')).rows.length,1);
await db.query('SELECT eclub_davet_yenile($1,$2,$3)',[auth,a,'test@example.invalid']);
assert.equal((await db.query('SELECT * FROM eclub_davet_islem_al($1,$2)',[a,lease])).rows.length,1);
assert.equal((await db.query('SELECT * FROM eclub_davet_islem_al($1,$2)',[a,lease])).rows.length,0);
await assert.rejects(db.query('SELECT eclub_davet_yenile($1,$2,$3)',[auth,b,'test@example.invalid']));
assert.equal((await db.query('SELECT eclub_davet_islem_bitir($1,$2,false) AS ok',[auth,lease])).rows[0].ok,true);
await db.query('SELECT eclub_davet_yenile($1,$2,$3)',[auth,b,'test@example.invalid']);
assert.equal((await db.query('SELECT * FROM eclub_davet_islem_al($1,$2)',[a,lease])).rows.length,0);
await db.query("UPDATE eclub_uyelik_davetleri SET sona_erme=now()-interval '1 second'");
assert.equal((await db.query('SELECT * FROM eclub_davet_islem_al($1,$2)',[b,lease])).rows.length,0);
await db.query("UPDATE eclub_uyelik_davetleri SET sona_erme=now()+interval '1 hour'");
assert.equal((await db.query('SELECT * FROM eclub_davet_islem_al($1,$2)',[b,lease])).rows.length,1);
assert.equal((await db.query('SELECT eclub_davet_islem_bitir($1,$2,true) AS ok',[auth,lease])).rows[0].ok,true);
assert.equal((await db.query('SELECT * FROM eclub_davet_islem_al($1,$2)',[b,lease])).rows.length,0);
await assert.rejects(db.query('SELECT eclub_davet_yenile($1,$2,$3)',[auth,a,'test@example.invalid']));
await db.exec('SET ROLE authenticated');
await assert.rejects(db.query('SELECT * FROM eclub_uyelik_davetleri'));
await assert.rejects(db.query('SELECT eclub_davet_yenile($1,$2,$3)',[auth,a,'test@example.invalid']));
console.log('SQL: claim yarışı, eski/süresi dolan token, tekrar kullanım ve rol erişimi kontrolleri başarılı.');
await db.close();
