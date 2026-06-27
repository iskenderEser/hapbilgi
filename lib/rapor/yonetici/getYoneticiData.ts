// lib/rapor/yonetici/getYoneticiData.ts
import { SupabaseClient } from '@/lib/types/rapor';
import { NextResponse } from 'next/server';

interface Kullanici {
  kullanici_id: string;
  firma_id: string;
}

export async function getYoneticiData(
  adminSupabase: SupabaseClient,
  kullanici: Kullanici
) {
  const [
    firmaRes,
    icerikSayimRes,
    konuListesiRes,
    anaSayfaStatRes,
    extraVideoRes,
  ] = await Promise.all([
    adminSupabase
      .from('firmalar')
      .select('firma_adi')
      .eq('firma_id', kullanici.firma_id)
      .maybeSingle(),

    adminSupabase.rpc('get_yonetici_icerik_turu_sayimi', {
      p_firma_id: kullanici.firma_id,
    }),

    adminSupabase.rpc('get_yonetici_uretim_konu_bazli', {
      p_firma_id: kullanici.firma_id,
    }),

    adminSupabase.rpc('get_yonetici_ana_sayfa', {
      p_firma_id: kullanici.firma_id,
    }),

    adminSupabase.rpc('get_yonetici_en_cok_extra_video', {
      p_firma_id: kullanici.firma_id,
    }),
  ]);

  const hatalar = [
    firmaRes.error && { mesaj: 'Firma bilgisi çekilemedi.', adim: 'firmalar SELECT', detay: firmaRes.error },
    icerikSayimRes.error && { mesaj: 'İçerik türü sayımı çekilemedi.', adim: 'get_yonetici_icerik_turu_sayimi RPC', detay: icerikSayimRes.error },
    konuListesiRes.error && { mesaj: 'Konu bazlı liste çekilemedi.', adim: 'get_yonetici_uretim_konu_bazli RPC', detay: konuListesiRes.error },
    anaSayfaStatRes.error && { mesaj: 'Tüketim sayım verisi çekilemedi.', adim: 'get_yonetici_ana_sayfa RPC', detay: anaSayfaStatRes.error },
    extraVideoRes.error && { mesaj: 'Extra video verisi çekilemedi.', adim: 'get_yonetici_en_cok_extra_video RPC', detay: extraVideoRes.error },
  ].filter(Boolean) as { mesaj: string; adim: string; detay: unknown }[];

  if (hatalar.length > 0) {
    const ilkHata = hatalar[0];
    return {
      hata: NextResponse.json(
        { success: false, mesaj: ilkHata.mesaj, adim: ilkHata.adim },
        { status: 500 }
      ),
      firma: null,
      icerikSayim: null,
      konuListesi: [],
      anaSayfaStat: null,
      extraVideo: null,
    };
  }

  return {
    hata: null,
    firma: firmaRes.data ?? null,
    icerikSayim: (icerikSayimRes.data && icerikSayimRes.data.length > 0) ? icerikSayimRes.data[0] : null,
    konuListesi: konuListesiRes.data ?? [],
    anaSayfaStat: (anaSayfaStatRes.data && anaSayfaStatRes.data.length > 0) ? anaSayfaStatRes.data[0] : null,
    extraVideo: extraVideoRes.data ?? null,
  };
}