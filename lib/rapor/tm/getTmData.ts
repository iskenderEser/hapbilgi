import type { SupabaseClient } from '@supabase/supabase-js';
import type { NextResponse } from 'next/server';
import type {
  KullaniciKategoriDagilimi,
  KullaniciOzetSatiri,
  KullaniciUrunDagilimi,
} from '@/lib/rapor/bm/getBmData';
import { hataYaniti } from '@/lib/utils/hataIsle';

interface Kullanici {
  kullanici_id: string;
  takim_id: string;
  firma_id: string;
}

export interface TmBmPerformans {
  bm_id: string;
  bm_adi: string;
  bolge_id: string;
  bolge_adi: string;
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
  bm_id: string;
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

export interface TmEtkilesim {
  yayin_id: string;
  icerik_adi: string;
  teknik_adi: string;
  begeni_sayisi: number;
  favori_sayisi: number;
}

export type TmOneriDurumu = 'tamamlanan' | 'bekleyen' | 'suresi_gecmis';

export interface TmOneriKaydi {
  bm_id: string;
  bm_adi: string;
  bolge_id: string;
  bolge_adi: string;
  oneri_id: string;
  kullanici_id: string;
  utt_ad: string;
  utt_soyad: string;
  yayin_id: string;
  urun_adi: string | null;
  teknik_adi: string | null;
  oneri_baslangic: string;
  oneri_bitis: string;
  created_at: string;
  izleme_tarihi: string | null;
  durum: TmOneriDurumu;
}

interface TmData {
  hata: NextResponse | null;
  takim: { takim_adi: string } | null;
  firma: { firma_adi: string } | null;
  bmPerformans: TmBmPerformans[];
  uttPerformans: TmUttPerformans[];
  takimOzet: KullaniciOzetSatiri[];
  kategoriDagilimi: KullaniciKategoriDagilimi[];
  urunDagilimi: KullaniciUrunDagilimi[];
  takimToplamPuan: number;
  sirketToplamPuan: number;
  etkilesim: TmEtkilesim[];
  oneriDurumu: TmOneriKaydi[];
}

const bos: TmData = {
  hata: null,
  takim: null,
  firma: null,
  bmPerformans: [],
  uttPerformans: [],
  takimOzet: [],
  kategoriDagilimi: [],
  urunDagilimi: [],
  takimToplamPuan: 0,
  sirketToplamPuan: 0,
  etkilesim: [],
  oneriDurumu: [],
};

const toplamPuan = (satirlar: KullaniciOzetSatiri[]) => satirlar.reduce(
  (toplam, satir) => toplam + Number(satir.toplam_net_puan ?? 0),
  0
);

export async function getTmData(
  adminSupabase: SupabaseClient,
  kullanici: Kullanici,
  baslangic: string,
  bitis: string
): Promise<TmData> {
  const [
    takimRes,
    firmaRes,
    bmPerformansRes,
    takimOzetRes,
    kategoriDagilimiRes,
    urunDagilimiRes,
    sirketOzetRes,
    etkilesimRes,
    oneriDurumuRes,
  ] = await Promise.all([
    adminSupabase.from('takimlar').select('takim_adi').eq('takim_id', kullanici.takim_id).maybeSingle(),
    adminSupabase.from('firmalar').select('firma_adi').eq('firma_id', kullanici.firma_id).maybeSingle(),
    adminSupabase.rpc('get_tm_bm_performans_v1', {
      p_tm_id: kullanici.kullanici_id,
      p_baslangic: baslangic,
      p_bitis: bitis,
    }),
    adminSupabase.rpc('get_kullanici_ozet', {
      p_baslangic: baslangic,
      p_bitis: bitis,
      p_takim_id: kullanici.takim_id,
    }),
    adminSupabase.rpc('get_kullanici_kategori_dagilimi', {
      p_baslangic: baslangic,
      p_bitis: bitis,
      p_takim_id: kullanici.takim_id,
    }),
    adminSupabase.rpc('get_kullanici_urun_dagilimi', {
      p_baslangic: baslangic,
      p_bitis: bitis,
      p_takim_id: kullanici.takim_id,
    }),
    adminSupabase.rpc('get_kullanici_ozet', {
      p_baslangic: baslangic,
      p_bitis: bitis,
      p_firma_id: kullanici.firma_id,
    }),
    adminSupabase.rpc('get_tm_etkilesim_v2', {
      p_tm_id: kullanici.kullanici_id,
      p_baslangic: baslangic,
      p_bitis: bitis,
    }),
    adminSupabase.rpc('get_tm_oneri_durumu_v1', {
      p_tm_id: kullanici.kullanici_id,
      p_baslangic: baslangic,
      p_bitis: bitis,
    }),
  ]);

  if (takimRes.error) return { ...bos, hata: hataYaniti('Takım adı çekilemedi', 'takimlar', takimRes.error) };
  if (firmaRes.error) return { ...bos, hata: hataYaniti('Firma adı çekilemedi', 'firmalar', firmaRes.error) };
  if (bmPerformansRes.error) return { ...bos, hata: hataYaniti('TM BM performansı çekilemedi', 'get_tm_bm_performans_v1', bmPerformansRes.error) };
  if (takimOzetRes.error) return { ...bos, hata: hataYaniti('Takım özeti çekilemedi', 'get_kullanici_ozet (takım)', takimOzetRes.error) };
  if (kategoriDagilimiRes.error) return { ...bos, hata: hataYaniti('Takım kategori dağılımı çekilemedi', 'get_kullanici_kategori_dagilimi', kategoriDagilimiRes.error) };
  if (urunDagilimiRes.error) return { ...bos, hata: hataYaniti('Takım ürün dağılımı çekilemedi', 'get_kullanici_urun_dagilimi', urunDagilimiRes.error) };
  if (sirketOzetRes.error) return { ...bos, hata: hataYaniti('Şirket puanı çekilemedi', 'get_kullanici_ozet (firma)', sirketOzetRes.error) };
  if (etkilesimRes.error) return { ...bos, hata: hataYaniti('TM etkileşimleri çekilemedi', 'get_tm_etkilesim_v2', etkilesimRes.error) };
  if (oneriDurumuRes.error) return { ...bos, hata: hataYaniti('TM öneri durumu çekilemedi', 'get_tm_oneri_durumu_v1', oneriDurumuRes.error) };

  const bmPerformans = (bmPerformansRes.data ?? []) as TmBmPerformans[];
  const uttPerformansSonuclari = await Promise.all(
    bmPerformans.map(async bm => ({
      bm,
      sonuc: await adminSupabase.rpc('get_bm_utt_performans_v2', {
        p_bm_id: bm.bm_id,
        p_baslangic: baslangic,
        p_bitis: bitis,
      }),
    }))
  );
  for (const { bm, sonuc } of uttPerformansSonuclari) {
    if (sonuc.error) {
      return {
        ...bos,
        hata: hataYaniti(
          `TM BM altındaki UTT performansı çekilemedi: ${bm.bm_adi}`,
          'get_bm_utt_performans_v2',
          sonuc.error
        ),
      };
    }
  }
  const uttPerformans = uttPerformansSonuclari.flatMap(({ bm, sonuc }) =>
    ((sonuc.data ?? []) as Omit<TmUttPerformans, 'bm_id'>[]).map(utt => ({
      ...utt,
      bm_id: bm.bm_id,
    }))
  );
  const takimOzet = (takimOzetRes.data ?? []) as KullaniciOzetSatiri[];
  const oneriDurumu = (oneriDurumuRes.data ?? []) as TmOneriKaydi[];

  return {
    hata: null,
    takim: takimRes.data,
    firma: firmaRes.data,
    bmPerformans,
    uttPerformans,
    takimOzet,
    kategoriDagilimi: (kategoriDagilimiRes.data ?? []) as KullaniciKategoriDagilimi[],
    urunDagilimi: (urunDagilimiRes.data ?? []) as KullaniciUrunDagilimi[],
    takimToplamPuan: toplamPuan(takimOzet),
    sirketToplamPuan: toplamPuan((sirketOzetRes.data ?? []) as KullaniciOzetSatiri[]),
    etkilesim: (etkilesimRes.data ?? []) as TmEtkilesim[],
    oneriDurumu,
  };
}
