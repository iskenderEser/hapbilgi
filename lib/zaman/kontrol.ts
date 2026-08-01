// lib/zaman/kontrol.ts

/**
 * Puan kazanma ve takvim-sınırı zaman kuralları.
 *
 * Puansız zamanlar:
 * - Cumartesi ve Pazar (tüm gün)
 * - Pazartesi-Cuma 20:30-06:59 arası
 *
 * Puansız zamanlarda:
 * - Video seyredilir
 * - Hiçbir puan kazanılmaz (video, extra, öneri)
 * - Soru gösterilmez
 * - İleri sarma kaybı kaydedilmez
 * - Extra izleme olarak sayılmaz
 *
 * Puanlı saatler: Pazartesi-Cuma 07:00-20:29 arası.
 *
 * ── ZAMAN DİLİMİ SÖZLEŞMESİ (B-12) ─────────────────────────────────────────
 * Bu dosyadaki TÜM kurallar Türkiye saatine (Europe/Istanbul) göre tanımlıdır
 * ve kodun çalıştığı sunucunun yerel saatinden BAĞIMSIZDIR. `getHours()`,
 * `getMonth()`, `getDay()` gibi çağrılar makinenin saat dilimini kullanır:
 * local'de TR (doğru), Vercel'de UTC (ay/hafta/yıl/çeyrek sınırları 3 saat kayar).
 * Bu yüzden takvim parçaları daima `Intl.DateTimeFormat` + Europe/Istanbul ile
 * okunur (`trParcalari`) ve TR duvar saatleri mutlak UTC anına çevrilir (`trAnUtc`).
 * Sonuç her iki ortamda da aynıdır — sistem nereye deploy edilirse edilsin kaymaz.
 */

const TR_SAAT_DILIMI = "Europe/Istanbul";
const GUN_INDEKSI: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// Türkiye 2016'dan beri kalıcı UTC+3'tedir; yaz saati (DST) uygulaması yoktur.
// Bu yüzden TR duvar saati ile UTC arası fark her zaman sabit 3 saattir.
const TR_OFSET_DK = 3 * 60;
const GUN_MS = 24 * 60 * 60 * 1000;

/**
 * Bir anın Türkiye saatine (Europe/Istanbul) göre takvim parçaları.
 * `Intl.DateTimeFormat` kullandığı için sunucunun saat dilimden bağımsızdır.
 */
interface TrParca {
  yil: number;
  ay: number; // 1-12
  gun: number; // 1-31
  saat: number; // 0-23
  dakika: number; // 0-59
  haftaGunu: number; // 0=Pazar ... 6=Cumartesi
}

