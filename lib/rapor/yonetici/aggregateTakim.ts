// lib/rapor/yonetici/aggregateTakim.ts
import { TakimRpcItem } from '@/lib/types/rapor';

export interface TakimSatir {
  sira: number;
  takim_id: string;
  takim_adi: string;
  tm: string;
  puan: number;
  katki_yuzdesi: number;
  video_puani: number;
  cevaplama_puani: number;
  oneri_puani: number;
  extra_puan: number;
  kayiplar: number;
  izlenme_orani: number;
  toplam_utt: number;
  aktif_utt: number;
  hic_izlememis_utt: number;
}

export interface TakimOrtalama {
  puan: number;
  video_puani: number;
  cevaplama_puani: number;
  oneri_puani: number;
  extra_puan: number;
  kayiplar: number;
}

export interface AggregateTakimSonuc {
  takimSiralamasi: TakimSatir[];
  ortalamaTakim: TakimOrtalama;
  toplamPuan: number;
  enYuksekPuan: number;
  toplamUtt: number;
  aktifUtt: number;
  hicIzlemeyenUtt: number;
  toplamIzlenme: number;
  toplamOneri: number;
  bekleyenOneri: number;
  toplamIleriSarmaKaybi: number;
  toplamYanlisCevapKaybi: number;
  toplamYayinSayisi: number;
}

export function aggregateTakim(
  rpcData: TakimRpcItem[],
  tmMap: Record<string, string>
): AggregateTakimSonuc {

  // Single-pass: tüm toplamlar tek döngüde
  let toplamPuan = 0;
  let toplamUtt = 0;
  let aktifUtt = 0;
  let hicIzlemeyenUtt = 0;
  let toplamIzlenme = 0;
  let toplamOneri = 0;
  let bekleyenOneri = 0;
  let toplamIleriSarmaKaybi = 0;
  let toplamYanlisCevapKaybi = 0;
  let toplamYayinSayisi = 0;
  let enYuksekPuan = 0;

  let toplamVideoPuani = 0;
  let toplamCevaplamaPuani = 0;
  let toplamOneriPuani = 0;
  let toplamExtraPuan = 0;
  let toplamKayiplar = 0;

  const satirlar = rpcData.map((t) => {
    const puan =
      (t.kazanilan_izleme_puani ?? 0) +
      (t.kazanilan_cevaplama_puani ?? 0) +
      (t.kazanilan_oneri_puani ?? 0) +
      (t.kazanilan_extra_puani ?? 0);

    // Math.abs — negatif kayıp gelirse düzelt
    const kayiplar =
      Math.abs(t.kaybedilen_ileri_sarma_puani ?? 0) +
      Math.abs(t.kaybedilen_yanlis_cevap_puani ?? 0);

    const takimIzlenmePotansiyeli = (t.video_sayisi ?? 0) * (t.utt_sayisi ?? 0);
    const izlenmeOrani = takimIzlenmePotansiyeli > 0
      ? Math.round(((t.izlenen_video_sayisi ?? 0) / takimIzlenmePotansiyeli) * 100)
      : 0;

    // Toplamlar — single-pass
    toplamPuan += puan;
    toplamUtt += t.utt_sayisi ?? 0;
    aktifUtt += t.aktif_utt ?? 0;
    hicIzlemeyenUtt += t.hic_izlememis_utt ?? 0;
    toplamIzlenme += t.izlenen_video_sayisi ?? 0;
    toplamOneri += t.oneri_sayisi ?? 0;
    bekleyenOneri += t.izlenmeyen_oneri_sayisi ?? 0;
    toplamIleriSarmaKaybi += Math.abs(t.kaybedilen_ileri_sarma_puani ?? 0);
    toplamYanlisCevapKaybi += Math.abs(t.kaybedilen_yanlis_cevap_puani ?? 0);
    toplamYayinSayisi += t.video_sayisi ?? 0;
    toplamVideoPuani += t.kazanilan_izleme_puani ?? 0;
    toplamCevaplamaPuani += t.kazanilan_cevaplama_puani ?? 0;
    toplamOneriPuani += t.kazanilan_oneri_puani ?? 0;
    toplamExtraPuan += t.kazanilan_extra_puani ?? 0;
    toplamKayiplar += kayiplar;

    // enYuksekPuan — reduce yerine single-pass içinde
    if (puan > enYuksekPuan) enYuksekPuan = puan;

    return {
      takim_id: t.takim_id,
      takim_adi: t.takim_adi,
      tm: tmMap[t.takim_id] ?? '-',
      puan,
      katki_yuzdesi: 0, // toplamPuan belli olunca aşağıda hesaplanır
      video_puani: t.kazanilan_izleme_puani ?? 0,
      cevaplama_puani: t.kazanilan_cevaplama_puani ?? 0,
      oneri_puani: t.kazanilan_oneri_puani ?? 0,
      extra_puan: t.kazanilan_extra_puani ?? 0,
      kayiplar,
      izlenme_orani: izlenmeOrani,
      toplam_utt: t.utt_sayisi ?? 0,
      aktif_utt: t.aktif_utt ?? 0,
      hic_izlememis_utt: t.hic_izlememis_utt ?? 0,
    };
  });

  const sirali = satirlar.sort((a, b) => b.puan - a.puan);
  const takimSayisi = sirali.length;

  const takimSiralamasi: TakimSatir[] = sirali.map((t, idx) => ({
    ...t,
    sira: idx + 1,
    katki_yuzdesi: toplamPuan > 0
      ? parseFloat((t.puan / toplamPuan * 100).toFixed(1))
      : 0,
  }));

  const ortalamaTakim: TakimOrtalama = {
    puan: takimSayisi > 0 ? Math.round(toplamPuan / takimSayisi) : 0,
    video_puani: takimSayisi > 0 ? Math.round(toplamVideoPuani / takimSayisi) : 0,
    cevaplama_puani: takimSayisi > 0 ? Math.round(toplamCevaplamaPuani / takimSayisi) : 0,
    oneri_puani: takimSayisi > 0 ? Math.round(toplamOneriPuani / takimSayisi) : 0,
    extra_puan: takimSayisi > 0 ? Math.round(toplamExtraPuan / takimSayisi) : 0,
    kayiplar: takimSayisi > 0 ? Math.round(toplamKayiplar / takimSayisi) : 0,
  };

  return {
    takimSiralamasi,
    ortalamaTakim,
    toplamPuan,
    enYuksekPuan,
    toplamUtt,
    aktifUtt,
    hicIzlemeyenUtt,
    toplamIzlenme,
    toplamOneri,
    bekleyenOneri,
    toplamIleriSarmaKaybi,
    toplamYanlisCevapKaybi,
    toplamYayinSayisi,
  };
}