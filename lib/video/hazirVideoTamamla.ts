import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Hazır video kaydını ve atomik üretim zincirini tamamlar.
 * Video Bunny'de henüz işleniyor olsa bile (sureSaniye null/0/tanımsız) zincir açılır
 * ve metadata_dogrulandi=false olarak işaretlenir. Bunny encode'u bittiğinde
 * webhook veya mutabakat süreyi günceller ve metadata_dogrulandi=true yapar.
 */
export async function hazirVideoTamamla(
  db: SupabaseClient,
  talep: { talep_id: string; uretici_id: string; video_url: string; guid: string },
  sureSaniye?: number | null,
) {
  if (sureSaniye !== undefined && sureSaniye !== null && (!Number.isSafeInteger(sureSaniye) || sureSaniye < 0)) {
    throw new Error("Geçersiz video süresi.");
  }
  const dogrulandi = typeof sureSaniye === "number" && Number.isSafeInteger(sureSaniye) && sureSaniye > 0;

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
    .update({ sure_saniye: dogrulandi ? sureSaniye : 0, metadata_dogrulandi: dogrulandi })
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
