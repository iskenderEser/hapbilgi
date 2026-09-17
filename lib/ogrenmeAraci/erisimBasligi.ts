import type { OgrenmeAraciTuru } from "@/lib/ogrenmeAraci/tipler";
import type { TalepBilgisi } from "@/lib/utils/talepZinciri";

const VARSAYILAN_ARAC_ADI: Record<OgrenmeAraciTuru, string> = {
  video: "Video",
  podcast: "Podcast",
  gorsel: "Dijital Broşür",
  flip_pdf: "Literatür",
};

/** Ortak talep künyesindeki ürün adını tüketim oynatıcısı başlığına dönüştürür. */
export function ogrenmeAraciErisimUrunAdi(
  aracTuru: OgrenmeAraciTuru,
  talep: Pick<TalepBilgisi, "urun_adi"> | null | undefined,
): string {
  const urunAdi = talep?.urun_adi?.trim();
  return urunAdi && urunAdi !== "-" ? urunAdi : VARSAYILAN_ARAC_ADI[aracTuru];
}
