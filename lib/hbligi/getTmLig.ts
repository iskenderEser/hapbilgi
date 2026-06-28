// lib/hbligi/getTmLig.ts
//
// TM rolü için HBLigi verisi.
// Kendi takımındaki UTT sıralaması + tüm takımların toplam puan sıralaması.
// Dönem: çağıran tarafından geçilen periyot (ay/donem/yil) — ligRpcCagir helper'ı.

import type { SupabaseClient } from "@supabase/supabase-js";
import { toplamPuanGrupla, sirayaKoy } from "./agregasyonlar";
import { ligRpcCagir, type LigPeriyot } from "./ligRpcCagir";

export interface TmLigUttSatiri {
  sira: number;
  kullanici_id: string;
  ad: string;
  rol: string;
  bolge: string;
  izleme_puani: number;
  cevaplama_puani: number;
  oneri_puani: number;
  extra_puani: number;
  toplam_puan: number;
}

export interface TmTakimSiraSatiri {
  takim_id: string;
  takim_adi: string;
  toplam_puan: number;
  sira: number;
}

export interface TmLigSonuc {
  tip: "tm";
  takim_utt: TmLigUttSatiri[];
  takim_siralamasi: TmTakimSiraSatiri[];
}

/**
 * TM için iki veri seti döner:
 * 1. Kendi takımındaki UTT sıralaması (bireysel)
 * 2. Tüm takımların toplam puana göre sıralaması
 *
 * @param supabase Admin client
 * @param takim_id TM'nin bağlı olduğu takım
 * @param periyot Periyot + tarih bilgisi (ay/donem/yil)
 */
export async function getTmLig(
  supabase: SupabaseClient,
  takim_id: string,
  periyot: LigPeriyot
): Promise<TmLigSonuc> {
  // Tek RPC çağrısı: tüm UTT/KD_UTT lig satırları (seçili periyot)
  const tumUttler = await ligRpcCagir(supabase, periyot);

  // 1) Kendi takımındaki UTT'ler (JS filtresi)
  const takimUttler = tumUttler.filter((l: any) => l.takim_id === takim_id);

  // 2) Takım toplamlarını hesapla + sıraya koy (tüm UTT'lerden)
  const takimGrup = toplamPuanGrupla(tumUttler, "takim_id", "takim_adi");
  const takim_siralamasi = sirayaKoy(takimGrup, "takim_id", "takim_adi") as TmTakimSiraSatiri[];

  // UTT satırlarını formatla
  const takim_utt: TmLigUttSatiri[] = takimUttler.map((l: any) => ({
    sira: l.takim_sirasi,
    kullanici_id: l.kullanici_id,
    ad: `${l.ad} ${l.soyad}`,
    rol: l.rol,
    bolge: l.bolge_adi ?? "-",
    izleme_puani: l.izleme_puani,
    cevaplama_puani: l.cevaplama_puani,
    oneri_puani: l.oneri_puani,
    extra_puani: l.extra_puani,
    toplam_puan: l.toplam_puan,
  }));

  return { tip: "tm", takim_utt, takim_siralamasi };
}