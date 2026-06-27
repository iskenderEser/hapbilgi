// lib/rapor/paylasilan/agregasyon.ts
//
// UTT özetlerinden scope (bölge/takım/firma) bazında agregasyon.
// BM/TM/üretici raporlarında her birinde aynı 5 reduce/filter işlemi
// yapılıyordu; burada tek yere alındı.

export interface UttOzetSatiri {
  toplam_net_puan: number | null;
  izlenme_sayisi: number | null;
}

export interface UttOzetAgregasyonSonuc {
  /** Tüm UTT'lerin toplam net puanı */
  toplamNet: number;
  /** Tüm UTT'lerin toplam tamamlanmış izleme sayısı */
  toplamIzlenme: number;
  /** En az 1 izleme yapan UTT sayısı */
  aktifUtt: number;
  /** Hiç izleme yapmayan UTT sayısı (toplamUtt - aktifUtt, eksi koruma) */
  hicIzlemeyenUtt: number;
  /** Bir UTT'nin elde ettiği en yüksek net puan */
  enYuksekUttPuan: number;
}

/**
 * UTT özetlerinden scope bazında 5 değer üretir.
 *
 * @param uttOzetler UTT bazlı RPC sonucu (her satır bir UTT'nin scope içindeki özeti)
 * @param toplamUttSayisi Scope'taki toplam UTT sayısı (hicIzlemeyenUtt için referans)
 */
export function uttOzetAgregasyon(
  uttOzetler: UttOzetSatiri[],
  toplamUttSayisi: number
): UttOzetAgregasyonSonuc {
  const toplamNet = uttOzetler.reduce((acc, o) => acc + (o.toplam_net_puan ?? 0), 0);
  const toplamIzlenme = uttOzetler.reduce((acc, o) => acc + (o.izlenme_sayisi ?? 0), 0);
  const aktifUtt = uttOzetler.filter(o => (o.izlenme_sayisi ?? 0) > 0).length;
  const hicIzlemeyenUtt = Math.max(0, toplamUttSayisi - aktifUtt);
  const enYuksekUttPuan = uttOzetler.reduce((acc, o) => Math.max(acc, o.toplam_net_puan ?? 0), 0);

  return {
    toplamNet,
    toplamIzlenme,
    aktifUtt,
    hicIzlemeyenUtt,
    enYuksekUttPuan,
  };
}