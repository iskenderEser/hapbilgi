// lib/rapor/bm/getBmData.ts
import { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { hataYaniti } from '@/lib/utils/hataIsle';

interface Kullanici {
  kullanici_id: string;
  bolge_id: string;
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

interface UrunBazliGrup {
  urun_id: string;
  urun_adi: string;
  toplam_izlenme: number;
  toplam_net_puan: number;
  utt_listesi: any;
  ortalama: any;
  teknik_dagilimi: any;
}

interface BolgeSiraSatir {
  bolge_id: string;
  bolge_adi: string;
  toplam_puan: number;
}

interface BmData {
  hata: NextResponse | null;
  bolge: { bolge_adi: string } | null;
  takim: { takim_adi: string } | null;
  // Bölgedeki tüm UTT'lerin kullanıcı bazlı ozet'i (UTT bazlı satır listesi)
  uttOzetler: OzetSatir[];
  // Bölgedeki ürün × UTT akordeon verisi
  urunDagilimi: UrunBazliGrup[];
  // Scope-bağımsız metrikler (toplam_yayin + öneri etkinliği)
  scopeOzet: {
    toplam_yayin: number;
    gonderilen_oneri: number;
    tamamlanan_oneri: number;
    bekleyen_oneri: number;
    bekleyen_oneri_olan_utt_sayisi: number;
  };
  // Bölgedeki toplam UTT sayısı (aktif_utt hesabı için fark alınır)
  toplamUttSayisi: number;
  // Takım & Şirket toplam net puanı (katkı hesabı için)
  takimToplamPuan: number;
  sirketToplamPuan: number;
  // Takımdaki tüm bölgelerin sıralanması (HBLigi bölge sırası için)
  bolgeSirasi: BolgeSiraSatir[];
  // Beğeni & favori listeleri (mevcut yapı korunur)
  begeniRaw: Array<{ yayin_id: string; urun_adi: string; teknik_adi: string; begeni_sayisi: number }>;
  favoriRaw: Array<{ yayin_id: string; urun_adi: string; teknik_adi: string; favori_sayisi: number }>;
}

const bos: BmData = {
  hata: null,
  bolge: null,
  takim: null,
  uttOzetler: [],
  urunDagilimi: [],
  scopeOzet: {
    toplam_yayin: 0,
    gonderilen_oneri: 0,
    tamamlanan_oneri: 0,
    bekleyen_oneri: 0,
    bekleyen_oneri_olan_utt_sayisi: 0,
  },
  toplamUttSayisi: 0,
  takimToplamPuan: 0,
  sirketToplamPuan: 0,
  bolgeSirasi: [],
  begeniRaw: [],
  favoriRaw: [],
};

export async function getBmData(
  adminSupabase: SupabaseClient,
  kullanici: Kullanici,
  baslangic: string,
  bitis: string
): Promise<BmData> {
  // 1) Takımdaki tüm bölgeleri çek (HBLigi bölge sıralaması için)
  const { data: takimBolgeleri, error: bolgeListError } = await adminSupabase
    .from('bolgeler')
    .select('bolge_id, bolge_adi')
    .eq('takim_id', kullanici.takim_id);

  if (bolgeListError) {
    return { ...bos, hata: hataYaniti('Bölge listesi çekilemedi', 'bolgeler', bolgeListError) };
  }

  // 2) Paralel: bölge adı, takım adı, BM bölgesi UTT ozet, BM bölgesi ürün dağılımı,
  //    BM bölgesi scope ozet, BM bölgesi toplam UTT count, takım net SUM, şirket net SUM,
  //    beğeni & favori listeleri
  const [
    bolgeAdRes,
    takimAdRes,
    uttOzetlerRes,
    urunDagilimiRes,
    scopeOzetRes,
    toplamUttRes,
    takimOzetRes,
    sirketOzetRes,
    begeniRawRes,
    favoriRawRes,
  ] = await Promise.all([
    adminSupabase.from('bolgeler').select('bolge_adi').eq('bolge_id', kullanici.bolge_id).maybeSingle(),
    adminSupabase.from('takimlar').select('takim_adi').eq('takim_id', kullanici.takim_id).maybeSingle(),
    // BM bölgesindeki tüm UTT'lerin ozet'i (kullanıcı bazlı satır listesi)
    adminSupabase.rpc('get_kullanici_ozet', {
      p_baslangic: baslangic,
      p_bitis: bitis,
      p_bolge_id: kullanici.bolge_id,
    }),
    // BM bölgesinin ürün bazlı grup verisi (akordeon)
    adminSupabase.rpc('get_urun_bazli_grup', {
      p_baslangic: baslangic,
      p_bitis: bitis,
      p_bolge_id: kullanici.bolge_id,
    }),
    // BM bölgesinin scope-bağımsız metrikleri (toplam_yayin + öneri)
    adminSupabase.rpc('get_scope_ozet', {
      p_baslangic: baslangic,
      p_bitis: bitis,
      p_bolge_id: kullanici.bolge_id,
      p_oneren_id: kullanici.kullanici_id,
    }),
    // BM bölgesindeki toplam aktif UTT/kd_utt sayısı (aktif_utt hesabı için)
    adminSupabase
      .from('kullanicilar')
      .select('kullanici_id', { count: 'exact', head: true })
      .eq('bolge_id', kullanici.bolge_id)
      .in('rol', ['utt', 'kd_utt'])
      .eq('aktif_mi', true),
    // Takım net SUM (katkı hesabı için) — scope: takım, tek satır (no p_kullanici_id)
    adminSupabase.rpc('get_kullanici_ozet', {
      p_baslangic: baslangic,
      p_bitis: bitis,
      p_takim_id: kullanici.takim_id,
    }),
    // Şirket net SUM (katkı hesabı için)
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

  if (bolgeAdRes.error)     return { ...bos, hata: hataYaniti('Bölge adı çekilemedi', 'bolgeler', bolgeAdRes.error) };
  if (takimAdRes.error)     return { ...bos, hata: hataYaniti('Takım adı çekilemedi', 'takimlar', takimAdRes.error) };
  if (uttOzetlerRes.error)  return { ...bos, hata: hataYaniti('Bölge UTT özetleri çekilemedi', 'get_kullanici_ozet (bolge)', uttOzetlerRes.error) };
  if (urunDagilimiRes.error)return { ...bos, hata: hataYaniti('Ürün dağılımı çekilemedi', 'get_urun_bazli_grup', urunDagilimiRes.error) };
  if (scopeOzetRes.error)   return { ...bos, hata: hataYaniti('Scope özeti çekilemedi', 'get_scope_ozet', scopeOzetRes.error) };
  if (toplamUttRes.error)   return { ...bos, hata: hataYaniti('Toplam UTT sayısı çekilemedi', 'kullanicilar count', toplamUttRes.error) };
  if (takimOzetRes.error)   return { ...bos, hata: hataYaniti('Takım toplam puanı çekilemedi', 'get_kullanici_ozet (takim)', takimOzetRes.error) };
  if (sirketOzetRes.error)  return { ...bos, hata: hataYaniti('Şirket toplam puanı çekilemedi', 'get_kullanici_ozet (firma)', sirketOzetRes.error) };
  if (begeniRawRes.error)   return { ...bos, hata: hataYaniti('Beğeni listesi çekilemedi', 'v_rapor_begeni_favori', begeniRawRes.error) };
  if (favoriRawRes.error)   return { ...bos, hata: hataYaniti('Favori listesi çekilemedi', 'v_rapor_begeni_favori', favoriRawRes.error) };

  // Takım & şirket toplam net = scope'lu ozet satırlarının toplamı
  const takimOzetler = (takimOzetRes.data ?? []) as OzetSatir[];
  const sirketOzetler = (sirketOzetRes.data ?? []) as OzetSatir[];
  const takimToplamPuan = takimOzetler.reduce((acc, o) => acc + (o.toplam_net_puan ?? 0), 0);
  const sirketToplamPuan = sirketOzetler.reduce((acc, o) => acc + (o.toplam_net_puan ?? 0), 0);

  // Bölge sıralaması — her bölge için scope'lu ozet alıp toplamı çıkar.
  // Takımdaki bölge sayısı küçük (tipik 5-10), tek tek RPC çağrısı kabul edilebilir.
  const bolgeSirasiPromises = (takimBolgeleri ?? []).map(async (b: any) => {
    const { data } = await adminSupabase.rpc('get_kullanici_ozet', {
      p_baslangic: baslangic,
      p_bitis: bitis,
      p_bolge_id: b.bolge_id,
    });
    const toplam = (data ?? []).reduce(
      (acc: number, o: any) => acc + (o.toplam_net_puan ?? 0),
      0
    );
    return { bolge_id: b.bolge_id, bolge_adi: b.bolge_adi, toplam_puan: toplam };
  });
  const bolgeSirasi = (await Promise.all(bolgeSirasiPromises)).sort(
    (a, b) => b.toplam_puan - a.toplam_puan
  );

  const scopeOzetSatir = (scopeOzetRes.data && (scopeOzetRes.data as any[]).length > 0)
    ? (scopeOzetRes.data as any[])[0]
    : null;

  return {
    hata: null,
    bolge: bolgeAdRes.data,
    takim: takimAdRes.data,
    uttOzetler: (uttOzetlerRes.data ?? []) as OzetSatir[],
    urunDagilimi: (urunDagilimiRes.data ?? []) as UrunBazliGrup[],
    scopeOzet: {
      toplam_yayin: scopeOzetSatir?.toplam_yayin ?? 0,
      gonderilen_oneri: scopeOzetSatir?.gonderilen_oneri ?? 0,
      tamamlanan_oneri: scopeOzetSatir?.tamamlanan_oneri ?? 0,
      bekleyen_oneri: scopeOzetSatir?.bekleyen_oneri ?? 0,
      bekleyen_oneri_olan_utt_sayisi: scopeOzetSatir?.bekleyen_oneri_olan_utt_sayisi ?? 0,
    },
    toplamUttSayisi: toplamUttRes.count ?? 0,
    takimToplamPuan,
    sirketToplamPuan,
    bolgeSirasi,
    begeniRaw: begeniRawRes.data ?? [],
    favoriRaw: favoriRawRes.data ?? [],
  };
}