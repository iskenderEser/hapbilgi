import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import type { YeniOgrenmeAraciTuru } from "@/lib/ogrenmeAraci/tipler";

const YUKLEME_OMRU_SANIYE = 60 * 30;
const ERISIM_OMRU_SANIYE = 60 * 15;

interface BunnyStorageOrtami {
  storageZone: string;
  storageHost: string;
  storageAccessKey: string;
  pullZoneHost: string;
  tokenKey: string;
  uploadEndpoint: string;
  uploadSharedSecret: string;
}

export function bunnyStorageOrtami(): BunnyStorageOrtami | null {
  const storageZone = process.env.BUNNY_LEARNING_STORAGE_ZONE;
  const storageAccessKey = process.env.BUNNY_LEARNING_STORAGE_ACCESS_KEY;
  const pullZoneHost = process.env.BUNNY_LEARNING_PULL_ZONE;
  const tokenKey = process.env.BUNNY_LEARNING_TOKEN_KEY;
  const uploadEndpoint = process.env.BUNNY_LEARNING_UPLOAD_ENDPOINT;
  const uploadSharedSecret = process.env.BUNNY_LEARNING_UPLOAD_SHARED_SECRET;
  if (!storageZone || !storageAccessKey || !pullZoneHost || !tokenKey || !uploadEndpoint || !uploadSharedSecret) return null;
  return {
    storageZone,
    storageHost: process.env.BUNNY_LEARNING_STORAGE_HOST ?? "storage.bunnycdn.com",
    storageAccessKey,
    pullZoneHost: pullZoneHost.replace(/^https?:\/\//, "").replace(/\/$/, ""),
    tokenKey,
    uploadEndpoint: uploadEndpoint.replace(/\/$/, ""),
    uploadSharedSecret,
  };
}

function segmentleriKodla(yol: string): string {
  return yol.split("/").filter(Boolean).map(encodeURIComponent).join("/");
}

export function bunnyNesneYoluOlustur(girdi: {
  firmaId: string;
  talepId: string;
  aracId: string;
  aracTuru: YeniOgrenmeAraciTuru;
  uzanti: string;
}): string {
  return [girdi.firmaId, girdi.talepId, girdi.aracTuru, `${girdi.aracId}.${girdi.uzanti}`].join("/");
}

export function bunnyPodcastDestekYoluOlustur(girdi: {
  firmaId: string;
  talepId: string;
  aracId: string;
  rol: "kapak" | "transkript";
  uzanti: string;
}): string {
  return [girdi.firmaId, girdi.talepId, "podcast", girdi.aracId, `${girdi.rol}.${girdi.uzanti}`].join("/");
}

function base64Url(buffer: Buffer): string {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function sabitKarsilastir(a: string, b: string): boolean {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

export interface YuklemeYetkisi {
  token: string;
  sonKullanma: number;
}

export function yuklemeYetkisiOlustur(girdi: {
  aracId: string;
  kullaniciId: string;
  dosyaYolu: string;
  dosyaBoyutu: number;
  mimeType: string;
  checksumSha256: string;
}, simdiMs = Date.now()): YuklemeYetkisi | null {
  const ortam = bunnyStorageOrtami();
  if (!ortam) return null;
  const sonKullanma = Math.floor(simdiMs / 1000) + YUKLEME_OMRU_SANIYE;
  const mesaj = [girdi.aracId, girdi.kullaniciId, girdi.dosyaYolu, girdi.dosyaBoyutu, girdi.mimeType, girdi.checksumSha256, sonKullanma].join("\n");
  const imza = base64Url(createHmac("sha256", ortam.uploadSharedSecret).update(mesaj).digest());
  return { token: `${sonKullanma}.${imza}`, sonKullanma };
}

export function yuklemeYetkisiDogrula(girdi: {
  token: string;
  aracId: string;
  kullaniciId: string;
  dosyaYolu: string;
  dosyaBoyutu: number;
  mimeType: string;
  checksumSha256: string;
}, simdiMs = Date.now()): boolean {
  const ortam = bunnyStorageOrtami();
  if (!ortam) return false;
  const [sonKullanmaHam, imza, fazla] = girdi.token.split(".");
  const sonKullanma = Number(sonKullanmaHam);
  if (fazla !== undefined || !Number.isSafeInteger(sonKullanma) || sonKullanma < Math.floor(simdiMs / 1000)) return false;
  const mesaj = [girdi.aracId, girdi.kullaniciId, girdi.dosyaYolu, girdi.dosyaBoyutu, girdi.mimeType, girdi.checksumSha256, sonKullanma].join("\n");
  const beklenen = base64Url(createHmac("sha256", ortam.uploadSharedSecret).update(mesaj).digest());
  return Boolean(imza) && sabitKarsilastir(imza, beklenen);
}

export function bunnyUploadBilgisi(): { endpoint: string } | null {
  const ortam = bunnyStorageOrtami();
  return ortam ? { endpoint: ortam.uploadEndpoint } : null;
}

export function bunnyCdnImzaliUrl(dosyaYolu: string, simdiMs = Date.now()): string | null {
  const ortam = bunnyStorageOrtami();
  if (!ortam) return null;
  const yol = `/${segmentleriKodla(dosyaYolu)}`;
  const expires = Math.floor(simdiMs / 1000) + ERISIM_OMRU_SANIYE;
  const hash = base64Url(createHmac("sha256", ortam.tokenKey).update(`${yol}${expires}`).digest());
  return `https://${ortam.pullZoneHost}${yol}?token=HS256-${hash}&expires=${expires}`;
}

export interface BunnyNesneBilgisi {
  dosyaBoyutu: number;
  checksumSha256: string | null;
  ilkBaytlar: Uint8Array;
}

export async function bunnyNesneBilgisi(dosyaYolu: string): Promise<BunnyNesneBilgisi | null> {
  const ortam = bunnyStorageOrtami();
  if (!ortam) return null;
  const kodluYol = segmentleriKodla(dosyaYolu);
  const url = `https://${ortam.storageHost}/${encodeURIComponent(ortam.storageZone)}/${kodluYol}`;
  const yanit = await fetch(url, {
    headers: { AccessKey: ortam.storageAccessKey, Range: "bytes=0-4095" },
    cache: "no-store",
  });
  if (!yanit.ok) return null;
  const contentRange = yanit.headers.get("content-range");
  const toplam = contentRange ? Number(contentRange.split("/")[1]) : Number(yanit.headers.get("content-length"));
  const checksum = yanit.headers.get("checksum") ?? yanit.headers.get("etag")?.replaceAll('"', "") ?? null;
  return {
    dosyaBoyutu: Number.isFinite(toplam) ? toplam : 0,
    checksumSha256: checksum && /^[0-9a-f]{64}$/i.test(checksum) ? checksum.toLowerCase() : null,
    ilkBaytlar: new Uint8Array(await yanit.arrayBuffer()),
  };
}

export async function bunnyPdfKuyrukDogrula(dosyaYolu: string): Promise<{ sifreli: boolean; eofVar: boolean } | null> {
  const ortam = bunnyStorageOrtami();
  if (!ortam) return null;
  const url = `https://${ortam.storageHost}/${encodeURIComponent(ortam.storageZone)}/${segmentleriKodla(dosyaYolu)}`;
  const yanit = await fetch(url, { headers: { AccessKey: ortam.storageAccessKey, Range: "bytes=-65536" }, cache: "no-store" });
  if (!yanit.ok) return null;
  const metin = new TextDecoder("latin1").decode(await yanit.arrayBuffer());
  return { sifreli: /\/Encrypt\b/.test(metin), eofVar: /%%EOF\s*$/.test(metin.trimEnd()) };
}
