// lib/utils/ortam.ts
// Ortam tespitinin tek kaynağı (K-E8 çift kilidinin zemini).
//
// Vercel'de NODE_ENV her ortamda (preview dahil) 'production' olduğundan
// tek başına güvenilmez; VERCEL_ENV varsa öncelik ondadır:
//   - VERCEL_ENV tanımlıysa yalnızca 'production' değeri canlı sayılır
//     (preview/development canlı DEĞİLDİR).
//   - VERCEL_ENV yoksa (local) NODE_ENV'e bakılır.
// Böylece "canlı" tanımı iki bağımsız sinyalin kesişimidir: yanlışlıkla
// canlıda test davranışı açmak için ikisinin birden yanılması gerekir.

export function canliOrtamMi(): boolean {
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv) return vercelEnv === "production";
  return process.env.NODE_ENV === "production";
}
