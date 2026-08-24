// lib/hbligi/ligRpcCagir.ts
//
// HB Ligi RPC seçim katmanı (tek kaynak).
// Periyota göre dört RPC'den birini çağırır:
//   - ay    → get_hb_ligi_aylik_v2(yil, ay)
//   - donem → get_hb_ligi_donemlik_v2(yil, ceyrek)
//   - yil   → get_hb_ligi_yillik_v2(yil)
//   - hafta → get_hb_ligi_haftalik_v2(yil, hafta)
// UTT görünümü ve kapsam-güvenli üst rol saha görünümü bunu çağırır.

import type { SupabaseClient } from "@supabase/supabase-js";

export type Periyot = "ay" | "donem" | "yil" | "hafta";

export interface LigPeriyot {
  periyot: Periyot;
  yil: number;
  ay: number;     // 1-12  (periyot=ay için)
  ceyrek: number; // 1-4   (periyot=donem için)
  hafta: number;  // 1-53  (periyot=hafta için)
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
    const { data, error } = await supabase.rpc("get_hb_ligi_aylik_v2", {
      p_yil: p.yil,
      p_ay: p.ay,
    });
    if (error) throw new Error(`get_hb_ligi_aylik_v2 RPC: ${error.message}`);
    return data ?? [];
  }

  if (p.periyot === "yil") {
    const { data, error } = await supabase.rpc("get_hb_ligi_yillik_v2", {
      p_yil: p.yil,
    });
    if (error) throw new Error(`get_hb_ligi_yillik_v2 RPC: ${error.message}`);
    return data ?? [];
  }

  if (p.periyot === "hafta") {
    const { data, error } = await supabase.rpc("get_hb_ligi_haftalik_v2", {
      p_yil: p.yil,
      p_hafta: p.hafta,
    });
    if (error) throw new Error(`get_hb_ligi_haftalik_v2 RPC: ${error.message}`);
    return data ?? [];
  }

  // varsayılan: donem (çeyrek)
  const { data, error } = await supabase.rpc("get_hb_ligi_donemlik_v2", {
    p_yil: p.yil,
    p_ceyrek: p.ceyrek,
  });
  if (error) throw new Error(`get_hb_ligi_donemlik_v2 RPC: ${error.message}`);
  return data ?? [];
}
