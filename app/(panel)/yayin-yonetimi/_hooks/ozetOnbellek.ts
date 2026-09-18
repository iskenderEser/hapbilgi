// app/(panel)/yayin-yonetimi/_hooks/ozetOnbellek.ts
//
// Yayın Yönetimi stat kartları ve hedef sekme sayaçları için Stale-While-Revalidate önbelleği.
// Sayfa ilk açıldığında sayıların "0"dan sonradan gelip zıplamasını engeller,
// önceki oturumdaki/arkaplandaki son gerçek değerle ilk kareden çizilmesini sağlar.

export interface OzetVerisi {
  sayilar: Record<string, number>;
  hedefler: Record<string, { canli: number; planli: number; durdurulan: number; bekleyen: number }>;
  bekleyen: number;
  yayinda: number;
  canli: number;
  planli: number;
  durdurulan: number;
}

let bellekOzet: OzetVerisi | null = null;
const CACHE_KEY = "hb_yy_ozet_cache";

export function getOzetOnbellek(): OzetVerisi | null {
  if (bellekOzet) return bellekOzet;
  if (typeof window !== "undefined") {
    try {
      const s = sessionStorage.getItem(CACHE_KEY);
      if (s) {
        bellekOzet = JSON.parse(s);
        return bellekOzet;
      }
    } catch {
      // sessizce geç
    }
  }
  return null;
}

export function setOzetOnbellek(veri: OzetVerisi) {
  bellekOzet = veri;
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(veri));
    } catch {
      // sessizce geç
    }
  }
}

/**
 * Ana Sayfa veya arka planda sessizce çağrılarak Yayın Yönetimi açılmadan
 * veriyi hazırlar, böylece sayfaya girildiğinde sayılar 0'dan değil
 * ilk kareden gerçek değeriyle çizilir.
 */
export async function prefetchYayinOzet(): Promise<OzetVerisi | null> {
  try {
    const res = await fetch("/yayin-yonetimi/api/ozet");
    if (!res.ok) return null;
    const d = (await res.json()) as OzetVerisi;
    if (d && d.sayilar) {
      setOzetOnbellek(d);
      return d;
    }
  } catch {
    // sessizce geç
  }
  return null;
}
