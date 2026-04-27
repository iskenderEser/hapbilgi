// app/bm-egitim/api/yayin/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { hataYaniti, yetkiHatasi, rolHatasi, validasyonHatasi, sunucuHatasi } from '@/lib/utils/hataIsle';

const YETKILI_ROLLER = ['egt_md', 'egt_yrd_md', 'egt_yon', 'egt_uz', 'drk'];

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi('Oturum açılmamış');

    const { data: kullanici, error: kullaniciError } = await adminSupabase
      .from('kullanicilar')
      .select('kullanici_id, rol, takim_id, firma_id, bolge_id')
      .eq('eposta', user.email)
      .single();

    if (kullaniciError || !kullanici) return hataYaniti('Kullanıcı bulunamadı', 'kullanicilar SELECT', kullaniciError);

    // BM de kendi yayınlarını görebilir
    const izinliRoller = [...YETKILI_ROLLER, 'bm'];
    if (!izinliRoller.includes(kullanici.rol)) return rolHatasi('Bu sayfaya erişim yetkiniz yok');

    // BM ise kendi takımının + firma geneli yayınları görsün
    let query = adminSupabase
      .from('bm_yayin_yonetimi')
      .select(`
        yayin_id, kapsam, takim_id, durum, yayin_tarihi,
        durdurma_tarihi, ileri_sarma_acik, extra_puan, created_at,
        bm_soru_seti_durumu(
          soru_seti_durum_id,
          bm_soru_setleri(
            soru_seti_id,
            bm_video_durumu(
              video_durum_id,
              bm_videolar(video_id, video_url, thumbnail_url,
                bm_senaryo_durumu(
                  senaryo_durum_id,
                  bm_senaryolar(
                    senaryo_id,
                    bm_talepler(urun_adi, teknik_adi, kapsam)
                  )
                )
              )
            )
          )
        )
      `)
      .eq('durum', 'yayinda')
      .order('yayin_tarihi', { ascending: false });

    if (kullanici.rol === 'bm') {
      // Firma geneli veya kendi takımının yayınları
      query = query.or(`kapsam.eq.firma,and(kapsam.eq.takim,takim_id.eq.${kullanici.takim_id})`);
    }

    const { data: yayinlar, error } = await query;
    if (error) return hataYaniti('Yayınlar çekilemedi', 'bm_yayin_yonetimi SELECT', error);

    return NextResponse.json({ success: true, yayinlar: yayinlar ?? [] }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, 'GET /bm-egitim/api/yayin');
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi('Oturum açılmamış');

    const { data: kullanici, error: kullaniciError } = await adminSupabase
      .from('kullanicilar')
      .select('kullanici_id, rol, takim_id, firma_id')
      .eq('eposta', user.email)
      .single();

    if (kullaniciError || !kullanici) return hataYaniti('Kullanıcı bulunamadı', 'kullanicilar SELECT', kullaniciError);
    if (!YETKILI_ROLLER.includes(kullanici.rol)) return rolHatasi('Bu sayfaya erişim yetkiniz yok');

    const body = await request.json();
    const { soru_seti_durum_id, kapsam, takim_id, ileri_sarma_acik, extra_puan, yayin_tarihi } = body;

    if (!soru_seti_durum_id) return validasyonHatasi('soru_seti_durum_id zorunludur.', ['soru_seti_durum_id']);
    if (!kapsam) return validasyonHatasi('Kapsam zorunludur.', ['kapsam']);
    if (kapsam === 'takim' && !takim_id) return validasyonHatasi('Takım bazlı yayın için takim_id zorunludur.', ['takim_id']);

    const { data: yayin, error } = await adminSupabase
      .from('bm_yayin_yonetimi')
      .insert({
        soru_seti_durum_id,
        yayinlayan_id: kullanici.kullanici_id,
        kapsam,
        takim_id: kapsam === 'takim' ? takim_id : null,
        durum: yayin_tarihi ? 'ileri_tarihli' : 'yayinda',
        yayin_tarihi: yayin_tarihi || new Date().toISOString(),
        ileri_sarma_acik: ileri_sarma_acik || false,
        extra_puan: extra_puan || 0,
      })
      .select()
      .single();

    if (error) return hataYaniti('Yayın oluşturulamadı', 'bm_yayin_yonetimi INSERT', error);

    return NextResponse.json({ success: true, yayin }, { status: 201 });

  } catch (err) {
    return sunucuHatasi(err, 'POST /bm-egitim/api/yayin');
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi('Oturum açılmamış');

    const { data: kullanici, error: kullaniciError } = await adminSupabase
      .from('kullanicilar')
      .select('kullanici_id, rol')
      .eq('eposta', user.email)
      .single();

    if (kullaniciError || !kullanici) return hataYaniti('Kullanıcı bulunamadı', 'kullanicilar SELECT', kullaniciError);
    if (!YETKILI_ROLLER.includes(kullanici.rol)) return rolHatasi('Bu sayfaya erişim yetkiniz yok');

    const body = await request.json();
    const { yayin_id, durum } = body;

    if (!yayin_id) return validasyonHatasi('yayin_id zorunludur.', ['yayin_id']);
    if (!durum) return validasyonHatasi('Durum zorunludur.', ['durum']);

    const updateData: any = { durum };
    if (durum === 'durduruldu') updateData.durdurma_tarihi = new Date().toISOString();

    const { error } = await adminSupabase
      .from('bm_yayin_yonetimi')
      .update(updateData)
      .eq('yayin_id', yayin_id);

    if (error) return hataYaniti('Yayın güncellenemedi', 'bm_yayin_yonetimi UPDATE', error);

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, 'PUT /bm-egitim/api/yayin');
  }
}