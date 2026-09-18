// lib/panel/panelCache.ts
//
// Panel layout ve sol gezinme (SolListe) için hızlı önbellek (cache-first).
// Hard refresh ve sayfa geçişlerinde /profil/api çağrısı tamamlanana kadar
// menü gruplarının (T-Club, E-Club, C-Club, Eczanem) gecikmeli belirmesini ve
// yerleşim kaymasını (layout shift) önler.

export interface PanelFlags {
  storeAcik: boolean;
  ccAcik: boolean;
  eclubAcik: boolean;
  eclubStoreAcik: boolean;
  eczanemAcik: boolean;
}

export interface PanelNavbarOzet {
  haftalikPuan: number;
  takimSirasi: number | null;
  siparisPuani: number;
}

export interface PanelFirmaOge {
  firma_id: string;
  firma_adi: string;
}

export interface PanelCacheData {
  userId?: string;
  flags: PanelFlags;
  ozet: PanelNavbarOzet | null;
  eclubStorePuani: number | null;
  eclubFirmalar: PanelFirmaOge[];
  kayitZamani: number;
}

const CACHE_KEY = "hb_panel_profil_cache_v1";

export const VARSAYILAN_FLAGS: PanelFlags = {
  storeAcik: false,
  ccAcik: false,
  eclubAcik: false,
  eclubStoreAcik: false,
  eczanemAcik: false,
};

/** Tarayıcı depolamasındaki önbellek verisini döner. */
export function getPanelCache(userId?: string): PanelCacheData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data: PanelCacheData = JSON.parse(raw);
    if (!data || typeof data !== "object" || !data.flags) return null;
    // Eğer belirli bir kullanıcı kontrol ediliyorsa ve uyuşmuyorsa null dön
    if (userId && data.userId && data.userId !== userId) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/** Yeni profil verisini tarayıcı önbelleğine kaydeder. */
export function setPanelCache(data: Omit<PanelCacheData, "kayitZamani">): void {
  if (typeof window === "undefined") return;
  try {
    const payload: PanelCacheData = {
      ...data,
      kayitZamani: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Tarayıcı depolama kotalarında sessizce yutulur
  }
}

/** Oturum çıkışında veya geçersiz durumda önbelleği temizler. */
export function clearPanelCache(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {}
}
