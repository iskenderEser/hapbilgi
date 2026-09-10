import { ureticiYetenegi, type TalepTuru } from '@/lib/uretici/yetenekler';
import { puanDonemi } from '@/lib/bi/puanSozlesmesi';

export const URETICI_OLCUTLERI = {
  talep_toplam: 'Toplam Talep',
  talep_acilan: 'Açılan Talep',
  uretimde: 'Üretimdeki Talep',
  inceleme: 'Onayınızı Bekleyen Talep',
  revizyon: 'Revizyondaki Talep',
  yayin_bekleyen: 'Yayına Alınmayı Bekleyen Öğrenme Aracı',
  yayinda: 'Yayındaki Yayın',
  yayinda_arac_turu: 'Yayındaki Öğrenme Aracı Türü',
  yayin_arac_dagilimi: 'Yayınların Öğrenme Araçlarına Göre Dağılımı',
  planlanan: 'Planlanan Yayın',
  durdurulan: 'Durdurulan Yayın',
  yayina_alinan: 'İlk Kez Yayına Alınan Öğrenme Aracı',
} as const;
export type UreticiSorgusu = {
  alan: 'uretim'; olcut: keyof typeof URETICI_OLCUTLERI;
  egitim: 'tumu' | TalepTuru;
  arac: 'tumu' | 'video' | 'podcast' | 'gorsel' | 'flip_pdf';
  zaman: 'simdi' | 'hafta' | 'ay' | 'donem' | 'yil';
  geriye: number; karsilastir: boolean;
};
// Üretici ailelerinin tamamı ortak yetenek kaynağından açılır.
export const ureticiBiAcikMi = (rol: string) => Boolean(ureticiYetenegi(rol));
export const olayOlcutuMu = (olcut: string) => olcut === 'talep_acilan' || olcut === 'yayina_alinan';

export function ureticiBaglaminiOku(v: unknown, rol: string): UreticiSorgusu | undefined {
  if (!ureticiBiAcikMi(rol) || !v || typeof v !== 'object') return;
  const s = v as Record<string, unknown>;
  if (s.alan !== 'uretim' || typeof s.olcut !== 'string' || !Object.hasOwn(URETICI_OLCUTLERI, s.olcut) ||
    (s.egitim !== 'tumu' && !ureticiYetenegi(rol)!.acabilecegiTalepTurleri.includes(s.egitim as TalepTuru)) ||
    !['tumu','video','podcast','gorsel','flip_pdf'].includes(String(s.arac)) ||
    !['simdi','hafta','ay','donem','yil'].includes(String(s.zaman)) ||
    !Number.isInteger(s.geriye) || Number(s.geriye) < 0 || Number(s.geriye) > 120 ||
    typeof s.karsilastir !== 'boolean') return;
  if (olayOlcutuMu(s.olcut) === (s.zaman === 'simdi')) return;
  if (s.zaman === 'simdi' && (s.geriye !== 0 || s.karsilastir)) return;
  if (s.karsilastir && Number(s.geriye) === 120) return;
  return { alan: 'uretim', olcut: s.olcut as UreticiSorgusu['olcut'], egitim: s.egitim as UreticiSorgusu['egitim'],
    arac: s.arac as UreticiSorgusu['arac'], zaman: s.zaman as UreticiSorgusu['zaman'],
    geriye: Number(s.geriye), karsilastir: s.karsilastir };
}
export function ureticiDonemi(s: UreticiSorgusu, simdi = new Date()) {
  if (s.zaman === 'simdi') return { etiket: 'Şu anda', baslangic: simdi.toISOString(), bitis: simdi.toISOString() };
  return puanDonemi({ ...s, olcut: 'toplam_net', zaman: s.zaman }, simdi);
}
