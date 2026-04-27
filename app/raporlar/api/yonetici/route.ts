import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { hataYaniti, yetkiHatasi } from '@/lib/utils/hataIsle';

const YONETICI_ROLLERI = [
  'gm', 'gm_yrd', 'drk', 'paz_md', 'blm_md', 'med_md',
  'grp_pm', 'sm', 'egt_md', 'egt_yrd_md', 'egt_yon', 'egt_uz',
];

function tarihAraligi(periyot: string): { baslangic: string; bitis: string } {
  const simdi = new Date();
  const bitis = simdi.toISOString();

  if (periyot === 'bu_hafta') {
    const gun = simdi.getDay();
    const fark = gun === 0 ? 6 : gun - 1;
    const pazartesi = new Date(simdi);
    pazartesi.setDate(simdi.getDate() - fark);
    pazartesi.setHours(0, 0, 0, 0);
    return { baslangic: pazartesi.toISOString(), bitis };
  }

  if (periyot === 'gecen_ay') {
    const baslangic = new Date(simdi.getFullYear(), simdi.getMonth() - 1, 1);
    const bitis2 = new Date(simdi.getFullYear(), simdi.getMonth(), 0, 23, 59, 59);
    return { baslangic: baslangic.toISOString(), bitis: bitis2.toISOString() };
  }

  const baslangic = new Date(simdi.getFullYear(), simdi.getMonth(), 1);
  return { baslangic: baslangic.toISOString(), bitis };
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const periyot = searchParams.get('periyot') || 'bu_ay';
  const { baslangic, bitis } = tarihAraligi(periyot);

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return yetkiHatasi('Oturum açılmamış');

  const { data: kullanici, error: kullaniciError } = await supabase
    .from('kullanicilar')
    .select('kullanici_id, ad, soyad, rol, firma_id')
    .eq('eposta', user.email)
    .single();

  if (kullaniciError || !kullanici) {
    return hataYaniti('Kullanıcı bulunamadı', 'kullanici_bulamadi', kullaniciError);
  }

  if (!YONETICI_ROLLERI.includes(kullanici.rol)) {
    return yetkiHatasi('Bu rapora erişim yetkiniz yok');
  }

  // 1. Firma adı
  const { data: firma } = await supabase
    .from('firmalar')
    .select('firma_adi')
    .eq('firma_id', kullanici.firma_id)
    .maybeSingle();

  // 2. Şirket raporu (v_rapor_sirket)
  const { data: sirketRapor } = await supabase
    .from('v_rapor_sirket')
    .select('toplam_takim, toplam_utt, aktif_utt, hic_izlememis_utt, toplam_puan, ortalama_puan_takim, video_puani, soru_puani, oneri_puani, extra_puan, ileri_sarma_kaybi, yanlis_cevap_kaybi, oneri_kaybi, toplam_izleme, toplam_oneri, tamamlanan_oneri, bekleyen_oneri, toplam_yayin')
    .eq('firma_id', kullanici.firma_id)
    .maybeSingle();

  // 3. Takım listesi (v_rapor_takim — takim_adi dahil)
  const { data: takimListesi } = await supabase
    .from('v_rapor_takim')
    .select('takim_id, takim_adi, toplam_puan, video_puani, soru_puani, oneri_puani, extra_puan, ileri_sarma_kaybi, yanlis_cevap_kaybi, oneri_kaybi, toplam_utt, aktif_utt, hic_izlememis_utt, toplam_izleme')
    .eq('firma_id', kullanici.firma_id)
    .order('toplam_puan', { ascending: false });

  // 4. TM bilgilerini tek sorguda çek
  const takimIdleri = (takimListesi || []).map(t => t.takim_id);
  const { data: tmListesi } = await supabase
    .from('kullanicilar')
    .select('takim_id, ad, soyad')
    .in('takim_id', takimIdleri)
    .eq('rol', 'tm');

  const tmMap: Record<string, string> = {};
  for (const tm of tmListesi || []) {
    tmMap[tm.takim_id] = `${tm.ad} ${tm.soyad}`;
  }

  // 5. Takım puan hesapları
  const toplamPuan = (takimListesi || []).reduce((s, t) => s + (t.toplam_puan || 0), 0);
  const takimSayisi = takimListesi?.length || 0;
  const ortalamaPuanTakim = takimSayisi > 0 ? Math.round(toplamPuan / takimSayisi) : 0;
  const enYuksekPuan = takimSayisi > 0 ? Math.max(...(takimListesi || []).map(t => t.toplam_puan || 0)) : 0;

  // 6. İzlenme
  const toplamYayin = sirketRapor?.toplam_yayin || 0;
  const toplamUtt = sirketRapor?.toplam_utt || 0;
  const toplamIzlenme = sirketRapor?.toplam_izleme || 0;
  const toplamIzlenmePotansiyeli = toplamYayin * toplamUtt;
  const izlenmeOrani = toplamIzlenmePotansiyeli > 0 ? Math.round((toplamIzlenme / toplamIzlenmePotansiyeli) * 100) : 0;
  const kalanIzlenme = Math.max(0, toplamIzlenmePotansiyeli - toplamIzlenme);

  // 7. İçerik üretim hattı — sadece bu firmanın PM'leri
  const { data: firmaKullanicilari } = await supabase
    .from('kullanicilar')
    .select('kullanici_id')
    .eq('firma_id', kullanici.firma_id)
    .in('rol', ['pm', 'jr_pm', 'kd_pm']);

  const pmIdleri = (firmaKullanicilari || []).map(k => k.kullanici_id);

  const { data: pmUretimListesi } = pmIdleri.length > 0
    ? await supabase
        .from('v_rapor_pm_uretim')
        .select('toplam_talep, yayindaki_talep, durdurulan_talep, senaryo_bekleyen, video_bekleyen, soru_seti_bekleyen, senaryo_revizyon, video_revizyon, soru_seti_revizyon, ortalama_talep_yayin_suresi')
        .in('pm_id', pmIdleri)
    : { data: [] };

  const toplamTalep = (pmUretimListesi || []).reduce((s, p) => s + (p.toplam_talep || 0), 0);
  const yayindakiTalep = (pmUretimListesi || []).reduce((s, p) => s + (p.yayindaki_talep || 0), 0);
  const durdurulanTalep = (pmUretimListesi || []).reduce((s, p) => s + (p.durdurulan_talep || 0), 0);
  const devamEdenTalep = Math.max(0, toplamTalep - yayindakiTalep - durdurulanTalep);

  const senaryoBekleyen = (pmUretimListesi || []).reduce((s, p) => s + (p.senaryo_bekleyen || 0), 0);
  const videoBekleyen = (pmUretimListesi || []).reduce((s, p) => s + (p.video_bekleyen || 0), 0);
  const soruSetiBekleyen = (pmUretimListesi || []).reduce((s, p) => s + (p.soru_seti_bekleyen || 0), 0);
  const senaryoRevizyon = (pmUretimListesi || []).reduce((s, p) => s + (p.senaryo_revizyon || 0), 0);
  const videoRevizyon = (pmUretimListesi || []).reduce((s, p) => s + (p.video_revizyon || 0), 0);
  const soruSetiRevizyon = (pmUretimListesi || []).reduce((s, p) => s + (p.soru_seti_revizyon || 0), 0);

  const sureler = (pmUretimListesi || []).filter(p => (p.ortalama_talep_yayin_suresi || 0) > 0).map(p => p.ortalama_talep_yayin_suresi || 0);
  const ortalamaTalepYayinSuresi = sureler.length > 0 ? Math.round(sureler.reduce((a, b) => a + b, 0) / sureler.length) : 0;

  // 8. Öneri istatistikleri
  const toplamOneri = sirketRapor?.toplam_oneri || 0;
  const tamamlananOneri = sirketRapor?.tamamlanan_oneri || 0;
  const bekleyenOneri = sirketRapor?.bekleyen_oneri || 0;
  const tamamlanmaOrani = toplamOneri > 0 ? Math.round((tamamlananOneri / toplamOneri) * 100) : 0;

  // 9. Ürün & teknik dağılımı (v_rapor_urun_izlenme — firma geneli)
  const { data: urunIzleme } = await supabase
    .from('v_rapor_urun_izlenme')
    .select('urun_adi, teknik_adi, izlenme_sayisi')
    .eq('firma_id', kullanici.firma_id);

  const urunSayilari: Record<string, number> = {};
  const teknikSayilari: Record<string, number> = {};

  for (const item of urunIzleme || []) {
    if (item.urun_adi) urunSayilari[item.urun_adi] = (urunSayilari[item.urun_adi] || 0) + (item.izlenme_sayisi || 1);
    if (item.teknik_adi) teknikSayilari[item.teknik_adi] = (teknikSayilari[item.teknik_adi] || 0) + (item.izlenme_sayisi || 1);
  }

  // 10. Takım izlenme oranı hesabı
  const takimSiralamasi = (takimListesi || []).map((t, idx) => {
    const takimIzlenmePotansiyeli = toplamYayin * (t.toplam_utt || 0);
    const takimIzlenmeOrani = takimIzlenmePotansiyeli > 0
      ? Math.round(((t.toplam_izleme || 0) / takimIzlenmePotansiyeli) * 100)
      : 0;

    return {
      sira: idx + 1,
      takim_id: t.takim_id,
      takim_adi: t.takim_adi,
      tm: tmMap[t.takim_id] || '-',
      puan: t.toplam_puan || 0,
      katki_yuzdesi: toplamPuan > 0 ? parseFloat(((t.toplam_puan || 0) / toplamPuan * 100).toFixed(1)) : 0,
      video_puani: t.video_puani || 0,
      soru_puani: t.soru_puani || 0,
      oneri_puani: t.oneri_puani || 0,
      extra_puan: t.extra_puan || 0,
      kayiplar: (t.ileri_sarma_kaybi || 0) + (t.yanlis_cevap_kaybi || 0) + (t.oneri_kaybi || 0),
      izlenme_orani: takimIzlenmeOrani,
      toplam_utt: t.toplam_utt || 0,
      aktif_utt: t.aktif_utt || 0,
    };
  });

  // 11. Ortalama takım verileri
  const ortalamaTakim = {
    puan: ortalamaPuanTakim,
    video_puani: takimSayisi > 0 ? Math.round((takimListesi || []).reduce((s, t) => s + (t.video_puani || 0), 0) / takimSayisi) : 0,
    soru_puani: takimSayisi > 0 ? Math.round((takimListesi || []).reduce((s, t) => s + (t.soru_puani || 0), 0) / takimSayisi) : 0,
    oneri_puani: takimSayisi > 0 ? Math.round((takimListesi || []).reduce((s, t) => s + (t.oneri_puani || 0), 0) / takimSayisi) : 0,
    extra_puan: takimSayisi > 0 ? Math.round((takimListesi || []).reduce((s, t) => s + (t.extra_puan || 0), 0) / takimSayisi) : 0,
    kayiplar: takimSayisi > 0 ? Math.round((takimListesi || []).reduce((s, t) => s + Math.abs((t.ileri_sarma_kaybi || 0) + (t.yanlis_cevap_kaybi || 0) + (t.oneri_kaybi || 0)), 0) / takimSayisi) : 0,
  };

  return NextResponse.json({
    success: true,
    data: {
      kullanici: {
        ad: kullanici.ad,
        soyad: kullanici.soyad,
        rol: kullanici.rol,
        firma_adi: firma?.firma_adi || '-',
      },
      sirket_ozet: {
        toplam_takim: takimSayisi,
        toplam_utt: toplamUtt,
        aktif_utt: sirketRapor?.aktif_utt || 0,
        hic_izlemeyen_utt: sirketRapor?.hic_izlememis_utt || 0,
        toplam_puan: toplamPuan,
        ortalama_puan_takim: ortalamaPuanTakim,
        en_yuksek_puan: enYuksekPuan,
        toplam_yayin: toplamYayin,
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
      urun_bazli_dagilim: Object.entries(urunSayilari)
        .map(([urun_adi, izlenme_sayisi]) => ({ urun_adi, izlenme_sayisi }))
        .sort((a, b) => b.izlenme_sayisi - a.izlenme_sayisi),
      teknik_bazli_dagilim: Object.entries(teknikSayilari)
        .map(([teknik_adi, izlenme_sayisi]) => ({ teknik_adi, izlenme_sayisi }))
        .sort((a, b) => b.izlenme_sayisi - a.izlenme_sayisi),
      kayip_ozeti: {
        ileri_sarma_kaybi: sirketRapor?.ileri_sarma_kaybi || 0,
        yanlis_cevap_kaybi: sirketRapor?.yanlis_cevap_kaybi || 0,
        oneri_kaybi: sirketRapor?.oneri_kaybi || 0,
      },
    },
  });
}