import type { SupabaseClient } from '@supabase/supabase-js';
import { TUKETICI_ROLLER } from '@/lib/utils/roller';
import { puanDonemi as uttPuanDonemi, puanBaglaminiOku, type PuanSorgusu as UttPuanSorgusu, type PuanTuru } from '@/lib/bi/puanSozlesmesi';
export { UTT_PUAN_BASLIKLARI as PUAN_BASLIKLARI, puanBaglaminiOku, puanDonemi as uttPuanDonemi } from '@/lib/bi/puanSozlesmesi';
export type { PuanSorgusu as UttPuanSorgusu } from '@/lib/bi/puanSozlesmesi';

const ALANLAR = { izleme: 'video_puani', cevaplama: 'soru_puani', extra: 'extra_puan', oneri: 'oneri_puani',
  ileri_sarma: 'ileri_sarma_kaybi', yanlis_cevap: 'yanlis_cevap_kaybi', oneri_kaybi: 'oneri_kaybi' } as const;
export async function uttPuaniniOku(db: SupabaseClient, id: string, rol: string, s: UttPuanSorgusu, simdi = new Date()) {
  if (!TUKETICI_ROLLER.includes(rol.trim().toLowerCase()) || !puanBaglaminiOku(s, rol)) throw new Error('ROL_DESTEKLENMIYOR');
  const donem = uttPuanDonemi(s, simdi);
  if (donem.bitis < donem.baslangic) throw new Error('KAYIT_YOK');
  const puanlar = {} as Record<PuanTuru, number>;
  const toplam = ['toplam_kazanc','toplam_kayip','toplam_net'].includes(s.olcut);
  if (s.olcut !== 'eclub') {
    const { data, error } = await db.rpc('get_kullanici_ozet', { p_kullanici_id: id, p_baslangic: donem.baslangic, p_bitis: donem.bitis });
    if (error) throw new Error('VERI_OKUNAMADI');
    if (!data?.length) throw new Error('KAYIT_YOK');
    for (const [tur, alan] of Object.entries(ALANLAR)) {
      if (!toplam && tur !== s.olcut) continue;
      const v = data[0][alan];
      if (v === null || v === undefined || v === '' || !Number.isFinite(Number(v))) throw new Error('VERI_EKSIK');
      puanlar[tur as PuanTuru] = Number(v);
    }
  }
  puanlar.eclub = 0;
  if (['eclub','toplam_kazanc','toplam_net'].includes(s.olcut)) {
    // Sayfalama, Supabase satır sınırında toplamın sessizce eksilmesini önler.
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await db.from('eclub_utt_puanlari').select('puan').eq('utt_id', id)
        .gte('created_at', donem.baslangic).lte('created_at', donem.bitis)
        .order('utt_puan_id').range(offset, offset + 499);
      if (error || !Array.isArray(data)) throw new Error('VERI_OKUNAMADI');
      for (const row of data) {
        if (row.puan === null || row.puan === '' || !Number.isFinite(Number(row.puan))) throw new Error('VERI_EKSIK');
        puanlar.eclub += Number(row.puan);
      }
      if (data.length < 500) break;
    }
  }
  if (toplam) {
    puanlar.toplam_kazanc = puanlar.izleme + puanlar.cevaplama + puanlar.extra + puanlar.oneri + puanlar.eclub;
    puanlar.toplam_kayip = puanlar.ileri_sarma + puanlar.yanlis_cevap + puanlar.oneri_kaybi;
    puanlar.toplam_net = puanlar.toplam_kazanc - puanlar.toplam_kayip;
  }
  return { puan: puanlar[s.olcut], donem };
}
