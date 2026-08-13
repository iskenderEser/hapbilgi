import type { SupabaseClient } from '@supabase/supabase-js';
import type { NextResponse } from 'next/server';
import { hataYaniti } from '@/lib/utils/hataIsle';

interface Kullanici {
  kullanici_id: string;
  bolge_id: string;
  takim_id: string;
  firma_id: string;
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

export interface KullaniciOzetSatiri {
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

interface DagilimSatiri extends KullaniciOzetSatiri {
  teknik_dagilimi: Array<{ teknik_adi: string; izlenme_sayisi: number }>;
}

export interface KullaniciUrunDagilimi extends DagilimSatiri {
  urun_id: string;
  urun_adi: string;
}

export interface KullaniciKategoriDagilimi extends DagilimSatiri {
  icerik_turu: string;
}

export interface BmEtkilesim {
  yayin_id: string;
  icerik_adi: string;
  teknik_adi: string;
  begeni_sayisi: number;
  favori_sayisi: number;
}

interface BmData {
  hata: NextResponse | null;
  bolge: { bolge_adi: string } | null;
  takim: { takim_adi: string } | null;
  uttPerformans: BmUttPerformans[];
  bolgeOzet: KullaniciOzetSatiri[];
  kategoriDagilimi: KullaniciKategoriDagilimi[];
  urunDagilimi: KullaniciUrunDagilimi[];
  takimToplamPuan: number;
  sirketToplamPuan: number;
  etkilesim: BmEtkilesim[];
}

const bos: BmData = {
  hata: null,
  bolge: null,
  takim: null,
  uttPerformans: [],
  bolgeOzet: [],
  kategoriDagilimi: [],
  urunDagilimi: [],
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
    uttPerformansRes,
    bolgeOzetRes,
    kategoriDagilimiRes,
    urunDagilimiRes,
    takimOzetRes,
    sirketOzetRes,
    etkilesimRes,
  ] = await Promise.all([
    adminSupabase.from('bolgeler').select('bolge_adi').eq('bolge_id', kullanici.bolge_id).maybeSingle(),
    adminSupabase.from('takimlar').select('takim_adi').eq('takim_id', kullanici.takim_id).maybeSingle(),
    adminSupabase.rpc('get_bm_utt_performans_v2', {
      p_bm_id: kullanici.kullanici_id,
      p_baslangic: baslangic,
      p_bitis: bitis,
    }),
    adminSupabase.rpc('get_kullanici_ozet', {
      p_baslangic: baslangic,
      p_bitis: bitis,
      p_bolge_id: kullanici.bolge_id,
    }),
    adminSupabase.rpc('get_kullanici_kategori_dagilimi', {
      p_baslangic: baslangic,
      p_bitis: bitis,
      p_bolge_id: kullanici.bolge_id,
    }),
    adminSupabase.rpc('get_kullanici_urun_dagilimi', {
      p_baslangic: baslangic,
      p_bitis: bitis,
      p_bolge_id: kullanici.bolge_id,
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
  if (uttPerformansRes.error) return { ...bos, hata: hataYaniti('BM UTT performansı çekilemedi', 'get_bm_utt_performans_v2', uttPerformansRes.error) };
  if (bolgeOzetRes.error) return { ...bos, hata: hataYaniti('Bölge özeti çekilemedi', 'get_kullanici_ozet (bölge)', bolgeOzetRes.error) };
  if (kategoriDagilimiRes.error) return { ...bos, hata: hataYaniti('Kategori dağılımı çekilemedi', 'get_kullanici_kategori_dagilimi', kategoriDagilimiRes.error) };
  if (urunDagilimiRes.error) return { ...bos, hata: hataYaniti('Ürün dağılımı çekilemedi', 'get_kullanici_urun_dagilimi', urunDagilimiRes.error) };
  if (takimOzetRes.error) return { ...bos, hata: hataYaniti('Takım puanı çekilemedi', 'get_kullanici_ozet (takım)', takimOzetRes.error) };
  if (sirketOzetRes.error) return { ...bos, hata: hataYaniti('Şirket puanı çekilemedi', 'get_kullanici_ozet (firma)', sirketOzetRes.error) };
  if (etkilesimRes.error) return { ...bos, hata: hataYaniti('BM etkileşimleri çekilemedi', 'get_bm_etkilesim_v2', etkilesimRes.error) };
  const takimToplamPuan = ((takimOzetRes.data ?? []) as KullaniciOzetSatiri[])
    .reduce((toplam, satir) => toplam + Number(satir.toplam_net_puan ?? 0), 0);
  const sirketToplamPuan = ((sirketOzetRes.data ?? []) as KullaniciOzetSatiri[])
    .reduce((toplam, satir) => toplam + Number(satir.toplam_net_puan ?? 0), 0);
  return {
    hata: null,
    bolge: bolgeAdRes.data,
    takim: takimAdRes.data,
    uttPerformans: (uttPerformansRes.data ?? []) as BmUttPerformans[],
    bolgeOzet: (bolgeOzetRes.data ?? []) as KullaniciOzetSatiri[],
    kategoriDagilimi: (kategoriDagilimiRes.data ?? []) as KullaniciKategoriDagilimi[],
    urunDagilimi: (urunDagilimiRes.data ?? []) as KullaniciUrunDagilimi[],
    takimToplamPuan,
    sirketToplamPuan,
    etkilesim: (etkilesimRes.data ?? []) as BmEtkilesim[],
  };
}
