// lib/puan/eclubKayit.ts
// E-Club kişi (eczacı/teknisyen) puan/kayıt katmanı.
// Üretim lib/puan/kayit.ts ile simetrik ama E-Club tablolarına (kisi_id bazlı) yazar.
//
// Fark: üretim kazanilan_puanlar/kullanici_id; E-Club eclub_kazanilan_puanlar/kisi_id.
// urun_id yine get_urun_from_yayin RPC'siyle çekilir (ortak helper).
//
// E-Club puanlama kuralı: sadece izleme + cevaplama. Kayıp puan yok.
// Yanlış cevaplar yalnızca rapor için kaydedilir (kaybedilen_puan=0).

import type { SupabaseClient } from '@supabase/supabase-js';

export type EclubPuanTuru = 'izleme' | 'cevaplama';

export interface EclubPuanParams {
  kisi_id: string;
  yayin_id: string;
  izleme_id: string;
  puan_turu: EclubPuanTuru;
  puan: number;
}

export interface EclubYanlisCevapParams {
  kisi_id: string;
  yayin_id: string;
  izleme_id: string;
  soru_index: number;
}

export interface EclubDogruCevapParams {
  kisi_id: string;
  yayin_id: string;
  izleme_id: string;
  soru_index: number;
  kazanilan_puan: number;
}

export interface EclubUttPuanParams {
  utt_id: string;
  kisi_id: string;
  yayin_id: string;
  izleme_id: string;
  oneri_id: string;
  puan?: number;
}

export interface EclubKayitSonuc {
  ok: boolean;
  error?: string;
}

/**
 * Yayından urun_id'yi DB function'ı ile çeker (üretimle ortak RPC).
 */
async function yayindanUrunId(
  supabase: SupabaseClient,
  yayin_id: string
): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_urun_from_yayin', { p_yayin_id: yayin_id });
  if (error) {
    console.error('[lib/puan/eclub] get_urun_from_yayin hatası:', { yayin_id, hata: error.message });
    return null;
  }
  return (data as string) ?? null;
}

/**
 * eclub_kazanilan_puanlar tablosuna INSERT (izleme / cevaplama).
 */
export async function eclubPuanKaydet(
  supabase: SupabaseClient,
  params: EclubPuanParams
): Promise<EclubKayitSonuc> {
  const urun_id = await yayindanUrunId(supabase, params.yayin_id);
  if (!urun_id) {
    return { ok: false, error: 'Yayından urun_id çekilemedi.' };
  }

  const { error } = await supabase
    .from('eclub_kazanilan_puanlar')
    .insert({
      kisi_id: params.kisi_id,
      yayin_id: params.yayin_id,
      izleme_id: params.izleme_id,
      urun_id,
      puan_turu: params.puan_turu,
      puan: params.puan,
    });

  if (error) {
    console.error('[lib/puan/eclub] eclubPuanKaydet hatası:', {
      yayin_id: params.yayin_id, puan_turu: params.puan_turu, hata: error.message,
    });
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * eclub_yanlis_cevap_kayitlari tablosuna INSERT.
 * E-Club'da kayıp puan YOK — kaybedilen_puan her zaman 0 (sadece rapor kaydı).
 */
export async function eclubYanlisCevapKaydet(
  supabase: SupabaseClient,
  params: EclubYanlisCevapParams
): Promise<EclubKayitSonuc> {
  const urun_id = await yayindanUrunId(supabase, params.yayin_id);
  if (!urun_id) {
    return { ok: false, error: 'Yayından urun_id çekilemedi.' };
  }

  const { error } = await supabase
    .from('eclub_yanlis_cevap_kayitlari')
    .insert({
      kisi_id: params.kisi_id,
      yayin_id: params.yayin_id,
      izleme_id: params.izleme_id,
      urun_id,
      soru_index: params.soru_index,
      kaybedilen_puan: 0,
    });

  if (error) {
    console.error('[lib/puan/eclub] eclubYanlisCevapKaydet hatası:', {
      yayin_id: params.yayin_id, soru_index: params.soru_index, hata: error.message,
    });
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * eclub_dogru_cevap_kayitlari tablosuna INSERT.
 * Doğru cevap kaydı — lig'de "doğru cevap sayısı" bu tablodan sayılır.
 * kazanilan_puan: o sorunun soru_puani (rapor/analiz için satırda tutulur).
 */
export async function eclubDogruCevapKaydet(
  supabase: SupabaseClient,
  params: EclubDogruCevapParams
): Promise<EclubKayitSonuc> {
  const urun_id = await yayindanUrunId(supabase, params.yayin_id);
  if (!urun_id) {
    return { ok: false, error: 'Yayından urun_id çekilemedi.' };
  }

  const { error } = await supabase
    .from('eclub_dogru_cevap_kayitlari')
    .insert({
      kisi_id: params.kisi_id,
      yayin_id: params.yayin_id,
      izleme_id: params.izleme_id,
      urun_id,
      soru_index: params.soru_index,
      kazanilan_puan: params.kazanilan_puan,
    });

  if (error) {
    console.error('[lib/puan/eclub] eclubDogruCevapKaydet hatası:', {
      yayin_id: params.yayin_id, soru_index: params.soru_index, hata: error.message,
    });
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * eclub_utt_puanlari tablosuna INSERT — UTT (takım koçu) GönderiPuanı.
 * Takım üyesi (kisi) önerilen videoyu izleyince, öneriyi gönderen UTT'ye +10.
 * İzleme başına bir kez (bitir API'de ilk tamamlama kontrolüyle çağrılır).
 */
export async function eclubUttPuanKaydet(
  supabase: SupabaseClient,
  params: EclubUttPuanParams
): Promise<EclubKayitSonuc> {
  const urun_id = await yayindanUrunId(supabase, params.yayin_id);
  if (!urun_id) {
    return { ok: false, error: 'Yayından urun_id çekilemedi.' };
  }

  const { error } = await supabase
    .from('eclub_utt_puanlari')
    .insert({
      utt_id: params.utt_id,
      kisi_id: params.kisi_id,
      yayin_id: params.yayin_id,
      izleme_id: params.izleme_id,
      oneri_id: params.oneri_id,
      urun_id,
      puan: params.puan ?? 10,
    });

  if (error) {
    console.error('[lib/puan/eclub] eclubUttPuanKaydet hatası:', {
      utt_id: params.utt_id, izleme_id: params.izleme_id, hata: error.message,
    });
    return { ok: false, error: error.message };
  }
  return { ok: true };
}