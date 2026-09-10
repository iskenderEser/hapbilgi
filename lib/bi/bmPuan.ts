import type { SupabaseClient } from '@supabase/supabase-js';
import { puanBaglaminiOku, puanDonemi, type PuanSorgusu } from '@/lib/bi/puanSozlesmesi';

const ALANLAR = {
  izleme: 'izleme_puani',
  cevaplama: 'cevaplama_puani',
  extra: 'extra_puan',
  cc_gonderme: 'cc_gonderme_puani',
  cc_referral: 'cc_referral_puani',
  ileri_sarma: 'ileri_sarma_kaybi',
  yanlis_cevap: 'yanlis_cevap_kaybi',
  toplam_kazanc: 'toplam_kazanc',
  toplam_kayip: 'toplam_kayip',
  toplam_net: 'toplam_net',
} as const;

function sayiOku(satir: Record<string, unknown>, alan: string): number {
  const v = satir[alan];
  if (v === null || v === undefined || v === '' || !Number.isFinite(Number(v))) {
    throw new Error('VERI_EKSIK');
  }
  return Number(v);
}

export async function bmPuaniniOku(db: SupabaseClient, id: string, rol: string, s: PuanSorgusu, simdi = new Date()) {
  if (rol.trim().toLowerCase() !== 'bm' || !puanBaglaminiOku(s, rol)) throw new Error('ROL_DESTEKLENMIYOR');
  const donem = puanDonemi(s, simdi);
  if (donem.bitis < donem.baslangic) throw new Error('KAYIT_YOK');

  const { data, error } = await db.rpc('get_bm_puan_ozet', {
    p_bm_id: id,
    p_baslangic: donem.baslangic,
    p_bitis: donem.bitis,
  });
  if (error) throw new Error('VERI_OKUNAMADI');
  if (!data?.length) throw new Error('KAYIT_YOK');

  const satir = data[0] as Record<string, unknown>;
  let puan: number;

  if (s.olcut in ALANLAR) {
    puan = sayiOku(satir, ALANLAR[s.olcut as keyof typeof ALANLAR]);
  } else if ((s.olcut as string) === 'challenge_kaybi') {
    puan = sayiOku(satir, 'challenge_kaybi');
  } else {
    throw new Error('ROL_DESTEKLENMIYOR');
  }

  return { puan, donem };
}
