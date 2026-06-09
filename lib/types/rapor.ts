// lib/types/rapor.ts
import { SupabaseClient } from '@supabase/supabase-js';

export type { SupabaseClient };

export interface Bolge {
  bolge_adi: string;
}

export interface Takim {
  takim_adi: string;
}

export interface UrunIzleme {
  urun_adi: string | null;
  teknik_adi: string | null;
  izlenme_sayisi: number | null;
}

export interface BegeniItem {
  yayin_id: string;
  urun_adi: string;
  teknik_adi: string;
  begeni_sayisi: number;
}

export interface FavoriItem {
  yayin_id: string;
  urun_adi: string;
  teknik_adi: string;
  favori_sayisi: number;
}

export interface UttItem {
  kullanici_id: string;
  ad: string;
  soyad: string;
  toplam_puan: number;
  video_puani: number;
  soru_puani: number;
  oneri_puani: number;
  extra_puan: number;
  ileri_sarma_kaybi: number;
  yanlis_cevap_kaybi: number;
  oneri_kaybi: number; // TODO: henüz backend'den gelmiyor, sabit 0
  tamamlanan_izleme: number;
  alinan_oneri: number;
  tamamlanan_oneri: number;
  bekleyen_oneri: number;
}

export interface UttAgg {
  toplamPuan: number;
  toplamIzlenme: number;
  toplamOneri: number;
  tamamlananOneri: number;
  bekleyenOneri: number;
  video_puani: number;
  soru_puani: number;
  oneri_puani: number;
  extra_puan: number;
  kayiplar: number;
  aktifUtt: number;
  bekleyenOnerisiOlanUtt: number;
  enYuksek: number;
}

export interface BolgeItem {
  bolge_id: string;
  bolge_adi: string;
  toplam_puan: number;
  video_puani: number;
  soru_puani: number;
  oneri_puani: number;
  extra_puan: number;
  ileri_sarma_kaybi: number;
  yanlis_cevap_kaybi: number;
  oneri_kaybi: number; // TODO: henüz backend'den gelmiyor, sabit 0
  toplam_utt: number;
  aktif_utt: number;
  hic_izlememis_utt: number;
  toplam_izleme: number;
  toplam_oneri: number;
  tamamlanan_oneri: number;
  bekleyen_oneri: number;
}

export interface BolgeAgg {
  toplamPuan: number;
  toplamIzlenme: number;
  toplamOneri: number;
  tamamlananOneri: number;
  bekleyenOneri: number;
  video_puani: number;
  soru_puani: number;
  oneri_puani: number;
  extra_puan: number;
  kayiplar: number;
  toplamUtt: number;
  aktifUtt: number;
  hicIzlemeyenUtt: number;
  enYuksek: number;
}

export interface PmUretimRapor {
  toplam_talep: number | null;
  yayindaki_talep: number | null;
  durdurulan_talep: number | null;
  senaryo_bekleyen: number | null;
  video_bekleyen: number | null;
  soru_seti_bekleyen: number | null;
  senaryo_revizyon: number | null;
  video_revizyon: number | null;
  soru_seti_revizyon: number | null;
  ortalama_talep_yayin_suresi: number | null;
}

// ─── UTT ROUTE TİPLERİ ────────────────────────────────────────────────────

export interface UttKazanilanPuan {
  puan_turu: 'izleme' | 'extra' | 'oneri' | 'cevaplama';
  puan: number;
}

export interface UttIleriSarmaKayit {
  kaybedilen_puan: number;
}

export interface UttSoruCevap {
  dogru_mu: boolean;
}

export interface UttIstatistikler {
  izleme_puani: number;
  extra_puan: number;
  oneri_puani: number;
  cevaplama_puani: number;
  toplam_kazanim: number;
  ileri_sarma_kaybi: number;
  yanlis_cevap_kaybi: number;
  toplam_net_puan: number;
  tamamlanan_izleme: number;
  alinan_oneri: number;
  tamamlanan_oneri: number;
  bekleyen_oneri: number;
}

export interface UttLigSatir {
  sira: number;
  ad: string;
  soyad: string;
  puan: number;
  kendisi_mi: boolean;
}

export interface UttLig {
  bolge_sirasi: number | null;
  takim_sirasi: number | null;
  toplam_bolge_utt: number;
  bir_ust_puan_farki: number | null;
  bolge_siralamasi: UttLigSatir[];
}

export interface UttKatki {
  bolge_katki_yuzdesi: number;
  takim_katki_yuzdesi: number;
  bolge_mevcut_puan: number;
  bolge_toplam_puan: number;
  takim_toplam_puan: number;
}

