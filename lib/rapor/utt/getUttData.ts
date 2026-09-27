// lib/rapor/utt/getUttData.ts
import type { SupabaseClient } from '@/lib/types/rapor';
import { ayBaslangici, ayKaydir } from '@/lib/zaman/kontrol';
import { getAracPuanDagilimi } from './getAracPuanDagilimi';

interface Kullanici {
  kullanici_id: string;
  ad: string;
  soyad: string;
  rol: string;
  bolge_id: string;
  takim_id: string;
  firma_id: string | null;
}

export interface NetPuanOzeti {
  toplam_net_puan?: number | null;
}

interface UttUrunDagilimiSatiri {
  urun_id: string;
  urun_adi: string;
  toplam_net_puan: number | null;
}

interface TakimYayini {
  yayin_id: string;
  talep_no: number | null;
  urun_adi: string;
  teknik_adi: string | null;
}

interface TakimYayinKunyasi {
  yayin_id: string;
  talep_no: number | null;
  urun_id: string | null;
  teknik_id: string | null;
}

interface EtkilesimKaydi {
  yayin_id: string;
  kullanici_id?: string;
}

type AylikEtkilesimSatiri = TakimYayini & {
  begeni_sayisi?: number;
  favori_sayisi?: number;
};

function aylikEtkilesimListesi(
  yayinlar: TakimYayini[],
  kayitlar: EtkilesimKaydi[],
  sayacAlani: 'begeni_sayisi' | 'favori_sayisi',
) {
  const sayac = new Map<string, number>();
  for (const kayit of kayitlar) {
    sayac.set(kayit.yayin_id, (sayac.get(kayit.yayin_id) ?? 0) + 1);
  }

  return yayinlar
    .map((yayin): AylikEtkilesimSatiri => ({ ...yayin, [sayacAlani]: sayac.get(yayin.yayin_id) ?? 0 }))
    .filter((yayin) => (yayin[sayacAlani] ?? 0) > 0)
    .sort((a, b) =>
      (b[sayacAlani] ?? 0) - (a[sayacAlani] ?? 0)
      || a.urun_adi.localeCompare(b.urun_adi, 'tr')
      || (a.teknik_adi ?? '').localeCompare(b.teknik_adi ?? '', 'tr')
      || a.yayin_id.localeCompare(b.yayin_id)
    )
    .slice(0, 5);
}

export function netPuanToplami(satirlar: NetPuanOzeti[]): number {
  return satirlar.reduce((toplam, satir) => toplam + (satir.toplam_net_puan ?? 0), 0);
}

