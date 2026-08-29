export interface TopluPaketSatiri {
  index: number;
  durum: "hazir" | "eksik" | "hatali";
  hata_mesaji?: string;
}

/** Hatalı tek satırın bile bütün paketi durdurması için kanonik hata listesi. */
export function topluPaketHatalari(satirlar: TopluPaketSatiri[]): string[] {
  return satirlar
    .filter((satir) => satir.durum === "hatali")
    .map((satir) => `Satır ${satir.index} — ${satir.hata_mesaji ?? "Bilinmeyen doğrulama hatası."}`);
}
