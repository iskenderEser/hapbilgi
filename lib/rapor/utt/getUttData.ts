// lib/rapor/utt/getUttData.ts
import { SupabaseClient } from '@/lib/types/rapor';

interface Kullanici {
  kullanici_id: string;
  ad: string;
  soyad: string;
  rol: string;
  bolge_id: string;
  takim_id: string;
  firma_id: string;
}

export async function getUttData(
  adminSupabase: SupabaseClient,
  kullanici: Kullanici,
  baslangic: string,
  bitis: string
) {
  // Firma'ya ait pm_id listesi — yayin_yonetimi firma izolasyonu için
  const { data: firmaPmler } = await adminSupabase
    .from('kullanicilar')
    .select('kullanici_id')
    .eq('firma_id', kullanici.firma_id);

  const firmaPmIdleri = (firmaPmler ?? []).map((p) => p.kullanici_id);

  const [
    puanlarRes,
    ileriSarmaRes,
    izlemelerRes,
    soruCevaplariRes,
    ligRes,
    bolgeLigRes,
    takimLigRes,
    bolgeRes,
    takimRes,
    yayinlarRes,
    urunIzlemeRes,
    onerilerRes,
    begeniRawRes,
    favoriRawRes,
    benimBegeniRes,
    benimFavoriRes,
  ] = await Promise.all([
    // 1. Kişisel puan kazanımları — periyot filtreli
    adminSupabase
      .from('kazanilan_puanlar')
      .select('puan_turu, puan')
      .eq('kullanici_id', kullanici.kullanici_id)
      .gte('created_at', baslangic)
      .lte('created_at', bitis),

    // 2. İleri sarma kayıpları — periyot filtreli
    adminSupabase
      .from('ileri_sarma_kayitlari')
      .select('kaybedilen_puan')
      .eq('kullanici_id', kullanici.kullanici_id)
      .gte('created_at', baslangic)
      .lte('created_at', bitis),

    // 3. İzleme özeti — periyot filtreli
    adminSupabase
      .from('izleme_kayitlari')
      .select('izleme_id, tamamlandi_mi')
      .eq('kullanici_id', kullanici.kullanici_id)
      .eq('tamamlandi_mi', true)
      .gte('created_at', baslangic)
      .lte('created_at', bitis),

    // 4. Yanlış cevaplar + soru puanı — periyot filtreli
    // izleme_id → izleme_kayitlari → yayin_id → soru_seti_puanlari join zinciri
    adminSupabase
      .from('soru_cevaplari')
      .select(`
        dogru_mu,
        izleme:izleme_id (
          yayin:yayin_id (
            soru_seti_puanlari (soru_puani)
          )
        )
      `)
      .eq('kullanici_id', kullanici.kullanici_id)
      .eq('dogru_mu', false)
      .gte('created_at', baslangic)
      .lte('created_at', bitis),

    // 5. HBLigi — kişisel sıra — periyot bağımsız
    adminSupabase
      .from('v_hbligi_sirali')
      .select('bolge_sirasi, takim_sirasi, toplam_puan')
      .eq('kullanici_id', kullanici.kullanici_id)
      .maybeSingle(),

    // 6. Bölge sıralaması — periyot bağımsız, limit yok
    adminSupabase
      .from('v_hbligi_sirali')
      .select('kullanici_id, ad, soyad, toplam_puan, bolge_sirasi')
      .eq('bolge_id', kullanici.bolge_id)
      .in('rol', ['utt', 'kd_utt'])
      .order('toplam_puan', { ascending: false }),

    // 7. Takım puan toplamı — periyot bağımsız
    adminSupabase
      .from('v_hbligi_sirali')
      .select('toplam_puan')
      .eq('takim_id', kullanici.takim_id)
      .in('rol', ['utt', 'kd_utt']),

    // 8. Bölge adı
    adminSupabase
      .from('bolgeler')
      .select('bolge_adi')
      .eq('bolge_id', kullanici.bolge_id)
      .maybeSingle(),

    // 9. Takım adı
    adminSupabase
      .from('takimlar')
      .select('takim_adi')
      .eq('takim_id', kullanici.takim_id)
      .maybeSingle(),

    // 10. Yayındaki videolar + video puanları — firma + rol filtreli, periyot bağımsız
    // video_puani: soru_seti_durum_id → soru_seti_durumu → video_durum_id → video_puanlari
    firmaPmIdleri.length > 0
      ? adminSupabase
          .from('yayin_yonetimi')
          .select(`
            yayin_id,
            soru_seti_durum_id,
            soru_seti_durumu:soru_seti_durum_id (
              soru_seti_id,
              soru_setleri:soru_seti_id (
                video_durum_id,
                videolar:video_durum_id (
                  video_puanlari (video_puani)
                )
              )
            )
          `)
          .eq('durum', 'yayinda')
          .contains('hedef_roller', [kullanici.rol])
          .in('pm_id', firmaPmIdleri)
      : Promise.resolve({ data: [], error: null }),

    // 11. Ürün & teknik dağılımı — periyot bağımsız
    adminSupabase
      .from('v_rapor_urun_izlenme')
      .select('urun_adi, teknik_adi, izlenme_sayisi')
      .eq('kullanici_id', kullanici.kullanici_id),

    // 12. Öneriler — periyot bağımsız, son 10
    adminSupabase
      .from('oneri_kayitlari')
      .select('oneri_id, izlendi_mi, created_at, gonderen:oneren_id (ad, soyad)')
      .eq('kullanici_id', kullanici.kullanici_id)
      .order('created_at', { ascending: false })
      .limit(10),

    // 13. Takım beğeni listesi — periyot bağımsız
    adminSupabase
      .from('v_rapor_begeni_favori')
      .select('yayin_id, urun_adi, teknik_adi, begeni_sayisi')
      .eq('takim_id', kullanici.takim_id)
      .order('begeni_sayisi', { ascending: false })
      .limit(5),

    // 14. Takım favori listesi — periyot bağımsız
    adminSupabase
      .from('v_rapor_begeni_favori')
      .select('yayin_id, urun_adi, teknik_adi, favori_sayisi')
      .eq('takim_id', kullanici.takim_id)
      .order('favori_sayisi', { ascending: false })
      .limit(5),

    // 15. Kullanıcının kendi beğenileri
    adminSupabase
      .from('video_begeniler')
      .select('yayin_id')
      .eq('kullanici_id', kullanici.kullanici_id),

    // 16. Kullanıcının kendi favorileri
    adminSupabase
      .from('video_favoriler')
      .select('yayin_id')
      .eq('kullanici_id', kullanici.kullanici_id),
  ]);

  return {
    puanlar: puanlarRes.data ?? [],
    ileriSarmaKayitlari: ileriSarmaRes.data ?? [],
    soruCevaplari: soruCevaplariRes.data ?? [],
    tamamlananIzlemeSayisi: (izlemelerRes.data ?? []).length,
    lig: ligRes.data ?? null,
    bolgeLig: bolgeLigRes.data ?? [],
    takimLig: takimLigRes.data ?? [],
    bolge: bolgeRes.data ?? null,
    takim: takimRes.data ?? null,
    yayinlar: yayinlarRes.data ?? [],
    urunIzleme: urunIzlemeRes.data ?? [],
    oneriler: onerilerRes.data ?? [],
    begeniRaw: begeniRawRes.data ?? [],
    favoriRaw: favoriRawRes.data ?? [],
    benimBegenim: benimBegeniRes.data ?? [],
    benimFavorim: benimFavoriRes.data ?? [],
  };
}