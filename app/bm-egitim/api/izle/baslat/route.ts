// app/bm-egitim/api/izle/baslat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { hataYaniti, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi, sunucuHatasi } from '@/lib/utils/hataIsle';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi('Oturum açılmamış');

    const rol = (user.user_metadata?.rol ?? '').toLowerCase();
    if (rol !== 'bm') return rolHatasi('Sadece BM izleyebilir.');

    const { data: kullanici, error: kullaniciError } = await adminSupabase
      .from('kullanicilar')
      .select('kullanici_id, takim_id, firma_id')
      .eq('eposta', user.email)
      .single();

    if (kullaniciError || !kullanici) return hataYaniti('Kullanıcı bulunamadı', 'kullanicilar SELECT', kullaniciError);

    const body = await request.json();
    const { yayin_id, izleme_turu } = body;

    if (!yayin_id) return validasyonHatasi('yayin_id zorunludur.', ['yayin_id']);

    // Yayın var mı ve BM erişebilir mi?
    const { data: yayin, error: yayinError } = await adminSupabase
      .from('bm_yayin_yonetimi')
      .select('yayin_id, durum, kapsam, takim_id')
      .eq('yayin_id', yayin_id)
      .eq('durum', 'yayinda')
      .single();

    if (yayinError || !yayin) return hataYaniti('Yayın bulunamadı', 'bm_yayin_yonetimi SELECT', yayinError, 404);

    // Kapsam kontrolü
    if (yayin.kapsam === 'takim' && yayin.takim_id !== kullanici.takim_id) {
      return rolHatasi('Bu yayına erişim yetkiniz yok.');
    }

    // Devam eden izleme var mı?
    const { data: devamEden } = await adminSupabase
      .from('bm_izleme_kayitlari')
      .select('izleme_id')
      .eq('yayin_id', yayin_id)
      .eq('kullanici_id', kullanici.kullanici_id)
      .eq('tamamlandi_mi', false)
      .limit(1);

    if ((devamEden ?? []).length > 0) {
      return isKuraluHatasi('Bu video için devam eden bir izleme kaydı var.');
    }

    const { data: izleme, error: izlemeError } = await adminSupabase
      .from('bm_izleme_kayitlari')
      .insert({
        yayin_id,
        kullanici_id: kullanici.kullanici_id,
        izleme_turu: izleme_turu || 'normal',
        tamamlandi_mi: false,
        izleme_baslangic: new Date().toISOString(),
      })
      .select()
      .single();

    if (izlemeError) return hataYaniti('İzleme başlatılamadı', 'bm_izleme_kayitlari INSERT', izlemeError);

    return NextResponse.json({ success: true, izleme_id: izleme.izleme_id }, { status: 201 });

  } catch (err) {
    return sunucuHatasi(err, 'POST /bm-egitim/api/izle/baslat');
  }
}