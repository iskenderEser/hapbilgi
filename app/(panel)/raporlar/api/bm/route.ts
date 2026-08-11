import { createAdminClient, createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { hataYaniti, yetkiHatasi } from '@/lib/utils/hataIsle';
import { tarihAraligi } from '@/lib/utils/tarihAraligi';
import { getBmData, type UrunBazliGrup } from '@/lib/rapor/bm/getBmData';
import { katkiYuzdesi, tamamlanmaOrani } from '@/lib/rapor/paylasilan/oran';

const puanAlanlari = [
  'video_puani',
  'soru_puani',
  'oneri_puani',
  'extra_puan',
  'ileri_sarma_kaybi',
  'yanlis_cevap_kaybi',
  'oneri_kaybi',
  'toplam_net_puan',
] as const;
type PuanAlani = (typeof puanAlanlari)[number];
type PuanToplami = Record<PuanAlani, number>;

const bosPuanToplami = (): PuanToplami => Object.fromEntries(
  puanAlanlari.map(alan => [alan, 0])
) as PuanToplami;

const sayi = (deger: unknown) => Number(deger ?? 0);

function urunToplami(urun: UrunBazliGrup): PuanToplami {
  const toplam = bosPuanToplami();
  for (const utt of urun.utt_listesi ?? []) {
    for (const alan of puanAlanlari) toplam[alan] += sayi(utt[alan]);
  }
  return toplam;
}

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

  const genel = d.uttPerformans.reduce((toplam, utt) => {
    toplam.video_puani += sayi(utt.izleme_puani);
    toplam.soru_puani += sayi(utt.cevaplama_puani);
    toplam.oneri_puani += sayi(utt.oneri_puani);
    toplam.extra_puan += sayi(utt.extra_puan);
    toplam.ileri_sarma_kaybi += sayi(utt.ileri_sarma_kaybi);
    toplam.yanlis_cevap_kaybi += sayi(utt.yanlis_cevap_kaybi);
    toplam.oneri_kaybi += sayi(utt.oneri_kaybi);
    toplam.toplam_net_puan += sayi(utt.net_puan);
    return toplam;
  }, bosPuanToplami());

  const urunler = d.urunDagilimi.map(urun => ({
    ...urun,
    puanlar: urunToplami(urun),
  }));
  const urunToplamlari = urunler.reduce((toplam, urun) => {
    for (const alan of puanAlanlari) toplam[alan] += urun.puanlar[alan];
    return toplam;
  }, bosPuanToplami());
  const urunDisiPuanlar = Object.fromEntries(
    puanAlanlari.map(alan => [alan, genel[alan] - urunToplamlari[alan]])
  ) as PuanToplami;
  const urunDisiVar = puanAlanlari.some(alan => urunDisiPuanlar[alan] !== 0);

  const icerikDagilimi = [
    ...urunler.map(urun => ({
      urun_id: urun.urun_id,
      urun_adi: urun.urun_adi,
      toplam_izlenme: sayi(urun.toplam_izlenme),
      ...urun.puanlar,
    })),
    ...(urunDisiVar ? [{
      urun_id: '__urun_disi__',
      urun_adi: 'Ürün Dışı Eğitimler',
      toplam_izlenme: 0,
      ...urunDisiPuanlar,
    }] : []),
  ].sort((a, b) => b.toplam_net_puan - a.toplam_net_puan);

  const kazanilanToplam = genel.video_puani + genel.soru_puani + genel.oneri_puani + genel.extra_puan;
  const kaybedilenToplam = genel.ileri_sarma_kaybi + genel.yanlis_cevap_kaybi + genel.oneri_kaybi;
  const toplamUtt = d.anaOzet.toplam_utt;
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
        en_yuksek_puan: d.uttPerformans.reduce((enYuksek, utt) => Math.max(enYuksek, sayi(utt.net_puan)), 0),
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
      icerik_dagilimi: icerikDagilimi,
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
