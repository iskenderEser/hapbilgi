// app/providers/AuthProvider.tsx
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { AuthKullanici } from "@/types/auth";

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

  useEffect(() => {
    const supabase = createClient();

    const kullaniciyiYukle = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setKullanici(null);
        setYukleniyor(false);
        return;
      }

      const { data, error } = await supabase
        .from("kullanicilar")
        .select("rol, ad, soyad")
        .eq("kullanici_id", user.id)
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
      });

      setYukleniyor(false);
    };

    kullaniciyiYukle();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setKullanici(null);
        router.push("/login");
      } else if (event === "SIGNED_IN") {
        kullaniciyiYukle();
      }
    });

    return () => subscription.unsubscribe();
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