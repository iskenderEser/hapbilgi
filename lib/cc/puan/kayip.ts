// lib/cc/puan/kayip.ts
// CC ekosistemindeki ileri sarma ve yanlış cevap kayıplarını ilgili tablolara yazan fonksiyonlar.
//
// Sorumluluk:
//   - cc_ileri_sarma_kayitlari ve cc_yanlis_cevap_kayitlari tablolarına INSERT atmak
//   - Her kayıp türü için ayrı fonksiyon
//   - Kayıp puan hesabı (saniye başı puan × süre, soru puanı) ÇAĞIRAN katmanda yapılır.
//     Bu dosya sadece kaydeder.
//
// Yan etki yok: bildirim göndermez, başka tablo güncellemez, puan hesabı yapmaz.
//
// NOT: 5 iş günü içinde alıcının izlememesi sonucu oluşan challenge kaybı BURADA DEĞİL,
// lib/cc/kayit.ts içindeki challengeKaybiKaydet fonksiyonunda yazılır.
// Sebebi: o kayıp bir izleme oturumuna bağlı değil (oturum hiç başlamamış olduğu için),
// challenge yaşam döngüsüne bağlı bir olay. Tetikleyicisi kullanıcı eylemi değil, pg_cron
// job ile zaman geçişiyle taranır. Bu nedenle challenge yaşam döngüsünü yöneten
// lib/cc/kayit.ts dosyasında tutulur.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { KayitSonuc } from "@/lib/cc/tipler";

// ─── 1. İLERİ SARMA KAYBI ────────────────────────────────────────────────────

/**
 * Bir ileri sarma olayını cc_ileri_sarma_kayitlari'na yazar.
 * Kaybedilen puan hesabı (saniye başı puan × atlanan_sure) çağıran katmanda yapılır.
 * Bu fonksiyon sadece kaydı atar.
 */
export async function ileriSarmaKaybiKaydet(
  supabase: SupabaseClient,
  params: {
    bm_id: string;
    yayin_id: string;
    izleme_id: string;
    atlama_baslangic: number;
    atlama_bitis: number;
    atlanan_sure: number;
    kaybedilen_puan: number;
  }
): Promise<KayitSonuc> {
  const { error } = await supabase.from("cc_ileri_sarma_kayitlari").insert({
    bm_id: params.bm_id,
    yayin_id: params.yayin_id,
    izleme_id: params.izleme_id,
    atlama_baslangic: params.atlama_baslangic,
    atlama_bitis: params.atlama_bitis,
    atlanan_sure: params.atlanan_sure,
    kaybedilen_puan: params.kaybedilen_puan,
  });

  if (error) {
    console.error("[lib/cc/puan/kayip] ileriSarmaKaybiKaydet hatası:", error.message);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

// ─── 2. YANLIŞ CEVAP KAYBI ───────────────────────────────────────────────────

/**
 * Bir yanlış cevap olayını cc_yanlis_cevap_kayitlari'na yazar.
 * Kaybedilen puan değeri (soru puanı kadar) çağıran katmanda belirlenir.
 * Bu fonksiyon sadece kaydı atar.
 */
export async function yanlisCevapKaybiKaydet(
  supabase: SupabaseClient,
  params: {
    bm_id: string;
    yayin_id: string;
    izleme_id: string;
    soru_index: number;
    verilen_cevap: string;
    dogru_cevap: string;
    kaybedilen_puan: number;
  }
): Promise<KayitSonuc> {
  const { error } = await supabase.from("cc_yanlis_cevap_kayitlari").insert({
    bm_id: params.bm_id,
    yayin_id: params.yayin_id,
    izleme_id: params.izleme_id,
    soru_index: params.soru_index,
    verilen_cevap: params.verilen_cevap,
    dogru_cevap: params.dogru_cevap,
    kaybedilen_puan: params.kaybedilen_puan,
  });

  if (error) {
    console.error("[lib/cc/puan/kayip] yanlisCevapKaybiKaydet hatası:", error.message);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}