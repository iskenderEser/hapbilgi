// lib/cc/kotaKontrol.ts
// Challenge Club gönderim öncesi 3 kota kontrolü.
//
// Her fonksiyon ayrı çağrılır; arayan kod (route veya kayit.ts) sırayla işletir,
// ilk başarısız olanda kısa devre yapar.
//
// Üç kontrol birbirine paralel:
//  1) aylikKotaKontrol — BM ay içinde 3 gönderim hakkını aşmamalı.
//  2) aliciAylikKontrol — BM bu ay aynı alıcıya zaten gönderim yapmamalı (yönlü).
//  3) karsiliklilikKilidi — Alıcı bu ay göndericiye challenge göndermemiş olmalı.
//
// İlgili dokümantasyon: Karar Belgesi 5, iş kuralı maddeleri 1-3.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { KotaSonuc } from "@/lib/cc/tipler";
import { AYLIK_MAX_GONDERIM } from "@/lib/cc/sabitler";
import { ayBaslangici } from "@/lib/zaman/kontrol";

// ─── 1. AYLIK KOTA KONTROLÜ ──────────────────────────────────────────────────

/**
 * BM bu ay içinde toplam kaç gönderim yaptı? AYLIK_MAX_GONDERIM (3)'ü geçmemeli.
 */
export async function aylikKotaKontrol(
  supabase: SupabaseClient,
  gonderenId: string
): Promise<KotaSonuc> {
  const ayBas = ayBaslangici().toISOString();

  const { count, error } = await supabase
    .from("challenge_kayitlari")
    .select("challenge_id", { count: "exact", head: true })
    .eq("gonderen_id", gonderenId)
    .gte("created_at", ayBas);

  if (error) {
    return { gecerli: false, sebep: "Aylık kota kontrolü yapılamadı." };
  }

  const mevcut = count ?? 0;
  if (mevcut >= AYLIK_MAX_GONDERIM) {
    return {
      gecerli: false,
      sebep: `Bu ay aylık kotanız doldu (${mevcut}/${AYLIK_MAX_GONDERIM}). Yeni ay başında yeniden gönderim yapabilirsiniz.`,
    };
  }

  return { gecerli: true };
}

// ─── 2. ALICIYA AYLIK 1 KEZ KONTROLÜ (YÖNLÜ) ────────────────────────────────

/**
 * BM bu ay seçilen alıcıya daha önce gönderim yaptı mı? Yapmışsa engellenir.
 * Yön: gönderen → alan. Karşılıklılık kilidi ayrı fonksiyon.
 */
export async function aliciAylikKontrol(
  supabase: SupabaseClient,
  gonderenId: string,
  alanId: string
): Promise<KotaSonuc> {
  const ayBas = ayBaslangici().toISOString();

  const { count, error } = await supabase
    .from("challenge_kayitlari")
    .select("challenge_id", { count: "exact", head: true })
    .eq("gonderen_id", gonderenId)
    .eq("alan_id", alanId)
    .gte("created_at", ayBas);

  if (error) {
    return { gecerli: false, sebep: "Alıcıya aylık kota kontrolü yapılamadı." };
  }

  if ((count ?? 0) > 0) {
    return {
      gecerli: false,
      sebep: "Bu ay bu BM'ye zaten bir challenge gönderdiniz. Aynı ay içinde aynı BM'ye ikinci gönderim yapamazsınız.",
    };
  }

  return { gecerli: true };
}

// ─── 3. KARŞILIKLILIK KİLİDİ ─────────────────────────────────────────────────

/**
 * Alıcı BM, bu ay göndericiye daha önce challenge göndermiş mi?
 * Göndermişse karşılıklılık kilidi devreye girer — A bu ay B'ye gönderemez.
 *
 * Yön burada ters: alan_id'den gelen → gönderen_id parametresine giden.
 */
export async function karsiliklilikKilidi(
  supabase: SupabaseClient,
  gonderenId: string,
  alanId: string
): Promise<KotaSonuc> {
  const ayBas = ayBaslangici().toISOString();

  const { count, error } = await supabase
    .from("challenge_kayitlari")
    .select("challenge_id", { count: "exact", head: true })
    .eq("gonderen_id", alanId)
    .eq("alan_id", gonderenId)
    .gte("created_at", ayBas);

  if (error) {
    return { gecerli: false, sebep: "Karşılıklılık kontrolü yapılamadı." };
  }

  if ((count ?? 0) > 0) {
    return {
      gecerli: false,
      sebep: "Bu BM bu ay size challenge gönderdi. Karşılıklılık kuralı gereği aynı ay içinde geri gönderim yapamazsınız.",
    };
  }

  return { gecerli: true };
}