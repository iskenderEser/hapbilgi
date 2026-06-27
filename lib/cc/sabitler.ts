// lib/cc/sabitler.ts
// Challenge Club sabitleri ve sistem_ayarlari okuyucuları.
//
// İki tür içerik:
//  1) Kod sabitleri (IS_GUNU_SURE, AYLIK_MAX_GONDERIM) — deploy gerektirir değişimi.
//  2) DB sabitleri (cc_gonderme_puani, cc_referral_puani) — sistem_ayarlari'ndan okunur,
//     admin değiştirebilir, kod deploy gerekmez.
//
// İlgili dokümantasyon: Karar Belgesi 3 (puan ekonomisi), Karar 1 (5 iş günü süresi).

import type { SupabaseClient } from "@supabase/supabase-js";

// ─── KOD SABİTLERİ ───────────────────────────────────────────────────────────

/** Alıcı BM'in challenge'ı izlemesi için verilen iş günü süresi. */
export const IS_GUNU_SURE = 5;

/** Bir BM'in ay içinde toplamda gönderebileceği maksimum challenge sayısı. */
export const AYLIK_MAX_GONDERIM = 3;

// ─── DB OKUYUCU FONKSİYONLAR ─────────────────────────────────────────────────

/**
 * sistem_ayarlari'ndaki cc_gonderme_puani değerini okur.
 * Anahtar bulunmazsa veya değer parse edilemezse 10 döner (Karar 3 varsayılan).
 */
export async function ccGondermePuani(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase
    .from("sistem_ayarlari")
    .select("deger")
    .eq("anahtar", "cc_gonderme_puani")
    .single();

  if (error || !data) return 10;
  const sayisal = Number(data.deger);
  return Number.isFinite(sayisal) ? sayisal : 10;
}

/**
 * sistem_ayarlari'ndaki cc_referral_puani değerini okur.
 * Anahtar bulunmazsa veya değer parse edilemezse 10 döner.
 */
export async function ccReferralPuani(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase
    .from("sistem_ayarlari")
    .select("deger")
    .eq("anahtar", "cc_referral_puani")
    .single();

  if (error || !data) return 10;
  const sayisal = Number(data.deger);
  return Number.isFinite(sayisal) ? sayisal : 10;
}

/**
 * Tek sorguda her iki puan değerini okur.
 * challengeOlustur akışı bunu kullanır — iki ayrı roundtrip yerine tek roundtrip.
 * Anahtarlardan biri eksikse o değer için 10 varsayılır.
 */
export async function ccPuanSabitleri(
  supabase: SupabaseClient
): Promise<{ gonderme: number; referral: number }> {
  const { data, error } = await supabase
    .from("sistem_ayarlari")
    .select("anahtar, deger")
    .in("anahtar", ["cc_gonderme_puani", "cc_referral_puani"]);

  if (error || !data) return { gonderme: 10, referral: 10 };

  const harita: Record<string, number> = {};
  for (const satir of data) {
    const sayisal = Number(satir.deger);
    if (Number.isFinite(sayisal)) harita[satir.anahtar] = sayisal;
  }

  return {
    gonderme: harita["cc_gonderme_puani"] ?? 10,
    referral: harita["cc_referral_puani"] ?? 10,
  };
}