// lib/admin/kullaniciDogrulama.ts
//
// KULLANICI EKLEME KURAL KİTABININ TEK KAYNAĞI (B-18 + B-21 düzeltmesi,
// admin modernizasyon planı M0). Tekli rota (kullanicilar POST) ve toplu
// yükleme (toplu-yukle) AYNI doğrulamayı buradan çağırır; rol kuralları
// roller.ts + ureticiYetenegi'nden türetilir, koda gömülü liste yoktur.
//
// B-22 kilidi: bölgeler firma kapsamında yüklenir (bolgeler → takimlar.firma_id
// zinciri) — başka firmanın aynı adlı bölgesi yapısal olarak eşleşemez.
//
// Tasarım: DB okuması tek seferlik (firmaYapisiYukle), satır doğrulaması
// saf fonksiyon (kullaniciSatirDogrula) — toplu yüklemede N sorgu üretmez.

import { SupabaseClient } from "@supabase/supabase-js";
import { TUM_ROLLER, TUKETICI_ROLLER } from "@/lib/utils/roller";
import { ureticiYetenegi } from "@/lib/uretici/yetenekler";

const ALAN_UZUNLUK_SINIRI = 200;

export interface FirmaYapisi {
  firma_id: string;
  takimlar: { takim_id: string; takim_adi: string }[];
  bolgeler: { bolge_id: string; bolge_adi: string; takim_id: string }[];
}

export interface KullaniciGirdisi {
  ad?: unknown;
  soyad?: unknown;
  eposta?: unknown;
  sifre?: unknown;
  rol?: unknown;
  takim_id?: unknown;
  takim_adi?: unknown;
  bolge_id?: unknown;
  bolge_adi?: unknown;
}

export interface DogrulanmisKullanici {
  ad: string;
  soyad: string;
  eposta: string;
  sifre: string;
  rol: string;
  takim_id: string | null;
  bolge_id: string | null;
}

export type SatirDogrulamaSonucu =
  | { ok: true; kayit: DogrulanmisKullanici }
  | { ok: false; hata: string; alanlar?: string[] };

/**
 * Firmanın takım/bölge yapısını TEK sorgu çiftiyle yükler.
 * Bölgeler firma kapsamına kilitlidir (B-22).
 */
export async function firmaYapisiYukle(
  adminSupabase: SupabaseClient,
  firma_id: string
): Promise<{ ok: true; yapi: FirmaYapisi } | { ok: false; hata: string }> {
  const { data: takimlar, error: takimError } = await adminSupabase
    .from("takimlar")
    .select("takim_id, takim_adi")
    .eq("firma_id", firma_id);

  if (takimError) return { ok: false, hata: "Takımlar çekilemedi." };

  const takimIdler = (takimlar ?? []).map((t) => t.takim_id);
  let bolgeler: FirmaYapisi["bolgeler"] = [];
  if (takimIdler.length > 0) {
    const { data, error: bolgeError } = await adminSupabase
      .from("bolgeler")
      .select("bolge_id, bolge_adi, takim_id")
      .in("takim_id", takimIdler);
    if (bolgeError) return { ok: false, hata: "Bölgeler çekilemedi." };
    bolgeler = data ?? [];
  }

  return { ok: true, yapi: { firma_id, takimlar: takimlar ?? [], bolgeler } };
}

function metinAl(deger: unknown): string {
  return typeof deger === "string" ? deger.trim() : "";
}

/**
 * Bir kullanıcı satırını doğrular ve temiz kayda çevirir. Kurallar:
 * - ad/soyad/eposta/sifre/rol zorunlu; alanlar ≤200; eposta '@' içerir.
 * - rol TUM_ROLLER'da olmalı (B-18 — geçersiz rol yapısal olarak giremez).
 * - Üretici roller: takım zorunluluğu yetenek profilinden (takimZorunlu).
 * - TM: takım zorunlu. BM/UTT/KD_UTT: bölge zorunlu, takım bölgeden türetilir.
 * - Diğer roller (yönetici/admin/İU): takım-bölge atanmaz.
 * - Takım/bölge id ya da adla verilebilir; eşleşme firma yapısı İÇİNDE aranır.
 */
