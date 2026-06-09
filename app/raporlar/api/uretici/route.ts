// app/raporlar/api/uretici/route.ts
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

  const rol = (kullanici.rol ?? '').toLowerCase();
  const yetenek = ureticiYetenegi(rol);
  if (!yetenek) {
    return yetkiHatasi('Bu rapora erişim yetkiniz yok');
  }

  const d = await getUreticiData(adminSupabase, kullanici, yetenek, baslangic, bitis);
  if (d.hata) return d.hata;

  const scopeToplamNet = d.uttOzetler.reduce((acc, o) => acc + (o.toplam_net_puan ?? 0), 0);
  const scopeToplamIzlenme = d.uttOzetler.reduce((acc, o) => acc + (o.izlenme_sayisi ?? 0), 0);
  const aktifUttSayisi = d.uttOzetler.filter(o => (o.izlenme_sayisi ?? 0) > 0).length;
  const hicIzlemeyenUtt = Math.max(0, d.toplamUttSayisi - aktifUttSayisi);
  const enYuksekUttPuan = d.uttOzetler.reduce((acc, o) => Math.max(acc, o.toplam_net_puan ?? 0), 0);

  const bolgeSayisi = d.bolgeBazli.length;
  const enYuksekBolgePuan = d.bolgeBazli.reduce((acc, b) => Math.max(acc, b.toplam_net_puan ?? 0), 0);
  const ortalamaPuanBolge = bolgeSayisi > 0
    ? Math.round(scopeToplamNet / bolgeSayisi)
    : 0;

  const toplamIzlenmePotansiyeli = d.scopeOzet.toplam_yayin * d.toplamUttSayisi;
  const izlenmeOrani = toplamIzlenmePotansiyeli > 0
    ? Math.round((scopeToplamIzlenme / toplamIzlenmePotansiyeli) * 100)
    : 0;
  const kalanIzlenme = Math.max(0, toplamIzlenmePotansiyeli - scopeToplamIzlenme);

  const sirketKatki = d.sirketToplamPuan > 0
    ? parseFloat(((scopeToplamNet / d.sirketToplamPuan) * 100).toFixed(1))
    : 0;

  const firmaSiralamasi = d.takimSirasi.map((t, idx) => ({
    sira: idx + 1,
    takim_adi: t.takim_adi,
    puan: t.toplam_puan,
    kendisi_mi: t.takim_id === kullanici.takim_id,
  }));

  const kendiSira = firmaSiralamasi.find(t => t.kendisi_mi)?.sira ?? null;

  let birUstPuanFarki: number | null = null;
  let takipciFarki: number | null = null;

  if (kendiSira && kendiSira > 1) {
    const ust = d.takimSirasi[kendiSira - 2];
    birUstPuanFarki = ust ? ust.toplam_puan - scopeToplamNet : null;
  }
  if (kendiSira && kendiSira < d.takimSirasi.length) {
    const alt = d.takimSirasi[kendiSira];
    takipciFarki = alt ? scopeToplamNet - alt.toplam_puan : null;
  }

  const oneriTamamlanmaOrani = d.scopeOzet.gonderilen_oneri > 0
    ? Math.round((d.scopeOzet.tamamlanan_oneri / d.scopeOzet.gonderilen_oneri) * 100)
    : 0;

  // bolgeListesi — takim_id ve takim_adi RPC'den geliyor, aktarılıyor
  const bolgeListesi = d.bolgeBazli.map(b => ({
    bolge_id: b.bolge_id,
    bolge_adi: b.bolge_adi,
    takim_id: b.takim_id,
    takim_adi: b.takim_adi,
    bm_adi: b.bm_adi,
    toplam_utt: b.toplam_utt,
    aktif_utt: b.aktif_utt,
    hic_izlemeyen_utt: b.hic_izlemeyen_utt,
    toplam_net_puan: b.toplam_net_puan,
    katki_yuzdesi: scopeToplamNet > 0
      ? parseFloat(((b.toplam_net_puan / scopeToplamNet) * 100).toFixed(1))
      : 0,
    ortalama_utt_puani: b.toplam_utt > 0
      ? Math.round(b.toplam_net_puan / b.toplam_utt)
      : 0,
  })).sort((a, b) => b.toplam_net_puan - a.toplam_net_puan);

  const senaryoYuzde = d.uretimOzet.toplam_talep > 0
    ? Math.round((d.uretimOzet.senaryo_revizyon / d.uretimOzet.toplam_talep) * 100)
    : 0;
  const videoYuzde = d.uretimOzet.toplam_talep > 0
    ? Math.round((d.uretimOzet.video_revizyon / d.uretimOzet.toplam_talep) * 100)
    : 0;
  const soruSetiYuzde = d.uretimOzet.toplam_talep > 0
    ? Math.round((d.uretimOzet.soru_seti_revizyon / d.uretimOzet.toplam_talep) * 100)
    : 0;

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
      yetenek: {
        raporScope: yetenek.raporScope,
        icerikTuru: yetenek.icerikTuru,
      },
      uretim_hatti: {
        toplam_talep: d.uretimOzet.toplam_talep,
        yayinda: d.uretimOzet.yayindaki_talep,
        devam_eden: d.uretimOzet.devam_eden_talep,
        iptal_durdurulan: d.uretimOzet.durdurulan_talep,
      },
      bekleyen_asamalar: {
        senaryo_onayi: d.uretimOzet.senaryo_bekleyen,
        video_onayi: d.uretimOzet.video_bekleyen,
        soru_seti_onayi: d.uretimOzet.soru_seti_bekleyen,
      },
      revizyon_oranlari: {
        senaryo_revizyon: d.uretimOzet.senaryo_revizyon,
        senaryo_yuzde: senaryoYuzde,
        video_revizyon: d.uretimOzet.video_revizyon,
        video_yuzde: videoYuzde,
        soru_seti_revizyon: d.uretimOzet.soru_seti_revizyon,
        soru_seti_yuzde: soruSetiYuzde,
        ortalama_talep_yayin_suresi: d.uretimOzet.ortalama_talep_yayin_suresi,
      },
      katki: {
        sirket_katki_yuzdesi: sirketKatki,
        scope_toplam_puan: scopeToplamNet,
        sirket_toplam_puan: d.sirketToplamPuan,
      },
      scope_ozet: {
        toplam_bolge: bolgeSayisi,
        toplam_utt: d.toplamUttSayisi,
        aktif_utt: aktifUttSayisi,
        hic_izlemeyen_utt: hicIzlemeyenUtt,
        toplam_puan: scopeToplamNet,
        ortalama_puan_bolge: ortalamaPuanBolge,
        en_yuksek_bolge_puan: enYuksekBolgePuan,
        en_yuksek_utt_puan: enYuksekUttPuan,
        izlenme_orani: izlenmeOrani,
        toplam_izlenme: scopeToplamIzlenme,
        kalan_izlenme: kalanIzlenme,
        toplam_yayin: d.scopeOzet.toplam_yayin,
      },
      lig: {
        kendi_sirasi: kendiSira,
        toplam_takim_sayisi: d.takimSirasi.length,
        bir_ust_puan_farki: birUstPuanFarki,
        takipci_farki: takipciFarki,
        firma_siralamasi: firmaSiralamasi,
      },
      oneri_etkinligi: {
        gonderilen: d.scopeOzet.gonderilen_oneri,
        tamamlanan: d.scopeOzet.tamamlanan_oneri,
        tamamlanma_orani: oneriTamamlanmaOrani,
        bekleyen: d.scopeOzet.bekleyen_oneri,
        bekleyen_oneri_olan_utt_sayisi: d.scopeOzet.bekleyen_oneri_olan_utt_sayisi,
      },
      bolge_listesi: bolgeListesi,
      urun_bazli_dagilim: d.urunBazliBolge,
      begeni_listesi: d.begeniRaw,
      favori_listesi: d.favoriRaw,
    },
  });
}