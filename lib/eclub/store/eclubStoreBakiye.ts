import type { SupabaseClient } from "@supabase/supabase-js";
import type { EclubStoreFirmaBakiye } from "./eclubStoreTipler";

export async function eclubStoreFirmaBakiye(
  supabase: SupabaseClient,
  kisiId: string
): Promise<EclubStoreFirmaBakiye[]> {
  const { data, error } = await supabase.rpc("get_eclub_store_firma_bakiye", {
    p_kisi_id: kisiId,
  });

  if (error) {
    console.error("[lib/eclub/store/bakiye] eclubStoreFirmaBakiye hatası:", error.message);
    return [];
  }

  return (data ?? []) as EclubStoreFirmaBakiye[];
}

export async function eclubStoreToplamBakiye(
  supabase: SupabaseClient,
  kisiId: string
): Promise<number> {
  const firmalar = await eclubStoreFirmaBakiye(supabase, kisiId);
  return firmalar.reduce((acc, f) => acc + (f.bakiye ?? 0), 0);
}