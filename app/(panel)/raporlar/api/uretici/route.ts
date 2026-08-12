import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { hataYaniti, yetkiHatasi } from '@/lib/utils/hataIsle';
import { tarihAraligi } from '@/lib/utils/tarihAraligi';
import { ureticiYetenegi } from '@/lib/uretici/yetenekler';
import { getUreticiData } from '@/lib/rapor/uretici/getUreticiData';

export async function GET(request: Request) {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const { searchParams } = new URL(request.url);
  const periyot = searchParams.get('periyot') || 'bu_ay';
  const { baslangic, bitis } = tarihAraligi(periyot);

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return yetkiHatasi('Oturum açılmamış');

  const { data: kullanici, error: kullaniciError } = await adminSupabase
    .from('kullanicilar')
    .select('kullanici_id, ad, soyad, rol, takim_id, firma_id')
    .eq('eposta', user.email)
    .single();

  if (kullaniciError || !kullanici) {
    return hataYaniti('Kullanıcı bulunamadı', 'kullanici_bulamadi', kullaniciError);
  }

  const yetenek = ureticiYetenegi((kullanici.rol ?? '').toLowerCase());
  if (!yetenek) return yetkiHatasi('Bu rapora erişim yetkiniz yok');

  const d = await getUreticiData(adminSupabase, kullanici, yetenek, baslangic, bitis);
  if (d.hata) return d.hata;

  const saha = d.sahaOzetleri.reduce(
    (toplam, satir) => ({
      tamamlanan_izleme: toplam.tamamlanan_izleme + Number(satir.izlenme_sayisi ?? 0),
      toplam_puan: toplam.toplam_puan + Number(satir.toplam_net_puan ?? 0),
      aktif_utt: toplam.aktif_utt + (Number(satir.izlenme_sayisi ?? 0) > 0 ? 1 : 0),
    }),
    { tamamlanan_izleme: 0, toplam_puan: 0, aktif_utt: 0 }
  );

  const etkilesimAdi = (urunAdi: string | null, teknikAdi: string | null) => ({
    urun_adi: urunAdi ?? 'Ürün dışı eğitim',
    teknik_adi: teknikAdi ?? 'Teknik belirtilmemiş',
  });

  return NextResponse.json({
    success: true,
    data: {
      kullanici: {
        ad: kullanici.ad,
        soyad: kullanici.soyad,
        rol: kullanici.rol,
        takim_adi: d.takim?.takim_adi ?? '-',
        firma_adi: d.firma?.firma_adi ?? '-',
      },
      kapsam: {
        tur: yetenek.raporScope,
        ad: yetenek.raporScope === 'takim'
          ? (d.takim?.takim_adi ?? 'Takım')
          : (d.firma?.firma_adi ?? 'Firma'),
      },
      uretim_ozeti: d.raporOzet,
      saha_etkisi: saha,
      begeni_listesi: d.begeniRaw.map(satir => ({
        yayin_id: satir.yayin_id,
        ...etkilesimAdi(satir.urun_adi, satir.teknik_adi),
        begeni_sayisi: Number(satir.begeni_sayisi ?? 0),
      })),
      favori_listesi: d.favoriRaw.map(satir => ({
        yayin_id: satir.yayin_id,
        ...etkilesimAdi(satir.urun_adi, satir.teknik_adi),
        favori_sayisi: Number(satir.favori_sayisi ?? 0),
      })),
    },
  });
}
