// Yalnız sunucuda doğrulanan kimlik/kapsam; puan tahmini veya metadata rolü yok.
import type { SupabaseClient } from "@supabase/supabase-js";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { TUM_ROLLER, ECLUB_TUKETICI_ROLLERI, MUSTERI_ROLU } from "@/lib/utils/roller";
import { HapbiHata } from "@/lib/hapbi/sozlesme";

export interface HapbiKullaniciBaglami {
  kullanici_id: string;
  rol: string;
  kimlik_turu: string;
  firma_id: string | null;
  takim_id: string | null;
  bolge_id: string | null;
  firma_adi: string | null;
  takim_adi: string | null;
  bolge_adi: string | null;
  cc_aktif: boolean;
  eclub_aktif: boolean;
}

export async function getHapbiKullaniciBaglami(db: SupabaseClient, userId: string): Promise<HapbiKullaniciBaglami> {
  const rol = await rolCozucu(db, userId);
  if (![...TUM_ROLLER, ...ECLUB_TUKETICI_ROLLERI, MUSTERI_ROLU].includes(rol)) {
    throw new HapbiHata("YETKISIZ", 403, "Kullanıcı yetkisi doğrulanamadı.");
  }
  const { data: kimlik, error } = await db.from("v_auth_kimlik_admin")
    .select("kimlik_turu").eq("auth_id", userId).single();
  if (error || !kimlik) throw new HapbiHata("KIMLIK", 403, "Kullanıcı kimliği doğrulanamadı.");
  const baglam: HapbiKullaniciBaglami = {
    kullanici_id: userId, rol, kimlik_turu: kimlik.kimlik_turu,
    firma_id: null, takim_id: null, bolge_id: null, firma_adi: null, takim_adi: null, bolge_adi: null,
    cc_aktif: false, eclub_aktif: false,
  };
  if (kimlik.kimlik_turu !== "kullanici") return baglam;
  const { data: k, error: profilError } = await db.from("kullanicilar")
    .select("firma_id, takim_id, bolge_id, aktif_mi").eq("kullanici_id", userId).single();
  if (profilError || !k || k.aktif_mi !== true) {
    throw new HapbiHata("PROFIL", 403, "Aktif kullanıcı kaydı doğrulanamadı.");
  }
  baglam.bolge_id = k.bolge_id ?? null;
  baglam.takim_id = k.takim_id ?? null;
  baglam.firma_id = k.firma_id ?? null;
  // Eksik kapsam hiyerarşiden tamamlanır; çelişkide erişim kapanır.
  if (baglam.bolge_id) {
    const { data: b, error: e } = await db.from("bolgeler").select("takim_id, bolge_adi")
      .eq("bolge_id", baglam.bolge_id).single();
    if (e || !b || (baglam.takim_id && baglam.takim_id !== b.takim_id)) {
      throw new HapbiHata("KAPSAM", 403, "Bölge ve takım ataması doğrulanamadı.");
    }
    baglam.takim_id = b.takim_id;
    baglam.bolge_adi = b.bolge_adi ?? null;
  }
  if (baglam.takim_id) {
    const { data: t, error: e } = await db.from("takimlar").select("firma_id, takim_adi")
      .eq("takim_id", baglam.takim_id).single();
    if (e || !t || (baglam.firma_id && baglam.firma_id !== t.firma_id)) {
      throw new HapbiHata("KAPSAM", 403, "Takım ve firma ataması doğrulanamadı.");
    }
    baglam.firma_id = t.firma_id;
    baglam.takim_adi = t.takim_adi ?? null;
  }
  if (baglam.firma_id) {
    const { data: f, error: e } = await db.from("firmalar").select("aktif, cc_aktif, eclub_aktif, firma_adi")
      .eq("firma_id", baglam.firma_id).single();
    if (e || !f || f.aktif !== true) throw new HapbiHata("FIRMA", 403, "Aktif firma kaydı doğrulanamadı.");
    baglam.cc_aktif = f.cc_aktif === true;
    baglam.eclub_aktif = f.eclub_aktif === true;
    baglam.firma_adi = f.firma_adi ?? null;
  }
  return baglam;
}
export function hapbiKapsamAnahtari(k: HapbiKullaniciBaglami) {
  return JSON.stringify([k.kullanici_id, k.kimlik_turu, k.rol, k.firma_id, k.takim_id, k.bolge_id, k.cc_aktif, k.eclub_aktif]);
}
