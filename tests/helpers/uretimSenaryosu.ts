import type { OgrenmeAraciTuru } from "../../lib/ogrenmeAraci/tipler.ts";
import type { Adim, AktifGorevDurumu, SeritTalebi } from "../../lib/utils/uretimSeridi.ts";
import { adimlariCoz } from "../../lib/utils/uretimSeridi.ts";
import type { ZincirSatiri } from "../../lib/utils/uretimZinciri.ts";

export type UretimVaryanti = "V1" | "V2" | "V3" | "V4";

const VARYANT: Record<UretimVaryanti, Pick<SeritTalebi, "hazir_video" | "hazir_soru_seti">> = {
  V1: { hazir_video: false, hazir_soru_seti: false },
  V2: { hazir_video: true, hazir_soru_seti: false },
  V3: { hazir_video: false, hazir_soru_seti: true },
  V4: { hazir_video: true, hazir_soru_seti: true },
};

export function senaryoTalebi(aracTuru: OgrenmeAraciTuru, varyant: UretimVaryanti): SeritTalebi {
  return {
    talep_id: `test-${aracTuru}-${varyant.toLowerCase()}`,
    ogrenme_araci_turu: aracTuru,
    ...VARYANT[varyant],
    created_at: "2026-09-16T08:00:00.000Z",
  };
}

export function bosUretimZinciri(talepId: string): ZincirSatiri {
  return {
    talep_id: talepId,
    senaryo_id: null, senaryo_iu_id: null, senaryo_durum: null, senaryo_durum_tarih: null,
    video_id: null, video_iu_id: null, video_durum: null, video_durum_tarih: null,
    soru_seti_id: null, soru_seti_iu_id: null, soru_seti_durum: null, soru_seti_durum_tarih: null,
    yayin_durum: null, yayin_tarihi: null,
  };
}

export function senaryoAdimlari(
  talep: SeritTalebi,
  zincir: ZincirSatiri = bosUretimZinciri(talep.talep_id),
  aktifGorev: AktifGorevDurumu | null = null,
): Adim[] {
  return adimlariCoz(talep, zincir, aktifGorev);
}

export function aktifAdim(adimlar: Adim[]): Adim | undefined {
  return adimlar.find((adim) => adim.hal === "aktif");
}

export const URETIM_ARACLARI = ["video", "podcast", "gorsel", "flip_pdf"] as const;
export const URETIM_VARYANTLARI = ["V1", "V2", "V3", "V4"] as const;
