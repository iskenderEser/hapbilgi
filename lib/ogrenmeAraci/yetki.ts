import type { SupabaseClient } from "@supabase/supabase-js";
import { IU_ROLU, URETICI_ROLLER } from "@/lib/utils/roller";

export type UretimAraciYetkisi =
  | { ok: true; firmaId: string; iuId: string | null; ureticiId: string }
  | { ok: false; status: 403 | 404; hata: string };

export async function uretimAraciYetkisiniDogrula(girdi: {
  db: SupabaseClient;
  talepId: string;
  kullaniciId: string;
  rol: string;
}): Promise<UretimAraciYetkisi> {
  const { data: talep, error } = await girdi.db
    .from("talepler")
    .select("talep_id, firma_id, uretici_id")
    .eq("talep_id", girdi.talepId)
    .maybeSingle();
  if (error || !talep) return { ok: false, status: 404, hata: "Talep bulunamadı." };

  if (URETICI_ROLLER.includes(girdi.rol)) {
    return talep.uretici_id === girdi.kullaniciId
      ? { ok: true, firmaId: talep.firma_id, iuId: null, ureticiId: talep.uretici_id }
      : { ok: false, status: 403, hata: "Bu talebin öğrenme aracını yönetme yetkiniz yok." };
  }

  if (girdi.rol === IU_ROLU) {
    const { data: gorev, error: gorevError } = await girdi.db
      .from("uretim_gorevleri")
      .select("gorev_id")
      .eq("talep_id", girdi.talepId)
      .eq("atanan_iu_id", girdi.kullaniciId)
      .limit(1)
      .maybeSingle();
    if (gorevError || !gorev) return { ok: false, status: 403, hata: "Bu talebin öğrenme aracı size atanmamış." };
    return { ok: true, firmaId: talep.firma_id, iuId: girdi.kullaniciId, ureticiId: talep.uretici_id };
  }

  return { ok: false, status: 403, hata: "Bu işlem üretim hattı rollerine açıktır." };
}
