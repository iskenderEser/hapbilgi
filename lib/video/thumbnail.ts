// lib/video/thumbnail.ts
//
// Provider-agnostik thumbnail URL üreticisi.
// Video URL'sinden provider tespit edip o provider'ın thumbnail formatına çevirir.
//
// Şu an aktif: Bunny.net
// İskelet hazır (yorum satırı): Mux, YouTube, Cloudflare Stream, Vimeo
//
// Bunny.net thumbnail formatı:
//   https://{pull_zone}.b-cdn.net/{video_id}/thumbnail.jpg
//
// Pull zone env değişkeninden okunur (test ve canlı ortam farklı):
//   NEXT_PUBLIC_BUNNY_PULL_ZONE=vz-214e1e95-2ff.b-cdn.net

import { detectProvider } from "@/lib/video/videoPlayer";

/**
 * Video URL'sinden thumbnail URL'si üretir.
 * Bilinmeyen provider veya parse hatasında null döner — UI placeholder gösterir.
 */
export function thumbnailUrlUret(videoUrl: string | null | undefined): string | null {
  if (!videoUrl) return null;

  try {
    const provider = detectProvider(videoUrl);

    if (provider === "bunny") {
      return bunnyThumbnail(videoUrl);
    }

    // Diğer provider'lar — eklendiğinde buraya case açılır:
    // if (provider === "mux") return muxThumbnail(videoUrl);
    // if (provider === "youtube") return youtubeThumbnail(videoUrl);
    // if (provider === "cloudflare") return cloudflareThumbnail(videoUrl);
    // if (provider === "vimeo") return vimeoThumbnail(videoUrl);

    return null;
  } catch {
    return null;
  }
}

/**
 * Bunny.net thumbnail URL üreticisi.
 *
 * Kabul edilen formatlar:
 *   https://iframe.mediadelivery.net/embed/{lib_id}/{video_id}
 *   https://iframe.mediadelivery.net/play/{lib_id}/{video_id}
 *   https://player.mediadelivery.net/embed/{lib_id}/{video_id}
 *   https://player.mediadelivery.net/play/{lib_id}/{video_id}
 *
 * video_id URL'in son segmentinden alınır.
 * Pull zone env değişkeninden okunur.
 */
function bunnyThumbnail(url: string): string | null {
  const pullZone = process.env.NEXT_PUBLIC_BUNNY_PULL_ZONE;
  if (!pullZone) return null;

  // URL son segmentini al (query string varsa temizle)
  const temizUrl = url.split("?")[0].replace(/\/$/, "");
  const segmentler = temizUrl.split("/");
  const videoId = segmentler[segmentler.length - 1];

  if (!videoId) return null;

  return `https://${pullZone}/${videoId}/thumbnail.jpg`;
}