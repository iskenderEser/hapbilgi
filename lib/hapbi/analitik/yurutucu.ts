import type { SupabaseClient } from "@supabase/supabase-js";
import { hapbiCclubAnalitikOku } from "@/lib/hapbi/analitik/cclubOkuyucu";
import { hapbiEclubAnalitikOku } from "@/lib/hapbi/analitik/eclubOkuyucu";
import { hapbiIstekOnbellegiOlustur } from "@/lib/hapbi/analitik/istekOnbellegi";
import type {
  HapbiAnalitikDonem,
  HapbiAnalitikKapsam,
  HapbiAnalitikSiralama,
  HapbiAnalitikSonuc,
  HapbiAnalitikSorgu,
} from "@/lib/hapbi/analitik/sozlesme";
import {
  HAPBI_ANALITIK_SURUMU,
  hapbiAnalitikSorguyuDogrula,
} from "@/lib/hapbi/analitik/sozlesme";
import {
  hapbiTarifiniYurut,
  type HapbiTarifYurutmeSonucu,
} from "@/lib/hapbi/analitik/tarifYurutuculeri";
import { hapbiTclubAnalitikOku } from "@/lib/hapbi/analitik/tclubOkuyucu";
import { hapbiUretimAnalitikOku } from "@/lib/hapbi/analitik/uretimOkuyucu";
import type { HapbiSecilmisTarif } from "@/lib/hapbi/niyet/tarifSecici";
import type { HapbiKaynak } from "@/lib/hapbi/sozlesme";

export interface HapbiYurutulebilirTarif extends HapbiSecilmisTarif {
  siralama?: HapbiAnalitikSiralama;
  limit?: number;
  karsilastirmaDonemi?: HapbiAnalitikDonem;
}

export interface HapbiAnalitikYurutmeGirdisi {
  secilmisTarif: HapbiYurutulebilirTarif;
  kapsam: HapbiAnalitikKapsam;
  kaynak: HapbiKaynak;
}

export interface HapbiAnalitikYurutucuBagimliliklari {
  db: SupabaseClient;
}

export type HapbiAnalitikYurutucu = (
  girdi: HapbiAnalitikYurutmeGirdisi,
) => Promise<HapbiTarifYurutmeSonucu>;

function analitikSorguyuOlustur(
  girdi: HapbiAnalitikYurutmeGirdisi,
): HapbiAnalitikSorgu {
  const { secilmisTarif, kapsam } = girdi;

  return hapbiAnalitikSorguyuDogrula({
    surum: HAPBI_ANALITIK_SURUMU,
    veri_alani: secilmisTarif.veriAlani,
    kapsam,
    donem: secilmisTarif.donem,
    olcutler: secilmisTarif.olcutler,
    boyutlar: secilmisTarif.boyutlar,
    filtreler: secilmisTarif.filtreler,
    islem: secilmisTarif.islem,
    ...(secilmisTarif.siralama ? { siralama: secilmisTarif.siralama } : {}),
    ...(secilmisTarif.limit ? { limit: secilmisTarif.limit } : {}),
    ...(secilmisTarif.karsilastirmaDonemi
      ? { karsilastirma_donemi: secilmisTarif.karsilastirmaDonemi }
      : {}),
  });
}

function analitikVeriyiOku(
  db: SupabaseClient,
  sorgu: HapbiAnalitikSorgu,
  kaynak: HapbiKaynak,
): Promise<HapbiAnalitikSonuc> {
  if (sorgu.veri_alani === "tclub") return hapbiTclubAnalitikOku(db, sorgu, kaynak);
  if (sorgu.veri_alani === "cclub") return hapbiCclubAnalitikOku(db, sorgu, kaynak);
  if (sorgu.veri_alani === "eclub") return hapbiEclubAnalitikOku(db, sorgu, kaynak);
  return hapbiUretimAnalitikOku(db, sorgu, kaynak);
}

export function hapbiAnalitikYurutucuyuOlustur(
  bagimliliklar: HapbiAnalitikYurutucuBagimliliklari,
): HapbiAnalitikYurutucu {
  const onbellek = hapbiIstekOnbellegiOlustur();

  return async (girdi) => {
    const sorgu = analitikSorguyuOlustur(girdi);
    const analitikSonuc = await onbellek.veriyiOku(
      {
        kapsam: girdi.kapsam,
        veriAlani: sorgu.veri_alani,
        donem: sorgu.donem,
      },
      () => analitikVeriyiOku(bagimliliklar.db, sorgu, girdi.kaynak),
    );

    return hapbiTarifiniYurut({
      secilmisTarif: girdi.secilmisTarif,
      analitikSonuc,
    });
  };
}
