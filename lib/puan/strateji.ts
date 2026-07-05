// lib/puan/puanTuru.ts

/**
 * Bir izleme tamamlandığında hangi puan türünün (ilk izleme, extra, puansız tekrar)
 * yazılacağına karar veren kurallar.
 *
 * Bu modüldeki fonksiyonlar SAF'tır — DB sorgusu yapmazlar, sadece verilen
 * girdilere göre karar üretirler. DB sorguları çağıran endpoint'te kalır.
 *
 * Kullanım yerleri:
 * - app/izle/api/bitir/route.ts (izleme tamamlandığında puan kararı)
 *
 * KURALLAR:
 *
 * 1. Puansız zamanda (Cmt, Paz tüm gün + Pzt-Cum 20:30-06:59) hiçbir puan verilmez,
 *    hiçbir kayıp kaydedilmez, izleme 'extra' olarak işaretlenmez. Bu kontrol
 *    lib/zaman/kontrol.ts → puanKazanilabilirMi() ile yapılır.
 *
 * 2. İlk izleme: kullanıcının o yayın için 'izleme' türünde kazanilan_puanlar
 *    kaydı yoksa ilk izlemedir. İlk izlemede video_puani verilir.
 *
 * 3. Extra puan: ilk izleme + 3 tam tekrar = toplam 4'üncü tam seyretme
 *    sonunda, ileri sarma olmadan, extra_puan değeri verilir.
 *    'Tam seyretme' = ileri sarmadan tamamlanmış izleme.
 *    Aynı hafta için tek extra puan verilir (mükerrer önleme).
 *
 * 4. Öneri puanı: izleme_turu='oneri' ve öneri penceresi içinde izlendi ise
 *    sistem_ayarlari.oneri_puani değeri verilir. Her yayın-kullanıcı çifti
 *    için tek defa verilir.
 */

export type IzlemeKarari =
  | { tur: "ilk_izleme"; video_puani_ver: boolean }
  | { tur: "extra_aday"; haftalik_izleme_kontrolu_gerek: boolean }
  | { tur: "tekrar_puansiz" };

/**
 * Bir izlemenin türüne karar verir (ilk izleme mi, extra adayı mı, puansız tekrar mı).
 *
 * @param ilk_izleme_mi Kullanıcının o yayın için daha önce 'izleme' puanı var mı?
 * @param ileri_sarildi Bu izlemede ileri sarma yapıldı mı?
 * @param izleme_turu İzleme türü ('kendi_kendine' | 'oneri' | 'extra')
 * @returns Karar objesi
 */
export function izlemeKarariBelirle(
  ilk_izleme_mi: boolean,
  ileri_sarildi: boolean,
  izleme_turu: string
): IzlemeKarari {
  // İlk izleme → video puanı
  if (ilk_izleme_mi) {
    return { tur: "ilk_izleme", video_puani_ver: true };
  }

  // Tekrar izleme, ileri sarıldı veya öneri türünde → extra puan adayı değil
  if (ileri_sarildi || izleme_turu !== "kendi_kendine") {
    return { tur: "tekrar_puansiz" };
  }

  // Tekrar izleme, ileri sarılmamış, kendi_kendine → extra puan adayı
  return { tur: "extra_aday", haftalik_izleme_kontrolu_gerek: true };
}

/**
 * Haftalık tam seyretme sayısı extra puan eşiğini karşılıyor mu?
 *
 * Eşik: 4 (ilk izleme + 3 tam tekrar).
 *
 * @param haftalik_tam_seyretme_sayisi O hafta içinde tamamlanmış, ileri sarılmamış izleme sayısı
 * @returns true: extra puan eşiği karşılandı, false: henüz değil
 */
export const EXTRA_PUAN_ESIGI = 4;

export function extraPuanEsikKarsilandi(haftalik_tam_seyretme_sayisi: number): boolean {
  return haftalik_tam_seyretme_sayisi === EXTRA_PUAN_ESIGI;
}