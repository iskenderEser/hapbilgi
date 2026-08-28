// app/raporlar/api/utt/route.ts
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { hataYaniti, yetkiHatasi } from '@/lib/utils/hataIsle';
import { tarihAraligi } from '@/lib/utils/tarihAraligi';
import { TUKETICI_ROLLER } from '@/lib/utils/roller';
import { getUttData } from '@/lib/rapor/utt/getUttData';
import { katkiYuzdesi } from '@/lib/rapor/paylasilan/oran';
import { aracTuruDagilimi } from '@/lib/rapor/paylasilan/aracTuruDagilimi';

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
    .select('kullanici_id, ad, soyad, rol, bolge_id, takim_id')
    .eq('eposta', user.email)
    .single();

  if (kullaniciError || !kullanici) {
    return hataYaniti('Kullanıcı bulunamadı', 'kullanici_bulamadi', kullaniciError);
  }

  const rol = (kullanici.rol ?? '').toLowerCase();
  if (!TUKETICI_ROLLER.includes(rol)) {
    return yetkiHatasi('Bu rapora erişim yetkiniz yok');
  }

  // Veri
  const d = await getUttData(adminSupabase, kullanici, baslangic, bitis);
  const aracTurleri = await aracTuruDagilimi(adminSupabase, { baslangic, bitis, takimId: kullanici.takim_id });

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

  const istatistikler = {
    izleme_puani: ozet.video_puani ?? 0,
    extra_puan: ozet.extra_puan ?? 0,
    oneri_puani: ozet.oneri_puani ?? 0,
    cevaplama_puani: ozet.soru_puani ?? 0,
    ileri_sarma_kaybi: ozet.ileri_sarma_kaybi ?? 0,
    yanlis_cevap_kaybi: ozet.yanlis_cevap_kaybi ?? 0,
    oneri_kaybi: ozet.oneri_kaybi ?? 0,
    toplam_net_puan: ozet.toplam_net_puan ?? 0,
  };

  // ─── Katkı (bölge/takım payı) ────────────────────────────────────────────
  const kisiselPuan = d.lig?.toplam_puan ?? 0;
  const toplamBolgePuan = d.bolgeLig.reduce((acc, u) => acc + (u.toplam_puan ?? 0), 0);
  const toplamTakimPuan = d.takimLig.reduce((acc, u) => acc + (u.toplam_puan ?? 0), 0);

  const bolgePuanMax = katkiYuzdesi(kisiselPuan, toplamBolgePuan);
  const takimPuanMax = katkiYuzdesi(kisiselPuan, toplamTakimPuan);

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
      istatistikler,
      arac_turu_dagilimi: aracTurleri,
      kategori_dagilimi: d.kategoriDagilimi,
      urun_dagilimi: d.urunDagilimi,
      begeni_listesi: begeniListesi,
      favori_listesi: favoriListesi,
    },
  });
}
