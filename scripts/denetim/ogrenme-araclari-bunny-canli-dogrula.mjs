import { createHash, createHmac, randomUUID } from "node:crypto";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const gerekli = [
  "BUNNY_LEARNING_STORAGE_ZONE",
  "BUNNY_LEARNING_STORAGE_ACCESS_KEY",
  "BUNNY_LEARNING_STORAGE_HOST",
  "BUNNY_LEARNING_PULL_ZONE",
  "BUNNY_LEARNING_TOKEN_KEY",
  "BUNNY_LEARNING_UPLOAD_ENDPOINT",
  "BUNNY_LEARNING_UPLOAD_SHARED_SECRET",
];

const eksik = gerekli.filter((ad) => !process.env[ad]);
if (eksik.length > 0) throw new Error(`Eksik ortam değişkenleri: ${eksik.join(", ")}`);

const origin = "https://hapbilgi.vercel.app";
const veri = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const checksum = createHash("sha256").update(veri).digest("hex");
const aracId = randomUUID();
const kullaniciId = "faz2-canli-dogrulama";
const dosyaYolu = `_faz2-test/${aracId}.png`;
const sonKullanma = Math.floor(Date.now() / 1000) + 300;
const mesaj = [aracId, kullaniciId, dosyaYolu, veri.length, "image/png", checksum, sonKullanma].join("\n");
const imza = createHmac("sha256", process.env.BUNNY_LEARNING_UPLOAD_SHARED_SECRET)
  .update(mesaj)
  .digest("base64url");

const yukleme = await fetch(process.env.BUNNY_LEARNING_UPLOAD_ENDPOINT, {
  method: "PUT",
  headers: {
    Origin: origin,
    "Content-Type": "image/png",
    "Content-Length": String(veri.length),
    "x-arac-id": aracId,
    "x-kullanici-id": kullaniciId,
    "x-dosya-yolu": dosyaYolu,
    "x-dosya-boyutu": String(veri.length),
    "x-checksum-sha256": checksum,
    "x-yukleme-token": `${sonKullanma}.${imza}`,
  },
  body: veri,
  signal: AbortSignal.timeout(15_000),
});
const yuklemeGovdesi = yukleme.ok ? "" : (await yukleme.clone().text()).slice(0, 200);

const storageHost = process.env.BUNNY_LEARNING_STORAGE_HOST;
const storageZone = process.env.BUNNY_LEARNING_STORAGE_ZONE;
const storageUrl = `https://${storageHost}/${storageZone}/${dosyaYolu}`;
const depolama = await fetch(storageUrl, {
  headers: { AccessKey: process.env.BUNNY_LEARNING_STORAGE_ACCESS_KEY },
});

const cdnHost = process.env.BUNNY_LEARNING_PULL_ZONE.replace(/^https?:\/\//, "").replace(/\/$/, "");
const cdnYolu = `/${dosyaYolu}`;
const cdnSonKullanma = Math.floor(Date.now() / 1000) + 300;
const cdnImza = createHmac("sha256", process.env.BUNNY_LEARNING_TOKEN_KEY)
  .update(`${cdnYolu}${cdnSonKullanma}`)
  .digest("base64url");
const imzaliCdn = await fetch(`https://${cdnHost}${cdnYolu}?token=HS256-${cdnImza}&expires=${cdnSonKullanma}`);
const imzasizCdn = await fetch(`https://${cdnHost}${cdnYolu}`);
const yanlisOrigin = await fetch(process.env.BUNNY_LEARNING_UPLOAD_ENDPOINT, {
  method: "OPTIONS",
  headers: { Origin: "https://example.invalid" },
});

const sonuc = {
  yukleme: yukleme.status,
  yuklemeHatasi: yuklemeGovdesi,
  depolama: depolama.status,
  imzaliCdn: imzaliCdn.status,
  imzasizCdn: imzasizCdn.status,
  yanlisOrigin: yanlisOrigin.status,
  dosyaYolu,
};

console.log(JSON.stringify(sonuc));
if (yukleme.status !== 201 || depolama.status !== 200 || imzaliCdn.status !== 200 || imzasizCdn.status !== 403 || yanlisOrigin.status !== 403) {
  process.exitCode = 1;
}
