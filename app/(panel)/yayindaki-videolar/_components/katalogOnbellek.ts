// app/(panel)/yayindaki-videolar/_components/katalogOnbellek.ts
//
// Yayın kataloğu (Sizin Yayınlarınız & Tüm Yayınlar) için Stale-While-Revalidate önbelleği.
// Sayfaya girildiğinde içeriğin ilk kareden (0.00 sn) hazır çizilmesini sağlar;
// arka planda sessizce taze veriyi çekip senkronize eder.

import type { YayindakiVideo } from "@/lib/video/yayindakiVideolar";

const bellekKatalog: Record<string, YayindakiVideo[]> = {};
const CACHE_PREFIX = "hb_katalog_cache_";
const onbellekAnahtari = (kapsam: string, kullaniciId: string) => `${kullaniciId}_${kapsam}`;

export function getKatalogOnbellek(kapsam: string, kullaniciId?: string): YayindakiVideo[] | null {
  if (!kullaniciId) return null;
  const anahtar = onbellekAnahtari(kapsam, kullaniciId);
  if (bellekKatalog[anahtar]) return bellekKatalog[anahtar];
  if (typeof window !== "undefined") {
    try {
      const s = sessionStorage.getItem(`${CACHE_PREFIX}${anahtar}`);
      if (s) {
        const parsed = JSON.parse(s) as YayindakiVideo[];
        bellekKatalog[anahtar] = parsed;
        return parsed;
      }
    } catch {
      // sessizce geç
    }
  }
  return null;
}

export function setKatalogOnbellek(kapsam: string, kullaniciId: string, videolar: YayindakiVideo[]) {
  const anahtar = onbellekAnahtari(kapsam, kullaniciId);
  bellekKatalog[anahtar] = videolar;
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(`${CACHE_PREFIX}${anahtar}`, JSON.stringify(videolar));
    } catch {
      // sessizce geç
    }
  }
}

export async function prefetchYayinKatalog(kapsam: "benim" | "digerleri", kullaniciId: string): Promise<YayindakiVideo[] | null> {
  try {
    const res = await fetch(`/yayindaki-videolar/api?kapsam=${kapsam}`);
    if (!res.ok) return null;
    const data = await res.json();
    const videolar = (data.videolar ?? []) as YayindakiVideo[];
    setKatalogOnbellek(kapsam, kullaniciId, videolar);
    return videolar;
  } catch {
    // sessizce geç
  }
  return null;
}
