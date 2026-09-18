// app/(panel)/talepler/_hooks/talepOnbellek.ts
//
// Talep Merkezi (Yayın Oluşturma ve Takip) için Stale-While-Revalidate önbelleği.
// Sayfaya girildiğinde operasyon özeti (stat kartları) ve iş listesinin
// ilk kareden (0.00 sn) çizilmesini sağlar; rakamların sonradan zıplamasını engeller.

import type { TalepSatiri } from "../_ureticiRolTypes";
import { ureticiDurumMesaji } from "@/lib/utils/durum/mesaj";

export interface TalepOzetSayilari {
  devamEden: number;
  aksiyonBekleyen: number;
  uretimde: number;
  planlanan: number;
}

export interface TalepOnbellekPaketi {
  talepler: TalepSatiri[];
  ozet: TalepOzetSayilari;
}

let bellekPaket: TalepOnbellekPaketi | null = null;
const CACHE_KEY = "hb_talep_merkezi_cache";

export function hesaplaTalepOzeti(talepler: TalepSatiri[]): TalepOzetSayilari {
  const devamEdenler = talepler.filter((t) => !t.uretim_bitti && !t.iptal_edildi);
  const operasyon = devamEdenler.reduce(
    (ozet, talep) => {
      const top = ureticiDurumMesaji(talep.durum_kodu, talep.created_at).top;
      if (top === "uretici") ozet.aksiyonBekleyen += 1;
      if (top === "icerik_ureticisi") ozet.uretimde += 1;
      if (top === "sistem") ozet.planlanan += 1;
      return ozet;
    },
    { aksiyonBekleyen: 0, uretimde: 0, planlanan: 0 },
  );

  return {
    devamEden: devamEdenler.length,
    ...operasyon,
  };
}

export function getTalepOnbellek(): TalepOnbellekPaketi | null {
  if (bellekPaket) return bellekPaket;
  if (typeof window !== "undefined") {
    try {
      const s = sessionStorage.getItem(CACHE_KEY);
      if (s) {
        bellekPaket = JSON.parse(s) as TalepOnbellekPaketi;
        return bellekPaket;
      }
    } catch {
      // sessizce geç
    }
  }
  return null;
}

export function setTalepOnbellek(talepler: TalepSatiri[]) {
  const ozet = hesaplaTalepOzeti(talepler);
  const paket: TalepOnbellekPaketi = { talepler, ozet };
  bellekPaket = paket;
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(paket));
    } catch {
      // sessizce geç
    }
  }
}

export async function prefetchTalepMerkezi(): Promise<TalepOnbellekPaketi | null> {
  try {
    const res = await fetch("/talepler/api/uretici-rol");
    if (!res.ok) return null;
    const data = await res.json();
    const talepler = (data.talepler ?? []) as TalepSatiri[];
    setTalepOnbellek(talepler);
    return bellekPaket;
  } catch {
    // sessizce geç
  }
  return null;
}
