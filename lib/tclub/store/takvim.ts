// lib/tclub/store/takvim.ts
//
// HBStore Dönemlik Sipariş Takvimi ("Store Günleri").
//
// Sipariş Takvimi Kuralları (Europe/Istanbul):
//   * Her çeyreğin son 7 takvim gününde sipariş alınır:
//     - Q1 (Ocak–Mart):     25–31 Mart    (Açılış: 25 Mart 00:00, Kapanış: 1 Nisan 00:00 hariç)
//     - Q2 (Nisan–Haziran): 24–30 Haziran (Açılış: 24 Haziran 00:00, Kapanış: 1 Temmuz 00:00 hariç)
//     - Q3 (Temmuz–Eylül):  24–30 Eylül   (Açılış: 24 Eylül 00:00, Kapanış: 1 Ekim 00:00 hariç)
//     - Q4 (Ekim–Aralık):   25–31 Aralık  (Açılış: 25 Aralık 00:00, Kapanış: 1 Ocak 00:00 hariç)
//   * Açılış ilk gün 00:00:00, kapanış sonraki ayın 1. günü 00:00:00 hariç (böylece 23:59:59 dahil).
//   * Yıl sabitlemesi yoktur; tüm geçmiş ve gelecek yıllar için dinamik çalışır.
//   * Türkiye saat dilimi (Europe/Istanbul, kalıcı UTC+3) kullanılır.
//   * İptal, teslim alma, kargo ve bakiye hesapları takvimden bağımsızdır; yalnız YENİ siparişler kısıtlanır.

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

export interface DonemPenceresi {
  ceyrek: 1 | 2 | 3 | 4;
  yil: number;
  baslangic: Date;
  bitisHaric: Date;
  bitisDahil: Date;
  etiket: string;
  donemAdi: string;
}

/**
 * Belirtilen yıl için 4 çeyreğin sipariş pencerelerini döner.
 * Kurallar (Europe/Istanbul):
 *   - Q1 (Ocak–Mart):     1–7 Nisan     (Açılış: 1 Nisan 00:00, Kapanış: 8 Nisan 00:00 hariç)
 *   - Q2 (Nisan–Haziran): 1–7 Temmuz    (Açılış: 1 Temmuz 00:00, Kapanış: 8 Temmuz 00:00 hariç)
 *   - Q3 (Temmuz–Eylül):  1–7 Ekim      (Açılış: 1 Ekim 00:00, Kapanış: 8 Ekim 00:00 hariç)
 *   - Q4 (Ekim–Aralık):   1–7 Ocak (sonraki yıl) (Açılış: 1 Ocak 00:00, Kapanış: 8 Ocak 00:00 hariç)
 */
export function yilDonemPencereleri(yil: number): DonemPenceresi[] {
  return [
    {
      ceyrek: 1,
      yil,
      baslangic: trZamanUtc(yil, 4, 1, 0, 0, 0),
      bitisHaric: trZamanUtc(yil, 4, 8, 0, 0, 0),
      bitisDahil: new Date(trZamanUtc(yil, 4, 8, 0, 0, 0).getTime() - 1),
      etiket: "1–7 Nisan",
      donemAdi: "Ocak–Mart",
    },
    {
      ceyrek: 2,
      yil,
      baslangic: trZamanUtc(yil, 7, 1, 0, 0, 0),
      bitisHaric: trZamanUtc(yil, 7, 8, 0, 0, 0),
      bitisDahil: new Date(trZamanUtc(yil, 7, 8, 0, 0, 0).getTime() - 1),
      etiket: "1–7 Temmuz",
      donemAdi: "Nisan–Haziran",
    },
    {
      ceyrek: 3,
      yil,
      baslangic: trZamanUtc(yil, 10, 1, 0, 0, 0),
      bitisHaric: trZamanUtc(yil, 10, 8, 0, 0, 0),
      bitisDahil: new Date(trZamanUtc(yil, 10, 8, 0, 0, 0).getTime() - 1),
      etiket: "1–7 Ekim",
      donemAdi: "Temmuz–Eylül",
    },
    {
      ceyrek: 4,
      yil,
      baslangic: trZamanUtc(yil + 1, 1, 1, 0, 0, 0),
      bitisHaric: trZamanUtc(yil + 1, 1, 8, 0, 0, 0),
      bitisDahil: new Date(trZamanUtc(yil + 1, 1, 8, 0, 0, 0).getTime() - 1),
      etiket: "1–7 Ocak",
      donemAdi: "Ekim–Aralık",
    },
  ];
}

