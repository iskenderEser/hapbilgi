import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { musteriKimligi } from "@/lib/eczanem/oturum";
import { TUKETICI_ROLLER } from "@/lib/utils/roller";

export type OgrenmeAraciIzlemeTablosu =
  | "izleme_kayitlari"
  | "cc_izleme_kayitlari"
  | "eclub_izleme_kayitlari"
  | "eczanem_izleme_kayitlari";

export interface OgrenmeAraciIzlemeSahibi {
  tablo: OgrenmeAraciIzlemeTablosu;
  sahipKolon: "kullanici_id" | "bm_id" | "kisi_id" | "musteri_id";
  sahipId: string;
}

export async function ogrenmeAraciIzlemeSahibiniCoz(
  db: SupabaseClient,
  kullaniciId: string,
  rol: string,
): Promise<OgrenmeAraciIzlemeSahibi | null> {
  if (TUKETICI_ROLLER.includes(rol)) {
    return { tablo: "izleme_kayitlari", sahipKolon: "kullanici_id", sahipId: kullaniciId };
  }
  if (rol === "bm") {
    return { tablo: "cc_izleme_kayitlari", sahipKolon: "bm_id", sahipId: kullaniciId };
  }

  const { data: kisi } = await db
    .from("eclub_kisiler")
    .select("kisi_id")
    .eq("auth_user_id", kullaniciId)
    .maybeSingle();
  if (kisi) {
    return { tablo: "eclub_izleme_kayitlari", sahipKolon: "kisi_id", sahipId: kisi.kisi_id };
  }

  const musteri = await musteriKimligi(db, kullaniciId);
  if (!musteri.ok || !musteri.musteriId) return null;
  return {
    tablo: "eczanem_izleme_kayitlari",
    sahipKolon: "musteri_id",
    sahipId: musteri.musteriId,
  };
}
