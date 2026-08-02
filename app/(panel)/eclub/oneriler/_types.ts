// app/eclub/oneriler/_types.ts

export type EclubHedefRol = "eczaci" | "eczane_teknisyeni";

// Önerilebilir yayın (yayinlar GET).
export interface OneriYayin {
  yayin_id: string;
  urun_adi: string | null;
  teknik_adi: string | null;
  hedef_rol: EclubHedefRol;
  video_url: string | null;
  thumbnail_url: string | null;
}

// Öneri alıcısı adayı (kisiler GET'ten türetilir).
export interface OneriKisi {
  kisi_id: string;
  ad: string;
  soyad: string;
  rol: EclubHedefRol;
  eczane_adi: string | null;
  aktif_mi: boolean;
}

// Öneri geçmişi satırı (oneriler GET).
export interface OneriGecmis {
  oneri_id: string;
  yayin_id: string;
  urun_adi: string;
  teknik_adi: string;
  hedef_rol: EclubHedefRol | null;
  kisi_id: string;
  kisi_ad: string;
  kisi_soyad: string;
  kisi_rol: EclubHedefRol | null;
  eczane_adi: string;
  oneri_baslangic: string;
  oneri_bitis: string;
  izlendi_mi: boolean;
  created_at: string;
}

// POST sonucu (atla-raporla).
export interface OneriGonderSonuc {
  gonderilen_sayisi: number;
  gonderilen: string[];
  atlanan: { kisi_id: string; sebep: string }[];
}

export const ROL_ETIKETLERI: Record<EclubHedefRol, string> = {
  eczaci: "Eczacı",
  eczane_teknisyeni: "Eczane Teknisyeni",
};

// Atlanma sebebi → kullanıcıya gösterilecek açıklama.
export const ATLANMA_SEBEP_ETIKETLERI: Record<string, string> = {
  bulunamadi: "Kişi bulunamadı",
  sahiplik_yok: "Bu kişi sizin eczanenize bağlı değil",
  pasif: "Kişi pasif durumda",
  rol_uyumsuz: "Kişinin rolü videonun hedefiyle uyuşmuyor",
  tekrar: "Bu kişiye son 7 gün içinde zaten öneri gönderdiniz",
  alici_limiti: "Kişinin haftalık öneri alma limiti dolu",
  kredi_yok: "Aylık öneri krediniz yetmedi",
  kayit_hatasi: "Kayıt sırasında hata oluştu",
};