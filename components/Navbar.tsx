"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useEkran, navbarGorunum, navbar, font } from "@/styles/responsive";

interface NavbarProps {
  email: string;
  rol: string;
  adSoyad?: string;
  onCikis: () => void;
}

export default function Navbar({ email, rol, adSoyad, onCikis }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const ekran = useEkran();
  const { hamburgerGoster, pillGoster, altNavGoster } = navbarGorunum(ekran);
  const [badge, setBadge] = useState<Record<string, number>>({});
  const [hover, setHover] = useState<string | null>(null);
  const [kullaniciAd, setKullaniciAd] = useState<string>(adSoyad ?? "");
  const [menuAcik, setMenuAcik] = useState(false);

  const isAktif = (path: string) => pathname.startsWith(path);

  const ureticiRoller = ["pm", "jr_pm", "kd_pm", "iu"];
  const yonlendiriciRoller = ["tm", "bm"];
  const tuketiciRoller = ["utt", "kd_utt"];
  const analizRoller = ["bm", "tm", "pm", "jr_pm", "kd_pm", "gm", "gm_yrd", "drk", "paz_md", "blm_md", "med_md", "grp_pm", "sm", "egt_md", "egt_yrd_md", "egt_yon", "egt_uz"];

  const rolKucu = rol.toLowerCase();
  const isPM = ["pm", "jr_pm", "kd_pm"].includes(rolKucu);
  const isIU = rolKucu === "iu";

  useEffect(() => {
    if (adSoyad) return;
    fetch("/profil/api")
      .then(res => res.json())
      .then(data => {
        if (data.profil) setKullaniciAd(`${data.profil.ad} ${data.profil.soyad}`);
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

  // Menü açıldığında dışarı tıklanınca kapat
  useEffect(() => {
    if (!menuAcik) return;
    const kapat = () => setMenuAcik(false);
    document.addEventListener("click", kapat);
    return () => document.removeEventListener("click", kapat);
  }, [menuAcik]);

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

  const raporaGit = () => {
    if (isIU) return;
    if (tuketiciRoller.includes(rolKucu)) router.push("/raporlar/utt");
    else if (rolKucu === "bm") router.push("/raporlar/bm");
    else if (rolKucu === "tm") router.push("/raporlar/tm");
    else if (isPM) router.push("/raporlar/pm");
    else router.push("/raporlar/yonetici");
  };

  const pillStyle = (key: string, path: string): React.CSSProperties => {
    const aktif = isAktif(path)
      || (key === "raporlar" && pathname.startsWith("/raporlar"))
      || (key === "analiz" && pathname.startsWith("/analiz"))
      || (key === "bm-egitim" && pathname.startsWith("/bm-egitim"))
      || (key === "challenge-club" && pathname.startsWith("/challenge-club"));
    const isHover = hover === key;
    return {
      position: "relative",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: ekran === "desktop" ? "6px 14px" : "5px 10px",
      borderRadius: "20px",
      border: "none",
      cursor: "pointer",
      fontSize: ekran === "desktop" ? "13px" : "11px",
      fontWeight: aktif ? 600 : 500,
      fontFamily: "'Nunito', sans-serif",
      transition: "all 0.2s",
      color: aktif ? "#bc2d0d" : "#374151",
      background: aktif ? "rgba(188, 45, 13, 0.08)" : isHover ? "rgba(188, 45, 13, 0.06)" : "rgba(0, 0, 0, 0.04)",
      backdropFilter: "blur(8px)",
      WebkitBackdropFilter: "blur(8px)",
      boxShadow: aktif ? "inset 0 0 0 0.5px rgba(188, 45, 13, 0.25)" : "inset 0 0 0 0.5px rgba(0, 0, 0, 0.08)",
      whiteSpace: "nowrap",
    };
  };

  const Badge = ({ sayi }: { sayi: number }) => {
    if (!sayi || sayi === 0) return null;
    return (
      <span style={{
        position: "absolute", top: "-6px", right: "-6px",
        background: "#bc2d0d", color: "white", borderRadius: "50%",
        width: "16px", height: "16px", fontSize: "10px", fontWeight: 700,
        display: "flex", alignItems: "center", justifyContent: "center",
        lineHeight: 1, pointerEvents: "none", boxShadow: "0 0 0 2px white",
      }}>
        {sayi > 99 ? "99+" : sayi}
      </span>
    );
  };

  // Hamburger menü içeriği
  const MenuItem = ({ label, path, onClick, mavi, badgeSayi }: {
    label: string; path?: string; onClick?: () => void; mavi?: boolean; badgeSayi?: number;
  }) => {
    const aktif = path ? isAktif(path) : false;
    return (
      <div
        onClick={(e) => { e.stopPropagation(); onClick ? onClick() : path && router.push(path); setMenuAcik(false); }}
        style={{
          padding: "10px 14px", borderRadius: 8, fontSize: 13,
          fontFamily: "'Nunito', sans-serif", cursor: "pointer",
          background: aktif ? "rgba(188,45,13,0.08)" : "transparent",
          color: mavi ? "#56aeff" : aktif ? "#bc2d0d" : "#374151",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}
      >
        {label}
        {badgeSayi ? (
          <span style={{ background: "#bc2d0d", color: "white", borderRadius: "50%", width: 18, height: 18, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {badgeSayi}
          </span>
        ) : null}
      </div>
    );
  };

  return (
    <>
      <nav style={{
        background: "rgba(255,255,255,0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "0.5px solid #e5e7eb",
        padding: ekran === "mobile" ? "8px 14px" : "10px 24px",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          
          {/* Sol: Logo + pill'ler */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", flex: 1, minWidth: 0 }}>
            <img
              src="/logo.png"
              alt="hapbilgi"
              style={{ height: ekran === "mobile" ? "40px" : ekran === "tablet" ? "55px" : "75px", cursor: "pointer", marginRight: "8px", flexShrink: 0 }}
              onClick={() => router.push("/")}
            />

            {/* Tablet ve desktop: pill'ler */}
            {pillGoster && (
              <>
                <button onClick={() => router.push("/ana-sayfa")} onMouseEnter={() => setHover("ana-sayfa")} onMouseLeave={() => setHover(null)} style={pillStyle("ana-sayfa", "/ana-sayfa")}>Ana Sayfa</button>

                {ureticiRoller.includes(rolKucu) && (
                  <>
                    <button onClick={() => { router.push("/talepler"); okunduIsaretle("talep"); }} onMouseEnter={() => setHover("talepler")} onMouseLeave={() => setHover(null)} style={pillStyle("talepler", "/talepler")}>
                      Talepler<Badge sayi={badge["talep"] ?? 0} />
                    </button>
                    <button onClick={() => { router.push("/senaryolar"); okunduIsaretle("senaryo"); }} onMouseEnter={() => setHover("senaryolar")} onMouseLeave={() => setHover(null)} style={pillStyle("senaryolar", "/senaryolar")}>
                      Senaryolar<Badge sayi={badge["senaryo"] ?? 0} />
                    </button>
                    <button onClick={() => { router.push("/videolar"); okunduIsaretle("video"); }} onMouseEnter={() => setHover("videolar")} onMouseLeave={() => setHover(null)} style={pillStyle("videolar", "/videolar")}>
                      Videolar<Badge sayi={badge["video"] ?? 0} />
                    </button>
                    <button onClick={() => { router.push("/soru-setleri"); okunduIsaretle("soru_seti"); }} onMouseEnter={() => setHover("soru-setleri")} onMouseLeave={() => setHover(null)} style={pillStyle("soru-setleri", "/soru-setleri")}>
                      Soru Setleri<Badge sayi={badge["soru_seti"] ?? 0} />
                    </button>
                  </>
                )}

                {isPM && (
                  <button onClick={() => router.push("/yayin-yonetimi")} onMouseEnter={() => setHover("yayin-yonetimi")} onMouseLeave={() => setHover(null)} style={pillStyle("yayin-yonetimi", "/yayin-yonetimi")}>Yayın Yönetimi</button>
                )}

                {yonlendiriciRoller.includes(rolKucu) && (
                  <button onClick={() => router.push("/oneriler")} onMouseEnter={() => setHover("oneriler")} onMouseLeave={() => setHover(null)} style={pillStyle("oneriler", "/oneriler")}>Öneriler</button>
                )}

                {tuketiciRoller.includes(rolKucu) && (
                  <>
                    <button onClick={() => { router.push("/izle"); okunduIsaretle("yayin"); }} onMouseEnter={() => setHover("izle")} onMouseLeave={() => setHover(null)} style={pillStyle("izle", "/izle")}>
                      Videolar<Badge sayi={badge["yayin"] ?? 0} />
                    </button>
                    <button onClick={() => { router.push("/oneriler"); okunduIsaretle("oneri"); }} onMouseEnter={() => setHover("oneriler-utt")} onMouseLeave={() => setHover(null)} style={pillStyle("oneriler-utt", "/oneriler")}>
                      Öneriler<Badge sayi={badge["oneri"] ?? 0} />
                    </button>
                  </>
                )}

                {!isIU && (
                  <button onClick={raporaGit} onMouseEnter={() => setHover("raporlar")} onMouseLeave={() => setHover(null)} style={pillStyle("raporlar", "/raporlar")}>Raporlar</button>
                )}

                {analizRoller.includes(rolKucu) && (
                  <button onClick={() => router.push("/analiz")} onMouseEnter={() => setHover("analiz")} onMouseLeave={() => setHover(null)} style={pillStyle("analiz", "/analiz")}>Analiz</button>
                )}

                <button onClick={() => router.push("/hbligi")} onMouseEnter={() => setHover("hbligi")} onMouseLeave={() => setHover(null)} style={pillStyle("hbligi", "/hbligi")}>HBLigi</button>

                {rolKucu === "bm" && (
                  <>
                    <div style={{ width: "0.5px", height: "20px", background: "#e5e7eb", margin: "0 4px", flexShrink: 0 }} />
                    <button onClick={() => router.push("/bm-egitim/izle")} onMouseEnter={() => setHover("bm-egitim")} onMouseLeave={() => setHover(null)} style={{ ...pillStyle("bm-egitim", "/bm-egitim"), color: "#56aeff", background: pathname.startsWith("/bm-egitim") ? "rgba(86,174,255,0.12)" : hover === "bm-egitim" ? "rgba(86,174,255,0.08)" : "rgba(86,174,255,0.05)", boxShadow: "inset 0 0 0 0.5px rgba(86,174,255,0.35)" }}>Eğitim</button>
                    <button onClick={() => router.push("/challenge-club")} onMouseEnter={() => setHover("challenge-club")} onMouseLeave={() => setHover(null)} style={{ ...pillStyle("challenge-club", "/challenge-club"), color: "#56aeff", background: pathname.startsWith("/challenge-club") ? "rgba(86,174,255,0.12)" : hover === "challenge-club" ? "rgba(86,174,255,0.08)" : "rgba(86,174,255,0.05)", boxShadow: "inset 0 0 0 0.5px rgba(86,174,255,0.35)" }}>Challenge Club</button>
                  </>
                )}
              </>
            )}
          </div>

          {/* Sağ: Kullanıcı + hamburger */}
          <div style={{ display: "flex", alignItems: "center", gap: ekran === "mobile" ? "8px" : "12px", flexShrink: 0 }}>
            {!hamburgerGoster && (
              <>
                {kullaniciAd && <span style={{ fontSize: "12px", fontWeight: 600, color: "#374151" }}>{kullaniciAd}</span>}
                <div onClick={() => router.push("/profil")} style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#56aeff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, color: "white", border: "2px solid #e5e7eb", cursor: "pointer" }}>
                  {kullaniciAd ? `${kullaniciAd.split(" ")[0]?.[0] ?? ""}${kullaniciAd.split(" ")[1]?.[0] ?? ""}` : email?.[0]?.toUpperCase()}
                </div>
                <button onClick={onCikis} onMouseEnter={() => setHover("cikis")} onMouseLeave={() => setHover(null)} style={{ ...pillStyle("cikis", "/__never__"), display: "flex", alignItems: "center", gap: "6px" }}>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  Çıkış
                </button>
              </>
            )}

            {hamburgerGoster && (
              <>
                <div onClick={() => router.push("/profil")} style={{ width: "28px", height: "28px", borderRadius: "50%", background: "#56aeff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700, color: "white", cursor: "pointer" }}>
                  {kullaniciAd ? `${kullaniciAd.split(" ")[0]?.[0] ?? ""}${kullaniciAd.split(" ")[1]?.[0] ?? ""}` : email?.[0]?.toUpperCase()}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuAcik(prev => !prev); }}
                  style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", gap: "4px", padding: "4px" }}
                >
                  <span style={{ display: "block", width: "18px", height: "1.5px", background: "#374151" }} />
                  <span style={{ display: "block", width: "18px", height: "1.5px", background: "#374151" }} />
                  <span style={{ display: "block", width: "18px", height: "1.5px", background: "#374151" }} />
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hamburger dropdown menü */}
      {hamburgerGoster && menuAcik && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: "fixed", top: 57, left: 0, right: 0, zIndex: 99,
            background: "rgba(255,255,255,0.97)",
            backdropFilter: "blur(12px)",
            borderBottom: "0.5px solid #e5e7eb",
            padding: "8px 14px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          }}
        >
          <MenuItem label="Ana Sayfa" path="/ana-sayfa" />

          {ureticiRoller.includes(rolKucu) && (
            <>
              <MenuItem label="Talepler" path="/talepler" badgeSayi={badge["talep"]} />
              <MenuItem label="Senaryolar" path="/senaryolar" badgeSayi={badge["senaryo"]} />
              <MenuItem label="Videolar" path="/videolar" badgeSayi={badge["video"]} />
              <MenuItem label="Soru Setleri" path="/soru-setleri" badgeSayi={badge["soru_seti"]} />
            </>
          )}

          {isPM && <MenuItem label="Yayın Yönetimi" path="/yayin-yonetimi" />}

          {yonlendiriciRoller.includes(rolKucu) && <MenuItem label="Öneriler" path="/oneriler" />}

          {tuketiciRoller.includes(rolKucu) && (
            <>
              <MenuItem label="Videolar" path="/izle" badgeSayi={badge["yayin"]} />
              <MenuItem label="Öneriler" path="/oneriler" badgeSayi={badge["oneri"]} />
            </>
          )}

          {!isIU && <MenuItem label="Raporlar" onClick={raporaGit} />}
          {analizRoller.includes(rolKucu) && <MenuItem label="Analiz" path="/analiz" />}
          <MenuItem label="HBLigi" path="/hbligi" />

          {rolKucu === "bm" && (
            <>
              <div style={{ height: "0.5px", background: "#e5e7eb", margin: "6px 0" }} />
              <MenuItem label="Eğitim" path="/bm-egitim/izle" mavi />
              <MenuItem label="Challenge Club" path="/challenge-club" mavi />
            </>
          )}

          <div style={{ height: "0.5px", background: "#e5e7eb", margin: "6px 0" }} />
          <MenuItem label="Çıkış" onClick={onCikis} />
        </div>
      )}

      {/* Alt navigasyon — sadece mobile UTT/KD_UTT */}
      {altNavGoster && tuketiciRoller.includes(rolKucu) && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(12px)",
          borderTop: "0.5px solid #e5e7eb",
          padding: "8px 0 12px",
          display: "flex", justifyContent: "space-around",
        }}>
          {[
            { label: "Ana", path: "/ana-sayfa", badge: 0 },
            { label: "Video", path: "/izle", badge: badge["yayin"] ?? 0 },
            { label: "Öneri", path: "/oneriler", badge: badge["oneri"] ?? 0 },
            { label: "Profil", path: "/profil", badge: 0 },
          ].map(item => {
            const aktif = pathname.startsWith(item.path);
            return (
              <button
                key={item.path}
                onClick={() => router.push(item.path)}
                style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, position: "relative", fontFamily: "'Nunito', sans-serif" }}
              >
                <div style={{ width: 22, height: 22, borderRadius: 6, background: aktif ? "rgba(188,45,13,0.1)" : "var(--color-background-secondary)" }} />
                <span style={{ fontSize: 9, color: aktif ? "#bc2d0d" : "#737373" }}>{item.label}</span>
                {item.badge > 0 && (
                  <span style={{ position: "absolute", top: -2, right: -2, background: "#bc2d0d", color: "white", borderRadius: "50%", width: 14, height: 14, fontSize: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>{item.badge}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}