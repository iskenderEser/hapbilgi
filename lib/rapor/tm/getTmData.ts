import type { SupabaseClient } from '@supabase/supabase-js';
import type { NextResponse } from 'next/server';
import { hataYaniti } from '@/lib/utils/hataIsle';

interface Kullanici {
  kullanici_id: string;
  takim_id: string;
  firma_id: string;
}

export interface TmAnaOzet {
  toplam_yayin: number;
  toplam_bolge: number;
  toplam_utt: number;
  guncel_tur_toplam_firsat: number;
  guncel_tur_tamamlanan: number;
  guncel_tur_kalan: number;
  guncel_tur_izlenme_orani: number;
  donem_tamamlanan_izleme: number;
  donem_benzersiz_utt_yayin: number;
  donem_aktif_utt: number;
}

export interface TmBolgePerformans {
  bolge_id: string;
  bolge_adi: string;
  bm_adi: string;
  toplam_utt: number;
  aktif_utt: number;
  tamamlanan_izleme: number;
  benzersiz_yayin: number;
  izleme_puani: number;
  cevaplama_puani: number;
  oneri_puani: number;
  extra_puan: number;
  ileri_sarma_kaybi: number;
  yanlis_cevap_kaybi: number;
  oneri_kaybi: number;
  kazanilan_toplam: number;
  kaybedilen_toplam: number;
  net_puan: number;
}

export interface TmUttPerformans {
  kullanici_id: string;
  ad: string;
  soyad: string;
  bolge_id: string;
  bolge_adi: string;
  tamamlanan_izleme: number;
  benzersiz_yayin: number;
  izleme_puani: number;
  cevaplama_puani: number;
  oneri_puani: number;
  extra_puan: number;
  ileri_sarma_kaybi: number;
  yanlis_cevap_kaybi: number;
  oneri_kaybi: number;
  kazanilan_toplam: number;
  kaybedilen_toplam: number;
  net_puan: number;
}

export interface UrunBolgeSatiri {
  bolge_id: string;
  bolge_adi: string;
  toplam_utt: number;
  video_puani: number;
  soru_puani: number;
  oneri_puani: number;
  extra_puan: number;
  ileri_sarma_kaybi: number;
  yanlis_cevap_kaybi: number;
  oneri_kaybi: number;
  toplam_net_puan: number;
}

export interface UrunBazliBolge {
  urun_id: string;
  urun_adi: string;
  toplam_net_puan: number;
  bolge_listesi: UrunBolgeSatiri[];
  ortalama: Record<string, number>;
}

export interface TmEtkilesim {
  yayin_id: string;
  icerik_adi: string;
  teknik_adi: string;
  begeni_sayisi: number;
  favori_sayisi: number;
}

interface OzetSatiri { toplam_net_puan: number | null }

interface TmData {
  hata: NextResponse | null;
  takim: { takim_adi: string } | null;
  firma: { firma_adi: string } | null;
  anaOzet: TmAnaOzet;
  bolgePerformans: TmBolgePerformans[];
  uttPerformans: TmUttPerformans[];
  urunBazliBolge: UrunBazliBolge[];
  oneriOzet: {
    gonderilen_oneri: number;
    tamamlanan_oneri: number;
    bekleyen_oneri: number;
    bekleyen_oneri_olan_utt_sayisi: number;
  };
  sirketToplamPuan: number;
  etkilesim: TmEtkilesim[];
}

const bosAnaOzet: TmAnaOzet = {
  toplam_yayin: 0, toplam_bolge: 0, toplam_utt: 0,
  guncel_tur_toplam_firsat: 0, guncel_tur_tamamlanan: 0,
  guncel_tur_kalan: 0, guncel_tur_izlenme_orani: 0,
  donem_tamamlanan_izleme: 0, donem_benzersiz_utt_yayin: 0,
  donem_aktif_utt: 0,
};

const bos: TmData = {
  hata: null, takim: null, firma: null, anaOzet: bosAnaOzet,
  bolgePerformans: [], uttPerformans: [], urunBazliBolge: [],
  oneriOzet: { gonderilen_oneri: 0, tamamlanan_oneri: 0, bekleyen_oneri: 0, bekleyen_oneri_olan_utt_sayisi: 0 },
  sirketToplamPuan: 0, etkilesim: [],
};

