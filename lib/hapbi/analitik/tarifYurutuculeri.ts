import type {
  HapbiAnalitikOlcut,
  HapbiAnalitikSatir,
  HapbiAnalitikSonuc,
  HapbiAnalitikVarlik,
} from "@/lib/hapbi/analitik/sozlesme";
import {
  hapbiIlkIkiVeFarkiHesapla,
  hapbiOlcutuTopla,
  hapbiSatirlariniSirala,
  type HapbiIlkIkiVeFarkSonucu,
} from "@/lib/hapbi/analitik/toplayici";
import type { HapbiSecilmisTarif } from "@/lib/hapbi/niyet/tarifSecici";
import type { HapbiTarif } from "@/lib/hapbi/niyet/tarifler";

export interface HapbiTarifYurutmeGirdisi {
  secilmisTarif: HapbiSecilmisTarif;
  analitikSonuc: HapbiAnalitikSonuc;
}

export interface HapbiTarifYurutmeSonucu {
  tarif: HapbiTarif;
  satirlar: HapbiAnalitikSatir[];
  toplamlar: Partial<Record<HapbiAnalitikOlcut, number | null>>;
  ilkIkiVeFark?: HapbiIlkIkiVeFarkSonucu;
  kisiselSira?: number | null;
  urunUttKatkisi?: HapbiUrunUttKatkisiSonucu;
}

export interface HapbiUrunUttKatkisiSonucu {
  urun: HapbiAnalitikVarlik | null;
  urunPuani: number | null;
  utt: HapbiAnalitikVarlik | null;
  uttKatkisi: number | null;
}

export type HapbiTarifYurutucu = (
  girdi: HapbiTarifYurutmeGirdisi,
) => HapbiTarifYurutmeSonucu;

function ilkOlcut(girdi: HapbiTarifYurutmeGirdisi): HapbiAnalitikOlcut {
  const olcut = girdi.secilmisTarif.olcutler[0];
  if (!olcut) throw new Error("Tarif yürütmek için en az bir ölçüt gereklidir.");
  return olcut;
}

function toplamlar(
  girdi: HapbiTarifYurutmeGirdisi,
): HapbiTarifYurutmeSonucu["toplamlar"] {
  return Object.fromEntries(
    girdi.secilmisTarif.olcutler.map((olcut) => [
      olcut,
      hapbiOlcutuTopla(girdi.analitikSonuc.satirlar, olcut),
    ]),
  );
}

function temelSonuc(
  girdi: HapbiTarifYurutmeGirdisi,
  satirlar: HapbiAnalitikSatir[] = girdi.analitikSonuc.satirlar,
): HapbiTarifYurutmeSonucu {
  return {
    tarif: girdi.secilmisTarif.tarif,
    satirlar,
    toplamlar: toplamlar(girdi),
  };
}

function azalanSirala(girdi: HapbiTarifYurutmeGirdisi): HapbiAnalitikSatir[] {
  return hapbiSatirlariniSirala(girdi.analitikSonuc.satirlar, {
    olcut: ilkOlcut(girdi),
    yon: "azalan",
  });
}

function lideriYurut(girdi: HapbiTarifYurutmeGirdisi): HapbiTarifYurutmeSonucu {
  const olcut = ilkOlcut(girdi);
  const siraliSatirlar = azalanSirala(girdi);
  const enYuksekDeger = siraliSatirlar[0]?.olcumler[olcut];
  const liderler = enYuksekDeger === undefined || enYuksekDeger === null
    ? []
    : siraliSatirlar.filter((satir) => satir.olcumler[olcut] === enYuksekDeger);
  return temelSonuc(girdi, liderler);
}

function ilkIkiVeFarkiYurut(
  girdi: HapbiTarifYurutmeGirdisi,
): HapbiTarifYurutmeSonucu {
  const siralama = { olcut: ilkOlcut(girdi), yon: "azalan" } as const;
  const ilkIkiVeFark = hapbiIlkIkiVeFarkiHesapla(
    girdi.analitikSonuc.satirlar,
    siralama,
  );

  return {
    ...temelSonuc(
      girdi,
      [ilkIkiVeFark.birinci, ilkIkiVeFark.ikinci]
        .filter((satir): satir is HapbiAnalitikSatir => satir !== null),
    ),
    ilkIkiVeFark,
  };
}

function kullaniciKimligi(satir: HapbiAnalitikSatir): string | null {
  const kullanici = satir.boyutlar.kullanici;
  return kullanici && typeof kullanici === "object" ? kullanici.id : null;
}

