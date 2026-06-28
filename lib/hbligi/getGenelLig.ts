// lib/hbligi/getGenelLig.ts
//
// Diğer roller (PM, GM, IU vb.) için HBLigi verisi.
// Tüm UTT sıralaması (firma genelinde) + filtre dropdown'ları için bölge/takım/firma listeleri.
// Dönem: çağıran tarafından geçilen periyot (ay/donem/yil) — ligRpcCagir helper'ı.

import type { SupabaseClient } from "@supabase/supabase-js";
import { ligRpcCagir, type LigPeriyot } from "./ligRpcCagir";

export interface GenelLigSatiri {
  sira: number;
  bolge_sirasi: number;
  takim_sirasi: number;
  kullanici_id: string;
  ad: string;
  rol: string;
  bolge: string;
  takim: string;
  firma: string;
  izleme_puani: number;
  cevaplama_puani: number;
  oneri_puani: number;
  extra_puani: number;
  toplam_puan: number;
}

export interface GenelLigFiltreleri {
  bolgeler: { bolge_id: string; bolge_adi: string }[];
  takimlar: { takim_id: string; takim_adi: string }[];
  firmalar: { firma_id: string; firma_adi: string }[];
}

export interface GenelLigSonuc {
  tip: "genel";
  lig: GenelLigSatiri[];
  filtreler: GenelLigFiltreleri;
}

/**
 * Diğer roller için tüm UTT'lerin firma sıralaması + filtre listeleri.
 *
 * @param supabase Admin client
 * @param periyot Periyot + tarih bilgisi (ay/donem/yil)
 */
export async function getGenelLig(
  supabase: SupabaseClient,
  periyot: LigPeriyot
): Promise<GenelLigSonuc> {
  const [ligData, bolgelerRes, takimlarRes, firmalarRes] = await Promise.all([
    ligRpcCagir(supabase, periyot),
    supabase.from("bolgeler").select("bolge_id, bolge_adi").order("bolge_adi"),
    supabase.from("takimlar").select("takim_id, takim_adi").order("takim_adi"),
    supabase.from("firmalar").select("firma_id, firma_adi").order("firma_adi"),
  ]);

  if (bolgelerRes.error) throw new Error(`bolgeler SELECT: ${bolgelerRes.error.message}`);
  if (takimlarRes.error) throw new Error(`takimlar SELECT: ${takimlarRes.error.message}`);
  if (firmalarRes.error) throw new Error(`firmalar SELECT: ${firmalarRes.error.message}`);

  const lig: GenelLigSatiri[] = (ligData ?? []).map((l: any) => ({
    sira: l.firma_sirasi,
    bolge_sirasi: l.bolge_sirasi,
    takim_sirasi: l.takim_sirasi,
    kullanici_id: l.kullanici_id,
    ad: `${l.ad} ${l.soyad}`,
    rol: l.rol,
    bolge: l.bolge_adi ?? "-",
    takim: l.takim_adi ?? "-",
    firma: l.firma_adi ?? "-",
    izleme_puani: l.izleme_puani,
    cevaplama_puani: l.cevaplama_puani,
    oneri_puani: l.oneri_puani,
    extra_puani: l.extra_puani,
    toplam_puan: l.toplam_puan,
  }));

  const filtreler: GenelLigFiltreleri = {
    bolgeler: (bolgelerRes.data ?? []).map((b: any) => ({
      bolge_id: b.bolge_id,
      bolge_adi: b.bolge_adi,
    })),
    takimlar: (takimlarRes.data ?? []).map((t: any) => ({
      takim_id: t.takim_id,
      takim_adi: t.takim_adi,
    })),
    firmalar: (firmalarRes.data ?? []).map((f: any) => ({
      firma_id: f.firma_id,
      firma_adi: f.firma_adi,
    })),
  };

  return { tip: "genel", lig, filtreler };
}