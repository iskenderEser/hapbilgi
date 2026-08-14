import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ECLUB_YONETIM_ROLLERI,
  TUKETICI_ROLLER,
  URETICI_ROLLER,
} from "@/lib/utils/roller";
import { ureticiYetenegi } from "@/lib/uretici/yetenekler";

export type EclubYonetimGorunumu = "utt" | "bm" | "tm" | "uretici" | "yonetici";

export interface EclubKapsamUtt {
  utt_id: string;
  utt_adi: string;
  rol: string;
  takim_id: string | null;
  takim_adi: string;
  bm_id: string | null;
  bm_adi: string;
  bolge_id: string | null;
  bolge_adi: string;
}

export interface EclubKapsamBm {
  bm_id: string;
  bm_adi: string;
  bolge_id: string | null;
  bolge_adi: string;
  uttler: EclubKapsamUtt[];
}

export interface EclubKapsamTakim {
  takim_id: string;
  takim_adi: string;
  bmler: EclubKapsamBm[];
}

export interface EclubYonetimKapsami {
  gorunum: EclubYonetimGorunumu;
  ana_katman: "utt" | "bm" | "takim";
  kapsam_adi: string;
  takimlar: EclubKapsamTakim[];
  uttler: EclubKapsamUtt[];
}

export interface EclubOturumKullanicisi {
  kullanici_id: string;
  ad: string | null;
  soyad: string | null;
  rol: string | null;
  firma_id: string | null;
  takim_id: string | null;
  bolge_id: string | null;
}

type KullaniciSatiri = EclubOturumKullanicisi;

const tamAd = (kullanici: Pick<KullaniciSatiri, "ad" | "soyad">) => (
  `${kullanici.ad ?? ""} ${kullanici.soyad ?? ""}`.trim() || "—"
);

function gorunumuBul(rol: string): EclubYonetimGorunumu {
  if (TUKETICI_ROLLER.includes(rol)) return "utt";
  if (rol === "bm") return "bm";
  if (rol === "tm") return "tm";
  if (URETICI_ROLLER.includes(rol)) return "uretici";
  return "yonetici";
}

