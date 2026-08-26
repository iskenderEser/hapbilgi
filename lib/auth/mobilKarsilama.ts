// Yalnız bir arayüz tercihi: rol ve erişim yetkisi bu kayıttan belirlenmez.
// Hesapta saklanır; tarayıcı/telefon değişikliği karşılamayı tekrarlatmaz.
const KARSILAMA_ANAHTARI = "hb_mobil_karsilama_tamamlandi";

type NormalGirisYolu = "/ana-sayfa" | "/admin";
type GirisYolu = NormalGirisYolu | "/hapbilgi-nedir";

interface KarsilamaAuth {
  getUser(): Promise<{
    data: { user: { id: string; user_metadata: Record<string, unknown> } | null };
    error: unknown;
  }>;
  updateUser(attributes: { data: Record<string, boolean> }): Promise<{ error: unknown }>;
}

async function ilkMobilGirisYolu(auth: KarsilamaAuth, kullaniciId: string): Promise<GirisYolu> {
  try {
    const { data, error } = await auth.getUser();
    // Kimlik değişmişse eski hesap adına tercih yazılmaz.
    if (error || !data.user || data.user.id !== kullaniciId) return "/ana-sayfa";
    if (data.user.user_metadata[KARSILAMA_ANAHTARI] === true) return "/ana-sayfa";

    const { error: kayitHatasi } = await auth.updateUser({
      data: { [KARSILAMA_ANAHTARI]: true },
    });
    // Tercih servisi aksadığında giriş engellenmez; sonraki girişte yeniden denenir.
    return kayitHatasi ? "/ana-sayfa" : "/hapbilgi-nedir";
  } catch {
    return "/ana-sayfa";
  }
}

export function mobilKarsilamaYonlendiricisiOlustur() {
  // Her login sayfası kendi kararını tutar. Strict Mode / yinelenen auth
  // bildirimleri ikinci bir karar üretip tanıtımı Ana Sayfa ile ezemez.
  const kararlar = new Map<string, Promise<GirisYolu>>();

  return (
    auth: KarsilamaAuth,
    kullaniciId: string,
    mobilMi: boolean,
    normalYol: NormalGirisYolu,
  ): Promise<GirisYolu> => {
    if (!mobilMi || normalYol !== "/ana-sayfa") return Promise.resolve(normalYol);

    let karar = kararlar.get(kullaniciId);
    if (!karar) {
      karar = ilkMobilGirisYolu(auth, kullaniciId);
      kararlar.set(kullaniciId, karar);
    }
    return karar;
  };
}
