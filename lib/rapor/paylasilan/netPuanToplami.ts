import type { SupabaseClient } from '@supabase/supabase-js';

export async function netPuanSatirlari(db: SupabaseClient, kapsam: Record<string, string>, baslangic: string, bitis: string): Promise<Array<{ kullanici_id: string; toplam_net_puan: number }>> {
  const sonuc: Array<{ kullanici_id: string; toplam_net_puan: number }> = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.rpc('get_kullanici_ozet', {
      p_baslangic: baslangic, p_bitis: bitis, ...kapsam,
    }).select('kullanici_id,toplam_net_puan').order('kullanici_id').range(offset, offset + 499);
    if (error) throw new Error('Katkı puanları alınamadı.', { cause: error });
    if (!Array.isArray(data)) throw new Error('Katkı puanları eksik.');
    for (const satir of data) {
      if (satir.toplam_net_puan == null || !Number.isFinite(Number(satir.toplam_net_puan))) throw new Error('Geçersiz net puan.');
      sonuc.push({ kullanici_id: satir.kullanici_id, toplam_net_puan: Number(satir.toplam_net_puan) });
    }
    if (data.length < 500) return sonuc;
  }
}

export async function netPuanToplami(db: SupabaseClient, kapsam: Record<string, string>, baslangic: string, bitis: string): Promise<number> {
  return (await netPuanSatirlari(db, kapsam, baslangic, bitis)).reduce((s, k) => s + k.toplam_net_puan, 0);
}
