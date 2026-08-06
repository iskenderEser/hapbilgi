// lib/video/icerikTuru.ts
// İçerik türü için sunum katmanı yardımcıları (başlık, sıra, doğrulama).
//
// TEK DOĞRULUK KAYNAĞI:
// IcerikTuru tipi ve rol → tür eşlemesi lib/uretici/yetenekler.ts içinde
// her rolün yetenek profilinde tanımlanır. Bu dosya yalnızca ana sayfa
// gösterimi için gerekli sunum metadata'sını taşır.

import { TALEP_TURU_KURALLARI, type IcerikTuru } from "@/lib/uretici/yetenekler";

// IcerikTuru tipini yeniden export — geriye dönük uyumluluk için
// (mevcut tüketiciler "@/lib/video/icerikTuru" üzerinden import edebilir).
export type { IcerikTuru };

// Ana sayfa bölüm başlıkları.
export const TUR_BASLIK: Record<IcerikTuru, string> = {
  urun: "Ürün Eğitimleri",
  urun_medikal: "Ürün Medikal Eğitimleri",
  medikal: "Medikal Eğitimler",
  egitim: "Eğitim Müdürlüğü Eğitimleri",
  ik: "İK Eğitimleri",
};

// Ana sayfada bölümlerin gösterim sırası (ve geçerli tür listesi).
export const TUR_SIRA: IcerikTuru[] = ["urun", "urun_medikal", "medikal", "egitim", "ik"];

// Rapor kırılımlarında kategori adı — üretim hattındaki talep türü adının
// aynısıdır ("Ürün Eğitimi", "Satış Teknikleri", ...). Elle yazılmaz;
// TALEP_TURU_KURALLARI'ndan türetilir ki üretim hattında ad değişirse rapor
// kendiliğinden takip etsin. Yukarıdaki TUR_BASLIK'tan farkı: o ana sayfanın
// bölüm başlığıdır (çoğul, "Ürün Eğitimleri"), bu ise tekil kategori adıdır.
export const TUR_RAPOR_ADI: Record<IcerikTuru, string> = Object.fromEntries(
  Object.values(TALEP_TURU_KURALLARI).map((kural) => [kural.icerikTuru, kural.ad])
) as Record<IcerikTuru, string>;

/** DB'den okunan icerik_turu değerinin geçerli bir tür olup olmadığını doğrular. */
export function isIcerikTuru(x: unknown): x is IcerikTuru {
  return typeof x === "string" && (TUR_SIRA as string[]).includes(x);
}