// lib/rapor/yonetici/aggregatePm.ts
import { PmUretimItem } from '@/lib/types/rapor';

export interface AggregatePmSonuc {
  toplamTalep: number;
  yayindakiTalep: number;
  devamEdenTalep: number;
  durdurulanTalep: number;
  senaryoBekleyen: number;
  videoBekleyen: number;
  soruSetiBekleyen: number;
  senaryoRevizyon: number;
  videoRevizyon: number;
  soruSetiRevizyon: number;
  ortalamaTalepYayinSuresi: number;
}

export function aggregatePm(uretim: PmUretimItem[]): AggregatePmSonuc {
  let toplamTalep = 0;
  let yayindakiTalep = 0;
  let durdurulanTalep = 0;
  let senaryoBekleyen = 0;
  let videoBekleyen = 0;
  let soruSetiBekleyen = 0;
  let senaryoRevizyon = 0;
  let videoRevizyon = 0;
  let soruSetiRevizyon = 0;
  let surelerToplam = 0;
  let sureSayisi = 0;

  for (const p of uretim) {
    toplamTalep += p.toplam_talep ?? 0;
    yayindakiTalep += p.yayindaki_talep ?? 0;
    durdurulanTalep += p.durdurulan_talep ?? 0;
    senaryoBekleyen += p.senaryo_bekleyen ?? 0;
    videoBekleyen += p.video_bekleyen ?? 0;
    soruSetiBekleyen += p.soru_seti_bekleyen ?? 0;
    senaryoRevizyon += p.senaryo_revizyon ?? 0;
    videoRevizyon += p.video_revizyon ?? 0;
    soruSetiRevizyon += p.soru_seti_revizyon ?? 0;

    // 0 = henüz tamamlanmamış / ölçülmemiş — ortalamaya dahil edilmez
    if ((p.ortalama_talep_yayin_suresi ?? 0) > 0) {
      surelerToplam += p.ortalama_talep_yayin_suresi ?? 0;
      sureSayisi++;
    }
  }

  return {
    toplamTalep,
    yayindakiTalep,
    devamEdenTalep: Math.max(0, toplamTalep - yayindakiTalep - durdurulanTalep),
    durdurulanTalep,
    senaryoBekleyen,
    videoBekleyen,
    soruSetiBekleyen,
    senaryoRevizyon,
    videoRevizyon,
    soruSetiRevizyon,
    ortalamaTalepYayinSuresi: sureSayisi > 0 ? Math.round(surelerToplam / sureSayisi) : 0,
  };
}