// lib/cc/izleme/extraKontrol.ts
// CC extra izleme kuralları — BM tarafı.
//
// KURAL (09.07.2026):
//   - İlk izleme sayılmaz (türü fark etmeksizin: kendi_izleme ya da challenge).
//   - Takvim ayı içinde 2 tam tekrar izleme (ileri sarmasız, tamamlanmış) = extra puan.
//     Extra, 2. tam tekrarın sonunda düşer; o ayki 3. ve sonraki tekrarlar puansız.
//   - Her yeni ayda hak yenilenir (o ay yine 2 tam tekrar = yine extra).
//   - Tur kesişimi: sayım alt sınırı max(ay başı, geçerli tur başlangıcı) —
//     yeni tur açılınca video zaten kendi_izleme'ye döner, sayaç sıfırdan başlar.
//
// Sorumluluklar:
//   - dahaOnceTamamlandiMi: izleme türü kararı (kendi_izleme mi extra mı) — baslat kullanır.
//   - extraPuanHakEdildiMi: 2. tam tekrar anı tespiti — bitir kullanır.
//   Yan etki yok, sadece kontrol.

import type { SupabaseClient } from "@supabase/supabase-js";

/** Ay içinde extra puanı düşüren tam tekrar sayısı (ilk izleme hariç). */
export const CC_EXTRA_TEKRAR_ESIGI = 2;

/**
 * BM bu yayını daha önce (alt_sinir verildiyse: o tarihten sonra) tamamlamış mı?
 * true → sonraki izleme 'extra' türünde başlar; false → 'kendi_izleme'.
 *
 * Tur modeli: alt_sinir = geçerli tur başlangıcı verilirse, önceki turda tamamlanan
 * yayın yeni turda "tamamlanmamış" sayılır — tam puan + sorular yeniden doğar.
 *
 * Hata durumunda en güvenli davranış: false (yeni izleme normal tür alır).
 */
export async function dahaOnceTamamlandiMi(
  supabase: SupabaseClient,
  bm_id: string,
  yayin_id: string,
  alt_sinir?: string
): Promise<boolean> {
  let sorgu = supabase
    .from("cc_izleme_kayitlari")
    .select("izleme_id")
    .eq("bm_id", bm_id)
    .eq("yayin_id", yayin_id)
    .eq("tamamlandi_mi", true);

  if (alt_sinir) {
    sorgu = sorgu.gte("izleme_baslangic", alt_sinir);
  }

  const { data, error } = await sorgu.limit(1).maybeSingle();

  if (error) {
    console.error("[lib/cc/izleme/extraKontrol] dahaOnceTamamlandiMi hatası:", error.message);
    return false;
  }

  return data !== null;
}