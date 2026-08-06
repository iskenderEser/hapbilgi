// lib/rapor/utt/getUttData.ts
import { SupabaseClient } from '@/lib/types/rapor';
import { TUKETICI_ROLLER } from '@/lib/utils/roller';

interface Kullanici {
  kullanici_id: string;
  ad: string;
  soyad: string;
  rol: string;
  bolge_id: string;
  takim_id: string;
}

export async function getUttData(
  adminSupabase: SupabaseClient,
  kullanici: Kullanici,
  baslangic: string,
  bitis: string
) {
  const [
    ozetRes,
    ligRes,
    bolgeLigRes,
    takimLigRes,
    bolgeRes,
    takimRes,
    urunDagilimiRes,
    kategoriDagilimiRes,
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

    // 2. HBLigi — kişisel sıra — periyot bağımsız
    adminSupabase
      .from('v_hbligi_sirali_v2')
      .select('bolge_sirasi, takim_sirasi, toplam_puan')
      .eq('kullanici_id', kullanici.kullanici_id)
      .maybeSingle(),

    // 3. Bölge sıralaması — periyot bağımsız, limit yok
    adminSupabase
      .from('v_hbligi_sirali_v2')
      .select('kullanici_id, ad, soyad, toplam_puan, bolge_sirasi')
      .eq('bolge_id', kullanici.bolge_id)
      .in('rol', TUKETICI_ROLLER)
      .order('toplam_puan', { ascending: false }),

    // 4. Takım puan toplamı — periyot bağımsız
    adminSupabase
      .from('v_hbligi_sirali_v2')
      .select('toplam_puan')
      .eq('takim_id', kullanici.takim_id)
      .in('rol', TUKETICI_ROLLER),

    // 5. Bölge adı
    adminSupabase
      .from('bolgeler')
      .select('bolge_adi')
      .eq('bolge_id', kullanici.bolge_id)
      .maybeSingle(),

    // 6. Takım adı
    adminSupabase
      .from('takimlar')
      .select('takim_adi')
      .eq('takim_id', kullanici.takim_id)
      .maybeSingle(),

    // 7. Ürün bazlı puan + kayıp + teknik dağılımı — RPC ile tek noktadan
    // get_kullanici_urun_dagilimi: her ürün için tek satır döner; UI akordeon için kullanır.
    // Tek kaynak — BM/TM/Firma/PM raporlarında da aynı RPC kullanılacak.
    adminSupabase.rpc('get_kullanici_urun_dagilimi', {
      p_kullanici_id: kullanici.kullanici_id,
      p_baslangic: baslangic,
      p_bitis: bitis,
    }),

    // 8. Eğitim kategorisi bazlı puan + kayıp + teknik dağılımı — RPC ile tek noktadan
    // get_kullanici_kategori_dagilimi: 7 no'lu sorgunun ikizi, ekseni ürün değil
    // içerik türü. Ürünsüz içerik (medikal, İK) de girdiği için bu dağılımın
    // toplamı kullanıcının toplam net puanına eşittir — ürün dağılımı ise
    // ürünsüz içeriği dışarıda bırakır (bkz. get_kullanici_urun_dagilimi.sql).
    // Tek kaynak — BM/TM/Firma raporlarında da aynı RPC kullanılacak.
    adminSupabase.rpc('get_kullanici_kategori_dagilimi', {
      p_kullanici_id: kullanici.kullanici_id,
      p_baslangic: baslangic,
      p_bitis: bitis,
    }),

    // 9. Takım beğeni listesi — periyot bağımsız
    adminSupabase
      .from('v_rapor_begeni_favori')
      .select('yayin_id, urun_adi, teknik_adi, begeni_sayisi')
      .eq('takim_id', kullanici.takim_id)
      .order('begeni_sayisi', { ascending: false })
      .limit(5),

    // 10. Takım favori listesi — periyot bağımsız
    adminSupabase
      .from('v_rapor_begeni_favori')
      .select('yayin_id, urun_adi, teknik_adi, favori_sayisi')
      .eq('takim_id', kullanici.takim_id)
      .order('favori_sayisi', { ascending: false })
      .limit(5),

    // 11. Kullanıcının kendi beğenileri
    adminSupabase
      .from('video_begeniler')
      .select('yayin_id')
      .eq('kullanici_id', kullanici.kullanici_id),

    // 12. Kullanıcının kendi favorileri
    adminSupabase
      .from('video_favoriler')
      .select('yayin_id')
      .eq('kullanici_id', kullanici.kullanici_id),
  ]);

  // get_kullanici_ozet TABLE döner — array'in ilk satırını al
  const ozet = (ozetRes.data && ozetRes.data.length > 0) ? ozetRes.data[0] : null;

  return {
    ozet,
    lig: ligRes.data ?? null,
    bolgeLig: bolgeLigRes.data ?? [],
    takimLig: takimLigRes.data ?? [],
    bolge: bolgeRes.data ?? null,
    takim: takimRes.data ?? null,
    urunDagilimi: urunDagilimiRes.data ?? [],
    kategoriDagilimi: kategoriDagilimiRes.data ?? [],
    begeniRaw: begeniRawRes.data ?? [],
    favoriRaw: favoriRawRes.data ?? [],
    benimBegenim: benimBegeniRes.data ?? [],
    benimFavorim: benimFavoriRes.data ?? [],
  };
}