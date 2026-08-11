// Üst roller için HBLigi saha görünümü.
// Güvenlik ilkesi: kapsam, istemci filtresinden değil oturum kullanıcısının
// firma/takım/bölge kimliklerinden türetilir. RPC sistem genelini döndürse bile
// bu katmanın dışına yalnız yetkili karşılaştırma havuzu çıkar.

import type { SupabaseClient } from "@supabase/supabase-js";
import { ligRpcCagir, type LigPeriyot } from "@/lib/hbligi_v2/ligRpcCagir";

export type SahaGorunumu = "bm" | "tm" | "uretici" | "yonetici" | "admin";
export type SahaBirimTuru = "bolge" | "takim" | "firma";

export interface SahaLigKullanici {
  kullanici_id: string;
  ad: string;
  rol: string;
  firma_id: string | null;
  firma: string;
  takim_id: string | null;
  takim: string;
  bolge_id: string | null;
  bolge: string;
  izleme_puani: number;
  cevaplama_puani: number;
  oneri_puani: number;
  extra_puani: number;
  ileri_sarma_kaybi: number;
  yanlis_cevap_kaybi: number;
  oneri_kaybi: number;
  toplam_puan: number;
}

export interface SahaLigSonuc {
  tip: "saha";
  gorunum: SahaGorunumu;
  kapsam_adi: string;
  kapsam_aciklamasi: string;
  ana_birim: SahaBirimTuru;
  odak_birim_id: string | null;
  lig: SahaLigKullanici[];
}

export interface SahaLigKapsami {
  gorunum: SahaGorunumu;
  firma_id: string | null;
  takim_id: string | null;
  bolge_id: string | null;
}

function sayi(value: unknown): number {
  const sonuc = Number(value ?? 0);
  return Number.isFinite(sonuc) ? sonuc : 0;
}

function satiraCevir(row: Record<string, unknown>): SahaLigKullanici {
  return {
    kullanici_id: String(row.kullanici_id),
    ad: `${String(row.ad ?? "")} ${String(row.soyad ?? "")}`.trim(),
    rol: String(row.rol ?? "utt"),
    firma_id: row.firma_id ? String(row.firma_id) : null,
    firma: String(row.firma_adi ?? "-"),
    takim_id: row.takim_id ? String(row.takim_id) : null,
    takim: String(row.takim_adi ?? "-"),
    bolge_id: row.bolge_id ? String(row.bolge_id) : null,
    bolge: String(row.bolge_adi ?? "-"),
    izleme_puani: sayi(row.izleme_puani),
    cevaplama_puani: sayi(row.cevaplama_puani),
    oneri_puani: sayi(row.oneri_puani),
    extra_puani: sayi(row.extra_puani),
    ileri_sarma_kaybi: sayi(row.ileri_sarma_kaybi),
    yanlis_cevap_kaybi: sayi(row.yanlis_cevap_kaybi),
    oneri_kaybi: sayi(row.oneri_kaybi),
    toplam_puan: sayi(row.toplam_puan),
  };
}

function ilkAd(satirlar: SahaLigKullanici[], alan: "firma" | "takim" | "bolge", fallback: string): string {
  const ad = satirlar.find((satir) => satir[alan] && satir[alan] !== "-")?.[alan];
  return ad || fallback;
}

/**
 * Rolün yetkili karşılaştırma havuzunu döndürür.
 * - BM: takım havuzu; varsayılan odak kendi bölgesi.
 * - TM: firma havuzu; varsayılan odak kendi takımı.
 * - Üretici: yalnız kendi takım havuzu.
 * - Yönetici: yalnız kendi firma havuzu.
 * - Admin: sistem geneli; firma kırılımı.
 */
export async function getSahaLig(
  supabase: SupabaseClient,
  kapsam: SahaLigKapsami,
  periyot: LigPeriyot,
): Promise<SahaLigSonuc> {
  const tumSatirlar = (await ligRpcCagir(supabase, periyot)).map((row) => satiraCevir(row));

  if (kapsam.gorunum === "admin") {
    return {
      tip: "saha",
      gorunum: "admin",
      kapsam_adi: "Tüm firmalar",
      kapsam_aciklamasi: "Firmalar arası saha performansı",
      ana_birim: "firma",
      odak_birim_id: null,
      lig: tumSatirlar,
    };
  }

  if (!kapsam.firma_id) {
    throw new Error("HBLigi saha görünümü için firma ataması gerekli.");
  }

  const firmaSatirlari = tumSatirlar.filter((satir) => satir.firma_id === kapsam.firma_id);

  if (kapsam.gorunum === "yonetici") {
    return {
      tip: "saha",
      gorunum: "yonetici",
      kapsam_adi: ilkAd(firmaSatirlari, "firma", "Firma sahası"),
      kapsam_aciklamasi: "Firma genelinde takım ve UTT performansı",
      ana_birim: "takim",
      odak_birim_id: null,
      lig: firmaSatirlari,
    };
  }

  if (!kapsam.takim_id) {
    throw new Error("HBLigi saha görünümü için takım ataması gerekli.");
  }

  const takimSatirlari = firmaSatirlari.filter((satir) => satir.takim_id === kapsam.takim_id);

  if (kapsam.gorunum === "tm") {
    return {
      tip: "saha",
      gorunum: "tm",
      kapsam_adi: ilkAd(takimSatirlari, "takim", "Takım sahası"),
      kapsam_aciklamasi: "Firma takımları içinde kendi takımının konumu",
      ana_birim: "takim",
      odak_birim_id: kapsam.takim_id,
      lig: firmaSatirlari,
    };
  }

  if (kapsam.gorunum === "uretici") {
    return {
      tip: "saha",
      gorunum: "uretici",
      kapsam_adi: ilkAd(takimSatirlari, "takim", "Takım sahası"),
      kapsam_aciklamasi: "Üretilen içeriğin takım sahasındaki karşılığı",
      ana_birim: "bolge",
      odak_birim_id: null,
      lig: takimSatirlari,
    };
  }

  if (!kapsam.bolge_id) {
    throw new Error("BM HBLigi görünümü için bölge ataması gerekli.");
  }

  const bolgeSatirlari = takimSatirlari.filter((satir) => satir.bolge_id === kapsam.bolge_id);
  return {
    tip: "saha",
    gorunum: "bm",
    kapsam_adi: ilkAd(bolgeSatirlari, "bolge", "Bölge sahası"),
    kapsam_aciklamasi: "Takım bölgeleri içinde kendi bölgesinin konumu",
    ana_birim: "bolge",
    odak_birim_id: kapsam.bolge_id,
    lig: takimSatirlari,
  };
}
