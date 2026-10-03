import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ECLUB_YONETIM_ROLLERI,
  TUKETICI_ROLLER,
  URETICI_ROLLER,
} from "@/lib/utils/roller";
import { ureticiYetenegi } from "@/lib/uretici/yetenekler";

export interface EclubKapsamUtt {
  utt_id: string;
  rol: string;
  utt_adi: string;
  takim_adi: string;
  bm_id: string | null;
  bm_adi: string;
  bolge_adi: string;
}

export interface EclubYonetimKapsami {
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
      uttler: [{
        utt_id: kullanici.kullanici_id,
        rol,
        utt_adi: tamAd(kullanici),
        takim_adi: "Takımım",
        bm_id: null,
        bm_adi: "—",
        bolge_adi: "—",
      }],
    };
  }

  if (!kullanici.firma_id) throw new Error("E-Club yönetim kapsamı için firma ataması gerekli.");

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

  const [bmSonucu, uttSonucu] = await Promise.all([
    rol === "bm"
      ? Promise.resolve({ data: [kullanici] as KullaniciSatiri[], error: null })
      : bmSorgusu,
    uttSorgusu,
  ]);
  if (bmSonucu.error) throw new Error(`BM kapsamı alınamadı: ${bmSonucu.error.message}`);
  if (uttSonucu.error) throw new Error(`UTT kapsamı alınamadı: ${uttSonucu.error.message}`);

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
      rol: (utt.rol ?? "").toLowerCase(),
      utt_adi: tamAd(utt),
      takim_adi: utt.takim_id ? takimAdlari.get(utt.takim_id) ?? "—" : "Takımsız",
      bm_id: bm?.kullanici_id ?? null,
      bm_adi: bm ? tamAd(bm) : "BM ataması bulunmuyor",
      bolge_adi: utt.bolge_id ? bolgeAdlari.get(utt.bolge_id) ?? "—" : "Bölgesiz",
    };
  }).sort((a, b) => a.utt_adi.localeCompare(b.utt_adi, "tr"));

  return { uttler: duzUttler };
}
