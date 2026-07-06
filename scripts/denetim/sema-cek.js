// scripts/denetim/sema-cek.js
//
// HapBilgi şema anlık görüntüsü (snapshot) üretici.
// DB'ye bağlanıp information_schema + pg_catalog'dan tablo/view/kolon/RPC/FK
// bilgisini çeker, scripts/denetim/sema.json'a yazar.
//
// Kullanım:  node scripts/denetim/sema-cek.js
// Gereksinim: .env.local içinde DATABASE_URL
//
// Bu snapshot, kod↔DB tutarlılık denetleyicisinin (denetle.js) referansıdır.
// DB şeması değişince yeniden çalıştırılır.

require("dotenv").config({ path: ".env.local" });
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("HATA: .env.local içinde DATABASE_URL tanımlı değil.");
    process.exit(1);
  }

  const client = new Client({ connectionString });
  await client.connect();

  // ─── 1. Tablolar + view'lar → kolonlar ───────────────────────────────────
  // information_schema.columns hem tabloları hem view'ları kapsar.
  // Yalnızca 'public' şeması (Supabase uygulama tabloları).
  const kolonSorgu = `
    SELECT
      c.table_name,
      c.column_name,
      c.data_type,
      c.is_nullable,
      t.table_type
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema
     AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
    ORDER BY c.table_name, c.ordinal_position;
  `;
  const kolonlar = (await client.query(kolonSorgu)).rows;

  // ─── 2. Public RPC'ler → parametreler ────────────────────────────────────
  // pg_proc + pg_namespace; yalnızca 'public' şeması, yalnızca fonksiyonlar.
  const rpcSorgu = `
    SELECT
      p.proname AS fonksiyon_adi,
      pg_get_function_identity_arguments(p.oid) AS argumanlar,
      pg_get_function_result(p.oid) AS donus_tipi
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
    ORDER BY p.proname;
  `;
  const rpcler = (await client.query(rpcSorgu)).rows;

  // ─── 3. Foreign key ilişkileri (embed doğrulaması için) ──────────────────
  // PostgREST embed'i FK üzerinden çalışır; kaynak tablo → hedef tablo eşlemesi.
  const fkSorgu = `
    SELECT
      tc.constraint_name,
      kcu.table_name  AS kaynak_tablo,
      kcu.column_name AS kaynak_kolon,
      ccu.table_name  AS hedef_tablo,
      ccu.column_name AS hedef_kolon
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
     AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
    ORDER BY kcu.table_name, ccu.table_name;
  `;
  const fkler = (await client.query(fkSorgu)).rows;

  await client.end();

  // ─── sema.json yapısını kur ──────────────────────────────────────────────
  // tablolar: { tablo_adi: { tur: 'BASE TABLE'|'VIEW', kolonlar: { kolon: {tip, nullable} } } }
  const tablolar = {};
  for (const r of kolonlar) {
    if (!tablolar[r.table_name]) {
      tablolar[r.table_name] = { tur: r.table_type, kolonlar: {} };
    }
    tablolar[r.table_name].kolonlar[r.column_name] = {
      tip: r.data_type,
      nullable: r.is_nullable === "YES",
    };
  }

  // rpc: { fonksiyon_adi: { argumanlar, donus } }
  const rpc = {};
  for (const r of rpcler) {
    // Aynı ada sahip overload varsa dizi olarak tut
    if (rpc[r.fonksiyon_adi]) {
      if (!Array.isArray(rpc[r.fonksiyon_adi])) {
        rpc[r.fonksiyon_adi] = [rpc[r.fonksiyon_adi]];
      }
      rpc[r.fonksiyon_adi].push({ argumanlar: r.argumanlar, donus: r.donus_tipi });
    } else {
      rpc[r.fonksiyon_adi] = { argumanlar: r.argumanlar, donus: r.donus_tipi };
    }
  }

  // fk: { kaynak_tablo: [ { kaynak_kolon, hedef_tablo, hedef_kolon } ] }
  const fk = {};
  for (const r of fkler) {
    if (!fk[r.kaynak_tablo]) fk[r.kaynak_tablo] = [];
    fk[r.kaynak_tablo].push({
      kaynak_kolon: r.kaynak_kolon,
      hedef_tablo: r.hedef_tablo,
      hedef_kolon: r.hedef_kolon,
    });
  }

  const sema = {
    uretim_tarihi: new Date().toISOString(),
    tablo_sayisi: Object.keys(tablolar).length,
    rpc_sayisi: Object.keys(rpc).length,
    tablolar,
    rpc,
    fk,
  };

  const cikisDizin = path.join(__dirname);
  const cikisYol = path.join(cikisDizin, "sema.json");
  fs.writeFileSync(cikisYol, JSON.stringify(sema, null, 2), "utf8");

  console.log("sema.json yazıldı:", cikisYol);
  console.log("  Tablo/view:", sema.tablo_sayisi);
  console.log("  RPC:", sema.rpc_sayisi);
  console.log("  FK ilişkisi olan tablo:", Object.keys(fk).length);
}

main().catch((err) => {
  console.error("HATA:", err.message);
  process.exit(1);
});
