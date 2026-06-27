// lib/store/siparis.ts
// HBStore sipariş orchestration.
//
// 3 fonksiyon:
//   1) siparisOlustur — store_siparis_olustur RPC
//   2) siparisIptal   — store_siparis_iptal RPC
//   3) teslimAldim    — store_teslim_aldim RPC
//
// Tüm RPC'ler atomik — stok/bakiye/durum kontrolleri DB'de yapılır.
// Bu katman çağrı orchestration + bildirim (gerekirse).

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  SiparisOlusturParams,
  SiparisOlusturSonuc,
  SiparisIptalParams,
  KayitSonuc,
} from "@/lib/store/tipler";

// ─── 1. SİPARİŞ OLUŞTUR ──────────────────────────────────────────────────────

/**
 * Atomik sipariş oluşturma: stok kontrol + bakiye kontrol + sipariş + harcama.
 * RPC içinde transaction; herhangi bir adım patlarsa hiçbir şey yazılmaz.
 *
 * @returns ok=true ise siparis_id dolu; ok=false ise hata mesajı dolu.
 */
export async function siparisOlustur(
  supabase: SupabaseClient,
  params: SiparisOlusturParams
): Promise<SiparisOlusturSonuc> {
  const { data, error } = await supabase
    .rpc("store_siparis_olustur", {
      p_kullanici_id: params.kullanici_id,
      p_urun_id: params.urun_id,
      p_adres_id: params.adres_id,
      p_adet: params.adet,
    });

  if (error) {
    console.error("[lib/store/siparis] siparisOlustur RPC hatası:", error.message);
    return { ok: false, siparis_id: null, hata: error.message };
  }

  // RPC TABLE döndürür — ilk satırı al
  const ilkSatir = Array.isArray(data) && data.length > 0 ? data[0] : null;
  if (!ilkSatir) {
    return { ok: false, siparis_id: null, hata: "RPC'den geçerli sonuç alınamadı." };
  }

  return {
    ok: Boolean(ilkSatir.ok),
    siparis_id: ilkSatir.siparis_id ?? null,
    hata: ilkSatir.hata ?? null,
  };
}

// ─── 2. SİPARİŞ İPTAL ────────────────────────────────────────────────────────

/**
 * Sipariş iptal:
 *  - Kullanıcı kendi siparişini sadece 'beklemede' durumda ve 12 saat içinde iptal eder
 *  - Admin her durumda iptal eder ('teslim_edildi' hariç)
 *  - İptal olunca: stok geri eklenir, puan iade kaydı yazılır
 */
export async function siparisIptal(
  supabase: SupabaseClient,
  params: SiparisIptalParams
): Promise<KayitSonuc> {
  const { data, error } = await supabase
    .rpc("store_siparis_iptal", {
      p_siparis_id: params.siparis_id,
      p_iptal_eden_id: params.iptal_eden_id,
      p_is_admin: params.is_admin,
      p_sebep: params.sebep ?? null,
    });

  if (error) {
    console.error("[lib/store/siparis] siparisIptal RPC hatası:", error.message);
    return { ok: false, error: error.message };
  }

  const ilkSatir = Array.isArray(data) && data.length > 0 ? data[0] : null;
  if (!ilkSatir) {
    return { ok: false, error: "RPC'den geçerli sonuç alınamadı." };
  }

  return {
    ok: Boolean(ilkSatir.ok),
    error: ilkSatir.hata ?? undefined,
  };
}

// ─── 3. TESLİM ALDIM ─────────────────────────────────────────────────────────

/**
 * Kullanıcı kendi siparişine "teslim aldım" der.
 * Sadece 'kargoda' durumdaki siparişe yapılabilir.
 * Sadece sipariş sahibi çağırabilir.
 */
export async function teslimAldim(
  supabase: SupabaseClient,
  siparisId: string,
  kullaniciId: string
): Promise<KayitSonuc> {
  const { data, error } = await supabase
    .rpc("store_teslim_aldim", {
      p_siparis_id: siparisId,
      p_kullanici_id: kullaniciId,
    });

  if (error) {
    console.error("[lib/store/siparis] teslimAldim RPC hatası:", error.message);
    return { ok: false, error: error.message };
  }

  const ilkSatir = Array.isArray(data) && data.length > 0 ? data[0] : null;
  if (!ilkSatir) {
    return { ok: false, error: "RPC'den geçerli sonuç alınamadı." };
  }

  return {
    ok: Boolean(ilkSatir.ok),
    error: ilkSatir.hata ?? undefined,
  };
}