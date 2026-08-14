import type { SupabaseClient } from "@supabase/supabase-js";
import { FIRMA_KOLONLARI } from "@/lib/firma/kolonlar";

interface EclubFirmaModulSatiri {
  firma_id: string;
  firma_adi: string;
  aktif: boolean | null;
  eclub_aktif: boolean | null;
  eclub_store_aktif: boolean | null;
}

export interface EclubKisiErisimSonucu {
  kisi: {
    kisi_id: string;
    rol: string;
    ad: string;
    soyad: string;
    eposta: string;
    telefon: string;
  } | null;
  eczane_idler: string[];
  firmalar: EclubFirmaModulSatiri[];
  eclub_aktif: boolean;
  eclub_store_aktif: boolean;
}

export function eclubKisiModulDurumu(firmalar: EclubFirmaModulSatiri[]) {
  const aktifFirmalar = firmalar.filter((firma) => firma.aktif !== false && firma.eclub_aktif === true);
  return {
    eclub_aktif: aktifFirmalar.length > 0,
    eclub_store_aktif: aktifFirmalar.some((firma) => firma.eclub_store_aktif === true),
  };
}

/** E-Club kişisinin aktif eczane → firma zincirinden modül erişimini çözer. */
export async function eclubKisiErisimi(
  supabase: SupabaseClient,
  authUserId: string
): Promise<EclubKisiErisimSonucu> {
  const { data: kisi, error: kisiError } = await supabase
    .from("eclub_kisiler")
    .select("kisi_id, rol, ad, soyad, eposta, telefon")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (kisiError) throw new Error(`eclub_kisiler SELECT: ${kisiError.message}`);
  if (!kisi) return { kisi: null, eczane_idler: [], firmalar: [], eclub_aktif: false, eclub_store_aktif: false };

  const { data: kisiBaglari, error: bagError } = await supabase
    .from("eclub_kisi_eczane")
    .select("eczane_id")
    .eq("kisi_id", kisi.kisi_id)
    .eq("aktif_mi", true);
  if (bagError) throw new Error(`eclub_kisi_eczane SELECT: ${bagError.message}`);

  const eczaneIdler = [...new Set((kisiBaglari ?? []).map((bag) => bag.eczane_id))];
  if (eczaneIdler.length === 0) {
    return { kisi, eczane_idler: [], firmalar: [], eclub_aktif: false, eclub_store_aktif: false };
  }

  const { data: firmaBaglari, error: firmaBagError } = await supabase
    .from("eclub_eczane_firma")
    .select("firma_id")
    .in("eczane_id", eczaneIdler)
    .eq("aktif_mi", true);
  if (firmaBagError) throw new Error(`eclub_eczane_firma SELECT: ${firmaBagError.message}`);

  const firmaIdler = [...new Set((firmaBaglari ?? []).map((bag) => bag.firma_id))];
  if (firmaIdler.length === 0) {
    return { kisi, eczane_idler: eczaneIdler, firmalar: [], eclub_aktif: false, eclub_store_aktif: false };
  }

  const { data: firmalar, error: firmaError } = await supabase
    .from("firmalar")
    .select(FIRMA_KOLONLARI)
    .in("firma_id", firmaIdler);
  if (firmaError) throw new Error(`firmalar SELECT — E-Club kişi erişimi: ${firmaError.message}`);

  const firmaSatirlari = (firmalar ?? []) as EclubFirmaModulSatiri[];
  return {
    kisi,
    eczane_idler: eczaneIdler,
    firmalar: firmaSatirlari,
    ...eclubKisiModulDurumu(firmaSatirlari),
  };
}
