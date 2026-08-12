import { createAdminClient, createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { hataYaniti, yetkiHatasi } from '@/lib/utils/hataIsle';
import { tarihAraligi } from '@/lib/utils/tarihAraligi';
import { getBmData } from '@/lib/rapor/bm/getBmData';
import { kategorileriTopla, ozetToplami, urunleriTopla } from '@/lib/rapor/bm/toplamlar';
import { katkiYuzdesi, tamamlanmaOrani } from '@/lib/rapor/paylasilan/oran';

const sayi = (deger: unknown) => Number(deger ?? 0);

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
    .select('kullanici_id, ad, soyad, rol, bolge_id, takim_id, firma_id')
    .eq('eposta', user.email)
    .single();

  if (kullaniciError || !kullanici) {
    return hataYaniti('Kullanıcı bulunamadı', 'kullanici_bulamadi', kullaniciError);
  }
  if ((kullanici.rol ?? '').toLowerCase() !== 'bm') {
    return yetkiHatasi('Bu rapora erişim yetkiniz yok');
  }

  const d = await getBmData(adminSupabase, kullanici, baslangic, bitis);
  if (d.hata) return d.hata;

  const genel = ozetToplami(d.bolgeOzet);
  const kategoriDagilimi = kategorileriTopla(d.kategoriDagilimi);
  const urunDagilimi = urunleriTopla(d.urunDagilimi);

  const kazanilanToplam = genel.video_puani + genel.soru_puani + genel.oneri_puani + genel.extra_puan;
  const kaybedilenToplam = genel.ileri_sarma_kaybi + genel.yanlis_cevap_kaybi + genel.oneri_kaybi;
  const toplamUtt = d.bolgeOzet.length;
  const oneriTamamlanma = tamamlanmaOrani(d.oneriOzet.tamamlanan_oneri, d.oneriOzet.gonderilen_oneri);

  return NextResponse.json({
    success: true,
    data: {
      kullanici: {
        ad: kullanici.ad,
        soyad: kullanici.soyad,
        rol: kullanici.rol,
        bolge_adi: d.bolge?.bolge_adi ?? '-',
        takim_adi: d.takim?.takim_adi ?? '-',
      },
      performans: {
        net_puan: genel.toplam_net_puan,
        kazanilan_toplam: kazanilanToplam,
        kaybedilen_toplam: kaybedilenToplam,
        ortalama_puan: toplamUtt > 0 ? Math.round(genel.toplam_net_puan / toplamUtt) : 0,
        en_yuksek_puan: d.bolgeOzet.reduce((enYuksek, utt) => Math.max(enYuksek, sayi(utt.toplam_net_puan)), 0),
        izleme_puani: genel.video_puani,
        cevaplama_puani: genel.soru_puani,
        oneri_puani: genel.oneri_puani,
        extra_puan: genel.extra_puan,
        ileri_sarma_kaybi: genel.ileri_sarma_kaybi,
        yanlis_cevap_kaybi: genel.yanlis_cevap_kaybi,
        oneri_kaybi: genel.oneri_kaybi,
      },
      kapsam: {
        toplam_utt: toplamUtt,
        aktif_utt: d.anaOzet.donem_aktif_utt,
        hic_izlemeyen_utt: Math.max(0, toplamUtt - d.anaOzet.donem_aktif_utt),
        toplam_yayin: d.anaOzet.toplam_yayin,
        guncel_tur_toplam_firsat: d.anaOzet.guncel_tur_toplam_firsat,
        guncel_tur_tamamlanan: d.anaOzet.guncel_tur_tamamlanan,
        guncel_tur_kalan: d.anaOzet.guncel_tur_kalan,
        guncel_tur_izlenme_orani: d.anaOzet.guncel_tur_izlenme_orani,
        donem_tamamlanan_izleme: d.anaOzet.donem_tamamlanan_izleme,
        donem_benzersiz_utt_yayin: d.anaOzet.donem_benzersiz_utt_yayin,
      },
      katki: {
        takim_katki_yuzdesi: katkiYuzdesi(genel.toplam_net_puan, d.takimToplamPuan),
        sirket_katki_yuzdesi: katkiYuzdesi(genel.toplam_net_puan, d.sirketToplamPuan),
        takim_toplam_puan: d.takimToplamPuan,
        sirket_toplam_puan: d.sirketToplamPuan,
      },
      oneri_etkinligi: {
        gonderilen: d.oneriOzet.gonderilen_oneri,
        tamamlanan: d.oneriOzet.tamamlanan_oneri,
        bekleyen: d.oneriOzet.bekleyen_oneri,
        bekleyen_oneri_olan_utt_sayisi: d.oneriOzet.bekleyen_oneri_olan_utt_sayisi,
        tamamlanma_orani: oneriTamamlanma,
      },
      utt_performans: d.uttPerformans,
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
