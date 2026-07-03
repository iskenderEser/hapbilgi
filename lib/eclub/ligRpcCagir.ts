// lib/eclub/ligRpcCagir.ts
//
// E-Club Ligi RPC seçim katmanı (tek kaynak). HBLigi ligRpcCagir deseni.
// Periyoda göre UTT-toplam veya kişi-ürün-detay RPC'lerinden birini çağırır.

import type { SupabaseClient } from "@supabase/supabase-js";

export type Periyot = "ay" | "donem" | "yil";

export interface LigPeriyot {
  periyot: Periyot;
  yil: number;
  ay: number;     // 1-12 (periyot=ay)
  ceyrek: number; // 1-4  (periyot=donem)
}

export interface UttToplamSatir {
  utt_id: string;
  ad: string;
  soyad: string;
  takim_adi: string | null;
  firma_id: string | null;
  takim_id: string | null;
  bolge_id: string | null;
  bolge_adi: string | null;
  izleme_puani: number;
  cevaplama_puani: number;
  izlenen_video: number;
  dogru_cevap: number;
  gonderi_puani: number;
  toplam_puan: number;
}

export interface DetaySatir {
  gln: string | null;
  eczane_adi: string | null;
  eczaci_ad: string | null;
  teknisyen_ad: string | null;
  urun_id: string | null;
  urun_adi: string | null;
  izleme_puani: number;
  cevaplama_puani: number;
  izlenen_video: number;
  dogru_cevap: number;
}

// UTT toplam — periyoda göre doğru RPC
export async function ligUttToplamCagir(
  supabase: SupabaseClient,
  p: LigPeriyot
): Promise<UttToplamSatir[]> {
  if (p.periyot === "ay") {
    const { data, error } = await supabase.rpc("get_eclub_ligi_utt_aylik", { p_yil: p.yil, p_ay: p.ay });
    if (error) throw new Error(`get_eclub_ligi_utt_aylik RPC: ${error.message}`);
    return (data ?? []) as UttToplamSatir[];
  }
  if (p.periyot === "yil") {
    const { data, error } = await supabase.rpc("get_eclub_ligi_utt_yillik", { p_yil: p.yil });
    if (error) throw new Error(`get_eclub_ligi_utt_yillik RPC: ${error.message}`);
    return (data ?? []) as UttToplamSatir[];
  }
  const { data, error } = await supabase.rpc("get_eclub_ligi_utt_donemlik", { p_yil: p.yil, p_ceyrek: p.ceyrek });
  if (error) throw new Error(`get_eclub_ligi_utt_donemlik RPC: ${error.message}`);
  return (data ?? []) as UttToplamSatir[];
}

// Kişi+ürün detay — bir UTT için, periyoda göre doğru RPC
export async function ligDetayCagir(
  supabase: SupabaseClient,
  utt_id: string,
  p: LigPeriyot
): Promise<DetaySatir[]> {
  if (p.periyot === "ay") {
    const { data, error } = await supabase.rpc("get_eclub_ligi_detay_aylik", { p_utt_id: utt_id, p_yil: p.yil, p_ay: p.ay });
    if (error) throw new Error(`get_eclub_ligi_detay_aylik RPC: ${error.message}`);
    return (data ?? []) as DetaySatir[];
  }
  if (p.periyot === "yil") {
    const { data, error } = await supabase.rpc("get_eclub_ligi_detay_yillik", { p_utt_id: utt_id, p_yil: p.yil });
    if (error) throw new Error(`get_eclub_ligi_detay_yillik RPC: ${error.message}`);
    return (data ?? []) as DetaySatir[];
  }
  const { data, error } = await supabase.rpc("get_eclub_ligi_detay_donemlik", { p_utt_id: utt_id, p_yil: p.yil, p_ceyrek: p.ceyrek });
  if (error) throw new Error(`get_eclub_ligi_detay_donemlik RPC: ${error.message}`);
  return (data ?? []) as DetaySatir[];
}