function kisiselPuaniVeSirayiYurut(
  girdi: HapbiTarifYurutmeGirdisi,
): HapbiTarifYurutmeSonucu {
  const siraliSatirlar = azalanSirala(girdi);
  const sira = siraliSatirlar.findIndex((satir) =>
    kullaniciKimligi(satir) === girdi.analitikSonuc.sorgu.kapsam.kullanici_id);

  return {
    ...temelSonuc(girdi, sira === -1 ? [] : [siraliSatirlar[sira]]),
    kisiselSira: sira === -1 ? null : sira + 1,
  };
}

interface VarlikGrubu {
  varlik: HapbiAnalitikVarlik;
  satirlar: HapbiAnalitikSatir[];
  toplam: number | null;
}

function satirdakiVarlik(
  satir: HapbiAnalitikSatir,
  boyut: "urun" | "kullanici",
): HapbiAnalitikVarlik | null {
  const deger = satir.boyutlar[boyut];
  return deger && typeof deger === "object" ? deger : null;
}

function varlikBazindaGrupla(
  satirlar: readonly HapbiAnalitikSatir[],
  boyut: "urun" | "kullanici",
  olcut: HapbiAnalitikOlcut,
): VarlikGrubu[] {
  const gruplar = new Map<string, { varlik: HapbiAnalitikVarlik; satirlar: HapbiAnalitikSatir[] }>();

  for (const satir of satirlar) {
    const varlik = satirdakiVarlik(satir, boyut);
    if (!varlik) continue;
    const grup = gruplar.get(varlik.id) ?? { varlik, satirlar: [] };
    grup.satirlar.push(satir);
    gruplar.set(varlik.id, grup);
  }

  return [...gruplar.values()].map((grup) => ({
    ...grup,
    toplam: hapbiOlcutuTopla(grup.satirlar, olcut),
  }));
}

function enYuksekGrubuSec(gruplar: readonly VarlikGrubu[]): VarlikGrubu | null {
  return [...gruplar].sort((birinci, ikinci) => {
    if (birinci.toplam === null && ikinci.toplam !== null) return 1;
    if (birinci.toplam !== null && ikinci.toplam === null) return -1;
    if (birinci.toplam !== null && ikinci.toplam !== null && birinci.toplam !== ikinci.toplam) {
      return ikinci.toplam - birinci.toplam;
    }
    const adFarki = birinci.varlik.ad.localeCompare(ikinci.varlik.ad, "tr");
    return adFarki === 0 ? birinci.varlik.id.localeCompare(ikinci.varlik.id, "tr") : adFarki;
  })[0] ?? null;
}

function urunUttKatkisiniYurut(
  girdi: HapbiTarifYurutmeGirdisi,
): HapbiTarifYurutmeSonucu {
  const olcut = ilkOlcut(girdi);
  const urunGrubu = enYuksekGrubuSec(
    varlikBazindaGrupla(girdi.analitikSonuc.satirlar, "urun", olcut),
  );
  const uttGrubu = urunGrubu
    ? enYuksekGrubuSec(varlikBazindaGrupla(urunGrubu.satirlar, "kullanici", olcut))
    : null;

  return {
    ...temelSonuc(girdi, urunGrubu?.satirlar ?? []),
    urunUttKatkisi: {
      urun: urunGrubu?.varlik ?? null,
      urunPuani: urunGrubu?.toplam ?? null,
      utt: uttGrubu?.varlik ?? null,
      uttKatkisi: uttGrubu?.toplam ?? null,
    },
  };
}

function dagiliminiYurut(girdi: HapbiTarifYurutmeGirdisi): HapbiTarifYurutmeSonucu {
  return temelSonuc(girdi);
}

const TARIF_YURUTUCULERI: Readonly<Record<HapbiTarif, HapbiTarifYurutucu>> = {
  lig_lideri: lideriYurut,
  ilk_iki_ve_fark: ilkIkiVeFarkiYurut,
  kisisel_puan_ve_sira: kisiselPuaniVeSirayiYurut,
  en_yuksek_urun: lideriYurut,
  urun_utt_katkisi: urunUttKatkisiniYurut,
  en_iyi_urun_ve_utt_katkisi: urunUttKatkisiniYurut,
  kisi_urun_dagilimi: dagiliminiYurut,
  takim_urun_dagilimi: dagiliminiYurut,
  firma_takim_dagilimi: dagiliminiYurut,
  takim_bm_kapsami_dagilimi: dagiliminiYurut,
  kayip_kisi_dagilimi: dagiliminiYurut,
  kayip_urun_dagilimi: dagiliminiYurut,
  donem_karsilastirmasi: dagiliminiYurut,
  uretim_dagilimi: dagiliminiYurut,
};

export function hapbiTarifiniYurut(
  girdi: HapbiTarifYurutmeGirdisi,
): HapbiTarifYurutmeSonucu {
  return TARIF_YURUTUCULERI[girdi.secilmisTarif.tarif](girdi);
}
