// app/raporlar/api/bm/route.ts
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { hataYaniti, yetkiHatasi } from '@/lib/utils/hataIsle';
import { tarihAraligi } from '@/lib/utils/tarihAraligi';
import { getBmData } from '@/lib/rapor/bm/getBmData';
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
    .select('kullanici_id, ad, soyad, rol, bolge_id, takim_id, firma_id')
    .eq('eposta', user.email)
    .single();

  if (kullaniciError || !kullanici) {
    return hataYaniti('Kullanıcı bulunamadı', 'kullanici_bulamadi', kullaniciError);
  }

  const rol = (kullanici.rol ?? '').toLowerCase();
  if (rol !== 'bm') return yetkiHatasi('Bu rapora erişim yetkiniz yok');

  // Veri katmanı — tek RPC ailesi
  const d = await getBmData(adminSupabase, kullanici, baslangic, bitis);
  if (d.hata) return d.hata;

  // ─── Bölge agregasyonu — paylaşılan helper ──────────────────────────────
  const a = uttOzetAgregasyon(d.uttOzetler, d.toplamUttSayisi);
  const ortalamaPuan = d.toplamUttSayisi > 0 ? Math.round(a.toplamNet / d.toplamUttSayisi) : 0;

  // ─── İzlenme oranı — paylaşılan helper ──────────────────────────────────
  const izlenme = izlenmeOrani(a.toplamIzlenme, d.scopeOzet.toplam_yayin, d.toplamUttSayisi);
  const kalanIzlenme = Math.max(0, d.scopeOzet.toplam_yayin * d.toplamUttSayisi - a.toplamIzlenme);

  // ─── Katkı yüzdeleri — paylaşılan helper ────────────────────────────────
  const takimKatki = katkiYuzdesi(a.toplamNet, d.takimToplamPuan);
  const sirketKatki = katkiYuzdesi(a.toplamNet, d.sirketToplamPuan);

  // ─── HBLigi — bölge sıralaması — paylaşılan helper ──────────────────────
  const ligGiris = d.bolgeSirasi.map(b => ({
    id: b.bolge_id,
    ad: b.bolge_adi,
    toplam_puan: b.toplam_puan,
  }));
  const lig = ligSiralamasi(ligGiris, kullanici.bolge_id ?? '', a.toplamNet);

  // ─── Öneri etkinliği — paylaşılan helper ────────────────────────────────
  const oneriOrani = tamamlanmaOrani(d.scopeOzet.tamamlanan_oneri, d.scopeOzet.gonderilen_oneri);

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
        bolge_toplam_puan: a.toplamNet,
        takim_toplam_puan: d.takimToplamPuan,
        sirket_toplam_puan: d.sirketToplamPuan,
      },
      bolge_ozet: {
        toplam_utt: d.toplamUttSayisi,
        aktif_utt: a.aktifUtt,
        hic_izlemeyen_utt: a.hicIzlemeyenUtt,
        toplam_puan: a.toplamNet,
        ortalama_puan: ortalamaPuan,
        en_yuksek_puan: a.enYuksekUttPuan,
        izlenme_orani: izlenme,
        toplam_izlenme: a.toplamIzlenme,
        kalan_izlenme: kalanIzlenme,
        toplam_yayin: d.scopeOzet.toplam_yayin,
      },
      lig: {
        bolge_sirasi: lig.kendiSira,
        toplam_bolge_sayisi: d.bolgeSirasi.length,
        bir_ust_puan_farki: lig.birUstPuanFarki,
        takipci_farki: lig.takipciFarki,
        bolge_siralamasi: lig.siralama.map(s => ({
          sira: s.sira,
          bolge_adi: s.ad,
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
      urun_dagilimi: d.urunDagilimi,
      begeni_listesi: d.begeniRaw,
      favori_listesi: d.favoriRaw,
    },
  });
}