// lib/rapor/uretici/getUreticiData.ts
import { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { hataYaniti } from '@/lib/utils/hataIsle';
import { UreticiYetenek } from '@/lib/uretici/yetenekler';
import { TUKETICI_ROLLER } from '@/lib/utils/roller';

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
  urun_dagilimi: unknown;
}

interface UrunBolgeSatir {
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

interface UrunBazliBolgeSatir {
  urun_id: string;
  urun_adi: string;
  toplam_net_puan: number;
  bolge_listesi: UrunBolgeSatir[];
  ortalama: Omit<UrunBolgeSatir, 'bolge_id' | 'bolge_adi' | 'toplam_utt'> & { bolge_sayisi: number };
}

interface AnaOzet {
  donemde_yayina_alinan: number;
  su_an_yayinda: number;
  planlanan: number;
  durdurulan_ve_iptal: number;
  devam_eden_talep: number;
  senaryo_onayi_bekleyen: number;
  video_onayi_bekleyen: number;
  soru_seti_onayi_bekleyen: number;
  senaryo_revizyon_olayi: number;
  senaryo_revizyonlu_talep: number;
  video_revizyon_olayi: number;
  video_revizyonlu_talep: number;
  soru_seti_revizyon_olayi: number;
  soru_seti_revizyonlu_talep: number;
  ortalama_uretim_suresi_saat: number;
  scope_toplam_yayin: number;
  scope_toplam_utt: number;
  guncel_tur_toplam_firsat: number;
  guncel_tur_tamamlanan: number;
  guncel_tur_kalan: number;
  guncel_tur_izlenme_orani: number;
  donem_tamamlanan_izleme: number;
  donem_benzersiz_utt_yayin: number;
  donem_aktif_utt: number;
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
  anaOzet: AnaOzet;
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
  anaOzet: {
    donemde_yayina_alinan: 0,
    su_an_yayinda: 0,
    planlanan: 0,
    durdurulan_ve_iptal: 0,
    devam_eden_talep: 0,
    senaryo_onayi_bekleyen: 0,
    video_onayi_bekleyen: 0,
    soru_seti_onayi_bekleyen: 0,
    senaryo_revizyon_olayi: 0,
    senaryo_revizyonlu_talep: 0,
    video_revizyon_olayi: 0,
    video_revizyonlu_talep: 0,
    soru_seti_revizyon_olayi: 0,
    soru_seti_revizyonlu_talep: 0,
    ortalama_uretim_suresi_saat: 0,
    scope_toplam_yayin: 0,
    scope_toplam_utt: 0,
    guncel_tur_toplam_firsat: 0,
    guncel_tur_tamamlanan: 0,
    guncel_tur_kalan: 0,
    guncel_tur_izlenme_orani: 0,
    donem_tamamlanan_izleme: 0,
    donem_benzersiz_utt_yayin: 0,
    donem_aktif_utt: 0,
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
    .in('rol', TUKETICI_ROLLER)
    .eq('aktif_mi', true);
  if (isTakimScope) {
    uttSayisiQuery.eq('takim_id', kullanici.takim_id);
  } else {
    uttSayisiQuery.eq('firma_id', kullanici.firma_id);
  }

  const [
    takimAdRes,
    firmaAdRes,
    anaOzetRes,
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
    adminSupabase.rpc('get_uretici_rapor_ana_ozet_v2', {
      p_uretici_id: kullanici.kullanici_id,
      p_baslangic: baslangic,
      p_bitis: bitis,
      p_takim_id: isTakimScope ? kullanici.takim_id : null,
      p_firma_id: isTakimScope ? null : kullanici.firma_id,
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
          .from('v_rapor_begeni_favori_v2')
          .select('yayin_id, urun_adi, teknik_adi, begeni_sayisi')
          .eq('takim_id', kullanici.takim_id)
          .gt('begeni_sayisi', 0)
          .order('begeni_sayisi', { ascending: false })
          .limit(5)
      : adminSupabase
          .from('v_rapor_begeni_favori_v2')
          .select('yayin_id, urun_adi, teknik_adi, begeni_sayisi')
          .eq('firma_id', kullanici.firma_id)
          .gt('begeni_sayisi', 0)
          .order('begeni_sayisi', { ascending: false })
          .limit(5),
    isTakimScope
      ? adminSupabase
          .from('v_rapor_begeni_favori_v2')
          .select('yayin_id, urun_adi, teknik_adi, favori_sayisi')
          .eq('takim_id', kullanici.takim_id)
          .gt('favori_sayisi', 0)
          .order('favori_sayisi', { ascending: false })
          .limit(5)
      : adminSupabase
          .from('v_rapor_begeni_favori_v2')
          .select('yayin_id, urun_adi, teknik_adi, favori_sayisi')
          .eq('firma_id', kullanici.firma_id)
          .gt('favori_sayisi', 0)
          .order('favori_sayisi', { ascending: false })
          .limit(5),
  ]);

  if (takimAdRes.error)        return { ...bos, hata: hataYaniti('Takım adı çekilemedi', 'takimlar', takimAdRes.error) };
  if (firmaAdRes.error)        return { ...bos, hata: hataYaniti('Firma adı çekilemedi', 'firmalar', firmaAdRes.error) };
  if (anaOzetRes.error)        return { ...bos, hata: hataYaniti('Üretici rapor özeti çekilemedi', 'get_uretici_rapor_ana_ozet_v2', anaOzetRes.error) };
  if (uttOzetlerRes.error)     return { ...bos, hata: hataYaniti('UTT özetleri çekilemedi', 'get_kullanici_ozet (scope)', uttOzetlerRes.error) };
  if (bolgeBazliRes.error)     return { ...bos, hata: hataYaniti('Bölge bazlı grup çekilemedi', 'get_bolge_bazli_grup', bolgeBazliRes.error) };
  if (urunBazliBolgeRes.error) return { ...bos, hata: hataYaniti('Ürün bazlı bölge grup çekilemedi', 'get_urun_bazli_bolge_grup', urunBazliBolgeRes.error) };
  if (scopeOzetRes.error)      return { ...bos, hata: hataYaniti('Scope özeti çekilemedi', 'get_scope_ozet', scopeOzetRes.error) };
  if (toplamUttRes.error)      return { ...bos, hata: hataYaniti('Toplam UTT sayısı çekilemedi', 'kullanicilar count', toplamUttRes.error) };
  if (sirketOzetRes.error)     return { ...bos, hata: hataYaniti('Şirket toplam puanı çekilemedi', 'get_kullanici_ozet (firma)', sirketOzetRes.error) };
  if (begeniRawRes.error)      return { ...bos, hata: hataYaniti('Beğeni listesi çekilemedi', 'v_rapor_begeni_favori_v2', begeniRawRes.error) };
  if (favoriRawRes.error)      return { ...bos, hata: hataYaniti('Favori listesi çekilemedi', 'v_rapor_begeni_favori_v2', favoriRawRes.error) };

  const sirketOzetler = (sirketOzetRes.data ?? []) as OzetSatir[];
  const sirketToplamPuan = sirketOzetler.reduce((acc, o) => acc + (o.toplam_net_puan ?? 0), 0);

  let takimSirasi: TakimSiraSatir[] = [];
  if (isTakimScope) {
    const takimSirasiPromises = (firmaTakimlariRes.data ?? []).map(async (t: { takim_id: string; takim_adi: string }) => {
      const { data } = await adminSupabase.rpc('get_kullanici_ozet', {
        p_baslangic: baslangic,
        p_bitis: bitis,
        p_takim_id: t.takim_id,
      });
      const toplam = ((data ?? []) as OzetSatir[]).reduce(
        (acc, o) => acc + (o.toplam_net_puan ?? 0),
        0
      );
      return { takim_id: t.takim_id, takim_adi: t.takim_adi, toplam_puan: toplam };
    });
    takimSirasi = (await Promise.all(takimSirasiPromises)).sort(
      (a, b) => b.toplam_puan - a.toplam_puan
    );
  }

  const anaOzetSatir = (anaOzetRes.data && (anaOzetRes.data as AnaOzet[]).length > 0)
    ? (anaOzetRes.data as AnaOzet[])[0]
    : null;
  const scopeOzetSatir = (scopeOzetRes.data && (scopeOzetRes.data as UreticiData['scopeOzet'][]).length > 0)
    ? (scopeOzetRes.data as UreticiData['scopeOzet'][])[0]
    : null;

  return {
    hata: null,
    takim: takimAdRes.data,
    firma: firmaAdRes.data,
    anaOzet: {
      donemde_yayina_alinan: anaOzetSatir?.donemde_yayina_alinan ?? 0,
      su_an_yayinda: anaOzetSatir?.su_an_yayinda ?? 0,
      planlanan: anaOzetSatir?.planlanan ?? 0,
      durdurulan_ve_iptal: anaOzetSatir?.durdurulan_ve_iptal ?? 0,
      devam_eden_talep: anaOzetSatir?.devam_eden_talep ?? 0,
      senaryo_onayi_bekleyen: anaOzetSatir?.senaryo_onayi_bekleyen ?? 0,
      video_onayi_bekleyen: anaOzetSatir?.video_onayi_bekleyen ?? 0,
      soru_seti_onayi_bekleyen: anaOzetSatir?.soru_seti_onayi_bekleyen ?? 0,
      senaryo_revizyon_olayi: anaOzetSatir?.senaryo_revizyon_olayi ?? 0,
      senaryo_revizyonlu_talep: anaOzetSatir?.senaryo_revizyonlu_talep ?? 0,
      video_revizyon_olayi: anaOzetSatir?.video_revizyon_olayi ?? 0,
      video_revizyonlu_talep: anaOzetSatir?.video_revizyonlu_talep ?? 0,
      soru_seti_revizyon_olayi: anaOzetSatir?.soru_seti_revizyon_olayi ?? 0,
      soru_seti_revizyonlu_talep: anaOzetSatir?.soru_seti_revizyonlu_talep ?? 0,
      ortalama_uretim_suresi_saat: Number(anaOzetSatir?.ortalama_uretim_suresi_saat ?? 0),
      scope_toplam_yayin: anaOzetSatir?.scope_toplam_yayin ?? 0,
      scope_toplam_utt: anaOzetSatir?.scope_toplam_utt ?? 0,
      guncel_tur_toplam_firsat: anaOzetSatir?.guncel_tur_toplam_firsat ?? 0,
      guncel_tur_tamamlanan: anaOzetSatir?.guncel_tur_tamamlanan ?? 0,
      guncel_tur_kalan: anaOzetSatir?.guncel_tur_kalan ?? 0,
      guncel_tur_izlenme_orani: anaOzetSatir?.guncel_tur_izlenme_orani ?? 0,
      donem_tamamlanan_izleme: anaOzetSatir?.donem_tamamlanan_izleme ?? 0,
      donem_benzersiz_utt_yayin: anaOzetSatir?.donem_benzersiz_utt_yayin ?? 0,
      donem_aktif_utt: anaOzetSatir?.donem_aktif_utt ?? 0,
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
