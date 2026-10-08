import type { SupabaseClient } from '@supabase/supabase-js';

import { firmaEclubDurumu } from '@/lib/firma/eclubDurumu';

export async function ligEclubDurumu(db: SupabaseClient, firmaId: string | null): Promise<boolean> {
  if (!firmaId) throw new Error('Lig için firma bilgisi eksik.');
  return firmaEclubDurumu(db, firmaId);
}

/** Görünürlük değişir; geçmiş puan, sıralama ve kürsü kayıtları aynı kalır. */
export function ligModulDurumunuUygula<T extends object>(veri: T, eclubAcik: boolean): T & { eclub_acik: boolean } {
  return { ...veri, eclub_acik: eclubAcik };
}
