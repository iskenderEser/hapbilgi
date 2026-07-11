// types/auth.ts
// Üç kimlik düzlemi: iç kullanıcı (kullanicilar), dış müşteri (eclub_kisiler),
// eczane müşterisi (eczanem_musteriler) — v_auth_kimlik'in kimlik_turu değerleri.
export type KimlikTuru = "kullanici" | "eclub_kisi" | "musteri";

export interface AuthKullanici {
  id: string;
  email: string;
  rol: string;
  ad: string;
  soyad: string;
  adSoyad: string;
  firma_id: string | null;
  kimlik_turu: KimlikTuru;
  telefon: string | null;
}