// app/raporlar/api/utt/route.ts
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
    .select('kullanici_id, ad, soyad, rol, bolge_id, takim_id, firma_id')
    .eq('eposta', user.email)
    .single();

  if (kullaniciError || !kullanici) {
    return hataYaniti('Kullanıcı bulunamadı', 'kullanici_bulamadi', kullaniciError);
  }

  if (!['utt', 'kd_utt'].includes(kullanici.rol)) {
    return yetkiHatasi('Bu rapora erişim yetkiniz yok');
  }

  // 1. Kişisel puan özeti — periyot filtreli
  const { data: puanlar } = await adminSupabase
    .from('kazanilan_puanlar')
    .select('puan, puan_turu, created_at')
    .eq('kullanici_id', kullanici.kullanici_id)
    .gte('created_at', baslangic)
    .lte('created_at', bitis);

  const istatistikler = {
    video_puani: 0,
    soru_puani: 0,
    oneri_puani: 0,
    extra_puan: 0,
    ileri_sarma_kaybi: 0,
    yanlis_cevap_kaybi: 0,
    oneri_kaybi: 0,
    toplam_puan: 0,
  };

  for (const p of puanlar || []) {
    if (p.puan_turu === 'video') istatistikler.video_puani += p.puan;
    else if (p.puan_turu === 'soru') istatistikler.soru_puani += p.puan;
    else if (p.puan_turu === 'oneri') istatistikler.oneri_puani += p.puan;
    else if (p.puan_turu === 'extra') istatistikler.extra_puan += p.puan;
    else if (p.puan_turu === 'ileri_sarma') istatistikler.ileri_sarma_kaybi += p.puan;
    else if (p.puan_turu === 'yanlis_cevap') istatistikler.yanlis_cevap_kaybi += p.puan;
    else if (p.puan_turu === 'oneri_kayip') istatistikler.oneri_kaybi += p.puan;
  }

  istatistikler.toplam_puan =
    istatistikler.video_puani +
    istatistikler.soru_puani +
    istatistikler.oneri_puani +
    istatistikler.extra_puan +
    istatistikler.ileri_sarma_kaybi +
    istatistikler.yanlis_cevap_kaybi +
    istatistikler.oneri_kaybi;

  // 2. İzleme özeti — periyot filtreli, created_at üzerinden
  const { data: izlemeler } = await adminSupabase
    .from('izleme_kayitlari')
    .select('izleme_id, tamamlandi_mi, created_at')
    .eq('kullanici_id', kullanici.kullanici_id)
    .gte('created_at', baslangic)
    .lte('created_at', bitis);

  const tamamlananIzleme = (izlemeler || []).filter(i => i.tamamlandi_mi).length;

  // 3. HBLigi — kişisel sıra — periyot bağımsız
  const { data: lig } = await adminSupabase
    .from('v_hbligi_sirali')
    .select('bolge_sirasi, takim_sirasi, toplam_puan')
    .eq('kullanici_id', kullanici.kullanici_id)
    .maybeSingle();

  // 4. Bölge sıralaması — periyot bağımsız
  const { data: bolgeLig } = await adminSupabase
    .from('v_hbligi_sirali')
    .select('kullanici_id, ad, soyad, toplam_puan, bolge_sirasi')
    .eq('bolge_id', kullanici.bolge_id)
    .in('rol', ['utt', 'kd_utt'])
    .order('toplam_puan', { ascending: false })
    .limit(10);

  const toplamBolgeUtt = bolgeLig?.length || 1;
  const toplamBolgePuan = (bolgeLig || []).reduce((acc, u) => acc + (u.toplam_puan || 0), 0);

  // 5. Takım puan toplamı — periyot bağımsız
  const { data: takimLig } = await adminSupabase
    .from('v_hbligi_sirali')
    .select('toplam_puan')
    .eq('takim_id', kullanici.takim_id)
    .in('rol', ['utt', 'kd_utt']);

  const toplamTakimPuan = (takimLig || []).reduce((acc, u) => acc + (u.toplam_puan || 0), 0);

  // 6. Katkı hesaplama
  const kisiselPuan = lig?.toplam_puan || 0;
  const bolgePuanMax = toplamBolgePuan > 0 ? kisiselPuan / toplamBolgePuan * 100 : 0;
  const takimPuanMax = toplamTakimPuan > 0 ? kisiselPuan / toplamTakimPuan * 100 : 0;

  // 7. Bir üst sıra farkı
  let birUstPuanFarki: number | null = null;
  const kendiSirasi = (bolgeLig || []).findIndex(u => u.kullanici_id === kullanici.kullanici_id);
  if (kendiSirasi > 0) {
    birUstPuanFarki = (bolgeLig![kendiSirasi - 1].toplam_puan || 0) - kisiselPuan;
  }

  // 8. Bölge ve takım adı
  const { data: bolge } = await adminSupabase
    .from('bolgeler')
    .select('bolge_adi, takim_id')
    .eq('bolge_id', kullanici.bolge_id)
    .maybeSingle();

  const { data: takim } = await adminSupabase
    .from('takimlar')
    .select('takim_adi')
    .eq('takim_id', kullanici.takim_id)
    .maybeSingle();

  // 9. Yayındaki toplam video sayısı — periyot bağımsız, anlık durum
  const { data: yayinlar } = await adminSupabase
    .from('yayin_yonetimi')
    .select('yayin_id')
    .eq('durum', 'yayinda');

  const toplamYayinSayisi = yayinlar?.length || 0;
  const izlenmemisVideoSayisi = Math.max(0, toplamYayinSayisi - tamamlananIzleme);
  const tahminiPuan = izlenmemisVideoSayisi * 80;

  // 10. Ürün & teknik dağılımı — periyot bağımsız
  const { data: urunIzleme } = await adminSupabase
    .from('v_rapor_urun_izlenme')
    .select('urun_adi, teknik_adi, izlenme_sayisi')
    .eq('kullanici_id', kullanici.kullanici_id);

  const urunDagilim: Record<string, number> = {};
  const teknikDagilim: Record<string, number> = {};

  for (const item of urunIzleme || []) {
    if (item.urun_adi) urunDagilim[item.urun_adi] = (urunDagilim[item.urun_adi] || 0) + (item.izlenme_sayisi || 1);
    if (item.teknik_adi) teknikDagilim[item.teknik_adi] = (teknikDagilim[item.teknik_adi] || 0) + (item.izlenme_sayisi || 1);
  }

  // 11. Öneriler — periyot bağımsız
  const { data: oneriler } = await adminSupabase
    .from('oneri_kayitlari')
    .select(`
      oneri_id,
      izlendi_mi,
      created_at,
      gonderen:oneren_id (ad, soyad)
    `)
    .eq('kullanici_id', kullanici.kullanici_id)
    .order('created_at', { ascending: false })
    .limit(10);

  const alinanOneri = (oneriler || []).length;
  const tamamlananOneri = (oneriler || []).filter(o => o.izlendi_mi).length;
  const bekleyenOneri = alinanOneri - tamamlananOneri;

  // 12. Beğeni/favori listesi — periyot bağımsız
  const { data: begeniRaw } = await adminSupabase
    .from('v_rapor_begeni_favori')
    .select('yayin_id, urun_adi, teknik_adi, begeni_sayisi')
    .eq('takim_id', bolge?.takim_id || '')
    .order('begeni_sayisi', { ascending: false })
    .limit(5);

  const { data: favoriRaw } = await adminSupabase
    .from('v_rapor_begeni_favori')
    .select('yayin_id, urun_adi, teknik_adi, favori_sayisi')
    .eq('takim_id', bolge?.takim_id || '')
    .order('favori_sayisi', { ascending: false })
    .limit(5);

  const { data: benimBegenim } = await adminSupabase
    .from('video_begeniler')
    .select('yayin_id')
    .eq('kullanici_id', kullanici.kullanici_id);

  const { data: benimFavorim } = await adminSupabase
    .from('video_favoriler')
    .select('yayin_id')
    .eq('kullanici_id', kullanici.kullanici_id);

  const benimBegeniSet = new Set((benimBegenim || []).map(b => b.yayin_id));
  const benimFavoriSet = new Set((benimFavorim || []).map(f => f.yayin_id));

  const begeniListesi = (begeniRaw || []).map(v => ({
    ...v,
    benim_begenim: benimBegeniSet.has(v.yayin_id),
  }));

  const favoriListesi = (favoriRaw || []).map(v => ({
    ...v,
    benim_favorim: benimFavoriSet.has(v.yayin_id),
  }));

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
        bolge_katki_yuzdesi: parseFloat(bolgePuanMax.toFixed(1)),
        takim_katki_yuzdesi: parseFloat(takimPuanMax.toFixed(1)),
        bolge_mevcut_puan: kisiselPuan,
        bolge_toplam_puan: toplamBolgePuan,
        takim_toplam_puan: toplamTakimPuan,
      },
      istatistikler: {
        ...istatistikler,
        tamamlanan_izleme: tamamlananIzleme,
        alinan_oneri: alinanOneri,
        tamamlanan_oneri: tamamlananOneri,
        bekleyen_oneri: bekleyenOneri,
      },
      lig: {
        bolge_sirasi: lig?.bolge_sirasi || null,
        takim_sirasi: lig?.takim_sirasi || null,
        toplam_bolge_utt: toplamBolgeUtt,
        bir_ust_puan_farki: birUstPuanFarki,
        bolge_siralamasi: (bolgeLig || []).map((u, idx) => ({
          sira: idx + 1,
          ad: u.ad,
          soyad: u.soyad,
          puan: u.toplam_puan || 0,
          kendisi_mi: u.kullanici_id === kullanici.kullanici_id,
        })),
      },
      beklemede: {
        izlenmemis_video_sayisi: izlenmemisVideoSayisi,
        tahmini_kazanilacak_puan: tahminiPuan,
        bekleyen_oneri_sayisi: bekleyenOneri,
      },
      urun_bazli_dagilim: Object.entries(urunDagilim)
        .map(([urun_adi, izlenme_sayisi]) => ({ urun_adi, izlenme_sayisi }))
        .sort((a, b) => b.izlenme_sayisi - a.izlenme_sayisi),
      teknik_bazli_dagilim: Object.entries(teknikDagilim)
        .map(([teknik_adi, izlenme_sayisi]) => ({ teknik_adi, izlenme_sayisi }))
        .sort((a, b) => b.izlenme_sayisi - a.izlenme_sayisi),
      oneriler: (oneriler || []).map((o: any) => ({
        oneri_id: o.oneri_id,
        tamamlandi_mi: o.izlendi_mi,
        gonderen: o.gonderen ? `${o.gonderen.ad} ${o.gonderen.soyad}` : '-',
        tarih: o.created_at,
        durum: o.izlendi_mi ? 'Tamamlandı' : 'Bekliyor',
      })),
      begeni_listesi: begeniListesi,
      favori_listesi: favoriListesi,
    },
  });
}