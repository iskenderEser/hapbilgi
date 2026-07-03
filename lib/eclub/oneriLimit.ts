// lib/eclub/oneriLimit.ts
//
// E-Club öneri limit ve kredi kontrolleri.
//
// Kurallar (v45 kararları):
//  1. AYLIK KREDİ: UTT bir takvim ayında toplam ECLUB_AYLIK_KREDI öneri
//     gönderebilir. Kredi gönderimde düşer, izlenmese de geri gelmez,
//     devirsizdir, her takvim ayının 1'inde 100'e sıfırlanır.
//  2. AYNI KİŞİYE TEKRAR (kayan hafta): Aynı UTT, aynı kişiye son 7 gün
//     içinde ikinci kez öneri gönderemez (bir UTT → bir kişi → 7 günde 1).
//     Aynı firmada FARKLI UTT aynı kişiye gönderebilir (limit oneren bazında).
//  3. ALICI KORUMASI (kayan hafta, global): Bir kişi tüm firmalar/UTT'lerden
//     toplam son 7 günde en fazla ECLUB_ALICI_HAFTALIK öneri alabilir.
//
// Hafta = kayan 7 gün (şu andan 7 gün öncesi). Takvim haftası DEĞİL.
// Ay = takvim ayı (lib/zaman/kontrol.ts ayBaslangici ile uyumlu).
// Günlük tavan YOK.

import type { SupabaseClient } from "@supabase/supabase-js";
import { ayBaslangici } from "@/lib/zaman/kontrol";

// ─── Sabitler ────────────────────────────────────────────────────────────────
export const ECLUB_AYLIK_KREDI = 100;
export const ECLUB_ALICI_HAFTALIK = 20;
// Aynı UTT aynı kişiye kayan 7 günde bu kadar öneri (tekrar yok = 1):
export const ECLUB_UTT_KISI_HAFTALIK = 1;
// Öneri süresi: iletildiği andan itibaren 7 gün (kayan). Alıcı bu süre içinde
// izlerse/cevaplarsa puan kazanır.
export const ECLUB_ONERI_GUN_SAYISI = 7;

// ─── Zaman yardımcıları ──────────────────────────────────────────────────────

/** Şu andan ECLUB_ONERI_GUN_SAYISI (7) gün öncesi — kayan hafta penceresi başı. */
export function kayanHaftaBasi(now: Date = new Date()): Date {
  return new Date(now.getTime() - ECLUB_ONERI_GUN_SAYISI * 24 * 60 * 60 * 1000);
}

/** Öneri bitiş zamanı: baslangic + 7 gün. */
export function oneriBitisHesapla(baslangic: Date): Date {
  return new Date(baslangic.getTime() + ECLUB_ONERI_GUN_SAYISI * 24 * 60 * 60 * 1000);
}

// ─── Sonuç tipleri ───────────────────────────────────────────────────────────

export interface AylikKrediSonuc {
  geciyor: boolean;
  kullanilan: number;
  kalan: number;
  istenen: number;
  kota: number;
}

export interface AliciLimitSonuc {
  hepsi_geciyor: boolean;
  dolu_kisiler: { kisi_id: string; mevcut: number }[];
}

export interface TekrarSonuc {
  cakisan_kisiler: string[]; // son 7 günde bu UTT'nin zaten öneri yaptığı kisi_id'ler
}

// ─── Kontroller ──────────────────────────────────────────────────────────────

/**
 * UTT'nin bu ay kullandığı krediyi sayar, istenen sayı kotaya sığıyor mu bakar.
 * Kota = ECLUB_AYLIK_KREDI (100). Pencere: takvim ayı başından şimdiye.
 */
export async function aylikKrediKontrol(
  supabase: SupabaseClient,
  oneren_id: string,
  istenen: number,
): Promise<AylikKrediSonuc> {
  const ay_basi = ayBaslangici();
  const { count, error } = await supabase
    .from("eclub_oneri_kayitlari")
    .select("oneri_id", { count: "exact", head: true })
    .eq("oneren_id", oneren_id)
    .gte("created_at", ay_basi.toISOString());

  if (error) throw new Error(`eclub_oneri_kayitlari SELECT — aylık kredi: ${error.message}`);

  const kullanilan = count ?? 0;
  const kalan = Math.max(0, ECLUB_AYLIK_KREDI - kullanilan);
  return {
    geciyor: kullanilan + istenen <= ECLUB_AYLIK_KREDI,
    kullanilan,
    kalan,
    istenen,
    kota: ECLUB_AYLIK_KREDI,
  };
}

/**
 * Verilen alıcıların her biri için son 7 günde toplam kaç öneri aldığını sayar
 * (tüm UTT'ler/firmalar — global, oneren filtresi YOK). Limiti dolacak olanları
 * döndürür (mevcut + 1 > ECLUB_ALICI_HAFTALIK).
 */
export async function aliciLimitKontrol(
  supabase: SupabaseClient,
  kisi_idler: string[],
): Promise<AliciLimitSonuc> {
  if (kisi_idler.length === 0) return { hepsi_geciyor: true, dolu_kisiler: [] };

  const hafta_basi = kayanHaftaBasi();
  const { data, error } = await supabase
    .from("eclub_oneri_kayitlari")
    .select("kisi_id")
    .in("kisi_id", kisi_idler)
    .gte("created_at", hafta_basi.toISOString());

  if (error) throw new Error(`eclub_oneri_kayitlari SELECT — alıcı limiti: ${error.message}`);

  const sayim: Record<string, number> = {};
  for (const r of data ?? []) {
    const id = (r as any).kisi_id;
    sayim[id] = (sayim[id] ?? 0) + 1;
  }

  const dolu_kisiler = kisi_idler
    .filter((id) => (sayim[id] ?? 0) + 1 > ECLUB_ALICI_HAFTALIK)
    .map((id) => ({ kisi_id: id, mevcut: sayim[id] ?? 0 }));

  return { hepsi_geciyor: dolu_kisiler.length === 0, dolu_kisiler };
}

/**
 * Bu UTT'nin, verilen alıcılara son 7 gün içinde zaten öneri yapıp yapmadığını
 * kontrol eder (aynı kişiye tekrar yasağı — kayan hafta). Çakışan kisi_id'leri
 * döndürür. Filtre: oneren_id = bu UTT (farklı UTT çakışma sayılmaz).
 */
export async function tekrarKontrol(
  supabase: SupabaseClient,
  oneren_id: string,
  kisi_idler: string[],
): Promise<TekrarSonuc> {
  if (kisi_idler.length === 0) return { cakisan_kisiler: [] };

  const hafta_basi = kayanHaftaBasi();
  const { data, error } = await supabase
    .from("eclub_oneri_kayitlari")
    .select("kisi_id")
    .eq("oneren_id", oneren_id)
    .in("kisi_id", kisi_idler)
    .gte("created_at", hafta_basi.toISOString());

  if (error) throw new Error(`eclub_oneri_kayitlari SELECT — tekrar kontrolü: ${error.message}`);

  const cakisan = [...new Set((data ?? []).map((r: any) => r.kisi_id))];
  return { cakisan_kisiler: cakisan };
}