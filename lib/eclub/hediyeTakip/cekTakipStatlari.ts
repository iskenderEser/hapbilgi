import type { SupabaseClient } from "@supabase/supabase-js";
import type { CekTakipFiltreleri, CekTakipStatlari } from "@/lib/eclub/hediyeTakip/cekTakip";
import {
  cekTakipTalepKapsami,
  type CekTakipKapsami,
} from "@/lib/eclub/hediyeTakip/cekTakipErisim";
import type { CekTalepDurumu } from "@/lib/eclub/store/eclubStoreTipler";
import { trGunEkle } from "@/lib/zaman/kontrol";

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

interface HamStatTalebi {
  durum: CekTalepDurumu;
  v_yayin_kunye: { urun_id: string | null } | Array<{ urun_id: string | null }> | null;
}

export function cekTakipStatGrubu(durum: CekTalepDurumu): CekTakipStatGrubu | null {
  if (CEK_TAKIP_ONAY_SURECI_TALEP_DURUMLARI.includes(durum)) return "onay_surecinde";
  if (CEK_TAKIP_TESLIMAT_SURECI_TALEP_DURUMLARI.includes(durum)) return "teslimat_surecinde";
  if (CEK_TAKIP_TAMAMLANAN_TALEP_DURUMLARI.includes(durum)) return "tamamlanan";
  return null;
}

export function cekTakipStatlariniHesapla(durumlar: readonly CekTalepDurumu[]): CekTakipStatlari {
  const statlar: CekTakipStatlari = {
    toplam: durumlar.length,
    onay_surecinde: 0,
    teslimat_surecinde: 0,
    tamamlanan: 0,
  };
  for (const durum of durumlar) {
    const grup = cekTakipStatGrubu(durum);
    if (grup) statlar[grup] += 1;
  }
  return statlar;
}

function trGunBaslangici(gun: string): string {
  return new Date(`${gun}T00:00:00+03:00`).toISOString();
}

async function filtreliTalepleriGetir(
  adminSupabase: SupabaseClient,
  kapsam: CekTakipKapsami,
  filtreler: CekTakipFiltreleri,
): Promise<HamStatTalebi[]> {
  let sorgu = adminSupabase
    .from("eclub_store_cek_talepleri")
    .select("durum, v_yayin_kunye ( urun_id )")
    .match(cekTakipTalepKapsami(kapsam));

  if (filtreler.eczane_id) sorgu = sorgu.eq("eczane_id", filtreler.eczane_id);
  if (filtreler.kisi_id) sorgu = sorgu.eq("talep_eden_kisi_id", filtreler.kisi_id);
  if (filtreler.baslangic) sorgu = sorgu.gte("created_at", trGunBaslangici(filtreler.baslangic));
  if (filtreler.bitis) sorgu = sorgu.lt("created_at", trGunBaslangici(trGunEkle(filtreler.bitis, 1)));

  const { data, error } = await sorgu;
  if (error) throw new Error(`Çek Takip statları alınamadı: ${error.message}`);
  const talepler = (data ?? []) as unknown as HamStatTalebi[];
  if (!filtreler.urun_id) return talepler;
  return talepler.filter((talep) => {
    const kunye = Array.isArray(talep.v_yayin_kunye) ? talep.v_yayin_kunye[0] : talep.v_yayin_kunye;
    return kunye?.urun_id === filtreler.urun_id;
  });
}

/**
 * İptal kayıtları "Toplam Talep" içinde geçmiş kaydı olarak korunur; süreç
 * statlarına girmez. Diğer durumlar birbirini dışlayan üç grupta sayılır.
 */
export async function cekTakipStatlariniGetir(
  adminSupabase: SupabaseClient,
  kapsam: CekTakipKapsami,
  filtreler: CekTakipFiltreleri,
): Promise<CekTakipStatlari> {
  const talepler = await filtreliTalepleriGetir(adminSupabase, kapsam, filtreler);
  return cekTakipStatlariniHesapla(talepler.map((talep) => talep.durum));
}
