import type {
  KullaniciKategoriDagilimi,
  KullaniciOzetSatiri,
  KullaniciUrunDagilimi,
} from '@/lib/rapor/bm/getBmData';

const PUAN_ALANLARI = [
  'video_puani',
  'soru_puani',
  'oneri_puani',
  'extra_puan',
  'ileri_sarma_kaybi',
  'yanlis_cevap_kaybi',
  'oneri_kaybi',
  'toplam_net_puan',
] as const;

type PuanAlani = (typeof PUAN_ALANLARI)[number];
export type PuanToplami = Record<PuanAlani, number>;
type TeknikDagilimi = Array<{ teknik_adi: string; izlenme_sayisi: number }>;

const sayi = (deger: unknown) => Number(deger ?? 0);

export const bosPuanToplami = (): PuanToplami => Object.fromEntries(
  PUAN_ALANLARI.map(alan => [alan, 0])
) as PuanToplami;

export function ozetToplami(satirlar: KullaniciOzetSatiri[]): PuanToplami {
  return satirlar.reduce((toplam, satir) => {
    for (const alan of PUAN_ALANLARI) toplam[alan] += sayi(satir[alan]);
    return toplam;
  }, bosPuanToplami());
}

function teknikleriTopla(
  hedef: Map<string, number>,
  teknikler: TeknikDagilimi | null | undefined
) {
  for (const teknik of teknikler ?? []) {
    hedef.set(teknik.teknik_adi, (hedef.get(teknik.teknik_adi) ?? 0) + sayi(teknik.izlenme_sayisi));
  }
}

function teknikleriSirala(teknikler: Map<string, number>): TeknikDagilimi {
  return [...teknikler]
    .map(([teknik_adi, izlenme_sayisi]) => ({ teknik_adi, izlenme_sayisi }))
    .sort((a, b) => b.izlenme_sayisi - a.izlenme_sayisi || a.teknik_adi.localeCompare(b.teknik_adi, 'tr'));
}

export function kategorileriTopla(satirlar: KullaniciKategoriDagilimi[]) {
  const gruplar = new Map<string, PuanToplami & {
    icerik_turu: string;
    izlenme_sayisi: number;
    teknikler: Map<string, number>;
  }>();

  for (const satir of satirlar) {
    const grup = gruplar.get(satir.icerik_turu) ?? {
      icerik_turu: satir.icerik_turu,
      izlenme_sayisi: 0,
      teknikler: new Map<string, number>(),
      ...bosPuanToplami(),
    };
    grup.izlenme_sayisi += sayi(satir.izlenme_sayisi);
    for (const alan of PUAN_ALANLARI) grup[alan] += sayi(satir[alan]);
    teknikleriTopla(grup.teknikler, satir.teknik_dagilimi);
    gruplar.set(satir.icerik_turu, grup);
  }

  return [...gruplar.values()].map(({ teknikler, ...grup }) => ({
    ...grup,
    teknik_dagilimi: teknikleriSirala(teknikler),
  }));
}

export function urunleriTopla(satirlar: KullaniciUrunDagilimi[]) {
  const gruplar = new Map<string, PuanToplami & {
    urun_id: string;
    urun_adi: string;
    izlenme_sayisi: number;
    teknikler: Map<string, number>;
  }>();

  for (const satir of satirlar) {
    const grup = gruplar.get(satir.urun_id) ?? {
      urun_id: satir.urun_id,
      urun_adi: satir.urun_adi,
      izlenme_sayisi: 0,
      teknikler: new Map<string, number>(),
      ...bosPuanToplami(),
    };
    grup.izlenme_sayisi += sayi(satir.izlenme_sayisi);
    for (const alan of PUAN_ALANLARI) grup[alan] += sayi(satir[alan]);
    teknikleriTopla(grup.teknikler, satir.teknik_dagilimi);
    gruplar.set(satir.urun_id, grup);
  }

  return [...gruplar.values()]
    .map(({ teknikler, ...grup }) => ({
      ...grup,
      teknik_dagilimi: teknikleriSirala(teknikler),
    }))
    .sort((a, b) => b.toplam_net_puan - a.toplam_net_puan || a.urun_adi.localeCompare(b.urun_adi, 'tr'));
}
