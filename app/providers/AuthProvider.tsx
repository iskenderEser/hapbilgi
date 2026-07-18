// app/providers/AuthProvider.tsx
//
// Uygulama genelinde auth state'i yöneten provider.
//
// Lock yarışı koruması (single-flight):
// Supabase auth-token Web Lock'ını "steal" opsiyonuyla alıyor. Aynı anda iki
// kullaniciyiYukle() çalışırsa ikincisi birincinin lock'ını çalar, birincisi
// AbortError ile düşer. Single-flight pattern: aynı anda yalnızca bir
// kullaniciyiYukle() çalışır, ikinci çağrı geldiğinde mevcut Promise döner.

"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { AuthKullanici, KimlikTuru } from "@/types/auth";
import { oturumDusurulmeliMi, beniHatirlaTemizle } from "@/lib/utils/beniHatirla";

interface AuthContextTipi {
  kullanici: AuthKullanici | null;
  yukleniyor: boolean;
  cikisYap: () => Promise<void>;
}

const AuthContext = createContext<AuthContextTipi>({
  kullanici: null,
  yukleniyor: true,
  cikisYap: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [kullanici, setKullanici] = useState<AuthKullanici | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  // Single-flight: devam eden bir yükleme varsa Promise'i sakla.
  // İkinci çağrı geldiğinde yeni getUser yapmaz, mevcut Promise'i bekler.
  const yuklemePromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const kullaniciyiYukle = async (): Promise<void> => {
      // Eğer zaten bir yükleme devam ediyorsa o Promise'i döndür.
      // Yeni bir auth.getUser() çağrısı YAPILMAZ — lock yarışı imkansız.
      if (yuklemePromiseRef.current) {
        return yuklemePromiseRef.current;
      }

      const promise = (async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();

          if (!user) {
            setKullanici(null);
            setYukleniyor(false);
            return;
          }

          // F-03/B: "Beni hatırla" işaretsiz girilmişti ve tarayıcı kapatılıp
          // açılmış (oturum işaret çerezi ölmüş) — oturum düşürülür.
          if (oturumDusurulmeliMi()) {
            beniHatirlaTemizle();
            await supabase.auth.signOut();
            setKullanici(null);
            setYukleniyor(false);
            return;
          }

          // Birleşik kimlik view'ı: kullanicilar + eclub_kisiler'i auth_id üzerinden
          // birleştirir. Tek sorgu; kimlik_turu ile kim olduğu ayrılır.
          const { data, error } = await supabase
            .from("v_auth_kimlik")
            .select("kimlik_turu, rol, ad, soyad, firma_id, telefon")
            .eq("auth_id", user.id)
            .single();

          if (error || !data) {
            setKullanici(null);
            setYukleniyor(false);
            return;
          }

          setKullanici({
            id: user.id,
            email: user.email ?? "",
            rol: data.rol,
            ad: data.ad,
            soyad: data.soyad,
            adSoyad: `${data.ad} ${data.soyad}`.trim(),
            firma_id: data.firma_id ?? null,
            kimlik_turu: data.kimlik_turu as KimlikTuru,
            telefon: data.telefon ?? null,
          });

          setYukleniyor(false);
        } catch (err: any) {
          // AbortError gibi bir yarış geçişi (savunma katmanı) gelirse sessizce geç,
          // single-flight zaten bunu engelliyor ama yine de güvenlik için.
          if (err?.name === "AbortError") return;
          console.error("[AuthProvider] kullaniciyiYukle hatası:", err);
          setKullanici(null);
          setYukleniyor(false);
        }
      })();

      yuklemePromiseRef.current = promise;
      try {
        await promise;
      } finally {
        yuklemePromiseRef.current = null;
      }
    };

    kullaniciyiYukle();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setKullanici(null);
        // Eczanem müşterisi kendi giriş ekranına döner; diğer kimlikler /login'e.
        const yol = typeof window !== "undefined" ? window.location.pathname : "";
        router.push(yol.startsWith("/eczanem") && !yol.startsWith("/eczanem/eczane") ? "/eczanem/giris" : "/login");
      } else if (event === "SIGNED_IN") {
        // Token yenilemesi de SIGNED_IN'i tetikler. Single-flight devam eden
        // yükleme varsa onu bekler, ayrı bir getUser çağrısı yapmaz.
        kullaniciyiYukle();
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cikisYap = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ kullanici, yukleniyor, cikisYap }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}