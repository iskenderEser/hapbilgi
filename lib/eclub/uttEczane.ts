import type { SupabaseClient } from "@supabase/supabase-js";

interface UttEczaneFirmaBagi {
  eczaneFirmaId: string;
  eczaneId: string;
  firmaId: string;
  createdAt: string;
}

export async function uttEczaneFirmaBaglari(
  adminSupabase: SupabaseClient,
  uttId: string,
): Promise<UttEczaneFirmaBagi[]> {
  const { data: uyelikler, error: uyelikError } = await adminSupabase
    .from("eclub_utt_eczane")
    .select("eczane_firma_id, created_at")
    .eq("utt_id", uttId)
    .eq("aktif_mi", true);

  if (uyelikError) throw new Error(`eclub_utt_eczane SELECT: ${uyelikError.message}`);

  const createdAtMap = new Map<string, string>();
  for (const uyelik of uyelikler ?? []) {
    createdAtMap.set(uyelik.eczane_firma_id, uyelik.created_at);
  }
  const eczaneFirmaIdler = [...createdAtMap.keys()];
  if (eczaneFirmaIdler.length === 0) return [];

  const { data: firmaBaglari, error: firmaBagError } = await adminSupabase
    .from("eclub_eczane_firma")
    .select("id, eczane_id, firma_id")
    .in("id", eczaneFirmaIdler)
    .eq("aktif_mi", true);

  if (firmaBagError) throw new Error(`eclub_eczane_firma SELECT: ${firmaBagError.message}`);

  return (firmaBaglari ?? []).map((bag) => ({
    eczaneFirmaId: bag.id,
    eczaneId: bag.eczane_id,
    firmaId: bag.firma_id,
    createdAt: createdAtMap.get(bag.id) ?? new Date(0).toISOString(),
  }));
}

export async function uttEczaneYetkisiVarMi(
  adminSupabase: SupabaseClient,
  uttId: string,
  eczaneId: string,
  firmaId?: string,
): Promise<boolean> {
  const baglar = await uttEczaneFirmaBaglari(adminSupabase, uttId);
  return baglar.some((bag) =>
    bag.eczaneId === eczaneId && (!firmaId || bag.firmaId === firmaId)
  );
}
