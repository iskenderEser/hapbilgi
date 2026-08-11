// app/raporlar/api/uretici/route.ts
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { hataYaniti, yetkiHatasi } from '@/lib/utils/hataIsle';
import { tarihAraligi } from '@/lib/utils/tarihAraligi';
import { ureticiYetenegi } from '@/lib/uretici/yetenekler';
import { getUreticiData } from '@/lib/rapor/uretici/getUreticiData';
import { uttOzetAgregasyon } from '@/lib/rapor/paylasilan/agregasyon';
import { katkiYuzdesi, tamamlanmaOrani } from '@/lib/rapor/paylasilan/oran';
import { ligSiralamasi } from '@/lib/rapor/paylasilan/ligSira';

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

  // ─── Scope agregasyonu — paylaşılan helper ──────────────────────────────
  const a = uttOzetAgregasyon(d.uttOzetler, d.toplamUttSayisi);

  // Bölge sayısı + bölge bazlı en yüksek + ortalama
  const bolgeSayisi = d.bolgeBazli.length;
  const enYuksekBolgePuan = d.bolgeBazli.reduce((acc, b) => Math.max(acc, b.toplam_net_puan ?? 0), 0);
  const ortalamaPuanBolge = bolgeSayisi > 0 ? Math.round(a.toplamNet / bolgeSayisi) : 0;

  // ─── Şirket katkısı — paylaşılan helper ─────────────────────────────────
  const sirketKatki = katkiYuzdesi(a.toplamNet, d.sirketToplamPuan);

  // ─── HBLigi — takım sıralaması — paylaşılan helper ──────────────────────
  const ligGiris = d.takimSirasi.map(t => ({
    id: t.takim_id,
    ad: t.takim_adi,
    toplam_puan: t.toplam_puan,
  }));
  const lig = ligSiralamasi(ligGiris, kullanici.takim_id ?? '', a.toplamNet);

  // ─── Öneri etkinliği — paylaşılan helper ────────────────────────────────
  const oneriOrani = tamamlanmaOrani(d.scopeOzet.tamamlanan_oneri, d.scopeOzet.gonderilen_oneri);

  // ─── Bölge listesi inşası ───────────────────────────────────────────────
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
    katki_yuzdesi: katkiYuzdesi(b.toplam_net_puan, a.toplamNet),
    ortalama_utt_puani: b.toplam_utt > 0 ? Math.round(b.toplam_net_puan / b.toplam_utt) : 0,
  })).sort((x, y) => y.toplam_net_puan - x.toplam_net_puan);

  // Revizyon oranı olay adedini değil, revizyon gören benzersiz talebi ölçer.
  const revizyonPaydasi = d.anaOzet.donemde_yayina_alinan;
  const senaryoYuzde = tamamlanmaOrani(d.anaOzet.senaryo_revizyonlu_talep, revizyonPaydasi);
  const videoYuzde = tamamlanmaOrani(d.anaOzet.video_revizyonlu_talep, revizyonPaydasi);
  const soruSetiYuzde = tamamlanmaOrani(d.anaOzet.soru_seti_revizyonlu_talep, revizyonPaydasi);

  // Ürün künyesi olmayan puanlar eski ürün RPC'sinde doğal olarak dışarıda
  // kalır. Bölge toplamı ile ürün toplamlarının farkını ayrı, görünür bir
  // eğitim grubu olarak ekleyerek dağılımı scope net puanıyla mutabık tutarız.
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
  const sayi = (deger: unknown) => Number(deger ?? 0);
  const urunBolgeToplamlari = new Map<string, Record<(typeof puanAlanlari)[number], number>>();

  for (const urun of d.urunBazliBolge) {
    for (const bolge of urun.bolge_listesi ?? []) {
      const mevcut = urunBolgeToplamlari.get(bolge.bolge_id) ?? Object.fromEntries(
        puanAlanlari.map(alan => [alan, 0])
      ) as Record<(typeof puanAlanlari)[number], number>;
      for (const alan of puanAlanlari) mevcut[alan] += sayi(bolge[alan]);
      urunBolgeToplamlari.set(bolge.bolge_id, mevcut);
    }
  }

  const urunsuzBolgeListesi = d.bolgeBazli.flatMap(bolge => {
    const urunToplami = urunBolgeToplamlari.get(bolge.bolge_id);
    const farklar = Object.fromEntries(
      puanAlanlari.map(alan => [alan, sayi(bolge[alan]) - sayi(urunToplami?.[alan])])
    ) as Record<(typeof puanAlanlari)[number], number>;
    const puanHareketiVar = puanAlanlari.some(alan => farklar[alan] !== 0);
    if (!puanHareketiVar) return [];
    return [{
      bolge_id: bolge.bolge_id,
      bolge_adi: bolge.bolge_adi,
      toplam_utt: bolge.toplam_utt,
      ...farklar,
    }];
  });

  const urunBazliDagilim = [...d.urunBazliBolge];
  if (urunsuzBolgeListesi.length > 0) {
    const bolgeSayisi = urunsuzBolgeListesi.length;
    const toplamlar = Object.fromEntries(
      puanAlanlari.map(alan => [alan, urunsuzBolgeListesi.reduce((toplam, bolge) => toplam + bolge[alan], 0)])
    ) as Record<(typeof puanAlanlari)[number], number>;
    urunBazliDagilim.push({
      urun_id: '__urune_bagli_olmayan__',
      urun_adi: 'Ürüne Bağlı Olmayan Eğitimler',
      toplam_net_puan: toplamlar.toplam_net_puan,
      bolge_listesi: urunsuzBolgeListesi,
      ortalama: {
        ...Object.fromEntries(
          puanAlanlari.map(alan => [alan, Math.round(toplamlar[alan] / bolgeSayisi)])
        ) as Record<(typeof puanAlanlari)[number], number>,
        bolge_sayisi: bolgeSayisi,
      },
    });
  }
  urunBazliDagilim.sort((x, y) => sayi(y.toplam_net_puan) - sayi(x.toplam_net_puan));

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
        donemde_yayina_alinan: d.anaOzet.donemde_yayina_alinan,
        su_an_yayinda: d.anaOzet.su_an_yayinda,
        planlanan: d.anaOzet.planlanan,
        devam_eden: d.anaOzet.devam_eden_talep,
        iptal_durdurulan: d.anaOzet.durdurulan_ve_iptal,
      },
      bekleyen_asamalar: {
        senaryo_onayi: d.anaOzet.senaryo_onayi_bekleyen,
        video_onayi: d.anaOzet.video_onayi_bekleyen,
        soru_seti_onayi: d.anaOzet.soru_seti_onayi_bekleyen,
      },
      revizyon_oranlari: {
        senaryo_revizyon: d.anaOzet.senaryo_revizyon_olayi,
        senaryo_revizyonlu_talep: d.anaOzet.senaryo_revizyonlu_talep,
        senaryo_yuzde: senaryoYuzde,
        video_revizyon: d.anaOzet.video_revizyon_olayi,
        video_revizyonlu_talep: d.anaOzet.video_revizyonlu_talep,
        video_yuzde: videoYuzde,
        soru_seti_revizyon: d.anaOzet.soru_seti_revizyon_olayi,
        soru_seti_revizyonlu_talep: d.anaOzet.soru_seti_revizyonlu_talep,
        soru_seti_yuzde: soruSetiYuzde,
        ortalama_uretim_suresi_saat: d.anaOzet.ortalama_uretim_suresi_saat,
      },
      katki: {
        sirket_katki_yuzdesi: sirketKatki,
        scope_toplam_puan: a.toplamNet,
        sirket_toplam_puan: d.sirketToplamPuan,
      },
      scope_ozet: {
        toplam_bolge: bolgeSayisi,
        toplam_utt: d.toplamUttSayisi,
        aktif_utt: d.anaOzet.donem_aktif_utt,
        hic_izlemeyen_utt: Math.max(0, d.toplamUttSayisi - d.anaOzet.donem_aktif_utt),
        toplam_puan: a.toplamNet,
        ortalama_puan_bolge: ortalamaPuanBolge,
        en_yuksek_bolge_puan: enYuksekBolgePuan,
        en_yuksek_utt_puan: a.enYuksekUttPuan,
        guncel_tur_izlenme_orani: d.anaOzet.guncel_tur_izlenme_orani,
        guncel_tur_tamamlanan: d.anaOzet.guncel_tur_tamamlanan,
        guncel_tur_kalan: d.anaOzet.guncel_tur_kalan,
        guncel_tur_toplam_firsat: d.anaOzet.guncel_tur_toplam_firsat,
        donem_tamamlanan_izleme: d.anaOzet.donem_tamamlanan_izleme,
        donem_benzersiz_utt_yayin: d.anaOzet.donem_benzersiz_utt_yayin,
        toplam_yayin: d.anaOzet.scope_toplam_yayin,
      },
      lig: {
        kendi_sirasi: lig.kendiSira,
        toplam_takim_sayisi: d.takimSirasi.length,
        bir_ust_puan_farki: lig.birUstPuanFarki,
        takipci_farki: lig.takipciFarki,
        firma_siralamasi: lig.siralama.map(s => ({
          sira: s.sira,
          takim_adi: s.ad,
          puan: s.puan,
          kendisi_mi: s.kendisi_mi,
        })),
      },
      oneri_etkinligi: {
        gonderilen: d.scopeOzet.gonderilen_oneri,
        tamamlanan: d.scopeOzet.tamamlanan_oneri,
        tamamlanma_orani: oneriOrani,
        bekleyen: d.scopeOzet.bekleyen_oneri,
        bekleyen_oneri_olan_utt_sayisi: d.scopeOzet.bekleyen_oneri_olan_utt_sayisi,
      },
      bolge_listesi: bolgeListesi,
      urun_bazli_dagilim: urunBazliDagilim,
      begeni_listesi: d.begeniRaw,
      favori_listesi: d.favoriRaw,
    },
  });
}
