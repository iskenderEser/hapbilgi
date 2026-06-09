// app/raporlar/api/bm/route.ts
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { hataYaniti, yetkiHatasi } from '@/lib/utils/hataIsle';
import { tarihAraligi } from '@/lib/utils/tarihAraligi';
import { getBmData } from '@/lib/rapor/bm/getBmData';

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

  const rol = (kullanici.rol ?? '').toLowerCase();
  if (rol !== 'bm') return yetkiHatasi('Bu rapora erişim yetkiniz yok');

  // Veri katmanı — tek RPC ailesi (get_kullanici_ozet, get_urun_bazli_grup, get_scope_ozet)
  const d = await getBmData(adminSupabase, kullanici, baslangic, bitis);
  if (d.hata) return d.hata;

  // ─── Bölge toplam metrikleri — uttOzetler'den canlı SUM ─────────────────
  const bolgeToplamNet = d.uttOzetler.reduce((acc, o) => acc + (o.toplam_net_puan ?? 0), 0);
  const bolgeToplamIzlenme = d.uttOzetler.reduce((acc, o) => acc + (o.izlenme_sayisi ?? 0), 0);
  const aktifUttSayisi = d.uttOzetler.filter(o => (o.izlenme_sayisi ?? 0) > 0).length;
  const hicIzlemeyenUtt = Math.max(0, d.toplamUttSayisi - aktifUttSayisi);
  const enYuksekPuan = d.uttOzetler.reduce((acc, o) => Math.max(acc, o.toplam_net_puan ?? 0), 0);
  const ortalamaPuan = d.toplamUttSayisi > 0
    ? Math.round(bolgeToplamNet / d.toplamUttSayisi)
    : 0;

  // İzlenme oranı: bölgedeki UTT'lerin yayınları izleme oranı
  const toplamIzlenmePotansiyeli = d.scopeOzet.toplam_yayin * d.toplamUttSayisi;
  const izlenmeOrani = toplamIzlenmePotansiyeli > 0
    ? Math.round((bolgeToplamIzlenme / toplamIzlenmePotansiyeli) * 100)
    : 0;
  const kalanIzlenme = Math.max(0, toplamIzlenmePotansiyeli - bolgeToplamIzlenme);

  // ─── Katkı yüzdeleri ────────────────────────────────────────────────────
  const takimKatki = d.takimToplamPuan > 0
    ? parseFloat(((bolgeToplamNet / d.takimToplamPuan) * 100).toFixed(1))
    : 0;
  const sirketKatki = d.sirketToplamPuan > 0
    ? parseFloat(((bolgeToplamNet / d.sirketToplamPuan) * 100).toFixed(1))
    : 0;

  // ─── HBLigi — bölge sıralaması ──────────────────────────────────────────
  const bolgeSiralamasi = d.bolgeSirasi.map((b, idx) => ({
    sira: idx + 1,
    bolge_adi: b.bolge_adi,
    puan: b.toplam_puan,
    kendisi_mi: b.bolge_id === kullanici.bolge_id,
  }));

  const kendiSira = bolgeSiralamasi.find(b => b.kendisi_mi)?.sira ?? null;

  let birUstPuanFarki: number | null = null;
  let takipciFarki: number | null = null;

  if (kendiSira && kendiSira > 1) {
    const ust = d.bolgeSirasi[kendiSira - 2];
    birUstPuanFarki = ust ? ust.toplam_puan - bolgeToplamNet : null;
  }
  if (kendiSira && kendiSira < d.bolgeSirasi.length) {
    const alt = d.bolgeSirasi[kendiSira];
    takipciFarki = alt ? bolgeToplamNet - alt.toplam_puan : null;
  }

  // ─── Öneri etkinliği ────────────────────────────────────────────────────
  const oneriTamamlanmaOrani = d.scopeOzet.gonderilen_oneri > 0
    ? Math.round((d.scopeOzet.tamamlanan_oneri / d.scopeOzet.gonderilen_oneri) * 100)
    : 0;

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
        takim_katki_yuzdesi: takimKatki,
        sirket_katki_yuzdesi: sirketKatki,
        bolge_toplam_puan: bolgeToplamNet,
        takim_toplam_puan: d.takimToplamPuan,
        sirket_toplam_puan: d.sirketToplamPuan,
      },
      bolge_ozet: {
        toplam_utt: d.toplamUttSayisi,
        aktif_utt: aktifUttSayisi,
        hic_izlemeyen_utt: hicIzlemeyenUtt,
        toplam_puan: bolgeToplamNet,
        ortalama_puan: ortalamaPuan,
        en_yuksek_puan: enYuksekPuan,
        izlenme_orani: izlenmeOrani,
        toplam_izlenme: bolgeToplamIzlenme,
        kalan_izlenme: kalanIzlenme,
        toplam_yayin: d.scopeOzet.toplam_yayin,
      },
      lig: {
        bolge_sirasi: kendiSira,
        toplam_bolge_sayisi: d.bolgeSirasi.length,
        bir_ust_puan_farki: birUstPuanFarki,
        takipci_farki: takipciFarki,
        bolge_siralamasi: bolgeSiralamasi,
      },
      oneri_etkinligi: {
        gonderilen: d.scopeOzet.gonderilen_oneri,
        tamamlanan: d.scopeOzet.tamamlanan_oneri,
        tamamlanma_orani: oneriTamamlanmaOrani,
        bekleyen: d.scopeOzet.bekleyen_oneri,
        bekleyen_oneri_olan_utt_sayisi: d.scopeOzet.bekleyen_oneri_olan_utt_sayisi,
      },
      // Ürün bazlı akordeon — DB'den nested yapı, frontend doğrudan render eder
      urun_dagilimi: d.urunDagilimi,
      begeni_listesi: d.begeniRaw,
      favori_listesi: d.favoriRaw,
    },
  });
}