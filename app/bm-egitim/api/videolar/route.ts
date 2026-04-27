// app/bm-egitim/api/videolar/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { hataYaniti, yetkiHatasi, rolHatasi, validasyonHatasi, sunucuHatasi } from '@/lib/utils/hataIsle';

const YETKILI_ROLLER = ['iu', 'egt_md', 'egt_yrd_md', 'egt_yon', 'egt_uz', 'drk'];

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const senaryo_durum_id = searchParams.get('senaryo_durum_id');

    let query = adminSupabase
      .from('bm_videolar')
      .select(`
        video_id, senaryo_durum_id, video_url, thumbnail_url, created_at,
        iu:kullanicilar!iu_id(ad, soyad),
        bm_video_durumu(video_durum_id, durum, notlar, created_at)
      `)
      .order('created_at', { ascending: false });

    if (senaryo_durum_id) query = query.eq('senaryo_durum_id', senaryo_durum_id);

    const { data: videolar, error } = await query;
    if (error) return hataYaniti('Videolar çekilemedi', 'bm_videolar SELECT', error);

    return NextResponse.json({ success: true, videolar: videolar ?? [] }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, 'GET /bm-egitim/api/videolar');
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
      .select('kullanici_id, rol')
      .eq('eposta', user.email)
      .single();

    if (kullaniciError || !kullanici) return hataYaniti('Kullanıcı bulunamadı', 'kullanicilar SELECT', kullaniciError);
    if (!YETKILI_ROLLER.includes(kullanici.rol)) return rolHatasi('Bu sayfaya erişim yetkiniz yok');

    const body = await request.json();
    const { senaryo_durum_id, video_url, thumbnail_url } = body;

    if (!senaryo_durum_id) return validasyonHatasi('senaryo_durum_id zorunludur.', ['senaryo_durum_id']);
    if (!video_url) return validasyonHatasi('Video URL zorunludur.', ['video_url']);

    const { data: video, error: vError } = await adminSupabase
      .from('bm_videolar')
      .insert({
        senaryo_durum_id,
        iu_id: kullanici.kullanici_id,
        video_url,
        thumbnail_url: thumbnail_url || null,
      })
      .select()
      .single();

    if (vError) return hataYaniti('Video oluşturulamadı', 'bm_videolar INSERT', vError);

    // İlk durum kaydı
    const { error: dError } = await adminSupabase
      .from('bm_video_durumu')
      .insert({
        video_id: video.video_id,
        durum: 'incelemede',
        degistiren_id: kullanici.kullanici_id,
      });

    if (dError) return hataYaniti('Video durumu oluşturulamadı', 'bm_video_durumu INSERT', dError);

    return NextResponse.json({ success: true, video }, { status: 201 });

  } catch (err) {
    return sunucuHatasi(err, 'POST /bm-egitim/api/videolar');
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
    const { video_durum_id, durum, notlar } = body;

    if (!video_durum_id) return validasyonHatasi('video_durum_id zorunludur.', ['video_durum_id']);
    if (!durum) return validasyonHatasi('Durum zorunludur.', ['durum']);

    const { error } = await adminSupabase
      .from('bm_video_durumu')
      .update({ durum, notlar: notlar || null, degistiren_id: kullanici.kullanici_id })
      .eq('video_durum_id', video_durum_id);

    if (error) return hataYaniti('Video durumu güncellenemedi', 'bm_video_durumu UPDATE', error);

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, 'PUT /bm-egitim/api/videolar');
  }
}