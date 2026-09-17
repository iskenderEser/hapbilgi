import type { SupabaseClient } from "@supabase/supabase-js";

/** Bunny hazır ve süre doğrulanmışken çağrılır. Tekrar çağrı aynı zinciri tamamlar. */
export async function hazirVideoTamamla(
  db: SupabaseClient,
  talep: { talep_id: string; uretici_id: string; video_url: string; guid: string },
  sureSaniye: number,
) {
  if (!Number.isSafeInteger(sureSaniye) || sureSaniye <= 0) throw new Error("Doğrulanmış video süresi bulunamadı.");
  const { data, error } = await db.rpc("uretim_hazir_video_kaydet", {
    p_talep_id: talep.talep_id,
    p_uretici_id: talep.uretici_id,
    p_video_url: talep.video_url,
    p_islem_anahtari: talep.guid,
  });
  if (error) throw error;
  const sonuc = data as { arac_id?: string; sonraki?: { atanan_iu_id?: string } | null } | null;
  if (!sonuc?.arac_id) throw new Error("Hazır video zinciri öğrenme aracı kimliği döndürmedi.");
  const { error: sureError } = await db.from("ogrenme_araclari")
    .update({ sure_saniye: sureSaniye, metadata_dogrulandi: true })
    .eq("arac_id", sonuc.arac_id).eq("arac_turu", "video");
  if (sureError) throw sureError;

  // Tarayıcı kapanmış olsa da tamamlanan aktarım kurtarma penceresine düşmemeli.
  // Başka bir yükleme girişimini kapatmamak için GUID ve sahiplik birlikte süzülür.
  const { error: oturumError } = await db.from("ogrenme_araci_video_yukleme_oturumlari")
    .delete().eq("talep_id", talep.talep_id).eq("kullanici_id", talep.uretici_id)
    .eq("kaynak", "hazir").eq("video_guid", talep.guid);
  if (oturumError) throw oturumError;
  return sonuc;
}
