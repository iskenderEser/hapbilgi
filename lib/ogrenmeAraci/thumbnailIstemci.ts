import type { OgrenmeAraciTuru } from "@/lib/ogrenmeAraci/tipler";
import { thumbnailUrlUret } from "@/lib/video/thumbnail";

export interface IstemciThumbnailGirdisi {
  thumbnail_url?: string | null;
  video_url?: string | null;
  arac_turu?: OgrenmeAraciTuru | string | null;
}

/**
 * Sunucunun çözdüğü thumbnail'i kullanır. Eski video URL'sinden thumbnail
 * türetme davranışını yalnız video yayınları için korur.
 */
export function yayinThumbnailIstemciCoz(yayin: IstemciThumbnailGirdisi): string | null {
  if (yayin.thumbnail_url) return yayin.thumbnail_url;
  if ((yayin.arac_turu ?? "video") !== "video") return null;
  return thumbnailUrlUret(yayin.video_url ?? null);
}
