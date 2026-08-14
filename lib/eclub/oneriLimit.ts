// lib/eclub/oneriLimit.ts
//
// E-Club öneri limit ve kredi kontrolleri.
//
// Kurallar (v45 kararları + admin ayar yönetimi):
//  1. AYLIK KREDİ: UTT bir takvim ayında ayarlanan sayıda öneri gönderebilir.
//     Kredi gönderimde düşer, izlenmese de geri gelmez ve devirsizdir.
//  2. AYNI KİŞİYE TEKRAR (kayan pencere): Aynı UTT, aynı kişiye
//     sistem_ayarlari.eclub_gonderim_araligi_gun (varsayılan 7) gün içinde
//     ikinci kez öneri gönderemez. Aynı firmada FARKLI UTT aynı kişiye
//     gönderebilir (limit oneren bazında). Süre ADMIN AYARIDIR (§9.3) —
//     tüm firmalara aynı uygulanır.
//  3. ALICI KORUMASI (kayan pencere, global): Bir kişi tüm firmalar/UTT'lerden
//     ayarlanan gün aralığında ayarlanan sayıda öneri alabilir.
//  4. ÖNERİ GEÇERLİLİĞİ: İzleme/soru/puan penceresi admin tarafından gün
//     cinsinden yönetilir.
//
// Ayar okuma hatasında güvenli geri düşüş: VARSAYILAN sabitler kullanılır,
// gönderim akışı kilitlenmez (UYARI loglanır).
//
// Alıcı penceresi kayan süredir; takvim haftası değildir.
// Ay = takvim ayı (lib/zaman/kontrol.ts ayBaslangici ile uyumlu).
// Günlük tavan YOK.

import type { SupabaseClient } from "@supabase/supabase-js";
import { ayBaslangici } from "@/lib/zaman/kontrol";
import {
  eclubGonderiAyariVarsayilani,
  type EclubGonderiAyariAnahtari,
} from "@/lib/eclub/gonderiAyarlari";

// ─── Ayar okuyucuları (sistem_ayarlari — tek kaynak, §9.3) ───────────────────

async function pozitifTamSayiAyari(
  supabase: SupabaseClient,
  anahtar: EclubGonderiAyariAnahtari,
): Promise<number> {
  const { data, error } = await supabase
    .from("sistem_ayarlari")
    .select("deger")
    .eq("anahtar", anahtar)
    .single();

  const deger = Number(data?.deger);
  if (error || !Number.isInteger(deger) || deger <= 0) {
    console.error(`[UYARI] ${anahtar} okunamadı, varsayılan kullanılıyor:`, error?.message ?? data?.deger);
    return eclubGonderiAyariVarsayilani(anahtar);
  }
  return deger;
}

export async function eclubAylikGonderimLimiti(supabase: SupabaseClient): Promise<number> {
  return pozitifTamSayiAyari(supabase, "eclub_aylik_gonderim_limiti");
}

export async function eclubOneriGecerlilikGun(supabase: SupabaseClient): Promise<number> {
  return pozitifTamSayiAyari(supabase, "eclub_oneri_gecerlilik_gun");
}

export async function eclubGonderimAraligiGun(supabase: SupabaseClient): Promise<number> {
  return pozitifTamSayiAyari(supabase, "eclub_gonderim_araligi_gun");
}

export async function eclubAliciPencereGun(supabase: SupabaseClient): Promise<number> {
  return pozitifTamSayiAyari(supabase, "eclub_alici_pencere_gun");
}

export async function eclubAliciHaftalikLimit(supabase: SupabaseClient): Promise<number> {
  return pozitifTamSayiAyari(supabase, "eclub_alici_haftalik_limit");
}

// ─── Zaman yardımcıları ──────────────────────────────────────────────────────

/** Şu andan `gun` gün öncesi — kayan pencere başı. */
export function kayanPencereBasi(gun: number, now: Date = new Date()): Date {
  return new Date(now.getTime() - gun * 24 * 60 * 60 * 1000);
}

/** Öneri bitiş zamanı: başlangıç + admin tarafından ayarlanan gün sayısı. */
export function oneriBitisHesapla(baslangic: Date, gunSayisi: number): Date {
  return new Date(baslangic.getTime() + gunSayisi * 24 * 60 * 60 * 1000);
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
  cakisan_kisiler: string[]; // kayan pencere içinde bu UTT'nin zaten öneri yaptığı kisi_id'ler
}

