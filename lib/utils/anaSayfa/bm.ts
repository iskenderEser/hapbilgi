// lib/utils/anaSayfa/bm.ts
// BM ana sayfa verisi. (R0: lib/utils/anaSayfaVeri.ts'ten saf taşıma — davranış değişmedi.)

import { SupabaseClient } from "@supabase/supabase-js";
import { TUKETICI_ROLLER } from "@/lib/utils/roller";
import { tarihAraligi } from "@/lib/utils/tarihAraligi";

interface BmOneriTakipKaydi {
  durum: "tamamlanan" | "bekleyen" | "suresi_gecmis";
}

export async function getBmAnaSayfaVeri(userId: string, adminSupabase: SupabaseClient) {
  const { data: bmKullanici, error: bmError } = await adminSupabase
    .from("kullanicilar")
    .select("firma_id, bolge_id, takim_id")
    .eq("kullanici_id", userId)
    .single();

  if (bmError || !bmKullanici) throw new Error("BM bilgisi alınamadı.");

  const { data: uttler } = await adminSupabase
    .from("kullanicilar")
    .select("kullanici_id")
    .eq("firma_id", bmKullanici.firma_id)
    .eq("takim_id", bmKullanici.takim_id)
    .eq("bolge_id", bmKullanici.bolge_id)
    .in("rol", TUKETICI_ROLLER)
    .eq("aktif_mi", true);

  const uttIdler = (uttler ?? []).map(u => u.kullanici_id);

  // Ana sayfa öneri özeti, BM Öneri Takibi ile aynı periyot ve durum
  // kaynağını kullanır. Böylece iki ekrandaki rakamlar birbirinden sapmaz.
  const { baslangic, bitis } = tarihAraligi("bu_ay");
  const { data: takipKayitlari, error: takipError } = await adminSupabase.rpc(
    "get_bm_oneri_durumu_v1",
    {
      p_bm_id: userId,
      p_baslangic: baslangic,
      p_bitis: bitis,
    },
  );

  if (takipError) throw new Error("Öneri takip özeti çekilemedi.");

  const oneriler = (takipKayitlari ?? []) as BmOneriTakipKaydi[];

  return {
    istatistikler: {
      bu_ay_gonderilen: oneriler.length,
      bekleyen: oneriler.filter((o) => o.durum === "bekleyen").length,
      suresi_gecmis: oneriler.filter((o) => o.durum === "suresi_gecmis").length,
      utt_sayisi: uttIdler.length,
    },
  };
}
