// app/login/page.tsx
//
// Giriş / karşılama sayfası — iki panelli yerleşim (13.07.2026 tasarımı):
// solda koyu zeminde marka anlatısı (başlık + dört modül), sağda sade giriş.
// Tek vurgu rengi bordo (#bc2d0d); giriş akışı mantığı B-06 ile aynıdır
// (kimlik kaynağı useAuth, firma-aktif kontrolü useEffect'te).

"use client";

import { createClient } from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers/AuthProvider";

const BORDO = "#bc2d0d";

// Sol paneldeki modül tanıtımları — adlar/ifadeler İskender onaylı (13.07.2026).
// İkon dili: üç Club kendi baş harfiyle (tek desen), Eczanem kalple ayrışır.
// ("+" bilinçli kullanılmadı — eczacılık bağlamında yanlış anlaşılabilir.)
const MODULLER = [
  {
    ad: "T-Club",
    aciklama: "Temsilcilerin sürekli öğrenme modülü",
    ikon: <span className="text-base font-extrabold">T</span>,
  },
  {
    ad: "C-Club",
    aciklama: "Değişim liderlerinin modülü",
    ikon: <span className="text-base font-extrabold">C</span>,
  },
  {
    ad: "E-Club",
    aciklama: "Eczanelere özel tanıtım modülü",
    ikon: <span className="text-base font-extrabold">E</span>,
  },
  {
    ad: "Eczanem",
    aciklama: "Eczanenin danışanlarının bilgilenme modülü",
    ikon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20s-7-4.4-9.2-8.8C1.5 8.4 3.4 5 6.6 5 8.7 5 10.5 6.3 12 8c1.5-1.7 3.3-3 5.4-3 3.2 0 5.1 3.4 3.8 6.2C19 15.6 12 20 12 20z" />
      </svg>
    ),
  },
];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sifre, setSifre] = useState("");
  const [sifreGoster, setSifreGoster] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hata, setHata] = useState("");
  const router = useRouter();
  const { kullanici, yukleniyor } = useAuth();

  useEffect(() => {
    if (yukleniyor) return;
    if (!kullanici) return;
    if (kullanici.rol === undefined) return;

    // E-Club kişisi (eczacı/teknisyen) → kendi paneline; Eczanem müşterisi →
    // kendi paneline (normalde /eczanem/giris kullanır, burası güvenlik ağı);
    // admin → /admin; diğerleri → firma-aktif kontrolünden geçip /ana-sayfa.
    // Kimlik kaynağı useAuth'tur (B-06/D3 — user_metadata okuması kaldırıldı:
    // metadata girişte iliştirilir ve bayatlayabilir, rolCozucu dersi).
    const yonlendir = async () => {
      if (kullanici.kimlik_turu === "eclub_kisi") {
        router.replace("/eclub/panel");
        return;
      }
      if (kullanici.kimlik_turu === "musteri") {
        router.replace("/eczanem");
        return;
      }

      // Firma aktif mi — firması pasif olan kullanıcı giriş yapamaz.
      // Admin muaftır (firma yönetimi için panele erişmesi gerekir);
      // firma_id useAuth kimliğinden gelir, ayrıca kullanicilar sorgusu gerekmez.
      if (kullanici.rol !== "admin" && kullanici.firma_id) {
        const supabase = createClient();
        const { data: firma } = await supabase
          .from("firmalar")
          .select("aktif")
          .eq("firma_id", kullanici.firma_id)
          .single();

        if (firma && firma.aktif === false) {
          await supabase.auth.signOut();
          setHata("Firmanızın sisteme erişimi şu anda kapalıdır. Lütfen yöneticinizle görüşün.");
          return;
        }
      }

      router.replace(kullanici.rol === "admin" ? "/admin" : "/ana-sayfa");
    };
    yonlendir();
  }, [kullanici, yukleniyor]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setHata("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password: sifre });
    if (error) {
      setHata("E-posta veya şifre hatalı.");
      setLoading(false);
      return;
    }
    // Yönlendirme ve firma-aktif kontrolü yukarıdaki useEffect'te,
    // AuthProvider kimliği çözüldüğünde yapılır.
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row" style={{ fontFamily: "'Nunito', sans-serif" }}>

      {/* Sol panel — marka anlatısı: düz zemin, baykuş grisi (#737373 — logodan
          örneklendi; projenin GRI_METIN tonuyla aynı), başlık + dört modül */}
      <div className="md:w-1/2 lg:w-[54%] flex items-center justify-center px-6 py-10 md:px-12 lg:px-16"
        style={{ background: "#737373" }}>
        <div className="max-w-md w-full">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-2">
            Öğrenmenin V Hali
          </h1>
          <p className="text-base lg:text-lg mb-8 md:mb-10" style={{ color: "rgba(255,255,255,0.9)" }}>
            Öğretirken Kazandırır
          </p>

          <div className="flex flex-col gap-4 md:gap-5">
            {MODULLER.map((m) => (
              <div key={m.ad} className="flex items-start gap-3">
                <span className="flex-shrink-0 flex items-center justify-center rounded-lg"
                  style={{
                    width: 38, height: 38,
                    background: "rgba(255,255,255,0.10)",
                    border: "1px solid rgba(255,255,255,0.18)",
                    color: "rgba(255,255,255,0.9)",
                  }}>
                  {m.ikon}
                </span>
                <div className="min-w-0">
                  <div className="text-base font-bold text-white">{m.ad}</div>
                  <div className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.88)" }}>{m.aciklama}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sağ panel — giriş */}
      <div className="flex-1 bg-white flex flex-col items-center justify-center px-6 py-10 md:py-6">
        <div className="w-full max-w-sm">
          <img src="/logo.png" alt="hapbilgi" className="object-contain mx-auto mb-8" style={{ height: 144 }} />

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">E-posta</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="ornek@sirket.com"
                className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm bg-white text-gray-900 outline-none box-border transition-shadow focus:border-[#bc2d0d] focus:ring-2 focus:ring-[#bc2d0d]/15"
                style={{ fontFamily: "'Nunito', sans-serif" }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Şifre</label>
              <div className="relative">
                <input
                  type={sifreGoster ? "text" : "password"}
                  value={sifre}
                  onChange={(e) => setSifre(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full border border-gray-300 rounded-xl pl-3.5 pr-10 py-2.5 text-sm bg-white text-gray-900 outline-none box-border transition-shadow focus:border-[#bc2d0d] focus:ring-2 focus:ring-[#bc2d0d]/15"
                  style={{ fontFamily: "'Nunito', sans-serif" }}
                />
                <button
                  type="button"
                  onClick={() => setSifreGoster(!sifreGoster)}
                  aria-label={sifreGoster ? "Şifreyi gizle" : "Şifreyi göster"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none p-0 cursor-pointer text-gray-400 hover:text-gray-600"
                >
                  {sifreGoster ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                      <path d="M14.12 14.12a3 3 0 11-4.24-4.24" />
                      <path d="M1 1l22 22" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                <input type="checkbox" className="w-3 h-3" style={{ accentColor: BORDO }} />
                Beni hatırla
              </label>
              {/* İşlevlendirme ayrı iş (§6.4) — link İskender talebiyle geri geldi (13.07.2026). */}
              <a href="#" className="text-xs no-underline" style={{ color: BORDO }}>Şifremi unuttum</a>
            </div>

            {hata && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                <svg className="w-3 h-3 flex-shrink-0" style={{ color: BORDO }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs m-0" style={{ color: BORDO }}>{hata}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full text-white font-bold rounded-xl py-3 text-sm border-none flex items-center justify-center gap-1.5 transition-opacity hover:opacity-90"
              style={{
                background: BORDO,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.6 : 1,
                fontFamily: "'Nunito', sans-serif",
              }}
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                    <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Giriş yapılıyor...
                </>
              ) : "Giriş Yap"}
            </button>
          </form>

          <div className="text-center mt-10">
            <span className="text-xs text-gray-400">© 2026 HapBilgi · Tüm hakları saklıdır.</span>
          </div>
        </div>
      </div>

    </div>
  );
}
