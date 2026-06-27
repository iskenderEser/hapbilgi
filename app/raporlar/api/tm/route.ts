// app/raporlar/api/tm/route.ts
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { hataYaniti, yetkiHatasi } from '@/lib/utils/hataIsle';
import { tarihAraligi } from '@/lib/utils/tarihAraligi';
import { getTmData } from '@/lib/rapor/tm/getTmData';
import { uttOzetAgregasyon } from '@/lib/rapor/paylasilan/agregasyon';
import { katkiYuzdesi, izlenmeOrani, tamamlanmaOrani } from '@/lib/rapor/paylasilan/oran';
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
  if (rol !== 'tm') return yetkiHatasi('Bu rapora erişim yetkiniz yok');

  // Veri katmanı
  const d = await getTmData(adminSupabase, kullanici, baslangic, bitis);
  if (d.hata) return d.hata;

  // ─── Takım agregasyonu — paylaşılan helper ──────────────────────────────
  const a = uttOzetAgregasyon(d.uttOzetler, d.toplamUttSayisi);

  // Bölge sayısı + bölge bazlı en yüksek puan + ortalama
  const bolgeSayisi = d.bolgeBazli.length;
  const enYuksekBolgePuan = d.bolgeBazli.reduce((acc, b) => Math.max(acc, b.toplam_net_puan ?? 0), 0);
  const ortalamaPuanBolge = bolgeSayisi > 0 ? Math.round(a.toplamNet / bolgeSayisi) : 0;

  // ─── İzlenme oranı — paylaşılan helper ──────────────────────────────────
  const izlenme = izlenmeOrani(a.toplamIzlenme, d.scopeOzet.toplam_yayin, d.toplamUttSayisi);
  const kalanIzlenme = Math.max(0, d.scopeOzet.toplam_yayin * d.toplamUttSayisi - a.toplamIzlenme);

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
    bm_adi: b.bm_adi,
    toplam_utt: b.toplam_utt,
    aktif_utt: b.aktif_utt,
    hic_izlemeyen_utt: b.hic_izlemeyen_utt,
    toplam_net_puan: b.toplam_net_puan,
    katki_yuzdesi: katkiYuzdesi(b.toplam_net_puan, a.toplamNet),
    ortalama_utt_puani: b.toplam_utt > 0 ? Math.round(b.toplam_net_puan / b.toplam_utt) : 0,
  })).sort((x, y) => y.toplam_net_puan - x.toplam_net_puan);

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
        takim_toplam_puan: a.toplamNet,
        sirket_toplam_puan: d.sirketToplamPuan,
      },
      takim_ozet: {
        toplam_bolge: bolgeSayisi,
        toplam_utt: d.toplamUttSayisi,
        aktif_utt: a.aktifUtt,
        hic_izlemeyen_utt: a.hicIzlemeyenUtt,
        toplam_puan: a.toplamNet,
        ortalama_puan_bolge: ortalamaPuanBolge,
        en_yuksek_bolge_puan: enYuksekBolgePuan,
        en_yuksek_utt_puan: a.enYuksekUttPuan,
        izlenme_orani: izlenme,
        toplam_izlenme: a.toplamIzlenme,
        kalan_izlenme: kalanIzlenme,
        toplam_yayin: d.scopeOzet.toplam_yayin,
      },
      lig: {
        takim_sirasi: lig.kendiSira,
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
      urun_bazli_dagilim: d.urunBazliBolge,
      begeni_listesi: d.begeniRaw,
      favori_listesi: d.favoriRaw,
    },
  });
}