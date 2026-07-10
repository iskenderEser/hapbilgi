// lib/utils/rolCozucu.ts
//
// ROL ÇÖZÜCÜ — "bu kişi kim?" sorusunun TEK cevap yeri (TB1, 09.07.2026).
//
// Neden: user_metadata.rol, girişte oturuma iliştirilen ve BAYATLAYABİLEN bir
// kopyadır (admin rolü değiştirse de eski kalabilir — proxy temizliğinde
// yakalanmış desen). Güvenilir kaynak v_auth_kimlik view'ıdır (kullanicilar +
// eclub_kisiler UNION'ı): admin ne yazdıysa o.
//
// Kural: route'larda rol OKUMAK için yalnızca bu fonksiyon kullanılır.
// user_metadata'ya YAZAN admin kodları (kullanıcı oluşturma) kapsam dışıdır.

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * auth kullanıcısının rolünü v_auth_kimlik'ten okur (lowercase).
 * Kayıt yoksa veya hata olursa "" döner — boş rol, tüm rol kontrollerinden
 * reddedilir (mevcut davranışla aynı güvenli varsayılan).
 */
export async function rolCozucu(
  adminSupabase: SupabaseClient,
  authUserId: string
): Promise<string> {
  const { data, error } = await adminSupabase
    .from("v_auth_kimlik")
    .select("rol")
    .eq("auth_id", authUserId)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("[lib/utils/rolCozucu] v_auth_kimlik okunamadı:", error.message);
    return "";
  }

  return (data.rol ?? "").toLowerCase();
}