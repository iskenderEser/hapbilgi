import { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { hataYaniti } from '@/lib/utils/hataIsle';
import { UreticiYetenek } from '@/lib/uretici/yetenekler';

interface Kullanici {
  kullanici_id: string;
  takim_id: string | null;
  firma_id: string;
}

export interface UreticiSahaOzetSatiri {
  kullanici_id: string;
  izlenme_sayisi: number;
  toplam_net_puan: number;
}

export interface UreticiRaporOzet {
  toplam_talep: number;
  tamamlanan_talep: number;
  yayindaki_video: number;
  durdurulan_video: number;
}

interface EtkilesimSatiri {
  yayin_id: string;
  urun_adi: string | null;
  teknik_adi: string | null;
  begeni_sayisi?: number;
  favori_sayisi?: number;
}

export interface UreticiData {
  hata: NextResponse | null;
  takim: { takim_adi: string } | null;
  firma: { firma_adi: string } | null;
  raporOzet: UreticiRaporOzet;
  sahaOzetleri: UreticiSahaOzetSatiri[];
  begeniRaw: EtkilesimSatiri[];
  favoriRaw: EtkilesimSatiri[];
}

const bos: UreticiData = {
  hata: null,
  takim: null,
  firma: null,
  raporOzet: {
    toplam_talep: 0,
    tamamlanan_talep: 0,
    yayindaki_video: 0,
    durdurulan_video: 0,
  },
  sahaOzetleri: [],
  begeniRaw: [],
  favoriRaw: [],
};

export async function getUreticiData(
  adminSupabase: SupabaseClient,
  kullanici: Kullanici,
  yetenek: UreticiYetenek,
  baslangic: string,
  bitis: string
): Promise<UreticiData> {
  const takimKapsami = yetenek.raporScope === 'takim';

  if (takimKapsami && !kullanici.takim_id) {
    return {
      ...bos,
      hata: hataYaniti(
        'Takım kaydı eksik. Lütfen admin ile iletişime geçin.',
        'takim_id eksik',
        null
      ),
    };
  }

  const sahaParametreleri = takimKapsami
    ? { p_takim_id: kullanici.takim_id }
    : { p_firma_id: kullanici.firma_id };

  const [takimAdRes, firmaAdRes, raporOzetRes, sahaOzetRes, begeniRes, favoriRes] = await Promise.all([
    kullanici.takim_id
      ? adminSupabase
          .from('takimlar')
          .select('takim_adi')
          .eq('takim_id', kullanici.takim_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    adminSupabase
      .from('firmalar')
      .select('firma_adi')
      .eq('firma_id', kullanici.firma_id)
      .maybeSingle(),
    adminSupabase.rpc('get_uretici_rapor_ozet_v3', {
      p_uretici_id: kullanici.kullanici_id,
      p_baslangic: baslangic,
      p_bitis: bitis,
    }),
    adminSupabase.rpc('get_kullanici_ozet', {
      p_baslangic: baslangic,
      p_bitis: bitis,
      ...sahaParametreleri,
    }),
    adminSupabase
      .from('v_rapor_begeni_favori_v3')
      .select('yayin_id, urun_adi, teknik_adi, begeni_sayisi')
      .eq('uretici_id', kullanici.kullanici_id)
      .gt('begeni_sayisi', 0)
      .order('begeni_sayisi', { ascending: false })
      .limit(5),
    adminSupabase
      .from('v_rapor_begeni_favori_v3')
      .select('yayin_id, urun_adi, teknik_adi, favori_sayisi')
      .eq('uretici_id', kullanici.kullanici_id)
      .gt('favori_sayisi', 0)
      .order('favori_sayisi', { ascending: false })
      .limit(5),
  ]);

  if (takimAdRes.error) return { ...bos, hata: hataYaniti('Takım adı çekilemedi', 'takimlar', takimAdRes.error) };
  if (firmaAdRes.error) return { ...bos, hata: hataYaniti('Firma adı çekilemedi', 'firmalar', firmaAdRes.error) };
  if (raporOzetRes.error) return { ...bos, hata: hataYaniti('Üretim özeti çekilemedi', 'get_uretici_rapor_ozet_v3', raporOzetRes.error) };
  if (sahaOzetRes.error) return { ...bos, hata: hataYaniti('Saha özeti çekilemedi', 'get_kullanici_ozet', sahaOzetRes.error) };
  if (begeniRes.error) return { ...bos, hata: hataYaniti('Beğeni listesi çekilemedi', 'v_rapor_begeni_favori_v3', begeniRes.error) };
  if (favoriRes.error) return { ...bos, hata: hataYaniti('Favori listesi çekilemedi', 'v_rapor_begeni_favori_v3', favoriRes.error) };

  const raporOzetSatiri = (raporOzetRes.data as UreticiRaporOzet[] | null)?.[0];

  return {
    hata: null,
    takim: takimAdRes.data,
    firma: firmaAdRes.data,
    raporOzet: {
      toplam_talep: Number(raporOzetSatiri?.toplam_talep ?? 0),
      tamamlanan_talep: Number(raporOzetSatiri?.tamamlanan_talep ?? 0),
      yayindaki_video: Number(raporOzetSatiri?.yayindaki_video ?? 0),
      durdurulan_video: Number(raporOzetSatiri?.durdurulan_video ?? 0),
    },
    sahaOzetleri: (sahaOzetRes.data ?? []) as UreticiSahaOzetSatiri[],
    begeniRaw: (begeniRes.data ?? []) as EtkilesimSatiri[],
    favoriRaw: (favoriRes.data ?? []) as EtkilesimSatiri[],
  };
}
