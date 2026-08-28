// Bunny Edge Script — öğrenme aracı dosyasını doğrudan Bunny Storage'a taşır.
// Storage AccessKey hiçbir zaman tarayıcıya veya Vercel fonksiyonuna verilmez.

import * as BunnySDK from "@bunny.net/edgescript-sdk";
import process from "node:process";

const izinBasliklari = {
  "Access-Control-Allow-Headers": "content-type, content-length, x-arac-id, x-kullanici-id, x-dosya-yolu, x-dosya-boyutu, x-checksum-sha256, x-yukleme-token",
  "Access-Control-Allow-Methods": "PUT, OPTIONS",
  "Access-Control-Max-Age": "600",
};

function json(hata: string, status: number, origin: string | null): Response {
  return new Response(JSON.stringify({ hata }), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
      ...izinBasliklari,
    },
  });
}

function base64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let metin = "";
  for (const byte of bytes) metin += String.fromCharCode(byte);
  return btoa(metin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function sabitKarsilastir(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let fark = 0;
  for (let i = 0; i < a.length; i += 1) fark |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return fark === 0;
}

async function hmac(secret: string, mesaj: string): Promise<string> {
  const encoder = new TextEncoder();
  const anahtar = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return base64Url(await crypto.subtle.sign("HMAC", anahtar, encoder.encode(mesaj)));
}

function yolGecerliMi(yol: string): boolean {
  return yol.length > 0
    && yol.length <= 512
    && !yol.startsWith("/")
    && !yol.includes("..")
    && !yol.includes("\\")
    && yol.split("/").every(Boolean);
}

BunnySDK.net.http.serve(async (request: Request): Promise<Response> => {
  const izinliOrigin = process.env.ALLOWED_ORIGIN ?? "";
  const origin = request.headers.get("origin");
  if (!izinliOrigin || origin !== izinliOrigin) return json("Origin reddedildi.", 403, null);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: { "Access-Control-Allow-Origin": origin, ...izinBasliklari },
    });
  }
  if (request.method !== "PUT") return json("Yalnız PUT kabul edilir.", 405, origin);

  const storageZone = process.env.STORAGE_ZONE;
  const storageAccessKey = process.env.STORAGE_ACCESS_KEY;
  const uploadSecret = process.env.UPLOAD_SHARED_SECRET;
  const storageHost = process.env.STORAGE_HOST ?? "storage.bunnycdn.com";
  if (!storageZone || !storageAccessKey || !uploadSecret) return json("Upload servisi yapılandırılmamış.", 503, origin);

  const aracId = request.headers.get("x-arac-id") ?? "";
  const kullaniciId = request.headers.get("x-kullanici-id") ?? "";
  const dosyaYolu = request.headers.get("x-dosya-yolu") ?? "";
  const dosyaBoyutuHam = request.headers.get("x-dosya-boyutu") ?? "";
  const checksumSha256 = request.headers.get("x-checksum-sha256")?.toLowerCase() ?? "";
  const yuklemeToken = request.headers.get("x-yukleme-token") ?? "";
  const mimeType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
  const gercekBoyutHam = request.headers.get("content-length") ?? "";
  const dosyaBoyutu = Number(dosyaBoyutuHam);
  const gercekBoyut = Number(gercekBoyutHam);
  if (!aracId || !kullaniciId || !yolGecerliMi(dosyaYolu) || !/^[0-9a-f]{64}$/.test(checksumSha256)) {
    return json("Yükleme bağlamı geçersiz.", 400, origin);
  }
  if (!Number.isSafeInteger(dosyaBoyutu) || dosyaBoyutu <= 0 || gercekBoyut !== dosyaBoyutu) {
    return json("Dosya boyutu yükleme yetkisiyle eşleşmiyor.", 400, origin);
  }

  const [sonKullanmaHam, imza, fazla] = yuklemeToken.split(".");
  const sonKullanma = Number(sonKullanmaHam);
  if (fazla !== undefined || !imza || !Number.isSafeInteger(sonKullanma) || sonKullanma < Math.floor(Date.now() / 1000)) {
    return json("Yükleme yetkisinin süresi dolmuş.", 401, origin);
  }
  const mesaj = [aracId, kullaniciId, dosyaYolu, dosyaBoyutu, mimeType, checksumSha256, sonKullanma].join("\n");
  const beklenen = await hmac(uploadSecret, mesaj);
  if (!sabitKarsilastir(imza, beklenen)) return json("Yükleme yetkisi geçersiz.", 401, origin);

  const kodluYol = dosyaYolu.split("/").map(encodeURIComponent).join("/");
  const storageUrl = `https://${storageHost}/${encodeURIComponent(storageZone)}/${kodluYol}`;
  const storageYaniti = await fetch(storageUrl, {
    method: "PUT",
    headers: { AccessKey: storageAccessKey, "Content-Type": mimeType, Checksum: checksumSha256 },
    body: request.body,
  });
  if (!storageYaniti.ok) return json("Bunny Storage yüklemesi tamamlanamadı.", 502, origin);

  // Makbuz yalnız Bunny, Checksum başlığını kabul edip yüklemeyi başarıyla
  // tamamladıktan sonra üretilir. Vercel bu imzayı aynı yükleme bağlamıyla
  // doğrulayarak Storage GET yanıtında checksum başlığı olmasa da zincirin
  // bütünlüğünü kanıtlar.
  const makbuzImzasi = await hmac(uploadSecret, `tamamlandi\n${mesaj}`);

  return new Response(JSON.stringify({
    tamamlandi: true,
    yukleme_makbuzu: `${sonKullanma}.${makbuzImzasi}`,
  }), {
    status: 201,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": origin, ...izinBasliklari },
  });
});
