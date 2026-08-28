import type { SupabaseClient } from "@supabase/supabase-js";
import { eclubKisiErisimi } from "@/lib/eclub/kisiErisim";

export async function eclubAktifYayinYetkisi(db: SupabaseClient, authUserId: string, yayinId: string) {
  const erisim = await eclubKisiErisimi(db, authUserId);
  if (!erisim.kisi || !erisim.eclub_aktif) return false;
  const { data: yayin } = await db.from("v_yayin_detay").select("firma_id").eq("yayin_id", yayinId).maybeSingle();
  return Boolean(yayin?.firma_id && erisim.firmalar.some((firma) => firma.firma_id === yayin.firma_id && firma.aktif !== false && firma.eclub_aktif === true));
}
