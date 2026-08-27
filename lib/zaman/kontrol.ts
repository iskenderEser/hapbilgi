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
 *
 * ── YÜZEY KURALI (06.08.2026) ──────────────────────────────────────────────
 * Bu dosya dışarıya HAM PARÇA değil KAVRAM yayınlar. `trParcalari` bilinçli
 * olarak özeldir: parça okuyucusu dışarı çıkarsa her dosya kendi hesabını
 * yapmaya devam eder — sadece saati doğru olur, kopyalar kalır. Nitekim B-12
 * bu dosyayı düzelttiği hâlde 14 dosyada 59 elle hesap kaldı.
 *
 * Bir tüketicinin ham parçaya ihtiyacı varsa buradaki kavram eksiktir; çözüm
 * o kavramı buraya eklemektir, yüzeyi ham parçaya açmak değil.
 *
 * Sözleşmenin bekçisi: tests/zaman.sinir.smoke.test.ts (doğruyu ölçer) ve
 * hapbilgi-mimari/zaman-tek-kaynak lint kuralı (yanlışı engeller).
 */

const TR_SAAT_DILIMI = "Europe/Istanbul";
const GUN_INDEKSI: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// Türkiye 2016'dan beri kalıcı UTC+3'tedir; yaz saati (DST) uygulaması yoktur.
// Bu yüzden TR duvar saati ile UTC arası fark her zaman sabit 3 saattir.
const TR_OFSET_DK = 3 * 60;
const GUN_MS = 24 * 60 * 60 * 1000;
const HAFTA_MS = 7 * GUN_MS;

// Hafta etiketlerinde kullanılır (yilinHaftalari). Ay adları burada durur ki
// hafta listesi üreten her ekran kendi kopyasını taşımasın.
const AY_KISA = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

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

/**
 * Verilen anın ait olduğu TR gününün 00:00'ı.
 *
 * `setHours(0,0,0,0)` karşılığıdır ama makinenin saatini değil TR gününü
 * kullanır: UTC sunucuda `setHours` günü 03:00 TR'de başlatırdı.
 */
export function gunBaslangici(tarih: Date = new Date()): Date {
  const { yil, ay, gun } = trParcalari(tarih);
  return trAnUtc(yil, ay, gun);
}

/**
 * Verilen anın ait olduğu TR çeyreğinin ilk günü 00:00'ı.
 * Çeyrekler: Q1=Oca-Mar, Q2=Nis-Haz, Q3=Tem-Eyl, Q4=Eki-Ara.
 */
export function ceyrekBaslangici(tarih: Date = new Date()): Date {
  const { yil, ay } = trParcalari(tarih);
  return trAnUtc(yil, Math.floor((ay - 1) / 3) * 3 + 1, 1);
}

/**
 * Verilen anın TR ayından n ay kaydırılmış ayın 1. günü 00:00'ı (TR).
 * `Date.UTC` ay/yıl taşmasını normalize eder: Aralık +1 → gelecek yıl Ocak,
 * Ocak −1 → geçen yıl Aralık. Grafik dilimlerinde ardışık ay sınırları için
 * kullanılır (`ayBaslangici`'nin kaydırmalı biçimi; n=0 ay başının kendisi).
 */
export function ayKaydir(tarih: Date, n: number): Date {
  const { yil, ay } = trParcalari(tarih);
  return trAnUtc(yil, ay + n, 1);
}

/**
 * TR gününü `YYYY-MM-DD` olarak verir.
 *
 * `toISOString().slice(0,10)` yerine BUNU kullanın: o kalıp günü UTC'den keser,
 * TR saatiyle 00:00-02:59 arasında bir önceki günü döndürür.
 */
export function trGunu(tarih: Date = new Date()): string {
  const { yil, ay, gun } = trParcalari(tarih);
  return `${yil}-${String(ay).padStart(2, "0")}-${String(gun).padStart(2, "0")}`;
}

/**
 * `YYYY-MM-DD` gün dizesine N gün ekler, yine `YYYY-MM-DD` döner.
 * Ay ve yıl taşması `Date.UTC` tarafından normalize edilir (31 Ağustos +1 → 1 Eylül).
 *
 * @param gun Kaynak gün, `YYYY-MM-DD`
 * @param n Eklenecek gün sayısı (negatif olabilir)
 */
export function trGunEkle(gun: string, n: number): string {
  const [y, a, g] = gun.split("-").map(Number);
  return trGunu(trAnUtc(y, a, g + n));
}

/**
 * Bir yılın 1. haftasının Pazartesi'si (TR).
 * Hafta 1 tanımı: 1 Ocak'ı içeren haftanın Pazartesi'si — veritabanındaki
 * `date_trunc('week', make_date(yil,1,1))` ile aynı sözleşme.
 */
function yilinIlkHaftaPazartesi(yil: number): Date {
  const { haftaGunu } = trParcalari(trAnUtc(yil, 1, 1));
  const pazartesiyeFark = haftaGunu === 0 ? -6 : 1 - haftaGunu;
  return trAnUtc(yil, 1, 1 + pazartesiyeFark);
}

/**
 * HBLigi'nin seçilebilir tarih periyodunu, rapor RPC'lerinin kapsayıcı
 * timestamptz aralığına çevirir. Sınırlar HBLigi SQL'iyle aynı TR takvimidir.
 */
