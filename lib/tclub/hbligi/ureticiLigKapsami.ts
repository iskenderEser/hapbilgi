import type { SiraliSatir } from "@/components/hbligi/league/types";
import type { SahaLigKullanici } from "@/lib/tclub/hbligi/getSahaLig";

export type UreticiLigKapsami = "bolge" | "takim" | "firma";

type OrganizasyonSatiri = {
  takim_id?: string | null;
  bolge_id?: string | null;
};

export function ureticiLigKapsaminiUygula<T extends OrganizasyonSatiri>(
  satirlar: T[],
  kapsam: UreticiLigKapsami,
  birimId: string,
): T[] {
  if (kapsam === "firma" || !birimId) return satirlar;
  if (kapsam === "takim") return satirlar.filter((satir) => satir.takim_id === birimId);
  return satirlar.filter((satir) => satir.bolge_id === birimId);
}

export function ureticiLiginiSirala(satirlar: SahaLigKullanici[]): SiraliSatir[] {
  const puanSirasi = new Map(
    [...new Set(satirlar.map((satir) => satir.toplam_puan))]
      .sort((a, b) => b - a)
      .map((puan, index) => [puan, index + 1]),
  );

  return [...satirlar]
    .sort((a, b) => b.toplam_puan - a.toplam_puan || a.ad.localeCompare(b.ad, "tr"))
    .map((satir) => ({
      ...satir,
      rank: puanSirasi.get(satir.toplam_puan) ?? 0,
      degisim: null,
    }));
}
