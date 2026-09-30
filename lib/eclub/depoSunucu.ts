import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DepoKonumu } from "./depo";

export async function depoKataloguGetir(db: SupabaseClient): Promise<DepoKonumu[]> {
  const [depolar, konumlar] = await Promise.all([
    db.from("ecza_depolari").select("depo_id, depo_adi, aktif_mi").order("depo_adi"),
    db.from("ecza_depo_subeleri").select("depo_sube_id, depo_id, sube_adi, il, ilce, adres, aktif_mi").order("il").order("ilce"),
  ]);
  if (depolar.error || konumlar.error) throw new Error(depolar.error?.message ?? konumlar.error?.message);
  const adlar = new Map((depolar.data ?? []).map((d) => [d.depo_id, d]));
  return (konumlar.data ?? []).map((k) => ({ ...k,
    depo_adi: adlar.get(k.depo_id)?.depo_adi ?? "Depo",
    aktif_mi: k.aktif_mi && adlar.get(k.depo_id)?.aktif_mi === true,
  }));
}
