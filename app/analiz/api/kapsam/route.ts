// app/analiz/api/kapsam/route.ts
import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { hataYaniti, yetkiHatasi, rolHatasi, sunucuHatasi } from '@/lib/utils/hataIsle';

const ANALIZ_ROLLERI = ['bm', 'tm', 'pm', 'jr_pm', 'kd_pm', 'gm', 'gm_yrd', 'drk', 'paz_md', 'blm_md', 'med_md', 'grp_pm', 'sm', 'egt_md', 'egt_yrd_md', 'egt_yon', 'egt_uz'];

export async function GET() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi('Oturum açılmamış');

    const { data: kullanici, error: kullaniciError } = await adminSupabase
      .from('kullanicilar')
      .select('kullanici_id, rol, takim_id, bolge_id, firma_id')
      .eq('eposta', user.email)
      .single();

    if (kullaniciError || !kullanici) return hataYaniti('Kullanıcı bulunamadı', 'kullanicilar SELECT', kullaniciError);
    if (!ANALIZ_ROLLERI.includes(kullanici.rol)) return rolHatasi('Bu sayfaya erişim yetkiniz yok');

    const secenekler: { value: string; label: string; grup?: string }[] = [];

    if (kullanici.rol === 'bm') {
      // BM — sadece kendi bölgesindeki UTT'ler
      const { data: uttler } = await adminSupabase
        .from('kullanicilar')
        .select('kullanici_id, ad, soyad')
        .eq('bolge_id', kullanici.bolge_id)
        .in('rol', ['utt', 'kd_utt'])
        .eq('aktif_mi', true)
        .order('ad', { ascending: true });

      secenekler.push({ value: 'utt', label: 'Tüm UTT\'ler' });
      for (const u of uttler ?? []) {
        secenekler.push({ value: u.kullanici_id, label: `${u.ad} ${u.soyad}` });
      }

    } else if (kullanici.rol === 'tm') {
      // TM — kendi takımındaki bölgeler
      const { data: bolgeler } = await adminSupabase
        .from('bolgeler')
        .select('bolge_id, bolge_adi')
        .eq('takim_id', kullanici.takim_id)
        .order('bolge_adi', { ascending: true });

      secenekler.push({ value: 'bolge', label: 'Tüm Bölgeler' });
      for (const b of bolgeler ?? []) {
        secenekler.push({ value: b.bolge_id, label: b.bolge_adi });
      }

    } else if (['pm', 'jr_pm', 'kd_pm'].includes(kullanici.rol)) {
      // PM — sadece kendi takımı + takımın bölgeleri
      const { data: takim } = await adminSupabase
        .from('takimlar')
        .select('takim_id, takim_adi')
        .eq('takim_id', kullanici.takim_id)
        .single();

      if (takim) {
        secenekler.push({ value: takim.takim_id, label: takim.takim_adi, grup: 'Takım' });
      }

      const { data: bolgeler } = await adminSupabase
        .from('bolgeler')
        .select('bolge_id, bolge_adi')
        .eq('takim_id', kullanici.takim_id)
        .order('bolge_adi', { ascending: true });

      secenekler.push({ value: 'bolge', label: 'Tüm Bölgeler', grup: 'Bölge' });
      for (const b of bolgeler ?? []) {
        secenekler.push({ value: b.bolge_id, label: b.bolge_adi, grup: 'Bölge' });
      }

    } else {
      // GM ve üstü — tüm takımlar + tüm bölgeler
      const { data: takimlar } = await adminSupabase
        .from('takimlar')
        .select('takim_id, takim_adi')
        .eq('firma_id', kullanici.firma_id)
        .order('takim_adi', { ascending: true });

      secenekler.push({ value: 'takim', label: 'Tüm Takımlar', grup: 'Takım' });
      for (const t of takimlar ?? []) {
        secenekler.push({ value: t.takim_id, label: t.takim_adi, grup: 'Takım' });
      }

      const { data: bolgeler } = await adminSupabase
        .from('bolgeler')
        .select('bolge_id, bolge_adi, takim_id, takimlar(takim_adi)')
        .eq('takimlar.firma_id', kullanici.firma_id)
        .order('bolge_adi', { ascending: true });

      secenekler.push({ value: 'bolge', label: 'Tüm Bölgeler', grup: 'Bölge' });
      for (const b of bolgeler ?? []) {
        secenekler.push({ value: b.bolge_id, label: b.bolge_adi, grup: 'Bölge' });
      }
    }

    return NextResponse.json({ secenekler }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, 'GET /analiz/api/kapsam');
  }
}