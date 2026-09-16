// E-Club puanları iki aylık dönemlerde kazanılır; çek talebi izleyen tek ayın 1–7'sinde alınır.
import {
  formatDonemAcilis,
  formatDonemKapanis,
  formatKalanSure,
  formatKisaKalanSure,
  trZamanParcalari,
  trZamanUtc,
} from "@/lib/zaman/turkiye";

export {
  formatDonemAcilis,
  formatDonemKapanis,
  formatKalanSure,
  formatKisaKalanSure,
  TR_SAAT_DILIMI,
  trZamanParcalari,
  trZamanUtc,
} from "@/lib/zaman/turkiye";
export type { TrZamanParcalari } from "@/lib/zaman/turkiye";

export function ayGunSayisi(yil: number, ay: number): number { return new Date(Date.UTC(yil, ay, 0)).getUTCDate(); }

const AY_ISIMLERI = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

export interface EclubDonemPenceresi {
  yil: number; ay: number; sonGun: number; acilisGunu: number; baslangic: Date; bitisHaric: Date; bitisDahil: Date;
  etiket: string; donemAdi: string; donemKodu: string; kazancBaslangic: Date; kazancBitisHaric: Date;
}

/** Talep ayı yalnız Ocak, Mart, Mayıs, Temmuz, Eylül veya Kasım olabilir. */
export function eclubAyPenceresi(yil: number, ay: number): EclubDonemPenceresi {
  if (ay < 1 || ay > 12 || ay % 2 === 0) throw new Error("E-Club talep ayı tek ay olmalıdır.");
  const baslangic = trZamanUtc(yil, ay, 1);
  const bitisHaric = trZamanUtc(yil, ay, 8);
  const oncekiAy = ay === 1 ? 11 : ay - 2;
  const kazancYili = ay === 1 ? yil - 1 : yil;
  const periyot = oncekiAy === 11 ? 6 : (oncekiAy + 1) / 2;
  return {
    yil, ay, sonGun: ayGunSayisi(yil, ay), acilisGunu: 1, baslangic, bitisHaric,
    bitisDahil: new Date(bitisHaric.getTime() - 1), etiket: `1–7 ${AY_ISIMLERI[ay - 1]}`,
    donemAdi: `${AY_ISIMLERI[oncekiAy - 1]}–${AY_ISIMLERI[oncekiAy]} ${kazancYili}`,
    donemKodu: `${kazancYili}-P${periyot}`, kazancBaslangic: trZamanUtc(kazancYili, oncekiAy, 1), kazancBitisHaric: baslangic,
  };
}

export function eclubStoreSiparisAcikMi(tarih: Date = new Date()): boolean {
  const { ay, gun } = trZamanParcalari(tarih);
  return ay % 2 === 1 && gun >= 1 && gun <= 7;
}

export interface EclubTakvimDurumu {
  acik: boolean; simdiIso: string; aktifPencere: EclubDonemPenceresi | null; sonrakiPencere: EclubDonemPenceresi;
  kalanMs: number; kalanSureMetni: string; kisaKalanSureMetni: string; durumMetni: string; navMetni: string;
  sonrakiDonemEtiketi: string; kapanisMetni: string; acilisMetni: string;
}

function sonrakiTalepAyi(yil: number, ay: number, gun: number): { yil: number; ay: number } {
  if (ay % 2 === 1 && gun <= 7) return { yil, ay };
  let hedefAy = ay % 2 === 0 ? ay + 1 : ay + 2; let hedefYil = yil;
  if (hedefAy > 12) { hedefAy -= 12; hedefYil += 1; }
  return { yil: hedefYil, ay: hedefAy };
}

export function eclubStoreTakvimDurumu(tarih: Date = new Date()): EclubTakvimDurumu {
  const an = tarih.getTime(); const { yil, ay, gun } = trZamanParcalari(tarih); const acik = eclubStoreSiparisAcikMi(tarih);
  const hedef = sonrakiTalepAyi(yil, ay, gun); const pencere = eclubAyPenceresi(hedef.yil, hedef.ay);
  const sonrakiPencere = acik ? eclubAyPenceresi(hedef.ay === 11 ? hedef.yil + 1 : hedef.yil, hedef.ay === 11 ? 1 : hedef.ay + 2) : pencere;
  const kalanMs = Math.max(0, (acik ? pencere.bitisHaric : pencere.baslangic).getTime() - an);
  const kalan = formatKalanSure(kalanMs); const kisa = formatKisaKalanSure(kalanMs);
  return { acik, simdiIso: tarih.toISOString(), aktifPencere: acik ? pencere : null, sonrakiPencere, kalanMs,
    kalanSureMetni: kalan, kisaKalanSureMetni: kisa,
    durumMetni: acik ? `E-Club Store açık · ${kalan} kaldı` : `E-Club Store Günleri’ne ${kalan} kaldı`,
    navMetni: acik ? `E-Club Store açık · ${kisa}` : `E-Club Store Günleri’ne ${kisa}`,
    sonrakiDonemEtiketi: acik ? pencere.etiket : sonrakiPencere.etiket,
    kapanisMetni: formatDonemKapanis(acik ? pencere : sonrakiPencere), acilisMetni: formatDonemAcilis(sonrakiPencere) };
}
