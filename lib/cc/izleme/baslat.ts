// lib/cc/izleme/baslat.ts
// Yeni bir CC izleme oturumu açar, cc_izleme_kayitlari'na INSERT atar.
//
// Sorumluluk:
//   - İzleme oturumunu kaydetmek
//   - İzleme türü mantığını UYGULAMAK DEĞİL, sadece kaydetmek
//   - İzleme türü (kendi_izleme, challenge, extra) ÇAĞIRAN KATMAN tarafından belirlenir
//
// İzleme türleri:
//   - 'kendi_izleme' — BM kendisi seçti, challenge_id NULL
//   - 'challenge'    — Challenge ile geldi, challenge_id dolu
//   - 'extra'        — Tekrar izleme (daha önce tamamlanmış video), challenge_id NULL
//
// Yan etki yok: bildirim göndermez, puan yazmaz.

import type { SupabaseClient } from "@supabase/supabase-js";

interface IzlemeBaslatParams {
  bm_id: string;
  yayin_id: string;
  izleme_turu: "kendi_izleme" | "challenge" | "extra";
  challenge_id?: string | null;
}

type IzlemeBaslatSonuc =
  | { ok: true; izleme_id: string }
  | { ok: false; error: string };

/**
 * Yeni izleme oturumu başlatır.
 * cc_izleme_kayitlari'na INSERT atar, oluşan izleme_id'yi döner.
 *
 * Çağıran katmanın sorumluluğu:
 *   - izleme_turu'nu doğru belirlemek (extraKontrol sonucu, challenge_id varlığı, vs.)
 *   - challenge türündeyse challenge_id'nin dolu olmasını sağlamak
 */
export async function izlemeBaslat(
  supabase: SupabaseClient,
  params: IzlemeBaslatParams
): Promise<IzlemeBaslatSonuc> {
  const { data, error } = await supabase
    .from("cc_izleme_kayitlari")
    .insert({
      bm_id: params.bm_id,
      yayin_id: params.yayin_id,
      izleme_turu: params.izleme_turu,
      challenge_id: params.challenge_id ?? null,
      tamamlandi_mi: false,
      ileri_sarildi_mi: false,
    })
    .select("izleme_id")
    .single();

  if (error || !data) {
    console.error("[lib/cc/izleme/baslat] izlemeBaslat hatası:", error?.message);
    return { ok: false, error: error?.message ?? "İzleme oturumu başlatılamadı." };
  }

  return { ok: true, izleme_id: data.izleme_id };
}