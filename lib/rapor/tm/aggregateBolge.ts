// lib/rapor/tm/aggregateBolge.ts
import { BolgeItem, BolgeAgg } from '@/lib/types/rapor';

export function aggregateBolge(bolgeListesi: BolgeItem[]): BolgeAgg {
  return bolgeListesi.reduce<BolgeAgg>(
    (acc, b) => {
      acc.toplamPuan += b.toplam_puan;
      acc.toplamIzlenme += b.toplam_izleme;
      acc.toplamOneri += b.toplam_oneri;
      acc.tamamlananOneri += b.tamamlanan_oneri;
      acc.bekleyenOneri += b.bekleyen_oneri;
      acc.video_puani += b.video_puani;
      acc.soru_puani += b.soru_puani;
      acc.oneri_puani += b.oneri_puani;
      acc.extra_puan += b.extra_puan;
      acc.kayiplar += Math.abs(b.ileri_sarma_kaybi) + Math.abs(b.yanlis_cevap_kaybi) + Math.abs(b.oneri_kaybi);
      acc.toplamUtt += b.toplam_utt;
      acc.aktifUtt += b.aktif_utt;
      acc.hicIzlemeyenUtt += b.hic_izlememis_utt;
      acc.enYuksek = Math.max(acc.enYuksek, b.toplam_puan);
      return acc;
    },
    {
      toplamPuan: 0,
      toplamIzlenme: 0,
      toplamOneri: 0,
      tamamlananOneri: 0,
      bekleyenOneri: 0,
      video_puani: 0,
      soru_puani: 0,
      oneri_puani: 0,
      extra_puan: 0,
      kayiplar: 0,
      toplamUtt: 0,
      aktifUtt: 0,
      hicIzlemeyenUtt: 0,
      enYuksek: 0,
    }
  );
}