import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { puanKazanilabilirMi } from "@/lib/zaman/kontrol";

/**
 * Mesai (puanlı zaman) kapısı — üç izleme kapısının TEK KAYNAĞI:
 * baslat (kayıt açma), bitir (puan/soru), ileri-sarma.
 *
 * Test için admin panelindeki "mesai_bypass" düğmesi (sistem_ayarlari) kapıyı
 * atlatır: değer 1 iken mesai içi gibi davranır (kayıt + puan + soru akışı test
 * edilir), 0/ayarsız iken gerçek kural çalışır (mesai dışı → modal + kayıtsız).
 *
 * Güvenlik: düğme yalnız production DIŞINDA dinlenir; canlıda değer ne olursa
 * olsun gerçek kural uygulanır. Canlı öncesi bu bypass tümüyle kaldırılacaktır.
 */
export async function izlemePuanZamaniAktifMi(
  supabase: SupabaseClient,
  tarih: Date
): Promise<boolean> {
  if (await mesaiBypassAktifMi(supabase)) return true;
  return puanKazanilabilirMi(tarih);
}

async function mesaiBypassAktifMi(supabase: SupabaseClient): Promise<boolean> {
  if (process.env.NODE_ENV === "production") return false;
  const { data } = await supabase
    .from("sistem_ayarlari")
    .select("deger")
    .eq("anahtar", "mesai_bypass")
    .maybeSingle();
  return Number(data?.deger) === 1;
}
