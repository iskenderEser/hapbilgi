import type { SupabaseClient } from "@supabase/supabase-js";
import type { HapbiAnalitikSonuc, HapbiAnalitikSorgu } from "@/lib/hapbi/analitik/sozlesme";
import {
  hapbiAnalitikDonemiAraligaCevir,
  hapbiPuanSatirlariniTopla,
  type HapbiTclubAnalitikHamSatir,
} from "@/lib/hapbi/analitik/tclubOkuyucu";
import { hapbiAnalitikSorguyuDogrula } from "@/lib/hapbi/analitik/sozlesme";
import { HapbiHata, type HapbiKaynak } from "@/lib/hapbi/sozlesme";

export async function hapbiCclubAnalitikOku(
  db: SupabaseClient,
  sorgu: HapbiAnalitikSorgu,
  kaynak: HapbiKaynak,
): Promise<HapbiAnalitikSonuc> {
  hapbiAnalitikSorguyuDogrula(sorgu);
  if (sorgu.veri_alani !== "cclub") throw new HapbiHata("GECERSIZ_VERI_ALANI", 400, "C-Club okuyucusu yalnız C-Club sorgusu kabul eder.");
  const aralik = hapbiAnalitikDonemiAraligaCevir(sorgu);
  const { data, error } = await db.rpc("get_hapbi_cclub_analitik_v1", {
    p_isteyen_id: sorgu.kapsam.kullanici_id,
    p_baslangic: aralik.baslangic,
    p_bitis: aralik.bitis,
  });
  if (error) throw new HapbiHata("ANALITIK_KAYNAK", 500, "C-Club analitik verisi okunamadı.");
  return hapbiPuanSatirlariniTopla(sorgu, (data ?? []) as HapbiTclubAnalitikHamSatir[], kaynak);
}
