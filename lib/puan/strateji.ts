// lib/puan/strateji.ts

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
 * KURALLAR (extra kuralı 09.07.2026'da CC modeline güncellendi — TB2):
 *
 * 1. Puansız zamanda (Cmt, Paz tüm gün + Pzt-Cum 20:30-06:59) hiçbir puan verilmez,
 *    hiçbir kayıp kaydedilmez, izleme 'extra' olarak işaretlenmez. Bu kontrol
 *    lib/zaman/kontrol.ts → puanKazanilabilirMi() ile yapılır.
 *
 * 2. İlk izleme: kullanıcının o yayın için GEÇERLİ TURDA 'izleme' türünde
 *    kazanilan_puanlar kaydı yoksa ilk izlemedir. İlk izlemede video_puani verilir.
 *
 * 3. Extra puan: ilk izleme SAYILMAZ. Takvim ayı içinde 3. tam tekrar izlemenin
 *    (ileri sarmasız, tamamlanmış, 'extra' türünde) sonunda, extra_puan değeri
 *    BİR KEZ verilir; o ayki 4. ve sonraki tekrarlar puansız. Her yeni ayda hak
 *    yenilenir. Tur kesişimi: sayım alt sınırı max(ay başı, geçerli tur başı).
 *    Mükerrer yapısal olarak imkânsızdır: puan yalnızca sayı === eşik anında düşer.
 *
 * 4. Öneri puanı: izleme_turu='oneri' ve öneri penceresi içinde izlendi ise
 *    sistem_ayarlari.oneri_puani değeri verilir. GEÇERLİ TUR başına tek defa.
 */

export type IzlemeKarari =
  | { tur: "ilk_izleme"; video_puani_ver: boolean }
  | { tur: "extra_aday"; aylik_tekrar_kontrolu_gerek: boolean }
  | { tur: "tekrar_puansiz" };

/**
 * Bir izlemenin türüne karar verir (ilk izleme mi, extra adayı mı, puansız tekrar mı).
 *
 * @param ilk_izleme_mi Kullanıcının o yayın için geçerli turda 'izleme' puanı var mı?
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
  return { tur: "extra_aday", aylik_tekrar_kontrolu_gerek: true };
}

/**
 * Ay içindeki tam tekrar sayısı extra puanı düşürüyor mu?
 *
 * Eşik: 3 tam tekrar (ilk izleme HARİÇ; sayılan yalnızca 'extra' türüne işaretlenmiş,
 * ileri sarmasız, tamamlanmış izlemelerdir — içinde bulunulan izleme dahil).
 *
 * Yalnızca sayı TAM eşiğe eşitken true döner — extra ay içinde tek kez düşer
 * (4.+ tekrarlarda sayı eşiği aşar, koşul bir daha tutmaz).
 *
 * @param aylik_tam_tekrar_sayisi Alt sınırdan (max(ay başı, tur başı)) bu yana tam tekrar sayısı
 */
export const EXTRA_PUAN_TEKRAR_ESIGI = 3;

export function extraPuanEsikKarsilandi(aylik_tam_tekrar_sayisi: number): boolean {
  return aylik_tam_tekrar_sayisi === EXTRA_PUAN_TEKRAR_ESIGI;
}