export interface UttBekleme {
  izlenmemis_video_sayisi: number;
  tahmini_kazanilacak_puan: number;
  bekleyen_oneri_sayisi: number;
}

export interface UttOneri {
  oneri_id: string;
  tamamlandi_mi: boolean;
  gonderen: string;
  tarih: string;
  durum: string;
}

export interface UttRaporData {
  kullanici: {
    ad: string;
    soyad: string;
    rol: string;
    bolge_adi: string;
    takim_adi: string;
  };
  katki: UttKatki;
  istatistikler: UttIstatistikler;
  lig: UttLig;
  beklemede: UttBekleme;
  urun_bazli_dagilim: { urun_adi: string; izlenme_sayisi: number }[];
  teknik_bazli_dagilim: { teknik_adi: string; izlenme_sayisi: number }[];
  oneriler: UttOneri[];
  begeni_listesi: (BegeniItem & { benim_begenim: boolean })[];
  favori_listesi: (FavoriItem & { benim_favorim: boolean })[];
}

// ─── YÖNETİCİ ROUTE TİPLERİ ──────────────────────────────────────────────

export interface TakimRpcItem {
  takim_id: string;
  takim_adi: string;
  firma_id: string;
  utt_sayisi: number;
  urun_sayisi: number;
  video_sayisi: number;
  soru_sayisi: number;
  extra_izleme_video_sayisi: number;
  ileri_sarma_izinli_video_sayisi: number;
  pvip: number;
  ptcp: number;
  pevip: number;
  izlenen_video_sayisi: number;
  extra_izleme_sayisi: number;
  onerilen_video_sayisi: number;
  kazanilan_izleme_puani: number;
  kazanilan_cevaplama_puani: number;
  kazanilan_oneri_puani: number;
  kazanilan_extra_puani: number;
  dogru_cevap_sayisi: number;
  yanlis_cevap_sayisi: number;
  ileri_sarilan_video_sayisi: number;
  ileri_sarilan_sure: number;
  kaybedilen_ileri_sarma_puani: number;
  izlenmeyen_oneri_sayisi: number;
  oneri_sayisi: number;
  kaybedilen_yanlis_cevap_puani: number;
  aktif_utt: number;
  hic_izlememis_utt: number;
}

export interface PmUretimItem {
  toplam_talep?: number | null;
  yayindaki_talep?: number | null;
  durdurulan_talep?: number | null;
  senaryo_bekleyen?: number | null;
  video_bekleyen?: number | null;
  soru_seti_bekleyen?: number | null;
  senaryo_revizyon?: number | null;
  video_revizyon?: number | null;
  soru_seti_revizyon?: number | null;
  ortalama_talep_yayin_suresi?: number | null;
}

export interface YoneticiResponse {
  kullanici: {
    ad: string;
    soyad: string;
    rol: string;
    firma_adi: string;
  };
  sirket_ozet: {
    toplam_takim: number;
    toplam_utt: number;
    aktif_utt: number;
    hic_izlemeyen_utt: number;
    toplam_puan: number;
    ortalama_puan_takim: number;
    en_yuksek_puan: number;
    toplam_yayin: number;
  };
  izlenme_ozet: {
    toplam_izlenme: number;
    kalan_izlenme: number;
    izlenme_orani: number;
    potansiyel_toplam: number;
  };
  uretim_hatti: {
    toplam_talep: number;
    yayinda: number;
    devam_eden: number;
    iptal_durdurulan: number;
  };
  bekleyen_asamalar: {
    senaryo_onayi: number;
    video_onayi: number;
    soru_seti_onayi: number;
  };
  revizyon_oranlari: {
    senaryo_revizyon: number;
    senaryo_yuzde: number;
    video_revizyon: number;
    video_yuzde: number;
    soru_seti_revizyon: number;
    soru_seti_yuzde: number;
    ortalama_talep_yayin_suresi: number;
  };
  takim_siralamasi: {
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
  }[];
  ortalama_takim: {
    puan: number;
    video_puani: number;
    cevaplama_puani: number;
    oneri_puani: number;
    extra_puan: number;
    kayiplar: number;
  };
  oneri_etkinligi: {
    gonderilen: number;
    tamamlanan: number;
    tamamlanma_orani: number;
    bekleyen: number;
  };
  kayip_ozeti: {
    ileri_sarma_kaybi: number;
    yanlis_cevap_kaybi: number;
  };
  urun_bazli_dagilim: { urun_adi: string; izlenme_sayisi: number }[];
  teknik_bazli_dagilim: { teknik_adi: string; izlenme_sayisi: number }[];
  begeni_listesi: BegeniItem[];
  favori_listesi: FavoriItem[];
}