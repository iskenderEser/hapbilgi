// lib/cc/tekrarIzlemeKontrol.ts
// Alıcı BM verilen videoyu daha önce izlemiş mi kontrolü.
//
// CC iş kuralı: BM-A bir videoyu BM-B'ye göndermek isterse, BM-B o videoyu
// daha önce tamamlamışsa gönderim engellenir. Bu fonksiyon engelin tespitini yapar.
//
// İlgili dokümantasyon: Karar Belgesi 5 (lib katmanı), iş kuralı 4. madde.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TekrarIzlemeSonuc } from "@/lib/cc/tipler";

/**
 * Alıcı BM bu videoyu izleyip tamamlamış mı kontrol eder.
 *
 * @param supabase - Supabase client
 * @param alanId - Kontrol edilen BM'in kullanici_id'si
 * @param alanAdi - "Ad Soyad" formatında BM adı (UI mesajı için arayan tarafa hatırlatılır)
 * @param yayinId - Kontrol edilen video yayını
 * @returns izlenmemis=true ise gönderim engeli yok; false ise alanAdi UI mesajı için kullanılır.
 */
export async function tekrarIzlemeKontrol(
  supabase: SupabaseClient,
  alanId: string,
  alanAdi: string,
  yayinId: string
): Promise<TekrarIzlemeSonuc> {
  const { data, error } = await supabase
    .from("cc_izleme_kayitlari")
    .select("izleme_id")
    .eq("bm_id", alanId)
    .eq("yayin_id", yayinId)
    .eq("tamamlandi_mi", true)
    .limit(1)
    .maybeSingle();

  if (error) {
    // Hata durumunda en güvenli davranış: izlenmemiş kabul et, akış devam etsin.
    // DB hatasını üst katman log'lar; tekrar izleme engeli güvenlik değil UX katmanı.
    return { izlenmemis: true };
  }

  if (data) {
    return { izlenmemis: false, izleyenAdi: alanAdi };
  }

  return { izlenmemis: true };
}