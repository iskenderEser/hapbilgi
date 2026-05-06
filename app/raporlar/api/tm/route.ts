// app/raporlar/api/tm/route.ts
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { hataYaniti, yetkiHatasi } from '@/lib/utils/hataIsle';
import { tarihAraligi } from '@/lib/utils/tarihAraligi';
import { BolgeItem } from '@/lib/types/rapor';
import { aggregateBolge } from '@/lib/rapor/tm/aggregateBolge';
import { getTmData } from '@/lib/rapor/tm/getTmData';

export async function GET(request: Request) {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const { searchParams } = new URL(request.url);
  const periyot = searchParams.get('periyot') || 'bu_ay';
  const { baslangic, bitis } = tarihAraligi(periyot);

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return yetkiHatasi('Oturum açılmamış');

  const { data: kullanici, error: kullaniciError } = await adminSupabase
    .from('kullanicilar')
    .select('kullanici_id, ad, soyad, rol, takim_id, firma_id')
    .eq('eposta', user.email)
    .single();

  if (kullaniciError || !kullanici) {
    return hataYaniti('Kullanıcı bulunamadı', 'kullanici_bulamadi', kullaniciError);
  }

  const rol = (kullanici.rol ?? '').toLowerCase();
  if (rol !== 'tm') return yetkiHatasi('Bu rapora erişim yetkiniz yok');
 

  // Bölge listesi — periyot filtreli RPC
  const { data: bolgeRpcData, error: bolgeRpcError } = await adminSupabase.rpc('get_analiz_bolge', {
    p_baslangic: baslangic,
    p_bitis: bitis,
    p_firma_id: null,
    p_takim_id: kullanici.takim_id,
    p_bolge_id: null,
  });

  if (bolgeRpcError) return hataYaniti('Bölge verisi çekilemedi.', 'get_analiz_bolge RPC', bolgeRpcError);

  // BM bilgilerini çek — RPC'ye bağlı olduğu için önce
  const bolgeIdleri = (bolgeRpcData ?? []).map((b: any) => b.bolge_id);
  const { data: bmListesi, error: bmError } = await adminSupabase
    .from('kullanicilar')
    .select('bolge_id, ad, soyad')
    .in('bolge_id', bolgeIdleri)
    .eq('rol', 'bm');

  if (bmError) return hataYaniti('BM bilgisi çekilemedi', 'kullanicilar', bmError);

  const bmMap: Record<string, string> = {};
  for (const bm of bmListesi || []) {
    bmMap[bm.bolge_id] = `${bm.ad} ${bm.soyad}`;
  }

  // Bölge listesini ve response listesini tek geçişte oluştur
  const bolgeListesi: BolgeItem[] = [];
  const bolgeResponseListesi: any[] = [];

  let sira = 0;
  for (const b of (bolgeRpcData ?? []).sort((a: any, b: any) =>
    ((b.kazanilan_izleme_puani || 0) + (b.kazanilan_cevaplama_puani || 0) + (b.kazanilan_oneri_puani || 0) + (b.kazanilan_extra_puani || 0)) -
    ((a.kazanilan_izleme_puani || 0) + (a.kazanilan_cevaplama_puani || 0) + (a.kazanilan_oneri_puani || 0) + (a.kazanilan_extra_puani || 0))
  )) {
    sira++;
    const item: BolgeItem = {
      bolge_id: b.bolge_id,
      bolge_adi: b.bolge_adi,
      toplam_puan: (b.kazanilan_izleme_puani || 0) + (b.kazanilan_cevaplama_puani || 0) + (b.kazanilan_oneri_puani || 0) + (b.kazanilan_extra_puani || 0),
      video_puani: b.kazanilan_izleme_puani || 0,
      soru_puani: b.kazanilan_cevaplama_puani || 0,
      oneri_puani: b.kazanilan_oneri_puani || 0,
      extra_puan: b.kazanilan_extra_puani || 0,
      ileri_sarma_kaybi: b.kaybedilen_ileri_sarma_puani || 0,
      yanlis_cevap_kaybi: b.kaybedilen_yanlis_cevap_puani || 0,
      oneri_kaybi: 0, // TODO: henüz backend'den gelmiyor
      toplam_utt: b.utt_sayisi || 0,
      aktif_utt: b.izlenen_video_sayisi > 0 ? b.utt_sayisi : 0,
      hic_izlememis_utt: b.izlenen_video_sayisi === 0 ? b.utt_sayisi : 0,
      toplam_izleme: b.izlenen_video_sayisi || 0,
      toplam_oneri: b.oneri_sayisi || 0,
      tamamlanan_oneri: (b.oneri_sayisi || 0) - (b.izlenmeyen_oneri_sayisi || 0),
      bekleyen_oneri: b.izlenmeyen_oneri_sayisi || 0,
    };
    bolgeListesi.push(item);
    bolgeResponseListesi.push({
      sira,
      bolge_id: item.bolge_id,
      bolge_adi: item.bolge_adi,
      bm: bmMap[item.bolge_id] || '-',
      puan: item.toplam_puan,
      katki_yuzdesi: 0, // aşağıda toplamPuan hesaplandıktan sonra dolacak
      video_puani: item.video_puani,
      soru_puani: item.soru_puani,
      oneri_puani: item.oneri_puani,
      extra_puan: item.extra_puan,
      kayiplar: Math.abs(item.ileri_sarma_kaybi) + Math.abs(item.yanlis_cevap_kaybi) + Math.abs(item.oneri_kaybi),
      bekleyen_oneri: item.bekleyen_oneri,
    });
  }

  // Aggregation
  const agg = aggregateBolge(bolgeListesi);
  const bolgeSayisi = bolgeListesi.length;
  const ortalamaPuanBolge = bolgeSayisi > 0 ? Math.round(agg.toplamPuan / bolgeSayisi) : 0;
  const tamamlanmaOrani = agg.toplamOneri > 0 ? Math.round((agg.tamamlananOneri / agg.toplamOneri) * 100) : 0;

  // katki_yuzdesi hesapla
  for (const b of bolgeResponseListesi) {
    b.katki_yuzdesi = agg.toplamPuan > 0 ? parseFloat((b.puan / agg.toplamPuan * 100).toFixed(1)) : 0;
  }

  // DB sorguları
  const { hata, takim, firma, toplamYayin, sirketToplamPuan, takimSiralamasi, urunIzleme, begeniRaw, favoriRaw } = await getTmData(adminSupabase, kullanici);
  if (hata) return hata;

  // Takım adlarını çek
  const takimIdleri = takimSiralamasi.map(t => t.takim_id);
  const { data: takimAdlari } = await adminSupabase
    .from('takimlar')
    .select('takim_id, takim_adi')
    .in('takim_id', takimIdleri);

  const takimAdMap: Record<string, string> = {};
  for (const t of takimAdlari || []) takimAdMap[t.takim_id] = t.takim_adi;

  // Firma sıralaması
  const firmaSiralamasi = takimSiralamasi.map((t, idx) => ({
    sira: idx + 1,
    takim_adi: takimAdMap[t.takim_id] || '-',
    puan: t.toplam_puan || 0,
    kendisi_mi: t.takim_id === kullanici.takim_id,
  }));

  const kendiSira = firmaSiralamasi.find(t => t.kendisi_mi)?.sira || null;

  let birUstPuanFarki: number | null = null;
  let takipciFarki: number | null = null;

  if (kendiSira && kendiSira > 1) {
    const ust = takimSiralamasi?.[kendiSira - 2];
    birUstPuanFarki = ust ? (ust.toplam_puan || 0) - agg.toplamPuan : null;
  }
  if (kendiSira && kendiSira < takimSiralamasi.length) {
    const alt = takimSiralamasi?.[kendiSira];
    takipciFarki = alt ? agg.toplamPuan - (alt.toplam_puan || 0) : null;
  }

  // Katkı hesabı
  const sirketKatki = sirketToplamPuan > 0 ? parseFloat(((agg.toplamPuan / sirketToplamPuan) * 100).toFixed(1)) : 0;

  // İzlenme hesabı
  const toplamIzlenmePotansiyeli = toplamYayin * agg.toplamUtt;
  const izlenmeOrani = toplamIzlenmePotansiyeli > 0 ? Math.round((agg.toplamIzlenme / toplamIzlenmePotansiyeli) * 100) : 0;
  const kalanIzlenme = Math.max(0, toplamIzlenmePotansiyeli - agg.toplamIzlenme);

  // Ürün & teknik dağılımı
  const urunSayilari: Record<string, number> = {};
  const teknikSayilari: Record<string, number> = {};

  for (const item of urunIzleme) {
    if (item.urun_adi) urunSayilari[item.urun_adi] = (urunSayilari[item.urun_adi] || 0) + (item.izlenme_sayisi ?? 0);
    if (item.teknik_adi) teknikSayilari[item.teknik_adi] = (teknikSayilari[item.teknik_adi] || 0) + (item.izlenme_sayisi ?? 0);
  }

  return NextResponse.json({
    success: true,
    data: {
      kullanici: {
        ad: kullanici.ad,
        soyad: kullanici.soyad,
        rol: kullanici.rol,
        takim_adi: takim?.takim_adi || '-',
        firma_adi: firma?.firma_adi || '-',
      },
      katki: {
        sirket_katki_yuzdesi: sirketKatki,
        takim_toplam_puan: agg.toplamPuan,
        sirket_toplam_puan: sirketToplamPuan,
      },
      takim_ozet: {
        toplam_bolge: bolgeSayisi,
        toplam_utt: agg.toplamUtt,
        aktif_utt: agg.aktifUtt,
        hic_izlemeyen_utt: agg.hicIzlemeyenUtt,
        toplam_puan: agg.toplamPuan,
        ortalama_puan_bolge: ortalamaPuanBolge,
        en_yuksek_puan: agg.enYuksek,
        izlenme_orani: izlenmeOrani,
        toplam_izlenme: agg.toplamIzlenme,
        kalan_izlenme: kalanIzlenme,
        toplam_yayin: toplamYayin,
      },
      lig: {
        takim_sirasi: kendiSira,
        toplam_takim_sayisi: takimSiralamasi.length,
        bir_ust_puan_farki: birUstPuanFarki,
        takipci_farki: takipciFarki,
        firma_siralamasi: firmaSiralamasi,
      },
      oneri_etkinligi: {
        gonderilen: agg.toplamOneri,
        tamamlanan: agg.tamamlananOneri,
        tamamlanma_orani: tamamlanmaOrani,
        bekleyen: agg.bekleyenOneri,
      },
      bolge_listesi: bolgeResponseListesi,
      ortalama_bolge: {
        puan: ortalamaPuanBolge,
        video_puani: bolgeSayisi > 0 ? Math.round(agg.video_puani / bolgeSayisi) : 0,
        soru_puani: bolgeSayisi > 0 ? Math.round(agg.soru_puani / bolgeSayisi) : 0,
        oneri_puani: bolgeSayisi > 0 ? Math.round(agg.oneri_puani / bolgeSayisi) : 0,
        extra_puan: bolgeSayisi > 0 ? Math.round(agg.extra_puan / bolgeSayisi) : 0,
        kayiplar: bolgeSayisi > 0 ? Math.round(agg.kayiplar / bolgeSayisi) : 0,
      },
      urun_bazli_dagilim: Object.entries(urunSayilari)
        .map(([urun_adi, izlenme_sayisi]) => ({ urun_adi, izlenme_sayisi }))
        .sort((a, b) => b.izlenme_sayisi - a.izlenme_sayisi),
      teknik_bazli_dagilim: Object.entries(teknikSayilari)
        .map(([teknik_adi, izlenme_sayisi]) => ({ teknik_adi, izlenme_sayisi }))
        .sort((a, b) => b.izlenme_sayisi - a.izlenme_sayisi),
      begeni_listesi: begeniRaw,
      favori_listesi: favoriRaw,
    },
  });
}