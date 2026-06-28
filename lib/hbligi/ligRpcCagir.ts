// lib/hbligi/ligRpcCagir.ts
//
// HB Ligi RPC seçim katmanı (tek kaynak).
// Periyota göre üç RPC'den birini çağırır:
//   - ay    → get_hb_ligi_aylik(yil, ay)
//   - donem → get_hb_ligi_donemlik(yil, ceyrek)
//   - yil   → get_hb_ligi_yillik(yil)
// Dört rol fonksiyonu (getUttLig/getBmLig/getTmLig/getGenelLig) bunu çağırır.

import type { SupabaseClient } from "@supabase/supabase-js";

export type Periyot = "ay" | "donem" | "yil";

export interface LigPeriyot {
  periyot: Periyot;
  yil: number;
  ay: number;     // 1-12  (periyot=ay için)
  ceyrek: number; // 1-4   (periyot=donem için)
}

/**
 * Periyota göre ilgili HB Ligi RPC'sini çağırır, ham satır dizisini döndürür.
 * Hata durumunda açıklayıcı mesajla throw eder (çağıran sarar).
 */
export async function ligRpcCagir(
  supabase: SupabaseClient,
  p: LigPeriyot
): Promise<any[]> {
  if (p.periyot === "ay") {
    const { data, error } = await supabase.rpc("get_hb_ligi_aylik", {
      p_yil: p.yil,
      p_ay: p.ay,
    });
    if (error) throw new Error(`get_hb_ligi_aylik RPC: ${error.message}`);
    return data ?? [];
  }

  if (p.periyot === "yil") {
    const { data, error } = await supabase.rpc("get_hb_ligi_yillik", {
      p_yil: p.yil,
    });
    if (error) throw new Error(`get_hb_ligi_yillik RPC: ${error.message}`);
    return data ?? [];
  }

  // varsayılan: donem (çeyrek)
  const { data, error } = await supabase.rpc("get_hb_ligi_donemlik", {
    p_yil: p.yil,
    p_ceyrek: p.ceyrek,
  });
  if (error) throw new Error(`get_hb_ligi_donemlik RPC: ${error.message}`);
  return data ?? [];
}