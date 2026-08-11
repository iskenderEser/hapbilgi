import { createAdminClient, createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { hataYaniti, yetkiHatasi } from '@/lib/utils/hataIsle';
import { tarihAraligi } from '@/lib/utils/tarihAraligi';
import { getTmData } from '@/lib/rapor/tm/getTmData';
import { katkiYuzdesi, tamamlanmaOrani } from '@/lib/rapor/paylasilan/oran';

const puanAlanlari = ['video_puani', 'soru_puani', 'oneri_puani', 'extra_puan', 'ileri_sarma_kaybi', 'yanlis_cevap_kaybi', 'oneri_kaybi', 'toplam_net_puan'] as const;
type PuanAlani = (typeof puanAlanlari)[number];
type PuanToplami = Record<PuanAlani, number>;
const bosPuan = (): PuanToplami => Object.fromEntries(puanAlanlari.map(alan => [alan, 0])) as PuanToplami;
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
    .select('kullanici_id, ad, soyad, rol, takim_id, firma_id')
    .eq('eposta', user.email)
    .single();
  if (kullaniciError || !kullanici) return hataYaniti('Kullanıcı bulunamadı', 'kullanici_bulamadi', kullaniciError);
  if ((kullanici.rol ?? '').toLowerCase() !== 'tm') return yetkiHatasi('Bu rapora erişim yetkiniz yok');

  const d = await getTmData(adminSupabase, kullanici, baslangic, bitis);
  if (d.hata) return d.hata;

  const genel = d.bolgePerformans.reduce((toplam, bolge) => {
    toplam.video_puani += sayi(bolge.izleme_puani);
    toplam.soru_puani += sayi(bolge.cevaplama_puani);
    toplam.oneri_puani += sayi(bolge.oneri_puani);
    toplam.extra_puan += sayi(bolge.extra_puan);
    toplam.ileri_sarma_kaybi += sayi(bolge.ileri_sarma_kaybi);
    toplam.yanlis_cevap_kaybi += sayi(bolge.yanlis_cevap_kaybi);
    toplam.oneri_kaybi += sayi(bolge.oneri_kaybi);
    toplam.toplam_net_puan += sayi(bolge.net_puan);
    return toplam;
  }, bosPuan());

  const urunBolgeToplamlari = new Map<string, PuanToplami>();
  for (const urun of d.urunBazliBolge) {
    for (const bolge of urun.bolge_listesi ?? []) {
      const mevcut = urunBolgeToplamlari.get(bolge.bolge_id) ?? bosPuan();
      for (const alan of puanAlanlari) mevcut[alan] += sayi(bolge[alan]);
      urunBolgeToplamlari.set(bolge.bolge_id, mevcut);
    }
  }
  const urunDisiBolgeler = d.bolgePerformans.flatMap(bolge => {
    const urunToplami = urunBolgeToplamlari.get(bolge.bolge_id);
    const bolgeGenel: PuanToplami = {
      video_puani: bolge.izleme_puani,
      soru_puani: bolge.cevaplama_puani,
      oneri_puani: bolge.oneri_puani,
      extra_puan: bolge.extra_puan,
      ileri_sarma_kaybi: bolge.ileri_sarma_kaybi,
      yanlis_cevap_kaybi: bolge.yanlis_cevap_kaybi,
      oneri_kaybi: bolge.oneri_kaybi,
      toplam_net_puan: bolge.net_puan,
    };
    const fark = Object.fromEntries(puanAlanlari.map(alan => [alan, bolgeGenel[alan] - sayi(urunToplami?.[alan])])) as PuanToplami;
    if (!puanAlanlari.some(alan => fark[alan] !== 0)) return [];
    return [{ bolge_id: bolge.bolge_id, bolge_adi: bolge.bolge_adi, toplam_utt: bolge.toplam_utt, ...fark }];
  });
  const icerikDagilimi = [...d.urunBazliBolge];
  if (urunDisiBolgeler.length > 0) {
    const toplamlar = Object.fromEntries(puanAlanlari.map(alan => [alan, urunDisiBolgeler.reduce((t, b) => t + b[alan], 0)])) as PuanToplami;
    icerikDagilimi.push({
      urun_id: '__urun_disi__', urun_adi: 'Ürün Dışı Eğitimler', toplam_net_puan: toplamlar.toplam_net_puan,
      bolge_listesi: urunDisiBolgeler,
      ortalama: Object.fromEntries(puanAlanlari.map(alan => [alan, Math.round(toplamlar[alan] / urunDisiBolgeler.length)])),
    });
  }
  icerikDagilimi.sort((a, b) => b.toplam_net_puan - a.toplam_net_puan);

  const kazanilanToplam = genel.video_puani + genel.soru_puani + genel.oneri_puani + genel.extra_puan;
  const kaybedilenToplam = genel.ileri_sarma_kaybi + genel.yanlis_cevap_kaybi + genel.oneri_kaybi;
  const bolgeListesi = d.bolgePerformans.map(bolge => ({
    ...bolge,
    katki_yuzdesi: katkiYuzdesi(bolge.net_puan, genel.toplam_net_puan),
    ortalama_utt_puani: bolge.toplam_utt > 0 ? Math.round(bolge.net_puan / bolge.toplam_utt) : 0,
    utt_listesi: d.uttPerformans.filter(utt => utt.bolge_id === bolge.bolge_id),
  }));

  return NextResponse.json({ success: true, data: {
    kullanici: { ad: kullanici.ad, soyad: kullanici.soyad, rol: kullanici.rol, takim_adi: d.takim?.takim_adi ?? '-', firma_adi: d.firma?.firma_adi ?? '-' },
    performans: {
      net_puan: genel.toplam_net_puan, kazanilan_toplam: kazanilanToplam, kaybedilen_toplam: kaybedilenToplam,
      ortalama_bolge_puani: d.anaOzet.toplam_bolge > 0 ? Math.round(genel.toplam_net_puan / d.anaOzet.toplam_bolge) : 0,
      en_yuksek_bolge_puani: d.bolgePerformans.reduce((en, bolge) => Math.max(en, bolge.net_puan), 0),
      izleme_puani: genel.video_puani, cevaplama_puani: genel.soru_puani, oneri_puani: genel.oneri_puani, extra_puan: genel.extra_puan,
      ileri_sarma_kaybi: genel.ileri_sarma_kaybi, yanlis_cevap_kaybi: genel.yanlis_cevap_kaybi, oneri_kaybi: genel.oneri_kaybi,
    },
    kapsam: {
      toplam_bolge: d.anaOzet.toplam_bolge, toplam_utt: d.anaOzet.toplam_utt, aktif_utt: d.anaOzet.donem_aktif_utt,
      toplam_yayin: d.anaOzet.toplam_yayin, guncel_tur_toplam_firsat: d.anaOzet.guncel_tur_toplam_firsat,
      guncel_tur_tamamlanan: d.anaOzet.guncel_tur_tamamlanan, guncel_tur_kalan: d.anaOzet.guncel_tur_kalan,
      guncel_tur_izlenme_orani: d.anaOzet.guncel_tur_izlenme_orani,
      donem_tamamlanan_izleme: d.anaOzet.donem_tamamlanan_izleme,
      donem_benzersiz_utt_yayin: d.anaOzet.donem_benzersiz_utt_yayin,
    },
    katki: { sirket_katki_yuzdesi: katkiYuzdesi(genel.toplam_net_puan, d.sirketToplamPuan), sirket_toplam_puan: d.sirketToplamPuan },
    oneri_etkinligi: {
      gonderilen: d.oneriOzet.gonderilen_oneri, tamamlanan: d.oneriOzet.tamamlanan_oneri,
      bekleyen: d.oneriOzet.bekleyen_oneri, bekleyen_oneri_olan_utt_sayisi: d.oneriOzet.bekleyen_oneri_olan_utt_sayisi,
      tamamlanma_orani: tamamlanmaOrani(d.oneriOzet.tamamlanan_oneri, d.oneriOzet.gonderilen_oneri),
    },
    bolge_listesi: bolgeListesi,
    icerik_dagilimi: icerikDagilimi,
    begeni_listesi: d.etkilesim.filter(x => x.begeni_sayisi > 0).map(x => ({ yayin_id: x.yayin_id, urun_adi: x.icerik_adi, teknik_adi: x.teknik_adi, begeni_sayisi: x.begeni_sayisi })),
    favori_listesi: d.etkilesim.filter(x => x.favori_sayisi > 0).map(x => ({ yayin_id: x.yayin_id, urun_adi: x.icerik_adi, teknik_adi: x.teknik_adi, favori_sayisi: x.favori_sayisi })),
  }});
}
