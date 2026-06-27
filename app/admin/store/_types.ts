// app/admin/store/_types.ts
//
// HBStore admin panelinde ortak kullanılan tipler.
// Hook'lar ve sekme bileşenleri arasında paylaşılır.

import type { Urun, Siparis } from "@/lib/store/tipler";

// ─── ÜRÜN (kategori adı join'li) ─────────────────────────────────────────────

/**
 * Admin ürün tablosunda gösterilen ürün.
 * Mevcut Urun tipine kategori adını ekler (store_kategoriler join'inden gelir).
 */
export interface UrunGosterim extends Urun {
  store_kategoriler?: { ad: string } | null;
}

// ─── SİPARİŞ (ürün ve kullanıcı join'li) ─────────────────────────────────────

/**
 * Admin sipariş listesinde gösterilen sipariş.
 * Mevcut Siparis tipine iki join ekler:
 *   - store_urunler: Ürün adı + görsel
 *   - kullanicilar: Sipariş veren kullanıcı bilgisi (ad, soyad, email, rol)
 */
export interface SiparisGosterim extends Siparis {
  store_urunler: {
    ad: string;
    gorsel_url: string | null;
  } | null;
  kullanicilar: {
    ad: string;
    soyad: string;
    eposta: string;
    rol: string;
  } | null;
}

// ─── SEKME ENUM'U ────────────────────────────────────────────────────────────

/**
 * Admin panelinde aktif olan sekme.
 * page.tsx ve useStoreAdminPanel hook'u arasında paylaşılır.
 */
export type Sekme = "urunler" | "kategoriler" | "siparisler";