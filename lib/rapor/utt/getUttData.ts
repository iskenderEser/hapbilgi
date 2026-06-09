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
  // Firma'ya ait uretici_id listesi — yayin_yonetimi firma izolasyonu için
  const { data: firmaPmler } = await adminSupabase
    .from('kullanicilar')
    .select('kullanici_id')
    .eq('firma_id', kullanici.firma_id);

  const firmaPmIdleri = (firmaPmler ?? []).map((p) => p.kullanici_id);

  const [
    ozetRes,
    izlemelerRes,
    ligRes,
    bolgeLigRes,
    takimLigRes,
    bolgeRes,
    takimRes,
    yayinlarRes,
    urunDagilimiRes,
    onerilerRes,
    begeniRawRes,
    favoriRawRes,
    benimBegeniRes,
    benimFavoriRes,
  ] = await Promise.all([
    // 1. Kişisel özet — RPC ile tek noktadan
    // get_kullanici_ozet: 4 kazanım + 3 kayıp + net puan tek satırda.
    // Tek kaynak — BM/TM/Firma raporlarında da aynı RPC scope filtreleriyle kullanılacak.
    adminSupabase.rpc('get_kullanici_ozet', {
      p_kullanici_id: kullanici.kullanici_id,
      p_baslangic: baslangic,
      p_bitis: bitis,
    }),

    // 2. İzleme özeti — periyot filtreli
    adminSupabase
      .from('izleme_kayitlari')
      .select('izleme_id, tamamlandi_mi')
      .eq('kullanici_id', kullanici.kullanici_id)
      .eq('tamamlandi_mi', true)
      .gte('created_at', baslangic)
      .lte('created_at', bitis),

    // 3. HBLigi — kişisel sıra — periyot bağımsız
    adminSupabase
      .from('v_hbligi_sirali')
      .select('bolge_sirasi, takim_sirasi, toplam_puan')
      .eq('kullanici_id', kullanici.kullanici_id)
      .maybeSingle(),

    // 4. Bölge sıralaması — periyot bağımsız, limit yok
    adminSupabase
      .from('v_hbligi_sirali')
      .select('kullanici_id, ad, soyad, toplam_puan, bolge_sirasi')
      .eq('bolge_id', kullanici.bolge_id)
      .in('rol', ['utt', 'kd_utt'])
      .order('toplam_puan', { ascending: false }),

    // 5. Takım puan toplamı — periyot bağımsız
    adminSupabase
      .from('v_hbligi_sirali')
      .select('toplam_puan')
      .eq('takim_id', kullanici.takim_id)
      .in('rol', ['utt', 'kd_utt']),

    // 6. Bölge adı
    adminSupabase
      .from('bolgeler')
      .select('bolge_adi')
      .eq('bolge_id', kullanici.bolge_id)
      .maybeSingle(),

    // 7. Takım adı
    adminSupabase
      .from('takimlar')
      .select('takim_adi')
      .eq('takim_id', kullanici.takim_id)
      .maybeSingle(),

    // 8. Yayındaki videolar + video puanları — firma + rol filtreli, periyot bağımsız
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
          .in('uretici_id', firmaPmIdleri)
      : Promise.resolve({ data: [], error: null }),

    // 9. Ürün bazlı puan + kayıp + teknik dağılımı — RPC ile tek noktadan
    // get_kullanici_urun_dagilimi: her ürün için tek satır döner; UI akordeon için kullanır.
    // Tek kaynak — BM/TM/Firma/PM raporlarında da aynı RPC kullanılacak.
    adminSupabase.rpc('get_kullanici_urun_dagilimi', {
      p_kullanici_id: kullanici.kullanici_id,
      p_baslangic: baslangic,
      p_bitis: bitis,
    }),

    // 10. Öneriler — periyot bağımsız, son 10
    adminSupabase
      .from('oneri_kayitlari')
      .select('oneri_id, izlendi_mi, created_at, gonderen:oneren_id (ad, soyad)')
      .eq('kullanici_id', kullanici.kullanici_id)
      .order('created_at', { ascending: false })
      .limit(10),

    // 11. Takım beğeni listesi — periyot bağımsız
    adminSupabase
      .from('v_rapor_begeni_favori')
      .select('yayin_id, urun_adi, teknik_adi, begeni_sayisi')
      .eq('takim_id', kullanici.takim_id)
      .order('begeni_sayisi', { ascending: false })
      .limit(5),

    // 12. Takım favori listesi — periyot bağımsız
    adminSupabase
      .from('v_rapor_begeni_favori')
      .select('yayin_id, urun_adi, teknik_adi, favori_sayisi')
      .eq('takim_id', kullanici.takim_id)
      .order('favori_sayisi', { ascending: false })
      .limit(5),

    // 13. Kullanıcının kendi beğenileri
    adminSupabase
      .from('video_begeniler')
      .select('yayin_id')
      .eq('kullanici_id', kullanici.kullanici_id),

    // 14. Kullanıcının kendi favorileri
    adminSupabase
      .from('video_favoriler')
      .select('yayin_id')
      .eq('kullanici_id', kullanici.kullanici_id),
  ]);

  // get_kullanici_ozet TABLE döner — array'in ilk satırını al
  const ozet = (ozetRes.data && ozetRes.data.length > 0) ? ozetRes.data[0] : null;

  return {
    ozet,
    tamamlananIzlemeSayisi: (izlemelerRes.data ?? []).length,
    lig: ligRes.data ?? null,
    bolgeLig: bolgeLigRes.data ?? [],
    takimLig: takimLigRes.data ?? [],
    bolge: bolgeRes.data ?? null,
    takim: takimRes.data ?? null,
    yayinlar: yayinlarRes.data ?? [],
    urunDagilimi: urunDagilimiRes.data ?? [],
    oneriler: onerilerRes.data ?? [],
    begeniRaw: begeniRawRes.data ?? [],
    favoriRaw: favoriRawRes.data ?? [],
    benimBegenim: benimBegeniRes.data ?? [],
    benimFavorim: benimFavoriRes.data ?? [],
  };
}