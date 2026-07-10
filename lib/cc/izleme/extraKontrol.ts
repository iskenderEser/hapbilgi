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

export interface ExtraHakSonuc {
  hak_edildi: boolean;
  tam_tekrar_sayisi: number;
}

/**
 * Bu tamamlanan izlemeyle extra puan hak edildi mi?
 *
 * alt_sinir'dan (max(ay başı, tur başı) — çağıran hesaplar) sonraki tam tekrarları
 * sayar: izleme_turu='extra', tamamlanmış, ileri sarılmamış. İçinde bulunulan izleme
 * de tamamlanmış olduğundan sayıma dahildir.
 *
 * hak_edildi yalnızca sayı TAM ESIK'e eşitken true olur — böylece extra ay içinde
 * tek kez düşer (3.+ tekrarlarda sayı eşiği aşar, koşul bir daha tutmaz).
 *
 * Hata durumunda en güvenli davranış: hak_edildi=false (puan kaçabilir,
 * veri bütünlüğü bozulmaz).
 */
export async function extraPuanHakEdildiMi(
  supabase: SupabaseClient,
  bm_id: string,
  yayin_id: string,
  alt_sinir: string
): Promise<ExtraHakSonuc> {
  const { count, error } = await supabase
    .from("cc_izleme_kayitlari")
    .select("izleme_id", { count: "exact", head: true })
    .eq("bm_id", bm_id)
    .eq("yayin_id", yayin_id)
    .eq("izleme_turu", "extra")
    .eq("tamamlandi_mi", true)
    .eq("ileri_sarildi_mi", false)
    .gte("izleme_baslangic", alt_sinir);

  if (error) {
    console.error("[lib/cc/izleme/extraKontrol] extraPuanHakEdildiMi hatası:", error.message);
    return { hak_edildi: false, tam_tekrar_sayisi: 0 };
  }

  const sayi = count ?? 0;
  return { hak_edildi: sayi === CC_EXTRA_TEKRAR_ESIGI, tam_tekrar_sayisi: sayi };
}