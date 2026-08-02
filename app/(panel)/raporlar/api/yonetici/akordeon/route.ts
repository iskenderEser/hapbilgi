// app/raporlar/api/yonetici/akordeon/route.ts
// Lazy load endpoint: takım/bölge/UTT seviyeleri.
// MODERN aile: get_takim_bazli_grup + get_bolge_bazli_grup + get_kullanici_ozet
// Anlık değerler için çok geniş periyot kullanılır (HBLigi prensibi).

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { hataYaniti, yetkiHatasi } from '@/lib/utils/hataIsle';
import { YONETICI_ROLLER } from '@/lib/utils/roller';

const ANLIK_BASLANGIC = '2000-01-01T00:00:00.000Z';

export async function GET(request: Request) {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const { searchParams } = new URL(request.url);

  const scope = searchParams.get('scope'); // 'firma' | 'takim' | 'bolge'
  const takim_id = searchParams.get('takim_id');
  const bolge_id = searchParams.get('bolge_id');

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return yetkiHatasi('Oturum açılmamış');

  const { data: kullanici, error: kullaniciError } = await adminSupabase
    .from('kullanicilar')
    .select('kullanici_id, rol, firma_id')
    .eq('eposta', user.email)
    .single();

  if (kullaniciError || !kullanici) {
    return hataYaniti('Kullanıcı bulunamadı', 'kullanici_bulamadi', kullaniciError);
  }

  if (!YONETICI_ROLLER.includes((kullanici.rol ?? '').toLowerCase())) {
    return yetkiHatasi('Bu rapora erişim yetkiniz yok');
  }

  const simdi = new Date().toISOString();

  // Firma scope → tüm takımlar (modern)
  if (scope === 'firma') {
    const { data, error } = await adminSupabase.rpc('get_takim_bazli_grup', {
      p_baslangic: ANLIK_BASLANGIC,
      p_bitis: simdi,
      p_firma_id: kullanici.firma_id,
    });
    if (error) return hataYaniti('Takım listesi alınamadı', 'get_takim_bazli_grup', error);
    return NextResponse.json({ success: true, data: data ?? [] });
  }

  // Takım scope → o takımın bölgeleri (modern)
  if (scope === 'takim' && takim_id) {
    const { data: takim, error: takimError } = await adminSupabase
      .from('takimlar')
      .select('firma_id')
      .eq('takim_id', takim_id)
      .single();
    if (takimError || !takim || takim.firma_id !== kullanici.firma_id) {
      return yetkiHatasi('Bu takıma erişim yetkiniz yok');
    }
    const { data, error } = await adminSupabase.rpc('get_bolge_bazli_grup', {
      p_baslangic: ANLIK_BASLANGIC,
      p_bitis: simdi,
      p_takim_id: takim_id,
      p_firma_id: kullanici.firma_id,
    });
    if (error) return hataYaniti('Bölge listesi alınamadı', 'get_bolge_bazli_grup', error);
    return NextResponse.json({ success: true, data: data ?? [] });
  }

  // Bölge scope → o bölgenin UTT'leri (modern)
  if (scope === 'bolge' && bolge_id) {
    const { data: bolge, error: bolgeError } = await adminSupabase
      .from('bolgeler')
      .select('takim_id, takimlar(firma_id)')
      .eq('bolge_id', bolge_id)
      .single();
    const firmaIdBolge = (bolge as any)?.takimlar?.firma_id;
    if (bolgeError || !bolge || firmaIdBolge !== kullanici.firma_id) {
      return yetkiHatasi('Bu bölgeye erişim yetkiniz yok');
    }
    const { data, error } = await adminSupabase.rpc('get_kullanici_ozet', {
      p_baslangic: ANLIK_BASLANGIC,
      p_bitis: simdi,
      p_bolge_id: bolge_id,
    });
    if (error) return hataYaniti('UTT listesi alınamadı', 'get_kullanici_ozet', error);
    return NextResponse.json({ success: true, data: data ?? [] });
  }

  return hataYaniti('Geçersiz scope parametresi', 'akordeon_scope', { scope, takim_id, bolge_id });
}