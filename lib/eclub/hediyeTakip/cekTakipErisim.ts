import type { SupabaseClient } from "@supabase/supabase-js";
import { TUKETICI_ROLLER } from "@/lib/utils/roller";

export type CekTakipRolu = "utt" | "kd_utt";

export const CEK_TAKIP_ROLLERI = TUKETICI_ROLLER as readonly CekTakipRolu[];

export interface CekTakipKapsami {
  kullanici_id: string;
  utt_id: string;
  firma_id: string;
  rol: CekTakipRolu;
}

export type CekTakipErisimHataKodu =
  | "veri_hatasi"
  | "kullanici_bulunamadi"
  | "kullanici_pasif"
  | "rol_yetkisiz"
  | "firma_bulunamadi"
  | "firma_pasif"
  | "eclub_kapali"
  | "hediye_ceki_kapali";

export type CekTakipErisimSonucu =
  | { ok: true; kapsam: CekTakipKapsami }
  | { ok: false; kod: CekTakipErisimHataKodu; mesaj: string; detay?: unknown };

export function cekTakipRoluneIzinVarMi(rol: string | null | undefined): rol is CekTakipRolu {
  return CEK_TAKIP_ROLLERI.includes((rol ?? "").trim().toLowerCase() as CekTakipRolu);
}

/**
 * Çek talebi sorgularının değişmez sunucu kapsamı.
 * İstemciden firma veya UTT kimliği alınmaz; her iki değer de oturumdan çözülür.
 */
export function cekTakipTalepKapsami(kapsam: CekTakipKapsami) {
  return {
    firma_id: kapsam.firma_id,
    utt_id: kapsam.utt_id,
  } as const;
}

/**
 * UTT/KD_UTT kullanıcısını ve bağlı olduğu aktif E-Club firmasını doğrular.
 * Service-role istemcisi yalnız doğrulama ve kapsam çözümleme için kullanılır;
 * dönen kapsam sonraki veri sorgularında firma_id + utt_id birlikte uygulanmalıdır.
 */
export async function cekTakipKapsaminiCoz(
  adminSupabase: SupabaseClient,
  authUserId: string,
): Promise<CekTakipErisimSonucu> {
  const { data: kullanici, error: kullaniciHatasi } = await adminSupabase
    .from("kullanicilar")
    .select("kullanici_id, rol, firma_id, aktif_mi")
    .eq("kullanici_id", authUserId)
    .maybeSingle();

  if (kullaniciHatasi) {
    return {
      ok: false,
      kod: "veri_hatasi",
      mesaj: "Çek Takip kullanıcı kapsamı doğrulanamadı.",
      detay: kullaniciHatasi,
    };
  }
  if (!kullanici) {
    return { ok: false, kod: "kullanici_bulunamadi", mesaj: "Kullanıcı bulunamadı." };
  }
  if (kullanici.aktif_mi !== true) {
    return { ok: false, kod: "kullanici_pasif", mesaj: "Kullanıcı hesabı aktif değil." };
  }

  const rol = (kullanici.rol ?? "").trim().toLowerCase();
  if (!cekTakipRoluneIzinVarMi(rol)) {
    return {
      ok: false,
      kod: "rol_yetkisiz",
      mesaj: "Çek Takip sayfasına yalnız UTT ve KD_UTT rolleri erişebilir.",
    };
  }
  if (!kullanici.firma_id) {
    return {
      ok: false,
      kod: "firma_bulunamadi",
      mesaj: "Çek Takip için firma bağlantısı bulunamadı.",
    };
  }

  const { data: firma, error: firmaHatasi } = await adminSupabase
    .from("firmalar")
    .select("firma_id, aktif, eclub_aktif, eclub_store_aktif")
    .eq("firma_id", kullanici.firma_id)
    .maybeSingle();

  if (firmaHatasi) {
    return {
      ok: false,
      kod: "veri_hatasi",
      mesaj: "Çek Takip firma kapsamı doğrulanamadı.",
      detay: firmaHatasi,
    };
  }
  if (!firma) {
    return { ok: false, kod: "firma_bulunamadi", mesaj: "Firma bulunamadı." };
  }
  if (firma.aktif !== true) {
    return { ok: false, kod: "firma_pasif", mesaj: "Bağlı firma aktif değil." };
  }
  if (firma.eclub_aktif !== true) {
    return { ok: false, kod: "eclub_kapali", mesaj: "E-Club firmanız için kapalıdır." };
  }
  if (firma.eclub_store_aktif !== true) {
    return {
      ok: false,
      kod: "hediye_ceki_kapali",
      mesaj: "E-Club Hediye Çeki firmanız için kapalıdır.",
    };
  }

  return {
    ok: true,
    kapsam: {
      kullanici_id: kullanici.kullanici_id,
      utt_id: kullanici.kullanici_id,
      firma_id: kullanici.firma_id,
      rol,
    },
  };
}
