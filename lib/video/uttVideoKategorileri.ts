import type { IcerikTuru } from "@/lib/video/icerikTuru";

export const UTT_VIDEO_KATEGORILERI = [
  { slug: "urun", icerikTuru: "urun", etiket: "Ürün Eğitimleri" },
  { slug: "medikal", icerikTuru: "medikal", etiket: "Medikal Eğitimler" },
  { slug: "urun-medikal", icerikTuru: "urun_medikal", etiket: "Ürün-Medikal Eğitimleri" },
  { slug: "satis", icerikTuru: "egitim", etiket: "Satış Eğitimleri" },
  { slug: "ik", icerikTuru: "ik", etiket: "İK Eğitimleri" },
] as const satisfies ReadonlyArray<{ slug: string; icerikTuru: IcerikTuru; etiket: string }>;

export function uttVideoKategorisiBul(slug: string) {
  return UTT_VIDEO_KATEGORILERI.find((kategori) => kategori.slug === slug);
}
