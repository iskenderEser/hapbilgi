// types/auth.ts
export type KimlikTuru = "kullanici" | "eclub_kisi";

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