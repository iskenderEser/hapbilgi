// lib/push/abonelik.ts
//
// PUSH ABONELİK SAKLAMA (P3 — hapbilgi_push_teknik_is_plani.md).
// push_abonelikleri korumalı tablosunun TEK meşru yazım noktası (K-P8).
// Rol bilgisi BİLEREK yok (K-P2/K-P11): abonelik auth_user_id'ye bağlanır,
// rol gönderim anında rolCozucu ile çözülür.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TarayiciAboneligi } from "./tipler";

interface AbonelikSonuc {
  ok: boolean;
  hata?: string;
}

/**
 * Aboneliği endpoint UNIQUE anahtarı üzerinden upsert eder (K-P5):
 * - yeni endpoint → yeni satır;
 * - bilinen endpoint → sahiplik + anahtarlar tazelenir, aktif_mi=true,
 *   son_gorulme=now. Aynı tarayıcıda kullanıcı değişirse satır yeni
 *   kullanıcıya geçer (endpoint fiziksel tarayıcı profiline aittir).
 */
export async function abonelikUpsert(
  adminSupabase: SupabaseClient,
  authUserId: string,
  abonelik: TarayiciAboneligi,
  userAgent: string | null
): Promise<AbonelikSonuc> {
  const { error } = await adminSupabase.from("push_abonelikleri").upsert(
    {
      auth_user_id: authUserId,
      endpoint: abonelik.endpoint,
      p256dh: abonelik.keys.p256dh,
      auth: abonelik.keys.auth,
      user_agent: userAgent,
      aktif_mi: true,
      son_gorulme: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    console.error("[lib/push/abonelik] upsert hatası:", error.message);
    return { ok: false, hata: "Abonelik kaydedilemedi." };
  }
  return { ok: true };
}

/**
 * Aboneliği pasifler (fiziksel silme değil — §2.5 felsefesi).
 * authUserId verilirse yalnız o kullanıcının satırı etkilenir (istemci
 * DELETE'i — başkasının aboneliğini düşürememeli); verilmezse endpoint
 * tek başına yeter (ölü budama, K-P5 — gönderici 404/410 dönüşünde çağırır).
 */
export async function abonelikPasifle(
  adminSupabase: SupabaseClient,
  endpoint: string,
  authUserId?: string
): Promise<AbonelikSonuc> {
  let sorgu = adminSupabase
    .from("push_abonelikleri")
    .update({ aktif_mi: false, son_gorulme: new Date().toISOString() })
    .eq("endpoint", endpoint);

  if (authUserId) sorgu = sorgu.eq("auth_user_id", authUserId);

  const { error } = await sorgu;
  if (error) {
    console.error("[lib/push/abonelik] pasifleme hatası:", error.message);
    return { ok: false, hata: "Abonelik pasiflenemedi." };
  }
  return { ok: true };
}

/**
 * Bir kullanıcının gönderime hazır (aktif) aboneliklerini döner —
 * orkestrasyonun (P5) alıcı başına abonelik sorgusu.
 */
export async function aktifAbonelikleriGetir(
  adminSupabase: SupabaseClient,
  authUserId: string
): Promise<{ endpoint: string; p256dh: string; auth: string }[]> {
  const { data, error } = await adminSupabase
    .from("push_abonelikleri")
    .select("endpoint, p256dh, auth")
    .eq("auth_user_id", authUserId)
    .eq("aktif_mi", true);

  if (error) {
    console.error("[lib/push/abonelik] abonelik sorgusu hatası:", error.message);
    return [];
  }
  return data ?? [];
}
