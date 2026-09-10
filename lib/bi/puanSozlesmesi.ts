import { TUKETICI_ROLLER } from '@/lib/utils/roller';
import { ayBaslangici, ayKaydir, haftaBaslangici, yilBaslangici, ceyrekBaslangici, gunBaslangici } from '@/lib/zaman/kontrol';

export const UTT_PUAN_BASLIKLARI = {
  izleme: 'İçerik Tamamlama Puanı', cevaplama: 'Doğru Cevap Puanı', extra: 'Extra Puan',
  oneri: 'Öneri Puanı', eclub: 'E-Club Öneri Tamamlama Puanı',
  ileri_sarma: 'İleri Sarma Kayıp Puanı', yanlis_cevap: 'Yanlış Cevap Kayıp Puanı',
  oneri_kaybi: 'Öneri Kayıp Puanı', toplam_kazanc: 'Toplam Kazanılan Puan',
  toplam_kayip: 'Toplam Kayıp Puan', toplam_net: 'Toplam Net Puan',
} as const;
export const BM_PUAN_BASLIKLARI = {
  izleme: 'İçerik Tamamlama Puanı', cevaplama: 'Doğru Cevap Puanı', extra: 'Extra Puan',
  cc_gonderme: 'Challenge Gönderme Puanı', cc_referral: 'Challenge Tamamlanma Puanı',
  ileri_sarma: 'İleri Sarma Kayıp Puanı', yanlis_cevap: 'Yanlış Cevap Kayıp Puanı',
  toplam_kazanc: 'Toplam Kazanılan Puan', toplam_kayip: 'Toplam Kayıp Puan', toplam_net: 'Toplam Net Puan',
} as const;
export function puanBasliklari(rol: string): Partial<Record<PuanTuru, string>> {
  if (rol.trim().toLowerCase() === 'tm') return { ...UTT_PUAN_BASLIKLARI, ...BM_PUAN_BASLIKLARI };
  if (rol.trim().toLowerCase() === 'bm') return BM_PUAN_BASLIKLARI;
  return TUKETICI_ROLLER.includes(rol.trim().toLowerCase()) ? UTT_PUAN_BASLIKLARI : {};
}
export type PuanTuru = keyof typeof UTT_PUAN_BASLIKLARI | keyof typeof BM_PUAN_BASLIKLARI;
export type TmHedef = { tur: 'takim' | 'bolge' | 'utt' | 'bm' | 'bm_toplam'; ad: string };
export type PuanSorgusu = { hedef?: TmHedef; olcut: PuanTuru; zaman: 'hafta' | 'ay' | 'donem' | 'yil'; geriye: number; karsilastir: boolean };
export function puanBaglaminiOku(v: unknown, rol = 'utt'): PuanSorgusu | undefined {
  if (!v || typeof v !== 'object') return;
  const s = v as Record<string, unknown>;
  if (typeof s.olcut !== 'string' || !Object.hasOwn(puanBasliklari(rol), s.olcut) ||
      !['hafta','ay','donem','yil'].includes(String(s.zaman)) ||
      !Number.isInteger(s.geriye) || Number(s.geriye) < 0 || Number(s.geriye) > 120 || typeof s.karsilastir !== 'boolean') return;
  let hedef: TmHedef | undefined;
  if (rol.trim().toLowerCase() === 'tm') {
    if (!s.hedef || typeof s.hedef !== 'object') return;
    const h = s.hedef as Record<string, unknown>;
    // Bunlar erişim rolleri değil, TM sorgusunun veri hedefleridir.
    // eslint-disable-next-line hapbilgi-mimari/rol-tek-kaynak
    if (!['takim', 'bolge', 'utt', 'bm', 'bm_toplam'].includes(String(h.tur)) ||
        typeof h.ad !== 'string' || h.ad.length > 200) return;
    hedef = { tur: h.tur as TmHedef['tur'], ad: h.ad.trim() };
    if ((hedef.tur === 'bolge' || hedef.tur === 'utt' || hedef.tur === 'bm') && !hedef.ad) return;
    const katalog = ['bm', 'bm_toplam'].includes(hedef.tur) ? BM_PUAN_BASLIKLARI : UTT_PUAN_BASLIKLARI;
    if (!Object.hasOwn(katalog, s.olcut)) return;
  }
  return { ...(hedef ? { hedef } : {}), olcut: s.olcut as PuanTuru, zaman: s.zaman as PuanSorgusu['zaman'], geriye: Number(s.geriye), karsilastir: s.karsilastir };
}
export function puanDonemi(s: PuanSorgusu, simdi = new Date()) {
  const bas = { hafta: haftaBaslangici, ay: ayBaslangici, donem: ceyrekBaslangici, yil: yilBaslangici }[s.zaman](simdi);
  const kaydir = (n: number) => s.zaman === 'hafta'
    ? new Date(bas.getTime() - n * 7 * 86400000)
    : ayKaydir(bas, -n * ({ ay: 1, donem: 3, yil: 12 }[s.zaman]));
  const baslangic = kaydir(s.geriye);
  const bitis = s.geriye > 0 ? new Date(kaydir(s.geriye - 1).getTime() - 1)
    : s.zaman === 'donem' ? new Date(gunBaslangici(simdi).getTime() - 1) : simdi;
  const tur = { hafta: 'hafta', ay: 'ay', donem: 'dönem', yil: 'yıl' }[s.zaman];
  return { baslangic: baslangic.toISOString(), bitis: bitis.toISOString(),
    etiket: s.geriye === 0 ? `Bu ${tur}` : s.geriye === 1 ? `Geçen ${tur}` : `${s.geriye} ${tur} önce` };
}
