// lib/puan/kayit.ts
// Tek noktadan puan ve kayıp kaydı.
// Mimari: route'lar sadece orkestrasyon yapar; iş mantığı (urun_id çekme + INSERT) burada.
//
// Tüm fonksiyonlar:
//   1. yayin_id'den get_urun_from_yayin RPC'siyle urun_id'yi çeker
//   2. ilgili tabloya INSERT atar
//   3. { ok, error } döner — çağıran kod hata logunu kendi düzeyinde de tutabilir
//
// Yarın puan formülü veya tablo yapısı değişirse → tek dosyada değişir.

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  KazanilanPuanParams,
  YanlisCevapKayipParams,
  IleriSarmaKayipParams,
  OneriKayipParams,
  KayitSonuc,
} from './tipler';

/**
 * Verilen yayın için urun_id'yi DB function'ı ile çeker.
 * Internal helper — her kayıt fonksiyonu kayıt öncesinde bunu çağırır.
 */
async function yayindanUrunId(
  supabase: SupabaseClient,
  yayin_id: string
): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_urun_from_yayin', { p_yayin_id: yayin_id });
  if (error) {
    console.error('[lib/puan] get_urun_from_yayin hatası:', { yayin_id, hata: error.message });
    return null;
  }
  return (data as string) ?? null;
}

/**
 * kazanilan_puanlar tablosuna INSERT.
 * 4 puan türünü de (izleme / extra / oneri / cevaplama) tek noktadan yönetir.
 * urun_id otomatik çekilir — çağıran kodun yayin_id'den ötesini bilmesine gerek yok.
 */
export async function kazanilanPuanKaydet(
  supabase: SupabaseClient,
  params: KazanilanPuanParams
): Promise<KayitSonuc> {
  const urun_id = await yayindanUrunId(supabase, params.yayin_id);
  if (!urun_id) {
    return { ok: false, error: 'Yayından urun_id çekilemedi.' };
  }

  const { error } = await supabase
    .from('kazanilan_puanlar')
    .insert({
      kullanici_id: params.kullanici_id,
      yayin_id: params.yayin_id,
      izleme_id: params.izleme_id ?? null,
      urun_id,
      puan_turu: params.puan_turu,
      puan: params.puan,
    });

  if (error) {
    console.error('[lib/puan] kazanilanPuanKaydet hatası:', {
      yayin_id: params.yayin_id, puan_turu: params.puan_turu, hata: error.message,
    });
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * yanlis_cevap_kayitlari tablosuna INSERT.
 */
export async function yanlisCevapKaybiKaydet(
  supabase: SupabaseClient,
  params: YanlisCevapKayipParams
): Promise<KayitSonuc> {
  const urun_id = await yayindanUrunId(supabase, params.yayin_id);
  if (!urun_id) {
    return { ok: false, error: 'Yayından urun_id çekilemedi.' };
  }

  const { error } = await supabase
    .from('yanlis_cevap_kayitlari')
    .insert({
      kullanici_id: params.kullanici_id,
      yayin_id: params.yayin_id,
      izleme_id: params.izleme_id,
      urun_id,
      soru_index: params.soru_index,
      kaybedilen_puan: params.kaybedilen_puan,
    });

  if (error) {
    console.error('[lib/puan] yanlisCevapKaybiKaydet hatası:', {
      yayin_id: params.yayin_id, soru_index: params.soru_index, hata: error.message,
    });
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * ileri_sarma_kayitlari tablosuna INSERT.
 * Kolonlar devir belgesi §3.4'e göre: atlama_baslangic, atlama_bitis, atlanan_sure, kaybedilen_puan.
 */
export async function ileriSarmaKaybiKaydet(
  supabase: SupabaseClient,
  params: IleriSarmaKayipParams
): Promise<KayitSonuc> {
  const urun_id = await yayindanUrunId(supabase, params.yayin_id);
  if (!urun_id) {
    return { ok: false, error: 'Yayından urun_id çekilemedi.' };
  }

  const { error } = await supabase
    .from('ileri_sarma_kayitlari')
    .insert({
      kullanici_id: params.kullanici_id,
      yayin_id: params.yayin_id,
      izleme_id: params.izleme_id,
      urun_id,
      atlama_baslangic: params.atlama_baslangic,
      atlama_bitis: params.atlama_bitis,
      atlanan_sure: params.atlanan_sure,
      kaybedilen_puan: params.kaybedilen_puan,
    });

  if (error) {
    console.error('[lib/puan] ileriSarmaKaybiKaydet hatası:', {
      yayin_id: params.yayin_id, hata: error.message,
    });
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * oneri_kayip_kayitlari tablosuna INSERT.
 * Bu tablo oneri_id üzerinde UNIQUE — aynı öneri iki kez kaybedilemez.
 * pg_cron job (oneri_kaybi_tara) zaten içeride INSERT atıyor; bu fonksiyon manuel/test
 * senaryolar için lib'de paralel kullanım sağlar.
 */
export async function oneriKaybiKaydet(
  supabase: SupabaseClient,
  params: OneriKayipParams
): Promise<KayitSonuc> {
  const urun_id = await yayindanUrunId(supabase, params.yayin_id);
  if (!urun_id) {
    return { ok: false, error: 'Yayından urun_id çekilemedi.' };
  }

  const { error } = await supabase
    .from('oneri_kayip_kayitlari')
    .insert({
      kullanici_id: params.kullanici_id,
      yayin_id: params.yayin_id,
      oneri_id: params.oneri_id,
      urun_id,
      kaybedilen_puan: params.kaybedilen_puan,
    });

  if (error) {
    console.error('[lib/puan] oneriKaybiKaydet hatası:', {
      yayin_id: params.yayin_id, oneri_id: params.oneri_id, hata: error.message,
    });
    return { ok: false, error: error.message };
  }
  return { ok: true };
}