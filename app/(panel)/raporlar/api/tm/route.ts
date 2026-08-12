import { createAdminClient, createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { hataYaniti, yetkiHatasi } from '@/lib/utils/hataIsle';
import { tarihAraligi } from '@/lib/utils/tarihAraligi';
import { getTmData } from '@/lib/rapor/tm/getTmData';
import { kategorileriTopla, ozetToplami, urunleriTopla } from '@/lib/rapor/bm/toplamlar';
import { katkiYuzdesi } from '@/lib/rapor/paylasilan/oran';

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
  if ((kullanici.rol ?? '').toLowerCase() !== 'tm') {
    return yetkiHatasi('Bu rapora erişim yetkiniz yok');
  }

  const d = await getTmData(adminSupabase, kullanici, baslangic, bitis);
  if (d.hata) return d.hata;

  const genel = ozetToplami(d.takimOzet);
  const kategoriDagilimi = kategorileriTopla(d.kategoriDagilimi);
  const urunDagilimi = urunleriTopla(d.urunDagilimi);
  const tamamlananOneri = d.oneriDurumu.filter(oneri => oneri.durum === 'tamamlanan').length;
  const bekleyenOneri = d.oneriDurumu.filter(oneri => oneri.durum === 'bekleyen').length;
  const suresiGecmisOneri = d.oneriDurumu.filter(oneri => oneri.durum === 'suresi_gecmis').length;

  const istatistikler = {
    izleme_puani: genel.video_puani,
    cevaplama_puani: genel.soru_puani,
    oneri_puani: genel.oneri_puani,
    extra_puan: genel.extra_puan,
    ileri_sarma_kaybi: genel.ileri_sarma_kaybi,
    yanlis_cevap_kaybi: genel.yanlis_cevap_kaybi,
    oneri_kaybi: genel.oneri_kaybi,
    toplam_net_puan: genel.toplam_net_puan,
  };

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
      katki: {
        sirket_katki_yuzdesi: katkiYuzdesi(genel.toplam_net_puan, d.sirketToplamPuan),
        takim_mevcut_puan: genel.toplam_net_puan,
        sirket_toplam_puan: d.sirketToplamPuan,
      },
      bm_performans: d.bmPerformans.map(bm => ({
        ...bm,
        utt_listesi: d.uttPerformans.filter(utt => utt.bm_id === bm.bm_id),
      })),
      oneri_durumu: {
        toplam: d.oneriDurumu.length,
        tamamlanan: tamamlananOneri,
        bekleyen: bekleyenOneri,
        suresi_gecmis: suresiGecmisOneri,
        kayitlar: d.oneriDurumu,
      },
      istatistikler,
      kategori_dagilimi: kategoriDagilimi,
      urun_dagilimi: urunDagilimi,
      begeni_listesi: d.etkilesim
        .filter(satir => satir.begeni_sayisi > 0)
        .map(satir => ({
          yayin_id: satir.yayin_id,
          urun_adi: satir.icerik_adi,
          teknik_adi: satir.teknik_adi,
          begeni_sayisi: satir.begeni_sayisi,
        })),
      favori_listesi: d.etkilesim
        .filter(satir => satir.favori_sayisi > 0)
        .map(satir => ({
          yayin_id: satir.yayin_id,
          urun_adi: satir.icerik_adi,
          teknik_adi: satir.teknik_adi,
          favori_sayisi: satir.favori_sayisi,
        })),
    },
  });
}