function trParcalari(tarih: Date): TrParca {
  const parcalar = new Intl.DateTimeFormat("en-US", {
    timeZone: TR_SAAT_DILIMI,
    weekday: "short",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(tarih);
  const al = (tip: string) => parcalar.find((p) => p.type === tip)?.value ?? "";
  return {
    yil: Number(al("year")),
    ay: Number(al("month")),
    gun: Number(al("day")),
    saat: Number(al("hour")),
    dakika: Number(al("minute")),
    haftaGunu: GUN_INDEKSI[al("weekday")] ?? 0,
  };
}

/**
 * Türkiye saatindeki bir duvar saatini (yıl, ay[1-12], gün, saat, dakika)
 * mutlak UTC anına çevirir. Türkiye kalıcı UTC+3 olduğundan: UTC = TR − 3 saat.
 * `Date.UTC` gün/ay taşmasını (ör. gün 0 veya 32) otomatik normalize eder.
 */
function trAnUtc(yil: number, ay: number, gun: number, saat = 0, dakika = 0): Date {
  return new Date(Date.UTC(yil, ay - 1, gun, saat, dakika) - TR_OFSET_DK * 60 * 1000);
}

/**
 * Verilen tarihin puan kazanılabilir bir zamanda olup olmadığını kontrol eder.
 * Pencere TR saatiyle (Europe/Istanbul) hesaplanır; sunucunun saat diliminden bağımsızdır.
 *
 * @param tarih Kontrol edilecek tarih (Date objesi)
 * @returns true: puan kazanılabilir, false: puansız zaman
 */
export function puanKazanilabilirMi(tarih: Date): boolean {
  const { haftaGunu, saat, dakika } = trParcalari(tarih);

  // Cumartesi ve Pazar puansızdır
  if (haftaGunu < 1 || haftaGunu > 5) return false;

  // Pazartesi-Cuma 07:00-20:29 arası puanlıdır
  // 07:00 = 420 dakika, 20:29 = 1229 dakika
  const dakikaCinsinden = saat * 60 + dakika;
  return dakikaCinsinden >= 420 && dakikaCinsinden <= 1229;
}

/**
 * Verilen tarihin ait olduğu haftanın Pazartesi 00:00'ını (TR) döndürür.
 *
 * Hafta tanımı: Pazartesi 00:00:00 → Pazar 23:59:59 (Türkiye saati).
 *
 * @param tarih Herhangi bir tarih
 * @returns O haftanın Pazartesi günü 00:00:00 TR'sinin mutlak anı
 */
export function haftaBaslangici(tarih: Date): Date {
  const { yil, ay, gun, haftaGunu } = trParcalari(tarih);
  const pazartesiyeFark = haftaGunu === 0 ? -6 : 1 - haftaGunu;
  return trAnUtc(yil, ay, gun + pazartesiyeFark);
}

/**
 * İki tarihin aynı haftada (TR) olup olmadığını kontrol eder.
 *
 * @param tarih1 İlk tarih
 * @param tarih2 İkinci tarih
 * @returns true: aynı haftada, false: farklı haftalarda
 */
export function ayniHaftaMi(tarih1: Date, tarih2: Date): boolean {
  const h1 = haftaBaslangici(tarih1);
  const h2 = haftaBaslangici(tarih2);
  return h1.getTime() === h2.getTime();
}

/**
 * Verilen tarihin ait olduğu takvim ayının (TR) 1. günü 00:00'ını döndürür.
 *
 * @param tarih Herhangi bir tarih (default: now)
 * @returns O ayın 1. günü 00:00:00 TR'sinin mutlak anı
 */
export function ayBaslangici(tarih: Date = new Date()): Date {
  const { yil, ay } = trParcalari(tarih);
  return trAnUtc(yil, ay, 1);
}

/**
 * Verilen tarihin ait olduğu takvim yılının (TR) 1 Ocak 00:00'ını döndürür.
 *
 * @param tarih Herhangi bir tarih (default: now)
 * @returns O yılın 1 Ocak günü 00:00:00 TR'sinin mutlak anı
 */
export function yilBaslangici(tarih: Date = new Date()): Date {
  const { yil } = trParcalari(tarih);
  return trAnUtc(yil, 1, 1);
}

/**
 * Verilen tarihe N iş günü ekler. Hafta sonları (Cumartesi, Pazar — TR) atlanır.
 *
 * Saat bileşeni korunur — Pazartesi 09:30'a +5 iş günü eklenirse sonuç bir
 * sonraki haftanın Pazartesi 09:30'u olur. Gün atlaması ve hafta günü kontrolü
 * TR saatine göre yapılır (Türkiye DST kullanmadığı için +24 saat, duvar saatini korur).
 *
 * Challenge Club: alıcı BM'in challenge'ı izlemesi için verilen son_tarih
 * hesabında kullanılır.
 *
 * @param tarih Başlangıç tarihi
 * @param gun Eklenecek iş günü sayısı (pozitif tam sayı)
 * @returns Hafta sonları atlanmış, N iş günü ileri tarih
 */
export function isGunuEkle(tarih: Date, gun: number): Date {
  let sonuc = new Date(tarih);
  let eklenen = 0;

  while (eklenen < gun) {
    sonuc = new Date(sonuc.getTime() + GUN_MS);
    const { haftaGunu } = trParcalari(sonuc);
    if (haftaGunu !== 0 && haftaGunu !== 6) {
      eklenen++;
    }
  }

  return sonuc;
}

/**
 * İçinde bulunulan takvim çeyreğini (TR) döndürür.
 * Çeyrekler: Q1=Oca-Mar, Q2=Nis-Haz, Q3=Tem-Eyl, Q4=Eki-Ara.
 * Lig RPC'leri (get_hb_ligi_donemlik / get_cc_ligi_donemlik) için kullanılır.
 */
export function aktifDonem(tarih: Date = new Date()): { yil: number; ceyrek: number } {
  const { yil, ay } = trParcalari(tarih);
  return {
    yil,
    ceyrek: Math.floor((ay - 1) / 3) + 1,
  };
}
