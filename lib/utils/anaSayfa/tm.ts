// lib/utils/anaSayfa/tm.ts
// TM ana sayfa verisi. (R0: lib/utils/anaSayfaVeri.ts'ten saf taşıma — davranış değişmedi.)

import { SupabaseClient } from "@supabase/supabase-js";
import { getBmAktiviteVerisi } from "@/lib/utils/anaSayfa/bmAktivite";

export async function getTmAnaSayfaVeri(userId: string, adminSupabase: SupabaseClient) {
  const { data: kullanici, error: kullaniciError } = await adminSupabase
    .from("kullanicilar")
    .select("takim_id")
    .eq("kullanici_id", userId)
    .single();
  if (kullaniciError || !kullanici) throw new Error("Kullanıcı bilgisi alınamadı.");
  if (!kullanici.takim_id) throw new Error("TM bir takıma bağlı değil.");

  const veri = await getBmAktiviteVerisi(
    { tip: "takim", takim_id: kullanici.takim_id },
    adminSupabase,
  );

  return {
    bm_satirlari: veri.satirlar,
    istatistikler: veri.istatistikler,
  };
}
