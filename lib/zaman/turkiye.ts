export const TR_SAAT_DILIMI = "Europe/Istanbul";

const TR_OFSET_MS = 3 * 60 * 60 * 1000;

export interface TrZamanParcalari {
  yil: number;
  ay: number;
  gun: number;
  saat: number;
  dakika: number;
  saniye: number;
}

interface AcilisPenceresi {
  baslangic: Date;
}

interface KapanisPenceresi {
  bitisDahil: Date;
}

/** Verilen anın Türkiye saatindeki duvar saati bileşenlerini döndürür. */
export function trZamanParcalari(tarih: Date = new Date()): TrZamanParcalari {
  const parcalar = new Intl.DateTimeFormat("en-US", {
    timeZone: TR_SAAT_DILIMI,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  }).formatToParts(tarih);

  const al = (tip: string) => Number(parcalar.find((parca) => parca.type === tip)?.value ?? 0);

  return {
    yil: al("year"),
    ay: al("month"),
    gun: al("day"),
    saat: al("hour"),
    dakika: al("minute"),
    saniye: al("second"),
  };
}

/** Türkiye duvar saatini mutlak UTC anına çevirir. */
export function trZamanUtc(
  yil: number,
  ay: number,
  gun: number,
  saat = 0,
  dakika = 0,
  saniye = 0,
): Date {
  return new Date(Date.UTC(yil, ay - 1, gun, saat, dakika, saniye) - TR_OFSET_MS);
}

/** Milisaniyeyi kullanıcıya gösterilecek kalan süre metnine dönüştürür. */
export function formatKalanSure(ms: number): string {
  if (ms <= 0) return "0 dk";
  const dakika = Math.floor(ms / 60_000);
  const saat = Math.floor(dakika / 60);
  const gun = Math.floor(saat / 24);
  const kalanSaat = saat % 24;
  const kalanDakika = dakika % 60;

  if (gun > 0) return kalanSaat > 0 ? `${gun} gün ${kalanSaat} sa` : `${gun} gün`;
  if (saat > 0) return kalanDakika > 0 ? `${saat} sa ${kalanDakika} dk` : `${saat} sa`;
  return `${Math.max(1, kalanDakika)} dk`;
}

/** Navbar ve dar alanlar için kısa kalan süre etiketi üretir. */
export function formatKisaKalanSure(ms: number): string {
  if (ms <= 0) return "0 dk";
  const dakika = Math.floor(ms / 60_000);
  const saat = Math.floor(dakika / 60);
  const gun = Math.floor(saat / 24);

  if (gun > 0) return `${gun} gün`;
  if (saat > 0) return `${saat} sa`;
  return `${Math.max(1, dakika)} dk`;
}

export function formatDonemKapanis(pencere: KapanisPenceresi): string {
  const tarihMetni = pencere.bitisDahil.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    timeZone: TR_SAAT_DILIMI,
  });
  return `${tarihMetni} 23:59’a kadar`;
}

export function formatDonemAcilis(pencere: AcilisPenceresi): string {
  const tarihMetni = pencere.baslangic.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    timeZone: TR_SAAT_DILIMI,
  });
  return `${tarihMetni} 00:00`;
}
