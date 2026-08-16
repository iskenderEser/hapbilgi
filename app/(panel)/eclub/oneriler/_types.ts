// app/eclub/oneriler/_types.ts

import type { YayindakiVideo } from "@/lib/video/yayindakiVideolar";
import { ECLUB_KISI_ROL_ETIKETLERI, type EclubKisiRol } from "@/lib/utils/roller";

export type EclubHedefRol = "eczaci" | "eczane_teknisyeni";

// Önerilebilir yayın (yayinlar GET).
export interface OneriYayin extends Omit<YayindakiVideo, "hedef_roller"> {
  hedef_roller: EclubHedefRol[];
}

// Öneri alıcısı adayı (kisiler GET'ten türetilir).
export interface OneriKisi {
  kisi_id: string;
  ad: string;
  soyad: string;
  rol: EclubKisiRol;
  eczane_adi: string | null;
  aktif_mi: boolean;
  auth_user_id: string | null;
}

export interface OneriLimitler {
  aylik: {
    kullanilan: number;
    kota: number;
    kalan: number;
  };
}

export interface OneriGecmisKaydi {
  yayin_id: string;
  created_at: string;
}

// POST sonucu (atla-raporla).
export interface OneriGonderSonuc {
  gonderilen_sayisi: number;
  gonderilen: string[];
  atlanan: { kisi_id: string; sebep: string }[];
}

export const ROL_ETIKETLERI: Record<EclubHedefRol | EclubKisiRol, string> = {
  ...ECLUB_KISI_ROL_ETIKETLERI,
};

// Atlanma sebebi → kullanıcıya gösterilecek açıklama.
export const ATLANMA_SEBEP_ETIKETLERI: Record<string, string> = {
  bulunamadi: "Kişi bulunamadı",
  sahiplik_yok: "Bu kişi sizin eczanenize bağlı değil",
  pasif: "Kişi pasif durumda",
  rol_uyumsuz: "Kişinin rolü videonun hedefiyle uyuşmuyor",
  giris_hesabi_yok: "Kişinin giriş hesabı henüz hazır değil",
  tekrar: "Bu kişi için belirlenen tekrar gönderim süresi henüz dolmadı",
  alici_limiti: "Kişinin öneri alma limiti dolu",
  kredi_yok: "Aylık öneri krediniz yetmedi",
  kayit_hatasi: "Kayıt sırasında hata oluştu",
};
