// lib/cc/izleme/bitir.ts
// CC izleme oturumunu tamamlar, cc_izleme_kayitlari UPDATE eder.
//
// Sorumluluk:
//   - İzleme kaydını günceller: tamamlandi_mi=true, izleme_bitis=now(), ileri_sarildi_mi=parametre
//   - Sadece izleme kaydını günceller — puan yazmaz, bildirim göndermez.
//
// Yan etkiler (puan kaydı, bildirim, challenge.izlendi_mi update vs) ÇAĞIRAN KATMANIN
// sorumluluğundadır (endpoint veya cevapIsle akışı).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { KayitSonuc } from "@/lib/cc/tipler";

interface IzlemeTamamlaParams {
  izleme_id: string;
  ileri_sarildi_mi: boolean;
}

/**
 * İzleme oturumunu tamamlar.
 * tamamlandi_mi=true, izleme_bitis=now(), ileri_sarildi_mi=parametre olarak günceller.
 *
 * Çağıran katmanın sorumluluğu:
 *   - İzleme gerçekten tamamlandı mı (video sonuna ulaşıldı mı) doğrulamak
 *   - Tamamlandıktan sonra ilgili puan/bildirim/challenge yan etkilerini tetiklemek
 */
export async function izlemeTamamla(
  supabase: SupabaseClient,
  params: IzlemeTamamlaParams
): Promise<KayitSonuc> {
  const { error } = await supabase
    .from("cc_izleme_kayitlari")
    .update({
      tamamlandi_mi: true,
      izleme_bitis: new Date().toISOString(),
      ileri_sarildi_mi: params.ileri_sarildi_mi,
    })
    .eq("izleme_id", params.izleme_id);

  if (error) {
    console.error("[lib/cc/izleme/bitir] izlemeTamamla hatası:", error.message);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}