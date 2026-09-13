import { createAdminClient } from "@/lib/supabase/server";

/**
 * Belirlenen sürede (varsayılan 24 saat) terk edilen kalıcı podcast taslaklarını
 * atomik olarak temizler, AI kuyruklarını iptal eder ve kullanılmayan Bunny
 * dosyalarını depolama temizleme kuyruğuna aktarır.
 */
export async function terkEdilenPodcastTaslaklariniTemizle(saatEsigi: number = 24): Promise<{
  ok: boolean;
  temizlenen_adet: number;
}> {
  const db = createAdminClient();
  const { data, error } = await db.rpc("podcast_taslak_zaman_asimi_temizle_atomik", {
    p_saat_esigi: saatEsigi,
  });

  if (error) {
    throw error;
  }

  return (data as { ok: boolean; temizlenen_adet: number }) ?? { ok: true, temizlenen_adet: 0 };
}
