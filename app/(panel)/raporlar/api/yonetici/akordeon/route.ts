import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { hataYaniti, yetkiHatasi } from '@/lib/utils/hataIsle';
import { YONETICI_ROLLER } from '@/lib/utils/roller';
import { tarihAraligi } from '@/lib/utils/tarihAraligi';

export async function GET(request: Request) {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get('scope');
  const ustBirimId = searchParams.get('ust_birim_id');
  const { baslangic, bitis } = tarihAraligi(searchParams.get('periyot') || 'bu_ay');

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return yetkiHatasi('Oturum açılmamış');

  const { data: kullanici, error: kullaniciError } = await adminSupabase
    .from('kullanicilar')
    .select('kullanici_id, rol')
    .eq('eposta', user.email)
    .single();
  if (kullaniciError || !kullanici) {
    return hataYaniti('Kullanıcı bulunamadı', 'kullanici_bulamadi', kullaniciError);
  }
  if (!YONETICI_ROLLER.includes((kullanici.rol ?? '').toLowerCase())) {
    return yetkiHatasi('Bu rapora erişim yetkiniz yok');
  }
  if (!['takim', 'bolge', 'utt'].includes(scope ?? '')) {
    return hataYaniti('Geçersiz hiyerarşi seviyesi', 'yonetici_hiyerarsi_scope', { scope });
  }
  if (scope !== 'takim' && !ustBirimId) {
    return hataYaniti('Üst birim kimliği zorunludur', 'yonetici_hiyerarsi_ust_birim', { scope });
  }

  const { data, error } = await adminSupabase.rpc('get_yonetici_hiyerarsi_v2', {
    p_yonetici_id: kullanici.kullanici_id,
    p_baslangic: baslangic,
    p_bitis: bitis,
    p_seviye: scope,
    p_ust_birim_id: scope === 'takim' ? null : ustBirimId,
  });
  if (error) {
    return hataYaniti('Hiyerarşi verisi alınamadı', 'get_yonetici_hiyerarsi_v2', error);
  }

  return NextResponse.json({ success: true, data: data ?? [] });
}
