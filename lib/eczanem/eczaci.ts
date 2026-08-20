// lib/eczanem/eczaci.ts
// Eczacı/teknisyen tarafı ortak çözümleyici: giriş yapan E-Club kişisinin
// kimliğini (eclub_kisiler) ve aktif eczanesini (eclub_kisi_eczane) döndürür.
// Eczanem eczane route'ları (müşteri, gönderim, döküm, sipariş) bunu kullanır.

import { SupabaseClient } from "@supabase/supabase-js";

export async function eczaciAktifEczanesi(
  adminSupabase: SupabaseClient,
  authUserId: string
): Promise<{ ok: boolean; kisiId?: string; eczaneId?: string; hata?: string }> {
  const { data: kisi, error: kisiHatasi } = await adminSupabase
    .from("eclub_kisiler")
    .select("kisi_id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (kisiHatasi || !kisi) return { ok: false, hata: "Kişi kaydınız bulunamadı." };

  const { data: bag, error: bagHatasi } = await adminSupabase
    .from("eclub_kisi_eczane")
    .select("eczane_id")
    .eq("kisi_id", kisi.kisi_id)
    .eq("aktif_mi", true)
    .maybeSingle();

  if (bagHatasi || !bag) return { ok: false, hata: "Aktif eczane bağınız bulunamadı." };
  return { ok: true, kisiId: kisi.kisi_id, eczaneId: bag.eczane_id };
}
