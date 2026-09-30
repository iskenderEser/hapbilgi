import "server-only";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { ODUL_SIPARIS_ROLLERI } from "@/lib/utils/roller";
import { rolHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";

export async function odulSiparisOturumu(cekModuluZorunlu = true) {
  const session = await createClient();
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) return { yanit: yetkiHatasi() };
  const db = createAdminClient();
  const { data: kisi, error: kisiHatasi } = await db.from("kullanicilar")
    .select("kullanici_id, ad, soyad, rol, firma_id, takim_id, bolge_id, aktif_mi")
    .eq("kullanici_id", user.id).maybeSingle();
  if (kisiHatasi) throw new Error(kisiHatasi.message);
  if (!kisi?.aktif_mi || !kisi.firma_id || !ODUL_SIPARIS_ROLLERI.includes(kisi.rol ?? "")) {
    return { yanit: rolHatasi("Bu alan yalnız aktif UTT, BM ve TM hesaplarına açıktır.") };
  }
  const { data: firma, error: firmaHatasi } = await db.from("firmalar")
    .select("eclub_aktif, eclub_store_aktif").eq("firma_id", kisi.firma_id).maybeSingle();
  if (firmaHatasi) throw new Error(firmaHatasi.message);
  if (!firma?.eclub_aktif) return { yanit: rolHatasi("E-Club modülü kapalıdır.") };
  if (cekModuluZorunlu && !firma.eclub_store_aktif) return { yanit: rolHatasi("E-Club çek modülü kapalıdır.") };
  return { db, kisi };
}
