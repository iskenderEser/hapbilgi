// app/eclub/listem/_types.ts

// E-Club kişi rolü — eczacı veya eczane teknisyeni.
export type EclubKisiRol = "eczaci" | "eczane_teknisyeni";

// Eczane satırı (liste). GET /eclub/listem/api/eczaneler'den gelir.
// Üç katmanlı model: firma/UTT bağı ilişki tablosunda; burada kimlik + türetilmiş sayılar.
export interface Eczane {
  eczane_id: string;
  gln: string;
  eczane_adi: string;
  created_at: string;
  eczaci_var: boolean;
  teknisyen_sayisi: number;
  toplam_kisi: number;
}

// Kişi satırı. GET /eclub/listem/api/kisiler'den gelir.
export interface Kisi {
  kisi_id: string;
  eczane_id: string;
  eczane_adi: string | null;
  rol: EclubKisiRol;
  ad: string;
  soyad: string;
  eposta: string;
  telefon: string;
  auth_user_id: string | null;
  aktif_mi: boolean;
  created_at: string;
}

// GLN sorgu sonucundaki kişi (havuzdan gelen eczacı/teknisyen).
export interface GlnKisi {
  kisi_id: string;
  rol: EclubKisiRol;
  ad: string;
  soyad: string;
  eposta: string;
  telefon: string;
  auth_user_id: string | null;
}

// GLN sorgu sonucu. GET /eclub/listem/api/eczaneler?gln=...'den gelir.
export interface GlnSorguSonuc {
  var: boolean;
  master_yok?: boolean;       // master listede hiç yok → elle ekleme (admin onayı)
  onay_bekliyor?: boolean;    // master'da var ama admin onayı bekliyor
  listede?: boolean;          // bu firmanın aktif listesinde mi
  eczane?: { eczane_id: string | null; gln: string; eczane_adi: string; il: string; ilce: string | null };
  eczaci?: GlnKisi | null;
  teknisyenler?: GlnKisi[];
}

// Yeni kişi formu (eczane bloğundaki "kişi ekle" ile açılır). POST /kisiler gövdesi.
// sifre: geçici auth için — yeni kişide zorunlu (test: UTT belirler), mevcut kişide
// (havuzda zaten varsa) gönderilse de backend kullanmaz.
export interface YeniKisiForm {
  rol: EclubKisiRol | "";
  ad: string;
  soyad: string;
  eposta: string;
  telefon: string;
  sifre: string;
}

// Rol etiketleri (görüntüleme).
export const KISI_ROL_ETIKETLERI: Record<EclubKisiRol, string> = {
  eczaci: "Eczacı",
  eczane_teknisyeni: "Eczane Teknisyeni",
};

// GLN 13 hane ön-kontrolü (nihai kontrol backend'de). Anında geri bildirim için.
export function glnGecerliMi(gln: string): boolean {
  return /^\d{13}$/.test(gln.trim());
}

// Eposta ön-kontrolü (nihai kontrol backend'de).
export function epostaGecerliMi(eposta: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(eposta.trim());
}

// Telefon 11-hane ön-kontrolü (nihai kontrol backend'de + DB UNIQUE).
export function telefonGecerliMi(telefon: string): boolean {
  return /^\d{11}$/.test(telefon.trim());
}