// lib/utils/beniHatirla.ts
//
// "Beni hatırla" işlevi (F-03/B — İskender tercihi: işlevlendir, 18.07.2026).
// Supabase oturum çerezi her durumda kalıcıdır; "hatırlamama"nın gerçek anlamı
// oturumu TARAYICI OTURUMUYLA sınırlamaktır. Yöntem: kalıcı bayrak (localStorage)
// + tarayıcı kapanınca ölen oturum çerezi (işaret). Uygulama açılışında bayrak
// "hatırlama" diyorsa ve işaret çerezi ölmüşse (tarayıcı kapatılıp açılmış
// demektir) oturum düşürülür (AuthProvider signOut).
//
// Bilinen sınır: tarayıcının "kaldığım yerden devam et" ayarı oturum çerezlerini
// geri getirebilir — o durumda hatırlama davranışı tarayıcıya kalır.
// Tüm fonksiyonlar yalnız tarayıcıda anlamlıdır; sunucuda sessizce no-op.

const BAYRAK_ANAHTARI = "hb_beni_hatirla"; // localStorage: "1" | "0"
const ISARET_CEREZI = "hb_oturum_isareti"; // oturum çerezi (süre verilmez)

export function beniHatirlaKaydet(hatirla: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(BAYRAK_ANAHTARI, hatirla ? "1" : "0");
    if (!hatirla) {
      document.cookie = `${ISARET_CEREZI}=1; path=/; SameSite=Lax`;
    }
  } catch {
    // localStorage kapalı (gizli mod vb.) — hatırlama varsayılanı geçerli kalır.
  }
}

// true → oturum düşürülmeli: "hatırlama" seçilmişti ve tarayıcı yeniden açılmış.
export function oturumDusurulmeliMi(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (localStorage.getItem(BAYRAK_ANAHTARI) !== "0") return false;
    return !document.cookie.split("; ").some((c) => c.startsWith(`${ISARET_CEREZI}=`));
  } catch {
    return false;
  }
}

// Düşürme sonrası bayrak temizlenir — sonraki girişler kendi tercihlerini yazar.
export function beniHatirlaTemizle(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(BAYRAK_ANAHTARI);
  } catch {
    // sessiz geç
  }
}