export async function eclubYonetimKapsaminiGetir(
  supabase: SupabaseClient,
  kullanici: EclubOturumKullanicisi,
): Promise<EclubYonetimKapsami> {
  const rol = (kullanici.rol ?? "").toLowerCase();
  if (!ECLUB_YONETIM_ROLLERI.includes(rol)) {
    throw new Error("E-Club yönetim kapsamına erişim yetkiniz yok.");
  }

  if (TUKETICI_ROLLER.includes(rol)) {
    return {
      gorunum: "utt",
      ana_katman: "utt",
      kapsam_adi: tamAd(kullanici),
      takimlar: [],
      uttler: [{
        utt_id: kullanici.kullanici_id,
        utt_adi: tamAd(kullanici),
        rol,
        takim_id: kullanici.takim_id,
        takim_adi: "Takımım",
        bm_id: null,
        bm_adi: "—",
        bolge_id: kullanici.bolge_id,
        bolge_adi: "—",
      }],
    };
  }

  if (!kullanici.firma_id) throw new Error("E-Club yönetim kapsamı için firma ataması gerekli.");

  const gorunum = gorunumuBul(rol);
  const yetenek = URETICI_ROLLER.includes(rol) ? ureticiYetenegi(rol) : null;
  const takimlaSinirli = rol === "tm" || rol === "bm" || yetenek?.raporScope === "takim";
  if (takimlaSinirli && !kullanici.takim_id) {
    throw new Error("E-Club yönetim kapsamı için takım ataması gerekli.");
  }
  if (rol === "bm" && !kullanici.bolge_id) {
    throw new Error("BM E-Club kapsamı için bölge ataması gerekli.");
  }

  let bmSorgusu = supabase
    .from("kullanicilar")
    .select("kullanici_id, ad, soyad, rol, firma_id, takim_id, bolge_id")
    .eq("firma_id", kullanici.firma_id)
    .eq("rol", "bm")
    .eq("aktif_mi", true);
  let uttSorgusu = supabase
    .from("kullanicilar")
    .select("kullanici_id, ad, soyad, rol, firma_id, takim_id, bolge_id")
    .eq("firma_id", kullanici.firma_id)
    .in("rol", TUKETICI_ROLLER)
    .eq("aktif_mi", true);

  if (takimlaSinirli && kullanici.takim_id) {
    bmSorgusu = bmSorgusu.eq("takim_id", kullanici.takim_id);
    uttSorgusu = uttSorgusu.eq("takim_id", kullanici.takim_id);
  }
  if (rol === "bm" && kullanici.bolge_id) {
    uttSorgusu = uttSorgusu.eq("bolge_id", kullanici.bolge_id);
  }

  const [bmSonucu, uttSonucu, firmaSonucu] = await Promise.all([
    rol === "bm"
      ? Promise.resolve({ data: [kullanici] as KullaniciSatiri[], error: null })
      : bmSorgusu,
    uttSorgusu,
    supabase.from("firmalar").select("firma_adi").eq("firma_id", kullanici.firma_id).maybeSingle(),
  ]);
  if (bmSonucu.error) throw new Error(`BM kapsamı alınamadı: ${bmSonucu.error.message}`);
  if (uttSonucu.error) throw new Error(`UTT kapsamı alınamadı: ${uttSonucu.error.message}`);
  if (firmaSonucu.error) throw new Error(`Firma adı alınamadı: ${firmaSonucu.error.message}`);

  const bmler = (bmSonucu.data ?? []) as KullaniciSatiri[];
  const uttler = (uttSonucu.data ?? []) as KullaniciSatiri[];
  const takimIdleri = [...new Set([...bmler, ...uttler].map((satir) => satir.takim_id).filter((id): id is string => Boolean(id)))];
  const bolgeIdleri = [...new Set([...bmler, ...uttler].map((satir) => satir.bolge_id).filter((id): id is string => Boolean(id)))];

  const [takimSonucu, bolgeSonucu] = await Promise.all([
    takimIdleri.length > 0
      ? supabase.from("takimlar").select("takim_id, takim_adi").in("takim_id", takimIdleri)
      : Promise.resolve({ data: [], error: null }),
    bolgeIdleri.length > 0
      ? supabase.from("bolgeler").select("bolge_id, bolge_adi").in("bolge_id", bolgeIdleri)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (takimSonucu.error) throw new Error(`Takım adları alınamadı: ${takimSonucu.error.message}`);
  if (bolgeSonucu.error) throw new Error(`Bölge adları alınamadı: ${bolgeSonucu.error.message}`);

  const takimAdlari = new Map((takimSonucu.data ?? []).map((takim) => [String(takim.takim_id), String(takim.takim_adi ?? "—")]));
  const bolgeAdlari = new Map((bolgeSonucu.data ?? []).map((bolge) => [String(bolge.bolge_id), String(bolge.bolge_adi ?? "—")]));
  const bmAnahtari = (takimId: string | null, bolgeId: string | null) => `${takimId ?? "yok"}:${bolgeId ?? "yok"}`;
  const bmHaritasi = new Map(bmler.map((bm) => [bmAnahtari(bm.takim_id, bm.bolge_id), bm]));

  const duzUttler: EclubKapsamUtt[] = uttler.map((utt) => {
    const bm = bmHaritasi.get(bmAnahtari(utt.takim_id, utt.bolge_id)) ?? null;
    return {
      utt_id: utt.kullanici_id,
      utt_adi: tamAd(utt),
      rol: (utt.rol ?? "utt").toLowerCase(),
      takim_id: utt.takim_id,
      takim_adi: utt.takim_id ? takimAdlari.get(utt.takim_id) ?? "—" : "Takımsız",
      bm_id: bm?.kullanici_id ?? null,
      bm_adi: bm ? tamAd(bm) : "BM ataması bulunmuyor",
      bolge_id: utt.bolge_id,
      bolge_adi: utt.bolge_id ? bolgeAdlari.get(utt.bolge_id) ?? "—" : "Bölgesiz",
    };
  }).sort((a, b) => a.utt_adi.localeCompare(b.utt_adi, "tr"));

  const takimMap = new Map<string, EclubKapsamTakim>();
  for (const bmSatiri of bmler) {
    const takimId = bmSatiri.takim_id ?? "takimsiz";
    let takim = takimMap.get(takimId);
    if (!takim) {
      takim = {
        takim_id: takimId,
        takim_adi: bmSatiri.takim_id ? takimAdlari.get(bmSatiri.takim_id) ?? "—" : "Takımsız",
        bmler: [],
      };
      takimMap.set(takimId, takim);
    }
    takim.bmler.push({
      bm_id: bmSatiri.kullanici_id,
      bm_adi: tamAd(bmSatiri),
      bolge_id: bmSatiri.bolge_id,
      bolge_adi: bmSatiri.bolge_id ? bolgeAdlari.get(bmSatiri.bolge_id) ?? "—" : "Bölgesiz",
      uttler: [],
    });
  }

  for (const utt of duzUttler) {
    const takimId = utt.takim_id ?? "takimsiz";
    let takim = takimMap.get(takimId);
    if (!takim) {
      takim = { takim_id: takimId, takim_adi: utt.takim_adi, bmler: [] };
      takimMap.set(takimId, takim);
    }
    const bmId = utt.bm_id ?? `atanmamis:${utt.bolge_id ?? "bolgesiz"}`;
    let bm = takim.bmler.find((satir) => satir.bm_id === bmId);
    if (!bm) {
      bm = { bm_id: bmId, bm_adi: utt.bm_adi, bolge_id: utt.bolge_id, bolge_adi: utt.bolge_adi, uttler: [] };
      takim.bmler.push(bm);
    }
    bm.uttler.push(utt);
  }

  const takimlar = [...takimMap.values()]
    .map((takim) => ({
      ...takim,
      bmler: takim.bmler.sort((a, b) => a.bm_adi.localeCompare(b.bm_adi, "tr")),
    }))
    .sort((a, b) => a.takim_adi.localeCompare(b.takim_adi, "tr"));

  const kapsamAdi = takimlaSinirli && takimlar[0]
    ? takimlar[0].takim_adi
    : String(firmaSonucu.data?.firma_adi ?? "Firma sahası");

  const anaKatman = gorunum === "bm"
    ? "utt"
    : gorunum === "tm" || (gorunum === "uretici" && yetenek?.raporScope === "takim")
      ? "bm"
      : "takim";

  return { gorunum, ana_katman: anaKatman, kapsam_adi: kapsamAdi, takimlar, uttler: duzUttler };
}

export function eclubYonetimRoluMu(rol: string): boolean {
  return ECLUB_YONETIM_ROLLERI.includes(rol.toLowerCase());
}
