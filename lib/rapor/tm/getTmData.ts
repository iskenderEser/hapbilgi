// lib/rapor/tm/getTmData.ts
import { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { hataYaniti } from '@/lib/utils/hataIsle';

interface Kullanici {
  kullanici_id: string;
  takim_id: string;
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

interface TakimSiraSatir {
  takim_id: string;
  takim_adi: string;
  toplam_puan: number;
}

interface TmData {
  hata: NextResponse | null;
  takim: { takim_adi: string } | null;
  firma: { firma_adi: string } | null;
  // Takım UTT'lerinin kullanıcı bazlı ozet'i (katkı/aktif sayısı için)
  uttOzetler: OzetSatir[];
  // Bölge bazlı tablo (Blok 1)
  bolgeBazli: BolgeBazliSatir[];
  // Ürün bazlı bölge dağılımı (Blok 2 — akordeon)
  urunBazliBolge: UrunBazliBolgeSatir[];
  // Scope-bağımsız metrikler (toplam_yayin + öneri etkinliği — takım kapsamında)
  scopeOzet: {
    toplam_yayin: number;
    gonderilen_oneri: number;
    tamamlanan_oneri: number;
    bekleyen_oneri: number;
    bekleyen_oneri_olan_utt_sayisi: number;
  };
  // Takımdaki toplam UTT sayısı
  toplamUttSayisi: number;
  // Şirket toplam net (katkı hesabı için)
  sirketToplamPuan: number;
  // Firmadaki tüm takımlar — HBLigi takım sıralaması için (her takımın net puanı)
  takimSirasi: TakimSiraSatir[];
  // Beğeni & favori listeleri
  begeniRaw: Array<{ yayin_id: string; urun_adi: string; teknik_adi: string; begeni_sayisi: number }>;
  favoriRaw: Array<{ yayin_id: string; urun_adi: string; teknik_adi: string; favori_sayisi: number }>;
}

const bos: TmData = {
  hata: null,
  takim: null,
  firma: null,
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

export async function getTmData(
  adminSupabase: SupabaseClient,
  kullanici: Kullanici,
  baslangic: string,
  bitis: string
): Promise<TmData> {
  // 1) Firmadaki tüm takımları çek (HBLigi takım sıralaması için)
  const { data: firmaTakimlari, error: takimListError } = await adminSupabase
    .from('takimlar')
    .select('takim_id, takim_adi')
    .eq('firma_id', kullanici.firma_id);

  if (takimListError) {
    return { ...bos, hata: hataYaniti('Takım listesi çekilemedi', 'takimlar', takimListError) };
  }

  // 2) Paralel: takım adı, firma adı, takım UTT ozet, bölge bazlı grup, ürün bazlı bölge grup,
  //    scope ozet, toplam UTT count, şirket net SUM, beğeni & favori listeleri
  const [
    takimAdRes,
    firmaAdRes,
    uttOzetlerRes,
    bolgeBazliRes,
    urunBazliBolgeRes,
    scopeOzetRes,
    toplamUttRes,
    sirketOzetRes,
    begeniRawRes,
    favoriRawRes,
  ] = await Promise.all([
    adminSupabase.from('takimlar').select('takim_adi').eq('takim_id', kullanici.takim_id).maybeSingle(),
    adminSupabase.from('firmalar').select('firma_adi').eq('firma_id', kullanici.firma_id).maybeSingle(),
    adminSupabase.rpc('get_kullanici_ozet', {
      p_baslangic: baslangic,
      p_bitis: bitis,
      p_takim_id: kullanici.takim_id,
    }),
    adminSupabase.rpc('get_bolge_bazli_grup', {
      p_baslangic: baslangic,
      p_bitis: bitis,
      p_takim_id: kullanici.takim_id,
    }),
    adminSupabase.rpc('get_urun_bazli_bolge_grup', {
      p_baslangic: baslangic,
      p_bitis: bitis,
      p_takim_id: kullanici.takim_id,
    }),
    adminSupabase.rpc('get_scope_ozet', {
      p_baslangic: baslangic,
      p_bitis: bitis,
      p_takim_id: kullanici.takim_id,
      p_oneren_id: null,
    }),
    adminSupabase
      .from('kullanicilar')
      .select('kullanici_id', { count: 'exact', head: true })
      .eq('takim_id', kullanici.takim_id)
      .in('rol', ['utt', 'kd_utt'])
      .eq('aktif_mi', true),
    adminSupabase.rpc('get_kullanici_ozet', {
      p_baslangic: baslangic,
      p_bitis: bitis,
      p_firma_id: kullanici.firma_id,
    }),
    adminSupabase
      .from('v_rapor_begeni_favori')
      .select('yayin_id, urun_adi, teknik_adi, begeni_sayisi')
      .eq('takim_id', kullanici.takim_id)
      .order('begeni_sayisi', { ascending: false })
      .limit(5),
    adminSupabase
      .from('v_rapor_begeni_favori')
      .select('yayin_id, urun_adi, teknik_adi, favori_sayisi')
      .eq('takim_id', kullanici.takim_id)
      .order('favori_sayisi', { ascending: false })
      .limit(5),
  ]);

  if (takimAdRes.error)        return { ...bos, hata: hataYaniti('Takım adı çekilemedi', 'takimlar', takimAdRes.error) };
  if (firmaAdRes.error)        return { ...bos, hata: hataYaniti('Firma adı çekilemedi', 'firmalar', firmaAdRes.error) };
  if (uttOzetlerRes.error)     return { ...bos, hata: hataYaniti('Takım UTT özetleri çekilemedi', 'get_kullanici_ozet (takim)', uttOzetlerRes.error) };
  if (bolgeBazliRes.error)     return { ...bos, hata: hataYaniti('Bölge bazlı grup çekilemedi', 'get_bolge_bazli_grup', bolgeBazliRes.error) };
  if (urunBazliBolgeRes.error) return { ...bos, hata: hataYaniti('Ürün bazlı bölge grup çekilemedi', 'get_urun_bazli_bolge_grup', urunBazliBolgeRes.error) };
  if (scopeOzetRes.error)      return { ...bos, hata: hataYaniti('Scope özeti çekilemedi', 'get_scope_ozet', scopeOzetRes.error) };
  if (toplamUttRes.error)      return { ...bos, hata: hataYaniti('Toplam UTT sayısı çekilemedi', 'kullanicilar count', toplamUttRes.error) };
  if (sirketOzetRes.error)     return { ...bos, hata: hataYaniti('Şirket toplam puanı çekilemedi', 'get_kullanici_ozet (firma)', sirketOzetRes.error) };
  if (begeniRawRes.error)      return { ...bos, hata: hataYaniti('Beğeni listesi çekilemedi', 'v_rapor_begeni_favori', begeniRawRes.error) };
  if (favoriRawRes.error)      return { ...bos, hata: hataYaniti('Favori listesi çekilemedi', 'v_rapor_begeni_favori', favoriRawRes.error) };

  // Şirket toplam net = scope'lu ozet satırlarının toplamı
  const sirketOzetler = (sirketOzetRes.data ?? []) as OzetSatir[];
  const sirketToplamPuan = sirketOzetler.reduce((acc, o) => acc + (o.toplam_net_puan ?? 0), 0);

  // Takım sıralaması — her takım için scope'lu ozet alıp toplamı çıkar.
  // Firmadaki takım sayısı küçük (tipik 5-10), tek tek RPC çağrısı kabul edilebilir.
  const takimSirasiPromises = (firmaTakimlari ?? []).map(async (t: any) => {
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
  const takimSirasi = (await Promise.all(takimSirasiPromises)).sort(
    (a, b) => b.toplam_puan - a.toplam_puan
  );

  const scopeOzetSatir = (scopeOzetRes.data && (scopeOzetRes.data as any[]).length > 0)
    ? (scopeOzetRes.data as any[])[0]
    : null;

  return {
    hata: null,
    takim: takimAdRes.data,
    firma: firmaAdRes.data,
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