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

const bellekPaketleri = new Map<string, TalepOnbellekPaketi>();
const CACHE_PREFIX = "hb_talep_merkezi_cache_";

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

export function getTalepOnbellek(kullaniciId?: string): TalepOnbellekPaketi | null {
  if (!kullaniciId) return null;
  const bellekPaket = bellekPaketleri.get(kullaniciId);
  if (bellekPaket) return bellekPaket;
  if (typeof window !== "undefined") {
    try {
      const s = sessionStorage.getItem(`${CACHE_PREFIX}${kullaniciId}`);
      if (s) {
        const paket = JSON.parse(s) as TalepOnbellekPaketi;
        bellekPaketleri.set(kullaniciId, paket);
        return paket;
      }
    } catch {
      // sessizce geç
    }
  }
  return null;
}

export function setTalepOnbellek(kullaniciId: string, talepler: TalepSatiri[]) {
  const ozet = hesaplaTalepOzeti(talepler);
  const paket: TalepOnbellekPaketi = { talepler, ozet };
  bellekPaketleri.set(kullaniciId, paket);
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(`${CACHE_PREFIX}${kullaniciId}`, JSON.stringify(paket));
    } catch {
      // sessizce geç
    }
  }
}

export async function prefetchTalepMerkezi(kullaniciId: string): Promise<TalepOnbellekPaketi | null> {
  try {
    const res = await fetch("/talepler/api/uretici-rol");
    if (!res.ok) return null;
    const data = await res.json();
    const talepler = (data.talepler ?? []) as TalepSatiri[];
    setTalepOnbellek(kullaniciId, talepler);
    return getTalepOnbellek(kullaniciId);
  } catch {
    // sessizce geç
  }
  return null;
}
