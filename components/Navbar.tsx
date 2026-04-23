// components/Navbar.tsx
"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface NavbarProps {
  email: string;
  rol: string;
  adSoyad?: string;
  onCikis: () => void;
}

export default function Navbar({ email, rol, adSoyad, onCikis }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [badge, setBadge] = useState<Record<string, number>>({});
  const [hover, setHover] = useState<string | null>(null);
  const [kullaniciAd, setKullaniciAd] = useState<string>(adSoyad ?? "");

  const isAktif = (path: string) => pathname.startsWith(path);

  const ureticiRoller = ["pm", "jr_pm", "kd_pm", "iu"];
  const yonlendiriciRoller = ["tm", "bm"];
  const tuketiciRoller = ["utt", "kd_utt"];

  const rolKucu = rol.toLowerCase();
  const isPM = ["pm", "jr_pm", "kd_pm"].includes(rolKucu);
  const isIU = rolKucu === "iu";

  useEffect(() => {
    if (adSoyad) return;
    fetch("/profil/api")
      .then(res => res.json())
      .then(data => {
        if (data.profil) {
          setKullaniciAd(`${data.profil.ad} ${data.profil.soyad}`);
        }
      })
      .catch(() => {});
  }, []);

  const badgelariCek = async () => {
    try {
      const res = await fetch("/bildirimler/api");
      if (!res.ok) return;
      const data = await res.json();
      setBadge(data.sayilar ?? {});
    } catch {}
  };

  useEffect(() => {
    if (!rol) return;
    badgelariCek();
  }, [pathname, rol]);

  const okunduIsaretle = async (kayit_turu: string) => {
    try {
      await fetch("/bildirimler/api", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kayit_turu }),
      });
      setBadge(prev => ({ ...prev, [kayit_turu]: 0 }));
    } catch {}
  };

  const pillStyle = (key: string, path: string): React.CSSProperties => {
    const aktif = isAktif(path);
    const isHover = hover === key;
    return {
      position: "relative",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "6px 14px",
      borderRadius: "20px",
      border: "none",
      cursor: "pointer",
      fontSize: "13px",
      fontWeight: aktif ? 600 : 500,
      fontFamily: "'Nunito', sans-serif",
      transition: "all 0.2s",
      color: aktif ? "#bc2d0d" : "#374151",
      background: aktif
        ? "rgba(188, 45, 13, 0.08)"
        : isHover
        ? "rgba(188, 45, 13, 0.06)"
        : "rgba(0, 0, 0, 0.04)",
      backdropFilter: "blur(8px)",
      WebkitBackdropFilter: "blur(8px)",
      boxShadow: aktif
        ? "inset 0 0 0 0.5px rgba(188, 45, 13, 0.25)"
        : "inset 0 0 0 0.5px rgba(0, 0, 0, 0.08)",
    };
  };

  const Badge = ({ sayi }: { sayi: number }) => {
    if (!sayi || sayi === 0) return null;
    return (
      <span style={{
        position: "absolute",
        top: "-6px",
        right: "-6px",
        background: "#bc2d0d",
        color: "white",
        borderRadius: "50%",
        width: "16px",
        height: "16px",
        fontSize: "10px",
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        lineHeight: 1,
        pointerEvents: "none",
        boxShadow: "0 0 0 2px white",
      }}>
        {sayi > 99 ? "99+" : sayi}
      </span>
    );
  };

  return (
    <nav style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderBottom: "0.5px solid #e5e7eb", padding: "10px 24px" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <img
            src="/logo.png"
            alt="hapbilgi"
            style={{ height: "75px", cursor: "pointer", marginRight: "8px" }}
            onClick={() => router.push("/")}
          />

          {/* Ana Sayfa — tüm roller */}
          <button
            onClick={() => router.push("/ana-sayfa")}
            onMouseEnter={() => setHover("ana-sayfa")}
            onMouseLeave={() => setHover(null)}
            style={pillStyle("ana-sayfa", "/ana-sayfa")}
          >
            Ana Sayfa
          </button>

          {/* Üretici roller */}
          {ureticiRoller.includes(rolKucu) && (
            <>
              <button
                onClick={() => { router.push("/talepler"); okunduIsaretle("talep"); }}
                onMouseEnter={() => setHover("talepler")}
                onMouseLeave={() => setHover(null)}
                style={pillStyle("talepler", "/talepler")}
              >
                Talepler
                <Badge sayi={badge["talep"] ?? 0} />
              </button>

              <button
                onClick={() => { router.push("/senaryolar"); okunduIsaretle("senaryo"); }}
                onMouseEnter={() => setHover("senaryolar")}
                onMouseLeave={() => setHover(null)}
                style={pillStyle("senaryolar", "/senaryolar")}
              >
                Senaryolar
                <Badge sayi={badge["senaryo"] ?? 0} />
              </button>

              <button
                onClick={() => { router.push("/videolar"); okunduIsaretle("video"); }}
                onMouseEnter={() => setHover("videolar")}
                onMouseLeave={() => setHover(null)}
                style={pillStyle("videolar", "/videolar")}
              >
                Videolar
                <Badge sayi={badge["video"] ?? 0} />
              </button>

              <button
                onClick={() => { router.push("/soru-setleri"); okunduIsaretle("soru_seti"); }}
                onMouseEnter={() => setHover("soru-setleri")}
                onMouseLeave={() => setHover(null)}
                style={pillStyle("soru-setleri", "/soru-setleri")}
              >
                Soru Setleri
                <Badge sayi={badge["soru_seti"] ?? 0} />
              </button>
            </>
          )}

          {/* PM'e özel */}
          {isPM && (
            <button
              onClick={() => router.push("/yayin-yonetimi")}
              onMouseEnter={() => setHover("yayin-yonetimi")}
              onMouseLeave={() => setHover(null)}
              style={pillStyle("yayin-yonetimi", "/yayin-yonetimi")}
            >
              Yayın Yönetimi
            </button>
          )}

          {/* Yönlendirici roller */}
          {yonlendiriciRoller.includes(rolKucu) && (
            <button
              onClick={() => router.push("/oneriler")}
              onMouseEnter={() => setHover("oneriler")}
              onMouseLeave={() => setHover(null)}
              style={pillStyle("oneriler", "/oneriler")}
            >
              Öneriler
            </button>
          )}

          {/* Tüketici roller */}
          {tuketiciRoller.includes(rolKucu) && (
            <>
              <button
                onClick={() => { router.push("/izle"); okunduIsaretle("yayin"); }}
                onMouseEnter={() => setHover("izle")}
                onMouseLeave={() => setHover(null)}
                style={pillStyle("izle", "/izle")}
              >
                Videolar
                <Badge sayi={badge["yayin"] ?? 0} />
              </button>
              <button
                onClick={() => { router.push("/oneriler"); okunduIsaretle("oneri"); }}
                onMouseEnter={() => setHover("oneriler-utt")}
                onMouseLeave={() => setHover(null)}
                style={pillStyle("oneriler-utt", "/oneriler")}
              >
                Öneriler
                <Badge sayi={badge["oneri"] ?? 0} />
              </button>
            </>
          )}

          {/* HBLigi — tüm roller */}
          <button
            onClick={() => router.push("/hbligi")}
            onMouseEnter={() => setHover("hbligi")}
            onMouseLeave={() => setHover(null)}
            style={pillStyle("hbligi", "/hbligi")}
          >
            HBLigi
          </button>
        </div>

        {/* Sağ taraf */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            onClick={() => router.push("/profil")}
            style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}
          >
            {kullaniciAd && <span style={{ fontSize: "12px", fontWeight: 600, color: "#374151" }}>{kullaniciAd}</span>}
            <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#56aeff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, color: "white", border: "2px solid #e5e7eb" }}>
              {kullaniciAd ? `${kullaniciAd.split(" ")[0]?.[0] ?? ""}${kullaniciAd.split(" ")[1]?.[0] ?? ""}` : email?.[0]?.toUpperCase()}
            </div>
          </div>
          <button
            onClick={onCikis}
            onMouseEnter={() => setHover("cikis")}
            onMouseLeave={() => setHover(null)}
            style={{ ...pillStyle("cikis", "/__never__"), display: "flex", alignItems: "center", gap: "6px" }}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Çıkış
          </button>
        </div>
      </div>
    </nav>
  );
}