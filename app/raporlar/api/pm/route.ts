// app/raporlar/api/pm/route.ts
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { hataYaniti, yetkiHatasi } from '@/lib/utils/hataIsle';
import { tarihAraligi } from '@/lib/utils/tarihAraligi';
import { URETICI_ROLLER } from '@/lib/utils/roller';
import { UttIzlemeDurumu } from '@/lib/types/rapor';
import { getPmData } from '@/lib/rapor/pm/getPmData';

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

  const rol = (kullanici.rol ?? '').toLowerCase();
  if (!URETICI_ROLLER.includes(rol)) {
    return yetkiHatasi('Bu rapora erişim yetkiniz yok');
  }

  // UTT listesi — periyot filtreli RPC, takım bazlı
  const { data: uttRpcData, error: uttRpcError } = await adminSupabase.rpc('get_analiz_utt', {
    p_baslangic: baslangic,
    p_bitis: bitis,
    p_bolge_id: null,
    p_kullanici_id: null,
    p_takim_id: kullanici.takim_id,
  });

  if (uttRpcError) return hataYaniti('UTT verisi çekilemedi.', 'get_analiz_utt RPC', uttRpcError);

  // DB sorguları paralel
  const { hata, takim, uretimRapor, toplamYayin, urunIzleme, begeniRaw, favoriRaw } = await getPmData(adminSupabase, kullanici);
  if (hata) return hata;

  const uttSayisi = (uttRpcData ?? []).length;

  // UTT izleme durumu ve aggregation tek geçişte
  const uttIzlemeDurumu: UttIzlemeDurumu[] = [];
  let takimToplamPuan = 0;
  let toplamIzlenme = 0;
  let hicIzlemeyenUtt = 0;
  let enYuksekPuan = 0;
  let toplamIleriSarmaKaybi = 0;
  let toplamYanlisCevapKaybi = 0;
  let toplamOneriKaybi = 0;

  for (const u of uttRpcData ?? []) {
    const izlenen = u.izlenen_video_sayisi || 0;
    const puan = (u.kazanilan_izleme_puani || 0) + (u.kazanilan_cevaplama_puani || 0) + (u.kazanilan_oneri_puani || 0) + (u.kazanilan_extra_puani || 0);
    const durum: UttIzlemeDurumu['durum'] = izlenen === 0
      ? 'Hiç izlememiş'
      : izlenen >= toplamYayin
        ? 'Tamamlandı'
        : 'Devam Ediyor';

    uttIzlemeDurumu.push({
      kullanici_id: u.kullanici_id,
      ad: u.ad,
      soyad: u.soyad,
      izlenen,
      toplam: toplamYayin,
      kalan: Math.max(0, toplamYayin - izlenen),
      puan,
      durum,
    });

    takimToplamPuan += puan;
    toplamIzlenme += izlenen;
    if (izlenen === 0) hicIzlemeyenUtt++;
    if (puan > enYuksekPuan) enYuksekPuan = puan;
    toplamIleriSarmaKaybi += u.kaybedilen_ileri_sarma_puani || 0;
    toplamYanlisCevapKaybi += u.kaybedilen_yanlis_cevap_puani || 0;
    toplamOneriKaybi += Math.abs(u.kazanilan_oneri_puani < 0 ? u.kazanilan_oneri_puani : 0);
  }

  const ortalamaPuan = uttSayisi > 0 ? Math.round(takimToplamPuan / uttSayisi) : 0;
  const toplamIzlenmePotansiyeli = toplamYayin * uttSayisi;
  const izlenmeOrani = toplamIzlenmePotansiyeli > 0 ? Math.round((toplamIzlenme / toplamIzlenmePotansiyeli) * 100) : 0;
  const kalanIzlenme = Math.max(0, toplamIzlenmePotansiyeli - toplamIzlenme);

  // Üretim hattı
  const toplamTalep = uretimRapor?.toplam_talep || 0;
  const yayinda = uretimRapor?.yayindaki_talep || 0;
  const durdurulan = uretimRapor?.durdurulan_talep || 0;
  const devamEden = Math.max(0, toplamTalep - yayinda - durdurulan);

  // Ürün & teknik dağılımı
  const urunSayilari: Record<string, number> = {};
  const teknikSayilari: Record<string, number> = {};

  for (const item of urunIzleme) {
    if (item.urun_adi) urunSayilari[item.urun_adi] = (urunSayilari[item.urun_adi] || 0) + (item.izlenme_sayisi ?? 0);
    if (item.teknik_adi) teknikSayilari[item.teknik_adi] = (teknikSayilari[item.teknik_adi] || 0) + (item.izlenme_sayisi ?? 0);
  }

  return NextResponse.json({
    success: true,
    data: {
      kullanici: {
        ad: kullanici.ad,
        soyad: kullanici.soyad,
        rol: kullanici.rol,
        takim_adi: takim?.takim_adi || '-',
      },
      uretim_hatti: {
        toplam_talep: toplamTalep,
        yayinda,
        devam_eden: devamEden,
        iptal_durdurulan: durdurulan,
      },
      bekleyen_asamalar: {
        senaryo_onayi: uretimRapor?.senaryo_bekleyen || 0,
        video_onayi: uretimRapor?.video_bekleyen || 0,
        soru_seti_onayi: uretimRapor?.soru_seti_bekleyen || 0,
      },
      revizyon_oranlari: {
        senaryo_revizyon: uretimRapor?.senaryo_revizyon || 0,
        senaryo_yuzde: toplamTalep > 0 ? Math.round(((uretimRapor?.senaryo_revizyon || 0) / toplamTalep) * 100) : 0,
        video_revizyon: uretimRapor?.video_revizyon || 0,
        video_yuzde: toplamTalep > 0 ? Math.round(((uretimRapor?.video_revizyon || 0) / toplamTalep) * 100) : 0,
        soru_seti_revizyon: uretimRapor?.soru_seti_revizyon || 0,
        soru_seti_yuzde: toplamTalep > 0 ? Math.round(((uretimRapor?.soru_seti_revizyon || 0) / toplamTalep) * 100) : 0,
        ortalama_talep_yayin_suresi: uretimRapor?.ortalama_talep_yayin_suresi || 0,
      },
      yayin_performansi: {
        toplam_izlenme: toplamIzlenme,
        kalan_izlenme: kalanIzlenme,
        izlenme_orani: izlenmeOrani,
        toplam_yayin: toplamYayin,
        toplam_utt: uttSayisi,
      },
      takim_puan_ozet: {
        takim_toplam_puan: takimToplamPuan,
        ortalama_puan_utt: ortalamaPuan,
        en_yuksek_puan: enYuksekPuan,
        hic_izlemeyen_utt: hicIzlemeyenUtt,
      },
      utt_izleme_durumu: uttIzlemeDurumu,
      urun_bazli_dagilim: Object.entries(urunSayilari)
        .map(([urun_adi, izlenme_sayisi]) => ({ urun_adi, izlenme_sayisi }))
        .sort((a, b) => b.izlenme_sayisi - a.izlenme_sayisi),
      teknik_bazli_dagilim: Object.entries(teknikSayilari)
        .map(([teknik_adi, izlenme_sayisi]) => ({ teknik_adi, izlenme_sayisi }))
        .sort((a, b) => b.izlenme_sayisi - a.izlenme_sayisi),
      kayip_ozeti: {
        ileri_sarma_kaybi: toplamIleriSarmaKaybi,
        yanlis_cevap_kaybi: toplamYanlisCevapKaybi,
        oneri_kaybi: toplamOneriKaybi,
      },
      begeni_listesi: begeniRaw,
      favori_listesi: favoriRaw,
    },
  });
}