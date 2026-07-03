// lib/utils/eclubBildirim.ts
// E-Club kişi (eczacı/teknisyen) bildirimleri — eclub_bildirimler tablosuna yazar.
// Üretim bildirimOlustur deseninin sade hali: kişi alıcıdır (alici_kisi_id → eclub_kisiler),
// gönderen UTT'dir (gonderen_id → kullanicilar, nullable). Talep zinciri yoktur.

import { SupabaseClient } from "@supabase/supabase-js";

type EclubKayitTuru = "oneri";

interface EclubBildirimParams {
  adminSupabase: SupabaseClient;
  alici_kisi_id: string;
  gonderen_id?: string | null;
  kayit_turu: EclubKayitTuru;
  kayit_id: string;
  mesaj: string;
}

/**
 * Tek kişiye E-Club bildirimi oluşturur.
 */
export async function eclubBildirimOlustur(params: EclubBildirimParams): Promise<void> {
  try {
    const { adminSupabase, alici_kisi_id, gonderen_id, kayit_turu, kayit_id, mesaj } = params;

    const { error } = await adminSupabase
      .from("eclub_bildirimler")
      .insert({
        alici_kisi_id,
        gonderen_id: gonderen_id ?? null,
        kayit_turu,
        kayit_id,
        mesaj,
        goruldu_mu: false,
      });

    if (error) {
      console.error("[ECLUB BİLDİRİM] Bildirim oluşturulamadı:", {
        alici_kisi_id, kayit_turu, kayit_id, hata: error.message,
      });
    }
  } catch (err) {
    console.error("[ECLUB BİLDİRİM] Beklenmeyen hata:", err);
  }
}

interface EclubCokluBildirimParams {
  adminSupabase: SupabaseClient;
  alici_kisi_idler: string[];
  gonderen_id?: string | null;
  kayit_turu: EclubKayitTuru;
  kayit_id: string;
  mesaj: string;
}

/**
 * Birden çok kişiye aynı E-Club bildirimini oluşturur.
 */
export async function eclubCokluBildirimOlustur(params: EclubCokluBildirimParams): Promise<void> {
  try {
    const { adminSupabase, alici_kisi_idler, gonderen_id, kayit_turu, kayit_id, mesaj } = params;

    if (alici_kisi_idler.length === 0) return;

    const kayitlar = alici_kisi_idler.map((alici_kisi_id) => ({
      alici_kisi_id,
      gonderen_id: gonderen_id ?? null,
      kayit_turu,
      kayit_id,
      mesaj,
      goruldu_mu: false,
    }));

    const { error } = await adminSupabase
      .from("eclub_bildirimler")
      .insert(kayitlar);

    if (error) {
      console.error("[ECLUB BİLDİRİM] Çoklu bildirim oluşturulamadı:", {
        alici_sayisi: alici_kisi_idler.length, kayit_turu, kayit_id, hata: error.message,
      });
    }
  } catch (err) {
    console.error("[ECLUB BİLDİRİM] Beklenmeyen hata:", err);
  }
}