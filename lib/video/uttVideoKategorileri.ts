import type { IcerikTuru } from "@/lib/video/icerikTuru";

export interface UttVideoKategorisi {
  slug: string;
  icerikTuru: IcerikTuru;
  etiket: string;
  sayfaAciklamasi: string;
  rehberOzeti: string;
}

const ORTAK_SAYFA_ACIKLAMASI = "Sizin için atanmış tüm yayınları görebilirsiniz.";

export const UTT_VIDEO_KATEGORILERI = [
  {
    slug: "urun",
    icerikTuru: "urun",
    etiket: "Ürün Eğitimleri",
    sayfaAciklamasi: ORTAK_SAYFA_ACIKLAMASI,
    rehberOzeti: "Ürünlere dair bilgilerinizi farklı yayın tipleriyle geliştirebilirsiniz.",
  },
  {
    slug: "medikal",
    icerikTuru: "medikal",
    etiket: "Medikal Eğitimler",
    sayfaAciklamasi: ORTAK_SAYFA_ACIKLAMASI,
    rehberOzeti: "Medikal konulara dair bilgilerinizi farklı yayın tipleriyle geliştirebilirsiniz.",
  },
  {
    slug: "urun-medikal",
    icerikTuru: "urun_medikal",
    etiket: "Ürün-Medikal Eğitimleri",
    sayfaAciklamasi: ORTAK_SAYFA_ACIKLAMASI,
    rehberOzeti: "Ürünlerin medikal yönlerine dair bilgilerinizi farklı yayın tipleriyle geliştirebilirsiniz.",
  },
  {
    slug: "satis",
    icerikTuru: "egitim",
    etiket: "Satış Eğitimleri",
    sayfaAciklamasi: ORTAK_SAYFA_ACIKLAMASI,
    rehberOzeti: "Satış becerilerinizi farklı yayın tipleriyle geliştirebilirsiniz.",
  },
  {
    slug: "yonetim",
    icerikTuru: "yonetim",
    etiket: "Yönetim Eğitimleri",
    sayfaAciklamasi: ORTAK_SAYFA_ACIKLAMASI,
    rehberOzeti: "Yönetim becerilerinizi farklı yayın tipleriyle geliştirebilirsiniz.",
  },
  {
    slug: "ik",
    icerikTuru: "ik",
    etiket: "İK Eğitimleri",
    sayfaAciklamasi: ORTAK_SAYFA_ACIKLAMASI,
    rehberOzeti: "İK konularındaki bilgilerinizi farklı yayın tipleriyle geliştirebilirsiniz.",
  },
] as const satisfies ReadonlyArray<UttVideoKategorisi>;

export function uttVideoKategorisiBul(slug: string) {
  return UTT_VIDEO_KATEGORILERI.find((kategori) => kategori.slug === slug);
}
