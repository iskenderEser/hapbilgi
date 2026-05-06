// lib/rapor/tm/getTmData.ts
import { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { hataYaniti } from '@/lib/utils/hataIsle';
import { Takim, UrunIzleme, BegeniItem, FavoriItem } from '@/lib/types/rapor';

interface Kullanici {
  kullanici_id: string;
  takim_id: string;
  firma_id: string;
}

interface Firma {
  firma_adi: string;
}

interface TakimSirasi {
  takim_id: string;
  toplam_puan: number;
}

interface TmData {
  hata: NextResponse | null;
  takim: Takim | null;
  firma: Firma | null;
  toplamYayin: number;
  sirketToplamPuan: number;
  takimSiralamasi: TakimSirasi[];
  urunIzleme: UrunIzleme[];
  begeniRaw: BegeniItem[];
  favoriRaw: FavoriItem[];
}

const bos: TmData = {
  hata: null,
  takim: null,
  firma: null,
  toplamYayin: 0,
  sirketToplamPuan: 0,
  takimSiralamasi: [],
  urunIzleme: [],
  begeniRaw: [],
  favoriRaw: [],
};

export async function getTmData(adminSupabase: SupabaseClient, kullanici: Kullanici): Promise<TmData> {
  const [
    takimRes,
    firmaRes,
    yayinlarRes,
    sirketRaporRes,
    takimSiralamaRes,
    urunIzlemeRes,
    begeniRawRes,
    favoriRawRes,
  ] = await Promise.all([
    adminSupabase.from('takimlar').select('takim_adi').eq('takim_id', kullanici.takim_id).maybeSingle(),
    adminSupabase.from('firmalar').select('firma_adi').eq('firma_id', kullanici.firma_id).maybeSingle(),
    adminSupabase.from('yayin_yonetimi').select('yayin_id').eq('durum', 'yayinda').contains('hedef_roller', ['tm']),
    adminSupabase.from('v_rapor_sirket').select('toplam_puan').eq('firma_id', kullanici.firma_id).maybeSingle(),
    adminSupabase.from('v_rapor_takim').select('takim_id, toplam_puan').eq('firma_id', kullanici.firma_id).order('toplam_puan', { ascending: false }),
    adminSupabase.from('v_rapor_urun_izlenme').select('urun_adi, teknik_adi, izlenme_sayisi').eq('utt_takim_id', kullanici.takim_id),
    adminSupabase.from('v_rapor_begeni_favori').select('yayin_id, urun_adi, teknik_adi, begeni_sayisi').eq('takim_id', kullanici.takim_id).order('begeni_sayisi', { ascending: false }).limit(5),
    adminSupabase.from('v_rapor_begeni_favori').select('yayin_id, urun_adi, teknik_adi, favori_sayisi').eq('takim_id', kullanici.takim_id).order('favori_sayisi', { ascending: false }).limit(5),
  ]);

  if (takimRes.error) return { ...bos, hata: hataYaniti('Takım bilgisi çekilemedi', 'takimlar', takimRes.error) };
  if (firmaRes.error) return { ...bos, hata: hataYaniti('Firma bilgisi çekilemedi', 'firmalar', firmaRes.error) };
  if (yayinlarRes.error) return { ...bos, hata: hataYaniti('Yayın listesi çekilemedi', 'yayin_yonetimi', yayinlarRes.error) };
  if (sirketRaporRes.error) return { ...bos, hata: hataYaniti('Şirket raporu çekilemedi', 'v_rapor_sirket', sirketRaporRes.error) };
  if (takimSiralamaRes.error) return { ...bos, hata: hataYaniti('Takım sıralaması çekilemedi', 'v_rapor_takim', takimSiralamaRes.error) };
  if (urunIzlemeRes.error) return { ...bos, hata: hataYaniti('Ürün izleme verisi çekilemedi', 'v_rapor_urun_izlenme', urunIzlemeRes.error) };
  if (begeniRawRes.error) return { ...bos, hata: hataYaniti('Beğeni listesi çekilemedi', 'v_rapor_begeni_favori', begeniRawRes.error) };
  if (favoriRawRes.error) return { ...bos, hata: hataYaniti('Favori listesi çekilemedi', 'v_rapor_begeni_favori', favoriRawRes.error) };

  return {
    hata: null,
    takim: takimRes.data,
    firma: firmaRes.data,
    toplamYayin: yayinlarRes.data?.length || 0,
    sirketToplamPuan: sirketRaporRes.data?.toplam_puan || 0,
    takimSiralamasi: takimSiralamaRes.data || [],
    urunIzleme: urunIzlemeRes.data || [],
    begeniRaw: begeniRawRes.data ?? [],
    favoriRaw: favoriRawRes.data ?? [],
  };
}