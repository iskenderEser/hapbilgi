// lib/rapor/bm/aggregateUtt.ts
import { UttItem, UttAgg } from '@/lib/types/rapor';

export function aggregateUtt(uttListesi: UttItem[]): UttAgg {
  return uttListesi.reduce<UttAgg>(
    (acc, u) => {
      acc.toplamPuan += u.toplam_puan;
      acc.toplamIzlenme += u.tamamlanan_izleme;
      acc.toplamOneri += u.alinan_oneri;
      acc.tamamlananOneri += u.tamamlanan_oneri;
      acc.bekleyenOneri += u.bekleyen_oneri;
      acc.video_puani += u.video_puani;
      acc.soru_puani += u.soru_puani;
      acc.oneri_puani += u.oneri_puani;
      acc.extra_puan += u.extra_puan;
      acc.kayiplar += Math.abs(u.ileri_sarma_kaybi) + Math.abs(u.yanlis_cevap_kaybi) + Math.abs(u.oneri_kaybi);
      if (u.tamamlanan_izleme > 0) acc.aktifUtt++;
      if (u.bekleyen_oneri > 0) acc.bekleyenOnerisiOlanUtt++;
      acc.enYuksek = Math.max(acc.enYuksek, u.toplam_puan);
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
      aktifUtt: 0,
      bekleyenOnerisiOlanUtt: 0,
      enYuksek: 0,
    }
  );
}