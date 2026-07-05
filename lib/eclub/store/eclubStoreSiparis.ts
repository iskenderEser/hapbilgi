import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  EclubStoreSiparisOlusturParams,
  EclubStoreSiparisOlusturSonuc,
  EclubStoreSiparisIptalParams,
  EclubStoreKayitSonuc,
} from "./eclubStoreTipler";

export async function eclubStoreSiparisOlustur(
  supabase: SupabaseClient,
  params: EclubStoreSiparisOlusturParams
): Promise<EclubStoreSiparisOlusturSonuc> {
  const { data, error } = await supabase.rpc("eclub_store_siparis_olustur", {
    p_kisi_id: params.kisi_id,
    p_urun_id: params.urun_id,
    p_adres_id: params.adres_id,
    p_adet: params.adet,
  });

  if (error) {
    console.error("[lib/eclub/store/siparis] eclubStoreSiparisOlustur RPC hatası:", error.message);
    return { ok: false, siparis_id: null, hata: error.message };
  }

  const ilk = Array.isArray(data) && data.length > 0 ? data[0] : null;
  if (!ilk) return { ok: false, siparis_id: null, hata: "RPC'den geçerli sonuç alınamadı." };

  return {
    ok: Boolean(ilk.ok),
    siparis_id: ilk.siparis_id ?? null,
    hata: ilk.hata ?? null,
  };
}

export async function eclubStoreSiparisIptal(
  supabase: SupabaseClient,
  params: EclubStoreSiparisIptalParams
): Promise<EclubStoreKayitSonuc> {
  const { data, error } = await supabase.rpc("eclub_store_siparis_iptal", {
    p_siparis_id: params.siparis_id,
    p_iptal_eden_kisi_id: params.iptal_eden_kisi_id,
    p_is_admin: params.is_admin,
    p_sebep: params.sebep ?? null,
  });

  if (error) {
    console.error("[lib/eclub/store/siparis] eclubStoreSiparisIptal RPC hatası:", error.message);
    return { ok: false, error: error.message };
  }

  const ilk = Array.isArray(data) && data.length > 0 ? data[0] : null;
  if (!ilk) return { ok: false, error: "RPC'den geçerli sonuç alınamadı." };

  return { ok: Boolean(ilk.ok), error: ilk.hata ?? undefined };
}

export async function eclubStoreTeslimAldim(
  supabase: SupabaseClient,
  siparisId: string,
  kisiId: string
): Promise<EclubStoreKayitSonuc> {
  const { data, error } = await supabase.rpc("eclub_store_teslim_aldim", {
    p_siparis_id: siparisId,
    p_kisi_id: kisiId,
  });

  if (error) {
    console.error("[lib/eclub/store/siparis] eclubStoreTeslimAldim RPC hatası:", error.message);
    return { ok: false, error: error.message };
  }

  const ilk = Array.isArray(data) && data.length > 0 ? data[0] : null;
  if (!ilk) return { ok: false, error: "RPC'den geçerli sonuç alınamadı." };

  return { ok: Boolean(ilk.ok), error: ilk.hata ?? undefined };
}