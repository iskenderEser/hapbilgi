// app/login/page.tsx
"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useEkran } from "@/styles/responsive";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sifre, setSifre] = useState("");
  const [loading, setLoading] = useState(false);
  const [hata, setHata] = useState("");
  const router = useRouter();
  const ekran = useEkran();

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

  const isMobile = ekran === 'mobile';
  const isTablet = ekran === 'tablet';

  return (
    <div style={{ minHeight: "100vh", background: "white", fontFamily: "'Nunito', sans-serif", display: "flex", flexDirection: "column" }}>

      {/* Navbar - logo */}
      <nav style={{ background: "white", borderBottom: "1px solid #e5e7eb", padding: isMobile ? "12px 0" : "0", height: isMobile ? undefined : isTablet ? "130px" : "175px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <img src="/logo.png" alt="hapbilgi" style={{ height: isMobile ? "72px" : isTablet ? "120px" : "165px", objectFit: "contain" }} />
      </nav>

      {/* İçerik */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        alignItems: "center",
        justifyContent: "center",
        gap: isMobile ? "24px" : isTablet ? "40px" : "80px",
        padding: isMobile ? "24px 20px" : isTablet ? "32px 40px" : "40px 80px",
      }}>

        {/* Sol metin */}
        {isMobile ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "22px", fontWeight: 700, color: "#bc2d0d", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>Eğitimin V Hali</div>
            <div style={{ fontSize: "16px", fontWeight: 800, color: "#111827", marginBottom: "8px" }}>İzleyin - Kazanın - Uygulayın</div>
            <div style={{ fontSize: "13px", color: "#737373", lineHeight: 1.7 }}>HapBilgi, ilaç sektörü profesyonelleri için tasarlanmış video tabanlı kurumsal eğitim platformudur.</div>
          </div>
        ) : (
          <div style={{ maxWidth: isTablet ? "340px" : "420px" }}>
            <div style={{ fontSize: isTablet ? "28px" : "40px", fontWeight: 700, color: "#bc2d0d", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "16px" }}>Eğitimin V Hali</div>
            <div style={{ fontSize: isTablet ? "20px" : "27px", fontWeight: 800, color: "#111827", lineHeight: 1.3, marginBottom: "16px" }}>İzleyin - Kazanın - Uygulayın</div>
            <div style={{ fontSize: isTablet ? "14px" : "16px", color: "#737373", lineHeight: 1.8 }}>HapBilgi, ilaç sektörü profesyonelleri için tasarlanmış video tabanlı kurumsal eğitim platformudur.</div>
          </div>
        )}

        {/* Form */}
        <div style={{ width: isMobile ? "100%" : "320px", flexShrink: 0 }}>
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#737373", marginBottom: "6px" }}>E-posta</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="ornek@sirket.com"
                style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "10px 12px", fontSize: "14px", background: "#f9fafb", color: "#111827", fontFamily: "'Nunito', sans-serif", outline: "none", boxSizing: "border-box" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#737373", marginBottom: "6px" }}>Şifre</label>
              <input
                type="password"
                value={sifre}
                onChange={(e) => setSifre(e.target.value)}
                required
                placeholder="••••••••"
                style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "10px 12px", fontSize: "14px", background: "#f9fafb", color: "#111827", fontFamily: "'Nunito', sans-serif", outline: "none", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#737373", cursor: "pointer" }}>
                <input type="checkbox" style={{ width: "13px", height: "13px", accentColor: "#bc2d0d" }} />
                Beni hatırla
              </label>
              <a href="#" style={{ fontSize: "12px", color: "#56aeff", textDecoration: "none" }}>Şifremi unuttum</a>
            </div>

            {hata && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px", padding: "8px 12px" }}>
                <svg style={{ width: 14, height: 14, color: "#bc2d0d", flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p style={{ color: "#bc2d0d", fontSize: "12px", margin: 0 }}>{hata}</p>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "center" }}>
              <button
                type="submit"
                disabled={loading}
                style={{ width: isMobile ? "100%" : "50%", background: "#bc2d0d", color: "white", fontWeight: 700, borderRadius: "10px", padding: "11px 0", fontSize: "14px", border: "none", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1, fontFamily: "'Nunito', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin" style={{ width: 13, height: 13 }} fill="none" viewBox="0 0 24 24">
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
      <div style={{ background: "#f9fafb", borderTop: "1px solid #e5e7eb", padding: isMobile ? "20px" : "20px 32px" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: isMobile ? "16px" : "40px", textAlign: "center" }}>
          {[
            { ikon: "🎬", baslik: "İzleyin", aciklama: "Öğrenmenin devamlılığını sağlayın." },
            { ikon: "📊", baslik: "Kazanın", aciklama: "İzledikçe yıldızınızı parlatın." },
            { ikon: "🎯", baslik: "Uygulayın", aciklama: "Kazandıkça daha çok kazanın." },
          ].map((k, i) => (
            <div key={i}>
              <div style={{ fontSize: isMobile ? "22px" : "32px", marginBottom: isMobile ? "4px" : "12px" }}>{k.ikon}</div>
              <div style={{ fontSize: isMobile ? "12px" : "16px", fontWeight: 700, color: "#111827", marginBottom: isMobile ? "2px" : "8px" }}>{k.baslik}</div>
              <div style={{ fontSize: isMobile ? "11px" : "13px", color: "#737373", lineHeight: 1.7 }}>{k.aciklama}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ background: "white", borderTop: "1px solid #e5e7eb", padding: "10px 32px", textAlign: "center" }}>
        <span style={{ fontSize: "12px", color: "#9ca3af" }}>© 2026 HapBilgi · Tüm hakları saklıdır.</span>
      </div>

    </div>
  );
}