// lib/video/icerikTuru.ts
// İçerik türü için sunum katmanı yardımcıları (başlık, sıra, doğrulama).
//
// TEK DOĞRULUK KAYNAĞI:
// IcerikTuru tipi ve rol → tür eşlemesi lib/uretici/yetenekler.ts içinde
// her rolün yetenek profilinde tanımlanır. Bu dosya yalnızca ana sayfa
// gösterimi için gerekli sunum metadata'sını taşır.

import type { IcerikTuru } from "@/lib/uretici/yetenekler";

// IcerikTuru tipini yeniden export — geriye dönük uyumluluk için
// (mevcut tüketiciler "@/lib/video/icerikTuru" üzerinden import edebilir).
export type { IcerikTuru };

// Ana sayfa bölüm başlıkları.
export const TUR_BASLIK: Record<IcerikTuru, string> = {
  ik: "İK Eğitimleri",
  medikal: "Medikal Eğitimler",
  egitim: "Eğitim Müdürlüğü Eğitimleri",
  urun: "Ürün Eğitimleri",
};

// Ana sayfada bölümlerin gösterim sırası (ve geçerli tür listesi).
export const TUR_SIRA: IcerikTuru[] = ["ik", "medikal", "egitim", "urun"];

/** DB'den okunan icerik_turu değerinin geçerli bir tür olup olmadığını doğrular. */
export function isIcerikTuru(x: unknown): x is IcerikTuru {
  return typeof x === "string" && (TUR_SIRA as string[]).includes(x);
}