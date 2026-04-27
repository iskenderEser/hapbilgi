// app/bm-egitim/api/senaryolar/route.ts
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
      .select('kullanici_id, rol, firma_id')
      .eq('eposta', user.email)
      .single();

    if (kullaniciError || !kullanici) return hataYaniti('Kullanıcı bulunamadı', 'kullanicilar SELECT', kullaniciError);
    if (!YETKILI_ROLLER.includes(kullanici.rol)) return rolHatasi('Bu sayfaya erişim yetkiniz yok');

    const { searchParams } = new URL(request.url);
    const talep_id = searchParams.get('talep_id');

    let query = adminSupabase
      .from('bm_senaryolar')
      .select(`
        senaryo_id, talep_id, senaryo_metni, created_at,
        iu:kullanicilar!iu_id(ad, soyad),
        bm_senaryo_durumu(senaryo_durum_id, durum, notlar, created_at)
      `)
      .order('created_at', { ascending: false });

    if (talep_id) query = query.eq('talep_id', talep_id);

    const { data: senaryolar, error } = await query;
    if (error) return hataYaniti('Senaryolar çekilemedi', 'bm_senaryolar SELECT', error);

    return NextResponse.json({ success: true, senaryolar: senaryolar ?? [] }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, 'GET /bm-egitim/api/senaryolar');
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
    const { talep_id, senaryo_metni } = body;

    if (!talep_id) return validasyonHatasi('talep_id zorunludur.', ['talep_id']);
    if (!senaryo_metni) return validasyonHatasi('Senaryo metni zorunludur.', ['senaryo_metni']);

    const { data: senaryo, error: sError } = await adminSupabase
      .from('bm_senaryolar')
      .insert({
        talep_id,
        iu_id: kullanici.kullanici_id,
        senaryo_metni,
      })
      .select()
      .single();

    if (sError) return hataYaniti('Senaryo oluşturulamadı', 'bm_senaryolar INSERT', sError);

    // İlk durum kaydı
    const { error: dError } = await adminSupabase
      .from('bm_senaryo_durumu')
      .insert({
        senaryo_id: senaryo.senaryo_id,
        durum: 'incelemede',
        degistiren_id: kullanici.kullanici_id,
      });

    if (dError) return hataYaniti('Senaryo durumu oluşturulamadı', 'bm_senaryo_durumu INSERT', dError);

    return NextResponse.json({ success: true, senaryo }, { status: 201 });

  } catch (err) {
    return sunucuHatasi(err, 'POST /bm-egitim/api/senaryolar');
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
    const { senaryo_durum_id, durum, notlar } = body;

    if (!senaryo_durum_id) return validasyonHatasi('senaryo_durum_id zorunludur.', ['senaryo_durum_id']);
    if (!durum) return validasyonHatasi('Durum zorunludur.', ['durum']);

    const { error } = await adminSupabase
      .from('bm_senaryo_durumu')
      .update({ durum, notlar: notlar || null, degistiren_id: kullanici.kullanici_id })
      .eq('senaryo_durum_id', senaryo_durum_id);

    if (error) return hataYaniti('Senaryo durumu güncellenemedi', 'bm_senaryo_durumu UPDATE', error);

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, 'PUT /bm-egitim/api/senaryolar');
  }
}