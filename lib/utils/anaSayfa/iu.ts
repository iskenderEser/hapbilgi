// lib/utils/anaSayfa/iu.ts
// İU ana sayfa verisi. (R0: lib/utils/anaSayfaVeri.ts'ten saf taşıma — davranış değişmedi.)

import { SupabaseClient } from "@supabase/supabase-js";

export async function getIuAnaSayfaVeri(userId: string, adminSupabase: SupabaseClient) {
  const [
    { data: bekleyenSenaryolar },
    { data: bekleyenVideolar },
    { data: bekleyenSoruSetleri },
  ] = await Promise.all([
    adminSupabase
      .from("senaryo_durumu")
      .select("senaryo_durum_id, senaryo_id, created_at")
      .eq("durum", "senaryo yaziliyor")
      .order("created_at", { ascending: true }),
    adminSupabase
      .from("video_durumu")
      .select("video_durum_id, video_id, created_at")
      .eq("durum", "inceleme bekleniyor")
      .order("created_at", { ascending: true }),
    adminSupabase
      .from("soru_seti_durumu")
      .select("soru_seti_durum_id, soru_seti_id, created_at")
      .eq("durum", "inceleme bekleniyor")
      .order("created_at", { ascending: true }),
  ]);

  return {
    istatistikler: {
      bekleyen_senaryo: (bekleyenSenaryolar ?? []).length,
      bekleyen_video: (bekleyenVideolar ?? []).length,
      bekleyen_soru_seti: (bekleyenSoruSetleri ?? []).length,
    },
    bekleyen_senaryolar: bekleyenSenaryolar ?? [],
    bekleyen_videolar: bekleyenVideolar ?? [],
    bekleyen_soru_setleri: bekleyenSoruSetleri ?? [],
  };
}
