// app/analiz/api/kapsam/route.ts
import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { hataYaniti, yetkiHatasi, rolHatasi, sunucuHatasi } from '@/lib/utils/hataIsle';
import { URETICI_ROLLER, YONETICI_ROLLER, ADMIN_ROLLER } from '@/lib/utils/roller';

type GrupAdi = 'UTT' | 'Takım' | 'Bölge';

interface Secenek {
  value: string;
  label: string;
  grup: GrupAdi;
}

interface Kullanici {
  kullanici_id: string;
  rol: string;
  takim_id: string;
  bolge_id: string;
  firma_id: string;
}

// ─── Rol Bazlı Builder Fonksiyonlar ──────────────────────────────────────────

async function bmSecenekleri(adminSupabase: any, kullanici: Kullanici): Promise<{ secenekler?: Secenek[]; hata?: NextResponse }> {
  const { data: uttler, error } = await adminSupabase
    .from('kullanicilar')
    .select('kullanici_id, ad, soyad')
    .eq('bolge_id', kullanici.bolge_id)
    .in('rol', ['utt', 'kd_utt'])
    .eq('aktif_mi', true)
    .order('ad', { ascending: true });

  if (error) return { hata: hataYaniti('UTT listesi çekilemedi.', 'kullanicilar SELECT — UTT', error) };

  return {
    secenekler: [
      { value: 'utt', label: "Tüm UTT'ler", grup: 'UTT' },
      ...(uttler ?? []).map((u: any) => ({
        value: u.kullanici_id,
        label: `${u.ad} ${u.soyad}`,
        grup: 'UTT' as GrupAdi,
      })),
    ],
  };
}

async function tmSecenekleri(adminSupabase: any, kullanici: Kullanici): Promise<{ secenekler?: Secenek[]; hata?: NextResponse }> {
  const { data: bolgeler, error } = await adminSupabase
    .from('bolgeler')
    .select('bolge_id, bolge_adi')
    .eq('takim_id', kullanici.takim_id)
    .order('bolge_adi', { ascending: true });

  if (error) return { hata: hataYaniti('Bölge listesi çekilemedi.', 'bolgeler SELECT — TM', error) };

  return {
    secenekler: [
      { value: 'bolge', label: 'Tüm Bölgeler', grup: 'Bölge' },
      ...(bolgeler ?? []).map((b: any) => ({
        value: b.bolge_id,
        label: b.bolge_adi,
        grup: 'Bölge' as GrupAdi,
      })),
    ],
  };
}

async function pmSecenekleri(adminSupabase: any, kullanici: Kullanici): Promise<{ secenekler?: Secenek[]; hata?: NextResponse }> {
  const [takimRes, bolgeRes] = await Promise.all([
    adminSupabase
      .from('takimlar')
      .select('takim_id, takim_adi')
      .eq('takim_id', kullanici.takim_id)
      .single(),
    adminSupabase
      .from('bolgeler')
      .select('bolge_id, bolge_adi')
      .eq('takim_id', kullanici.takim_id)
      .order('bolge_adi', { ascending: true }),
  ]);

  if (takimRes.error) return { hata: hataYaniti('Takım bilgisi çekilemedi.', 'takimlar SELECT — PM', takimRes.error) };
  if (bolgeRes.error) return { hata: hataYaniti('Bölge listesi çekilemedi.', 'bolgeler SELECT — PM', bolgeRes.error) };

  return {
    secenekler: [
      ...(takimRes.data ? [{ value: takimRes.data.takim_id, label: takimRes.data.takim_adi, grup: 'Takım' as GrupAdi }] : []),
      { value: 'bolge', label: 'Tüm Bölgeler', grup: 'Bölge' },
      ...(bolgeRes.data ?? []).map((b: any) => ({
        value: b.bolge_id,
        label: b.bolge_adi,
        grup: 'Bölge' as GrupAdi,
      })),
    ],
  };
}

async function gmSecenekleri(adminSupabase: any, kullanici: Kullanici): Promise<{ secenekler?: Secenek[]; hata?: NextResponse }> {
  const [takimRes, bolgeRes] = await Promise.all([
    adminSupabase
      .from('takimlar')
      .select('takim_id, takim_adi')
      .eq('firma_id', kullanici.firma_id)
      .order('takim_adi', { ascending: true }),
    adminSupabase
      .from('bolgeler')
      .select('bolge_id, bolge_adi, takimlar!inner(takim_adi)')
      .eq('takimlar.firma_id', kullanici.firma_id)
      .order('bolge_adi', { ascending: true }),
  ]);

  if (takimRes.error) return { hata: hataYaniti('Takım listesi çekilemedi.', 'takimlar SELECT — GM', takimRes.error) };
  if (bolgeRes.error) return { hata: hataYaniti('Bölge listesi çekilemedi.', 'bolgeler SELECT — GM', bolgeRes.error) };

  return {
    secenekler: [
      { value: 'takim', label: 'Tüm Takımlar', grup: 'Takım' },
      ...(takimRes.data ?? []).map((t: any) => ({
        value: t.takim_id,
        label: t.takim_adi,
        grup: 'Takım' as GrupAdi,
      })),
      { value: 'bolge', label: 'Tüm Bölgeler', grup: 'Bölge' },
      ...(bolgeRes.data ?? []).map((b: any) => ({
        value: b.bolge_id,
        label: b.bolge_adi,
        grup: 'Bölge' as GrupAdi,
      })),
    ],
  };
}

// ─── Route ────────────────────────────────────────────────────────────────────

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

    const rol = (kullanici.rol ?? '').toLowerCase();

    let sonuc: { secenekler?: Secenek[]; hata?: NextResponse };

    if (rol === 'bm') {
      sonuc = await bmSecenekleri(adminSupabase, kullanici);
    } else if (rol === 'tm') {
      sonuc = await tmSecenekleri(adminSupabase, kullanici);
    } else if (URETICI_ROLLER.includes(rol)) {
      sonuc = await pmSecenekleri(adminSupabase, kullanici);
    } else if (YONETICI_ROLLER.includes(rol) || ADMIN_ROLLER.includes(rol)) {
      sonuc = await gmSecenekleri(adminSupabase, kullanici);
    } else {
      return rolHatasi('Bu sayfaya erişim yetkiniz yok');
    }

    if (sonuc.hata) return sonuc.hata;

    return NextResponse.json({ secenekler: sonuc.secenekler ?? [] }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, 'GET /analiz/api/kapsam');
  }
}