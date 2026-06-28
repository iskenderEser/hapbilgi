// lib/store/firmaGuard.ts
//
// HBStore firma erişim guard'ı (tek kaynak).
// Kullanıcının firmasında hbstore_aktif=false ise store erişimi reddedilir.
// Tüm store API uçları ve sayfa sunucu kontrolleri bunu çağırır.
// Admin bu guard'a tabi DEĞİLDİR (admin/store ayrı yüzeydir).

import type { SupabaseClient } from "@supabase/supabase-js";
import { rolHatasi } from "@/lib/utils/hataIsle";

export interface StoreGuardSonuc {
  // Erişim açıksa true; kapalıysa false (yanit dolu gelir).
  acik: boolean;
  // Kapalıysa doğrudan dönülecek hazır NextResponse (403).
  yanit?: ReturnType<typeof rolHatasi>;
}

/**
 * Kullanıcının firmasında HBStore açık mı kontrol eder.
 *
 * @param adminSupabase Admin client (RLS bypass)
 * @param userId auth user.id (= kullanicilar.kullanici_id)
 * @returns acik=true ise devam; acik=false ise yanit'ı return et.
 */
export async function storeFirmaGuard(
  adminSupabase: SupabaseClient,
  userId: string
): Promise<StoreGuardSonuc> {
  // Kullanıcının firmasını bul
  const { data: kullanici } = await adminSupabase
    .from("kullanicilar")
    .select("firma_id")
    .eq("kullanici_id", userId)
    .single();

  // Firma yoksa (atanmamışsa) store kapalı kabul edilir
  if (!kullanici?.firma_id) {
    return { acik: false, yanit: rolHatasi("HBStore firmanız için kullanılamıyor.") };
  }

  // Firmanın hbstore_aktif bayrağını oku
  const { data: firma } = await adminSupabase
    .from("firmalar")
    .select("hbstore_aktif")
    .eq("firma_id", kullanici.firma_id)
    .single();

  if (!firma || firma.hbstore_aktif === false) {
    return { acik: false, yanit: rolHatasi("HBStore firmanız için kapalı.") };
  }

  return { acik: true };
}