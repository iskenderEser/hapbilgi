// app/(panel)/talepler/_hooks/talepOnbellek.ts
//
// Talep Merkezi (Yayın Oluşturma ve Takip) için Stale-While-Revalidate önbelleği.
// Sayfaya girildiğinde operasyon özeti ve iş listesinin ilk kareden (0.00 sn)
// çizilmesini sağlar; arka planda sessizce taze veriyi çekip günceller.

import type { TalepSatiri } from "../_ureticiRolTypes";

let bellekTalepler: TalepSatiri[] | null = null;
const CACHE_KEY = "hb_talep_merkezi_cache";

export function getTalepOnbellek(): TalepSatiri[] | null {
  if (bellekTalepler) return bellekTalepler;
  if (typeof window !== "undefined") {
    try {
      const s = sessionStorage.getItem(CACHE_KEY);
      if (s) {
        bellekTalepler = JSON.parse(s) as TalepSatiri[];
        return bellekTalepler;
      }
    } catch {
      // sessizce geç
    }
  }
  return null;
}

export function setTalepOnbellek(talepler: TalepSatiri[]) {
  bellekTalepler = talepler;
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(talepler));
    } catch {
      // sessizce geç
    }
  }
}

export async function prefetchTalepMerkezi(): Promise<TalepSatiri[] | null> {
  try {
    const res = await fetch("/talepler/api/uretici-rol");
    if (!res.ok) return null;
    const data = await res.json();
    const talepler = (data.talepler ?? []) as TalepSatiri[];
    setTalepOnbellek(talepler);
    return talepler;
  } catch {
    // sessizce geç
  }
  return null;
}
