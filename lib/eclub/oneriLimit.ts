// lib/eclub/oneriLimit.ts
//
// E-Club öneri süreleri ve aynı video tekrar kontrolü.
//
// Ayar okuma hatasında güvenli geri düşüş: VARSAYILAN sabitler kullanılır,
// gönderim akışı kilitlenmez (UYARI loglanır).

import type { SupabaseClient } from "@supabase/supabase-js";
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

export async function eclubOneriGecerlilikGun(supabase: SupabaseClient): Promise<number> {
  return pozitifTamSayiAyari(supabase, "eclub_oneri_gecerlilik_gun");
}

export async function eclubAyniVideoTekrarBeklemeGun(supabase: SupabaseClient): Promise<number> {
  return pozitifTamSayiAyari(supabase, "eclub_ayni_video_tekrar_bekleme_gun");
}

// ─── Zaman yardımcıları ──────────────────────────────────────────────────────

/** Öneri bitiş zamanı: başlangıç + admin tarafından ayarlanan gün sayısı. */
export function oneriBitisHesapla(baslangic: Date, gunSayisi: number): Date {
  return new Date(baslangic.getTime() + gunSayisi * 24 * 60 * 60 * 1000);
}

// ─── Sonuç tipleri ───────────────────────────────────────────────────────────

export interface AyniVideoTekrarEngeli {
  kisi_id: string;
  son_oneri_bitis: string;
  yeniden_gonderilebilir_at: string;
}

export interface AyniVideoTekrarSonuc {
  bekleme_gun: number;
  engelli_kisiler: AyniVideoTekrarEngeli[];
}

/** Aynı videonun tekrar gönderilebileceği ilk an: önceki öneri bitişi + bekleme süresi. */
export function ayniVideoTekrarAcikZamani(oneriBitis: Date, beklemeGun: number): Date {
  return new Date(oneriBitis.getTime() + beklemeGun * 24 * 60 * 60 * 1000);
}

/**
 * Yalnız aynı UTT + aynı alıcı + aynı gerçek video birleşimini denetler.
 * Farklı video veya farklı UTT kayıtları gönderimi engellemez.
 */
export async function ayniVideoTekrarKontrol(
  supabase: SupabaseClient,
  oneren_id: string,
  kisi_idler: string[],
  video_id: string,
  now: Date = new Date(),
): Promise<AyniVideoTekrarSonuc> {
  const beklemeGun = await eclubAyniVideoTekrarBeklemeGun(supabase);
  if (kisi_idler.length === 0) return { bekleme_gun: beklemeGun, engelli_kisiler: [] };

  const { data, error } = await supabase
    .from("eclub_oneri_kayitlari")
    .select("kisi_id, oneri_bitis")
    .eq("oneren_id", oneren_id)
    .eq("video_id", video_id)
    .in("kisi_id", kisi_idler)
    .order("oneri_bitis", { ascending: false });

  if (error) throw new Error(`eclub_oneri_kayitlari SELECT — aynı video tekrar kontrolü: ${error.message}`);

  const sonKayitlar = new Map<string, { son_oneri_bitis: string; yeniden_gonderilebilir_at: string }>();
  for (const satir of (data ?? []) as { kisi_id: string; oneri_bitis: string }[]) {
    if (sonKayitlar.has(satir.kisi_id)) continue;
    const acilis = ayniVideoTekrarAcikZamani(new Date(satir.oneri_bitis), beklemeGun);
    sonKayitlar.set(satir.kisi_id, {
      son_oneri_bitis: satir.oneri_bitis,
      yeniden_gonderilebilir_at: acilis.toISOString(),
    });
  }

  const engelli_kisiler = kisi_idler.flatMap((kisi_id) => {
    const kayit = sonKayitlar.get(kisi_id);
    if (!kayit || now.getTime() >= new Date(kayit.yeniden_gonderilebilir_at).getTime()) return [];
    return [{ kisi_id, ...kayit }];
  });

  return { bekleme_gun: beklemeGun, engelli_kisiler };
}
