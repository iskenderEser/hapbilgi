import type { SupabaseClient } from "@supabase/supabase-js";
import { HAPBI_ROL_MATRISI, type HapbiRolKapsami } from "@/lib/hapbi/kapsam/rolMatrisi";
import { HapbiHata } from "@/lib/hapbi/sozlesme";
import {
  ECLUB_TUKETICI_ROLLERI,
  TUKETICI_ROLLER,
  URETICI_ROLLER,
  YONETICI_ROLLER,
  YONLENDIRICI_ROLLER,
} from "@/lib/utils/roller";
import { rolCozucu } from "@/lib/utils/rolCozucu";

export interface HapbiCozulmusKapsam {
  authKullaniciId: string;
  kimlikTuru: "kullanici" | "eclub_kisi";
  rol: string;
  firmaId: string | null;
  takimId: string | null;
  bolgeId: string | null;
  rolKapsami: HapbiRolKapsami;
}

const HAPBI_KAPSAM_ROLLERI = new Set<string>([
  ...TUKETICI_ROLLER,
  ...YONLENDIRICI_ROLLER,
  ...URETICI_ROLLER,
  ...YONETICI_ROLLER,
  ...ECLUB_TUKETICI_ROLLERI,
]);

function kapsamHatasi(mesaj: string): never {
  throw new HapbiHata("HAPBI_KAPSAM", 403, mesaj);
}

export async function hapbiKapsaminiCoz(
  db: SupabaseClient,
  authKullaniciId: string,
): Promise<HapbiCozulmusKapsam> {
  const rol = await rolCozucu(db, authKullaniciId);
  const rolKapsami = HAPBI_ROL_MATRISI[rol];

  if (!HAPBI_KAPSAM_ROLLERI.has(rol) || !rolKapsami?.hapbiErisimi) {
    kapsamHatasi("Kullanıcının HapBi kapsamı bulunmuyor.");
  }

  const { data: kimlik, error: kimlikHatasi } = await db
    .from("v_auth_kimlik_admin")
    .select("kimlik_turu")
    .eq("auth_id", authKullaniciId)
    .maybeSingle();

  if (kimlikHatasi || !kimlik) {
    kapsamHatasi("Kullanıcı kimliği doğrulanamadı.");
  }

  if (kimlik.kimlik_turu === "eclub_kisi") {
    if (!ECLUB_TUKETICI_ROLLERI.includes(rol)) {
      kapsamHatasi("E-Club kimliği ile rol ilişkisi doğrulanamadı.");
    }

    return {
      authKullaniciId,
      kimlikTuru: "eclub_kisi",
      rol,
      firmaId: null,
      takimId: null,
      bolgeId: null,
      rolKapsami,
    };
  }

  if (kimlik.kimlik_turu !== "kullanici" || ECLUB_TUKETICI_ROLLERI.includes(rol)) {
    kapsamHatasi("İç kullanıcı kimliği ile rol ilişkisi doğrulanamadı.");
  }

  const { data: kullanici, error: kullaniciHatasi } = await db
    .from("kullanicilar")
    .select("firma_id, takim_id, bolge_id, aktif_mi")
    .eq("kullanici_id", authKullaniciId)
    .maybeSingle();

  if (kullaniciHatasi || !kullanici || kullanici.aktif_mi !== true) {
    kapsamHatasi("Aktif kullanıcı kaydı doğrulanamadı.");
  }

  let firmaId = kullanici.firma_id ?? null;
  let takimId = kullanici.takim_id ?? null;
  const bolgeId = kullanici.bolge_id ?? null;

  if (bolgeId) {
    const { data: bolge, error: bolgeHatasi } = await db
      .from("bolgeler")
      .select("takim_id")
      .eq("bolge_id", bolgeId)
      .maybeSingle();

    if (bolgeHatasi || !bolge || (takimId && takimId !== bolge.takim_id)) {
      kapsamHatasi("Bölge ve takım ilişkisi doğrulanamadı.");
    }
    takimId = bolge.takim_id;
  }

  if (takimId) {
    const { data: takim, error: takimHatasi } = await db
      .from("takimlar")
      .select("firma_id")
      .eq("takim_id", takimId)
      .maybeSingle();

    if (takimHatasi || !takim || (firmaId && firmaId !== takim.firma_id)) {
      kapsamHatasi("Takım ve firma ilişkisi doğrulanamadı.");
    }
    firmaId = takim.firma_id;
  }

  if (firmaId) {
    const { data: firma, error: firmaHatasi } = await db
      .from("firmalar")
      .select("aktif")
      .eq("firma_id", firmaId)
      .maybeSingle();

    if (firmaHatasi || !firma || firma.aktif !== true) {
      kapsamHatasi("Aktif firma ilişkisi doğrulanamadı.");
    }
  }

  return {
    authKullaniciId,
    kimlikTuru: "kullanici",
    rol,
    firmaId,
    takimId,
    bolgeId,
    rolKapsami,
  };
}
