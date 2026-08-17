// app/eclub/oneriler/_types.ts

import type { YayindakiVideo } from "@/lib/video/yayindakiVideolar";
import { ECLUB_KISI_ROL_ETIKETLERI, type EclubKisiRol } from "@/lib/utils/roller";

export type EclubHedefRol = "eczaci" | "eczane_teknisyeni";

// Önerilebilir yayın (yayinlar GET).
export interface OneriYayin extends Omit<YayindakiVideo, "hedef_roller"> {
  video_id: string;
  hedef_roller: EclubHedefRol[];
  soru_sayisi?: number | null;
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
  gecerlilik_gun?: number;
  ayni_video_tekrar_bekleme_gun?: number;
}

export interface OneriTekrarEngeli {
  video_id: string;
  kisi_id: string;
  yeniden_gonderilebilir_at: string;
}

export interface OneriGecmisKaydi {
  oneri_id: string;
  yayin_id: string;
  video_id: string;
  urun_adi: string;
  teknik_adi: string;
  talep_no: number | null;
  firma_adi: string | null;
  hedef_roller: EclubHedefRol[];
  kisi_id: string;
  kisi_ad: string;
  kisi_soyad: string;
  kisi_rol: EclubKisiRol | null;
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
  atlanan: { kisi_id: string; sebep: string; yeniden_gonderilebilir_at?: string }[];
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
  kayit_hatasi: "Kayıt sırasında hata oluştu",
};
