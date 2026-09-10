import type { SupabaseClient } from '@supabase/supabase-js';
import { TUKETICI_ROLLER } from '@/lib/utils/roller';
import { puanDonemi as uttPuanDonemi, puanBaglaminiOku, type PuanSorgusu as UttPuanSorgusu, type PuanTuru } from '@/lib/bi/puanSozlesmesi';
export { UTT_PUAN_BASLIKLARI as PUAN_BASLIKLARI, puanBaglaminiOku, puanDonemi as uttPuanDonemi } from '@/lib/bi/puanSozlesmesi';
export type { PuanSorgusu as UttPuanSorgusu } from '@/lib/bi/puanSozlesmesi';

const ALANLAR = {
  izleme: 'video_puani',
  cevaplama: 'soru_puani',
  extra: 'extra_puan',
  oneri: 'oneri_puani',
  eclub: 'eclub_puani',
  ileri_sarma: 'ileri_sarma_kaybi',
  yanlis_cevap: 'yanlis_cevap_kaybi',
  oneri_kaybi: 'oneri_kaybi',
} as const;

function sayiOku(satir: Record<string, unknown>, alan: string): number {
  const v = satir[alan];
  if (v === null || v === undefined || v === '' || !Number.isFinite(Number(v))) {
    throw new Error('VERI_EKSIK');
  }
  return Number(v);
}

export function uttSatirPuani(satir: Record<string, unknown>, olcut: string): number {
  if (olcut === 'toplam_net') {
    return sayiOku(satir, 'toplam_net_puan');
  }
  if (olcut === 'toplam_kazanc') {
    return sayiOku(satir, 'video_puani')
      + sayiOku(satir, 'soru_puani')
      + sayiOku(satir, 'extra_puan')
      + sayiOku(satir, 'oneri_puani')
      + sayiOku(satir, 'eclub_puani');
  }
  if (olcut === 'toplam_kayip') {
    return sayiOku(satir, 'ileri_sarma_kaybi')
      + sayiOku(satir, 'yanlis_cevap_kaybi')
      + sayiOku(satir, 'oneri_kaybi');
  }
  if (olcut in ALANLAR) {
    return sayiOku(satir, ALANLAR[olcut as keyof typeof ALANLAR]);
  }
  throw new Error('ROL_DESTEKLENMIYOR');
}

export async function uttPuaniniOku(db: SupabaseClient, id: string, rol: string, s: UttPuanSorgusu, simdi = new Date()) {
  if (!TUKETICI_ROLLER.includes(rol.trim().toLowerCase()) || !puanBaglaminiOku(s, rol)) throw new Error('ROL_DESTEKLENMIYOR');
  const donem = uttPuanDonemi(s, simdi);
  if (donem.bitis < donem.baslangic) throw new Error('KAYIT_YOK');

  const { data, error } = await db.rpc('get_kullanici_ozet', { p_kullanici_id: id, p_baslangic: donem.baslangic, p_bitis: donem.bitis });
  if (error) throw new Error('VERI_OKUNAMADI');
  if (!data?.length) throw new Error('KAYIT_YOK');

  const satir = data[0] as Record<string, unknown>;
  const puan = uttSatirPuani(satir, s.olcut);

  return { puan, donem };
}

