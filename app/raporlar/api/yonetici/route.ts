// app/raporlar/api/yonetici/route.ts
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { hataYaniti, yetkiHatasi } from '@/lib/utils/hataIsle';
import { tarihAraligi } from '@/lib/utils/tarihAraligi';
import { getYoneticiData } from '@/lib/rapor/yonetici/getYoneticiData';
import { aggregateTakim } from '@/lib/rapor/yonetici/aggregateTakim';
import { aggregatePm } from '@/lib/rapor/yonetici/aggregatePm';
import { PmUretimItem } from '@/lib/types/rapor';
import { YONETICI_ROLLER } from '@/lib/utils/roller';

export async function GET(request: Request) {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const { searchParams } = new URL(request.url);
  const periyot = searchParams.get('periyot') || 'bu_ay';
  const { baslangic, bitis } = tarihAraligi(periyot);

  // Auth
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return yetkiHatasi('Oturum açılmamış');

  // Kullanıcı
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

  // Veri
  const d = await getYoneticiData(adminSupabase, kullanici, baslangic, bitis);
  if (d.hata) return d.hata;

  // ─── Takım aggregate ─────────────────────────────────────────────────────

  const {
    takimSiralamasi,
    ortalamaTakim,
    toplamPuan,
    enYuksekPuan,
    toplamUtt,
    aktifUtt,
    hicIzlemeyenUtt,
    toplamIzlenme,
    toplamOneri,
    bekleyenOneri,
    toplamIleriSarmaKaybi,
    toplamYanlisCevapKaybi,
    toplamYayinSayisi,
  } = aggregateTakim(d.takimRpcData, d.tmMap);

  // ─── PM üretim aggregate ─────────────────────────────────────────────────

  const {
    toplamTalep,
    yayindakiTalep,
    devamEdenTalep,
    durdurulanTalep,
    senaryoBekleyen,
    videoBekleyen,
    soruSetiBekleyen,
    senaryoRevizyon,
    videoRevizyon,
    soruSetiRevizyon,
    ortalamaTalepYayinSuresi,
  } = aggregatePm(d.pmUretimListesi);

  // ─── Şirket özeti ────────────────────────────────────────────────────────

  const takimSayisi = takimSiralamasi.length;
  const ortalamaPuanTakim = takimSayisi > 0 ? Math.round(toplamPuan / takimSayisi) : 0;
  const toplamIzlenmePotansiyeli = toplamYayinSayisi * toplamUtt;
  const izlenmeOrani = toplamIzlenmePotansiyeli > 0
    ? Math.round((toplamIzlenme / toplamIzlenmePotansiyeli) * 100)
    : 0;
  const kalanIzlenme = Math.max(0, toplamIzlenmePotansiyeli - toplamIzlenme);
  const tamamlananOneri = toplamOneri - bekleyenOneri;
  const tamamlanmaOrani = toplamOneri > 0
    ? Math.round((tamamlananOneri / toplamOneri) * 100)
    : 0;

  // ─── Ürün & teknik dağılımı ──────────────────────────────────────────────

  const urunDagilim: Record<string, number> = {};
  const teknikDagilim: Record<string, number> = {};

  for (const item of d.urunIzleme) {
    if (item.urun_adi) urunDagilim[item.urun_adi] = (urunDagilim[item.urun_adi] ?? 0) + (item.izlenme_sayisi ?? 0);
    if (item.teknik_adi) teknikDagilim[item.teknik_adi] = (teknikDagilim[item.teknik_adi] ?? 0) + (item.izlenme_sayisi ?? 0);
  }

  // ─── Response ────────────────────────────────────────────────────────────

  return NextResponse.json({
    success: true,
    data: {
      kullanici: {
        ad: kullanici.ad,
        soyad: kullanici.soyad,
        rol: kullanici.rol,
        firma_adi: d.firma?.firma_adi ?? '-',
      },
      sirket_ozet: {
        toplam_takim: takimSayisi,
        toplam_utt: toplamUtt,
        aktif_utt: aktifUtt,
        hic_izlemeyen_utt: hicIzlemeyenUtt,
        toplam_puan: toplamPuan,
        ortalama_puan_takim: ortalamaPuanTakim,
        en_yuksek_puan: enYuksekPuan,
        toplam_yayin: toplamYayinSayisi,
      },
      izlenme_ozet: {
        toplam_izlenme: toplamIzlenme,
        kalan_izlenme: kalanIzlenme,
        izlenme_orani: izlenmeOrani,
        potansiyel_toplam: toplamIzlenmePotansiyeli,
      },
      uretim_hatti: {
        toplam_talep: toplamTalep,
        yayinda: yayindakiTalep,
        devam_eden: devamEdenTalep,
        iptal_durdurulan: durdurulanTalep,
      },
      bekleyen_asamalar: {
        senaryo_onayi: senaryoBekleyen,
        video_onayi: videoBekleyen,
        soru_seti_onayi: soruSetiBekleyen,
      },
      revizyon_oranlari: {
        senaryo_revizyon: senaryoRevizyon,
        senaryo_yuzde: toplamTalep > 0 ? Math.round((senaryoRevizyon / toplamTalep) * 100) : 0,
        video_revizyon: videoRevizyon,
        video_yuzde: toplamTalep > 0 ? Math.round((videoRevizyon / toplamTalep) * 100) : 0,
        soru_seti_revizyon: soruSetiRevizyon,
        soru_seti_yuzde: toplamTalep > 0 ? Math.round((soruSetiRevizyon / toplamTalep) * 100) : 0,
        ortalama_talep_yayin_suresi: ortalamaTalepYayinSuresi,
      },
      takim_siralamasi: takimSiralamasi,
      ortalama_takim: ortalamaTakim,
      oneri_etkinligi: {
        gonderilen: toplamOneri,
        tamamlanan: tamamlananOneri,
        tamamlanma_orani: tamamlanmaOrani,
        bekleyen: bekleyenOneri,
      },
      kayip_ozeti: {
        ileri_sarma_kaybi: toplamIleriSarmaKaybi,
        yanlis_cevap_kaybi: toplamYanlisCevapKaybi,
      },
      urun_bazli_dagilim: Object.entries(urunDagilim)
        .map(([urun_adi, izlenme_sayisi]) => ({ urun_adi, izlenme_sayisi }))
        .sort((a, b) => b.izlenme_sayisi - a.izlenme_sayisi),
      teknik_bazli_dagilim: Object.entries(teknikDagilim)
        .map(([teknik_adi, izlenme_sayisi]) => ({ teknik_adi, izlenme_sayisi }))
        .sort((a, b) => b.izlenme_sayisi - a.izlenme_sayisi),
      begeni_listesi: d.begeniRaw,
      favori_listesi: d.favoriRaw,
    },
  });
}