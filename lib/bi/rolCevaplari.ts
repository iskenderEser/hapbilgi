import { ureticiYetenegi } from '@/lib/uretici/yetenekler';
import { YONLENDIRICI_ROLLER, YONETICI_ROLLER } from '@/lib/utils/roller';
export const ORTAK_CEVAPLAR = ['hapbilgi','bi','tclub','tclub_ligi','cclub','cc_ligi','hbstore','eclub','eczanem'] as const;
const SAHA_YONETIMI = ['challenge','cc_gonderme_puani','cc_referral_puani'];
const URETIM_ORTAK = ['inceleme','yayin_bekleyen','tam_uretim','hazir_ikisi'];
const IK = ['ik_egitimi','yonetim_egitimi','talep','revizyon','planlanan_yayin','hazir_arac','hazir_set', ...URETIM_ORTAK];
const URETIM_SADE = ['talep_kisa','planlanan_yayin_kisa','hazir_arac_kisa','hazir_set_kisa', ...URETIM_ORTAK];
export function rolCevapKimlikleri(rol: string): readonly string[] {
 const r = rol.trim().toLowerCase();
 const aile = ureticiYetenegi(r)?.icerikTuru;
 return [...ORTAK_CEVAPLAR, ...(YONETICI_ROLLER.includes(r) ? [...URETIM_SADE, ...SAHA_YONETIMI] : aile === 'ik' ? IK : ['egitim', 'medikal', 'urun'].includes(aile ?? '') ? URETIM_SADE : YONLENDIRICI_ROLLER.includes(r) ? SAHA_YONETIMI : [])];
}
