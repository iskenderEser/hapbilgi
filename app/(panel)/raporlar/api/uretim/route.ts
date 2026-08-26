// app/(panel)/raporlar/api/uretim/route.ts
//
// Üretim Raporları Backend API Rotası.
// Üretici (PM, Medikal, Eğitim, İK), Yönetici ve Admin rollerine açıktır.
// Şirket düzeyinde içerik üretim hacmi, V1-V4 varyant dağılımı ve eğitim türü saha etkisini döner.

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { hataYaniti, yetkiHatasi } from '@/lib/utils/hataIsle';
import { tarihAraligi } from '@/lib/utils/tarihAraligi';
import { getUretimData, uretimRaporunuGorebilir } from '@/lib/rapor/uretim/getUretimData';

export async function GET(request: Request) {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const { searchParams } = new URL(request.url);
  const { baslangic, bitis } = tarihAraligi(searchParams.get('periyot') || 'bu_ay');

  // 1. Auth Kontrolü
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return yetkiHatasi('Oturum açılmamış');

  // 2. Kullanıcı ve Rol Çözümleme
  const { data: kullanici, error: kullaniciError } = await adminSupabase
    .from('kullanicilar')
    .select('kullanici_id, ad, soyad, rol, firma_id')
    .eq('eposta', user.email)
    .single();

  if (kullaniciError || !kullanici) {
    return hataYaniti('Kullanıcı bulunamadı', 'kullanici_bulamadi', kullaniciError);
  }

  const rol = (kullanici.rol ?? '').toLowerCase();
  const yetkili = uretimRaporunuGorebilir(rol);

  if (!yetkili) {
    return yetkiHatasi('Bu rapora erişim yetkiniz yok');
  }

  // 3. Firma Bilgisi ve Şirket Yönetici Kapsamı
  const { data: firma } = await adminSupabase
    .from('firmalar')
    .select('firma_adi')
    .eq('firma_id', kullanici.firma_id)
    .maybeSingle();

  try {
    const rapor = await getUretimData(adminSupabase, { ...kullanici, rol }, baslangic, bitis);
    return NextResponse.json({
      success: true,
      data: {
        kullanici: {
          ad: kullanici.ad, soyad: kullanici.soyad, rol: kullanici.rol,
          firma_adi: firma?.firma_adi ?? '—',
        },
        ...rapor,
      },
    });
  } catch (error) {
    return hataYaniti('Üretim raporu okunamadı.', 'getUretimData', error);
  }
}
