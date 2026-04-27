import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { hataYaniti, yetkiHatasi } from '@/lib/utils/hataIsle';

function tarihAraligi(periyot: string): { baslangic: string; bitis: string } {
  const simdi = new Date();
  const bitis = simdi.toISOString();

  if (periyot === 'bu_hafta') {
    const gun = simdi.getDay();
    const fark = gun === 0 ? 6 : gun - 1;
    const pazartesi = new Date(simdi);
    pazartesi.setDate(simdi.getDate() - fark);
    pazartesi.setHours(0, 0, 0, 0);
    return { baslangic: pazartesi.toISOString(), bitis };
  }

  if (periyot === 'gecen_ay') {
    const baslangic = new Date(simdi.getFullYear(), simdi.getMonth() - 1, 1);
    const bitis2 = new Date(simdi.getFullYear(), simdi.getMonth(), 0, 23, 59, 59);
    return { baslangic: baslangic.toISOString(), bitis: bitis2.toISOString() };
  }

  const baslangic = new Date(simdi.getFullYear(), simdi.getMonth(), 1);
  return { baslangic: baslangic.toISOString(), bitis };
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const periyot = searchParams.get('periyot') || 'bu_ay';
  const { baslangic, bitis } = tarihAraligi(periyot);

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return yetkiHatasi('Oturum açılmamış');

  const { data: kullanici, error: kullaniciError } = await supabase
    .from('kullanicilar')
    .select('kullanici_id, ad, soyad, rol, takim_id, firma_id')
    .eq('eposta', user.email)
    .single();

  if (kullaniciError || !kullanici) {
    return hataYaniti('Kullanıcı bulunamadı', 'kullanici_bulamadi', kullaniciError);
  }

  if (kullanici.rol !== 'tm') return yetkiHatasi('Bu rapora erişim yetkiniz yok');

  // 1. Takım ve firma adı
  const { data: takim } = await supabase
    .from('takimlar')
    .select('takim_adi')
    .eq('takim_id', kullanici.takim_id)
    .maybeSingle();

  const { data: firma } = await supabase
    .from('firmalar')
    .select('firma_adi')
    .eq('firma_id', kullanici.firma_id)
    .maybeSingle();

  // 2. Bölge listesi (v_rapor_bolge)
  const { data: bolgeListesi } = await supabase
    .from('v_rapor_bolge')
    .select('bolge_id, bolge_adi, toplam_puan, video_puani, soru_puani, oneri_puani, extra_puan, ileri_sarma_kaybi, yanlis_cevap_kaybi, oneri_kaybi, toplam_utt, aktif_utt, hic_izlememis_utt, toplam_izleme, toplam_oneri, tamamlanan_oneri, bekleyen_oneri')
    .eq('takim_id', kullanici.takim_id)
    .order('toplam_puan', { ascending: false });

  // 3. BM bilgilerini tek sorguda çek
  const bolgeIdleri = (bolgeListesi || []).map(b => b.bolge_id);
  const { data: bmListesi } = await supabase
    .from('kullanicilar')
    .select('bolge_id, ad, soyad')
    .in('bolge_id', bolgeIdleri)
    .eq('rol', 'bm');

  const bmMap: Record<string, string> = {};
  for (const bm of bmListesi || []) {
    bmMap[bm.bolge_id] = `${bm.ad} ${bm.soyad}`;
  }

  // 4. Takım puan hesapları
  const toplamPuan = (bolgeListesi || []).reduce((s, b) => s + (b.toplam_puan || 0), 0);
  const bolgeSayisi = bolgeListesi?.length || 0;
  const ortalamaPuanBolge = bolgeSayisi > 0 ? Math.round(toplamPuan / bolgeSayisi) : 0;
  const enYuksekPuan = bolgeSayisi > 0 ? Math.max(...(bolgeListesi || []).map(b => b.toplam_puan || 0)) : 0;

  // 5. UTT istatistikleri
  const toplamUtt = (bolgeListesi || []).reduce((s, b) => s + (b.toplam_utt || 0), 0);
  const aktifUtt = (bolgeListesi || []).reduce((s, b) => s + (b.aktif_utt || 0), 0);
  const hicIzlemeyenUtt = (bolgeListesi || []).reduce((s, b) => s + (b.hic_izlememis_utt || 0), 0);

  // 6. İzlenme
  const { data: yayinlar } = await supabase
    .from('yayin_yonetimi')
    .select('yayin_id')
    .eq('durum', 'yayinda');

  const toplamYayin = yayinlar?.length || 0;
  const toplamIzlenme = (bolgeListesi || []).reduce((s, b) => s + (b.toplam_izleme || 0), 0);
  const toplamIzlenmePotansiyeli = toplamYayin * toplamUtt;
  const izlenmeOrani = toplamIzlenmePotansiyeli > 0 ? Math.round((toplamIzlenme / toplamIzlenmePotansiyeli) * 100) : 0;
  const kalanIzlenme = Math.max(0, toplamIzlenmePotansiyeli - toplamIzlenme);

  // 7. Öneri istatistikleri
  const toplamOneri = (bolgeListesi || []).reduce((s, b) => s + (b.toplam_oneri || 0), 0);
  const tamamlananOneri = (bolgeListesi || []).reduce((s, b) => s + (b.tamamlanan_oneri || 0), 0);
  const bekleyenOneri = toplamOneri - tamamlananOneri;
  const tamamlanmaOrani = toplamOneri > 0 ? Math.round((tamamlananOneri / toplamOneri) * 100) : 0;

  // 8. Şirkete katkı
  const { data: sirketRapor } = await supabase
    .from('v_rapor_sirket')
    .select('toplam_puan')
    .eq('firma_id', kullanici.firma_id)
    .maybeSingle();

  const sirketToplamPuan = sirketRapor?.toplam_puan || 0;
  const sirketKatki = sirketToplamPuan > 0 ? parseFloat(((toplamPuan / sirketToplamPuan) * 100).toFixed(1)) : 0;

  // 9. Takım lig sıralaması (firma içindeki takımlar — v_rapor_takim)
  const { data: takimListesi } = await supabase
    .from('v_rapor_takim')
    .select('takim_id, toplam_puan')
    .eq('firma_id', kullanici.firma_id)
    .order('toplam_puan', { ascending: false });

  // Takım adlarını çek
  const takimIdleri = (takimListesi || []).map(t => t.takim_id);
  const { data: takimAdlari } = await supabase
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

  // 10. Ürün & teknik dağılımı (v_rapor_urun_izlenme)
  const { data: urunIzleme } = await supabase
    .from('v_rapor_urun_izlenme')
    .select('urun_adi, teknik_adi, izlenme_sayisi')
    .eq('utt_takim_id', kullanici.takim_id);

  const urunSayilari: Record<string, number> = {};
  const teknikSayilari: Record<string, number> = {};

  for (const item of urunIzleme || []) {
    if (item.urun_adi) urunSayilari[item.urun_adi] = (urunSayilari[item.urun_adi] || 0) + (item.izlenme_sayisi || 1);
    if (item.teknik_adi) teknikSayilari[item.teknik_adi] = (teknikSayilari[item.teknik_adi] || 0) + (item.izlenme_sayisi || 1);
  }


  // Beğeni/favori listesi
  const { data: begeniRaw } = await supabase
    .from('v_rapor_begeni_favori')
    .select('yayin_id, urun_adi, teknik_adi, begeni_sayisi')
    .eq('takim_id', kullanici.takim_id)
    .order('begeni_sayisi', { ascending: false })
    .limit(5);

  const { data: favoriRaw } = await supabase
    .from('v_rapor_begeni_favori')
    .select('yayin_id, urun_adi, teknik_adi, favori_sayisi')
    .eq('takim_id', kullanici.takim_id)
    .order('favori_sayisi', { ascending: false })
    .limit(5);

  const begeniListesi = begeniRaw ?? [];
  const favoriListesi = favoriRaw ?? [];

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
      bolge_listesi: (bolgeListesi || []).map((b, idx) => ({
        sira: idx + 1,
        bolge_id: b.bolge_id,
        bolge_adi: b.bolge_adi,
        bm: bmMap[b.bolge_id] || '-',
        puan: b.toplam_puan || 0,
        katki_yuzdesi: toplamPuan > 0 ? parseFloat(((b.toplam_puan || 0) / toplamPuan * 100).toFixed(1)) : 0,
        video_puani: b.video_puani || 0,
        soru_puani: b.soru_puani || 0,
        oneri_puani: b.oneri_puani || 0,
        extra_puan: b.extra_puan || 0,
        kayiplar: (b.ileri_sarma_kaybi || 0) + (b.yanlis_cevap_kaybi || 0) + (b.oneri_kaybi || 0),
        bekleyen_oneri: b.bekleyen_oneri || 0,
      })),
      ortalama_bolge: {
        puan: ortalamaPuanBolge,
        video_puani: bolgeSayisi > 0 ? Math.round((bolgeListesi || []).reduce((s, b) => s + (b.video_puani || 0), 0) / bolgeSayisi) : 0,
        soru_puani: bolgeSayisi > 0 ? Math.round((bolgeListesi || []).reduce((s, b) => s + (b.soru_puani || 0), 0) / bolgeSayisi) : 0,
        oneri_puani: bolgeSayisi > 0 ? Math.round((bolgeListesi || []).reduce((s, b) => s + (b.oneri_puani || 0), 0) / bolgeSayisi) : 0,
        extra_puan: bolgeSayisi > 0 ? Math.round((bolgeListesi || []).reduce((s, b) => s + (b.extra_puan || 0), 0) / bolgeSayisi) : 0,
        kayiplar: bolgeSayisi > 0 ? Math.round((bolgeListesi || []).reduce((s, b) => s + Math.abs((b.ileri_sarma_kaybi || 0) + (b.yanlis_cevap_kaybi || 0) + (b.oneri_kaybi || 0)), 0) / bolgeSayisi) : 0,
      },
      urun_bazli_dagilim: Object.entries(urunSayilari)
        .map(([urun_adi, izlenme_sayisi]) => ({ urun_adi, izlenme_sayisi }))
        .sort((a, b) => b.izlenme_sayisi - a.izlenme_sayisi),
      teknik_bazli_dagilim: Object.entries(teknikSayilari)
        .map(([teknik_adi, izlenme_sayisi]) => ({ teknik_adi, izlenme_sayisi }))
        .sort((a, b) => b.izlenme_sayisi - a.izlenme_sayisi),
      begeni_listesi: begeniListesi,
      favori_listesi: favoriListesi,
    },
  });
}