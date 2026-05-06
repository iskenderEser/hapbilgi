// app/raporlar/api/utt/route.ts
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { hataYaniti, yetkiHatasi } from '@/lib/utils/hataIsle';
import { tarihAraligi } from '@/lib/utils/tarihAraligi';
import { getUttData } from '@/lib/rapor/utt/getUttData';

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
    .select('kullanici_id, ad, soyad, rol, bolge_id, takim_id, firma_id')
    .eq('eposta', user.email)
    .single();

  if (kullaniciError || !kullanici) {
    return hataYaniti('Kullanıcı bulunamadı', 'kullanici_bulamadi', kullaniciError);
  }

  const rol = (kullanici.rol ?? '').toLowerCase();
  if (!['utt', 'kd_utt'].includes(rol)) {
  
    return yetkiHatasi('Bu rapora erişim yetkiniz yok');
  }

  // Veri
  const d = await getUttData(adminSupabase, kullanici, baslangic, bitis);

  // ─── İstatistikler ────────────────────────────────────────────────────────

  const istatistikler = {
    izleme_puani: 0,
    extra_puan: 0,
    oneri_puani: 0,
    cevaplama_puani: 0,
    toplam_kazanim: 0,
    ileri_sarma_kaybi: 0,
    yanlis_cevap_kaybi: 0,
    toplam_net_puan: 0,
    tamamlanan_izleme: d.tamamlananIzlemeSayisi,
    alinan_oneri: 0,
    tamamlanan_oneri: 0,
    bekleyen_oneri: 0,
  };

  for (const p of d.puanlar) {
    if (p.puan_turu === 'izleme') istatistikler.izleme_puani += p.puan;
    else if (p.puan_turu === 'extra') istatistikler.extra_puan += p.puan;
    else if (p.puan_turu === 'oneri') istatistikler.oneri_puani += p.puan;
    else if (p.puan_turu === 'cevaplama') istatistikler.cevaplama_puani += p.puan;
  }

  istatistikler.toplam_kazanim =
    istatistikler.izleme_puani +
    istatistikler.extra_puan +
    istatistikler.oneri_puani +
    istatistikler.cevaplama_puani;

  istatistikler.ileri_sarma_kaybi = d.ileriSarmaKayitlari.reduce(
    (acc, k) => acc + (k.kaybedilen_puan ?? 0), 0
  );

  // Yanlış cevap kaybı: her yanlış cevap için ilgili yayının soru_puani toplanır
  // izleme_id → izleme_kayitlari → yayin_id → soru_seti_puanlari join zinciriyle gelir
  const yanlisCevapSayisi = d.soruCevaplari.length;
  istatistikler.yanlis_cevap_kaybi = d.soruCevaplari.reduce((acc: number, c: any) => {
    const soru_puani = c.izleme?.yayin?.soru_seti_puanlari?.soru_puani ?? 0;
    return acc + soru_puani;
  }, 0);

  istatistikler.toplam_net_puan =
    istatistikler.toplam_kazanim -
    istatistikler.ileri_sarma_kaybi -
    istatistikler.yanlis_cevap_kaybi;

  // ─── Öneri özeti ─────────────────────────────────────────────────────────

  istatistikler.alinan_oneri = d.oneriler.length;
  istatistikler.tamamlanan_oneri = d.oneriler.filter((o: any) => o.izlendi_mi).length;
  istatistikler.bekleyen_oneri = istatistikler.alinan_oneri - istatistikler.tamamlanan_oneri;

  // ─── HBLigi ──────────────────────────────────────────────────────────────

  const kisiselPuan = d.lig?.toplam_puan ?? 0;
  const toplamBolgePuan = d.bolgeLig.reduce((acc, u) => acc + (u.toplam_puan ?? 0), 0);
  const toplamTakimPuan = d.takimLig.reduce((acc, u) => acc + (u.toplam_puan ?? 0), 0);
  const toplamBolgeUtt = d.bolgeLig.length || 1;

  const bolgePuanMax = toplamBolgePuan > 0 ? kisiselPuan / toplamBolgePuan * 100 : 0;
  const takimPuanMax = toplamTakimPuan > 0 ? kisiselPuan / toplamTakimPuan * 100 : 0;

  const kendiSirasi = d.bolgeLig.findIndex((u) => u.kullanici_id === kullanici.kullanici_id);
  const birUstPuanFarki = kendiSirasi > 0
    ? ((d.bolgeLig[kendiSirasi - 1]?.toplam_puan ?? 0) - kisiselPuan)
    : null;

  // ─── Beklemede ───────────────────────────────────────────────────────────

  const toplamYayinSayisi = d.yayinlar.length;
  const izlenmemisVideoSayisi = Math.max(0, toplamYayinSayisi - d.tamamlananIzlemeSayisi);

  // Tahmini puan: tüm yayınların video_puani toplamından izlenenlerin payı düşülür.
  // getUttData'dan gelen yayinlar: her yayın için video_puani join ile geldi.
  // izleme_kayitlari periyot filtreli olduğundan burada tüm yayınlar toplanır,
  // UTT'nin daha önce izledikleri dahil — "kalan potansiyel" olarak gösterilir.
  const tumYayinlarToplamPuan = d.yayinlar.reduce((acc: number, y: any) => {
    const video_puani =
      y.soru_seti_durumu?.soru_setleri?.videolar?.video_puanlari?.video_puani ?? 0;
    return acc + video_puani;
  }, 0);
  const tahminiPuan = tumYayinlarToplamPuan > 0 ? tumYayinlarToplamPuan : 0;

  // ─── Ürün & teknik dağılımı ──────────────────────────────────────────────

  const urunDagilim: Record<string, number> = {};
  const teknikDagilim: Record<string, number> = {};

  for (const item of d.urunIzleme) {
    if (item.urun_adi) urunDagilim[item.urun_adi] = (urunDagilim[item.urun_adi] ?? 0) + (item.izlenme_sayisi ?? 0);
    if (item.teknik_adi) teknikDagilim[item.teknik_adi] = (teknikDagilim[item.teknik_adi] ?? 0) + (item.izlenme_sayisi ?? 0);
  }

  // ─── Beğeni / Favori ─────────────────────────────────────────────────────

  const benimBegeniSet = new Set(d.benimBegenim.map((b) => b.yayin_id));
  const benimFavoriSet = new Set(d.benimFavorim.map((f) => f.yayin_id));

  const begeniListesi = d.begeniRaw.map((v) => ({
    ...v,
    benim_begenim: benimBegeniSet.has(v.yayin_id),
  }));

  const favoriListesi = d.favoriRaw.map((v) => ({
    ...v,
    benim_favorim: benimFavoriSet.has(v.yayin_id),
  }));

  // ─── Response ────────────────────────────────────────────────────────────

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
      katki: {
        bolge_katki_yuzdesi: parseFloat(bolgePuanMax.toFixed(1)),
        takim_katki_yuzdesi: parseFloat(takimPuanMax.toFixed(1)),
        bolge_mevcut_puan: kisiselPuan,
        bolge_toplam_puan: toplamBolgePuan,
        takim_toplam_puan: toplamTakimPuan,
      },
      istatistikler: {
        ...istatistikler,
      },
      lig: {
        bolge_sirasi: d.lig?.bolge_sirasi ?? null,
        takim_sirasi: d.lig?.takim_sirasi ?? null,
        toplam_bolge_utt: toplamBolgeUtt,
        bir_ust_puan_farki: birUstPuanFarki,
        bolge_siralamasi: d.bolgeLig.map((u, idx) => ({
          sira: idx + 1,
          ad: u.ad,
          soyad: u.soyad,
          puan: u.toplam_puan ?? 0,
          kendisi_mi: u.kullanici_id === kullanici.kullanici_id,
        })),
      },
      beklemede: {
        izlenmemis_video_sayisi: izlenmemisVideoSayisi,
        tahmini_kazanilacak_puan: tahminiPuan,
        bekleyen_oneri_sayisi: istatistikler.bekleyen_oneri,
      },
      urun_bazli_dagilim: Object.entries(urunDagilim)
        .map(([urun_adi, izlenme_sayisi]) => ({ urun_adi, izlenme_sayisi }))
        .sort((a, b) => b.izlenme_sayisi - a.izlenme_sayisi),
      teknik_bazli_dagilim: Object.entries(teknikDagilim)
        .map(([teknik_adi, izlenme_sayisi]) => ({ teknik_adi, izlenme_sayisi }))
        .sort((a, b) => b.izlenme_sayisi - a.izlenme_sayisi),
      oneriler: d.oneriler.map((o: any) => ({
        oneri_id: o.oneri_id,
        tamamlandi_mi: o.izlendi_mi,
        gonderen: o.gonderen ? `${o.gonderen.ad} ${o.gonderen.soyad}` : '-',
        tarih: o.created_at,
        durum: o.izlendi_mi ? 'Tamamlandı' : 'Bekliyor',
      })),
      begeni_listesi: begeniListesi,
      favori_listesi: favoriListesi,
    },
  });
}