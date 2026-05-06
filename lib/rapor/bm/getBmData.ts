// lib/rapor/bm/getBmData.ts
import { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { hataYaniti } from '@/lib/utils/hataIsle';
import { Bolge, Takim, UrunIzleme, BegeniItem, FavoriItem } from '@/lib/types/rapor';

interface Kullanici {
  kullanici_id: string;
  bolge_id: string;
  takim_id: string;
  firma_id: string;
}

interface BmData {
  hata: NextResponse | null;
  bolge: Bolge | null;
  takim: Takim | null;
  toplamYayin: number;
  takimToplamPuan: number;
  sirketToplamPuan: number;
  bolgeListesi: Array<{ bolge_id: string; bolge_adi: string; toplam_puan: number }>;
  urunIzleme: UrunIzleme[];
  begeniRaw: BegeniItem[];
  favoriRaw: FavoriItem[];
}

const bos: BmData = {
  hata: null,
  bolge: null,
  takim: null,
  toplamYayin: 0,
  takimToplamPuan: 0,
  sirketToplamPuan: 0,
  bolgeListesi: [],
  urunIzleme: [],
  begeniRaw: [],
  favoriRaw: [],
};

export async function getBmData(adminSupabase: SupabaseClient, kullanici: Kullanici): Promise<BmData> {
  const [
    bolgeRes,
    takimRes,
    yayinlarRes,
    takimRaporRes,
    sirketRaporRes,
    bolgeListesiRes,
    urunIzlemeRes,
    begeniRawRes,
    favoriRawRes,
  ] = await Promise.all([
    adminSupabase.from('bolgeler').select('bolge_adi').eq('bolge_id', kullanici.bolge_id).maybeSingle(),
    adminSupabase.from('takimlar').select('takim_adi').eq('takim_id', kullanici.takim_id).maybeSingle(),
    adminSupabase.from('yayin_yonetimi').select('yayin_id').eq('durum', 'yayinda').contains('hedef_roller', ['bm']),
    adminSupabase.from('v_rapor_takim').select('toplam_puan').eq('takim_id', kullanici.takim_id).maybeSingle(),
    adminSupabase.from('v_rapor_sirket').select('toplam_puan').eq('firma_id', kullanici.firma_id).maybeSingle(),
    adminSupabase.from('v_rapor_bolge').select('bolge_id, bolge_adi, toplam_puan').eq('takim_id', kullanici.takim_id).order('toplam_puan', { ascending: false }),
    adminSupabase.from('v_rapor_urun_izlenme').select('urun_adi, teknik_adi, izlenme_sayisi').eq('bolge_id', kullanici.bolge_id),
    adminSupabase.from('v_rapor_begeni_favori').select('yayin_id, urun_adi, teknik_adi, begeni_sayisi').eq('takim_id', kullanici.takim_id).order('begeni_sayisi', { ascending: false }).limit(5),
    adminSupabase.from('v_rapor_begeni_favori').select('yayin_id, urun_adi, teknik_adi, favori_sayisi').eq('takim_id', kullanici.takim_id).order('favori_sayisi', { ascending: false }).limit(5),
  ]);

  if (bolgeRes.error) return { ...bos, hata: hataYaniti('Bölge bilgisi çekilemedi', 'bolgeler', bolgeRes.error) };
  if (takimRes.error) return { ...bos, hata: hataYaniti('Takım bilgisi çekilemedi', 'takimlar', takimRes.error) };
  if (yayinlarRes.error) return { ...bos, hata: hataYaniti('Yayın listesi çekilemedi', 'yayin_yonetimi', yayinlarRes.error) };
  if (takimRaporRes.error) return { ...bos, hata: hataYaniti('Takım raporu çekilemedi', 'v_rapor_takim', takimRaporRes.error) };
  if (sirketRaporRes.error) return { ...bos, hata: hataYaniti('Şirket raporu çekilemedi', 'v_rapor_sirket', sirketRaporRes.error) };
  if (bolgeListesiRes.error) return { ...bos, hata: hataYaniti('Bölge listesi çekilemedi', 'v_rapor_bolge', bolgeListesiRes.error) };
  if (urunIzlemeRes.error) return { ...bos, hata: hataYaniti('Ürün izleme verisi çekilemedi', 'v_rapor_urun_izlenme', urunIzlemeRes.error) };
  if (begeniRawRes.error) return { ...bos, hata: hataYaniti('Beğeni listesi çekilemedi', 'v_rapor_begeni_favori', begeniRawRes.error) };
  if (favoriRawRes.error) return { ...bos, hata: hataYaniti('Favori listesi çekilemedi', 'v_rapor_begeni_favori', favoriRawRes.error) };

  return {
    hata: null,
    bolge: bolgeRes.data,
    takim: takimRes.data,
    toplamYayin: yayinlarRes.data?.length || 0,
    takimToplamPuan: takimRaporRes.data?.toplam_puan || 0,
    sirketToplamPuan: sirketRaporRes.data?.toplam_puan || 0,
    bolgeListesi: bolgeListesiRes.data || [],
    urunIzleme: urunIzlemeRes.data || [],
    begeniRaw: begeniRawRes.data ?? [],
    favoriRaw: favoriRawRes.data ?? [],
  };
}