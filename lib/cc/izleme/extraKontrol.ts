// lib/cc/izleme/extraKontrol.ts
// Bir BM'in bir yayını daha önce tamamlayıp tamamlamadığını kontrol eder.
// İzleme türü kararı için kullanılır:
//   - daha_once_tamamlandi = true  → yeni izleme 'extra' türünde başlatılır
//   - daha_once_tamamlandi = false → yeni izleme 'kendi_izleme' veya 'challenge' türünde
//
// Sorumluluk:
//   - cc_izleme_kayitlari'nda bm_id + yayin_id + tamamlandi_mi=true sorgulamak
//   - Yan etki yok, sadece kontrol
//
// Hata durumunda en güvenli davranış: false döner (yeni izleme normal tür alır).
// Daha önce tamamlama varken false dönmek extra puanı kaçırır ama veri bütünlüğüne zarar vermez.

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * BM bu yayını daha önce tamamlamış mı?
 *
 * @returns true ise BM bu yayını en az bir kez tamamlamış, sonraki izleme extra olmalı.
 *          false ise henüz tamamlanmamış (veya sorgu hatası, fail-safe).
 */
export async function dahaOnceTamamlandiMi(
  supabase: SupabaseClient,
  bm_id: string,
  yayin_id: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("cc_izleme_kayitlari")
    .select("izleme_id")
    .eq("bm_id", bm_id)
    .eq("yayin_id", yayin_id)
    .eq("tamamlandi_mi", true)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[lib/cc/izleme/extraKontrol] dahaOnceTamamlandiMi hatası:", error.message);
    return false;
  }

  return data !== null;
}