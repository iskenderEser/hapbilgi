// scripts/denetim/tutarlilik/calistir.js
//
// Veri tutarlılığı denetleyicisi (teknik kalite kontrol planı Q4 çıktısı).
// Bu klasördeki td*.sql dosyalarını canlı DB'de SALT-OKUMA oturumla koşar;
// her sorgu İHLAL SATIRI döndürür — boş dönüş temiz demektir.
//
// Kullanım:  npm run denetim:tutarlilik   (= node scripts/denetim/tutarlilik/calistir.js)
// Gereksinim: .env.local içinde DATABASE_URL
//
// Güvence: oturum "default_transaction_read_only = on" ile açılır; yazan tek
// satır SQL bu koşucudan geçemez (D1 kararı).

require("dotenv").config({ path: ".env.local" });
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const ORNEK_SATIR_LIMITI = 5;

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("HATA: .env.local içinde DATABASE_URL tanımlı değil.");
    process.exit(1);
  }

  const dosyalar = fs
    .readdirSync(__dirname)
    .filter((d) => d.startsWith("td") && d.endsWith(".sql"))
    .sort();

  const client = new Client({ connectionString });
  await client.connect();
  await client.query("SET default_transaction_read_only = on;");
  await client.query("SET statement_timeout = '60s';");

  let toplamIhlal = 0;
  let hataliDosya = 0;

  for (const dosya of dosyalar) {
    const sql = fs.readFileSync(path.join(__dirname, dosya), "utf8");
    try {
      const sonuc = await client.query(sql);
      // Çok-ifadeli dosyalarda pg dizi döner; teke sar.
      const parcalar = Array.isArray(sonuc) ? sonuc : [sonuc];
      const ihlaller = parcalar.flatMap((p) => p.rows ?? []);

      if (ihlaller.length === 0) {
        console.log(`✓ ${dosya} temiz`);
      } else {
        toplamIhlal += ihlaller.length;
        console.log(`✗ ${dosya}: ${ihlaller.length} ihlal`);
        for (const satir of ihlaller.slice(0, ORNEK_SATIR_LIMITI)) {
          console.log(`    ${JSON.stringify(satir)}`);
        }
        if (ihlaller.length > ORNEK_SATIR_LIMITI) {
          console.log(`    ... (${ihlaller.length - ORNEK_SATIR_LIMITI} satır daha)`);
        }
      }
    } catch (e) {
      hataliDosya++;
      console.error(`! ${dosya} ÇALIŞTIRILAMADI: ${e.message}`);
    }
  }

  await client.end();

  if (hataliDosya > 0) {
    console.error(`\nSONUÇ: ${hataliDosya} sorgu çalıştırılamadı — denetim eksik.`);
    process.exit(1);
  }
  if (toplamIhlal > 0) {
    console.error(`\nSONUÇ: toplam ${toplamIhlal} tutarlılık ihlali bulundu.`);
    process.exit(1);
  }
  console.log(`\nSONUÇ: ${dosyalar.length} denetim koşuldu, ihlal yok.`);
}

main().catch((e) => {
  console.error("HATA:", e.message);
  process.exit(1);
});
