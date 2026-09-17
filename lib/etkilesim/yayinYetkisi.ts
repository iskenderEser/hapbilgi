import type { SupabaseClient } from "@supabase/supabase-js";
import { eclubKisiErisimi } from "@/lib/eclub/kisiErisim";
import { ECLUB_TUKETICI_ROLLERI, TUKETICI_ROLLER, yayinTuketiciRoluneAcikMi } from "@/lib/utils/roller";

export async function etkilesimYayinYetkisi(db: SupabaseClient, girdi: { userId: string; rol: string; yayinId: string; eclubKisi?: { kisi_id: string; rol: string } | null }) {
  const { data: yayin } = await db.from("v_yayin_detay").select("yayin_id, durum, firma_id, takim_id, hedef_roller, arac_turu").eq("yayin_id", girdi.yayinId).maybeSingle();
  if (!yayin || yayin.durum !== "yayinda" || !["video", "podcast", "gorsel", "flip_pdf"].includes(yayin.arac_turu)) return false;
  if (TUKETICI_ROLLER.includes(girdi.rol) || girdi.rol === "bm") {
    const { data: kullanici } = await db.from("kullanicilar").select("firma_id, takim_id, aktif_mi").eq("kullanici_id", girdi.userId).maybeSingle();
    const kapsamUygun = Boolean(
      kullanici?.aktif_mi
      && kullanici.firma_id
      && kullanici.firma_id === yayin.firma_id
      && yayinTuketiciRoluneAcikMi(yayin, girdi.rol)
      && (girdi.rol === "bm" || yayin.takim_id === null || yayin.takim_id === kullanici.takim_id),
    );
    if (!kapsamUygun) return false;

    if (girdi.rol === "bm") {
      const { data: challenge } = await db.from("challenge_kayitlari")
        .select("challenge_id")
        .eq("alan_id", girdi.userId)
        .eq("yayin_id", girdi.yayinId)
        .limit(1)
        .maybeSingle();
      return Boolean(challenge);
    }

    const { data: oneri } = await db.from("oneri_kayitlari")
      .select("oneri_id")
      .eq("kullanici_id", girdi.userId)
      .eq("yayin_id", girdi.yayinId)
      .limit(1)
      .maybeSingle();
    return Boolean(oneri);
  }
  if (girdi.eclubKisi && ECLUB_TUKETICI_ROLLERI.includes(girdi.eclubKisi.rol)) {
    const erisim = await eclubKisiErisimi(db, girdi.userId);
    const aktifFirmaBaglantisi = Boolean(
      erisim.kisi?.kisi_id === girdi.eclubKisi.kisi_id
      && erisim.eclub_aktif
      && yayin.firma_id
      && erisim.firmalar.some((firma) =>
        firma.firma_id === yayin.firma_id
        && firma.aktif !== false
        && firma.eclub_aktif === true),
    );
    if (!aktifFirmaBaglantisi || !yayinTuketiciRoluneAcikMi(yayin, girdi.eclubKisi.rol)) return false;
    const { data: oneri } = await db.from("eclub_oneri_kayitlari").select("oneri_id").eq("kisi_id", girdi.eclubKisi.kisi_id).eq("yayin_id", girdi.yayinId).limit(1).maybeSingle();
    return Boolean(oneri);
  }
  return false;
}
