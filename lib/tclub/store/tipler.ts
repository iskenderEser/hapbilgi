// lib/store/tipler.ts
// HBStore ekosisteminin ortak tipleri.
// store/* modüllerinin import ettiği temel tip tanımları.
//
// İlgili dokümantasyon: HBStore Mimari Karar Belgesi 1-5.

// ─── KAYIT SONUÇ TİPİ ────────────────────────────────────────────────────────

/**
 * Tüm store kayıt fonksiyonlarının (sipariş oluştur, iptal, teslim al, adres)
 * standart dönüş tipi. ok=true ise işlem tamam; ok=false ise error mesajı dolu.
 */
export interface KayitSonuc {
  ok: boolean;
  error?: string;
}

// ─── ENUM'LAR ────────────────────────────────────────────────────────────────

export type SiparisDurum = "beklemede" | "iptal" | "kargoda" | "teslim_edildi";

export type HarcamaTuru = "harcama" | "iade";

// ─── KATEGORI ────────────────────────────────────────────────────────────────

export interface Kategori {
  kategori_id: string;
  ad: string;
  sira: number;
  aktif_mi: boolean;
  created_at: string;
}

// ─── ÜRÜN ────────────────────────────────────────────────────────────────────

export interface Urun {
  urun_id: string;
  kategori_id: string;
  ad: string;
  aciklama: string | null;
  gorsel_url: string | null;
  puan_fiyati: number;
  stok: number;
  aktif_mi: boolean;
  created_at: string;
  updated_at: string;
}

// ─── ADRES ───────────────────────────────────────────────────────────────────

export interface Adres {
  adres_id: string;
  kullanici_id: string;
  baslik: string;
  alici_adi: string;
  telefon: string;
  il: string;
  ilce: string;
  adres_detay: string;
  posta_kodu: string | null;
  varsayilan_mi: boolean;
  created_at: string;
}

/**
 * Yeni adres oluştururken/güncellerken kullanılır.
 * adres_id, kullanici_id, created_at otomatik atanır.
 */
export interface AdresInput {
  baslik: string;
  alici_adi: string;
  telefon: string;
  il: string;
  ilce: string;
  adres_detay: string;
  posta_kodu?: string | null;
  varsayilan_mi?: boolean;
}

// ─── ADRES SNAPSHOT (sipariş kayıt anında dondurulan) ────────────────────────

export interface AdresSnapshot {
  adres_id: string;
  baslik: string;
  alici_adi: string;
  telefon: string;
  il: string;
  ilce: string;
  adres_detay: string;
  posta_kodu: string | null;
}

// ─── SİPARİŞ ─────────────────────────────────────────────────────────────────

export interface Siparis {
  siparis_id: string;
  kullanici_id: string;
  urun_id: string;
  adres_id: string | null;
  adres_snapshot: AdresSnapshot;
  adet: number;
  puan_birim_fiyat: number;
  toplam_puan: number;
  durum: SiparisDurum;
  kargo_firmasi: string | null;
  kargo_takip_no: string | null;
  iptal_sebebi: string | null;
  created_at: string;
  guncellenme_at: string;
  teslim_alma_at: string | null;
}

// ─── SİPARİŞ OLUŞTURMA PARAMETRELERİ ─────────────────────────────────────────

export interface SiparisOlusturParams {
  kullanici_id: string;
  urun_id: string;
  adres_id: string;
  adet: number;
}

/**
 * store_siparis_olustur RPC'sinin dönüş tipi.
 * RPC TABLE döner, satır halinde ok/siparis_id/hata.
 */
export interface SiparisOlusturSonuc {
  ok: boolean;
  siparis_id: string | null;
  hata: string | null;
}

// ─── SİPARİŞ İPTAL PARAMETRELERİ ─────────────────────────────────────────────

export interface SiparisIptalParams {
  siparis_id: string;
  iptal_eden_id: string;
  is_admin: boolean;
  sebep?: string | null;
}

// ─── HARCAMA KAYDI ───────────────────────────────────────────────────────────

export interface Harcama {
  harcama_id: string;
  kullanici_id: string;
  siparis_id: string;
  puan_miktari: number;
  tur: HarcamaTuru;
  created_at: string;
}

// ─── SİPARİŞ + ÜRÜN JOIN (UI gösterimi için) ─────────────────────────────────

/**
 * Sipariş + ürün join'i. Siparişler API'sinden gelen veri.
 * store_urunler join'i sadece görsel + ad döner (UI için).
 */
export interface SiparisGosterim extends Siparis {
  store_urunler: {
    ad: string;
    gorsel_url: string | null;
  } | null;
}
