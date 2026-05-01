// app/raporlar/api/tm/route.ts
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { hataYaniti, yetkiHatasi } from '@/lib/utils/hataIsle';
import { tarihAraligi } from '@/lib/utils/tarihAraligi';

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

  if (kullanici.rol !== 'tm') return yetkiHatasi('Bu rapora erişim yetkiniz yok');

  // 1. Takım ve firma adı
  const { data: takim } = await adminSupabase
    .from('takimlar')
    .select('takim_adi')
    .eq('takim_id', kullanici.takim_id)
    .maybeSingle();

  const { data: firma } = await adminSupabase
    .from('firmalar')
    .select('firma_adi')
    .eq('firma_id', kullanici.firma_id)
    .maybeSingle();

  // 2. Bölge listesi — periyot filtreli RPC
  const { data: bolgeRpcData, error: bolgeRpcError } = await adminSupabase.rpc('get_analiz_bolge', {
    p_baslangic: baslangic,
    p_bitis: bitis,
    p_firma_id: null,
    p_takim_id: kullanici.takim_id,
    p_bolge_id: null,
  });

  if (bolgeRpcError) return hataYaniti('Bölge verisi çekilemedi.', 'get_analiz_bolge RPC', bolgeRpcError);

  const bolgeListesi = (bolgeRpcData ?? []).map((b: any) => ({
    bolge_id: b.bolge_id,
    bolge_adi: b.bolge_adi,
    toplam_puan: (b.kazanilan_izleme_puani || 0) + (b.kazanilan_cevaplama_puani || 0) + (b.kazanilan_oneri_puani || 0) + (b.kazanilan_extra_puani || 0),
    video_puani: b.kazanilan_izleme_puani || 0,
    soru_puani: b.kazanilan_cevaplama_puani || 0,
    oneri_puani: b.kazanilan_oneri_puani || 0,
    extra_puan: b.kazanilan_extra_puani || 0,
    ileri_sarma_kaybi: b.kaybedilen_ileri_sarma_puani || 0,
    yanlis_cevap_kaybi: b.kaybedilen_yanlis_cevap_puani || 0,
    oneri_kaybi: 0,
    toplam_utt: b.utt_sayisi || 0,
    aktif_utt: b.izlenen_video_sayisi > 0 ? b.utt_sayisi : 0,
    hic_izlememis_utt: b.izlenen_video_sayisi === 0 ? b.utt_sayisi : 0,
    toplam_izleme: b.izlenen_video_sayisi || 0,
    toplam_oneri: b.oneri_sayisi || 0,
    tamamlanan_oneri: (b.oneri_sayisi || 0) - (b.izlenmeyen_oneri_sayisi || 0),
    bekleyen_oneri: b.izlenmeyen_oneri_sayisi || 0,
  })).sort((a: any, b: any) => b.toplam_puan - a.toplam_puan);

  // 3. BM bilgilerini çek
  const bolgeIdleri = bolgeListesi.map((b: any) => b.bolge_id);
  const { data: bmListesi } = await adminSupabase
    .from('kullanicilar')
    .select('bolge_id, ad, soyad')
    .in('bolge_id', bolgeIdleri)
    .eq('rol', 'bm');

  const bmMap: Record<string, string> = {};
  for (const bm of bmListesi || []) {
    bmMap[bm.bolge_id] = `${bm.ad} ${bm.soyad}`;
  }

  // 4. Takım puan hesapları
  const toplamPuan = bolgeListesi.reduce((s: number, b: any) => s + b.toplam_puan, 0);
  const bolgeSayisi = bolgeListesi.length;
  const ortalamaPuanBolge = bolgeSayisi > 0 ? Math.round(toplamPuan / bolgeSayisi) : 0;
  const enYuksekPuan = bolgeSayisi > 0 ? Math.max(...bolgeListesi.map((b: any) => b.toplam_puan)) : 0;

  // 5. UTT istatistikleri
  const toplamUtt = bolgeListesi.reduce((s: number, b: any) => s + b.toplam_utt, 0);
  const aktifUtt = bolgeListesi.reduce((s: number, b: any) => s + b.aktif_utt, 0);
  const hicIzlemeyenUtt = bolgeListesi.reduce((s: number, b: any) => s + b.hic_izlememis_utt, 0);

  // 6. Yayın sayısı — periyot bağımsız, anlık durum
  const { data: yayinlar } = await adminSupabase
    .from('yayin_yonetimi')
    .select('yayin_id')
    .eq('durum', 'yayinda');

  const toplamYayin = yayinlar?.length || 0;
  const toplamIzlenme = bolgeListesi.reduce((s: number, b: any) => s + b.toplam_izleme, 0);
  const toplamIzlenmePotansiyeli = toplamYayin * toplamUtt;
  const izlenmeOrani = toplamIzlenmePotansiyeli > 0 ? Math.round((toplamIzlenme / toplamIzlenmePotansiyeli) * 100) : 0;
  const kalanIzlenme = Math.max(0, toplamIzlenmePotansiyeli - toplamIzlenme);

  // 7. Öneri istatistikleri
  const toplamOneri = bolgeListesi.reduce((s: number, b: any) => s + b.toplam_oneri, 0);
  const tamamlananOneri = bolgeListesi.reduce((s: number, b: any) => s + b.tamamlanan_oneri, 0);
  const bekleyenOneri = toplamOneri - tamamlananOneri;
  const tamamlanmaOrani = toplamOneri > 0 ? Math.round((tamamlananOneri / toplamOneri) * 100) : 0;

  // 8. Şirkete katkı — periyot bağımsız
  const { data: sirketRapor } = await adminSupabase
    .from('v_rapor_sirket')
    .select('toplam_puan')
    .eq('firma_id', kullanici.firma_id)
    .maybeSingle();

  const sirketToplamPuan = sirketRapor?.toplam_puan || 0;
  const sirketKatki = sirketToplamPuan > 0 ? parseFloat(((toplamPuan / sirketToplamPuan) * 100).toFixed(1)) : 0;

  // 9. Firma sıralaması — periyot bağımsız
  const { data: takimListesi } = await adminSupabase
    .from('v_rapor_takim')
    .select('takim_id, toplam_puan')
    .eq('firma_id', kullanici.firma_id)
    .order('toplam_puan', { ascending: false });

  const takimIdleri = (takimListesi || []).map(t => t.takim_id);
  const { data: takimAdlari } = await adminSupabase
    .from('takimlar')
    .select('takim_id, takim_adi')
    .in('takim_id', takimIdleri);

  const takimAdMap: Record<string, string> = {};
  for (const t of takimAdlari || []) takimAdMap[t.takim_id] = t.takim_adi;

  const firmaSiralamasi = (takimListesi || []).map((t, idx) => ({
    sira: idx + 1,
    takim_adi: takimAdMap[t.takim_id] || '-',
    puan: t.toplam_puan || 0,
    kendisi_mi: t.takim_id === kullanici.takim_id,
  }));

  const kendiSira = firmaSiralamasi.find(t => t.kendisi_mi)?.sira || null;

  let birUstPuanFarki: number | null = null;
  let takipciFarki: number | null = null;

  if (kendiSira && kendiSira > 1) {
    birUstPuanFarki = (takimListesi![kendiSira - 2].toplam_puan || 0) - toplamPuan;
  }
  if (kendiSira && kendiSira < (takimListesi?.length || 0)) {
    takipciFarki = toplamPuan - (takimListesi![kendiSira].toplam_puan || 0);
  }

  // 10. Ürün & teknik dağılımı — periyot bağımsız
  const { data: urunIzleme } = await adminSupabase
    .from('v_rapor_urun_izlenme')
    .select('urun_adi, teknik_adi, izlenme_sayisi')
    .eq('utt_takim_id', kullanici.takim_id);

  const urunSayilari: Record<string, number> = {};
  const teknikSayilari: Record<string, number> = {};

  for (const item of urunIzleme || []) {
    if (item.urun_adi) urunSayilari[item.urun_adi] = (urunSayilari[item.urun_adi] || 0) + (item.izlenme_sayisi || 1);
    if (item.teknik_adi) teknikSayilari[item.teknik_adi] = (teknikSayilari[item.teknik_adi] || 0) + (item.izlenme_sayisi || 1);
  }

  // 11. Beğeni/favori listesi — periyot bağımsız
  const { data: begeniRaw } = await adminSupabase
    .from('v_rapor_begeni_favori')
    .select('yayin_id, urun_adi, teknik_adi, begeni_sayisi')
    .eq('takim_id', kullanici.takim_id)
    .order('begeni_sayisi', { ascending: false })
    .limit(5);

  const { data: favoriRaw } = await adminSupabase
    .from('v_rapor_begeni_favori')
    .select('yayin_id, urun_adi, teknik_adi, favori_sayisi')
    .eq('takim_id', kullanici.takim_id)
    .order('favori_sayisi', { ascending: false })
    .limit(5);

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
        takim_toplam_puan: toplamPuan,
        sirket_toplam_puan: sirketToplamPuan,
      },
      takim_ozet: {
        toplam_bolge: bolgeSayisi,
        toplam_utt: toplamUtt,
        aktif_utt: aktifUtt,
        hic_izlemeyen_utt: hicIzlemeyenUtt,
        toplam_puan: toplamPuan,
        ortalama_puan_bolge: ortalamaPuanBolge,
        en_yuksek_puan: enYuksekPuan,
        izlenme_orani: izlenmeOrani,
        toplam_izlenme: toplamIzlenme,
        kalan_izlenme: kalanIzlenme,
        toplam_yayin: toplamYayin,
      },
      lig: {
        takim_sirasi: kendiSira,
        toplam_takim_sayisi: takimListesi?.length || 0,
        bir_ust_puan_farki: birUstPuanFarki,
        takipci_farki: takipciFarki,
        firma_siralamasi: firmaSiralamasi,
      },
      oneri_etkinligi: {
        gonderilen: toplamOneri,
        tamamlanan: tamamlananOneri,
        tamamlanma_orani: tamamlanmaOrani,
        bekleyen: bekleyenOneri,
      },
      bolge_listesi: bolgeListesi.map((b: any, idx: number) => ({
        sira: idx + 1,
        bolge_id: b.bolge_id,
        bolge_adi: b.bolge_adi,
        bm: bmMap[b.bolge_id] || '-',
        puan: b.toplam_puan,
        katki_yuzdesi: toplamPuan > 0 ? parseFloat((b.toplam_puan / toplamPuan * 100).toFixed(1)) : 0,
        video_puani: b.video_puani,
        soru_puani: b.soru_puani,
        oneri_puani: b.oneri_puani,
        extra_puan: b.extra_puan,
        kayiplar: Math.abs(b.ileri_sarma_kaybi) + Math.abs(b.yanlis_cevap_kaybi) + Math.abs(b.oneri_kaybi),
        bekleyen_oneri: b.bekleyen_oneri,
      })),
      ortalama_bolge: {
        puan: ortalamaPuanBolge,
        video_puani: bolgeSayisi > 0 ? Math.round(bolgeListesi.reduce((s: number, b: any) => s + b.video_puani, 0) / bolgeSayisi) : 0,
        soru_puani: bolgeSayisi > 0 ? Math.round(bolgeListesi.reduce((s: number, b: any) => s + b.soru_puani, 0) / bolgeSayisi) : 0,
        oneri_puani: bolgeSayisi > 0 ? Math.round(bolgeListesi.reduce((s: number, b: any) => s + b.oneri_puani, 0) / bolgeSayisi) : 0,
        extra_puan: bolgeSayisi > 0 ? Math.round(bolgeListesi.reduce((s: number, b: any) => s + b.extra_puan, 0) / bolgeSayisi) : 0,
        kayiplar: bolgeSayisi > 0 ? Math.round(bolgeListesi.reduce((s: number, b: any) => s + Math.abs(b.ileri_sarma_kaybi) + Math.abs(b.yanlis_cevap_kaybi) + Math.abs(b.oneri_kaybi), 0) / bolgeSayisi) : 0,
      },
      urun_bazli_dagilim: Object.entries(urunSayilari)
        .map(([urun_adi, izlenme_sayisi]) => ({ urun_adi, izlenme_sayisi }))
        .sort((a, b) => b.izlenme_sayisi - a.izlenme_sayisi),
      teknik_bazli_dagilim: Object.entries(teknikSayilari)
        .map(([teknik_adi, izlenme_sayisi]) => ({ teknik_adi, izlenme_sayisi }))
        .sort((a, b) => b.izlenme_sayisi - a.izlenme_sayisi),
      begeni_listesi: begeniRaw ?? [],
      favori_listesi: favoriRaw ?? [],
    },
  });
}