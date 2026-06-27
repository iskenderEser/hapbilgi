// app/store/siparisler/_types.ts
//
// HBStore genel sipariş listesi sayfasının ortak tipleri.

import type { SiparisDurum, AdresSnapshot } from "@/lib/store/tipler";

// ─── SİPARİŞ SATIRI ──────────────────────────────────────────────────────────

/**
 * get_kapsamli_siparisler RPC'sinden dönen tek bir sipariş kaydı.
 * Ürün + alıcı bilgileri flat olarak gömülü (join sonucu).
 */
export interface SiparisSatiri {
  siparis_id: string;
  kullanici_id: string;
  urun_id: string;
  adres_snapshot: AdresSnapshot;
  adet: number;
  puan_birim_fiyat: number;
  toplam_puan: number;
  durum: SiparisDurum;
  kargo_firmasi: string | null;
  kargo_takip_no: string | null;
  iptal_sebebi: string | null;
  created_at: string;
  guncellenme_at: string | null;
  teslim_alma_at: string | null;

  // Ürün join
  urun_adi: string;
  urun_gorsel_url: string | null;

  // Alıcı (kullanıcı) join
  alici_ad: string;
  alici_soyad: string;
  alici_rol: string;
  alici_eposta: string;
}

// ─── HİYERARŞİ (filtre dropdown'ları için) ───────────────────────────────────

/**
 * Hiyerarşinin en alt katmanı: bir kullanıcı (BM / UTT / KD_UTT).
 */
export interface HiyerarsiKullanici {
  kullanici_id: string;
  ad: string;
  soyad: string;
  rol: string;
}

/**
 * Bölge düğümü: bölge bilgisi + altındaki kullanıcılar.
 * Sadece TM/üretici/yönetici/admin için kullanılır.
 */
export interface HiyerarsiBolge {
  bolge_id: string;
  bolge_adi: string;
  kullanicilar: HiyerarsiKullanici[];
}

/**
 * Takım düğümü: takım bilgisi + altındaki bölgeler.
 * Sadece üretici/yönetici/admin için kullanılır.
 */
export interface HiyerarsiTakim {
  takim_id: string;
  takim_adi: string;
  bolgeler: HiyerarsiBolge[];
}

/**
 * Firma düğümü: firma bilgisi + altındaki takımlar.
 * Sadece admin için kullanılır.
 */
export interface HiyerarsiFirma {
  firma_id: string;
  firma_adi: string;
  takimlar: HiyerarsiTakim[];
}

/**
 * /api/hiyerarsi endpoint'inden dönen rol bazlı yapı.
 * Rol değişkenine göre farklı alanlar dolu olur:
 *   - bm: rol + bolge_id + kullanicilar
 *   - tm: rol + takim_id + bolgeler
 *   - üretici/yönetici: rol + firma_id + takimlar
 *   - admin: rol + firmalar
 */
export interface Hiyerarsi {
  rol: string;
  hata?: string;

  // BM için
  bolge_id?: string;
  kullanicilar?: HiyerarsiKullanici[];

  // TM için
  takim_id?: string;
  bolgeler?: HiyerarsiBolge[];

  // Üretici / yönetici için
  firma_id?: string;
  takimlar?: HiyerarsiTakim[];

  // Admin için
  firmalar?: HiyerarsiFirma[];
}

// ─── FİLTRELER ───────────────────────────────────────────────────────────────

/**
 * Frontend filtre state'i. Boş string = "tümü".
 * API'ye gönderilirken boş string'ler atlanır (RPC NULL bekler).
 */
export interface Filtreler {
  firma_id: string;
  takim_id: string;
  bolge_id: string;
  kullanici_id: string;
  durum: string;
  tarih_baslangic: string; // ISO tarih (YYYY-MM-DD)
  tarih_bitis: string;
}

export const BOS_FILTRELER: Filtreler = {
  firma_id: "",
  takim_id: "",
  bolge_id: "",
  kullanici_id: "",
  durum: "",
  tarih_baslangic: "",
  tarih_bitis: "",
};