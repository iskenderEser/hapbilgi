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
import { beniHatirlaKaydet } from "@/lib/utils/beniHatirla";

const BORDO = "#bc2d0d";
// F-04 (18.07.2026): giriş ekranı renk/yerleşim talebi — sol %50 açık zemin
// (#f3f4f7) + logo sol üst-orta + metin/ikon #737373 (Eczanem kalbi bordo),
// sağ %50 #f7f7f8 + "Giriş" başlığı. Madde listesi: docs/fiziksel_tespitler_ve_cozumler.md F-04.
const GRI_METIN = "#737373";

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
    // F-04/5: kalbin çizgi rengi bordo — currentColor değil, sabit.
    ikon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#bc2d0d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
  // F-03/B: Beni hatırla — işaretsizse oturum tarayıcı kapanınca düşer.
  const [beniHatirla, setBeniHatirla] = useState(true);
  // F-03/A: Şifremi unuttum — giriş formuyla yer değiştiren sıfırlama görünümü.
  const [sifirlamaAcik, setSifirlamaAcik] = useState(false);
  const [sifirlamaEmail, setSifirlamaEmail] = useState("");
  const [sifirlamaGonderiliyor, setSifirlamaGonderiliyor] = useState(false);
  const [sifirlamaMesaj, setSifirlamaMesaj] = useState("");
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
    // F-03/B: tercih girişte yazılır; işaretsizse tarayıcı kapanınca oturum düşer.
    beniHatirlaKaydet(beniHatirla);
    // Yönlendirme ve firma-aktif kontrolü yukarıdaki useEffect'te,
    // AuthProvider kimliği çözüldüğünde yapılır.
    setLoading(false);
  };

  // F-03/A: sıfırlama bağlantısı isteği. Mesaj her durumda nötrdür —
  // adresin kayıtlı olup olmadığı dışarı sızdırılmaz.
  const handleSifirlamaGonder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSifirlamaGonderiliyor(true);
    setSifirlamaMesaj("");
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(sifirlamaEmail.trim(), {
      redirectTo: `${window.location.origin}/sifre-yenile`,
    });
    setSifirlamaGonderiliyor(false);
    if (error) {
      setSifirlamaMesaj("Bağlantı gönderilemedi. Lütfen biraz sonra tekrar deneyin.");
      return;
    }
    setSifirlamaMesaj(
      "E-posta adresiniz sistemde kayıtlıysa şifre sıfırlama bağlantısı gönderilecektir. Gelen kutunuzu kontrol edin."
    );
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row" style={{ fontFamily: "'Nunito', sans-serif" }}>

      {/* Sol panel — marka anlatısı (F-04): %50 genişlik, açık zemin #f3f4f7,
          logo sol üst-orta, metin ve ikonlar #737373 (Eczanem kalbi bordo) */}
      <div className="md:w-1/2 flex items-center justify-center px-6 py-10 md:px-12 lg:px-16"
        style={{ background: "#f3f4f7" }}>
        {/* F-04 hizalama: masaüstünde sol blok 3cm yukarı, sağ blok 3cm aşağı —
            metin alanının orta çizgisi giriş alanının ekseniyle çakışır (İskender, ekran görseliyle) */}
        <div className="max-w-md w-full md:-translate-y-[75px]">
          {/* F-04: şeffaf zeminli varyant — beyaz gömülü logo.png açık zeminde
              kutu gibi görünüyordu; logo.png beyaz zeminli sayfalarda kalmaya devam eder */}
          <img src="/logo-acik-zemin.png" alt="hapbilgi" className="object-contain mx-auto mb-8" style={{ height: 144 }} />

          {/* Positioning-why cümlesi (İskender, 18.07.2026): "Öğrenmenin V Hali" kalktı,
              slogan başlık oldu. "Kazanmak" tanımı: docs/fiziksel_tespitler_ve_cozumler.md F-04 Ek 3. */}
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold leading-tight mb-8 md:mb-10" style={{ color: GRI_METIN }}>
            Öğretirken Kazandırır
          </h1>

          <div className="flex flex-col gap-4 md:gap-5">
            {MODULLER.map((m) => (
              <div key={m.ad} className="flex items-start gap-3">
                <span className="flex-shrink-0 flex items-center justify-center rounded-lg"
                  style={{
                    width: 38, height: 38,
                    background: "rgba(115,115,115,0.08)",
                    border: "1px solid rgba(115,115,115,0.22)",
                    color: GRI_METIN,
                  }}>
                  {m.ikon}
                </span>
                <div className="min-w-0">
                  <div className="text-base font-bold" style={{ color: GRI_METIN }}>{m.ad}</div>
                  <div className="text-sm leading-relaxed" style={{ color: GRI_METIN }}>{m.aciklama}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sağ panel — giriş (F-04): %50 genişlik, zemin #f7f7f8, logo sola taşındı,
          form bloğunun üstünde sola yaslı bold "Giriş" başlığı */}
      <div className="md:w-1/2 flex flex-col items-center justify-center px-6 py-10 md:py-6"
        style={{ background: "#f7f7f8" }}>
        <div className="w-full max-w-sm md:translate-y-[60px]">
          {!sifirlamaAcik && (
            <h2 className="text-xl font-bold text-left mb-6" style={{ color: GRI_METIN }}>Giriş</h2>
          )}

          {sifirlamaAcik ? (
          /* F-03/A: şifre sıfırlama görünümü — giriş formuyla yer değiştirir */
          <form onSubmit={handleSifirlamaGonder} className="flex flex-col gap-4">
            <div>
              <h2 className="text-base font-bold text-gray-900 m-0 mb-1">Şifre Sıfırlama</h2>
              <p className="text-xs text-gray-500 m-0 leading-relaxed">
                Kayıtlı e-posta adresinizi girin; şifre sıfırlama bağlantısı gönderelim.
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">E-posta</label>
              <input
                type="email"
                value={sifirlamaEmail}
                onChange={(e) => setSifirlamaEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="ornek@sirket.com"
                className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm bg-white text-gray-900 outline-none box-border transition-shadow focus:border-[#bc2d0d] focus:ring-2 focus:ring-[#bc2d0d]/15"
                style={{ fontFamily: "'Nunito', sans-serif" }}
              />
            </div>

            {sifirlamaMesaj && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                <p className="text-xs text-gray-700 m-0 leading-relaxed">{sifirlamaMesaj}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={sifirlamaGonderiliyor}
              className="w-full text-white font-bold rounded-xl py-3 text-sm border-none transition-opacity hover:opacity-90"
              style={{
                background: BORDO,
                cursor: sifirlamaGonderiliyor ? "not-allowed" : "pointer",
                opacity: sifirlamaGonderiliyor ? 0.6 : 1,
                fontFamily: "'Nunito', sans-serif",
              }}
            >
              {sifirlamaGonderiliyor ? "Gönderiliyor..." : "Sıfırlama Bağlantısı Gönder"}
            </button>

            <button
              type="button"
              onClick={() => { setSifirlamaAcik(false); setSifirlamaMesaj(""); }}
              className="bg-transparent border-none p-0 text-xs cursor-pointer mx-auto"
              style={{ color: BORDO, fontFamily: "'Nunito', sans-serif" }}
            >
              ← Girişe dön
            </button>
          </form>
          ) : (
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">E-posta</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
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
                  autoComplete="current-password"
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
                <input
                  type="checkbox"
                  checked={beniHatirla}
                  onChange={(e) => setBeniHatirla(e.target.checked)}
                  className="w-3 h-3"
                  style={{ accentColor: BORDO }}
                />
                Beni hatırla
              </label>
              {/* F-03/A: sıfırlama görünümünü açar; girilmiş e-posta öndoldurulur */}
              <button
                type="button"
                onClick={() => { setSifirlamaEmail(email); setSifirlamaMesaj(""); setSifirlamaAcik(true); }}
                className="bg-transparent border-none p-0 text-xs cursor-pointer"
                style={{ color: BORDO, fontFamily: "'Nunito', sans-serif" }}
              >
                Şifremi unuttum
              </button>
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
          )}

          <div className="text-center mt-10">
            <span className="text-xs text-gray-400">© 2026 HapBilgi · Tüm hakları saklıdır.</span>
          </div>
        </div>
      </div>

    </div>
  );
}
