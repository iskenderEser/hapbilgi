import "server-only";
import { bunnyCdnImzaliUrl } from "@/lib/ogrenmeAraci/bunnyStorage";

export interface YayinKapakGirdisi {
  thumbnail_url?: string | null;
  video_url?: string | null;
  arac_turu?: string | null;
  arac_kapak_yolu?: string | null;
  arac_dosya_yolu?: string | null;
  dosya_yolu?: string | null;
}

/**
 * Bir yayının küçük resim (thumbnail) URL'sini çözümler:
 * - Eğer araç için `arac_kapak_yolu` tanımlıysa Bunny CDN imzalı süreli erişim URL'si üretir.
 * - Eğer araç `gorsel` (dijital broşür) ise ve kapak yolu yoksa, dosyanın kendisini (`arac_dosya_yolu`) imzalı URL olarak çözümler.
 * - Aksi halde mevcut `thumbnail_url`'i döndürür.
 */
export function yayinThumbnailUrlCoz(yayin: YayinKapakGirdisi | null | undefined, simdiMs?: number): string | null {
  if (!yayin) return null;

  const kapakYolu = typeof yayin.arac_kapak_yolu === "string" ? yayin.arac_kapak_yolu.trim() : "";
  if (kapakYolu) {
    const imzaliUrl = bunnyCdnImzaliUrl(kapakYolu, simdiMs);
    if (imzaliUrl) return imzaliUrl;
  }

  // Dijital broşür (görsel) için dosyanın kendisi kapak olarak kullanılabilir
  if (yayin.arac_turu === "gorsel") {
    const dosya = typeof yayin.arac_dosya_yolu === "string" && yayin.arac_dosya_yolu.trim()
      ? yayin.arac_dosya_yolu.trim()
      : typeof yayin.dosya_yolu === "string" && yayin.dosya_yolu.trim()
      ? yayin.dosya_yolu.trim()
      : "";
    if (dosya) {
      const imzaliUrl = bunnyCdnImzaliUrl(dosya, simdiMs);
      if (imzaliUrl) return imzaliUrl;
    }
  }

  return yayin.thumbnail_url ?? null;
}

/**
 * Yayın nesnelerinden oluşan bir dizinin her bir elemanının `thumbnail_url` alanını
 * kapak görseli kurallarına göre zenginleştirir.
 */
export function yayinlariThumbnailIleZenginlestir<T extends YayinKapakGirdisi>(yayinlar: T[], simdiMs?: number): T[] {
  return yayinlar.map((y) => ({
    ...y,
    thumbnail_url: yayinThumbnailUrlCoz(y, simdiMs),
  }));
}
