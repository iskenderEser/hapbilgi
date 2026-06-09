// lib/rapor/yonetici/getYoneticiData.ts
import { SupabaseClient, PmUretimItem } from '@/lib/types/rapor';
import { URETICI_ROLLER } from '@/lib/utils/roller';
import { NextResponse } from 'next/server';

interface Kullanici {
  kullanici_id: string;
  firma_id: string;
}

export async function getYoneticiData(
  adminSupabase: SupabaseClient,
  kullanici: Kullanici,
  baslangic: string,
  bitis: string
) {
  const [
    firmaRes,
    takimRpcRes,
    tmListesiRes,
    pmKullanicilariRes,
    urunIzlemeRes,
    begeniRawRes,
    favoriRawRes,
  ] = await Promise.all([
    // 1. Firma adı
    adminSupabase
      .from('firmalar')
      .select('firma_adi')
      .eq('firma_id', kullanici.firma_id)
      .maybeSingle(),

    // 2. Takım listesi — periyot filtreli RPC
    adminSupabase.rpc('get_analiz_takim', {
      p_baslangic: baslangic,
      p_bitis: bitis,
      p_firma_id: kullanici.firma_id,
      p_takim_id: null,
    }),

    // 3. TM listesi
    adminSupabase
      .from('kullanicilar')
      .select('takim_id, ad, soyad')
      .eq('firma_id', kullanici.firma_id)
      .eq('rol', 'tm'),

    // 4. PM kullanıcıları — içerik üretim hattı için
    adminSupabase
      .from('kullanicilar')
      .select('kullanici_id')
      .eq('firma_id', kullanici.firma_id)
      .in('rol', URETICI_ROLLER),

    // 5. Ürün & teknik dağılımı — periyot bağımsız
    adminSupabase
      .from('v_rapor_urun_izlenme')
      .select('urun_adi, teknik_adi, izlenme_sayisi')
      .eq('firma_id', kullanici.firma_id),

    // 6. Firma beğeni listesi
    adminSupabase
      .from('v_rapor_begeni_favori')
      .select('yayin_id, urun_adi, teknik_adi, begeni_sayisi')
      .eq('firma_id', kullanici.firma_id)
      .order('begeni_sayisi', { ascending: false })
      .limit(5),

    // 7. Firma favori listesi
    adminSupabase
      .from('v_rapor_begeni_favori')
      .select('yayin_id, urun_adi, teknik_adi, favori_sayisi')
      .eq('firma_id', kullanici.firma_id)
      .order('favori_sayisi', { ascending: false })
      .limit(5),
  ]);

  // PM üretim verileri — uretici_id listesi belli olduktan sonra
  const pmIdleri = (pmKullanicilariRes.data ?? []).map((k) => k.kullanici_id);
  const pmUretimRes = pmIdleri.length > 0
    ? await adminSupabase
        .from('v_rapor_pm_uretim')
        .select('toplam_talep, yayindaki_talep, durdurulan_talep, senaryo_bekleyen, video_bekleyen, soru_seti_bekleyen, senaryo_revizyon, video_revizyon, soru_seti_revizyon, ortalama_talep_yayin_suresi')
        .in('uretici_id', pmIdleri)
    : { data: [] as PmUretimItem[], error: null };

  // Unified error handling — tüm sorgular dahil
  const hatalar = [
    firmaRes.error && { mesaj: 'Firma bilgisi çekilemedi.', adim: 'firmalar SELECT', detay: firmaRes.error },
    takimRpcRes.error && { mesaj: 'Takım verisi çekilemedi.', adim: 'get_analiz_takim RPC', detay: takimRpcRes.error },
    tmListesiRes.error && { mesaj: 'TM listesi çekilemedi.', adim: 'kullanicilar SELECT — tm', detay: tmListesiRes.error },
    pmKullanicilariRes.error && { mesaj: 'PM listesi çekilemedi.', adim: 'kullanicilar SELECT — pm', detay: pmKullanicilariRes.error },
    pmUretimRes.error && { mesaj: 'PM üretim verisi çekilemedi.', adim: 'v_rapor_pm_uretim SELECT', detay: pmUretimRes.error },
    urunIzlemeRes.error && { mesaj: 'Ürün izleme verisi çekilemedi.', adim: 'v_rapor_urun_izlenme SELECT', detay: urunIzlemeRes.error },
    begeniRawRes.error && { mesaj: 'Beğeni listesi çekilemedi.', adim: 'v_rapor_begeni_favori SELECT — begeni', detay: begeniRawRes.error },
    favoriRawRes.error && { mesaj: 'Favori listesi çekilemedi.', adim: 'v_rapor_begeni_favori SELECT — favori', detay: favoriRawRes.error },
  ].filter(Boolean) as { mesaj: string; adim: string; detay: unknown }[];

  if (hatalar.length > 0) {
    const ilkHata = hatalar[0];
    return {
      hata: NextResponse.json(
        { success: false, mesaj: ilkHata.mesaj, adim: ilkHata.adim },
        { status: 500 }
      ),
      firma: null,
      takimRpcData: [],
      tmMap: {},
      pmUretimListesi: [] as PmUretimItem[],
      urunIzleme: [],
      begeniRaw: [],
      favoriRaw: [],
    };
  }

  // tmMap — Object.fromEntries, null korumalı
  const tmMap: Record<string, string> = Object.fromEntries(
    (tmListesiRes.data ?? [])
      .filter((tm) => tm?.takim_id)
      .map((tm) => [tm.takim_id, `${tm.ad} ${tm.soyad}`])
  );

  return {
    hata: null,
    firma: firmaRes.data ?? null,
    takimRpcData: takimRpcRes.data ?? [],
    tmMap,
    pmUretimListesi: pmUretimRes.data ?? [],
    urunIzleme: urunIzlemeRes.data ?? [],
    begeniRaw: begeniRawRes.data ?? [],
    favoriRaw: favoriRawRes.data ?? [],
  };
}