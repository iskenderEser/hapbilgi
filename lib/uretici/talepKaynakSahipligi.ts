import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Talep oluştururken gönderilen teknik/ürün kimliklerinin kullanıcının kendi
 * firmasına ait olduğunu sunucuda doğrular.
 *
 * `teknikler` ve `urunler` tabloları firma bazlıdır (`firma_id` NOT NULL).
 * Talep formu yalnız kendi firmasının kayıtlarını sunar; ancak istemci gövdesi
 * tamamen kullanıcı kontrolünde olduğundan (form atlanıp başka firmanın
 * `teknik_id`/`urun_id`'si enjekte edilebilir) sahiplik, yazımdan önce burada
 * teyit edilir.
 *
 * `ureticiUrunKapsami` (ürün sözlüğü listeleme/yazma kapsamı) ile aynı
 * "istemciye güvenme, firmayı sunucuda doğrula" ilkesini paylaşır; bu yardımcı
 * ise talebe iliştirilecek somut kimliğin sahipliğini denetler.
 */

/** `teknik_id` verilen firmaya ait mi? Kayıt yoksa veya başka firmadaysa false. */
export async function teknikFirmayaAitMi(
  db: SupabaseClient,
  teknikId: string,
  firmaId: string,
): Promise<boolean> {
  const { data } = await db
    .from("teknikler")
    .select("teknik_id")
    .eq("teknik_id", teknikId)
    .eq("firma_id", firmaId)
    .maybeSingle();
  return Boolean(data);
}

/** `urun_id` verilen firmaya ait mi? Kayıt yoksa veya başka firmadaysa false. */
export async function urunFirmayaAitMi(
  db: SupabaseClient,
  urunId: string,
  firmaId: string,
): Promise<boolean> {
  const { data } = await db
    .from("urunler")
    .select("urun_id")
    .eq("urun_id", urunId)
    .eq("firma_id", firmaId)
    .maybeSingle();
  return Boolean(data);
}
