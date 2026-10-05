import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { eclubYonetimKapsaminiGetir } from "@/lib/eclub/yonetimKapsami";
import { YONLENDIRICI_ROLLER } from "@/lib/utils/roller";
import type { CekTakipKapsami, CekTakipRolu } from "./cekTakipErisim";

export interface BmTakipUtt {
  utt_id: string;
  utt_adi: string;
  kapsam: CekTakipKapsami;
}

export type BmTakipKapsamSonucu =
  | { ok: true; rol: "bm" | "tm"; uttler: BmTakipUtt[] }
  | { ok: false; mesaj: string; detay?: unknown };

// Ortak liste okumaları "yonetim" kullanır. BM yazma uçlarının varsayılanı
// yalnız BM olarak kalır; TM son onayı açıkça "tm" ister.
export async function bmTakipKapsaminiCoz(admin: SupabaseClient, authUserId: string, beklenenRol: "bm" | "tm" | "yonetim" = "bm"): Promise<BmTakipKapsamSonucu> {
  const { data: kullanici, error } = await admin.from("kullanicilar")
    .select("kullanici_id, ad, soyad, rol, firma_id, takim_id, bolge_id, aktif_mi")
    .eq("kullanici_id", authUserId).maybeSingle();
  if (error) return { ok: false, mesaj: "Hediye Takibi kullanıcı kapsamı doğrulanamadı.", detay: error };
  const rol = (kullanici?.rol ?? "").toLowerCase();
  if (!kullanici || kullanici.aktif_mi !== true || !YONLENDIRICI_ROLLER.includes(rol) || (beklenenRol !== "yonetim" && rol !== beklenenRol)) {
    return { ok: false, mesaj: "Hediye Takibi için aktif ve yetkili yönetici rolü gerekli." };
  }
  if (!kullanici.firma_id) return { ok: false, mesaj: "Firma bağlantısı bulunamadı." };

  const { data: firma, error: firmaHatasi } = await admin.from("firmalar")
    .select("aktif, eclub_aktif, eclub_store_aktif").eq("firma_id", kullanici.firma_id).maybeSingle();
  if (firmaHatasi) return { ok: false, mesaj: "Firma kapsamı doğrulanamadı.", detay: firmaHatasi };
  if (!firma?.aktif || !firma.eclub_aktif || !firma.eclub_store_aktif) {
    return { ok: false, mesaj: "E-Club Hediye Çeki firma için aktif değildir." };
  }

  const kapsam = await eclubYonetimKapsaminiGetir(admin, kullanici);
  return {
    ok: true,
    rol: rol as "bm" | "tm",
    uttler: kapsam.uttler.map((utt) => ({
      utt_id: utt.utt_id,
      utt_adi: utt.utt_adi,
      kapsam: {
        kullanici_id: utt.utt_id,
        utt_id: utt.utt_id,
        firma_id: kullanici.firma_id,
        rol: utt.rol as CekTakipRolu,
      },
    })),
  };
}

export function bmTakipListeKapsamlari(uttler: BmTakipUtt[], istenenUttId: string | null) {
  if (!istenenUttId) return { ok: true as const, uttler };
  const secili = uttler.find((utt) => utt.utt_id === istenenUttId);
  return secili
    ? { ok: true as const, uttler: [secili] }
    : { ok: false as const, mesaj: "Seçilen UTT, yönetim kapsamında değildir." };
}
