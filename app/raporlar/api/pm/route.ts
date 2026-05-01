// app/raporlar/api/pm/route.ts
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

  if (!['pm', 'jr_pm', 'kd_pm'].includes(kullanici.rol)) {
    return yetkiHatasi('Bu rapora erişim yetkiniz yok');
  }

  // 1. Takım adı
  const { data: takim } = await adminSupabase
    .from('takimlar')
    .select('takim_adi')
    .eq('takim_id', kullanici.takim_id)
    .maybeSingle();

  // 2. Üretim raporu — periyot bağımsız, tüm zamanlar
  const { data: uretimRapor } = await adminSupabase
    .from('v_rapor_pm_uretim')
    .select('toplam_talep, yayindaki_talep, durdurulan_talep, senaryo_bekleyen, video_bekleyen, soru_seti_bekleyen, senaryo_revizyon, video_revizyon, soru_seti_revizyon, ortalama_talep_yayin_suresi')
    .eq('pm_id', kullanici.kullanici_id)
    .maybeSingle();

  const toplamTalep = uretimRapor?.toplam_talep || 0;
  const yayinda = uretimRapor?.yayindaki_talep || 0;
  const durdurulan = uretimRapor?.durdurulan_talep || 0;
  const devamEden = Math.max(0, toplamTalep - yayinda - durdurulan);

  // 3. Takımdaki UTT'lerin puan ve izleme verileri — periyot filtreli RPC
  const { data: uttRpcData, error: uttRpcError } = await adminSupabase.rpc('get_analiz_utt', {
    p_baslangic: baslangic,
    p_bitis: bitis,
    p_bolge_id: null,
    p_kullanici_id: null,
  });

  if (uttRpcError) return hataYaniti('UTT verisi çekilemedi.', 'get_analiz_utt RPC', uttRpcError);

  const uttListesi = (uttRpcData ?? []).filter((u: any) => u.takim_id === kullanici.takim_id);

  // 4. Yayındaki video sayısı — periyot bağımsız, anlık durum
  const { data: yayinlar } = await adminSupabase
    .from('yayin_yonetimi')
    .select('yayin_id')
    .eq('durum', 'yayinda');

  const toplamYayin = yayinlar?.length || 0;
  const uttSayisi = uttListesi?.length || 0;

  // 5. UTT izleme durumu
  const uttIzlemeDurumu = (uttListesi || []).map((u: any) => ({
    kullanici_id: u.kullanici_id,
    ad: u.ad,
    soyad: u.soyad,
    izlenen: u.izlenen_video_sayisi || 0,
    toplam: toplamYayin,
    kalan: Math.max(0, toplamYayin - (u.izlenen_video_sayisi || 0)),
    puan: (u.kazanilan_izleme_puani || 0) + (u.kazanilan_cevaplama_puani || 0) + (u.kazanilan_oneri_puani || 0) + (u.kazanilan_extra_puani || 0),
    durum: (u.izlenen_video_sayisi || 0) === 0
      ? 'Hiç izlememiş'
      : (u.izlenen_video_sayisi || 0) >= toplamYayin
        ? 'Tamamlandı'
        : 'Devam Ediyor',
  }));

  const hicIzlemeyenUtt = uttIzlemeDurumu.filter((u: any) => u.izlenen === 0).length;

  // 6. Takım puan istatistikleri
  const takimToplamPuan = uttIzlemeDurumu.reduce((s: number, u: any) => s + (u.puan || 0), 0);
  const ortalamaPuan = uttSayisi > 0 ? Math.round(takimToplamPuan / uttSayisi) : 0;
  const enYuksekPuan = uttSayisi > 0 ? Math.max(...uttIzlemeDurumu.map((u: any) => u.puan || 0)) : 0;

  // 7. İzlenme istatistikleri
  const toplamIzlenme = uttIzlemeDurumu.reduce((s: number, u: any) => s + (u.izlenen || 0), 0);
  const toplamIzlenmePotansiyeli = toplamYayin * uttSayisi;
  const izlenmeOrani = toplamIzlenmePotansiyeli > 0 ? Math.round((toplamIzlenme / toplamIzlenmePotansiyeli) * 100) : 0;
  const kalanIzlenme = Math.max(0, toplamIzlenmePotansiyeli - toplamIzlenme);

  // 8. Kayıp özeti
  const toplamIleriSarmaKaybi = uttListesi.reduce((s: number, u: any) => s + (u.kaybedilen_ileri_sarma_puani || 0), 0);
  const toplamYanlisCevapKaybi = uttListesi.reduce((s: number, u: any) => s + (u.kaybedilen_yanlis_cevap_puani || 0), 0);
  const toplamOneriKaybi = uttListesi.reduce((s: number, u: any) => s + Math.abs(u.kazanilan_oneri_puani < 0 ? u.kazanilan_oneri_puani : 0), 0);

  // 9. Ürün & teknik dağılımı — periyot filtreli
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

  // 10. Beğeni/favori listesi — periyot bağımsız
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
      begeni_listesi: begeniRaw ?? [],
      favori_listesi: favoriRaw ?? [],
    },
  });
}