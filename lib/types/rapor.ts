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
