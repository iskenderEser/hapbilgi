// app/raporlar/api/tm/route.ts
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { hataYaniti, yetkiHatasi } from '@/lib/utils/hataIsle';
import { tarihAraligi } from '@/lib/utils/tarihAraligi';
import { getTmData } from '@/lib/rapor/tm/getTmData';

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
  if (rol !== 'tm') return yetkiHatasi('Bu rapora erişim yetkiniz yok');

  // Veri katmanı — tek RPC ailesi
  const d = await getTmData(adminSupabase, kullanici, baslangic, bitis);
  if (d.hata) return d.hata;

  // ─── Takım toplam metrikleri — uttOzetler'den canlı SUM ─────────────────
  const takimToplamNet = d.uttOzetler.reduce((acc, o) => acc + (o.toplam_net_puan ?? 0), 0);
  const takimToplamIzlenme = d.uttOzetler.reduce((acc, o) => acc + (o.izlenme_sayisi ?? 0), 0);
  const aktifUttSayisi = d.uttOzetler.filter(o => (o.izlenme_sayisi ?? 0) > 0).length;
  const hicIzlemeyenUtt = Math.max(0, d.toplamUttSayisi - aktifUttSayisi);
  const enYuksekUttPuan = d.uttOzetler.reduce((acc, o) => Math.max(acc, o.toplam_net_puan ?? 0), 0);

  // Bölge sayısı + bölge bazlı en yüksek puan (StatCard için)
  const bolgeSayisi = d.bolgeBazli.length;
  const enYuksekBolgePuan = d.bolgeBazli.reduce((acc, b) => Math.max(acc, b.toplam_net_puan ?? 0), 0);
  const ortalamaPuanBolge = bolgeSayisi > 0
    ? Math.round(takimToplamNet / bolgeSayisi)
    : 0;

  // İzlenme oranı
  const toplamIzlenmePotansiyeli = d.scopeOzet.toplam_yayin * d.toplamUttSayisi;
  const izlenmeOrani = toplamIzlenmePotansiyeli > 0
    ? Math.round((takimToplamIzlenme / toplamIzlenmePotansiyeli) * 100)
    : 0;
  const kalanIzlenme = Math.max(0, toplamIzlenmePotansiyeli - takimToplamIzlenme);

  // ─── Şirket katkısı ─────────────────────────────────────────────────────
  const sirketKatki = d.sirketToplamPuan > 0
    ? parseFloat(((takimToplamNet / d.sirketToplamPuan) * 100).toFixed(1))
    : 0;

  // ─── HBLigi — takım sıralaması ──────────────────────────────────────────
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
    birUstPuanFarki = ust ? ust.toplam_puan - takimToplamNet : null;
  }
  if (kendiSira && kendiSira < d.takimSirasi.length) {
    const alt = d.takimSirasi[kendiSira];
    takipciFarki = alt ? takimToplamNet - alt.toplam_puan : null;
  }

  // ─── Öneri etkinliği ────────────────────────────────────────────────────
  const oneriTamamlanmaOrani = d.scopeOzet.gonderilen_oneri > 0
    ? Math.round((d.scopeOzet.tamamlanan_oneri / d.scopeOzet.gonderilen_oneri) * 100)
    : 0;

  // ─── Blok 1 — Bölge tablosu (katkı yüzdesi + ortalama UTT puanı) ────────
  const bolgeListesi = d.bolgeBazli.map(b => ({
    bolge_id: b.bolge_id,
    bolge_adi: b.bolge_adi,
    bm_adi: b.bm_adi,
    toplam_utt: b.toplam_utt,
    aktif_utt: b.aktif_utt,
    hic_izlemeyen_utt: b.hic_izlemeyen_utt,
    toplam_net_puan: b.toplam_net_puan,
    katki_yuzdesi: takimToplamNet > 0
      ? parseFloat(((b.toplam_net_puan / takimToplamNet) * 100).toFixed(1))
      : 0,
    ortalama_utt_puani: b.toplam_utt > 0
      ? Math.round(b.toplam_net_puan / b.toplam_utt)
      : 0,
  })).sort((a, b) => b.toplam_net_puan - a.toplam_net_puan);

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
      katki: {
        sirket_katki_yuzdesi: sirketKatki,
        takim_toplam_puan: takimToplamNet,
        sirket_toplam_puan: d.sirketToplamPuan,
      },
      takim_ozet: {
        toplam_bolge: bolgeSayisi,
        toplam_utt: d.toplamUttSayisi,
        aktif_utt: aktifUttSayisi,
        hic_izlemeyen_utt: hicIzlemeyenUtt,
        toplam_puan: takimToplamNet,
        ortalama_puan_bolge: ortalamaPuanBolge,
        en_yuksek_bolge_puan: enYuksekBolgePuan,
        en_yuksek_utt_puan: enYuksekUttPuan,
        izlenme_orani: izlenmeOrani,
        toplam_izlenme: takimToplamIzlenme,
        kalan_izlenme: kalanIzlenme,
        toplam_yayin: d.scopeOzet.toplam_yayin,
      },
      lig: {
        takim_sirasi: kendiSira,
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
      // Blok 1 — bölge tablosu (akordeon yok)
      bolge_listesi: bolgeListesi,
      // Blok 2 — ürün bazlı bölge dağılımı (akordeon)
      urun_bazli_dagilim: d.urunBazliBolge,
      begeni_listesi: d.begeniRaw,
      favori_listesi: d.favoriRaw,
    },
  });
}