// app/challenge-club/api/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { hataYaniti, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi, sunucuHatasi } from '@/lib/utils/hataIsle';

const CHALLENGE_GONDERME_PUANI = 10;
const HAFTALIK_MAX_CHALLENGE = 2;
const UC_AYLIK_MAX_AYNI_BM = 2;
const IS_GUNU_SURE = 5;

function isGunuEkle(tarih: Date, gun: number): Date {
  let eklenen = 0;
  const sonuc = new Date(tarih);
  while (eklenen < gun) {
    sonuc.setDate(sonuc.getDate() + 1);
    const haftaGunu = sonuc.getDay();
    if (haftaGunu !== 0 && haftaGunu !== 6) eklenen++;
  }
  return sonuc;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi('Oturum açılmamış');

    const rol = (user.user_metadata?.rol ?? '').toLowerCase();
    if (rol !== 'bm') return rolHatasi('Sadece BM ChallengeClub\'a erişebilir.');

    const { data: kullanici } = await adminSupabase
      .from('kullanicilar')
      .select('kullanici_id, ad, soyad, firma_id')
      .eq('eposta', user.email)
      .single();

    if (!kullanici) return hataYaniti('Kullanıcı bulunamadı', 'kullanicilar SELECT', null);

    const { searchParams } = new URL(request.url);
    const tip = searchParams.get('tip') || 'bekleyen';

    if (tip === 'bekleyen') {
      // Bekleyen challengelar — bana gönderilmiş, izlenmemiş, süresi dolmamış
      const { data: challengeler } = await adminSupabase
        .from('challenge_kayitlari')
        .select(`
          challenge_id, yayin_id, son_tarih, created_at, izlendi_mi,
          gonderen:kullanicilar!gonderen_id(ad, soyad),
          bm_yayin_yonetimi(
            soru_seti_durum_id,
            bm_soru_seti_durumu(
              bm_soru_setleri(
                bm_video_durumu(
                  bm_videolar(video_url, thumbnail_url,
                    bm_senaryo_durumu(
                      bm_senaryolar(
                        bm_talepler(urun_adi, teknik_adi)
                      )
                    )
                  )
                )
              )
            )
          )
        `)
        .eq('alan_id', kullanici.kullanici_id)
        .eq('izlendi_mi', false)
        .gte('son_tarih', new Date().toISOString())
        .order('created_at', { ascending: false });

      return NextResponse.json({ success: true, challengeler: challengeler ?? [] }, { status: 200 });
    }

    if (tip === 'gonderdiklerim') {
      const simdi = new Date();
      const ayBaslangic = new Date(simdi.getFullYear(), simdi.getMonth(), 1);

      const { data: challengeler } = await adminSupabase
        .from('challenge_kayitlari')
        .select(`
          challenge_id, yayin_id, son_tarih, created_at, izlendi_mi,
          alan:kullanicilar!alan_id(ad, soyad),
          bm_yayin_yonetimi(
            bm_soru_seti_durumu(
              bm_soru_setleri(
                bm_video_durumu(
                  bm_videolar(
                    bm_senaryo_durumu(
                      bm_senaryolar(
                        bm_talepler(urun_adi, teknik_adi)
                      )
                    )
                  )
                )
              )
            )
          )
        `)
        .eq('gonderen_id', kullanici.kullanici_id)
        .gte('created_at', ayBaslangic.toISOString())
        .order('created_at', { ascending: false });

      return NextResponse.json({ success: true, challengeler: challengeler ?? [] }, { status: 200 });
    }

    if (tip === 'aylik_top3') {
      // Ayın top 3 challenger'ı — sadece bu ay challenge puanlarına göre
      const simdi = new Date();
      const ayBaslangic = new Date(simdi.getFullYear(), simdi.getMonth(), 1);

      const { data: puanlar } = await adminSupabase
        .from('bm_kazanilan_puanlar')
        .select('kullanici_id, puan')
        .in('puan_turu', ['challenge_gonderme', 'challenge_izleme'])
        .gte('created_at', ayBaslangic.toISOString())
        .eq('kullanici_id', kullanici.kullanici_id);  // sadece kendi puanı

      const kendi_puani = (puanlar ?? []).reduce((acc, p) => acc + p.puan, 0);

      // Top 3 sadece firma geneli — isimler gösterilir
      const { data: topPuanlar } = await adminSupabase
        .from('bm_kazanilan_puanlar')
        .select('kullanici_id, puan')
        .in('puan_turu', ['challenge_gonderme', 'challenge_izleme'])
        .gte('created_at', ayBaslangic.toISOString());

      // Kullanici bazlı topla
      const kullaniciPuanlari: Record<string, number> = {};
      for (const p of topPuanlar ?? []) {
        kullaniciPuanlari[p.kullanici_id] = (kullaniciPuanlari[p.kullanici_id] || 0) + p.puan;
      }

      const sirali = Object.entries(kullaniciPuanlari)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3);

      const top3KullaniciIds = sirali.map(([id]) => id);

      const { data: top3Kullanicilar } = await adminSupabase
        .from('kullanicilar')
        .select('kullanici_id, ad, soyad')
        .in('kullanici_id', top3KullaniciIds);

      const top3 = sirali.map(([id, puan], index) => {
        const k = top3Kullanicilar?.find(u => u.kullanici_id === id);
        return {
          sira: index + 1,
          ad: k ? `${k.ad} ${k.soyad}` : 'Bilinmiyor',
          puan,
          benim: id === kullanici.kullanici_id,
        };
      });

      return NextResponse.json({
        success: true,
        top3,
        kendi_puani,
        kendi_sirada_mi: top3.some(t => t.benim),
      }, { status: 200 });
    }

    return NextResponse.json({ success: true, challengeler: [] }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, 'GET /challenge-club/api');
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi('Oturum açılmamış');

    const rol = (user.user_metadata?.rol ?? '').toLowerCase();
    if (rol !== 'bm') return rolHatasi('Sadece BM challenge gönderebilir.');

    const { data: kullanici } = await adminSupabase
      .from('kullanicilar')
      .select('kullanici_id, firma_id')
      .eq('eposta', user.email)
      .single();

    if (!kullanici) return hataYaniti('Kullanıcı bulunamadı', 'kullanicilar SELECT', null);

    const body = await request.json();
    const { alan_id, yayin_id } = body;

    if (!alan_id) return validasyonHatasi('alan_id zorunludur.', ['alan_id']);
    if (!yayin_id) return validasyonHatasi('yayin_id zorunludur.', ['yayin_id']);
    if (alan_id === kullanici.kullanici_id) return isKuraluHatasi('Kendinize challenge gönderemezsiniz.');

    // Alan kişi BM mi?
    const { data: alanKullanici } = await adminSupabase
      .from('kullanicilar')
      .select('kullanici_id, rol, firma_id')
      .eq('kullanici_id', alan_id)
      .single();

    if (!alanKullanici || alanKullanici.rol !== 'bm') return isKuraluHatasi('Challenge sadece BM\'lere gönderilebilir.');
    if (alanKullanici.firma_id !== kullanici.firma_id) return isKuraluHatasi('Farklı firmadan BM\'ye challenge gönderilemez.');

    // Haftalık limit kontrolü
    const simdi = new Date();
    const haftaBaslangic = new Date(simdi);
    const gun = simdi.getDay();
    const fark = gun === 0 ? 6 : gun - 1;
    haftaBaslangic.setDate(simdi.getDate() - fark);
    haftaBaslangic.setHours(0, 0, 0, 0);

    const { count: haftaCount } = await adminSupabase
      .from('challenge_kayitlari')
      .select('challenge_id', { count: 'exact', head: true })
      .eq('gonderen_id', kullanici.kullanici_id)
      .gte('created_at', haftaBaslangic.toISOString());

    if ((haftaCount ?? 0) >= HAFTALIK_MAX_CHALLENGE) {
      return isKuraluHatasi(`Bu hafta maksimum ${HAFTALIK_MAX_CHALLENGE} challenge gönderebilirsiniz.`);
    }

    // 3 aylık aynı BM limiti
    const ucAyOnce = new Date(simdi);
    ucAyOnce.setMonth(simdi.getMonth() - 3);

    const { count: ucAyCount } = await adminSupabase
      .from('challenge_kayitlari')
      .select('challenge_id', { count: 'exact', head: true })
      .eq('gonderen_id', kullanici.kullanici_id)
      .eq('alan_id', alan_id)
      .gte('created_at', ucAyOnce.toISOString());

    if ((ucAyCount ?? 0) >= UC_AYLIK_MAX_AYNI_BM) {
      return isKuraluHatasi(`Aynı BM\'ye 3 ay içinde en fazla ${UC_AYLIK_MAX_AYNI_BM} challenge gönderebilirsiniz.`);
    }

    // Son tarih hesapla (5 iş günü)
    const sonTarih = isGunuEkle(simdi, IS_GUNU_SURE);

    // Challenge oluştur
    const { data: challenge, error } = await adminSupabase
      .from('challenge_kayitlari')
      .insert({
        gonderen_id: kullanici.kullanici_id,
        alan_id,
        yayin_id,
        izlendi_mi: false,
        son_tarih: sonTarih.toISOString(),
      })
      .select()
      .single();

    if (error) return hataYaniti('Challenge gönderilemedi', 'challenge_kayitlari INSERT', error);

    // Gönderene puan ver
    await adminSupabase
      .from('bm_kazanilan_puanlar')
      .insert({
        kullanici_id: kullanici.kullanici_id,
        yayin_id,
        puan_turu: 'challenge_gonderme',
        puan: CHALLENGE_GONDERME_PUANI,
      });

    return NextResponse.json({ success: true, challenge }, { status: 201 });

  } catch (err) {
    return sunucuHatasi(err, 'POST /challenge-club/api');
  }
}