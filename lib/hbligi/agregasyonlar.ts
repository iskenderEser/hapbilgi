// lib/hbligi/agregasyonlar.ts
//
// HBLigi için paylaşımlı veri dönüşüm helper'ları.
// UTT puan satırlarından bölge/takım bazlı toplam ve sıralama üretir.

/**
 * UTT puan satırlarını verilen grup_id alanına göre gruplar ve her grup için
 * toplam_puan hesaplar.
 *
 * @param rows UTT satırları (toplam_puan + grup_id + grup_adi alanları)
 * @param grupIdAlani Gruplama yapılacak ID alan adı (örn. "bolge_id", "takim_id")
 * @param grupAdAlani Grup adı alan adı (örn. "bolge_adi", "takim_adi")
 * @returns { [grup_id]: { adi, toplam_puan } }
 */
export function toplamPuanGrupla(
  rows: Array<Record<string, any>>,
  grupIdAlani: string,
  grupAdAlani: string
): Record<string, { adi: string; toplam_puan: number }> {
  const sonuc: Record<string, { adi: string; toplam_puan: number }> = {};

  for (const row of rows) {
    const grup_id = row[grupIdAlani];
    if (!grup_id) continue;

    if (!sonuc[grup_id]) {
      sonuc[grup_id] = {
        adi: (row[grupAdAlani] as string) ?? "-",
        toplam_puan: 0,
      };
    }
    sonuc[grup_id].toplam_puan += (row.toplam_puan as number) ?? 0;
  }

  return sonuc;
}

/**
 * Gruplanmış toplam puanları sıralayıp her birine sıra numarası verir.
 * Sıralama: toplam_puan büyükten küçüğe.
 *
 * Çıktı formatı her grup için:
 *   { [idAlani]: grup_id, [adAlani]: adi, toplam_puan, sira }
 *
 * @param grupSonuc toplamPuanGrupla çıktısı
 * @param idAlani Çıktıdaki ID alan adı (örn. "bolge_id", "takim_id")
 * @param adAlani Çıktıdaki ad alan adı (örn. "bolge_adi", "takim_adi")
 */
export function sirayaKoy(
  grupSonuc: Record<string, { adi: string; toplam_puan: number }>,
  idAlani: string,
  adAlani: string
): Array<Record<string, any>> {
  return Object.entries(grupSonuc)
    .map(([grup_id, value]) => ({
      [idAlani]: grup_id,
      [adAlani]: value.adi,
      toplam_puan: value.toplam_puan,
    }))
    .sort((a, b) => (b.toplam_puan as number) - (a.toplam_puan as number))
    .map((item, i) => ({ ...item, sira: i + 1 }));
}