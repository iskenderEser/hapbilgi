import type { SupabaseClient } from '@supabase/supabase-js';
import { puanBaglaminiOku, puanDonemi, type PuanSorgusu } from '@/lib/bi/puanSozlesmesi';

const KAZANIMLAR = ['izleme', 'cevaplama', 'extra', 'cc_gonderme', 'cc_referral'] as const;

export async function bmPuaniniOku(db: SupabaseClient, id: string, rol: string, s: PuanSorgusu, simdi = new Date()) {
  if (rol.trim().toLowerCase() !== 'bm' || !puanBaglaminiOku(s, rol)) throw new Error('ROL_DESTEKLENMIYOR');
  const donem = puanDonemi(s, simdi);
  if (donem.bitis < donem.baslangic) throw new Error('KAYIT_YOK');
  const toplam = ['toplam_kazanc', 'toplam_kayip', 'toplam_net'].includes(s.olcut);

  async function oku(tablo: string, alan: string, anahtar: string, turler?: readonly string[]) {
    let puan = 0;
    for (let offset = 0; ; offset += 500) {
      let sorgu = db.from(tablo).select(alan).eq('bm_id', id)
        .gte('created_at', donem.baslangic).lte('created_at', donem.bitis);
      if (turler) sorgu = sorgu.in('puan_turu', [...turler]);
      const { data, error } = await sorgu.order(anahtar).range(offset, offset + 499);
      if (error || !Array.isArray(data)) throw new Error('VERI_OKUNAMADI');
      for (const satir of data) {
        const deger = (satir as unknown as Record<string, unknown>)[alan];
        if (deger === null || deger === undefined || deger === '' || !Number.isFinite(Number(deger))) throw new Error('VERI_EKSIK');
        puan += Number(deger);
      }
      if (data.length < 500) return puan;
    }
  }
  // Yalnız oturumdaki BM'nin defterleri; UTT veya bölge toplamı kişisel puana katılmaz.
  const [kazanc, ileri, yanlis] = await Promise.all([
    s.olcut !== 'toplam_kayip' && (toplam || KAZANIMLAR.some(t => t === s.olcut))
      ? oku('cc_kazanilan_puanlar', 'puan', 'puan_id', toplam ? KAZANIMLAR : [s.olcut]) : 0,
    (toplam && s.olcut !== 'toplam_kazanc') || s.olcut === 'ileri_sarma'
      ? oku('cc_ileri_sarma_kayitlari', 'kaybedilen_puan', 'kayit_id') : 0,
    (toplam && s.olcut !== 'toplam_kazanc') || s.olcut === 'yanlis_cevap'
      ? oku('cc_yanlis_cevap_kayitlari', 'kaybedilen_puan', 'kayit_id') : 0,
  ]);
  const puan = s.olcut === 'toplam_net' ? kazanc - ileri - yanlis
    : s.olcut === 'toplam_kayip' ? ileri + yanlis
      : s.olcut === 'ileri_sarma' ? ileri : s.olcut === 'yanlis_cevap' ? yanlis : kazanc;
  return { puan, donem };
}
