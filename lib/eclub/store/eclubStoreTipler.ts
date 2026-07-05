import type { NextResponse } from "next/server";

export interface EclubStoreKategori {
  kategori_id: string;
  ad: string;
  sira: number;
  aktif_mi: boolean;
}

export interface EclubStoreUrun {
  urun_id: string;
  kategori_id: string | null;
  ad: string;
  aciklama: string | null;
  gorsel_url: string | null;
  puan_fiyat: number;
  stok: number;
  aktif_mi: boolean;
}

export interface EclubStoreAdres {
  adres_id: string;
  kisi_id: string;
  baslik: string | null;
  ad_soyad: string;
  telefon: string;
  il: string;
  ilce: string;
  acik_adres: string;
  varsayilan_mi: boolean;
}

export interface EclubStoreFirmaBakiye {
  firma_id: string;
  firma_adi: string;
  kazanilan: number;
  harcanan: number;
  bakiye: number;
}

export interface EclubStoreSiparis {
  siparis_id: string;
  kisi_id: string;
  urun_id: string;
  adres_id: string | null;
  adres_snapshot: unknown | null;
  adet: number;
  puan_birim_fiyat: number;
  toplam_puan: number;
  durum: string;
  kargo_firmasi: string | null;
  kargo_takip_no: string | null;
  iptal_sebebi: string | null;
  created_at: string;
  guncellenme_at: string;
  teslim_alma_at: string | null;
}

export interface EclubStoreSiparisFirmaPuan {
  id: string;
  siparis_id: string;
  firma_id: string;
  kullanilan_puan: number;
}

export interface EclubStoreSiparisOlusturParams {
  kisi_id: string;
  urun_id: string;
  adres_id: string;
  adet: number;
}

export interface EclubStoreSiparisOlusturSonuc {
  ok: boolean;
  siparis_id: string | null;
  hata: string | null;
}

export interface EclubStoreSiparisIptalParams {
  siparis_id: string;
  iptal_eden_kisi_id: string;
  is_admin: boolean;
  sebep: string | null;
}

export interface EclubStoreKayitSonuc {
  ok: boolean;
  error?: string;
}

export type EclubStoreApiYanit = NextResponse;

export type EclubStoreAdminSekme = "urunler" | "kategoriler" | "siparisler";

export interface EclubStoreKategoriForm {
  kategori_id?: string;
  ad: string;
  sira: number;
  aktif_mi: boolean;
}

export interface EclubStoreUrunForm {
  urun_id?: string;
  kategori_id: string | null;
  ad: string;
  aciklama: string;
  gorsel_url: string | null;
  puan_fiyat: number;
  stok: number;
  aktif_mi: boolean;
}

export interface EclubStoreKategoriDetay extends EclubStoreKategori {
  urun_sayisi: number;
}

export interface EclubStoreUrunDetay extends EclubStoreUrun {
  kategori_adi: string | null;
}

export interface EclubStoreAdminSiparis {
  siparis_id: string;
  kisi_id: string;
  kisi_ad_soyad: string;
  urun_adi: string;
  adet: number;
  toplam_puan: number;
  durum: string;
  kargo_firmasi: string | null;
  kargo_takip_no: string | null;
  adres_snapshot: unknown | null;
  iptal_sebebi: string | null;
  created_at: string;
}

export interface EclubStoreGorselSonuc {
  ok: boolean;
  url?: string;
  yol?: string;
  error?: string;
}