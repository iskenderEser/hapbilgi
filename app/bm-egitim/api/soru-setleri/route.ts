// app/bm-egitim/api/soru-setleri/route.ts
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
    const video_durum_id = searchParams.get('video_durum_id');

    let query = adminSupabase
      .from('bm_soru_setleri')
      .select(`
        soru_seti_id, video_durum_id, sorular, created_at,
        iu:kullanicilar!iu_id(ad, soyad),
        bm_soru_seti_durumu(soru_seti_durum_id, durum, notlar, created_at)
      `)
      .order('created_at', { ascending: false });

    if (video_durum_id) query = query.eq('video_durum_id', video_durum_id);

    const { data: soruSetleri, error } = await query;
    if (error) return hataYaniti('Soru setleri çekilemedi', 'bm_soru_setleri SELECT', error);

    return NextResponse.json({ success: true, soru_setleri: soruSetleri ?? [] }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, 'GET /bm-egitim/api/soru-setleri');
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
    const { video_durum_id, sorular, soru_puani } = body;

    if (!video_durum_id) return validasyonHatasi('video_durum_id zorunludur.', ['video_durum_id']);
    if (!sorular || !Array.isArray(sorular) || sorular.length === 0) return validasyonHatasi('En az 1 soru zorunludur.', ['sorular']);

    const { data: soruSeti, error: ssError } = await adminSupabase
      .from('bm_soru_setleri')
      .insert({
        video_durum_id,
        iu_id: kullanici.kullanici_id,
        sorular,
      })
      .select()
      .single();

    if (ssError) return hataYaniti('Soru seti oluşturulamadı', 'bm_soru_setleri INSERT', ssError);

    // İlk durum kaydı
    const { data: soruSetiDurum, error: dError } = await adminSupabase
      .from('bm_soru_seti_durumu')
      .insert({
        soru_seti_id: soruSeti.soru_seti_id,
        durum: 'incelemede',
        degistiren_id: kullanici.kullanici_id,
      })
      .select()
      .single();

    if (dError) return hataYaniti('Soru seti durumu oluşturulamadı', 'bm_soru_seti_durumu INSERT', dError);

    // Soru puanı kaydet
    if (soru_puani && soru_puani > 0) {
      for (let i = 0; i < sorular.length; i++) {
        await adminSupabase
          .from('bm_soru_seti_puanlari')
          .insert({
            soru_seti_durum_id: soruSetiDurum.soru_seti_durum_id,
            soru_puani,
            soru_index: i,
          });
      }
    }

    return NextResponse.json({ success: true, soru_seti: soruSeti }, { status: 201 });

  } catch (err) {
    return sunucuHatasi(err, 'POST /bm-egitim/api/soru-setleri');
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
    const { soru_seti_durum_id, durum, notlar } = body;

    if (!soru_seti_durum_id) return validasyonHatasi('soru_seti_durum_id zorunludur.', ['soru_seti_durum_id']);
    if (!durum) return validasyonHatasi('Durum zorunludur.', ['durum']);

    const { error } = await adminSupabase
      .from('bm_soru_seti_durumu')
      .update({ durum, notlar: notlar || null, degistiren_id: kullanici.kullanici_id })
      .eq('soru_seti_durum_id', soru_seti_durum_id);

    if (error) return hataYaniti('Soru seti durumu güncellenemedi', 'bm_soru_seti_durumu UPDATE', error);

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, 'PUT /bm-egitim/api/soru-setleri');
  }
}