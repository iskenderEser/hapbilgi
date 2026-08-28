import type { SupabaseClient } from "@supabase/supabase-js";
import { ECLUB_TUKETICI_ROLLERI, TUKETICI_ROLLER, hedefRolleriOku } from "@/lib/utils/roller";

export async function etkilesimYayinYetkisi(db: SupabaseClient, girdi: { userId: string; rol: string; yayinId: string; eclubKisi?: { kisi_id: string; rol: string } | null }) {
  const { data: yayin } = await db.from("v_yayin_detay").select("yayin_id, durum, firma_id, takim_id, hedef_roller, arac_turu").eq("yayin_id", girdi.yayinId).maybeSingle();
  if (!yayin || yayin.durum !== "yayinda" || !["video", "podcast", "gorsel", "flip_pdf"].includes(yayin.arac_turu)) return false;
  if (TUKETICI_ROLLER.includes(girdi.rol) || girdi.rol === "bm") {
    const { data: kullanici } = await db.from("kullanicilar").select("firma_id, takim_id").eq("kullanici_id", girdi.userId).maybeSingle();
    const hedef = girdi.rol === "bm" ? "bm" : "utt";
    return Boolean(kullanici?.firma_id && kullanici.firma_id === yayin.firma_id && hedefRolleriOku(yayin).includes(hedef) && (girdi.rol === "bm" || yayin.takim_id === null || yayin.takim_id === kullanici.takim_id));
  }
  if (girdi.eclubKisi && ECLUB_TUKETICI_ROLLERI.includes(girdi.eclubKisi.rol)) {
    const { data: oneri } = await db.from("eclub_oneri_kayitlari").select("oneri_id").eq("kisi_id", girdi.eclubKisi.kisi_id).eq("yayin_id", girdi.yayinId).limit(1).maybeSingle();
    return Boolean(oneri);
  }
  return false;
}
