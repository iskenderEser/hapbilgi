// app/bm-egitim/api/rapor/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { hataYaniti, yetkiHatasi, rolHatasi, sunucuHatasi } from '@/lib/utils/hataIsle';

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
  // bu_ay varsayılan
  const baslangic = new Date(simdi.getFullYear(), simdi.getMonth(), 1);
  return { baslangic: baslangic.toISOString(), bitis };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi('Oturum açılmamış');

    const rol = (user.user_metadata?.rol ?? '').toLowerCase();
    if (rol !== 'bm') return rolHatasi('Sadece BM bu rapora erişebilir.');

    const { data: kullanici, error: kullaniciError } = await adminSupabase
      .from('kullanicilar')
      .select('kullanici_id, ad, soyad, rol, bolge_id, takim_id, firma_id')
      .eq('eposta', user.email)
      .single();

    if (kullaniciError || !kullanici) return hataYaniti('Kullanıcı bulunamadı', 'kullanicilar SELECT', kullaniciError);

    const { searchParams } = new URL(request.url);
    const periyot = searchParams.get('periyot') || 'bu_ay';
    const { baslangic, bitis } = tarihAraligi(periyot);

    // Kazanılan puanlar
    const { data: puanlar } = await adminSupabase
      .from('bm_kazanilan_puanlar')
      .select('puan_turu, puan, created_at')
      .eq('kullanici_id', kullanici.kullanici_id)
      .gte('created_at', baslangic)
      .lte('created_at', bitis);

    let izleme_puani = 0;
    let cevaplama_puani = 0;
    let extra_puani = 0;
    let challenge_gonderme_puani = 0;
    let challenge_izleme_puani = 0;

    for (const p of puanlar ?? []) {
      if (p.puan_turu === 'izleme') izleme_puani += p.puan;
      else if (p.puan_turu === 'cevaplama') cevaplama_puani += p.puan;
      else if (p.puan_turu === 'extra') extra_puani += p.puan;
      else if (p.puan_turu === 'challenge_gonderme') challenge_gonderme_puani += p.puan;
      else if (p.puan_turu === 'challenge_izleme') challenge_izleme_puani += p.puan;
    }

    const toplam_puan = izleme_puani + cevaplama_puani + extra_puani + challenge_gonderme_puani + challenge_izleme_puani;

    // İzleme istatistikleri
    const { data: izlemeler } = await adminSupabase
      .from('bm_izleme_kayitlari')
      .select('izleme_id, izleme_turu, tamamlandi_mi, izleme_baslangic')
      .eq('kullanici_id', kullanici.kullanici_id)
      .eq('tamamlandi_mi', true)
      .gte('izleme_baslangic', baslangic)
      .lte('izleme_baslangic', bitis);

    const izlenen_video_sayisi = (izlemeler ?? []).filter(i => i.izleme_turu === 'normal').length;
    const extra_izleme_sayisi = (izlemeler ?? []).filter(i => i.izleme_turu === 'extra').length;
    const challenge_izleme_sayisi = (izlemeler ?? []).filter(i => i.izleme_turu === 'challenge').length;

    // Soru cevap istatistikleri
    const { data: cevaplar } = await adminSupabase
      .from('bm_soru_cevaplari')
      .select('dogru_mu, created_at')
      .eq('kullanici_id', kullanici.kullanici_id)
      .gte('created_at', baslangic)
      .lte('created_at', bitis);

    const dogru_cevap_sayisi = (cevaplar ?? []).filter(c => c.dogru_mu).length;
    const yanlis_cevap_sayisi = (cevaplar ?? []).filter(c => !c.dogru_mu).length;

    // Challenge istatistikleri
    const { data: gonderilen_challengeler } = await adminSupabase
      .from('challenge_kayitlari')
      .select('challenge_id, izlendi_mi, created_at')
      .eq('gonderen_id', kullanici.kullanici_id)
      .gte('created_at', baslangic)
      .lte('created_at', bitis);

    const { data: alinan_challengeler } = await adminSupabase
      .from('challenge_kayitlari')
      .select('challenge_id, izlendi_mi, son_tarih, created_at')
      .eq('alan_id', kullanici.kullanici_id)
      .gte('created_at', baslangic)
      .lte('created_at', bitis);

    const gonderilen_challenge_sayisi = (gonderilen_challengeler ?? []).length;
    const izlenen_challenge_sayisi = (gonderilen_challengeler ?? []).filter(c => c.izlendi_mi).length;
    const alinan_challenge_sayisi = (alinan_challengeler ?? []).length;
    const tamamlanan_challenge_sayisi = (alinan_challengeler ?? []).filter(c => c.izlendi_mi).length;

    // Bu ay ChallengeClub kendi puanı
    const { data: challengePuanlar } = await adminSupabase
      .from('bm_kazanilan_puanlar')
      .select('puan, puan_turu')
      .eq('kullanici_id', kullanici.kullanici_id)
      .in('puan_turu', ['challenge_gonderme', 'challenge_izleme'])
      .gte('created_at', baslangic)
      .lte('created_at', bitis);

    const challenge_club_puani = (challengePuanlar ?? []).reduce((acc, p) => acc + p.puan, 0);

    return NextResponse.json({
      success: true,
      data: {
        kullanici: {
          ad: kullanici.ad,
          soyad: kullanici.soyad,
          rol: kullanici.rol,
        },
        periyot,
        puan_ozeti: {
          toplam_puan,
          izleme_puani,
          cevaplama_puani,
          extra_puani,
          challenge_gonderme_puani,
          challenge_izleme_puani,
        },
        izleme_ozeti: {
          izlenen_video_sayisi,
          extra_izleme_sayisi,
          challenge_izleme_sayisi,
        },
        soru_ozeti: {
          dogru_cevap_sayisi,
          yanlis_cevap_sayisi,
          toplam_cevap: dogru_cevap_sayisi + yanlis_cevap_sayisi,
        },
        challenge_ozeti: {
          gonderilen_challenge_sayisi,
          izlenen_challenge_sayisi,
          alinan_challenge_sayisi,
          tamamlanan_challenge_sayisi,
          challenge_club_puani,
        },
      },
    }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, 'GET /bm-egitim/api/rapor');
  }
}