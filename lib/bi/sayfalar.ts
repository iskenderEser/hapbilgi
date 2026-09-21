import { YONETICI_ROLLER, URETICI_ROLLER, CCLIGI_GORENLERLER, ECLUB_YONETIM_ROLLERI, TUKETICI_ROLLER, STORE_GENEL_GOREN_ROLLER } from '@/lib/utils/roller';
import type { YonKonusu } from '@/lib/bi/yonlendirme';
type Link = { etiket: string; url: string };
export function yonLinkleri(rol: string, konu: YonKonusu, cc = false, eclub = false): Link[] {
  const uretici = URETICI_ROLLER.includes(rol);
  const rapor = YONETICI_ROLLER.includes(rol) ? '/raporlar/yonetici' : uretici ? '/raporlar/tclub-uretici' : rol === 'bm' ? '/raporlar/bm' : rol === 'tm' ? '/raporlar/tm' : '/raporlar/utt';
  const tR = { etiket: 'T-Club Raporları', url: rapor };
  const tL = { etiket: 'T-Club Ligi', url: TANIM_SAYFALARI['tclub_ligi'].url };
  if (konu === 'platform_disi' || konu === 'genel') return [];
  if (konu === 'tclub_ligi') return [tL];
  if (konu === 'tclub') return [tR, tL];
  if (konu === 'cclub' || konu === 'cclub_ligi') return cc && CCLIGI_GORENLERLER.includes(rol)
    ? [...(konu === 'cclub' && rol === 'bm' ? [{ etiket: 'Challenge Club', url: TANIM_SAYFALARI['challenge'].url }] : []), { etiket: 'C-Club Ligi', url: TANIM_SAYFALARI['cclub_ligi'].url }] : [];
  if (konu === 'eclub' || konu === 'eclub_ligi') return eclub && ECLUB_YONETIM_ROLLERI.includes(rol)
    ? [...(konu === 'eclub' ? [{ etiket: 'E-Club Takım Raporları', url: '/eclub/raporlar' }] : []), { etiket: 'E-Club Ligi', url: '/eclub/ligi' }] : [];
  if (YONETICI_ROLLER.includes(rol) && ['talepler','yayinlar','kendi_uretim','firma_uretim'].includes(konu)) return [{ etiket: 'Yayın Raporları', url: '/raporlar/yayin-raporlari' }];
  if (uretici && ['talepler','yayinlar','kendi_uretim','firma_uretim'].includes(konu)) {
    if (konu === 'talepler') return [{ etiket: 'Talep Takip ve Yeni Talep', url: TANIM_SAYFALARI['talepler'].url }];
    if (konu === 'yayinlar') return [{ etiket: 'Yayın Yönetimi', url: TANIM_SAYFALARI['yayinlar'].url }];
    return [{ etiket: konu === 'firma_uretim' ? 'Yayın Raporları' : 'Üretici Raporu', url: konu === 'firma_uretim' ? '/raporlar/yayin-raporlari' : '/raporlar/uretici' }];
  }
  return [];
}

const TANIM_SAYFALARI: Readonly<Record<string, Link>> = {
 "hapbilgi": { etiket: "HapBilgi Nedir?", url: "/hapbilgi-nedir" },
 "bi": { etiket: "Nasıl Çalışır?", url: "/nasil-calisir" },
 "tclub_ligi": { etiket: "T-Club Ligi", url: "/t-club-ligi" },
 "challenge": { etiket: "C-Club", url: "/challenge-club" },
 "cclub_ligi": { etiket: "CC-Ligi", url: "/cc-ligi" },
 "store": { etiket: "HBStore", url: "/store" },
 "eclub_takim": { etiket: "E-Club", url: "/eclub/eczanelerim" },
 "talepler": { etiket: "Taleplerim", url: "/yayin-takip" },
 "yayinlar": { etiket: "Yayın Yönetimi", url: "/yayin-yonetimi" },
};
export function tanimSayfasi(sayfa: string | undefined, rol: string): Link | undefined {
 if (!sayfa) return;
 if (YONETICI_ROLLER.includes(rol) && ['talepler','yayinlar'].includes(sayfa)) return yonLinkleri(rol, 'firma_uretim')[0];
 if (sayfa === 'challenge' && rol !== 'bm') return CCLIGI_GORENLERLER.includes(rol) ? yonLinkleri(rol, 'cclub_ligi', true)[0] : undefined;
 if (sayfa === 'cclub_ligi' && !CCLIGI_GORENLERLER.includes(rol)) return;
 if (sayfa === 'eclub_takim' && !TUKETICI_ROLLER.includes(rol)) return ECLUB_YONETIM_ROLLERI.includes(rol) ? yonLinkleri(rol, 'eclub', false, true)[0] : undefined;
 if (sayfa === 'store' && STORE_GENEL_GOREN_ROLLER.includes(rol) && rol !== 'bm') return { etiket: 'Siparişler', url: '/store/siparisler' };
 return TANIM_SAYFALARI[sayfa];
}
