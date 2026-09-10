// lib/eclub/store/takvim.ts
//
// E-Club Store Aylık Sipariş Takvimi ("E-Club Store Günleri").
//
// Sipariş Takvimi Kuralları (Europe/Istanbul):
//   * Her ayın İLK 7 takvim gününde (1–7) sipariş alınır:
//     - 1. gün 00:00:00 TR'de açılır.
//     - 8. gün 00:00:00 TR'de kapanır (8. gün hariç, böylece 7. günün 23:59:59'u dahil).
//     - Ay uzunluğundan (28, 29, 30, 31) bağımsız olarak her ayın 1–7 günleri geçerlidir.
//   * Türkiye saat dilimi (Europe/Istanbul, kalıcı UTC+3) kullanılır.
//   * Puanlar aylık SIFIRLANMAZ; birikimli bakiye korunur ve sonraki aylara eksiksiz devreder.
//   * İptal, teslim alma, kargo ve bakiye hesapları takvimden bağımsızdır; yalnız YENİ siparişler kısıtlanır.

export const TR_SAAT_DILIMI = "Europe/Istanbul";
const TR_OFSET_MS = 3 * 60 * 60 * 1000;

export interface TrZamanParcalari {
  yil: number;
  ay: number; // 1-12
  gun: number; // 1-31
  saat: number; // 0-23
  dakika: number; // 0-59
  saniye: number; // 0-59
}

/**
 * Verilen anın Türkiye saatindeki (Europe/Istanbul) duvar saati bileşenlerini döner.
 */
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

  const al = (tip: string) => parcalar.find((p) => p.type === tip)?.value ?? "0";

  return {
    yil: Number(al("year")),
    ay: Number(al("month")),
    gun: Number(al("day")),
    saat: Number(al("hour")),
    dakika: Number(al("minute")),
    saniye: Number(al("second")),
  };
}

/**
 * Belirtilen yıl ve ayın toplam gün sayısını döner (28, 29, 30 veya 31).
 * ay: 1-12
 */
export function ayGunSayisi(yil: number, ay: number): number {
  return new Date(Date.UTC(yil, ay, 0)).getUTCDate();
}

/**
 * Türkiye saatindeki bir duvar saatini (yıl, ay[1-12], gün, saat, dakika, saniye)
 * mutlak UTC anına çevirir. Türkiye kalıcı UTC+3 olduğundan: UTC = TR − 3 saat.
 */
export function trZamanUtc(
  yil: number,
  ay: number,
  gun: number,
  saat = 0,
  dakika = 0,
  saniye = 0
): Date {
  return new Date(Date.UTC(yil, ay - 1, gun, saat, dakika, saniye) - TR_OFSET_MS);
}

const AY_ISIMLERI = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

export interface EclubDonemPenceresi {
  yil: number;
  ay: number; // 1-12
  sonGun: number;
  acilisGunu: number;
  baslangic: Date;
  bitisHaric: Date;
  bitisDahil: Date;
  etiket: string;
  donemAdi: string;
}

/**
 * Belirtilen yıl ve ay için E-Club Store'un sipariş penceresini döner.
 * Açılış: 1. gün 00:00:00 TR
 * Kapanış: 8. gün 00:00:00 TR hariç (7. gün 23:59:59 dahil)
 */
export function eclubAyPenceresi(yil: number, ay: number): EclubDonemPenceresi {
  const sonGun = ayGunSayisi(yil, ay);
  const acilisGunu = 1;
  const kapanisGunu = 8;

  const baslangic = trZamanUtc(yil, ay, acilisGunu, 0, 0, 0);
  const bitisHaric = trZamanUtc(yil, ay, kapanisGunu, 0, 0, 0);
  const bitisDahil = new Date(bitisHaric.getTime() - 1);

  const ayAdi = AY_ISIMLERI[ay - 1] ?? "";
  const etiket = `1–7 ${ayAdi}`;
  const donemAdi = `${ayAdi} ${yil}`;

  return {
    yil,
    ay,
    sonGun,
    acilisGunu,
    baslangic,
    bitisHaric,
    bitisDahil,
    etiket,
    donemAdi,
  };
}

/**
 * Verilen anın E-Club Store sipariş penceresi içinde olup olmadığını kontrol eder.
 *
 * Kural: Her ayın 1–7 günleri açıktır (1. gün 00:00 ile 8. gün 00:00 hariç arası).
 */
export function eclubStoreSiparisAcikMi(tarih: Date = new Date()): boolean {
  const { gun } = trZamanParcalari(tarih);
  return gun >= 1 && gun <= 7;
}

/**
 * Milisaniyeyi "X gün Y sa", "X sa Y dk" veya "X dk" formatına dönüştürür.
 */
export function formatKalanSure(ms: number): string {
  if (ms <= 0) return "0 dk";
  const saniye = Math.floor(ms / 1000);
  const dakika = Math.floor(saniye / 60);
  const saat = Math.floor(dakika / 60);
  const gun = Math.floor(saat / 24);

  const kalanSaat = saat % 24;
  const kalanDakika = dakika % 60;

  if (gun > 0) {
    return kalanSaat > 0 ? `${gun} gün ${kalanSaat} sa` : `${gun} gün`;
  }
  if (saat > 0) {
    return kalanDakika > 0 ? `${saat} sa ${kalanDakika} dk` : `${saat} sa`;
  }
  return `${Math.max(1, kalanDakika)} dk`;
}

