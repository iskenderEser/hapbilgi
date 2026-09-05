import type {
  HapbiAnalitikOlcut,
  HapbiAnalitikSatir,
  HapbiAnalitikSiralama,
} from "@/lib/hapbi/analitik/sozlesme";

export interface HapbiIlkIkiVeFarkSonucu {
  birinci: HapbiAnalitikSatir | null;
  ikinci: HapbiAnalitikSatir | null;
  fark: number | null;
}

function olcumDegeri(
  satir: HapbiAnalitikSatir,
  olcut: HapbiAnalitikOlcut,
): number | null {
  const deger = satir.olcumler[olcut];
  return deger === undefined || deger === null ? null : deger;
}

function satirAnahtari(satir: HapbiAnalitikSatir): string {
  return JSON.stringify(satir.boyutlar);
}

export function hapbiOlcutuTopla(
  satirlar: readonly HapbiAnalitikSatir[],
  olcut: HapbiAnalitikOlcut,
): number | null {
  const degerler = satirlar
    .map((satir) => olcumDegeri(satir, olcut))
    .filter((deger): deger is number => deger !== null);

  if (degerler.length === 0) return null;
  return degerler.reduce((toplam, deger) => toplam + deger, 0);
}

export function hapbiSatirlariniSirala(
  satirlar: readonly HapbiAnalitikSatir[],
  siralama: HapbiAnalitikSiralama,
): HapbiAnalitikSatir[] {
  const yon = siralama.yon === "artan" ? 1 : -1;

  return [...satirlar].sort((birinci, ikinci) => {
    const birinciDeger = olcumDegeri(birinci, siralama.olcut);
    const ikinciDeger = olcumDegeri(ikinci, siralama.olcut);

    if (birinciDeger === null && ikinciDeger !== null) return 1;
    if (birinciDeger !== null && ikinciDeger === null) return -1;
    if (birinciDeger !== null && ikinciDeger !== null && birinciDeger !== ikinciDeger) {
      return (birinciDeger - ikinciDeger) * yon;
    }

    return satirAnahtari(birinci).localeCompare(satirAnahtari(ikinci), "tr");
  });
}

export function hapbiIlkIkiVeFarkiHesapla(
  satirlar: readonly HapbiAnalitikSatir[],
  siralama: HapbiAnalitikSiralama,
): HapbiIlkIkiVeFarkSonucu {
  const siraliSatirlar = hapbiSatirlariniSirala(satirlar, siralama);
  const birinci = siraliSatirlar[0] ?? null;
  const ikinci = siraliSatirlar[1] ?? null;
  const birinciDeger = birinci ? olcumDegeri(birinci, siralama.olcut) : null;
  const ikinciDeger = ikinci ? olcumDegeri(ikinci, siralama.olcut) : null;

  return {
    birinci,
    ikinci,
    fark: birinciDeger === null || ikinciDeger === null
      ? null
      : Math.abs(birinciDeger - ikinciDeger),
  };
}
