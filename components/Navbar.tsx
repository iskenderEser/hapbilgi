"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { URETICI_ROLLER, CCLIGI_GORENLERLER, STORE_ALABILEN_ROLLER, STORE_GENEL_GOREN_ROLLER, URETIM_HATTI_GORENLER, ECLUB_GOREN_ROLLER, ECLUB_LIGI_GOREN_ROLLER, ECLUB_STORE_RAPOR_GOREN_ROLLER, YAYINDAKI_VIDEO_GORENLER } from "@/lib/utils/roller";

interface NavbarProps {
  email: string;
  rol: string;
  adSoyad?: string;
  kimlikTuru?: string;
  onCikis: () => void;
}

export default function Navbar({ email, rol, adSoyad, kimlikTuru, onCikis }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [badge, setBadge] = useState<Record<string, number>>({});
  // Yayın Yönetimi rozeti: bildirim değil, canlı "yayına alınmayı bekleyen" sayısı.
  // (Kuyruk ortaktır — herhangi bir üretici yayınlayabilir; bildirim tek kişiye
  // giderdi ve okununca düşerdi, kuyruk gerçeğini göstermezdi.)
  const [yayinBekleyen, setYayinBekleyen] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  const [kullaniciAd, setKullaniciAd] = useState<string>(adSoyad ?? "");
  const [menuAcik, setMenuAcik] = useState(false);
  const [storeAcik, setStoreAcik] = useState(false);
  const [ccAcik, setCcAcik] = useState(false);
  const [eclubAcik, setEclubAcik] = useState(false);
  const [eclubStoreAcik, setEclubStoreAcik] = useState(false);
  const [eczanemAcik, setEczanemAcik] = useState(false);

  const isAktif = (path: string) => pathname.startsWith(path);

  const yonlendiriciRoller = ["bm"];
  const tuketiciRoller = ["utt", "kd_utt"];
  const analizRoller = ["bm", "tm", "pm", "jr_pm", "kd_pm", "gm", "gm_yrd", "drk", "paz_md", "blm_md", "med_md", "grp_pm", "sm", "egt_md", "egt_yrd_md", "egt_yon", "egt_uz"];

  const rolKucu = rol.toLowerCase();
  const isUretici = URETICI_ROLLER.includes(rolKucu);
  const isIU = rolKucu === "iu";
  const uretimHattiGorur = URETIM_HATTI_GORENLER.includes(rol);

  useEffect(() => {
    // Firma HBStore + Challenge Club + E-Club durumunu (ve gerekirse ad-soyad'ı) profil API'den al.
    fetch("/profil/api")
      .then(res => res.json())
      .then(data => {
        if (data.profil) {
          setStoreAcik(data.profil.hbstore_aktif === true);
          setCcAcik(data.profil.cc_aktif === true);
          setEclubAcik(data.profil.eclub_aktif === true);
          setEclubStoreAcik(data.profil.eclub_store_aktif === true);
          setEczanemAcik(data.profil.eczanem_aktif === true);
          if (!adSoyad) setKullaniciAd(`${data.profil.ad} ${data.profil.soyad}`);
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

    // Yayın Yönetimi rozeti — yalnız üretici roller (API de aynı rolleri şart koşar).
    if (isUretici) {
      try {
        const res = await fetch("/yayin-yonetimi/api/bekleyenler?sayi=1");
        if (!res.ok) return;
        const data = await res.json();
        setYayinBekleyen(data.sayi ?? 0);
      } catch {}
    }
  };

  useEffect(() => {
    if (!rol) return;
    badgelariCek();
    const interval = setInterval(badgelariCek, 30000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        badgelariCek();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [pathname, rol]);

  useEffect(() => {
    if (!menuAcik) return;
    const kapat = () => setMenuAcik(false);
    document.addEventListener("click", kapat);
    return () => document.removeEventListener("click", kapat);
  }, [menuAcik]);

  const raporaGit = () => {
    if (isIU) return;
    if (tuketiciRoller.includes(rolKucu)) router.push("/raporlar/utt");
    else if (rolKucu === "bm") router.push("/raporlar/bm");
    else if (rolKucu === "tm") router.push("/raporlar/tm");
    else if (isUretici) router.push("/raporlar/uretici");
    else router.push("/raporlar/yonetici");
  };

  const pillClass = (key: string, path: string, mavi?: boolean) => {
    const aktif = isAktif(path)
      || (key === "raporlar" && pathname.startsWith("/raporlar"))
      || (key === "analiz" && pathname.startsWith("/analiz"))
      || (key === "challenge-club" && pathname.startsWith("/challenge-club"));
    const base = "relative inline-flex items-center justify-center px-3 md:px-4 py-1 rounded-full border-none cursor-pointer text-xs md:text-sm font-medium transition-all duration-200 whitespace-nowrap";
    return `${base} ${aktif ? "font-semibold" : ""}`;
  };

  // F-11 (docs/test_pm_iu_21072026.md): rozet taşıyan iş pillerinde renk "sıradaki iş
  // bende mi"yi gösterir — iş varsa bordo, yoksa nötr (aktif sayfa kalın yazıyla
  // belli olur). isli verilmeyen piller eski davranışta kalır (aktif → bordo).
  const pillStyle = (key: string, path: string, mavi?: boolean, isli?: boolean): React.CSSProperties => {
    const aktif = isAktif(path)
      || (key === "raporlar" && pathname.startsWith("/raporlar"))
      || (key === "analiz" && pathname.startsWith("/analiz"))
      || (key === "challenge-club" && pathname.startsWith("/challenge-club"));
    const isHover = hover === key;

    if (mavi) {
      return {
        color: "#56aeff",
        background: aktif ? "rgba(86,174,255,0.12)" : isHover ? "rgba(86,174,255,0.08)" : "rgba(86,174,255,0.05)",
        boxShadow: "inset 0 0 0 0.5px rgba(86,174,255,0.35)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        fontFamily: "'Nunito', sans-serif",
      };
    }

    if (isli !== undefined) {
      return {
        color: isli ? "#bc2d0d" : "#374151",
        background: isli ? "rgba(188,45,13,0.08)" : aktif ? "rgba(0,0,0,0.07)" : isHover ? "rgba(0,0,0,0.06)" : "rgba(0,0,0,0.04)",
        boxShadow: isli ? "inset 0 0 0 0.5px rgba(188,45,13,0.25)" : "inset 0 0 0 0.5px rgba(0,0,0,0.08)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        fontFamily: "'Nunito', sans-serif",
      };
    }

    return {
      color: aktif ? "#bc2d0d" : "#374151",
      background: aktif ? "rgba(188,45,13,0.08)" : isHover ? "rgba(188,45,13,0.06)" : "rgba(0,0,0,0.04)",
      boxShadow: aktif ? "inset 0 0 0 0.5px rgba(188,45,13,0.25)" : "inset 0 0 0 0.5px rgba(0,0,0,0.08)",
      backdropFilter: "blur(8px)",
      WebkitBackdropFilter: "blur(8px)",
      fontFamily: "'Nunito', sans-serif",
    };
  };

  const Badge = ({ sayi }: { sayi: number }) => {
    if (!sayi || sayi === 0) return null;
    return (
      <span
        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-white flex items-center justify-center pointer-events-none"
        style={{ background: "#bc2d0d", fontSize: "10px", fontWeight: 700, lineHeight: 1, boxShadow: "0 0 0 2px white" }}
      >
        {sayi > 99 ? "99+" : sayi}
      </span>
    );
  };

  const MenuItem = ({ label, path, onClick, mavi, badgeSayi }: {
    label: string; path?: string; onClick?: () => void; mavi?: boolean; badgeSayi?: number;
  }) => {
    const aktif = path ? isAktif(path) : false;
    return (
      <div
        onClick={(e) => { e.stopPropagation(); onClick ? onClick() : path && router.push(path); setMenuAcik(false); }}
        className="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm"
        style={{
          fontFamily: "'Nunito', sans-serif",
          background: aktif ? "rgba(188,45,13,0.08)" : "transparent",
          color: mavi ? "#56aeff" : aktif ? "#bc2d0d" : "#374151",
        }}
      >
        {label}
        {badgeSayi ? (
          <span className="w-4 h-4 rounded-full text-white flex items-center justify-center text-xs" style={{ background: "#bc2d0d" }}>
            {badgeSayi}
          </span>
        ) : null}
      </div>
    );
  };

  return (
    <>
      <nav
        className="sticky top-0 z-50 border-b border-gray-200 px-3 py-2 md:px-6 md:py-2.5"
        style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderBottomColor: "#e5e7eb" }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
            <img
              src="/logo.png"
              alt="hapbilgi"
              className="h-10 md:h-14 lg:h-20 cursor-pointer mr-2 flex-shrink-0"
              onClick={() => router.push("/")}
            />
            <div className="hidden md:flex items-center gap-1.5 flex-wrap">
              <button onClick={() => router.push("/ana-sayfa")} onMouseEnter={() => setHover("ana-sayfa")} onMouseLeave={() => setHover(null)} className={pillClass("ana-sayfa", "/ana-sayfa")} style={pillStyle("ana-sayfa", "/ana-sayfa")}>Ana Sayfa</button>

              {YAYINDAKI_VIDEO_GORENLER.includes(rolKucu) && (
                <button onClick={() => router.push("/yayindaki-videolar")} onMouseEnter={() => setHover("yayindaki-videolar")} onMouseLeave={() => setHover(null)} className={pillClass("yayindaki-videolar", "/yayindaki-videolar")} style={pillStyle("yayindaki-videolar", "/yayindaki-videolar")}>
                  Yayındaki Videolar
                </button>
              )}

              {uretimHattiGorur && (
                <>
                  <button onClick={() => router.push("/talepler")} onMouseEnter={() => setHover("talepler")} onMouseLeave={() => setHover(null)} className={pillClass("talepler", "/talepler")} style={pillStyle("talepler", "/talepler", false, (badge["talep"] ?? 0) > 0)}>
                    Talepler<Badge sayi={badge["talep"] ?? 0} />
                  </button>
                  <button onClick={() => router.push("/senaryolar")} onMouseEnter={() => setHover("senaryolar")} onMouseLeave={() => setHover(null)} className={pillClass("senaryolar", "/senaryolar")} style={pillStyle("senaryolar", "/senaryolar", false, (badge["senaryo"] ?? 0) > 0)}>
                    Senaryolar<Badge sayi={badge["senaryo"] ?? 0} />
                  </button>
                  <button onClick={() => router.push("/videolar")} onMouseEnter={() => setHover("videolar")} onMouseLeave={() => setHover(null)} className={pillClass("videolar", "/videolar")} style={pillStyle("videolar", "/videolar", false, (badge["video"] ?? 0) > 0)}>
                    Videolar<Badge sayi={badge["video"] ?? 0} />
                  </button>
                  <button onClick={() => router.push("/soru-setleri")} onMouseEnter={() => setHover("soru-setleri")} onMouseLeave={() => setHover(null)} className={pillClass("soru-setleri", "/soru-setleri")} style={pillStyle("soru-setleri", "/soru-setleri", false, (badge["soru_seti"] ?? 0) > 0)}>
                    Soru Setleri<Badge sayi={badge["soru_seti"] ?? 0} />
                  </button>
                </>
              )}

              {/* F-12: IU'nun onaylanmış işleri tek sayfada, salt-okuma */}
              {isIU && (
                <button onClick={() => router.push("/onaylanan-talepler")} onMouseEnter={() => setHover("onaylanan-talepler")} onMouseLeave={() => setHover(null)} className={pillClass("onaylanan-talepler", "/onaylanan-talepler")} style={pillStyle("onaylanan-talepler", "/onaylanan-talepler")}>
                  Onaylanan Talepler
                </button>
              )}

              {isUretici && (
                <button onClick={() => router.push("/yayin-yonetimi")} onMouseEnter={() => setHover("yayin-yonetimi")} onMouseLeave={() => setHover(null)} className={pillClass("yayin-yonetimi", "/yayin-yonetimi")} style={pillStyle("yayin-yonetimi", "/yayin-yonetimi", false, yayinBekleyen > 0)}>
                  Yayın Yönetimi<Badge sayi={yayinBekleyen} />
                </button>
              )}

              {yonlendiriciRoller.includes(rolKucu) && (
                <button onClick={() => router.push("/oneriler")} onMouseEnter={() => setHover("oneriler")} onMouseLeave={() => setHover(null)} className={pillClass("oneriler", "/oneriler")} style={pillStyle("oneriler", "/oneriler")}>Öneriler</button>
              )}

              {tuketiciRoller.includes(rolKucu) && (
                <button onClick={() => router.push("/oneriler")} onMouseEnter={() => setHover("oneriler-utt")} onMouseLeave={() => setHover(null)} className={pillClass("oneriler-utt", "/oneriler")} style={pillStyle("oneriler-utt", "/oneriler", false, (badge["oneri"] ?? 0) > 0)}>
                  Öneriler<Badge sayi={badge["oneri"] ?? 0} />
                </button>
              )}

              {!isIU && (
                <button onClick={raporaGit} onMouseEnter={() => setHover("raporlar")} onMouseLeave={() => setHover(null)} className={pillClass("raporlar", "/raporlar")} style={pillStyle("raporlar", "/raporlar")}>Raporlar</button>
              )}

              {analizRoller.includes(rolKucu) && (
                <button onClick={() => router.push("/analiz")} onMouseEnter={() => setHover("analiz")} onMouseLeave={() => setHover(null)} className={pillClass("analiz", "/analiz")} style={pillStyle("analiz", "/analiz")}>Analiz</button>
              )}

              <button onClick={() => router.push("/hbligi")} onMouseEnter={() => setHover("hbligi")} onMouseLeave={() => setHover(null)} className={pillClass("hbligi", "/hbligi")} style={pillStyle("hbligi", "/hbligi")}>HBLigi</button>

              {eclubAcik && ECLUB_GOREN_ROLLER.includes(rolKucu) && (
                <button onClick={() => router.push("/eclub/listem")} onMouseEnter={() => setHover("eclub")} onMouseLeave={() => setHover(null)} className={pillClass("eclub", "/eclub/listem")} style={pillStyle("eclub", "/eclub/listem")}>E-Club</button>
              )}

              {eczanemAcik && tuketiciRoller.includes(rolKucu) && (
                <button onClick={() => router.push("/eczanem/utt")} onMouseEnter={() => setHover("eczanem-utt")} onMouseLeave={() => setHover(null)} className={pillClass("eczanem-utt", "/eczanem/utt")} style={pillStyle("eczanem-utt", "/eczanem/utt")}>Eczanem</button>
              )}

              {eclubAcik && ECLUB_LIGI_GOREN_ROLLER.includes(rolKucu) && (
                <button onClick={() => router.push("/eclub/ligi")} onMouseEnter={() => setHover("eclub-ligi")} onMouseLeave={() => setHover(null)} className={pillClass("eclub-ligi", "/eclub/ligi")} style={pillStyle("eclub-ligi", "/eclub/ligi")}>E-Club Ligi</button>
              )}

              {eclubStoreAcik && ECLUB_STORE_RAPOR_GOREN_ROLLER.includes(rolKucu) && (
                <button onClick={() => router.push("/eclub/store/rapor")} onMouseEnter={() => setHover("eclub-store")} onMouseLeave={() => setHover(null)} className={pillClass("eclub-store", "/eclub/store/rapor")} style={pillStyle("eclub-store", "/eclub/store/rapor")}>E-Club Store</button>
              )}

              {kimlikTuru === "eclub_kisi" && (
                <button onClick={() => router.push("/eclub/store")} onMouseEnter={() => setHover("eclub-store-kisi")} onMouseLeave={() => setHover(null)} className={pillClass("eclub-store-kisi", "/eclub/store")} style={pillStyle("eclub-store-kisi", "/eclub/store")}>E-Club Store</button>
              )}

              {ccAcik && CCLIGI_GORENLERLER.includes(rolKucu) && (
                <button onClick={() => router.push("/cc-ligi")} onMouseEnter={() => setHover("cc-ligi")} onMouseLeave={() => setHover(null)} className={pillClass("cc-ligi", "/cc-ligi")} style={pillStyle("cc-ligi", "/cc-ligi")}>CC Ligi</button>
              )}

              {storeAcik && STORE_ALABILEN_ROLLER.includes(rolKucu) && (
                <button onClick={() => router.push("/store")} onMouseEnter={() => setHover("store")} onMouseLeave={() => setHover(null)} className={pillClass("store", "/store")} style={pillStyle("store", "/store")}>HBStore</button>
              )}
              {storeAcik && STORE_GENEL_GOREN_ROLLER.includes(rolKucu) && rolKucu !== "bm" && (
                <button onClick={() => router.push("/store/siparisler")} onMouseEnter={() => setHover("store-siparisler")} onMouseLeave={() => setHover(null)} className={pillClass("store-siparisler", "/store/siparisler")} style={pillStyle("store-siparisler", "/store/siparisler")}>HBStore Siparişleri</button>
              )}

              {ccAcik && rolKucu === "bm" && (
                <>
                  <div className="w-px h-5 bg-gray-200 mx-1 flex-shrink-0" />
                  <button onClick={() => router.push("/challenge-club")} onMouseEnter={() => setHover("challenge-club")} onMouseLeave={() => setHover(null)} className={pillClass("challenge-club", "/challenge-club", true)} style={pillStyle("challenge-club", "/challenge-club", true)}>Challenge Club</button>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
            <div className="hidden md:flex items-center gap-3">
              {kullaniciAd && <span className="text-xs font-semibold text-gray-700">{kullaniciAd}</span>}
              <div
                onClick={() => router.push("/profil")}
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-gray-200 cursor-pointer"
                style={{ background: "#56aeff" }}
              >
                {kullaniciAd ? `${kullaniciAd.split(" ")[0]?.[0] ?? ""}${kullaniciAd.split(" ")[1]?.[0] ?? ""}` : email?.[0]?.toUpperCase()}
              </div>
              <button
                onClick={onCikis}
                onMouseEnter={() => setHover("cikis")}
                onMouseLeave={() => setHover(null)}
                className={`${pillClass("cikis", "/__never__")} flex items-center gap-1.5`}
                style={pillStyle("cikis", "/__never__")}
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Çıkış
              </button>
            </div>

            <div className="flex md:hidden items-center gap-2">
              <div
                onClick={() => router.push("/profil")}
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white cursor-pointer"
                style={{ background: "#56aeff" }}
              >
                {kullaniciAd ? `${kullaniciAd.split(" ")[0]?.[0] ?? ""}${kullaniciAd.split(" ")[1]?.[0] ?? ""}` : email?.[0]?.toUpperCase()}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setMenuAcik(prev => !prev); }}
                className="flex flex-col gap-1 p-1 bg-transparent border-none cursor-pointer"
              >
                <span className="block w-4 bg-gray-700" style={{ height: "1.5px" }} />
                <span className="block w-4 bg-gray-700" style={{ height: "1.5px" }} />
                <span className="block w-4 bg-gray-700" style={{ height: "1.5px" }} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {menuAcik && (
        <div
          onClick={e => e.stopPropagation()}
          className="fixed top-14 left-0 right-0 z-40 px-3 py-2 md:hidden"
          style={{ background: "rgba(255,255,255,0.97)", backdropFilter: "blur(12px)", borderBottom: "0.5px solid #e5e7eb", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
        >
          <MenuItem label="Ana Sayfa" path="/ana-sayfa" />

          {uretimHattiGorur && (
            <>
              <MenuItem label="Talepler" path="/talepler" badgeSayi={badge["talep"]} />
              <MenuItem label="Senaryolar" path="/senaryolar" badgeSayi={badge["senaryo"]} />
              <MenuItem label="Videolar" path="/videolar" badgeSayi={badge["video"]} />
              <MenuItem label="Soru Setleri" path="/soru-setleri" badgeSayi={badge["soru_seti"]} />
            </>
          )}

          {isIU && <MenuItem label="Onaylanan Talepler" path="/onaylanan-talepler" />}
          {isUretici && <MenuItem label="Yayın Yönetimi" path="/yayin-yonetimi" badgeSayi={yayinBekleyen} />}
          {yonlendiriciRoller.includes(rolKucu) && <MenuItem label="Öneriler" path="/oneriler" />}

          {tuketiciRoller.includes(rolKucu) && (
            <MenuItem label="Öneriler" path="/oneriler" badgeSayi={badge["oneri"]} />
          )}

          {!isIU && <MenuItem label="Raporlar" onClick={raporaGit} />}
          {analizRoller.includes(rolKucu) && <MenuItem label="Analiz" path="/analiz" />}
          <MenuItem label="HBLigi" path="/hbligi" />
          {eclubAcik && ECLUB_GOREN_ROLLER.includes(rolKucu) && <MenuItem label="E-Club" path="/eclub/listem" />}
          {eclubAcik && ECLUB_LIGI_GOREN_ROLLER.includes(rolKucu) && <MenuItem label="E-Club Ligi" path="/eclub/ligi" />}
          {eclubStoreAcik && ECLUB_STORE_RAPOR_GOREN_ROLLER.includes(rolKucu) && <MenuItem label="E-Club Store" path="/eclub/store/rapor" />}
          {kimlikTuru === "eclub_kisi" && <MenuItem label="E-Club Store" path="/eclub/store" />}
          {ccAcik && CCLIGI_GORENLERLER.includes(rolKucu) && <MenuItem label="CC Ligi" path="/cc-ligi" />}
          {storeAcik && STORE_ALABILEN_ROLLER.includes(rolKucu) && <MenuItem label="HBStore" path="/store" />}
          {storeAcik && STORE_GENEL_GOREN_ROLLER.includes(rolKucu) && rolKucu !== "bm" && <MenuItem label="HBStore Siparişleri" path="/store/siparisler" />}

          {ccAcik && rolKucu === "bm" && (
            <>
              <div className="h-px bg-gray-100 my-1.5" />
              <MenuItem label="Challenge Club" path="/challenge-club" mavi />
            </>
          )}

          <div className="h-px bg-gray-100 my-1.5" />
          <MenuItem label="Çıkış" onClick={onCikis} />
        </div>
      )}

      {tuketiciRoller.includes(rolKucu) && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 flex justify-around pb-3 pt-2 md:hidden"
          style={{ background: "rgba(255,255,255,0.95)", backdropFilter: "blur(12px)", borderTop: "0.5px solid #e5e7eb" }}
        >
          {[
            { label: "Ana", path: "/ana-sayfa", badge: 0 },
            { label: "Öneri", path: "/oneriler", badge: badge["oneri"] ?? 0 },
            { label: "Profil", path: "/profil", badge: 0 },
          ].map(item => {
            const aktif = pathname.startsWith(item.path);
            return (
              <button
                key={item.path}
                onClick={() => router.push(item.path)}
                className="relative flex flex-col items-center gap-0.5 bg-transparent border-none cursor-pointer"
                style={{ fontFamily: "'Nunito', sans-serif" }}
              >
                <div
                  className="w-6 h-6 rounded-md"
                  style={{ background: aktif ? "rgba(188,45,13,0.1)" : "#f3f4f6" }}
                />
                <span className="text-xs" style={{ fontSize: "9px", color: aktif ? "#bc2d0d" : "#737373" }}>{item.label}</span>
                {item.badge > 0 && (
                  <span
                    className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full text-white flex items-center justify-center"
                    style={{ background: "#bc2d0d", fontSize: "8px" }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}