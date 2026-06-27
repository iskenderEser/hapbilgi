// lib/rapor/paylasilan/ligSira.ts
//
// HBLigi sıralama dönüşümü.
//
// Bir rakip listesi (puana göre azalan sıralı) ve kullanıcının ID'si verildiğinde:
// - Her satıra "sira" alanı ekler (1, 2, 3, ...)
// - Her satıra "kendisi_mi" alanı ekler (bu satır kullanıcı mı)
// - Kullanıcının kendi sırasını döndürür
// - Bir üst sıradaki rakip ile puan farkını döndürür (geçmek için ne kadar gerek)
// - Bir alt sıradaki rakip ile puan farkını döndürür (takipçiyle aramız ne kadar)
//
// Kullanım: UTT/BM/TM/üretici raporlarında lig kartı için.

export interface LigSiraGirisSatir {
  /** Karşılaştırma için kullanılan ID (bolge_id, takim_id, kullanici_id, ...) */
  id: string;
  /** Görüntülenecek isim (bolge_adi, takim_adi, ad+soyad, ...) */
  ad: string;
  /** Net puan (azalan sıralı geldiği varsayılır) */
  toplam_puan: number;
}

export interface LigSiraCikisSatir {
  sira: number;
  id: string;
  ad: string;
  puan: number;
  kendisi_mi: boolean;
}

export interface LigSiraSonuc {
  /** Sıra numarası eklenmiş, kendisi_mi işaretli sıralı liste */
  siralama: LigSiraCikisSatir[];
  /** Kullanıcının kendi sırası (1-indexed), bulunamadıysa null */
  kendiSira: number | null;
  /** Bir üst sıradaki rakip ile aradaki puan farkı (geçmek için), en üstte ise null */
  birUstPuanFarki: number | null;
  /** Bir alt sıradaki rakip ile aradaki puan farkı (öndelik), en altta ise null */
  takipciFarki: number | null;
}

/**
 * Sıralı bir rakip listesinden lig kartı için gerekli tüm değerleri üretir.
 *
 * @param satirlar Puana göre azalan sıralı rakip listesi
 * @param kendiId Kullanıcının kendi ID'si (eşleştirme için)
 * @param kendiPuan Kullanıcının kendi puanı (üst/alt farkı için)
 */
export function ligSiralamasi(
  satirlar: LigSiraGirisSatir[],
  kendiId: string,
  kendiPuan: number
): LigSiraSonuc {
  const siralama: LigSiraCikisSatir[] = satirlar.map((s, idx) => ({
    sira: idx + 1,
    id: s.id,
    ad: s.ad,
    puan: s.toplam_puan,
    kendisi_mi: s.id === kendiId,
  }));

  const kendiSira = siralama.find(s => s.kendisi_mi)?.sira ?? null;

  let birUstPuanFarki: number | null = null;
  let takipciFarki: number | null = null;

  if (kendiSira && kendiSira > 1) {
    const ust = satirlar[kendiSira - 2];
    birUstPuanFarki = ust ? ust.toplam_puan - kendiPuan : null;
  }
  if (kendiSira && kendiSira < satirlar.length) {
    const alt = satirlar[kendiSira];
    takipciFarki = alt ? kendiPuan - alt.toplam_puan : null;
  }

  return {
    siralama,
    kendiSira,
    birUstPuanFarki,
    takipciFarki,
  };
}