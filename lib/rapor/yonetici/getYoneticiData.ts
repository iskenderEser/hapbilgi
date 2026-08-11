import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@/lib/types/rapor';

interface Kullanici {
  kullanici_id: string;
  firma_id: string;
}

export async function getYoneticiData(
  adminSupabase: SupabaseClient,
  kullanici: Kullanici,
  baslangic: string,
  bitis: string,
) {
  const [firmaRes, ozetRes, takimRes, egitimTuruRes] = await Promise.all([
    adminSupabase
      .from('firmalar')
      .select('firma_adi')
      .eq('firma_id', kullanici.firma_id)
      .maybeSingle(),
    adminSupabase.rpc('get_yonetici_rapor_ana_ozet_v2', {
      p_yonetici_id: kullanici.kullanici_id,
      p_baslangic: baslangic,
      p_bitis: bitis,
    }),
    adminSupabase.rpc('get_yonetici_hiyerarsi_v2', {
      p_yonetici_id: kullanici.kullanici_id,
      p_baslangic: baslangic,
      p_bitis: bitis,
      p_seviye: 'takim',
      p_ust_birim_id: null,
    }),
    adminSupabase.rpc('get_yonetici_egitim_turu_etkisi_v3', {
      p_yonetici_id: kullanici.kullanici_id,
      p_baslangic: baslangic,
      p_bitis: bitis,
    }),
  ]);

  const hatalar = [
    firmaRes.error && { mesaj: 'Firma bilgisi çekilemedi.', adim: 'firmalar SELECT', detay: firmaRes.error },
    ozetRes.error && { mesaj: 'Yönetici rapor özeti çekilemedi.', adim: 'get_yonetici_rapor_ana_ozet_v2', detay: ozetRes.error },
    takimRes.error && { mesaj: 'Takım performansı çekilemedi.', adim: 'get_yonetici_hiyerarsi_v2 — takım', detay: takimRes.error },
    egitimTuruRes.error && { mesaj: 'Eğitim türü etkisi çekilemedi.', adim: 'get_yonetici_egitim_turu_etkisi_v3', detay: egitimTuruRes.error },
  ].filter(Boolean) as { mesaj: string; adim: string; detay: unknown }[];

  if (hatalar.length > 0) {
    const ilkHata = hatalar[0];
    return {
      hata: NextResponse.json(
        { success: false, mesaj: ilkHata.mesaj, adim: ilkHata.adim },
        { status: 500 },
      ),
      firma: null,
      ozet: null,
      takimlar: [],
      egitimTurleri: [],
    };
  }

  return {
    hata: null,
    firma: firmaRes.data ?? null,
    ozet: ozetRes.data?.[0] ?? null,
    takimlar: takimRes.data ?? [],
    egitimTurleri: egitimTuruRes.data ?? [],
  };
}