export function kullaniciSatirDogrula(
  yapi: FirmaYapisi,
  girdi: KullaniciGirdisi
): SatirDogrulamaSonucu {
  const ad = metinAl(girdi.ad);
  const soyad = metinAl(girdi.soyad);
  const eposta = metinAl(girdi.eposta).toLowerCase();
  const sifre = metinAl(girdi.sifre);
  const rol = metinAl(girdi.rol).toLowerCase();

  if (!ad || !soyad || !eposta || !sifre || !rol) {
    return { ok: false, hata: "Zorunlu alan eksik (ad, soyad, eposta, sifre, rol).", alanlar: ["ad", "soyad", "eposta", "sifre", "rol"] };
  }
  for (const [alan, deger] of [["ad", ad], ["soyad", soyad], ["eposta", eposta], ["sifre", sifre]] as const) {
    if (deger.length > ALAN_UZUNLUK_SINIRI) {
      return { ok: false, hata: `${alan} ${ALAN_UZUNLUK_SINIRI} karakterden uzun olamaz.`, alanlar: [alan] };
    }
  }
  if (!eposta.includes("@")) {
    return { ok: false, hata: "Geçersiz e-posta adresi.", alanlar: ["eposta"] };
  }
  if (!TUM_ROLLER.includes(rol)) {
    return { ok: false, hata: `Geçersiz rol: "${rol}".`, alanlar: ["rol"] };
  }

  const takimIdGirdi = metinAl(girdi.takim_id);
  const takimAdiGirdi = metinAl(girdi.takim_adi);
  const bolgeIdGirdi = metinAl(girdi.bolge_id);
  const bolgeAdiGirdi = metinAl(girdi.bolge_adi);

  const takimBul = (): { ok: boolean; takim_id?: string; hata?: string } => {
    if (takimIdGirdi) {
      const t = yapi.takimlar.find((x) => x.takim_id === takimIdGirdi);
      return t ? { ok: true, takim_id: t.takim_id } : { ok: false, hata: "Takım bu firmada bulunamadı." };
    }
    if (takimAdiGirdi) {
      const t = yapi.takimlar.find((x) => x.takim_adi.toLowerCase() === takimAdiGirdi.toLowerCase());
      return t ? { ok: true, takim_id: t.takim_id } : { ok: false, hata: `"${takimAdiGirdi}" adında takım bu firmada bulunamadı.` };
    }
    return { ok: false };
  };

  const bolgeBul = (): { ok: boolean; bolge_id?: string; takim_id?: string; hata?: string } => {
    if (bolgeIdGirdi) {
      const b = yapi.bolgeler.find((x) => x.bolge_id === bolgeIdGirdi);
      return b ? { ok: true, bolge_id: b.bolge_id, takim_id: b.takim_id } : { ok: false, hata: "Bölge bu firmada bulunamadı." };
    }
    if (bolgeAdiGirdi) {
      const b = yapi.bolgeler.find((x) => x.bolge_adi.toLowerCase() === bolgeAdiGirdi.toLowerCase());
      return b ? { ok: true, bolge_id: b.bolge_id, takim_id: b.takim_id } : { ok: false, hata: `"${bolgeAdiGirdi}" adında bölge bu firmada bulunamadı.` };
    }
    return { ok: false };
  };

  let takim_id: string | null = null;
  let bolge_id: string | null = null;

  const yetenek = ureticiYetenegi(rol);

  if (yetenek) {
    const t = takimBul();
    if (yetenek.takimZorunlu) {
      if (!t.ok) return { ok: false, hata: t.hata ?? `${rol} rolü için takım zorunludur.`, alanlar: ["takim_adi"] };
      takim_id = t.takim_id!;
    } else if (takimIdGirdi || takimAdiGirdi) {
      if (!t.ok) return { ok: false, hata: t.hata ?? "Takım bulunamadı.", alanlar: ["takim_adi"] };
      takim_id = t.takim_id!;
    }
  } else if (rol === "tm") {
    const t = takimBul();
    if (!t.ok) return { ok: false, hata: t.hata ?? "tm rolü için takım zorunludur.", alanlar: ["takim_adi"] };
    takim_id = t.takim_id!;
  } else if (rol === "bm" || TUKETICI_ROLLER.includes(rol)) {
    const b = bolgeBul();
    if (!b.ok) return { ok: false, hata: b.hata ?? `${rol} rolü için bölge zorunludur.`, alanlar: ["bolge_adi"] };
    bolge_id = b.bolge_id!;
    takim_id = b.takim_id!;
  }
  // Diğer roller: takım/bölge atanmaz.

  return { ok: true, kayit: { ad, soyad, eposta, sifre, rol, takim_id, bolge_id } };
}
