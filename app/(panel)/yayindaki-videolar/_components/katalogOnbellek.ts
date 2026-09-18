// app/(panel)/yayindaki-videolar/_components/katalogOnbellek.ts
//
// Yayın kataloğu (Sizin Yayınlarınız & Tüm Yayınlar) için Stale-While-Revalidate önbelleği.
// Sayfaya girildiğinde içeriğin ilk kareden (0.00 sn) hazır çizilmesini sağlar;
// arka planda sessizce taze veriyi çekip senkronize eder.

import type { YayindakiVideo } from "@/lib/video/yayindakiVideolar";

const bellekKatalog: Record<string, YayindakiVideo[]> = {};
const CACHE_PREFIX = "hb_katalog_cache_";

export function getKatalogOnbellek(kapsam: string): YayindakiVideo[] | null {
  if (bellekKatalog[kapsam]) return bellekKatalog[kapsam];
  if (typeof window !== "undefined") {
    try {
      const s = sessionStorage.getItem(`${CACHE_PREFIX}${kapsam}`);
      if (s) {
        const parsed = JSON.parse(s) as YayindakiVideo[];
        bellekKatalog[kapsam] = parsed;
        return parsed;
      }
    } catch {
      // sessizce geç
    }
  }
  return null;
}

export function setKatalogOnbellek(kapsam: string, videolar: YayindakiVideo[]) {
  bellekKatalog[kapsam] = videolar;
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(`${CACHE_PREFIX}${kapsam}`, JSON.stringify(videolar));
    } catch {
      // sessizce geç
    }
  }
}

export async function prefetchYayinKatalog(kapsam: "benim" | "digerleri" = "benim"): Promise<YayindakiVideo[] | null> {
  try {
    const res = await fetch(`/yayindaki-videolar/api?kapsam=${kapsam}`);
    if (!res.ok) return null;
    const data = await res.json();
    const videolar = (data.videolar ?? []) as YayindakiVideo[];
    setKatalogOnbellek(kapsam, videolar);
    return videolar;
  } catch {
    // sessizce geç
  }
  return null;
}
