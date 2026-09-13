// E-Club puanları iki aylık dönemlerde kazanılır; çek talebi izleyen tek ayın 1–7'sinde alınır.
export const TR_SAAT_DILIMI = "Europe/Istanbul";
const TR_OFSET_MS = 3 * 60 * 60 * 1000;

export interface TrZamanParcalari { yil: number; ay: number; gun: number; saat: number; dakika: number; saniye: number; }

export function trZamanParcalari(tarih: Date = new Date()): TrZamanParcalari {
  const parcalar = new Intl.DateTimeFormat("en-US", { timeZone: TR_SAAT_DILIMI, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23" }).formatToParts(tarih);
  const al = (tip: string) => Number(parcalar.find((p) => p.type === tip)?.value ?? 0);
  return { yil: al("year"), ay: al("month"), gun: al("day"), saat: al("hour"), dakika: al("minute"), saniye: al("second") };
}

export function ayGunSayisi(yil: number, ay: number): number { return new Date(Date.UTC(yil, ay, 0)).getUTCDate(); }

export function trZamanUtc(yil: number, ay: number, gun: number, saat = 0, dakika = 0, saniye = 0): Date {
  return new Date(Date.UTC(yil, ay - 1, gun, saat, dakika, saniye) - TR_OFSET_MS);
}

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

export function formatKalanSure(ms: number): string {
  if (ms <= 0) return "0 dk";
  const dakika = Math.floor(ms / 60000); const saat = Math.floor(dakika / 60); const gun = Math.floor(saat / 24);
  if (gun > 0) return saat % 24 ? `${gun} gün ${saat % 24} sa` : `${gun} gün`;
  if (saat > 0) return dakika % 60 ? `${saat} sa ${dakika % 60} dk` : `${saat} sa`;
  return `${Math.max(1, dakika)} dk`;
}

export function formatKisaKalanSure(ms: number): string {
  if (ms <= 0) return "0 dk";
  const dakika = Math.floor(ms / 60000); const saat = Math.floor(dakika / 60); const gun = Math.floor(saat / 24);
  return gun > 0 ? `${gun} gün` : saat > 0 ? `${saat} sa` : `${Math.max(1, dakika)} dk`;
}

export function formatDonemKapanis(p: EclubDonemPenceresi): string {
  return `${p.bitisDahil.toLocaleDateString("tr-TR", { day: "numeric", month: "long", timeZone: TR_SAAT_DILIMI })} 23:59’a kadar`;
}
export function formatDonemAcilis(p: EclubDonemPenceresi): string {
  return `${p.baslangic.toLocaleDateString("tr-TR", { day: "numeric", month: "long", timeZone: TR_SAAT_DILIMI })} 00:00`;
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
