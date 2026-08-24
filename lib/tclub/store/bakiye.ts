// lib/store/bakiye.ts
// Harcama bakiyesi okuma katmanı.
//
// get_harcama_bakiyesi RPC'si rol bazlı hesap yapar:
//   - UTT/KD_UTT: hb_ligi mantığı (kazanım − 3 kayıp tablosu) − mağaza harcamaları
//   - BM: cc_ligi mantığı (kazanım − 3 kayıp tablosu) − mağaza harcamaları
//   - Diğer roller: 0
//
// Bakiye negatif dönmez (RPC içinde kontrol edilir).

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Kullanıcının harcanabilir puan bakiyesini döndürür.
 * Hata durumunda 0 döner ve console'a log atılır.
 */
export async function harcamaBakiyesi(
  supabase: SupabaseClient,
  kullaniciId: string
): Promise<number> {
  const { data, error } = await supabase.rpc("get_harcama_bakiyesi", {
    p_kullanici_id: kullaniciId,
  });

  if (error) {
    console.error("[lib/store/bakiye] harcamaBakiyesi hatası:", error.message);
    return 0;
  }

  const sayisal = Number(data);
  return Number.isFinite(sayisal) ? sayisal : 0;
}