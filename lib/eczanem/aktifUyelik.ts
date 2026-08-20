import type { SupabaseClient } from "@supabase/supabase-js";
import { ECZANEM_KAPALI_MESAJI, eczaneEczanemFirmaIdleri, eczaneYayinErisimiDogrula } from "@/lib/eczanem/erisim";

export interface AktifUyelikSonucu {
  ok: boolean;
  hata?: string;
}

/** Müşterinin belirli eczanedeki üyeliğinin hâlen aktif olduğunu doğrular. */
export async function aktifEczaneUyeliginiDogrula(
  adminSupabase: SupabaseClient,
  musteriId: string,
  eczaneId: string
): Promise<AktifUyelikSonucu> {
  const { data, error } = await adminSupabase
    .from("eczanem_uyelikler")
    .select("uyelik_id")
    .eq("musteri_id", musteriId)
    .eq("eczane_id", eczaneId)
    .eq("aktif_mi", true)
    .maybeSingle();

  if (error) return { ok: false, hata: "Eczane üyeliği doğrulanamadı." };
  if (!data) return { ok: false, hata: "Bu eczanedeki üyeliğiniz aktif değil." };
  const erisim = await eczaneEczanemFirmaIdleri(adminSupabase, eczaneId);
  if (!erisim.ok) return { ok: false, hata: erisim.hata ?? "Eczanem erişimi doğrulanamadı." };
  if (!erisim.acik) return { ok: false, hata: ECZANEM_KAPALI_MESAJI };
  return { ok: true };
}

/** Gönderimin sahibini ve gönderim eczanesindeki güncel üyeliğini doğrular. */
export async function aktifGonderimUyeliginiDogrula(
  adminSupabase: SupabaseClient,
  musteriId: string,
  gonderimId: string
): Promise<AktifUyelikSonucu> {
  const { data: gonderim, error } = await adminSupabase
    .from("eczanem_gonderimler")
    .select("musteri_id, eczane_id, yayin_id")
    .eq("gonderim_id", gonderimId)
    .maybeSingle();

  if (error) return { ok: false, hata: "Gönderim üyeliği doğrulanamadı." };
  if (!gonderim || gonderim.musteri_id !== musteriId) {
    return { ok: false, hata: "Bu gönderime erişim yetkiniz yok." };
  }
  const uyelik = await aktifEczaneUyeliginiDogrula(adminSupabase, musteriId, gonderim.eczane_id);
  if (!uyelik.ok) return uyelik;
  const yayinErisimi = await eczaneYayinErisimiDogrula(adminSupabase, gonderim.eczane_id, gonderim.yayin_id);
  return yayinErisimi.ok ? { ok: true } : { ok: false, hata: yayinErisimi.hata };
}
