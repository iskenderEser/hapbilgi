import { oneriPenceresiAcik } from "@/lib/tclub/oneri/pencereKontrol";
import { sabitSoruIndeksleri } from "@/lib/soru/secim";
import { cevaplarAtananSorularlaEslesiyorMu } from "@/lib/soru/kontrol";

export type EclubOneriDurumu = "aktif" | "suresi_gecmis" | "henuz_baslamadi";

export function eclubOneriDurumu(
  oneriBaslangic: string | Date,
  oneriBitis: string | Date,
  simdi: Date = new Date()
): EclubOneriDurumu {
  const pencere = oneriPenceresiAcik(oneriBaslangic, oneriBitis, simdi);
  if (pencere.acik) return "aktif";
  return pencere.sebep === "sona_erdi" ? "suresi_gecmis" : "henuz_baslamadi";
}

export function eclubIzlemeHaklari(
  oneriBaslangic: string | Date,
  oneriBitis: string | Date,
  simdi: Date = new Date()
) {
  const durum = eclubOneriDurumu(oneriBaslangic, oneriBitis, simdi);
  return {
    durum,
    izlenebilir: durum !== "henuz_baslamadi",
    puanli: durum === "aktif",
    soruGoster: durum === "aktif",
  } as const;
}

/** Aynı izleme kimliği için GET ve POST aşamalarında aynı soru kümesini üretir (tek kaynak: @/lib/soru/secim). */
export const eclubSoruIndeksleri = sabitSoruIndeksleri;

/** Cevapların atanan soru kümesiyle eşleşme kontrolü (tek kaynak: @/lib/soru/kontrol). */
export { cevaplarAtananSorularlaEslesiyorMu };

