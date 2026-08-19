// scripts/backfill-video-suresi.mjs
//
// Faz 2 — tek seferlik backfill: video_suresi_saniye'si NULL olan (encode'u yayın
// anında bitmemiş / eski) videolar için süreyi Bunny'den çekip doldurur.
//
// GÜVENLİ: dry-run varsayılan (yalnız NE OLURDU'yu listeler, yazmaz).
//   node scripts/backfill-video-suresi.mjs            → dry-run (yazmaz)
//   node scripts/backfill-video-suresi.mjs --apply    → gerçekten yazar
//
// İdempotent: yalnız süresi NULL/0 olanlara dokunur; Bunny hazır değilse atlar.
// DB yazımı Kural 5 gereği İskender tarafından çalıştırılır (--apply).

import { createRequire } from "module";
import { readFileSync } from "fs";

const KOK = "/Users/iskendereser/Desktop/hapbilgi";
const require = createRequire(KOK + "/package.json");
const { Client } = require("pg");

const env = readFileSync(KOK + "/.env.local", "utf8");
const oku = (k) => (env.match(new RegExp("^" + k + "=(.*)$", "m")) || [])[1]?.trim().replace(/^["']|["']$/g, "");
const DB = oku("DATABASE_URL");
const LIB = oku("BUNNY_LIBRARY_ID");
const KEY = oku("BUNNY_API_KEY");
const APPLY = process.argv.includes("--apply");

if (!DB || !LIB || !KEY) {
  console.error("Eksik env: DATABASE_URL / BUNNY_LIBRARY_ID / BUNNY_API_KEY");
  process.exit(1);
}

function guidCikar(url) {
  if (!url) return null;
  const temiz = url.split("?")[0].split("#")[0];
  const son = temiz.split("/").filter(Boolean).pop();
  return son || null;
}

async function bunnySure(guid) {
  try {
    const r = await fetch(`https://video.bunnycdn.com/library/${LIB}/videos/${guid}`, { headers: { AccessKey: KEY } });
    if (!r.ok) return { ok: false, sebep: `HTTP ${r.status}` };
    const v = await r.json();
    const status = typeof v?.status === "number" ? v.status : -1;
    const length = (typeof v?.length === "number" && Number.isInteger(v.length) && v.length > 0) ? v.length : null;
    return { ok: true, hazir: status === 4, status, length };
  } catch (e) {
    return { ok: false, sebep: e?.message ?? String(e) };
  }
}

const client = new Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await client.connect();

const { rows } = await client.query(
  `SELECT video_id, video_url FROM videolar
   WHERE (video_suresi_saniye IS NULL OR video_suresi_saniye <= 0) AND video_url IS NOT NULL`,
);

console.log(`\nSüresi boş video: ${rows.length}  |  mod: ${APPLY ? "APPLY (yazar)" : "DRY-RUN (yazmaz)"}\n`);

let yazilacak = 0, yazildi = 0, hazirDegil = 0, hata = 0;
for (const r of rows) {
  const guid = guidCikar(r.video_url);
  if (!guid) { console.log(`- ${r.video_id}  GUID çıkmadı (${r.video_url})`); hata++; continue; }
  const d = await bunnySure(guid);
  if (!d.ok) { console.log(`- ${r.video_id}  Bunny hata: ${d.sebep}`); hata++; continue; }
  if (!d.hazir || d.length == null) { console.log(`- ${r.video_id}  hazır değil (status=${d.status}) → atlandı`); hazirDegil++; continue; }
  yazilacak++;
  if (APPLY) {
    await client.query(`UPDATE videolar SET video_suresi_saniye = $1 WHERE video_id = $2`, [d.length, r.video_id]);
    yazildi++;
    console.log(`✓ ${r.video_id}  süre=${d.length} YAZILDI`);
  } else {
    console.log(`~ ${r.video_id}  süre=${d.length} (yazılacaktı)`);
  }
}

console.log(`\nÖzet: doldurulabilir=${yazilacak}  ${APPLY ? `yazıldı=${yazildi}` : "(dry-run)"}  hazır-değil=${hazirDegil}  hata=${hata}\n`);
await client.end();
