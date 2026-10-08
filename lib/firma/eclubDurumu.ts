import type { SupabaseClient } from '@supabase/supabase-js';

export async function firmaEclubDurumu(db: SupabaseClient, firmaId: string | null): Promise<boolean> {
  if (!firmaId) throw new Error('Firma bilgisi eksik.');
  const { data, error } = await db.from('firmalar').select('eclub_aktif').eq('firma_id', firmaId).single();
  if (error || !data || typeof data.eclub_aktif !== 'boolean') throw new Error('E-Club modül durumu alınamadı.', { cause: error });
  return data.eclub_aktif;
}
