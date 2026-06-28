// app/raporlar/api/utt/route.ts
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { hataYaniti, yetkiHatasi } from '@/lib/utils/hataIsle';
import { tarihAraligi } from '@/lib/utils/tarihAraligi';
import { getUttData } from '@/lib/rapor/utt/getUttData';
import { katkiYuzdesi } from '@/lib/rapor/paylasilan/oran';
import { ligSiralamasi } from '@/lib/rapor/paylasilan/ligSira';

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

  // ─── Kalan sipariş puanı (harcanabilir bakiye) ───────────────────────────
  // Periyottan bağımsız: get_harcama_bakiyesi her zaman içinde bulunulan
  // çeyreğin anlık bakiyesini döner (lig puanı − mağaza harcaması + iade).
  const { data: bakiyeData } = await adminSupabase.rpc('get_harcama_bakiyesi', {
    p_kullanici_id: kullanici.kullanici_id,
  });
  const kalanSiparisPuani = Number.isFinite(Number(bakiyeData)) ? Number(bakiyeData) : 0;

  // ─── İstatistikler — RPC çıktısından doğrudan ────────────────────────────
  const ozet = d.ozet ?? {
    izlenme_sayisi: 0,
    video_puani: 0,
    soru_puani: 0,
    oneri_puani: 0,
    extra_puan: 0,
    ileri_sarma_kaybi: 0,
    yanlis_cevap_kaybi: 0,
    oneri_kaybi: 0,
    toplam_net_puan: 0,
  };

  const toplam_kazanim =
    (ozet.video_puani ?? 0) +
    (ozet.soru_puani ?? 0) +
    (ozet.oneri_puani ?? 0) +
    (ozet.extra_puan ?? 0);

  const alinan_oneri = d.oneriler.length;
  const tamamlanan_oneri = d.oneriler.filter((o: any) => o.izlendi_mi).length;
  const bekleyen_oneri = alinan_oneri - tamamlanan_oneri;

  const istatistikler = {
    izleme_puani: ozet.video_puani ?? 0,
    extra_puan: ozet.extra_puan ?? 0,
    oneri_puani: ozet.oneri_puani ?? 0,
    cevaplama_puani: ozet.soru_puani ?? 0,
    toplam_kazanim,
    ileri_sarma_kaybi: ozet.ileri_sarma_kaybi ?? 0,
    yanlis_cevap_kaybi: ozet.yanlis_cevap_kaybi ?? 0,
    oneri_kaybi: ozet.oneri_kaybi ?? 0,
    toplam_net_puan: ozet.toplam_net_puan ?? 0,
    tamamlanan_izleme: d.tamamlananIzlemeSayisi,
    alinan_oneri,
    tamamlanan_oneri,
    bekleyen_oneri,
  };

  // ─── HBLigi ──────────────────────────────────────────────────────────────
  const kisiselPuan = d.lig?.toplam_puan ?? 0;
  const toplamBolgePuan = d.bolgeLig.reduce((acc, u) => acc + (u.toplam_puan ?? 0), 0);
  const toplamTakimPuan = d.takimLig.reduce((acc, u) => acc + (u.toplam_puan ?? 0), 0);
  const toplamBolgeUtt = d.bolgeLig.length || 1;

  const bolgePuanMax = katkiYuzdesi(kisiselPuan, toplamBolgePuan);
  const takimPuanMax = katkiYuzdesi(kisiselPuan, toplamTakimPuan);

  // Bölge lig sıralaması — paylaşılan helper
  const bolgeLigSatirlari = d.bolgeLig.map(u => ({
    id: u.kullanici_id,
    ad: `${u.ad} ${u.soyad}`,
    toplam_puan: u.toplam_puan ?? 0,
  }));
  const ligSonuc = ligSiralamasi(bolgeLigSatirlari, kullanici.kullanici_id, kisiselPuan);

  // ─── Beklemede ───────────────────────────────────────────────────────────
  const toplamYayinSayisi = d.yayinlar.length;
  const izlenmemisVideoSayisi = Math.max(0, toplamYayinSayisi - d.tamamlananIzlemeSayisi);

  const tumYayinlarToplamPuan = d.yayinlar.reduce((acc: number, y: any) => {
    const video_puani =
      y.soru_seti_durumu?.soru_setleri?.videolar?.video_puanlari?.video_puani ?? 0;
    return acc + video_puani;
  }, 0);
  const tahminiPuan = tumYayinlarToplamPuan > 0 ? tumYayinlarToplamPuan : 0;

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
        bolge_katki_yuzdesi: bolgePuanMax,
        takim_katki_yuzdesi: takimPuanMax,
        bolge_mevcut_puan: kisiselPuan,
        bolge_toplam_puan: toplamBolgePuan,
        takim_toplam_puan: toplamTakimPuan,
      },
      kalan_siparis_puani: kalanSiparisPuani,
      istatistikler,
      lig: {
        bolge_sirasi: d.lig?.bolge_sirasi ?? null,
        takim_sirasi: d.lig?.takim_sirasi ?? null,
        toplam_bolge_utt: toplamBolgeUtt,
        bir_ust_puan_farki: ligSonuc.birUstPuanFarki,
        bolge_siralamasi: ligSonuc.siralama.map(s => ({
          sira: s.sira,
          ad: s.ad.split(' ').slice(0, -1).join(' '),
          soyad: s.ad.split(' ').slice(-1).join(' '),
          puan: s.puan,
          kendisi_mi: s.kendisi_mi,
        })),
      },
      beklemede: {
        izlenmemis_video_sayisi: izlenmemisVideoSayisi,
        tahmini_kazanilacak_puan: tahminiPuan,
        bekleyen_oneri_sayisi: istatistikler.bekleyen_oneri,
      },
      urun_dagilimi: d.urunDagilimi,
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