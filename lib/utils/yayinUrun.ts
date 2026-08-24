// lib/utils/yayinUrun.ts
//
// Yayından urun_id çözümlemesinin TEK DOĞRULUK KAYNAĞI.
// Redbook İlke 2 (Denormalize urun_id) gereği get_urun_from_yayin RPC'sini çağırır.
//
// NULL dönmesi bir hata DEĞİLDİR: ürünsüz içeriklerde (medikal, İK) urun_id NULL kalır.

import type { SupabaseClient } from "@supabase/supabase-js";

export async function yayindanUrunId(
  supabase: SupabaseClient,
  yayin_id: string,
  logEtiketi: string = "yayinUrun"
): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_urun_from_yayin", { p_yayin_id: yayin_id });
  if (error) {
    console.error(`[${logEtiketi}] get_urun_from_yayin hatası:`, { yayin_id, hata: error.message });
    return null;
  }
  return (data as string) ?? null;
}