export function ligPeriyoduAraligi(p: {
  periyot: "ay" | "donem" | "yil" | "hafta";
  yil: number;
  ay: number;
  ceyrek: number;
  hafta: number;
}): { baslangic: string; bitis: string } {
  let baslangic: Date;
  let haricBitis: Date;

  if (p.periyot === "ay") {
    baslangic = trAnUtc(p.yil, p.ay, 1);
    haricBitis = trAnUtc(p.yil, p.ay + 1, 1);
  } else if (p.periyot === "donem") {
    const baslangicAyi = (p.ceyrek - 1) * 3 + 1;
    baslangic = trAnUtc(p.yil, baslangicAyi, 1);
    haricBitis = trAnUtc(p.yil, baslangicAyi + 3, 1);
  } else if (p.periyot === "yil") {
    baslangic = trAnUtc(p.yil, 1, 1);
    haricBitis = trAnUtc(p.yil + 1, 1, 1);
  } else {
    const ilkPazartesi = yilinIlkHaftaPazartesi(p.yil);
    baslangic = new Date(ilkPazartesi.getTime() + (p.hafta - 1) * HAFTA_MS);
    haricBitis = new Date(baslangic.getTime() + HAFTA_MS);
  }

  return {
    baslangic: baslangic.toISOString(),
    bitis: new Date(haricBitis.getTime() - 1).toISOString(),
  };
}

/**
 * Verilen anın TR hafta numarası (Pazartesi bazlı, 1 Ocak'ı içeren hafta = 1).
 * Lig periyot seçicileri ve haftalık lig RPC'si bu numarayı kullanır.
 */
export function haftaNo(tarih: Date = new Date()): number {
  const { yil } = trParcalari(tarih);
  const ilkPazartesi = yilinIlkHaftaPazartesi(yil);
  const gunBasi = gunBaslangici(tarih);
  return Math.floor((gunBasi.getTime() - ilkPazartesi.getTime()) / HAFTA_MS) + 1;
}

/**
 * Bir yılın hafta listesi — seçici dropdown'ları için numara + tarih aralıklı etiket.
 * Son hafta, 31 Aralık'ı içeren haftadır.
 */
export function yilinHaftalari(yil: number): { no: number; label: string }[] {
  const ilkPazartesi = yilinIlkHaftaPazartesi(yil);
  const etiketle = (t: Date) => {
    const { gun, ay } = trParcalari(t);
    return `${gun} ${AY_KISA[ay - 1]}`;
  };

  const liste: { no: number; label: string }[] = [];
  for (let n = 1; ; n++) {
    const bas = new Date(ilkPazartesi.getTime() + (n - 1) * HAFTA_MS);
    if (trParcalari(bas).yil > yil) break;
    const bit = new Date(bas.getTime() + 6 * GUN_MS);
    liste.push({ no: n, label: `${n}. Hafta (${etiketle(bas)} – ${etiketle(bit)})` });
  }
  return liste;
}

/**
 * İçinde bulunulan periyodun dört bileşeni tek çağrıda (TR).
 *
 * Lig sayfaları ve E-Club uçları bu üçlüyü (yıl/ay/çeyrek) ayrı ayrı ve elle
 * hesaplıyordu — aynı üç satır beş yerde kopyalanmıştı. Tek kaynak burasıdır.
 */
export function aktifPeriyot(tarih: Date = new Date()): {
  yil: number;
  ay: number;
  ceyrek: number;
  hafta: number;
} {
  const { yil, ay } = trParcalari(tarih);
  return {
    yil,
    ay,
    ceyrek: Math.floor((ay - 1) / 3) + 1,
    hafta: haftaNo(tarih),
  };
}

/** Aynı türde önceki lig dönemi; yıl/ay/hafta geçişi mevcut TR takviminden çözülür. */
export function oncekiLigPeriyodu(p: Parameters<typeof ligPeriyoduAraligi>[0]): Parameters<typeof ligPeriyoduAraligi>[0] {
  const oncekiAn = new Date(new Date(ligPeriyoduAraligi(p).baslangic).getTime() - 1);
  return { periyot: p.periyot, ...aktifPeriyot(oncekiAn) };
}

/** İki dönemin başlangıcından eşit sayıda tamamlanmış TR günü.
 * Bugünün kısmi verisi alınmaz; günlük CC özeti ve T-Club aynı pencereyle okunur.
 * Ay/çeyrek/yıl uzunlukları farklıysa kısa dönem kadar gün karşılaştırılır.
 */
export function esitSureliLigAraliklari(p: Parameters<typeof ligPeriyoduAraligi>[0], simdi = new Date()) {
  const mevcut = ligPeriyoduAraligi(p);
  const oncekiPeriyot = oncekiLigPeriyodu(p);
  const onceki = ligPeriyoduAraligi(oncekiPeriyot);
  const bas = new Date(mevcut.baslangic).getTime();
  const oncekiBas = new Date(onceki.baslangic).getTime();
  const mevcutTamGun = Math.max(0, Math.floor((Math.min(gunBaslangici(simdi).getTime(), new Date(mevcut.bitis).getTime() + 1) - bas) / GUN_MS));
  const oncekiGun = Math.floor((new Date(onceki.bitis).getTime() + 1 - oncekiBas) / GUN_MS);
  const gunSayisi = Math.min(mevcutTamGun, oncekiGun);
  if (gunSayisi <= 0) return null;
  return { gunSayisi, oncekiPeriyot,
    mevcut: { baslangic: mevcut.baslangic, bitis: new Date(bas + gunSayisi * GUN_MS - 1).toISOString() },
    onceki: { baslangic: onceki.baslangic, bitis: new Date(oncekiBas + gunSayisi * GUN_MS - 1).toISOString() } };
}