/**
 * Navbar ve dar alanlar için kısa etiket ("X gün", "X sa", "X dk").
 */
export function formatKisaKalanSure(ms: number): string {
  if (ms <= 0) return "0 dk";
  const saniye = Math.floor(ms / 1000);
  const dakika = Math.floor(saniye / 60);
  const saat = Math.floor(dakika / 60);
  const gun = Math.floor(saat / 24);

  if (gun > 0) {
    return `${gun} gün`;
  }
  if (saat > 0) {
    return `${saat} sa`;
  }
  return `${Math.max(1, dakika)} dk`;
}

/**
 * Dönem kapanış tarihini kullanıcı dostu metne çevirir (Europe/Istanbul).
 * "00:00 hariç" teknik ifadesi yerine örn: "31 Mart 23:59’a kadar" biçimini üretir.
 */
export function formatDonemKapanis(pencere: EclubDonemPenceresi): string {
  const tarihMetni = new Date(pencere.bitisDahil).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    timeZone: TR_SAAT_DILIMI,
  });
  return `${tarihMetni} 23:59’a kadar`;
}

/**
 * Dönem açılış tarihini kullanıcı dostu metne çevirir (Europe/Istanbul).
 * Örn: "25 Mart 00:00"
 */
export function formatDonemAcilis(pencere: EclubDonemPenceresi): string {
  const tarihMetni = new Date(pencere.baslangic).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    timeZone: TR_SAAT_DILIMI,
  });
  return `${tarihMetni} 00:00`;
}

export interface EclubTakvimDurumu {
  acik: boolean;
  simdiIso: string;
  aktifPencere: EclubDonemPenceresi | null;
  sonrakiPencere: EclubDonemPenceresi;
  kalanMs: number;
  kalanSureMetni: string;
  kisaKalanSureMetni: string;
  durumMetni: string;
  navMetni: string;
  sonrakiDonemEtiketi: string;
  kapanisMetni: string;
  acilisMetni: string;
}

/**
 * Verilen anın E-Club Store takvim durumunu, aktif veya sonraki pencereyi ve
 * geri sayım metinlerini eksiksiz hesaplar.
 */
export function eclubStoreTakvimDurumu(tarih: Date = new Date()): EclubTakvimDurumu {
  const an = tarih.getTime();
  const { yil, ay } = trZamanParcalari(tarih);

  // Mevcut ayın penceresi
  const mevcutPencere = eclubAyPenceresi(yil, ay);

  // Aktif pencerede miyiz?
  const acik = an >= mevcutPencere.baslangic.getTime() && an < mevcutPencere.bitisHaric.getTime();
  const aktifPencere = acik ? mevcutPencere : null;

  // Sonraki açılacak pencereyi belirle
  let sonrakiPencere: EclubDonemPenceresi;
  if (acik) {
    // Açık durumdaysa bir sonraki ayın penceresi
    const sonrakiAy = ay === 12 ? 1 : ay + 1;
    const sonrakiYil = ay === 12 ? yil + 1 : yil;
    sonrakiPencere = eclubAyPenceresi(sonrakiYil, sonrakiAy);
  } else if (an < mevcutPencere.baslangic.getTime()) {
    // Bu ay henüz açılmadıysa, sonraki pencere bu ayın penceresidir
    sonrakiPencere = mevcutPencere;
  } else {
    // Bu ayın dönemi bitti ise sonraki ay
    const sonrakiAy = ay === 12 ? 1 : ay + 1;
    const sonrakiYil = ay === 12 ? yil + 1 : yil;
    sonrakiPencere = eclubAyPenceresi(sonrakiYil, sonrakiAy);
  }

  let kalanMs: number;
  let durumMetni: string;
  let navMetni: string;

  if (acik && aktifPencere) {
    kalanMs = Math.max(0, aktifPencere.bitisHaric.getTime() - an);
    const kalanSure = formatKalanSure(kalanMs);
    const kisaKalan = formatKisaKalanSure(kalanMs);
    // Şart: "E-Club Store açık · … kaldı"
    durumMetni = `E-Club Store açık · ${kalanSure} kaldı`;
    navMetni = `E-Club Store açık · ${kisaKalan}`;
  } else {
    kalanMs = Math.max(0, sonrakiPencere.baslangic.getTime() - an);
    const kalanSure = formatKalanSure(kalanMs);
    const kisaKalan = formatKisaKalanSure(kalanMs);
    // Şart: "E-Club Store Günleri’ne … kaldı"
    durumMetni = `E-Club Store Günleri’ne ${kalanSure} kaldı`;
    navMetni = `E-Club Store Günleri’ne ${kisaKalan}`;
  }

  return {
    acik,
    simdiIso: tarih.toISOString(),
    aktifPencere,
    sonrakiPencere,
    kalanMs,
    kalanSureMetni: formatKalanSure(kalanMs),
    kisaKalanSureMetni: formatKisaKalanSure(kalanMs),
    durumMetni,
    navMetni,
    sonrakiDonemEtiketi: acik && aktifPencere ? aktifPencere.etiket : sonrakiPencere.etiket,
    kapanisMetni: aktifPencere ? formatDonemKapanis(aktifPencere) : formatDonemKapanis(sonrakiPencere),
    acilisMetni: formatDonemAcilis(sonrakiPencere),
  };
}
