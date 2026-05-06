// app/raporlar/api/bm/route.ts
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { hataYaniti, yetkiHatasi } from '@/lib/utils/hataIsle';
import { tarihAraligi } from '@/lib/utils/tarihAraligi';
import { UttItem } from '@/lib/types/rapor';
import { aggregateUtt } from '@/lib/rapor/bm/aggregateUtt';
import { getBmData } from '@/lib/rapor/bm/getBmData';

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
    .select('kullanici_id, ad, soyad, rol, bolge_id, takim_id, firma_id')
    .eq('eposta', user.email)
    .single();

  if (kullaniciError || !kullanici) {
    return hataYaniti('Kullanıcı bulunamadı', 'kullanici_bulamadi', kullaniciError);
  }

  const rol = (kullanici.rol ?? '').toLowerCase();
  if (rol !== 'bm') return yetkiHatasi('Bu rapora erişim yetkiniz yok');

  // UTT listesi — periyot filtreli RPC
  const { data: uttRpcData, error: uttRpcError } = await adminSupabase.rpc('get_analiz_utt', {
    p_baslangic: baslangic,
    p_bitis: bitis,
    p_bolge_id: kullanici.bolge_id,
    p_kullanici_id: null,
  });

  if (uttRpcError) return hataYaniti('UTT verisi çekilemedi.', 'get_analiz_utt RPC', uttRpcError);

  const uttListesi: UttItem[] = [];
  const uttResponseListesi: any[] = [];

  let sira = 0;
  for (const u of (uttRpcData ?? []).sort((a: any, b: any) =>
    ((b.kazanilan_izleme_puani || 0) + (b.kazanilan_cevaplama_puani || 0) + (b.kazanilan_oneri_puani || 0) + (b.kazanilan_extra_puani || 0)) -
    ((a.kazanilan_izleme_puani || 0) + (a.kazanilan_cevaplama_puani || 0) + (a.kazanilan_oneri_puani || 0) + (a.kazanilan_extra_puani || 0))
  )) {
    sira++;
    const item: UttItem = {
      kullanici_id: u.kullanici_id,
      ad: u.ad,
      soyad: u.soyad,
      toplam_puan: (u.kazanilan_izleme_puani || 0) + (u.kazanilan_cevaplama_puani || 0) + (u.kazanilan_oneri_puani || 0) + (u.kazanilan_extra_puani || 0),
      video_puani: u.kazanilan_izleme_puani || 0,
      soru_puani: u.kazanilan_cevaplama_puani || 0,
      oneri_puani: u.kazanilan_oneri_puani || 0,
      extra_puan: u.kazanilan_extra_puani || 0,
      ileri_sarma_kaybi: u.kaybedilen_ileri_sarma_puani || 0,
      yanlis_cevap_kaybi: u.kaybedilen_yanlis_cevap_puani || 0,
      oneri_kaybi: 0,
      tamamlanan_izleme: u.izlenen_video_sayisi || 0,
      alinan_oneri: u.oneri_sayisi || 0,
      tamamlanan_oneri: u.oneri_sayisi - (u.izlenmeyen_oneri_sayisi || 0),
      bekleyen_oneri: u.izlenmeyen_oneri_sayisi || 0,
    };
    uttListesi.push(item);
    uttResponseListesi.push({
      sira,
      kullanici_id: item.kullanici_id,
      ad: item.ad,
      soyad: item.soyad,
      puan: item.toplam_puan,
      video_puani: item.video_puani,
      soru_puani: item.soru_puani,
      oneri_puani: item.oneri_puani,
      extra_puan: item.extra_puan,
      kayiplar: Math.abs(item.ileri_sarma_kaybi) + Math.abs(item.yanlis_cevap_kaybi) + Math.abs(item.oneri_kaybi),
      tamamlanan_izleme: item.tamamlanan_izleme,
      bekleyen_oneri: item.bekleyen_oneri,
      ortalama_mi: false,
    });
  }

  // Aggregation
  const agg = aggregateUtt(uttListesi);

  const uttSayisi = uttListesi.length;
  const ortalamaPuan = uttSayisi > 0 ? Math.round(agg.toplamPuan / uttSayisi) : 0;
  const hicIzlemeyenUtt = uttSayisi - agg.aktifUtt;
  const tamamlanmaOrani = agg.toplamOneri > 0 ? Math.round((agg.tamamlananOneri / agg.toplamOneri) * 100) : 0;

  // DB sorguları
  const { hata, bolge, takim, toplamYayin, takimToplamPuan, sirketToplamPuan, bolgeListesi, urunIzleme, begeniRaw, favoriRaw } = await getBmData(adminSupabase, kullanici);
  if (hata) return hata;

  // Katkı hesabı
  const takimKatki = takimToplamPuan > 0 ? parseFloat(((agg.toplamPuan / takimToplamPuan) * 100).toFixed(1)) : 0;
  const sirketKatki = sirketToplamPuan > 0 ? parseFloat(((agg.toplamPuan / sirketToplamPuan) * 100).toFixed(1)) : 0;

  // İzlenme hesabı
  const toplamIzlenmePotansiyeli = toplamYayin * uttSayisi;
  const izlenmeOrani = toplamIzlenmePotansiyeli > 0 ? Math.round((agg.toplamIzlenme / toplamIzlenmePotansiyeli) * 100) : 0;
  const kalanIzlenme = Math.max(0, toplamIzlenmePotansiyeli - agg.toplamIzlenme);

  // Bölge sıralaması
  const bolgeSiralamasi = bolgeListesi.map((b: any, idx: number) => ({
    sira: idx + 1,
    bolge_adi: b.bolge_adi,
    puan: b.toplam_puan || 0,
    kendisi_mi: b.bolge_id === kullanici.bolge_id,
  }));

  const kendiSira = bolgeSiralamasi.find((b: any) => b.kendisi_mi)?.sira || null;
  const kendiPuan = agg.toplamPuan;

  let birUstPuanFarki: number | null = null;
  let takipciFarki: number | null = null;

  if (kendiSira && kendiSira > 1) {
    const ust = bolgeListesi?.[kendiSira - 2];
    birUstPuanFarki = ust ? (ust.toplam_puan || 0) - kendiPuan : null;
  }
  if (kendiSira && kendiSira < bolgeListesi.length) {
    const alt = bolgeListesi?.[kendiSira];
    takipciFarki = alt ? kendiPuan - (alt.toplam_puan || 0) : null;
  }

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
        bolge_adi: bolge?.bolge_adi || '-',
        takim_adi: takim?.takim_adi || '-',
      },
      katki: {
        takim_katki_yuzdesi: takimKatki,
        sirket_katki_yuzdesi: sirketKatki,
        bolge_toplam_puan: agg.toplamPuan,
        takim_toplam_puan: takimToplamPuan,
        sirket_toplam_puan: sirketToplamPuan,
      },
      bolge_ozet: {
        toplam_utt: uttSayisi,
        aktif_utt: agg.aktifUtt,
        hic_izlemeyen_utt: hicIzlemeyenUtt,
        toplam_puan: agg.toplamPuan,
        ortalama_puan: ortalamaPuan,
        en_yuksek_puan: agg.enYuksek,
        izlenme_orani: izlenmeOrani,
        toplam_izlenme: agg.toplamIzlenme,
        kalan_izlenme: kalanIzlenme,
        toplam_yayin: toplamYayin,
      },
      lig: {
        bolge_sirasi: kendiSira,
        toplam_bolge_sayisi: bolgeListesi.length,
        bir_ust_puan_farki: birUstPuanFarki,
        takipci_farki: takipciFarki,
        bolge_siralamasi: bolgeSiralamasi,
      },
      oneri_etkinligi: {
        gonderilen: agg.toplamOneri,
        tamamlanan: agg.tamamlananOneri,
        tamamlanma_orani: tamamlanmaOrani,
        bekleyen: agg.bekleyenOneri,
        bekleyen_oneri_olan_utt_sayisi: agg.bekleyenOnerisiOlanUtt,
      },
      utt_listesi: uttResponseListesi,
      ortalama_utt: {
        puan: ortalamaPuan,
        video_puani: uttSayisi > 0 ? Math.round(agg.video_puani / uttSayisi) : 0,
        soru_puani: uttSayisi > 0 ? Math.round(agg.soru_puani / uttSayisi) : 0,
        oneri_puani: uttSayisi > 0 ? Math.round(agg.oneri_puani / uttSayisi) : 0,
        extra_puan: uttSayisi > 0 ? Math.round(agg.extra_puan / uttSayisi) : 0,
        kayiplar: uttSayisi > 0 ? Math.round(agg.kayiplar / uttSayisi) : 0,
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