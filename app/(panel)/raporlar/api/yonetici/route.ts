// app/raporlar/api/yonetici/route.ts
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { hataYaniti, yetkiHatasi } from '@/lib/utils/hataIsle';
import { getYoneticiData } from '@/lib/rapor/yonetici/getYoneticiData';
import { YONETICI_ROLLER } from '@/lib/utils/roller';

export async function GET() {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return yetkiHatasi('Oturum açılmamış');

  const { data: kullanici, error: kullaniciError } = await adminSupabase
    .from('kullanicilar')
    .select('kullanici_id, ad, soyad, rol, firma_id')
    .eq('eposta', user.email)
    .single();

  if (kullaniciError || !kullanici) {
    return hataYaniti('Kullanıcı bulunamadı', 'kullanici_bulamadi', kullaniciError);
  }

  if (!YONETICI_ROLLER.includes((kullanici.rol ?? '').toLowerCase())) {
    return yetkiHatasi('Bu rapora erişim yetkiniz yok');
  }

  const d = await getYoneticiData(adminSupabase, kullanici);
  if (d.hata) return d.hata;

  return NextResponse.json({
    success: true,
    data: {
      kullanici: {
        ad: kullanici.ad,
        soyad: kullanici.soyad,
        rol: kullanici.rol,
        firma_adi: d.firma?.firma_adi ?? '-',
      },
      uretim: {
        sayim_kartlari: {
          urun_egitimi_sayisi: d.icerikSayim?.urun_egitimi_sayisi ?? 0,
          satis_teknikleri_sayisi: d.icerikSayim?.satis_teknikleri_sayisi ?? 0,
          medikal_toplam_sayisi: d.icerikSayim?.medikal_toplam_sayisi ?? 0,
          ik_egitimi_sayisi: d.icerikSayim?.ik_egitimi_sayisi ?? 0,
        },
        konu_listesi: d.konuListesi,
      },
      tuketim: {
        sayim_kartlari: {
          en_cok_izleyen_takim: d.anaSayfaStat?.en_cok_izleyen_takim ?? null,
          en_cok_izleyen_bolge: d.anaSayfaStat?.en_cok_izleyen_bolge ?? null,
          en_cok_izleyen_utt: d.anaSayfaStat?.en_cok_izleyen_utt ?? null,
          en_cok_extra_izlenen_video: d.extraVideo ?? null,
        },
      },
    },
  });
}