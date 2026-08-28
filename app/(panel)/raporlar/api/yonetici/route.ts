import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { hataYaniti, yetkiHatasi } from '@/lib/utils/hataIsle';
import { getYoneticiData } from '@/lib/rapor/yonetici/getYoneticiData';
import { YONETICI_ROLLER } from '@/lib/utils/roller';
import { tarihAraligi } from '@/lib/utils/tarihAraligi';
import { aracTuruDagilimi } from '@/lib/rapor/paylasilan/aracTuruDagilimi';
import {
  TALEP_TURU_SIRA,
  isTalepTuru,
  talepTuruAdi,
  type TalepTuru,
} from '@/lib/uretici/yetenekler';

const sayi = (deger: unknown) => Number(deger ?? 0);

export async function GET(request: Request) {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const { searchParams } = new URL(request.url);
  const { baslangic, bitis } = tarihAraligi(searchParams.get('periyot') || 'bu_ay');

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

  const d = await getYoneticiData(adminSupabase, kullanici, baslangic, bitis);
  if (d.hata) return d.hata;
  const aracTurleri = await aracTuruDagilimi(adminSupabase, { baslangic, bitis, firmaId: kullanici.firma_id });
  const o = d.ozet ?? {};
  const egitimHaritasi = new Map<TalepTuru, Record<string, unknown>>();
  for (const ham of d.egitimTurleri as Record<string, unknown>[]) {
    if (isTalepTuru(ham.egitim_turu)) egitimHaritasi.set(ham.egitim_turu, ham);
  }
  const egitimTurleri = TALEP_TURU_SIRA.map((tur) => {
    const ham = egitimHaritasi.get(tur) ?? {};
    return {
      egitim_turu: tur,
      egitim_adi: talepTuruAdi(tur),
      donemde_yayina_alinan: sayi(ham.donemde_yayina_alinan),
      tamamlanan_izleme: sayi(ham.tamamlanan_izleme),
      izleme_puani: sayi(ham.izleme_puani),
      cevaplama_puani: sayi(ham.cevaplama_puani),
      oneri_puani: sayi(ham.oneri_puani),
      extra_puani: sayi(ham.extra_puani),
      ileri_sarma_kaybi: sayi(ham.ileri_sarma_kaybi),
      yanlis_cevap_kaybi: sayi(ham.yanlis_cevap_kaybi),
      oneri_kaybi: sayi(ham.oneri_kaybi),
      challenge_kaybi: sayi(ham.challenge_kaybi),
      kazanilan_toplam: sayi(ham.kazanilan_toplam),
      kaybedilen_toplam: sayi(ham.kaybedilen_toplam),
      net_puan: sayi(ham.net_puan),
      begeni_sayisi: sayi(ham.begeni_sayisi),
      favori_sayisi: sayi(ham.favori_sayisi),
      extra_izleme_sayisi: sayi(ham.extra_izleme_sayisi),
      urun_dagilimi: Array.isArray(ham.urun_dagilimi) ? ham.urun_dagilimi : [],
    };
  });

  return NextResponse.json({
    success: true,
    data: {
      kullanici: {
        ad: kullanici.ad,
        soyad: kullanici.soyad,
        rol: kullanici.rol,
        firma_adi: d.firma?.firma_adi ?? '—',
      },
      performans: {
        izleme_puani: sayi(o.izleme_puani),
        cevaplama_puani: sayi(o.cevaplama_puani),
        oneri_puani: sayi(o.oneri_puani),
        extra_puani: sayi(o.extra_puani),
        ileri_sarma_kaybi: sayi(o.ileri_sarma_kaybi),
        yanlis_cevap_kaybi: sayi(o.yanlis_cevap_kaybi),
        oneri_kaybi: sayi(o.oneri_kaybi),
        challenge_kaybi: sayi(o.challenge_kaybi),
        kazanilan_toplam: sayi(o.kazanilan_toplam),
        kaybedilen_toplam: sayi(o.kaybedilen_toplam),
        net_puan: sayi(o.net_puan),
      },
      arac_turu_dagilimi: aracTurleri,
      kapsam: {
        toplam_takim: sayi(o.toplam_takim),
        toplam_bolge: sayi(o.toplam_bolge),
        toplam_utt: sayi(o.toplam_utt),
        aktif_utt: sayi(o.aktif_utt),
        donem_tamamlanan_izleme: sayi(o.donem_tamamlanan_izleme),
        donem_benzersiz_utt_yayin: sayi(o.donem_benzersiz_utt_yayin),
        guncel_tur_toplam_firsat: sayi(o.guncel_tur_toplam_firsat),
        guncel_tur_tamamlanan: sayi(o.guncel_tur_tamamlanan),
        guncel_tur_kalan: sayi(o.guncel_tur_kalan),
        guncel_tur_izlenme_orani: sayi(o.guncel_tur_izlenme_orani),
      },
      uretim: {
        toplam_yayina_alma: sayi(o.toplam_yayina_alma),
        donemde_yayina_alinan: sayi(o.donemde_yayina_alinan),
        su_an_yayinda: sayi(o.su_an_yayinda),
        turler: egitimTurleri.map((tur) => ({
          kod: tur.egitim_turu,
          ad: tur.egitim_adi,
          adet: tur.donemde_yayina_alinan,
        })),
        varyantlar: [
          { kod: 'normal', ad: 'Tam Üretim', adet: sayi(o.donem_normal_uretim) },
          { kod: 'hazir_video', ad: 'Hazır Video', adet: sayi(o.donem_hazir_video) },
          { kod: 'hazir_set', ad: 'Hazır Soru Seti', adet: sayi(o.donem_hazir_soru_seti) },
          { kod: 'hazir_ikisi', ad: 'Hazır Video + Set', adet: sayi(o.donem_hazir_video_ve_soru_seti) },
        ],
      },
      takimlar: d.takimlar,
      egitim_turu_etkisi: egitimTurleri,
    },
  });
}
