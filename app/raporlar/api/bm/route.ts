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
    .select('kullanici_id, ad, soyad, rol, bolge_id, takim_id, firma_id')
    .eq('eposta', user.email)
    .single();

  if (kullaniciError || !kullanici) {
    return hataYaniti('Kullanıcı bulunamadı', 'kullanici_bulamadi', kullaniciError);
  }

  if (kullanici.rol !== 'bm') return yetkiHatasi('Bu rapora erişim yetkiniz yok');

  // 1. Bölge ve takım adı
  const { data: bolge } = await supabase
    .from('bolgeler')
    .select('bolge_adi')
    .eq('bolge_id', kullanici.bolge_id)
    .maybeSingle();

  const { data: takim } = await supabase
    .from('takimlar')
    .select('takim_adi')
    .eq('takim_id', kullanici.takim_id)
    .maybeSingle();

  // 2. UTT listesi (bölgedeki tüm UTT'ler — v_rapor_utt periyot bağımsız genel özet)
  const { data: uttListesi } = await supabase
    .from('v_rapor_utt')
    .select('kullanici_id, ad, soyad, toplam_puan, video_puani, soru_puani, oneri_puani, extra_puan, ileri_sarma_kaybi, yanlis_cevap_kaybi, oneri_kaybi, tamamlanan_izleme, alinan_oneri, tamamlanan_oneri, bekleyen_oneri')
    .eq('bolge_id', kullanici.bolge_id)
    .order('toplam_puan', { ascending: false });

  const uttSayisi = uttListesi?.length || 0;
  const toplamPuan = (uttListesi || []).reduce((s, u) => s + (u.toplam_puan || 0), 0);
  const ortalamaPuan = uttSayisi > 0 ? Math.round(toplamPuan / uttSayisi) : 0;
  const enYuksekPuan = uttSayisi > 0 ? Math.max(...(uttListesi || []).map(u => u.toplam_puan || 0)) : 0;
  const aktifUtt = (uttListesi || []).filter(u => (u.tamamlanan_izleme || 0) > 0).length;
  const hicIzlemeyenUtt = uttSayisi - aktifUtt;

  // 3. Yayın sayısı
  const { data: yayinlar } = await supabase
    .from('yayin_yonetimi')
    .select('yayin_id')
    .eq('durum', 'yayinda');

  const toplamYayin = yayinlar?.length || 0;
  const toplamIzlenmePotansiyeli = toplamYayin * uttSayisi;
  const toplamIzlenme = (uttListesi || []).reduce((s, u) => s + (u.tamamlanan_izleme || 0), 0);
  const izlenmeOrani = toplamIzlenmePotansiyeli > 0 ? Math.round((toplamIzlenme / toplamIzlenmePotansiyeli) * 100) : 0;
  const kalanIzlenme = Math.max(0, toplamIzlenmePotansiyeli - toplamIzlenme);

  // 4. Öneri istatistikleri
  const toplamOneri = (uttListesi || []).reduce((s, u) => s + (u.alinan_oneri || 0), 0);
  const tamamlananOneri = (uttListesi || []).reduce((s, u) => s + (u.tamamlanan_oneri || 0), 0);
  const bekleyenOneri = toplamOneri - tamamlananOneri;
  const tamamlanmaOrani = toplamOneri > 0 ? Math.round((tamamlananOneri / toplamOneri) * 100) : 0;
  const bekleyenOnerisiOlanUtt = (uttListesi || []).filter(u => (u.bekleyen_oneri || 0) > 0).length;

  // 5. Takım katkısı ve şirket katkısı (v_rapor_bolge ve v_rapor_takim)
  const { data: takimRapor } = await supabase
    .from('v_rapor_takim')
    .select('toplam_puan')
    .eq('takim_id', kullanici.takim_id)
    .maybeSingle();

  const { data: sirketRapor } = await supabase
    .from('v_rapor_sirket')
    .select('toplam_puan')
    .eq('firma_id', kullanici.firma_id)
    .maybeSingle();

  const takimToplamPuan = takimRapor?.toplam_puan || 0;
  const sirketToplamPuan = sirketRapor?.toplam_puan || 0;
  const takimKatki = takimToplamPuan > 0 ? parseFloat(((toplamPuan / takimToplamPuan) * 100).toFixed(1)) : 0;
  const sirketKatki = sirketToplamPuan > 0 ? parseFloat(((toplamPuan / sirketToplamPuan) * 100).toFixed(1)) : 0;

  // 6. Bölge lig sıralaması (takım içindeki bölgeler — v_rapor_bolge)
  const { data: bolgeListesi } = await supabase
    .from('v_rapor_bolge')
    .select('bolge_id, bolge_adi, toplam_puan')
    .eq('takim_id', kullanici.takim_id)
    .order('toplam_puan', { ascending: false });

  const bolgeSiralamasi = (bolgeListesi || []).map((b, idx) => ({
    sira: idx + 1,
    bolge_adi: b.bolge_adi,
    puan: b.toplam_puan || 0,
    kendisi_mi: b.bolge_id === kullanici.bolge_id,
  }));

  const kendiSira = bolgeSiralamasi.find(b => b.kendisi_mi)?.sira || null;
  const kendiPuan = toplamPuan;

  let birUstPuanFarki: number | null = null;
  let takipciFarki: number | null = null;

  if (kendiSira && kendiSira > 1) {
    birUstPuanFarki = (bolgeListesi![kendiSira - 2].toplam_puan || 0) - kendiPuan;
  }
  if (kendiSira && kendiSira < (bolgeListesi?.length || 0)) {
    takipciFarki = kendiPuan - (bolgeListesi![kendiSira].toplam_puan || 0);
  }

  // 7. Ürün & teknik dağılımı (v_rapor_urun_izlenme — bölge geneli)
  const { data: urunIzleme } = await supabase
    .from('v_rapor_urun_izlenme')
    .select('urun_adi, teknik_adi, izlenme_sayisi')
    .eq('bolge_id', kullanici.bolge_id);

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
        bolge_adi: bolge?.bolge_adi || '-',
        takim_adi: takim?.takim_adi || '-',
      },
      katki: {
        takim_katki_yuzdesi: takimKatki,
        sirket_katki_yuzdesi: sirketKatki,
        bolge_toplam_puan: toplamPuan,
        takim_toplam_puan: takimToplamPuan,
        sirket_toplam_puan: sirketToplamPuan,
      },
      bolge_ozet: {
        toplam_utt: uttSayisi,
        aktif_utt: aktifUtt,
        hic_izlemeyen_utt: hicIzlemeyenUtt,
        toplam_puan: toplamPuan,
        ortalama_puan: ortalamaPuan,
        en_yuksek_puan: enYuksekPuan,
        izlenme_orani: izlenmeOrani,
        toplam_izlenme: toplamIzlenme,
        kalan_izlenme: kalanIzlenme,
        toplam_yayin: toplamYayin,
      },
      lig: {
        bolge_sirasi: kendiSira,
        toplam_bolge_sayisi: bolgeListesi?.length || 0,
        bir_ust_puan_farki: birUstPuanFarki,
        takipci_farki: takipciFarki,
        bolge_siralamasi: bolgeSiralamasi,
      },
      oneri_etkinligi: {
        gonderilen: toplamOneri,
        tamamlanan: tamamlananOneri,
        tamamlanma_orani: tamamlanmaOrani,
        bekleyen: bekleyenOneri,
        bekleyen_oneri_olan_utt_sayisi: bekleyenOnerisiOlanUtt,
      },
      utt_listesi: (uttListesi || []).map((u, idx) => ({
        sira: idx + 1,
        kullanici_id: u.kullanici_id,
        ad: u.ad,
        soyad: u.soyad,
        puan: u.toplam_puan || 0,
        video_puani: u.video_puani || 0,
        soru_puani: u.soru_puani || 0,
        oneri_puani: u.oneri_puani || 0,
        extra_puan: u.extra_puan || 0,
        kayiplar: (u.ileri_sarma_kaybi || 0) + (u.yanlis_cevap_kaybi || 0) + (u.oneri_kaybi || 0),
        tamamlanan_izleme: u.tamamlanan_izleme || 0,
        bekleyen_oneri: u.bekleyen_oneri || 0,
        ortalama_mi: false, // frontend'de ortalama satırı eklenecek
      })),
      ortalama_utt: {
        puan: ortalamaPuan,
        video_puani: uttSayisi > 0 ? Math.round((uttListesi || []).reduce((s, u) => s + (u.video_puani || 0), 0) / uttSayisi) : 0,
        soru_puani: uttSayisi > 0 ? Math.round((uttListesi || []).reduce((s, u) => s + (u.soru_puani || 0), 0) / uttSayisi) : 0,
        oneri_puani: uttSayisi > 0 ? Math.round((uttListesi || []).reduce((s, u) => s + (u.oneri_puani || 0), 0) / uttSayisi) : 0,
        extra_puan: uttSayisi > 0 ? Math.round((uttListesi || []).reduce((s, u) => s + (u.extra_puan || 0), 0) / uttSayisi) : 0,
        kayiplar: uttSayisi > 0 ? Math.round((uttListesi || []).reduce((s, u) => s + Math.abs((u.ileri_sarma_kaybi || 0) + (u.yanlis_cevap_kaybi || 0) + (u.oneri_kaybi || 0)), 0) / uttSayisi) : 0,
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