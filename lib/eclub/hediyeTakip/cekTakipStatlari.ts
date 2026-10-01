import type { SupabaseClient } from "@supabase/supabase-js";
import type { CekTakipStatlari } from "@/lib/eclub/hediyeTakip/cekTakip";
import {
  cekTakipTalepKapsami,
  type CekTakipKapsami,
} from "@/lib/eclub/hediyeTakip/cekTakipErisim";
import type { CekTalepDurumu } from "@/lib/eclub/store/eclubStoreTipler";

export const CEK_TAKIP_ONAY_SURECI_TALEP_DURUMLARI: readonly CekTalepDurumu[] = [
  "beklemede",
  "bm_onayinda",
  "tm_onayinda",
];

export const CEK_TAKIP_TESLIMAT_SURECI_TALEP_DURUMLARI: readonly CekTalepDurumu[] = [
  "onaylandi",
  "teslimat_bekliyor",
];

export const CEK_TAKIP_TAMAMLANAN_TALEP_DURUMLARI: readonly CekTalepDurumu[] = [
  "cek_kodlari_gonderildi",
];

type CekTakipStatGrubu = Exclude<keyof CekTakipStatlari, "toplam">;

export function cekTakipStatGrubu(durum: CekTalepDurumu): CekTakipStatGrubu | null {
  if (CEK_TAKIP_ONAY_SURECI_TALEP_DURUMLARI.includes(durum)) return "onay_surecinde";
  if (CEK_TAKIP_TESLIMAT_SURECI_TALEP_DURUMLARI.includes(durum)) return "teslimat_surecinde";
  if (CEK_TAKIP_TAMAMLANAN_TALEP_DURUMLARI.includes(durum)) return "tamamlanan";
  return null;
}

async function kapsamliTalepSayisi(
  adminSupabase: SupabaseClient,
  kapsam: CekTakipKapsami,
  durumlar?: readonly CekTalepDurumu[],
): Promise<number> {
  let sorgu = adminSupabase
    .from("eclub_store_cek_talepleri")
    .select("talep_id", { count: "exact", head: true })
    .match(cekTakipTalepKapsami(kapsam));

  if (durumlar) sorgu = sorgu.in("durum", [...durumlar]);

  const { count, error } = await sorgu;
  if (error) throw new Error(`Çek Takip statları alınamadı: ${error.message}`);
  return count ?? 0;
}

/**
 * İptal kayıtları "Toplam Talep" içinde geçmiş kaydı olarak korunur; süreç
 * statlarına girmez. Diğer durumlar birbirini dışlayan üç grupta sayılır.
 */
export async function cekTakipStatlariniGetir(
  adminSupabase: SupabaseClient,
  kapsam: CekTakipKapsami,
): Promise<CekTakipStatlari> {
  const [toplam, onay_surecinde, teslimat_surecinde, tamamlanan] = await Promise.all([
    kapsamliTalepSayisi(adminSupabase, kapsam),
    kapsamliTalepSayisi(adminSupabase, kapsam, CEK_TAKIP_ONAY_SURECI_TALEP_DURUMLARI),
    kapsamliTalepSayisi(adminSupabase, kapsam, CEK_TAKIP_TESLIMAT_SURECI_TALEP_DURUMLARI),
    kapsamliTalepSayisi(adminSupabase, kapsam, CEK_TAKIP_TAMAMLANAN_TALEP_DURUMLARI),
  ]);

  return { toplam, onay_surecinde, teslimat_surecinde, tamamlanan };
}
