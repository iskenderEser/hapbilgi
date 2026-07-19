// lib/video/bunnyYukleme.ts
//
// Bunny Stream doğrudan yükleme çekirdeği (A1 — docs/bunny_dogrudan_yukleme_is_plani.md).
// SUNUCU TARAFI: BUNNY_API_KEY kullanır, istemciye ASLA import edilmez.
// Vezne modeli: kaydı sistem açar, adı sistem koyar; istemciye tek videoya özel,
// süreli TUS imzası verilir (sha256(library_id + api_key + expiration + video_guid) —
// Bunny'nin belgelenmiş formülü, A0'da 201/401 ile doğrulandı, 19.07.2026).

import { createHash } from "crypto";

const BUNNY_API = "https://video.bunnycdn.com";
// Bunny'nin TUS ucu — istemci (tus-js-client) doğrudan buraya yükler.
export const BUNNY_TUS_ENDPOINT = "https://video.bunnycdn.com/tusupload";
// İmza ömrü: 2 saat — büyük dosya + kesinti payı; süre dolarsa yeni imza istenir.
const IMZA_OMRU_SANIYE = 2 * 60 * 60;

function ortamDegerleri(): { libraryId: string; apiKey: string } | null {
  const libraryId = process.env.BUNNY_LIBRARY_ID;
  const apiKey = process.env.BUNNY_API_KEY;
  if (!libraryId || !apiKey) return null;
  return { libraryId, apiKey };
}

export interface BunnyVideoKaydi {
  ok: true;
  videoGuid: string;
  libraryId: string;
  imza: string;
  sonKullanma: number; // unix saniye
  embedUrl: string; // sistemin kanonik oynatıcı adresi — yükleme sonrası video_url'ye yazılır
}

export interface BunnyHata {
  ok: false;
  hata: string;
  adim: string;
  detay?: string;
}

/**
 * Bunny'de video kaydını açar ve tek videoya özel süreli TUS imzası üretir.
 * Başlığı çağıran belirler (ürün/senaryo adından) — kütüphane düzeni sisteme aittir.
 */
export async function bunnyYuklemeBaslat(baslik: string): Promise<BunnyVideoKaydi | BunnyHata> {
  const ortam = ortamDegerleri();
  if (!ortam) {
    return { ok: false, hata: "Bunny yapılandırması eksik.", adim: "env kontrolü", detay: "BUNNY_LIBRARY_ID / BUNNY_API_KEY tanımsız" };
  }

  let yanit: Response;
  try {
    yanit = await fetch(`${BUNNY_API}/library/${ortam.libraryId}/videos`, {
      method: "POST",
      headers: { AccessKey: ortam.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ title: baslik }),
    });
  } catch (err: any) {
    return { ok: false, hata: "Bunny'ye ulaşılamadı.", adim: "Bunny video kaydı POST", detay: err?.message };
  }

  if (!yanit.ok) {
    const govde = await yanit.text().catch(() => "");
    return { ok: false, hata: "Bunny video kaydı açılamadı.", adim: "Bunny video kaydı POST", detay: `HTTP ${yanit.status} ${govde.slice(0, 200)}` };
  }

  const video = await yanit.json();
  if (!video?.guid) {
    return { ok: false, hata: "Bunny beklenen kimliği döndürmedi.", adim: "Bunny video kaydı POST — dönen veri" };
  }

  const sonKullanma = Math.floor(Date.now() / 1000) + IMZA_OMRU_SANIYE;
  return {
    ok: true,
    videoGuid: video.guid,
    libraryId: ortam.libraryId,
    imza: tusImzasiUret(ortam.libraryId, ortam.apiKey, sonKullanma, video.guid),
    sonKullanma,
    embedUrl: `https://player.mediadelivery.net/embed/${ortam.libraryId}/${video.guid}`,
  };
}

// Ayrı ve saf: smoke testi bilinen vektörle bunu doğrular.
export function tusImzasiUret(libraryId: string, apiKey: string, sonKullanma: number, videoGuid: string): string {
  return createHash("sha256").update(libraryId + apiKey + sonKullanma + videoGuid).digest("hex");
}

/** Yarım kalan/iptal edilen yüklemenin Bunny kaydını temizler (telafi). */
export async function bunnyVideoSil(videoGuid: string): Promise<boolean> {
  const ortam = ortamDegerleri();
  if (!ortam) return false;
  try {
    const yanit = await fetch(`${BUNNY_API}/library/${ortam.libraryId}/videos/${videoGuid}`, {
      method: "DELETE",
      headers: { AccessKey: ortam.apiKey },
    });
    return yanit.ok;
  } catch {
    return false;
  }
}