export async function getUttData(
  adminSupabase: SupabaseClient,
  kullanici: Kullanici,
  baslangic: string,
  bitis: string
) {
  const simdi = new Date();
  const oncekiAyBaslangici = ayKaydir(simdi, -1).toISOString();
  const buAyBaslangici = ayBaslangici(simdi).toISOString();

  const [
    ozetRes,
    bolgeOzetRes,
    takimOzetRes,
    firmaOzetRes,
    bolgeRes,
    takimRes,
    urunDagilimiRes,
    kategoriDagilimiRes,
    takimYayinlariRes,
    benimBegeniRes,
    benimFavoriRes,
    aracPuanDagilimi,
  ] = await Promise.all([
    // 1. Kişisel özet — RPC ile tek noktadan
    // get_kullanici_ozet: 4 kazanım + 3 kayıp + net puan tek satırda.
    // Tek kaynak — BM/TM/Firma raporlarında da aynı RPC scope filtreleriyle kullanılacak.
    adminSupabase.rpc('get_kullanici_ozet', {
      p_kullanici_id: kullanici.kullanici_id,
      p_baslangic: baslangic,
      p_bitis: bitis,
    }),

    // 2. Bölge katkısı — kişisel özetle aynı tarih aralığı ve aynı net puan
    // formülü. Tüm-zaman lig görünümü dönem raporunda kullanılmaz.
    adminSupabase.rpc('get_kullanici_ozet', {
      p_bolge_id: kullanici.bolge_id,
      p_baslangic: baslangic,
      p_bitis: bitis,
    }),

    // 3. Takım katkısı — kişisel özetle aynı tarih aralığı ve aynı net puan
    // formülü.
    adminSupabase.rpc('get_kullanici_ozet', {
      p_takim_id: kullanici.takim_id,
      p_baslangic: baslangic,
      p_bitis: bitis,
    }),

    // 4. Firma katkısı — aynı dönem ve aynı net puan formülü.
    kullanici.firma_id
      ? adminSupabase.rpc('get_kullanici_ozet', {
          p_firma_id: kullanici.firma_id,
          p_baslangic: baslangic,
          p_bitis: bitis,
        })
      : Promise.resolve({ data: [], error: null }),

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

    // 9. Takımın yayın kümesi — beğeni/favori kartı sayfa periyodundan
    // bağımsız olarak tamamlanmış son takvim ayını gösterir.
    adminSupabase
      .from('v_yayin_kunye')
      .select('yayin_id, talep_no, urun_id, teknik_id')
      .eq('takim_id', kullanici.takim_id),

    // 10. Kullanıcının kendi beğenileri
    adminSupabase
      .from('video_begeniler')
      .select('yayin_id')
      .eq('kullanici_id', kullanici.kullanici_id),

    // 11. Kullanıcının kendi favorileri
    adminSupabase
      .from('video_favoriler')
      .select('yayin_id')
      .eq('kullanici_id', kullanici.kullanici_id),

    // 12. Öğrenme aracı bazında tüm kazanım ve kayıpların net puan kırılımı.
    getAracPuanDagilimi(adminSupabase, kullanici.kullanici_id, baslangic, bitis),
  ]);

  const kritikHata = ozetRes.error ?? bolgeOzetRes.error ?? takimOzetRes.error ?? firmaOzetRes.error;
  if (kritikHata) {
    throw new Error(`UTT dönemsel katkı verisi alınamadı: ${kritikHata.message}`);
  }

  if (takimYayinlariRes.error) {
    throw new Error(`Takım yayınları alınamadı: ${takimYayinlariRes.error.message}`);
  }

  const takimYayinKunyeleri = (takimYayinlariRes.data ?? []) as TakimYayinKunyasi[];
  const takimYayinIdleri = takimYayinKunyeleri.map((yayin) => yayin.yayin_id);
  const urunIdleri = [...new Set(takimYayinKunyeleri.map((yayin) => yayin.urun_id).filter((id): id is string => Boolean(id)))];
  const teknikIdleri = [...new Set(takimYayinKunyeleri.map((yayin) => yayin.teknik_id).filter((id): id is string => Boolean(id)))];
  let begeniRaw: ReturnType<typeof aylikEtkilesimListesi> = [];
  let favoriRaw: ReturnType<typeof aylikEtkilesimListesi> = [];
  let aylikBenimBegenim: EtkilesimKaydi[] = [];
  let aylikBenimFavorim: EtkilesimKaydi[] = [];

  if (takimYayinIdleri.length > 0) {
    const [aylikBegenilerRes, aylikFavorilerRes, urunlerRes, tekniklerRes] = await Promise.all([
      adminSupabase
        .from('video_begeniler')
        .select('yayin_id, kullanici_id')
        .in('yayin_id', takimYayinIdleri)
        .gte('created_at', oncekiAyBaslangici)
        .lt('created_at', buAyBaslangici),
      adminSupabase
        .from('video_favoriler')
        .select('yayin_id, kullanici_id')
        .in('yayin_id', takimYayinIdleri)
        .gte('created_at', oncekiAyBaslangici)
        .lt('created_at', buAyBaslangici),
      urunIdleri.length > 0
        ? adminSupabase.from('urunler').select('urun_id, urun_adi').in('urun_id', urunIdleri)
        : Promise.resolve({ data: [], error: null }),
      teknikIdleri.length > 0
        ? adminSupabase.from('teknikler').select('teknik_id, teknik_adi').in('teknik_id', teknikIdleri)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const etkilesimHatasi = aylikBegenilerRes.error ?? aylikFavorilerRes.error ?? urunlerRes.error ?? tekniklerRes.error;
    if (etkilesimHatasi) {
      throw new Error(`Aylık beğeni/favori verisi alınamadı: ${etkilesimHatasi.message}`);
    }

    const urunAdlari = new Map((urunlerRes.data ?? []).map((urun) => [urun.urun_id, urun.urun_adi]));
    const teknikAdlari = new Map((tekniklerRes.data ?? []).map((teknik) => [teknik.teknik_id, teknik.teknik_adi]));
    const takimYayinlari: TakimYayini[] = takimYayinKunyeleri.map((yayin) => ({
      yayin_id: yayin.yayin_id,
      talep_no: yayin.talep_no,
      urun_adi: yayin.urun_id ? (urunAdlari.get(yayin.urun_id) ?? 'Ürünsüz yayın') : 'Ürünsüz yayın',
      teknik_adi: yayin.teknik_id ? (teknikAdlari.get(yayin.teknik_id) ?? null) : null,
    }));

    begeniRaw = aylikEtkilesimListesi(
      takimYayinlari,
      (aylikBegenilerRes.data ?? []) as EtkilesimKaydi[],
      'begeni_sayisi',
    );
    favoriRaw = aylikEtkilesimListesi(
      takimYayinlari,
      (aylikFavorilerRes.data ?? []) as EtkilesimKaydi[],
      'favori_sayisi',
    );
    aylikBenimBegenim = ((aylikBegenilerRes.data ?? []) as EtkilesimKaydi[])
      .filter((kayit) => kayit.kullanici_id === kullanici.kullanici_id);
    aylikBenimFavorim = ((aylikFavorilerRes.data ?? []) as EtkilesimKaydi[])
      .filter((kayit) => kayit.kullanici_id === kullanici.kullanici_id);
  }

  const urunDagilimi = (urunDagilimiRes.data ?? []) as UttUrunDagilimiSatiri[];
  const enYuksekNetPuan = urunDagilimi.reduce(
    (enYuksek, urun) => Math.max(enYuksek, urun.toplam_net_puan ?? 0),
    Number.NEGATIVE_INFINITY
  );
  const esitLiderUrunler = urunDagilimi.filter((urun) => (urun.toplam_net_puan ?? 0) === enYuksekNetPuan);
  let urunEtkilesimleri: Array<{ urun_id: string; benim_begenim: boolean; benim_favorim: boolean }> = [];

  // Üçten fazla ürün aynı en yüksek net puandaysa gösterilecek üç ürünü
  // kullanıcının kendi beğeni/favori tercihleri belirler. Yayın künyesi,
  // etkileşimde bulunulan yayını ürünle güvenilir biçimde eşler.
  if (esitLiderUrunler.length > 3) {
    const esitUrunIdleri = esitLiderUrunler.map((urun) => urun.urun_id);
    const { data: yayinKunyeleri, error: yayinKunyeHatasi } = await adminSupabase
      .from('v_yayin_kunye')
      .select('yayin_id, urun_id')
      .in('urun_id', esitUrunIdleri);

    if (yayinKunyeHatasi) {
      throw new Error(`Öne çıkan ürün etkileşimleri alınamadı: ${yayinKunyeHatasi.message}`);
    }

    const begenilenYayinlar = new Set((benimBegeniRes.data ?? []).map((kayit) => kayit.yayin_id));
    const favoriYayinlar = new Set((benimFavoriRes.data ?? []).map((kayit) => kayit.yayin_id));
    const urunEtkilesimHaritasi = new Map<string, { benim_begenim: boolean; benim_favorim: boolean }>();

    for (const kunye of yayinKunyeleri ?? []) {
      if (!kunye.urun_id) continue;
      const mevcut = urunEtkilesimHaritasi.get(kunye.urun_id) ?? { benim_begenim: false, benim_favorim: false };
      mevcut.benim_begenim ||= begenilenYayinlar.has(kunye.yayin_id);
      mevcut.benim_favorim ||= favoriYayinlar.has(kunye.yayin_id);
      urunEtkilesimHaritasi.set(kunye.urun_id, mevcut);
    }

    urunEtkilesimleri = esitUrunIdleri.map((urunId) => ({
      urun_id: urunId,
      ...(urunEtkilesimHaritasi.get(urunId) ?? { benim_begenim: false, benim_favorim: false }),
    }));
  }

  // get_kullanici_ozet TABLE döner — array'in ilk satırını al
  const ozet = (ozetRes.data && ozetRes.data.length > 0) ? ozetRes.data[0] : null;

  return {
    ozet,
    bolgeOzet: bolgeOzetRes.data ?? [],
    takimOzet: takimOzetRes.data ?? [],
    firmaOzet: firmaOzetRes.data ?? [],
    bolge: bolgeRes.data ?? null,
    takim: takimRes.data ?? null,
    urunDagilimi,
    urunEtkilesimleri,
    kategoriDagilimi: kategoriDagilimiRes.data ?? [],
    begeniRaw,
    favoriRaw,
    aylikBenimBegenim,
    aylikBenimFavorim,
    benimBegenim: benimBegeniRes.data ?? [],
    benimFavorim: benimFavoriRes.data ?? [],
    aracPuanDagilimi,
  };
}
