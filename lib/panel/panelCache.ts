// lib/panel/panelCache.ts
//
// Panel kabuğu ve sol menü için kullanıcıya ve oturuma özel (session-isolated) hızlı önbellek.
// Mahremiyet Güvencesi:
// 1. Anonim veya kimliği çözülmemiş durumlarda asla önbellek okunmaz (userId zorunludur).
// 2. Her kullanıcının verisi ayrı bir sessionStorage anahtarında saklanır (hb_panel_cache_${userId}).
// 3. Farklı kullanıcı aynı tarayıcıda oturum açtığında diğerinin kişisel verilerini, puanlarını
//    veya menü bayraklarını asla göremez.
// 4. Hard refresh (F5) yapıldığında sessionStorage korunduğu için aynı kullanıcının sekmeleri
//    sıfır gecikmeyle (0 ms) yüklenir.

import type { AuthKullanici } from "@/types/auth";

export interface PanelFlags {
  storeAcik: boolean;
  ccAcik: boolean;
  eclubAcik: boolean;
  eclubStoreAcik: boolean;
  eczanemAcik: boolean;
  firmaLogoUrl?: string | null;
  ogrenmePlatformuAktif?: boolean;
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
  userId: string;
  flags: PanelFlags;
  ozet: PanelNavbarOzet | null;
  eclubStorePuani: number | null;
  eclubFirmalar: PanelFirmaOge[];
  kayitZamani: number;
}

const CACHE_PREFIX = "hb_panel_cache_";
const AUTH_CACHE_KEY = "hb_auth_identity_cache";
const AUTH_CACHE_SURESI = 12 * 60 * 60 * 1000;

export const VARSAYILAN_FLAGS: PanelFlags = {
  storeAcik: false,
  ccAcik: false,
  eclubAcik: false,
  eclubStoreAcik: false,
  eczanemAcik: false,
  firmaLogoUrl: null,
  ogrenmePlatformuAktif: false,
};

/** Son doğrulanmış kimliği yalnız mevcut sekme oturumunda tutar. */
export function getAuthKullaniciCache(): AuthKullanici | null {
  if (typeof window === "undefined") return null;
  try {
    const ham = sessionStorage.getItem(AUTH_CACHE_KEY);
    if (!ham) return null;
    const kayit = JSON.parse(ham) as { kullanici?: AuthKullanici; kayitZamani?: number };
    if (!kayit.kullanici?.id || typeof kayit.kayitZamani !== "number" || Date.now() - kayit.kayitZamani >= AUTH_CACHE_SURESI) {
      sessionStorage.removeItem(AUTH_CACHE_KEY);
      return null;
    }
    return kayit.kullanici;
  } catch {
    return null;
  }
}

export function setAuthKullaniciCache(kullanici: AuthKullanici): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({ kullanici, kayitZamani: Date.now() }));
  } catch {
    // Tarayıcı depolaması kapalıysa doğrulanmış normal akış kullanılır.
  }
}

export function clearAuthKullaniciCache(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(AUTH_CACHE_KEY);
  } catch {}
}

/** Yalnızca kimliği doğrulanmış belirli bir kullanıcı için önbellek verisini döner. */
export function getPanelCache(userId?: string | null): PanelCacheData | null {
  if (typeof window === "undefined" || !userId || typeof userId !== "string") return null;
  try {
    const raw = sessionStorage.getItem(`${CACHE_PREFIX}${userId}`);
    if (!raw) return null;
    const data: PanelCacheData = JSON.parse(raw);
    if (!data || typeof data !== "object" || data.userId !== userId || !data.flags) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/** Yeni profil verisini kullanıcı ID'sine özel sessionStorage anahtarına yazar. */
export function setPanelCache(userId: string | undefined | null, data: Omit<PanelCacheData, "userId" | "kayitZamani">): void {
  if (typeof window === "undefined" || !userId || typeof userId !== "string") return null as unknown as void;
  try {
    const payload: PanelCacheData = {
      userId,
      ...data,
      kayitZamani: Date.now(),
    };
    sessionStorage.setItem(`${CACHE_PREFIX}${userId}`, JSON.stringify(payload));
  } catch {
    // Depolama kota kısıtlamasında sessizce yutulur
  }
}

/** Oturum çıkışında geçerli veya eski tüm panel önbellek anahtarlarını temizler. */
export function clearPanelCache(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(AUTH_CACHE_KEY);
    // sessionStorage'daki hb_panel_cache_ ile başlayan tüm anahtarları temizle
    const silinecekSession: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (key.startsWith(CACHE_PREFIX) || key.startsWith("hb_panel_profil_cache") || key.startsWith("hb_rapor_cache_"))) {
        silinecekSession.push(key);
      }
    }
    silinecekSession.forEach((k) => sessionStorage.removeItem(k));

    // Eski localStorage kalıntıları varsa temizle
    const silinecekLocal: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith(CACHE_PREFIX) || key.startsWith("hb_panel_profil_cache"))) {
        silinecekLocal.push(key);
      }
    }
    silinecekLocal.forEach((k) => localStorage.removeItem(k));
  } catch {}
}