// ─── Kontroller ──────────────────────────────────────────────────────────────

/**
 * UTT'nin bu ay kullandığı krediyi sayar, istenen sayı kotaya sığıyor mu bakar.
 * Kota admin ayarından gelir. Pencere: takvim ayı başından şimdiye.
 */
export async function aylikKrediKontrol(
  supabase: SupabaseClient,
  oneren_id: string,
  istenen: number,
): Promise<AylikKrediSonuc> {
  const ay_basi = ayBaslangici();
  const [kota, sayim] = await Promise.all([
    eclubAylikGonderimLimiti(supabase),
    supabase
      .from("eclub_oneri_kayitlari")
      .select("oneri_id", { count: "exact", head: true })
      .eq("oneren_id", oneren_id)
      .gte("created_at", ay_basi.toISOString()),
  ]);

  if (sayim.error) throw new Error(`eclub_oneri_kayitlari SELECT — aylık kredi: ${sayim.error.message}`);

  const kullanilan = sayim.count ?? 0;
  const kalan = Math.max(0, kota - kullanilan);
  return {
    geciyor: kullanilan + istenen <= kota,
    kullanilan,
    kalan,
    istenen,
    kota,
  };
}

/**
 * Verilen alıcıların her biri için ayarlanan kayan pencerede kaç öneri aldığını sayar
 * (tüm UTT'ler/firmalar — global, oneren filtresi YOK). Limiti dolacak olanları
 * döndürür (mevcut + 1 > eclub_alici_haftalik_limit — ayardan, §9.3).
 */
export async function aliciLimitKontrol(
  supabase: SupabaseClient,
  kisi_idler: string[],
): Promise<AliciLimitSonuc> {
  if (kisi_idler.length === 0) return { hepsi_geciyor: true, dolu_kisiler: [] };

  const [limit, pencereGun] = await Promise.all([
    eclubAliciHaftalikLimit(supabase),
    eclubAliciPencereGun(supabase),
  ]);
  const pencere_basi = kayanPencereBasi(pencereGun);
  const { data, error } = await supabase
    .from("eclub_oneri_kayitlari")
    .select("kisi_id")
    .in("kisi_id", kisi_idler)
    .gte("created_at", pencere_basi.toISOString());

  if (error) throw new Error(`eclub_oneri_kayitlari SELECT — alıcı limiti: ${error.message}`);

  const sayim: Record<string, number> = {};
  for (const r of (data ?? []) as { kisi_id: string }[]) {
    const id = r.kisi_id;
    sayim[id] = (sayim[id] ?? 0) + 1;
  }

  const dolu_kisiler = kisi_idler
    .filter((id) => (sayim[id] ?? 0) + 1 > limit)
    .map((id) => ({ kisi_id: id, mevcut: sayim[id] ?? 0 }));

  return { hepsi_geciyor: dolu_kisiler.length === 0, dolu_kisiler };
}

/**
 * Bu UTT'nin, verilen alıcılara kayan pencere (eclub_gonderim_araligi_gun —
 * ayardan, §9.3) içinde zaten öneri yapıp yapmadığını kontrol eder (aynı kişiye
 * tekrar yasağı). Çakışan kisi_id'leri döndürür.
 * Filtre: oneren_id = bu UTT (farklı UTT çakışma sayılmaz).
 */
export async function tekrarKontrol(
  supabase: SupabaseClient,
  oneren_id: string,
  kisi_idler: string[],
): Promise<TekrarSonuc> {
  if (kisi_idler.length === 0) return { cakisan_kisiler: [] };

  const araligGun = await eclubGonderimAraligiGun(supabase);
  const pencere_basi = kayanPencereBasi(araligGun);
  const { data, error } = await supabase
    .from("eclub_oneri_kayitlari")
    .select("kisi_id")
    .eq("oneren_id", oneren_id)
    .in("kisi_id", kisi_idler)
    .gte("created_at", pencere_basi.toISOString());

  if (error) throw new Error(`eclub_oneri_kayitlari SELECT — tekrar kontrolü: ${error.message}`);

  const cakisan = [...new Set(((data ?? []) as { kisi_id: string }[]).map((r) => r.kisi_id))];
  return { cakisan_kisiler: cakisan };
}
