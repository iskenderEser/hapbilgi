// lib/zaman/kontrol.ts

/**
 * Puan kazanma zaman kuralları.
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
 */

// Puan penceresi Türkiye saatine göre tanımlıdır. Sunucu yerel saati
// KULLANILAMAZ: Vercel UTC çalışır, getHours() ile pencere fiilen
// 10:00-23:29 TR'ye kayardı (B-12).
const TR_SAAT_DILIMI = "Europe/Istanbul";
const GUN_INDEKSI: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/**
 * Verilen tarihin puan kazanılabilir bir zamanda olup olmadığını kontrol eder.
 * Pencere TR saatiyle (Europe/Istanbul) hesaplanır; sunucunun saat diliminden bağımsızdır.
 *
 * @param tarih Kontrol edilecek tarih (Date objesi)
 * @returns true: puan kazanılabilir, false: puansız zaman
 */
export function puanKazanilabilirMi(tarih: Date): boolean {
  const parcalar = new Intl.DateTimeFormat("en-US", {
    timeZone: TR_SAAT_DILIMI,
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(tarih);
  const al = (tip: string) => parcalar.find((p) => p.type === tip)?.value ?? "";

  const gun = GUN_INDEKSI[al("weekday")] ?? 0; // 0=Pazar ... 6=Cumartesi

  // Cumartesi ve Pazar puansızdır
  if (gun < 1 || gun > 5) return false;

  // Pazartesi-Cuma 07:00-20:29 arası puanlıdır
  // 07:00 = 420 dakika, 20:29 = 1229 dakika
  const dakikaCinsinden = Number(al("hour")) * 60 + Number(al("minute"));
  return dakikaCinsinden >= 420 && dakikaCinsinden <= 1229;
}

/**
 * Verilen tarihin ait olduğu haftanın Pazartesi 00:00'ını döndürür.
 *
 * Hafta tanımı: Pazartesi 00:00:00 → Pazar 23:59:59.
 *
 * @param tarih Herhangi bir tarih
 * @returns O haftanın Pazartesi günü 00:00:00'ı
 */
export function haftaBaslangici(tarih: Date): Date {
  const sonuc = new Date(tarih);
  const gun = sonuc.getDay(); // 0=Pazar, 1=Pazartesi, ..., 6=Cumartesi
  const pazartesiyeFark = gun === 0 ? -6 : 1 - gun;
  sonuc.setDate(sonuc.getDate() + pazartesiyeFark);
  sonuc.setHours(0, 0, 0, 0);
  return sonuc;
}

/**
 * İki tarihin aynı haftada olup olmadığını kontrol eder.
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
 * Verilen tarihin ait olduğu takvim ayının 1. günü 00:00'ını döndürür.
 *
 * @param tarih Herhangi bir tarih (default: now)
 * @returns O ayın 1. günü 00:00:00'ı
 */
export function ayBaslangici(tarih: Date = new Date()): Date {
  return new Date(tarih.getFullYear(), tarih.getMonth(), 1, 0, 0, 0, 0);
}

/**
 * Verilen tarihin ait olduğu takvim yılının 1 Ocak 00:00'ını döndürür.
 *
 * @param tarih Herhangi bir tarih (default: now)
 * @returns O yılın 1 Ocak günü 00:00:00'ı
 */
export function yilBaslangici(tarih: Date = new Date()): Date {
  return new Date(tarih.getFullYear(), 0, 1, 0, 0, 0, 0);
}

/**
 * Verilen tarihe N iş günü ekler. Hafta sonları (Cumartesi, Pazar) atlanır.
 *
 * Saat bileşeni korunur — Pazartesi 09:30'a +5 iş günü eklenirse sonuç bir
 * sonraki haftanın Pazartesi 09:30'u olur.
 *
 * Challenge Club: alıcı BM'in challenge'ı izlemesi için verilen son_tarih
 * hesabında kullanılır.
 *
 * @param tarih Başlangıç tarihi
 * @param gun Eklenecek iş günü sayısı (pozitif tam sayı)
 * @returns Hafta sonları atlanmış, N iş günü ileri tarih
 */
export function isGunuEkle(tarih: Date, gun: number): Date {
  const sonuc = new Date(tarih);
  let eklenen = 0;

  while (eklenen < gun) {
    sonuc.setDate(sonuc.getDate() + 1);
    const haftaGunu = sonuc.getDay();
    if (haftaGunu !== 0 && haftaGunu !== 6) {
      eklenen++;
    }
  }

  return sonuc;
}

/**
 * İçinde bulunulan takvim çeyreğini döndürür.
 * Çeyrekler: Q1=Oca-Mar, Q2=Nis-Haz, Q3=Tem-Eyl, Q4=Eki-Ara.
 * Lig RPC'leri (get_hb_ligi_donemlik / get_cc_ligi_donemlik) için kullanılır.
 */
export function aktifDonem(tarih: Date = new Date()): { yil: number; ceyrek: number } {
  return {
    yil: tarih.getFullYear(),
    ceyrek: Math.floor(tarih.getMonth() / 3) + 1,
  };
}