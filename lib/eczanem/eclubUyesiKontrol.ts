// Eczanem müşterisi ile E-Club kimlik düzleminin birbirine karışmasını engeller.
// Kural globaldir: E-Club üyesi hangi eczaneye bağlı olursa olsun Eczanem
// müşterisi olarak kaydedilemez veya başka bir eczaneye müşteri diye bağlanamaz.

import type { SupabaseClient } from "@supabase/supabase-js";

export const ECLUB_UYESI_MUSTERI_OLAMAZ_MESAJI =
  "HapBilgi'de E-Club üyesi olduğunuz için müşteri olarak kayıt olmazsınız";
export const ECZANEM_MUSTERISI_ECLUB_UYESI_OLAMAZ_MESAJI =
  "Bu kişi HapBilgi'de Eczanem müşterisi olduğu için E-Club üyesi olarak kaydedilemez.";

/** Eczanem'in 10 haneli kanonik telefonunu sistemdeki tarihsel yazımlara açar. */
export function eclubTelefonVaryantlari(telefon: string): string[] {
  return [telefon, `0${telefon}`, `90${telefon}`, `+90${telefon}`];
}

export async function eclubUyesiTelefonMu(
  adminSupabase: SupabaseClient,
  telefon: string,
): Promise<{ ok: boolean; uyeMi: boolean; hata?: unknown }> {
  const { data, error } = await adminSupabase
    .from("eclub_kisiler")
    .select("kisi_id")
    .in("telefon", eclubTelefonVaryantlari(telefon))
    .limit(1);

  if (error) return { ok: false, uyeMi: false, hata: error };
  return { ok: true, uyeMi: (data?.length ?? 0) > 0 };
}

/** E-Club tarafındaki herhangi bir telefon yazımını Eczanem kanoniğiyle arar. */
export async function eczanemMusterisiTelefonMu(
  adminSupabase: SupabaseClient,
  telefon: string,
): Promise<{ ok: boolean; musteriMi: boolean; hata?: unknown }> {
  const sonuc = await eczanemMusterisiBul(adminSupabase, telefon);
  return { ok: sonuc.ok, musteriMi: !!sonuc.musteri, hata: sonuc.hata };
}

/** Kontrollü Eczanem → E-Club geçişi için müşteri kimliğini döndürür. */
export async function eczanemMusterisiBul(
  adminSupabase: SupabaseClient,
  telefon: string,
): Promise<{
  ok: boolean;
  musteri?: { musteri_id: string; auth_user_id: string | null; aktif_mi: boolean } | null;
  hata?: unknown;
}> {
  const rakamlar = telefon.replace(/\D/g, "");
  const kanonik = rakamlar.startsWith("90") && rakamlar.length === 12
    ? rakamlar.slice(2)
    : rakamlar.startsWith("0") && rakamlar.length === 11
      ? rakamlar.slice(1)
      : rakamlar;
  if (!/^5\d{9}$/.test(kanonik)) return { ok: true, musteri: null };

  const { data, error } = await adminSupabase
    .from("eczanem_musteriler")
    .select("musteri_id, auth_user_id, aktif_mi")
    .eq("telefon", kanonik)
    .maybeSingle();
  if (error) return { ok: false, musteri: null, hata: error };
  return { ok: true, musteri: data ?? null };
}
