// app/bm-egitim/api/talepler/route.ts
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
      .select('kullanici_id, rol, takim_id, firma_id')
      .eq('eposta', user.email)
      .single();

    if (kullaniciError || !kullanici) return hataYaniti('Kullanıcı bulunamadı', 'kullanicilar SELECT', kullaniciError);
    if (!YETKILI_ROLLER.includes(kullanici.rol)) return rolHatasi('Bu sayfaya erişim yetkiniz yok');

    const { data: talepler, error } = await adminSupabase
      .from('bm_talepler')
      .select(`
        talep_id, kapsam, takim_id, urun_id, teknik_id,
        urun_adi, teknik_adi, aciklama, dosya_urls,
        hazir_video, hazir_video_url, created_at,
        talep_eden:kullanicilar!talep_eden_id(ad, soyad),
        takim:takimlar(takim_adi)
      `)
      .eq('firma_id', kullanici.firma_id)
      .order('created_at', { ascending: false });

    if (error) return hataYaniti('Talepler çekilemedi', 'bm_talepler SELECT', error);

    return NextResponse.json({ success: true, talepler: talepler ?? [] }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, 'GET /bm-egitim/api/talepler');
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
    const { kapsam, takim_id, urun_id, teknik_id, urun_adi, teknik_adi, aciklama, dosya_urls, hazir_video, hazir_video_url } = body;

    if (!kapsam) return validasyonHatasi('Kapsam zorunludur.', ['kapsam']);
    if (!aciklama) return validasyonHatasi('Açıklama zorunludur.', ['aciklama']);
    if (kapsam === 'takim' && !takim_id) return validasyonHatasi('Takım bazlı içerik için takim_id zorunludur.', ['takim_id']);

    const { data: talep, error } = await adminSupabase
      .from('bm_talepler')
      .insert({
        talep_eden_id: kullanici.kullanici_id,
        kapsam,
        takim_id: kapsam === 'takim' ? takim_id : null,
        urun_id: urun_id || null,
        teknik_id: teknik_id || null,
        urun_adi: urun_adi || null,
        teknik_adi: teknik_adi || null,
        aciklama,
        dosya_urls: dosya_urls || null,
        hazir_video: hazir_video || false,
        hazir_video_url: hazir_video_url || null,
      })
      .select()
      .single();

    if (error) return hataYaniti('Talep oluşturulamadı', 'bm_talepler INSERT', error);

    return NextResponse.json({ success: true, talep }, { status: 201 });

  } catch (err) {
    return sunucuHatasi(err, 'POST /bm-egitim/api/talepler');
  }
}