// lib/cc/uygunVideoListesi.ts
// BM'in CC için gönderebileceği videoların listesi.
//
// İş kuralı: BM ancak kendi izleyip tamamladığı CC yayınlarını başka BM'ye
// gönderebilir ("Önce kendisi izlemiş olmalı" kuralı, Karar Belgesi 5).
//
// Filtreler:
//   1) Yayın CC için (hedef_roller içinde 'bm')
//   2) Yayın "yayinda" durumunda
//   3) BM o yayını tamamlamış (cc_izleme_kayitlari.tamamlandi_mi = true)
//
// İlgili dokümantasyon: Karar Belgesi 5 (lib katmanı), iş kuralı 6. madde.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { UygunVideo } from "@/lib/cc/tipler";

/**
 * BM'in gönderebileceği CC videolarını döndürür.
 * Boş array dönmesi (BM henüz hiç CC yayın tamamlamamış) normal bir durum.
 */
export async function uygunVideoListesi(
  supabase: SupabaseClient,
  bmId: string
): Promise<UygunVideo[]> {
  // Paralel: (1) Yayında olan CC yayınları, (2) BM'in tamamladığı izlemeler
  const [yayinlarRes, izlemelerRes] = await Promise.all([
    supabase
      .from("v_yayin_detay")
      .select("yayin_id, urun_adi, teknik_adi, video_url, thumbnail_url")
      .eq("durum", "yayinda")
      .eq("hedef_rol", "bm"),
    supabase
      .from("cc_izleme_kayitlari")
      .select("yayin_id")
      .eq("bm_id", bmId)
      .eq("tamamlandi_mi", true),
  ]);

  if (yayinlarRes.error || !yayinlarRes.data) return [];
  if (izlemelerRes.error || !izlemelerRes.data) return [];

  // BM'in tamamladığı yayin_id'ler — Set ile O(1) lookup
  const tamamlananSet = new Set<string>(
    izlemelerRes.data.map((iz: { yayin_id: string }) => iz.yayin_id)
  );

  // CC yayınlarından sadece BM'in tamamladıkları
  const sonuc: UygunVideo[] = yayinlarRes.data
    .filter((y: { yayin_id: string }) => tamamlananSet.has(y.yayin_id))
    .map((y) => ({
      yayin_id: y.yayin_id,
      urun_adi: y.urun_adi ?? "-",
      teknik_adi: y.teknik_adi ?? "-",
      video_url: y.video_url ?? null,
      thumbnail_url: y.thumbnail_url ?? null,
    }));

  return sonuc;
}