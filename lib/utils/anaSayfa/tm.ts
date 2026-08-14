// TM ana sayfa özeti — TM Öneri Takibi ile aynı aylık kaynaklardan beslenir.

import { SupabaseClient } from "@supabase/supabase-js";
import { tarihAraligi } from "@/lib/utils/tarihAraligi";

interface TmOneriTakipKaydi {
  durum: "tamamlanan" | "bekleyen" | "suresi_gecmis";
}

interface TmBmKaydi {
  bm_id: string;
}

export async function getTmAnaSayfaVeri(userId: string, adminSupabase: SupabaseClient) {
  const { baslangic, bitis } = tarihAraligi("bu_ay");
  const [oneriSonucu, bmSonucu] = await Promise.all([
    adminSupabase.rpc("get_tm_oneri_durumu_v1", {
      p_tm_id: userId,
      p_baslangic: baslangic,
      p_bitis: bitis,
    }),
    adminSupabase.rpc("get_tm_bm_performans_v1", {
      p_tm_id: userId,
      p_baslangic: baslangic,
      p_bitis: bitis,
    }),
  ]);

  if (oneriSonucu.error) throw new Error("TM öneri takip özeti çekilemedi.");
  if (bmSonucu.error) throw new Error("Takımdaki aktif BM sayısı çekilemedi.");

  const oneriler = (oneriSonucu.data ?? []) as TmOneriTakipKaydi[];
  const bmler = (bmSonucu.data ?? []) as TmBmKaydi[];

  return {
    istatistikler: {
      bu_ay_gonderilen: oneriler.length,
      bekleyen: oneriler.filter((oneri) => oneri.durum === "bekleyen").length,
      suresi_gecmis: oneriler.filter((oneri) => oneri.durum === "suresi_gecmis").length,
      bm_sayisi: new Set(bmler.map((bm) => bm.bm_id)).size,
    },
  };
}
