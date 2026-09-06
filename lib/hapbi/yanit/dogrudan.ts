import type {
  HapbiAnalitikDonem,
  HapbiAnalitikKapsam,
  HapbiVeriAlani,
} from "@/lib/hapbi/analitik/sozlesme";
import type { HapbiTarifYurutmeSonucu } from "@/lib/hapbi/analitik/tarifYurutuculeri";
import type { HapbiTarif } from "@/lib/hapbi/niyet/tarifler";
import { HapbiHata } from "@/lib/hapbi/sozlesme";
import {
  hapbiYanitKanitlariniOlustur,
  hapbiYanitKaynaginiOlustur,
  type HapbiYanitKaniti,
  type HapbiYanitKaynagi,
} from "@/lib/hapbi/yanit/kanit";
import { hapbiDogrudanMetniniOlustur } from "@/lib/hapbi/yanit/sablonlar";

export interface HapbiDogrudanYanitGirdisi {
  sonuc: HapbiTarifYurutmeSonucu;
  kapsam: HapbiAnalitikKapsam;
  veriAlani: HapbiVeriAlani;
  donem: HapbiAnalitikDonem;
  soru?: string;
}

export interface HapbiDogrudanYanit {
  cevap: string;
  tarif: HapbiTarif;
  kaynaklar: HapbiYanitKaynagi[];
  kanitlar: HapbiYanitKaniti[];
  kanitIdleri: string[];
  model: "deterministik";
  modelCagrisi: 0;
  tokenSayisi: 0;
}

function sayisalSonucVarMi(sonuc: HapbiTarifYurutmeSonucu): boolean {
  const satirDegerleri = sonuc.satirlar.flatMap((satir) => Object.values(satir.olcumler));
  const toplamDegerleri = Object.values(sonuc.toplamlar);
  const urunUttDegerleri = sonuc.urunUttKatkisi
    ? [sonuc.urunUttKatkisi.urunPuani, sonuc.urunUttKatkisi.uttKatkisi]
    : [];
  return [...satirDegerleri, ...toplamDegerleri, ...urunUttDegerleri]
    .some((deger) => typeof deger === "number" && Number.isFinite(deger));
}

export function hapbiDogrudanYanitUret(
  girdi: HapbiDogrudanYanitGirdisi,
): HapbiDogrudanYanit {
  const kanitBaglami = { veriAlani: girdi.veriAlani, donem: girdi.donem };
  const kaynak = hapbiYanitKaynaginiOlustur(kanitBaglami);
  const kanitlar = hapbiYanitKanitlariniOlustur(girdi.sonuc, kanitBaglami);

  if (sayisalSonucVarMi(girdi.sonuc) && kanitlar.length === 0) {
    throw new HapbiHata(
      "DOGRUDAN_KANIT",
      502,
      "Sayısal HapBi cevabı için kanıt üretilemedi.",
    );
  }
  if (!kaynak.id || !kaynak.url || !kaynak.donem) {
    throw new HapbiHata(
      "DOGRUDAN_KAYNAK",
      502,
      "Sayısal HapBi cevabı için kaynak üretilemedi.",
    );
  }

  return {
    cevap: hapbiDogrudanMetniniOlustur(girdi.sonuc, { kapsam: girdi.kapsam, soru: girdi.soru }),
    tarif: girdi.sonuc.tarif,
    kaynaklar: [kaynak],
    kanitlar,
    kanitIdleri: kanitlar.map((kanit) => kanit.id),
    model: "deterministik",
    modelCagrisi: 0,
    tokenSayisi: 0,
  };
}
