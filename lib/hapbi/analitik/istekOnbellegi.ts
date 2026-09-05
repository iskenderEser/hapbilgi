import type {
  HapbiAnalitikDonem,
  HapbiAnalitikKapsam,
  HapbiVeriAlani,
} from "@/lib/hapbi/analitik/sozlesme";

export interface HapbiYurutmeAnahtariGirdisi {
  kapsam: HapbiAnalitikKapsam;
  veriAlani: HapbiVeriAlani;
  donem: HapbiAnalitikDonem;
}

export function hapbiYurutmeAnahtariOlustur(
  girdi: HapbiYurutmeAnahtariGirdisi,
): string {
  return JSON.stringify([
    girdi.kapsam.kullanici_id,
    girdi.kapsam.tur,
    girdi.kapsam.kaynak_rol,
    girdi.kapsam.firma_id ?? null,
    girdi.kapsam.takim_id ?? null,
    girdi.kapsam.bolge_id ?? null,
    girdi.veriAlani,
    girdi.donem,
  ]);
}

export interface HapbiIstekOnbellegi {
  veriyiOku<T>(
    girdi: HapbiYurutmeAnahtariGirdisi,
    okuyucu: () => Promise<T>,
  ): Promise<T>;
}

export function hapbiIstekOnbellegiOlustur(): HapbiIstekOnbellegi {
  const okumalar = new Map<string, Promise<unknown>>();

  return {
    veriyiOku<T>(
      girdi: HapbiYurutmeAnahtariGirdisi,
      okuyucu: () => Promise<T>,
    ): Promise<T> {
      const anahtar = hapbiYurutmeAnahtariOlustur(girdi);
      const mevcutOkuma = okumalar.get(anahtar);
      if (mevcutOkuma) return mevcutOkuma as Promise<T>;

      const yeniOkuma = okuyucu();
      okumalar.set(anahtar, yeniOkuma);
      return yeniOkuma;
    },
  };
}