export async function getTmData(
  adminSupabase: SupabaseClient,
  kullanici: Kullanici,
  baslangic: string,
  bitis: string
): Promise<TmData> {
  const [takimRes, firmaRes, anaRes, bolgeRes, uttRes, urunRes, oneriRes, sirketRes, etkilesimRes] = await Promise.all([
    adminSupabase.from('takimlar').select('takim_adi').eq('takim_id', kullanici.takim_id).maybeSingle(),
    adminSupabase.from('firmalar').select('firma_adi').eq('firma_id', kullanici.firma_id).maybeSingle(),
    adminSupabase.rpc('get_tm_rapor_ana_ozet_v2', { p_tm_id: kullanici.kullanici_id, p_baslangic: baslangic, p_bitis: bitis }),
    adminSupabase.rpc('get_tm_bolge_performans_v2', { p_tm_id: kullanici.kullanici_id, p_baslangic: baslangic, p_bitis: bitis }),
    adminSupabase.rpc('get_tm_utt_performans_v2', { p_tm_id: kullanici.kullanici_id, p_baslangic: baslangic, p_bitis: bitis }),
    adminSupabase.rpc('get_urun_bazli_bolge_grup', { p_baslangic: baslangic, p_bitis: bitis, p_takim_id: kullanici.takim_id }),
    // Eski RPC yalnız doğrulanmış öneri alanları için tutulur.
    adminSupabase.rpc('get_scope_ozet', { p_baslangic: baslangic, p_bitis: bitis, p_takim_id: kullanici.takim_id, p_oneren_id: null }),
    adminSupabase.rpc('get_kullanici_ozet', { p_baslangic: baslangic, p_bitis: bitis, p_firma_id: kullanici.firma_id }),
    adminSupabase.rpc('get_tm_etkilesim_v2', { p_tm_id: kullanici.kullanici_id, p_baslangic: baslangic, p_bitis: bitis }),
  ]);

  if (takimRes.error) return { ...bos, hata: hataYaniti('Takım adı çekilemedi', 'takimlar', takimRes.error) };
  if (firmaRes.error) return { ...bos, hata: hataYaniti('Firma adı çekilemedi', 'firmalar', firmaRes.error) };
  if (anaRes.error) return { ...bos, hata: hataYaniti('TM ana özeti çekilemedi', 'get_tm_rapor_ana_ozet_v2', anaRes.error) };
  if (bolgeRes.error) return { ...bos, hata: hataYaniti('TM bölge performansı çekilemedi', 'get_tm_bolge_performans_v2', bolgeRes.error) };
  if (uttRes.error) return { ...bos, hata: hataYaniti('TM UTT performansı çekilemedi', 'get_tm_utt_performans_v2', uttRes.error) };
  if (urunRes.error) return { ...bos, hata: hataYaniti('Ürün bazlı bölge dağılımı çekilemedi', 'get_urun_bazli_bolge_grup', urunRes.error) };
  if (oneriRes.error) return { ...bos, hata: hataYaniti('Öneri özeti çekilemedi', 'get_scope_ozet', oneriRes.error) };
  if (sirketRes.error) return { ...bos, hata: hataYaniti('Şirket puanı çekilemedi', 'get_kullanici_ozet (firma)', sirketRes.error) };
  if (etkilesimRes.error) return { ...bos, hata: hataYaniti('TM etkileşimleri çekilemedi', 'get_tm_etkilesim_v2', etkilesimRes.error) };

  const oneri = (oneriRes.data?.[0] ?? {}) as Partial<TmData['oneriOzet']>;
  return {
    hata: null,
    takim: takimRes.data,
    firma: firmaRes.data,
    anaOzet: (anaRes.data?.[0] ?? bosAnaOzet) as TmAnaOzet,
    bolgePerformans: (bolgeRes.data ?? []) as TmBolgePerformans[],
    uttPerformans: (uttRes.data ?? []) as TmUttPerformans[],
    urunBazliBolge: (urunRes.data ?? []) as UrunBazliBolge[],
    oneriOzet: {
      gonderilen_oneri: Number(oneri.gonderilen_oneri ?? 0),
      tamamlanan_oneri: Number(oneri.tamamlanan_oneri ?? 0),
      bekleyen_oneri: Number(oneri.bekleyen_oneri ?? 0),
      bekleyen_oneri_olan_utt_sayisi: Number(oneri.bekleyen_oneri_olan_utt_sayisi ?? 0),
    },
    sirketToplamPuan: ((sirketRes.data ?? []) as OzetSatiri[]).reduce((toplam, satir) => toplam + Number(satir.toplam_net_puan ?? 0), 0),
    etkilesim: (etkilesimRes.data ?? []) as TmEtkilesim[],
  };
}
