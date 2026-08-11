import type { SupabaseClient } from '@supabase/supabase-js';
import type { NextResponse } from 'next/server';
import { hataYaniti } from '@/lib/utils/hataIsle';

interface Kullanici {
  kullanici_id: string;
  bolge_id: string;
  takim_id: string;
  firma_id: string;
}

export interface BmAnaOzet {
  toplam_yayin: number;
  toplam_utt: number;
  guncel_tur_toplam_firsat: number;
  guncel_tur_tamamlanan: number;
  guncel_tur_kalan: number;
  guncel_tur_izlenme_orani: number;
  donem_tamamlanan_izleme: number;
  donem_benzersiz_utt_yayin: number;
  donem_aktif_utt: number;
}

export interface BmUttPerformans {
  kullanici_id: string;
  ad: string;
  soyad: string;
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

export interface UrunUttSatiri {
  kullanici_id: string;
  ad: string;
  soyad: string;
  izlenme_sayisi: number;
  video_puani: number;
  soru_puani: number;
  oneri_puani: number;
  extra_puan: number;
  ileri_sarma_kaybi: number;
  yanlis_cevap_kaybi: number;
  oneri_kaybi: number;
  toplam_net_puan: number;
}

export interface UrunBazliGrup {
  urun_id: string;
  urun_adi: string;
  toplam_izlenme: number;
  toplam_net_puan: number;
  utt_listesi: UrunUttSatiri[];
  ortalama: Record<string, number>;
  teknik_dagilimi: Array<{ teknik_adi: string; izlenme_sayisi: number }>;
}

export interface BmEtkilesim {
  yayin_id: string;
  icerik_adi: string;
  teknik_adi: string;
  begeni_sayisi: number;
  favori_sayisi: number;
}

interface OzetSatiri {
  toplam_net_puan: number | null;
}

interface BmData {
  hata: NextResponse | null;
  bolge: { bolge_adi: string } | null;
  takim: { takim_adi: string } | null;
  anaOzet: BmAnaOzet;
  uttPerformans: BmUttPerformans[];
  urunDagilimi: UrunBazliGrup[];
  oneriOzet: {
    gonderilen_oneri: number;
    tamamlanan_oneri: number;
    bekleyen_oneri: number;
    bekleyen_oneri_olan_utt_sayisi: number;
  };
  takimToplamPuan: number;
  sirketToplamPuan: number;
  etkilesim: BmEtkilesim[];
}

const bosAnaOzet: BmAnaOzet = {
  toplam_yayin: 0,
  toplam_utt: 0,
  guncel_tur_toplam_firsat: 0,
  guncel_tur_tamamlanan: 0,
  guncel_tur_kalan: 0,
  guncel_tur_izlenme_orani: 0,
  donem_tamamlanan_izleme: 0,
  donem_benzersiz_utt_yayin: 0,
  donem_aktif_utt: 0,
};

const bos: BmData = {
  hata: null,
  bolge: null,
  takim: null,
  anaOzet: bosAnaOzet,
  uttPerformans: [],
  urunDagilimi: [],
  oneriOzet: {
    gonderilen_oneri: 0,
    tamamlanan_oneri: 0,
    bekleyen_oneri: 0,
    bekleyen_oneri_olan_utt_sayisi: 0,
  },
  takimToplamPuan: 0,
  sirketToplamPuan: 0,
  etkilesim: [],
};

export async function getBmData(
  adminSupabase: SupabaseClient,
  kullanici: Kullanici,
  baslangic: string,
  bitis: string
): Promise<BmData> {
  const [
    bolgeAdRes,
    takimAdRes,
    anaOzetRes,
    uttPerformansRes,
    urunDagilimiRes,
    oneriOzetRes,
    takimOzetRes,
    sirketOzetRes,
    etkilesimRes,
  ] = await Promise.all([
    adminSupabase.from('bolgeler').select('bolge_adi').eq('bolge_id', kullanici.bolge_id).maybeSingle(),
    adminSupabase.from('takimlar').select('takim_adi').eq('takim_id', kullanici.takim_id).maybeSingle(),
    adminSupabase.rpc('get_bm_rapor_ana_ozet_v2', {
      p_bm_id: kullanici.kullanici_id,
      p_baslangic: baslangic,
      p_bitis: bitis,
    }),
    adminSupabase.rpc('get_bm_utt_performans_v2', {
      p_bm_id: kullanici.kullanici_id,
      p_baslangic: baslangic,
      p_bitis: bitis,
    }),
    adminSupabase.rpc('get_urun_bazli_grup', {
      p_baslangic: baslangic,
      p_bitis: bitis,
      p_bolge_id: kullanici.bolge_id,
    }),
    // Bu eski RPC yalnız doğrulanmış öneri metrikleri için tutulur.
    adminSupabase.rpc('get_scope_ozet', {
      p_baslangic: baslangic,
      p_bitis: bitis,
      p_bolge_id: kullanici.bolge_id,
      p_oneren_id: kullanici.kullanici_id,
    }),
    adminSupabase.rpc('get_kullanici_ozet', {
      p_baslangic: baslangic,
      p_bitis: bitis,
      p_takim_id: kullanici.takim_id,
    }),
    adminSupabase.rpc('get_kullanici_ozet', {
      p_baslangic: baslangic,
      p_bitis: bitis,
      p_firma_id: kullanici.firma_id,
    }),
    adminSupabase.rpc('get_bm_etkilesim_v2', {
      p_bm_id: kullanici.kullanici_id,
      p_baslangic: baslangic,
      p_bitis: bitis,
    }),
  ]);

  if (bolgeAdRes.error) return { ...bos, hata: hataYaniti('Bölge adı çekilemedi', 'bolgeler', bolgeAdRes.error) };
  if (takimAdRes.error) return { ...bos, hata: hataYaniti('Takım adı çekilemedi', 'takimlar', takimAdRes.error) };
  if (anaOzetRes.error) return { ...bos, hata: hataYaniti('BM ana özeti çekilemedi', 'get_bm_rapor_ana_ozet_v2', anaOzetRes.error) };
  if (uttPerformansRes.error) return { ...bos, hata: hataYaniti('BM UTT performansı çekilemedi', 'get_bm_utt_performans_v2', uttPerformansRes.error) };
  if (urunDagilimiRes.error) return { ...bos, hata: hataYaniti('Ürün dağılımı çekilemedi', 'get_urun_bazli_grup', urunDagilimiRes.error) };
  if (oneriOzetRes.error) return { ...bos, hata: hataYaniti('Öneri özeti çekilemedi', 'get_scope_ozet', oneriOzetRes.error) };
  if (takimOzetRes.error) return { ...bos, hata: hataYaniti('Takım puanı çekilemedi', 'get_kullanici_ozet (takım)', takimOzetRes.error) };
  if (sirketOzetRes.error) return { ...bos, hata: hataYaniti('Şirket puanı çekilemedi', 'get_kullanici_ozet (firma)', sirketOzetRes.error) };
  if (etkilesimRes.error) return { ...bos, hata: hataYaniti('BM etkileşimleri çekilemedi', 'get_bm_etkilesim_v2', etkilesimRes.error) };

  const takimToplamPuan = ((takimOzetRes.data ?? []) as OzetSatiri[])
    .reduce((toplam, satir) => toplam + Number(satir.toplam_net_puan ?? 0), 0);
  const sirketToplamPuan = ((sirketOzetRes.data ?? []) as OzetSatiri[])
    .reduce((toplam, satir) => toplam + Number(satir.toplam_net_puan ?? 0), 0);
  const oneri = (oneriOzetRes.data?.[0] ?? {}) as Partial<BmData['oneriOzet']>;

  return {
    hata: null,
    bolge: bolgeAdRes.data,
    takim: takimAdRes.data,
    anaOzet: (anaOzetRes.data?.[0] ?? bosAnaOzet) as BmAnaOzet,
    uttPerformans: (uttPerformansRes.data ?? []) as BmUttPerformans[],
    urunDagilimi: (urunDagilimiRes.data ?? []) as UrunBazliGrup[],
    oneriOzet: {
      gonderilen_oneri: Number(oneri.gonderilen_oneri ?? 0),
      tamamlanan_oneri: Number(oneri.tamamlanan_oneri ?? 0),
      bekleyen_oneri: Number(oneri.bekleyen_oneri ?? 0),
      bekleyen_oneri_olan_utt_sayisi: Number(oneri.bekleyen_oneri_olan_utt_sayisi ?? 0),
    },
    takimToplamPuan,
    sirketToplamPuan,
    etkilesim: (etkilesimRes.data ?? []) as BmEtkilesim[],
  };
}