/**
 * Verilen anın HBStore sipariş penceresi içinde olup olmadığını kontrol eder.
 *
 * Sınırlar (Europe/Istanbul):
 *  - 4. Ay (Nisan):  1–7 Nisan  (1 Nisan 00:00 – 8 Nisan 00:00 hariç)
 *  - 7. Ay (Temmuz): 1–7 Temmuz (1 Temmuz 00:00 – 8 Temmuz 00:00 hariç)
 *  - 10. Ay (Ekim):  1–7 Ekim   (1 Ekim 00:00 – 8 Ekim 00:00 hariç)
 *  - 1. Ay (Ocak):   1–7 Ocak   (1 Ocak 00:00 – 8 Ocak 00:00 hariç)
 */
export function hbstoreSiparisAcikMi(tarih: Date = new Date()): boolean {
  const { ay, gun } = trZamanParcalari(tarih);
  return (
    (ay === 4 && gun >= 1 && gun <= 7) ||
    (ay === 7 && gun >= 1 && gun <= 7) ||
    (ay === 10 && gun >= 1 && gun <= 7) ||
    (ay === 1 && gun >= 1 && gun <= 7)
  );
}

export interface TakvimDurumu {
  acik: boolean;
  simdiIso: string;
  aktifPencere: DonemPenceresi | null;
  sonrakiPencere: DonemPenceresi;
  kalanMs: number;
  kalanSureMetni: string;
  kisaKalanSureMetni: string;
  durumMetni: string;
  navMetni: string;
  sonrakiDonemEtiketi: string;
  kapanisMetni: string;
  acilisMetni: string;
  bakiyeDonemEtiketi: string;
}

/**
 * Verilen anın HBStore takvim durumunu, aktif veya sonraki pencereyi ve
 * geri sayım metinlerini eksiksiz hesaplar.
 */
export function hbstoreTakvimDurumu(tarih: Date = new Date()): TakvimDurumu {
  const an = tarih.getTime();
  const { yil } = trZamanParcalari(tarih);

  // Önceki, mevcut ve sonraki yılın tüm pencerelerini sırayla al
  const tumPencereler = [
    ...yilDonemPencereleri(yil - 1),
    ...yilDonemPencereleri(yil),
    ...yilDonemPencereleri(yil + 1),
  ].sort((a, b) => a.baslangic.getTime() - b.baslangic.getTime());

  // Aktif pencere var mı?
  const aktifPencere =
    tumPencereler.find(
      (p) => an >= p.baslangic.getTime() && an < p.bitisHaric.getTime()
    ) ?? null;

  // Sonraki açılacak pencere
  const sonrakiPencere =
    tumPencereler.find((p) => p.baslangic.getTime() > an) ?? tumPencereler[tumPencereler.length - 1];

  const acik = aktifPencere !== null;

  let kalanMs: number;
  let durumMetni: string;
  let navMetni: string;
  let bakiyeDonemEtiketi: string;

  if (acik && aktifPencere) {
    kalanMs = Math.max(0, aktifPencere.bitisHaric.getTime() - an);
    const kalanSure = formatKalanSure(kalanMs);
    const kisaKalan = formatKisaKalanSure(kalanMs);
    durumMetni = `Store Günleri açık · ${kalanSure} kaldı`;
    navMetni = `Store Açık · ${kisaKalan}`;
    bakiyeDonemEtiketi = `${aktifPencere.donemAdi} (Q${aktifPencere.ceyrek}) kullanılabilir bakiyesi`;
  } else {
    kalanMs = Math.max(0, sonrakiPencere.baslangic.getTime() - an);
    const kalanSure = formatKalanSure(kalanMs);
    const kisaKalan = formatKisaKalanSure(kalanMs);
    durumMetni = `Store Günleri’ne ${kalanSure} kaldı`;
    navMetni = `Store Günleri’ne ${kisaKalan}`;
    bakiyeDonemEtiketi = `${sonrakiPencere.etiket} siparişi için biriken ${sonrakiPencere.donemAdi} (Q${sonrakiPencere.ceyrek}) puanı`;
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
    bakiyeDonemEtiketi,
  };
}
