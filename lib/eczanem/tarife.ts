// lib/eczanem/tarife.ts
// Eczanem ürün tarifesi (Karşılık) + barkod tek kaynağı (U5, K-E3 kapalı karar).
//
// K-E3 (11.07.2026, İskender): "Müşteri aleyhine değişmez" kuralının teknik
// yorumu — yeni tarife YALNIZ İLERİYE işler. eczanem_urun_tarifeleri append-only
// bir tarihçedir: güncel tarife = gecerlilik_baslangic <= now olan en son satır.
// Eski satırlar hiç değiştirilmez; harcama anında (U8) geçerli tarife seçilir,
// böylece geçmiş kazanım geriye dönük değersizleşmez.
//
// Barkod + Karşılık'ın evi ürün seviyesidir (İP §2): bakiye ürün bazlı
// birleştiğinden karşılık da ürün başına tek güncel değer olmak zorundadır
// (iki yayının iki farklı karşılığı tanımsızlık üretir). Bu yüzden yazım
// yayına-alma UX'inde toplanır ama urunler.barkod + eczanem_urun_tarifeleri'ne
// düşer — yayın satırına değil.
//
// Korumalı tablo: eczanem_urun_tarifeleri KORUMALI_TABLOLAR'dadır; INSERT
// yalnız bu tek-kaynak üzerinden yapılır (tools/eslint-rules kayit-tek-kaynak).

import { SupabaseClient } from "@supabase/supabase-js";

export interface TarifeGiris {
  urun_id: string;
  barkod: string;
  puan: number;
  tl: number;
  olusturan_id: string;
}

export interface TarifeSonuc {
  ok: boolean;
  hata?: string;
  // Yeni tarife satırı açıldı mı (değer değiştiyse true, aynıysa false).
  yeniTarife?: boolean;
}

export interface GuncelTarife {
  puan: number;
  tl: number;
}

// Ürünün şu an geçerli tarifesi: gecerlilik_baslangic <= now olan en son satır.
// Hiç tarife yoksa null (ürün ilk kez eczanem yayınına giriyor).
export async function guncelTarife(
  adminSupabase: SupabaseClient,
  urun_id: string
): Promise<GuncelTarife | null> {
  const simdi = new Date().toISOString();
  const { data } = await adminSupabase
    .from("eczanem_urun_tarifeleri")
    .select("puan, tl")
    .eq("urun_id", urun_id)
    .lte("gecerlilik_baslangic", simdi)
    .order("gecerlilik_baslangic", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return { puan: data.puan, tl: Number(data.tl) };
}

// Barkod + Karşılık'ı ürün seviyesine yazar:
//  1) urunler.barkod her hâlükârda güncellenir (ürün kimliği — tek güncel değer).
//  2) Karşılık yalnız değiştiyse yeni tarife satırı açılır (append-only, ileriye
//     işler); değişmediyse tarihçe şişirilmez (K-E3: değer aynıysa satır açılmaz).
export async function tarifeVeBarkodYaz(
  adminSupabase: SupabaseClient,
  giris: TarifeGiris
): Promise<TarifeSonuc> {
  const { urun_id, barkod, puan, tl, olusturan_id } = giris;

  // 1) Barkod — ürün seviyesinde tek güncel değer.
  const { error: barkodHatasi } = await adminSupabase
    .from("urunler")
    .update({ barkod })
    .eq("urun_id", urun_id);

  if (barkodHatasi) return { ok: false, hata: "Barkod yazılamadı." };

  // 2) Karşılık — değişmediyse yeni satır açma.
  const mevcut = await guncelTarife(adminSupabase, urun_id);
  if (mevcut && mevcut.puan === puan && mevcut.tl === Number(tl)) {
    return { ok: true, yeniTarife: false };
  }

  const { error: tarifeHatasi } = await adminSupabase
    .from("eczanem_urun_tarifeleri")
    .insert({
      urun_id,
      puan,
      tl,
      gecerlilik_baslangic: new Date().toISOString(),
      olusturan_id,
    });

  if (tarifeHatasi) return { ok: false, hata: "Karşılık (tarife) yazılamadı." };

  return { ok: true, yeniTarife: true };
}
