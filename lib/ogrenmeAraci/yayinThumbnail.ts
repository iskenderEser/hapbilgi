import "server-only";
import { bunnyCdnImzaliUrl } from "@/lib/ogrenmeAraci/bunnyStorage";

export interface YayinKapakGirdisi {
  arac_id?: string | null;
  thumbnail_url?: string | null;
  video_url?: string | null;
  arac_turu?: string | null;
  arac_kapak_yolu?: string | null;
  arac_dosya_yolu?: string | null;
  dosya_yolu?: string | null;
  kapak_yolu?: string | null;
  kapak_dogrulandi?: boolean | null;
  arac_kapak_dogrulandi?: boolean | null;
  arac_metadata?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

function kapakDogrulanmisMi(yayin: YayinKapakGirdisi): boolean {
  if (yayin.kapak_dogrulandi === true || yayin.arac_kapak_dogrulandi === true) return true;
  const meta = yayin.arac_metadata ?? yayin.metadata;
  if (meta && typeof meta === "object") {
    if (meta.kapak_dogrulandi === true || meta.kapak_dogrulandi === "true") return true;
  }
  return false;
}

/**
 * Bir yayının küçük resim (thumbnail) URL'sini kesin kurallara göre çözümler:
 * - video: mevcut thumbnail (`thumbnail_url`) korunur.
 * - podcast ve flip_pdf (Literatür): YALNIZCA doğrulanmış kapak görseli (`kapak_dogrulandi === true`)
 *   varsa Bunny CDN imzalı süreli URL üretilir; aksi halde null döner.
 * - gorsel (Dijital Broşür): öncelikle ana görsel yolu (`arac_dosya_yolu` veya `dosya_yolu`),
 *   varsa `arac_kapak_yolu` kullanılarak imzalı CDN URL üretilir.
 * - İmza/CDN URL üretilemeyen her durumda null döndürülür; istemci `AracVarsayilanKapak` render eder.
 */
export function yayinThumbnailUrlCoz(yayin: YayinKapakGirdisi | null | undefined, simdiMs?: number): string | null {
  if (!yayin) return null;

  const aracTuru = (yayin.arac_turu ?? "video").toLowerCase();

  // 1. Video: mevcut thumbnail
  if (aracTuru === "video") {
    return yayin.thumbnail_url ?? null;
  }

  // 2. Podcast ve Literatür (flip_pdf): YALNIZCA doğrulanmış kapak görseli
  if (aracTuru === "podcast" || aracTuru === "flip_pdf") {
    if (!kapakDogrulanmisMi(yayin)) {
      return null;
    }
    const kapakYolu = typeof yayin.arac_kapak_yolu === "string" && yayin.arac_kapak_yolu.trim()
      ? yayin.arac_kapak_yolu.trim()
      : typeof yayin.kapak_yolu === "string" && yayin.kapak_yolu.trim()
      ? yayin.kapak_yolu.trim()
      : "";
    if (kapakYolu) {
      return bunnyCdnImzaliUrl(kapakYolu, simdiMs) ?? null;
    }
    return null;
  }

  // 3. Dijital Broşür (gorsel): Öncelikle ana görsel yolu
  if (aracTuru === "gorsel") {
    const dosya = typeof yayin.arac_dosya_yolu === "string" && yayin.arac_dosya_yolu.trim()
      ? yayin.arac_dosya_yolu.trim()
      : typeof yayin.dosya_yolu === "string" && yayin.dosya_yolu.trim()
      ? yayin.dosya_yolu.trim()
      : typeof yayin.arac_kapak_yolu === "string" && yayin.arac_kapak_yolu.trim()
      ? yayin.arac_kapak_yolu.trim()
      : "";
    if (dosya) {
      return bunnyCdnImzaliUrl(dosya, simdiMs) ?? null;
    }
    return null;
  }

  return null;
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

export type TemizYayinThumbnailCevabi<T> = Omit<
  T,
  | "arac_kapak_yolu"
  | "arac_dosya_yolu"
  | "dosya_yolu"
  | "kapak_yolu"
  | "transkript_yolu"
  | "arac_transkript_yolu"
  | "arac_metadata"
  | "metadata"
> & {
  thumbnail_url: string | null;
};

/**
 * Ham Storage yollarını API cevabından çıkarıp yalnız süreli imzalı URL'yi bırakır.
 * Bunny Storage yollarının hiçbir API yanıtında istemciye sızmasını engeller.
 */
export function yayinThumbnailCevabi<T extends YayinKapakGirdisi>(
  yayin: T,
  simdiMs?: number
): TemizYayinThumbnailCevabi<T> {
  const guvenli = { ...(yayin as Record<string, unknown>) };
  delete guvenli.arac_kapak_yolu;
  delete guvenli.arac_dosya_yolu;
  delete guvenli.dosya_yolu;
  delete guvenli.kapak_yolu;
  delete guvenli.transkript_yolu;
  delete guvenli.arac_transkript_yolu;
  delete guvenli.arac_metadata;
  delete guvenli.metadata;

  return {
    ...(guvenli as TemizYayinThumbnailCevabi<T>),
    thumbnail_url: yayinThumbnailUrlCoz(yayin, simdiMs),
  };
}
/**
 * Genel öneri listesini (RPC çıktısı) v_yayin_detay verisiyle zenginleştirir.
 * - Thumbnail kaynağı yalnız merkezi sunucu tarafı çözümleyicinin (yayinThumbnailCevabi) sonucudur.
 * - yayinThumbnailCevabi çıktısı null olduğunda eski kayit.thumbnail_url değerine ASLA geri dönülmez.
 * - Podcast ve Literatür için doğrulanmamış kapakların eski RPC thumbnail alanı üzerinden
 *   istemciye sızması engellenir (null döndürülür).
 * - Video için merkezi çözümleyicideki mevcut davranış korunur.
 * - arac_id ve arac_turu alanları korunur.
 * - arac_kapak_yolu, arac_dosya_yolu, dosya_yolu, metadata ve diğer ham Bunny Storage alanlarının
 *   API cevabına girmesi engellenir.
 */
export function oneriListesiThumbnailZenginlestir<
  O extends { yayin_id: string; [anahtar: string]: unknown },
  Y extends YayinKapakGirdisi & { yayin_id: string }
>(
  oneriListesi: O[],
  yayinDetaylari: Y[],
  simdiMs?: number
) {
  const yayinHaritasi = new Map(
    (yayinDetaylari ?? []).map((y) => [y.yayin_id, yayinThumbnailCevabi(y, simdiMs)])
  );

  return oneriListesi.map((kayit) => {
    const yayin = yayinHaritasi.get(kayit.yayin_id);
    const temiz = { ...(kayit as Record<string, unknown>) };
    delete temiz.arac_kapak_yolu;
    delete temiz.arac_dosya_yolu;
    delete temiz.dosya_yolu;
    delete temiz.kapak_yolu;
    delete temiz.transkript_yolu;
    delete temiz.arac_transkript_yolu;
    delete temiz.arac_metadata;
    delete temiz.metadata;

    return {
      ...temiz,
      video_url: yayin?.video_url ?? (kayit.video_url as string | null) ?? null,
      thumbnail_url: yayin ? yayin.thumbnail_url : null,
      arac_id: yayin?.arac_id ?? (kayit.arac_id as string | null) ?? null,
      arac_turu: yayin?.arac_turu ?? (kayit.arac_turu as string | null) ?? null,
    };
  });
}
