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

  if (!['pm', 'jr_pm', 'kd_pm'].includes(kullanici.rol)) {
    return yetkiHatasi('Bu rapora erişim yetkiniz yok');
  }

  // 1. Takım adı
  const { data: takim } = await supabase
    .from('takimlar')
    .select('takim_adi')
    .eq('takim_id', kullanici.takim_id)
    .maybeSingle();

  // 2. Üretim raporu (periyot bağımsız — tüm zamanlar)
  const { data: uretimRapor } = await supabase
    .from('v_rapor_pm_uretim')
    .select('toplam_talep, yayindaki_talep, durdurulan_talep, senaryo_bekleyen, video_bekleyen, soru_seti_bekleyen, senaryo_revizyon, video_revizyon, soru_seti_revizyon, ortalama_talep_yayin_suresi')
    .eq('pm_id', kullanici.kullanici_id)
    .maybeSingle();

  const toplamTalep = uretimRapor?.toplam_talep || 0;
  const yayinda = uretimRapor?.yayindaki_talep || 0;
  const durdurulan = uretimRapor?.durdurulan_talep || 0;
  const devamEden = Math.max(0, toplamTalep - yayinda - durdurulan);

  // 3. Takımdaki UTT'lerin puan ve izleme verileri
  const { data: uttListesi } = await supabase
    .from('v_rapor_utt')
    .select('kullanici_id, ad, soyad, tamamlanan_izleme, toplam_puan, ileri_sarma_kaybi, yanlis_cevap_kaybi, oneri_kaybi')
    .eq('takim_id', kullanici.takim_id)
    .order('toplam_puan', { ascending: false });

  // 4. Yayındaki video sayısı
  const { data: yayinlar } = await supabase
    .from('yayin_yonetimi')
    .select('yayin_id')
    .eq('durum', 'yayinda');

  const toplamYayin = yayinlar?.length || 0;
  const uttSayisi = uttListesi?.length || 0;

  // 5. UTT izleme durumu
  const uttIzlemeDurumu = (uttListesi || []).map(u => ({
    kullanici_id: u.kullanici_id,
    ad: u.ad,
    soyad: u.soyad,
    izlenen: u.tamamlanan_izleme || 0,
    toplam: toplamYayin,
    kalan: Math.max(0, toplamYayin - (u.tamamlanan_izleme || 0)),
    puan: u.toplam_puan || 0,
    durum: (u.tamamlanan_izleme || 0) === 0
      ? 'Hiç izlememiş'
      : (u.tamamlanan_izleme || 0) >= toplamYayin
        ? 'Tamamlandı'
        : 'Devam Ediyor',
  }));

  const hicIzlemeyenUtt = uttIzlemeDurumu.filter(u => u.izlenen === 0).length;

  // 6. Takım puan istatistikleri
  const takimToplamPuan = (uttListesi || []).reduce((s, u) => s + (u.toplam_puan || 0), 0);
  const ortalamaPuan = uttSayisi > 0 ? Math.round(takimToplamPuan / uttSayisi) : 0;
  const enYuksekPuan = uttSayisi > 0 ? Math.max(...(uttListesi || []).map(u => u.toplam_puan || 0)) : 0;

  // 7. İzlenme istatistikleri
  const toplamIzlenme = (uttListesi || []).reduce((s, u) => s + (u.tamamlanan_izleme || 0), 0);
  const toplamIzlenmePotansiyeli = toplamYayin * uttSayisi;
  const izlenmeOrani = toplamIzlenmePotansiyeli > 0 ? Math.round((toplamIzlenme / toplamIzlenmePotansiyeli) * 100) : 0;
  const kalanIzlenme = Math.max(0, toplamIzlenmePotansiyeli - toplamIzlenme);

  // 8. Kayıp özeti
  const toplamIleriSarmaKaybi = (uttListesi || []).reduce((s, u) => s + (u.ileri_sarma_kaybi || 0), 0);
  const toplamYanlisCevapKaybi = (uttListesi || []).reduce((s, u) => s + (u.yanlis_cevap_kaybi || 0), 0);
  const toplamOneriKaybi = (uttListesi || []).reduce((s, u) => s + (u.oneri_kaybi || 0), 0);

  // 9. Ürün & teknik dağılımı (v_rapor_urun_izlenme — takım geneli)
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
      },
      uretim_hatti: {
        toplam_talep: toplamTalep,
        yayinda,
        devam_eden: devamEden,
        iptal_durdurulan: durdurulan,
      },
      bekleyen_asamalar: {
        senaryo_onayi: uretimRapor?.senaryo_bekleyen || 0,
        video_onayi: uretimRapor?.video_bekleyen || 0,
        soru_seti_onayi: uretimRapor?.soru_seti_bekleyen || 0,
      },
      revizyon_oranlari: {
        senaryo_revizyon: uretimRapor?.senaryo_revizyon || 0,
        senaryo_yuzde: toplamTalep > 0 ? Math.round(((uretimRapor?.senaryo_revizyon || 0) / toplamTalep) * 100) : 0,
        video_revizyon: uretimRapor?.video_revizyon || 0,
        video_yuzde: toplamTalep > 0 ? Math.round(((uretimRapor?.video_revizyon || 0) / toplamTalep) * 100) : 0,
        soru_seti_revizyon: uretimRapor?.soru_seti_revizyon || 0,
        soru_seti_yuzde: toplamTalep > 0 ? Math.round(((uretimRapor?.soru_seti_revizyon || 0) / toplamTalep) * 100) : 0,
        ortalama_talep_yayin_suresi: uretimRapor?.ortalama_talep_yayin_suresi || 0,
      },
      yayin_performansi: {
        toplam_izlenme: toplamIzlenme,
        kalan_izlenme: kalanIzlenme,
        izlenme_orani: izlenmeOrani,
        toplam_yayin: toplamYayin,
        toplam_utt: uttSayisi,
      },
      takim_puan_ozet: {
        takim_toplam_puan: takimToplamPuan,
        ortalama_puan_utt: ortalamaPuan,
        en_yuksek_puan: enYuksekPuan,
        hic_izlemeyen_utt: hicIzlemeyenUtt,
      },
      utt_izleme_durumu: uttIzlemeDurumu,
      urun_bazli_dagilim: Object.entries(urunSayilari)
        .map(([urun_adi, izlenme_sayisi]) => ({ urun_adi, izlenme_sayisi }))
        .sort((a, b) => b.izlenme_sayisi - a.izlenme_sayisi),
      teknik_bazli_dagilim: Object.entries(teknikSayilari)
        .map(([teknik_adi, izlenme_sayisi]) => ({ teknik_adi, izlenme_sayisi }))
        .sort((a, b) => b.izlenme_sayisi - a.izlenme_sayisi),
      kayip_ozeti: {
        ileri_sarma_kaybi: toplamIleriSarmaKaybi,
        yanlis_cevap_kaybi: toplamYanlisCevapKaybi,
        oneri_kaybi: toplamOneriKaybi,
      },
      begeni_listesi: begeniListesi,
      favori_listesi: favoriListesi,
    },
  });
}