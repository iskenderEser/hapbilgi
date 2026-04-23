// lib/utils/bildirimOlustur.ts
import { SupabaseClient } from "@supabase/supabase-js";

interface BildirimParams {
  adminSupabase: SupabaseClient;
  alici_id: string;
  gonderen_id?: string | null;
  kayit_turu: "talep" | "senaryo" | "video" | "soru_seti" | "yayin" | "oneri";
  kayit_id: string;
  mesaj: string;
}

export async function bildirimOlustur(params: BildirimParams): Promise<void> {
  try {
    const { adminSupabase, alici_id, gonderen_id, kayit_turu, kayit_id, mesaj } = params;

    const { error } = await adminSupabase
      .from("bildirimler")
      .insert({
        alici_id,
        gonderen_id: gonderen_id ?? null,
        kayit_turu,
        kayit_id,
        mesaj,
        goruldu_mu: false,
      });

    if (error) {
      console.error("[BİLDİRİM] Bildirim oluşturulamadı:", {
        alici_id,
        kayit_turu,
        kayit_id,
        hata: error.message,
      });
    }
  } catch (err) {
    console.error("[BİLDİRİM] Beklenmeyen hata:", err);
  }
}

interface CokluBildirimParams {
  adminSupabase: SupabaseClient;
  alici_idler: string[];
  gonderen_id?: string | null;
  kayit_turu: "talep" | "senaryo" | "video" | "soru_seti" | "yayin" | "oneri";
  kayit_id: string;
  mesaj: string;
}

export async function cokluBildirimOlustur(params: CokluBildirimParams): Promise<void> {
  try {
    const { adminSupabase, alici_idler, gonderen_id, kayit_turu, kayit_id, mesaj } = params;

    if (alici_idler.length === 0) return;

    const kayitlar = alici_idler.map(alici_id => ({
      alici_id,
      gonderen_id: gonderen_id ?? null,
      kayit_turu,
      kayit_id,
      mesaj,
      goruldu_mu: false,
    }));

    const { error } = await adminSupabase
      .from("bildirimler")
      .insert(kayitlar);

    if (error) {
      console.error("[BİLDİRİM] Çoklu bildirim oluşturulamadı:", {
        alici_sayisi: alici_idler.length,
        kayit_turu,
        kayit_id,
        hata: error.message,
      });
    }
  } catch (err) {
    console.error("[BİLDİRİM] Beklenmeyen hata:", err);
  }
}