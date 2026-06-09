// lib/video/gorunurluk.ts
// Ana sayfa video GÖRÜNÜRLÜĞÜ — matris kuralı tek yerde.
// "Hangi rol → hangi türleri → hangi kapsamda → hangi modda görür?"
// icerikTuru.ts (tür) ile birlikte çalışır; veri katmanı (getAnaSayfaVideolari) bunu kullanır.
//
// TEK DOĞRULUK KAYNAĞI:
// Üretici rol grupları (urun, egitim) lib/uretici/yetenekler.ts içindeki
// URETICI_YETENEKLERI profillerinden türetilir; bu dosyada hardcoded liste tutulmaz.

import { IcerikTuru, TUR_SIRA } from "./icerikTuru";
import { URETICI_YETENEKLERI } from "@/lib/uretici/yetenekler";
import { YONETICI_ROLLER } from "@/lib/utils/roller";

const TUKETICILER = ["utt", "kd_utt"];
const TM_BM = ["tm", "bm"];

// Üretici rol grupları — icerikTuru üzerinden URETICI_YETENEKLERI'nden türetilir.
const URUN_ROLLERI = Object.keys(URETICI_YETENEKLERI).filter(
  (r) => URETICI_YETENEKLERI[r].icerikTuru === "urun",
);
const EGITIM_ROLLERI = Object.keys(URETICI_YETENEKLERI).filter(
  (r) => URETICI_YETENEKLERI[r].icerikTuru === "egitim",
);

const kucuk = (roller: readonly string[]) => roller.map((r) => r.toLowerCase());
const n = (rol: string | null | undefined) => (rol ?? "").trim().toLowerCase();

// Tüm türleri gören roller: tüketiciler + tm/bm + yöneticiler + medikal müdür ("her yayın").
// Not: med_md özel durumu — "her yayını görür" davranışı henüz UreticiYetenek profiline
// taşınmadı; ileride bir yetenek alanı eklenirse buradaki hardcoded değer kaldırılır.
const TUM_TUR_ROLLERI = new Set<string>([
  ...kucuk(TUKETICILER),
  ...kucuk(TM_BM),
  ...kucuk(YONETICI_ROLLER),
  "med_md",
]);

// Geniş kapsam (tüm takımlar) gören roller; geri kalanlar yalnızca kendi takımı + tüm-firma görür.
const GENIS_KAPSAM_ROLLERI = new Set<string>([
  ...kucuk(YONETICI_ROLLER),
  "med_md",
  ...kucuk(URUN_ROLLERI),
  ...kucuk(EGITIM_ROLLERI),
]);

const TUKETICI_SET = new Set<string>(kucuk(TUKETICILER));
const URUN_SET = new Set<string>(kucuk(URUN_ROLLERI));
const EGITIM_SET = new Set<string>(kucuk(EGITIM_ROLLERI));

/**
 * Rolün ana sayfada GÖRDÜĞÜ içerik türleri.
 * Boş dizi → o rol ana sayfada video bölümü görmez (İK rolleri, IU, tanımsız roller).
 * Üreticiler kendi ürettikleri türü ana sayfada görmez (onları yayın yönetiminde görürler):
 *   ürün üreticileri 'urun' hariç, eğitim üreticileri 'egitim' hariç.
 *   (med_md "her yayını" gördüğü için tüm türler grubundadır.)
 */
export function gorunenTurler(rol: string | null | undefined): IcerikTuru[] {
  const r = n(rol);
  if (!r) return [];
  if (TUM_TUR_ROLLERI.has(r)) return [...TUR_SIRA];
  if (URUN_SET.has(r)) return TUR_SIRA.filter((t) => t !== "urun");
  if (EGITIM_SET.has(r)) return TUR_SIRA.filter((t) => t !== "egitim");
  return [];
}

/** true → tüm takımların videolarını görür; false → yalnızca kendi takımı + tüm-firma. */
export function kapsamGenisMi(rol: string | null | undefined): boolean {
  return GENIS_KAPSAM_ROLLERI.has(n(rol));
}

/** true → tam tüketici akışı (puan/soru/beğeni/favori). Yalnızca utt/kd_utt. */
export function tuketiciMi(rol: string | null | undefined): boolean {
  return TUKETICI_SET.has(n(rol));
}

/** Rolün ana sayfada hiç video bölümü görüp görmeyeceği. */
export function videoBolumuVarMi(rol: string | null | undefined): boolean {
  return gorunenTurler(rol).length > 0;
}