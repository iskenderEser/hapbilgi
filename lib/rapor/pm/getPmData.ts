// lib/rapor/pm/getPmData.ts
import { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { hataYaniti } from '@/lib/utils/hataIsle';
import { Takim, UrunIzleme, BegeniItem, FavoriItem, PmUretimRapor } from '@/lib/types/rapor';

interface Kullanici {
  kullanici_id: string;
  takim_id: string;
  firma_id: string;
}

interface PmData {
  hata: NextResponse | null;
  takim: Takim | null;
  uretimRapor: PmUretimRapor | null;
  toplamYayin: number;
  urunIzleme: UrunIzleme[];
  begeniRaw: BegeniItem[];
  favoriRaw: FavoriItem[];
}

const bos: PmData = {
  hata: null,
  takim: null,
  uretimRapor: null,
  toplamYayin: 0,
  urunIzleme: [],
  begeniRaw: [],
  favoriRaw: [],
};

export async function getPmData(adminSupabase: SupabaseClient, kullanici: Kullanici): Promise<PmData> {
  const [
    takimRes,
    uretimRaporRes,
    yayinlarRes,
    urunIzlemeRes,
    begeniRawRes,
    favoriRawRes,
  ] = await Promise.all([
    adminSupabase.from('takimlar').select('takim_adi').eq('takim_id', kullanici.takim_id).maybeSingle(),
    adminSupabase.from('v_rapor_pm_uretim').select('toplam_talep, yayindaki_talep, durdurulan_talep, senaryo_bekleyen, video_bekleyen, soru_seti_bekleyen, senaryo_revizyon, video_revizyon, soru_seti_revizyon, ortalama_talep_yayin_suresi').eq('pm_id', kullanici.kullanici_id).maybeSingle(),
    adminSupabase.from('yayin_yonetimi').select('yayin_id').eq('durum', 'yayinda').contains('hedef_roller', ['utt']),
    adminSupabase.from('v_rapor_urun_izlenme').select('urun_adi, teknik_adi, izlenme_sayisi').eq('utt_takim_id', kullanici.takim_id),
    adminSupabase.from('v_rapor_begeni_favori').select('yayin_id, urun_adi, teknik_adi, begeni_sayisi').eq('takim_id', kullanici.takim_id).order('begeni_sayisi', { ascending: false }).limit(5),
    adminSupabase.from('v_rapor_begeni_favori').select('yayin_id, urun_adi, teknik_adi, favori_sayisi').eq('takim_id', kullanici.takim_id).order('favori_sayisi', { ascending: false }).limit(5),
  ]);

  if (takimRes.error) return { ...bos, hata: hataYaniti('Takım bilgisi çekilemedi', 'takimlar', takimRes.error) };
  if (uretimRaporRes.error) return { ...bos, hata: hataYaniti('Üretim raporu çekilemedi', 'v_rapor_pm_uretim', uretimRaporRes.error) };
  if (yayinlarRes.error) return { ...bos, hata: hataYaniti('Yayın listesi çekilemedi', 'yayin_yonetimi', yayinlarRes.error) };
  if (urunIzlemeRes.error) return { ...bos, hata: hataYaniti('Ürün izleme verisi çekilemedi', 'v_rapor_urun_izlenme', urunIzlemeRes.error) };
  if (begeniRawRes.error) return { ...bos, hata: hataYaniti('Beğeni listesi çekilemedi', 'v_rapor_begeni_favori', begeniRawRes.error) };
  if (favoriRawRes.error) return { ...bos, hata: hataYaniti('Favori listesi çekilemedi', 'v_rapor_begeni_favori', favoriRawRes.error) };

  return {
    hata: null,
    takim: takimRes.data,
    uretimRapor: uretimRaporRes.data,
    toplamYayin: yayinlarRes.data?.length || 0,
    urunIzleme: urunIzlemeRes.data || [],
    begeniRaw: begeniRawRes.data ?? [],
    favoriRaw: favoriRawRes.data ?? [],
  };
}