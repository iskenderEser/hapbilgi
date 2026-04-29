// app/login/page.tsx
"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sifre, setSifre] = useState("");
  const [loading, setLoading] = useState(false);
  const [hata, setHata] = useState("");
  const router = useRouter();

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
    router.push("/ana-sayfa");
  };

  return (
    <div className="min-h-screen bg-white flex flex-col" style={{ fontFamily: "'Nunito', sans-serif" }}>

      {/* Navbar - logo */}
      <nav className="bg-white border-b border-gray-200 flex items-center justify-center py-3 md:h-32 lg:h-44">
        <img
          src="/logo.png"
          alt="hapbilgi"
          className="object-contain"
          style={{ height: "72px" }}
        />
      </nav>

      {/* İçerik */}
      <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-6 md:gap-10 lg:gap-20 px-5 py-6 md:px-10 md:py-8 lg:px-20 lg:py-10">

        {/* Sol metin - mobile */}
        <div className="text-center md:hidden">
          <div className="text-xl font-bold uppercase tracking-wide mb-1" style={{ color: "#bc2d0d", letterSpacing: "0.06em" }}>Eğitimin V Hali</div>
          <div className="text-base font-extrabold text-gray-900 mb-2">İzleyin - Kazanın - Uygulayın</div>
          <div className="text-sm text-gray-500 leading-relaxed">HapBilgi, ilaç sektörü profesyonelleri için tasarlanmış video tabanlı kurumsal eğitim platformudur.</div>
        </div>

        {/* Sol metin - tablet/desktop */}
        <div className="hidden md:block max-w-sm lg:max-w-md">
          <div className="text-3xl lg:text-4xl font-bold uppercase mb-4" style={{ color: "#bc2d0d", letterSpacing: "0.08em" }}>Eğitimin V Hali</div>
          <div className="text-xl lg:text-3xl font-extrabold text-gray-900 leading-snug mb-4">İzleyin - Kazanın - Uygulayın</div>
          <div className="text-sm lg:text-base text-gray-500 leading-loose">HapBilgi, ilaç sektörü profesyonelleri için tasarlanmış video tabanlı kurumsal eğitim platformudur.</div>
        </div>

        {/* Form */}
        <div className="w-full md:w-80 flex-shrink-0">
          <form onSubmit={handleLogin} className="flex flex-col gap-3">

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">E-posta</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="ornek@sirket.com"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 text-gray-900 outline-none box-border"
                style={{ fontFamily: "'Nunito', sans-serif" }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Şifre</label>
              <input
                type="password"
                value={sifre}
                onChange={(e) => setSifre(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 text-gray-900 outline-none box-border"
                style={{ fontFamily: "'Nunito', sans-serif" }}
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
                <input type="checkbox" className="w-3 h-3" style={{ accentColor: "#bc2d0d" }} />
                Beni hatırla
              </label>
              <a href="#" className="text-xs no-underline" style={{ color: "#56aeff" }}>Şifremi unuttum</a>
            </div>

            {hata && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                <svg className="w-3 h-3 flex-shrink-0" style={{ color: "#bc2d0d" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs m-0" style={{ color: "#bc2d0d" }}>{hata}</p>
              </div>
            )}

            <div className="flex justify-center">
              <button
                type="submit"
                disabled={loading}
                className="w-full md:w-1/2 text-white font-bold rounded-xl py-3 text-sm border-none flex items-center justify-center gap-1"
                style={{
                  background: "#bc2d0d",
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
            </div>

          </form>
        </div>
      </div>

      {/* Özellikler */}
      <div className="bg-gray-50 border-t border-gray-200 py-5 px-5 md:px-8">
        <div className="max-w-3xl mx-auto grid grid-cols-3 gap-4 md:gap-10 text-center">
          {[
            { ikon: "🎬", baslik: "İzleyin", aciklama: "Öğrenmenin devamlılığını sağlayın." },
            { ikon: "📊", baslik: "Kazanın", aciklama: "İzledikçe yıldızınızı parlatın." },
            { ikon: "🎯", baslik: "Uygulayın", aciklama: "Kazandıkça daha çok kazanın." },
          ].map((k, i) => (
            <div key={i}>
              <div className="text-2xl md:text-3xl mb-1 md:mb-3">{k.ikon}</div>
              <div className="text-xs md:text-base font-bold text-gray-900 mb-1 md:mb-2">{k.baslik}</div>
              <div className="text-xs md:text-sm text-gray-500 leading-relaxed">{k.aciklama}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-gray-200 py-2 px-8 text-center">
        <span className="text-xs text-gray-400">© 2026 HapBilgi · Tüm hakları saklıdır.</span>
      </div>

    </div>
  );
}