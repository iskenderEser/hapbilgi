// lib/rapor/uretici/getUreticiData.ts
import { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { hataYaniti } from '@/lib/utils/hataIsle';
import { UreticiYetenek } from '@/lib/uretici/yetenekler';

interface Kullanici {
  kullanici_id: string;
  takim_id: string | null;
  firma_id: string;
}

interface OzetSatir {
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

interface BolgeBazliSatir {
  bolge_id: string;
  bolge_adi: string;
  takim_id: string;
  takim_adi: string;
  bm_adi: string;
  toplam_utt: number;
  aktif_utt: number;
  hic_izlemeyen_utt: number;
  video_puani: number;
  soru_puani: number;
  oneri_puani: number;
  extra_puan: number;
  ileri_sarma_kaybi: number;
  yanlis_cevap_kaybi: number;
  oneri_kaybi: number;
  toplam_net_puan: number;
  urun_dagilimi: any;
}

interface UrunBazliBolgeSatir {
  urun_id: string;
  urun_adi: string;
  toplam_net_puan: number;
  bolge_listesi: any;
  ortalama: any;
}

interface UretimOzet {
  toplam_talep: number;
  yayindaki_talep: number;
  durdurulan_talep: number;
  devam_eden_talep: number;
  senaryo_bekleyen: number;
  video_bekleyen: number;
  soru_seti_bekleyen: number;
  senaryo_revizyon: number;
  video_revizyon: number;
  soru_seti_revizyon: number;
  ortalama_talep_yayin_suresi: number;
}

interface TakimSiraSatir {
  takim_id: string;
  takim_adi: string;
  toplam_puan: number;
}

export interface UreticiData {
  hata: NextResponse | null;
  takim: { takim_adi: string } | null;
  firma: { firma_adi: string } | null;
  uretimOzet: UretimOzet;
  uttOzetler: OzetSatir[];
  bolgeBazli: BolgeBazliSatir[];
  urunBazliBolge: UrunBazliBolgeSatir[];
  scopeOzet: {
    toplam_yayin: number;
    gonderilen_oneri: number;
    tamamlanan_oneri: number;
    bekleyen_oneri: number;
    bekleyen_oneri_olan_utt_sayisi: number;
  };
  toplamUttSayisi: number;
  sirketToplamPuan: number;
  takimSirasi: TakimSiraSatir[];
  begeniRaw: Array<{ yayin_id: string; urun_adi: string; teknik_adi: string; begeni_sayisi: number }>;
  favoriRaw: Array<{ yayin_id: string; urun_adi: string; teknik_adi: string; favori_sayisi: number }>;
}

const bos: UreticiData = {
  hata: null,
  takim: null,
  firma: null,
  uretimOzet: {
    toplam_talep: 0,
    yayindaki_talep: 0,
    durdurulan_talep: 0,
    devam_eden_talep: 0,
    senaryo_bekleyen: 0,
    video_bekleyen: 0,
    soru_seti_bekleyen: 0,
    senaryo_revizyon: 0,
    video_revizyon: 0,
    soru_seti_revizyon: 0,
    ortalama_talep_yayin_suresi: 0,
  },
  uttOzetler: [],
  bolgeBazli: [],
  urunBazliBolge: [],
  scopeOzet: {
    toplam_yayin: 0,
    gonderilen_oneri: 0,
    tamamlanan_oneri: 0,
    bekleyen_oneri: 0,
    bekleyen_oneri_olan_utt_sayisi: 0,
  },
  toplamUttSayisi: 0,
  sirketToplamPuan: 0,
  takimSirasi: [],
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
  const isTakimScope = yetenek.raporScope === 'takim';
  const scopeParams = isTakimScope
    ? { p_takim_id: kullanici.takim_id }
    : { p_firma_id: kullanici.firma_id };

  if (isTakimScope && !kullanici.takim_id) {
    return { ...bos, hata: hataYaniti('Takım kaydı eksik. Lütfen admin ile iletişime geçin.', 'takim_id eksik', null) };
  }

  const firmaTakimlariRes = isTakimScope
    ? await adminSupabase.from('takimlar').select('takim_id, takim_adi').eq('firma_id', kullanici.firma_id)
    : { data: [], error: null };

  if (firmaTakimlariRes.error) {
    return { ...bos, hata: hataYaniti('Takım listesi çekilemedi', 'takimlar', firmaTakimlariRes.error) };
  }

  const uttSayisiQuery = adminSupabase
    .from('kullanicilar')
    .select('kullanici_id', { count: 'exact', head: true })
    .in('rol', ['utt', 'kd_utt'])
    .eq('aktif_mi', true);
  if (isTakimScope) {
    uttSayisiQuery.eq('takim_id', kullanici.takim_id);
  } else {
    uttSayisiQuery.eq('firma_id', kullanici.firma_id);
  }

  const [
    takimAdRes,
    firmaAdRes,
    uretimOzetRes,
    uttOzetlerRes,
    bolgeBazliRes,
    urunBazliBolgeRes,
    scopeOzetRes,
    toplamUttRes,
    sirketOzetRes,
    begeniRawRes,
    favoriRawRes,
  ] = await Promise.all([
    kullanici.takim_id
      ? adminSupabase.from('takimlar').select('takim_adi').eq('takim_id', kullanici.takim_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    adminSupabase.from('firmalar').select('firma_adi').eq('firma_id', kullanici.firma_id).maybeSingle(),
    adminSupabase.rpc('get_pm_uretim_ozet', {
      p_uretici_id: kullanici.kullanici_id,
      p_baslangic: baslangic,
      p_bitis: bitis,
    }),
    adminSupabase.rpc('get_kullanici_ozet', {
      p_baslangic: baslangic,
      p_bitis: bitis,
      ...scopeParams,
    }),
    adminSupabase.rpc('get_bolge_bazli_grup', {
      p_baslangic: baslangic,
      p_bitis: bitis,
      ...scopeParams,
    }),
    adminSupabase.rpc('get_urun_bazli_bolge_grup', {
      p_baslangic: baslangic,
      p_bitis: bitis,
      ...scopeParams,
    }),
    adminSupabase.rpc('get_scope_ozet', {
      p_baslangic: baslangic,
      p_bitis: bitis,
      p_oneren_id: null,
      ...scopeParams,
    }),
    uttSayisiQuery,
    adminSupabase.rpc('get_kullanici_ozet', {
      p_baslangic: baslangic,
      p_bitis: bitis,
      p_firma_id: kullanici.firma_id,
    }),
    isTakimScope
      ? adminSupabase
          .from('v_rapor_begeni_favori')
          .select('yayin_id, urun_adi, teknik_adi, begeni_sayisi')
          .eq('takim_id', kullanici.takim_id)
          .order('begeni_sayisi', { ascending: false })
          .limit(5)
      : adminSupabase
          .from('v_rapor_begeni_favori')
          .select('yayin_id, urun_adi, teknik_adi, begeni_sayisi')
          .eq('firma_id', kullanici.firma_id)
          .order('begeni_sayisi', { ascending: false })
          .limit(5),
    isTakimScope
      ? adminSupabase
          .from('v_rapor_begeni_favori')
          .select('yayin_id, urun_adi, teknik_adi, favori_sayisi')
          .eq('takim_id', kullanici.takim_id)
          .order('favori_sayisi', { ascending: false })
          .limit(5)
      : adminSupabase
          .from('v_rapor_begeni_favori')
          .select('yayin_id, urun_adi, teknik_adi, favori_sayisi')
          .eq('firma_id', kullanici.firma_id)
          .order('favori_sayisi', { ascending: false })
          .limit(5),
  ]);

  if (takimAdRes.error)        return { ...bos, hata: hataYaniti('Takım adı çekilemedi', 'takimlar', takimAdRes.error) };
  if (firmaAdRes.error)        return { ...bos, hata: hataYaniti('Firma adı çekilemedi', 'firmalar', firmaAdRes.error) };
  if (uretimOzetRes.error)     return { ...bos, hata: hataYaniti('Üretim özeti çekilemedi', 'get_pm_uretim_ozet', uretimOzetRes.error) };
  if (uttOzetlerRes.error)     return { ...bos, hata: hataYaniti('UTT özetleri çekilemedi', 'get_kullanici_ozet (scope)', uttOzetlerRes.error) };
  if (bolgeBazliRes.error)     return { ...bos, hata: hataYaniti('Bölge bazlı grup çekilemedi', 'get_bolge_bazli_grup', bolgeBazliRes.error) };
  if (urunBazliBolgeRes.error) return { ...bos, hata: hataYaniti('Ürün bazlı bölge grup çekilemedi', 'get_urun_bazli_bolge_grup', urunBazliBolgeRes.error) };
  if (scopeOzetRes.error)      return { ...bos, hata: hataYaniti('Scope özeti çekilemedi', 'get_scope_ozet', scopeOzetRes.error) };
  if (toplamUttRes.error)      return { ...bos, hata: hataYaniti('Toplam UTT sayısı çekilemedi', 'kullanicilar count', toplamUttRes.error) };
  if (sirketOzetRes.error)     return { ...bos, hata: hataYaniti('Şirket toplam puanı çekilemedi', 'get_kullanici_ozet (firma)', sirketOzetRes.error) };
  if (begeniRawRes.error)      return { ...bos, hata: hataYaniti('Beğeni listesi çekilemedi', 'v_rapor_begeni_favori', begeniRawRes.error) };
  if (favoriRawRes.error)      return { ...bos, hata: hataYaniti('Favori listesi çekilemedi', 'v_rapor_begeni_favori', favoriRawRes.error) };

  const sirketOzetler = (sirketOzetRes.data ?? []) as OzetSatir[];
  const sirketToplamPuan = sirketOzetler.reduce((acc, o) => acc + (o.toplam_net_puan ?? 0), 0);

  let takimSirasi: TakimSiraSatir[] = [];
  if (isTakimScope) {
    const takimSirasiPromises = (firmaTakimlariRes.data ?? []).map(async (t: any) => {
      const { data } = await adminSupabase.rpc('get_kullanici_ozet', {
        p_baslangic: baslangic,
        p_bitis: bitis,
        p_takim_id: t.takim_id,
      });
      const toplam = (data ?? []).reduce(
        (acc: number, o: any) => acc + (o.toplam_net_puan ?? 0),
        0
      );
      return { takim_id: t.takim_id, takim_adi: t.takim_adi, toplam_puan: toplam };
    });
    takimSirasi = (await Promise.all(takimSirasiPromises)).sort(
      (a, b) => b.toplam_puan - a.toplam_puan
    );
  }

  const uretimSatir = (uretimOzetRes.data && (uretimOzetRes.data as any[]).length > 0)
    ? (uretimOzetRes.data as any[])[0]
    : null;
  const scopeOzetSatir = (scopeOzetRes.data && (scopeOzetRes.data as any[]).length > 0)
    ? (scopeOzetRes.data as any[])[0]
    : null;

  return {
    hata: null,
    takim: takimAdRes.data,
    firma: firmaAdRes.data,
    uretimOzet: {
      toplam_talep: uretimSatir?.toplam_talep ?? 0,
      yayindaki_talep: uretimSatir?.yayindaki_talep ?? 0,
      durdurulan_talep: uretimSatir?.durdurulan_talep ?? 0,
      devam_eden_talep: uretimSatir?.devam_eden_talep ?? 0,
      senaryo_bekleyen: uretimSatir?.senaryo_bekleyen ?? 0,
      video_bekleyen: uretimSatir?.video_bekleyen ?? 0,
      soru_seti_bekleyen: uretimSatir?.soru_seti_bekleyen ?? 0,
      senaryo_revizyon: uretimSatir?.senaryo_revizyon ?? 0,
      video_revizyon: uretimSatir?.video_revizyon ?? 0,
      soru_seti_revizyon: uretimSatir?.soru_seti_revizyon ?? 0,
      ortalama_talep_yayin_suresi: Number(uretimSatir?.ortalama_talep_yayin_suresi ?? 0),
    },
    uttOzetler: (uttOzetlerRes.data ?? []) as OzetSatir[],
    bolgeBazli: (bolgeBazliRes.data ?? []) as BolgeBazliSatir[],
    urunBazliBolge: (urunBazliBolgeRes.data ?? []) as UrunBazliBolgeSatir[],
    scopeOzet: {
      toplam_yayin: scopeOzetSatir?.toplam_yayin ?? 0,
      gonderilen_oneri: scopeOzetSatir?.gonderilen_oneri ?? 0,
      tamamlanan_oneri: scopeOzetSatir?.tamamlanan_oneri ?? 0,
      bekleyen_oneri: scopeOzetSatir?.bekleyen_oneri ?? 0,
      bekleyen_oneri_olan_utt_sayisi: scopeOzetSatir?.bekleyen_oneri_olan_utt_sayisi ?? 0,
    },
    toplamUttSayisi: toplamUttRes.count ?? 0,
    sirketToplamPuan,
    takimSirasi,
    begeniRaw: begeniRawRes.data ?? [],
    favoriRaw: favoriRawRes.data ?? [],
  };
}