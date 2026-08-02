// components/panel/PanelNavbar.tsx
//
// Panel üst barı — Faz 1 / Adım 1.2 (docs/ana_sayfa_kabuk_donusum_is_plani.md).
//
// Tüm rollerde AYNI ve sabit: 5 bilgi amaçlı (fonksiyonel olmayan) pill + sağ blok
// (ad-soyad + avatar→/profil + Çıkış). Fonksiyonel piller burada YOK — onlar sol
// listeye (Adım 1.3) taşınır. Pill görünümü eski components/Navbar.tsx'ten alındı (Faz 3'te silindi)
// (tutarlılık). Bu bileşen bu adımda hiçbir sayfaya bağlanmaz (bağlama: layout, 1.5).

"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";

interface PanelNavbarProps {
  adSoyad?: string;
  email?: string;
  onCikis: () => void;
  onHamburger?: () => void; // mobilde sol drawer'ı açar (Adım 1.5)
}

// 5 bilgi pill'i — sabit sıra, rolden bağımsız.
const BILGI_PILLERI: { key: string; etiket: string; path: string }[] = [
  { key: "ana-sayfa", etiket: "Ana Sayfa", path: "/ana-sayfa" },
  { key: "hapbilgi-nedir", etiket: "HapBilgi Nedir", path: "/hapbilgi-nedir" },
  { key: "nasil-calisir", etiket: "Nasıl Çalışır", path: "/nasil-calisir" },
  { key: "sozlesmeler", etiket: "Sözleşmeler", path: "/sozlesmeler" },
  { key: "iletisim", etiket: "İletişim", path: "/iletisim" },
];

export default function PanelNavbar({ adSoyad, email, onCikis, onHamburger }: PanelNavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [hover, setHover] = useState<string | null>(null);

  const isAktif = (path: string) => pathname.startsWith(path);

  // Pill görünümü — mevcut Navbar'ın varsayılan (mavi/işli olmayan) pill'iyle birebir.
  const pillClass = (aktif: boolean) =>
    `relative inline-flex items-center justify-center px-3 md:px-4 py-1 rounded-full border-none cursor-pointer text-xs md:text-sm font-medium transition-all duration-200 whitespace-nowrap ${aktif ? "font-semibold" : ""}`;

  const pillStyle = (key: string, aktif: boolean): React.CSSProperties => {
    const isHover = hover === key;
    return {
      color: aktif ? "#185fa5" : "#374151",
      background: aktif ? "rgba(86,174,255,0.12)" : isHover ? "rgba(0,0,0,0.06)" : "rgba(0,0,0,0.04)",
      boxShadow: aktif ? "inset 0 0 0 1.5px #56aeff" : "inset 0 0 0 0.5px rgba(0,0,0,0.08)",
      backdropFilter: "blur(8px)",
      WebkitBackdropFilter: "blur(8px)",
      fontFamily: "'Nunito', sans-serif",
    };
  };

  const bashHarfler = adSoyad
    ? `${adSoyad.split(" ")[0]?.[0] ?? ""}${adSoyad.split(" ")[1]?.[0] ?? ""}`
    : email?.[0]?.toUpperCase();

  return (
    <nav
      className="sticky top-0 z-50 border-b border-gray-200 px-3 py-2 md:px-6 md:py-2.5"
      style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderBottomColor: "#e5e7eb" }}
    >
      <div className="relative flex items-center justify-between gap-4">
        <img
          src="/logo.png"
          alt="hapbilgi"
          className="h-10 md:h-14 lg:h-20 cursor-pointer flex-shrink-0"
          onClick={() => router.push("/")}
        />
        <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center gap-1.5">
          {BILGI_PILLERI.map((p) => (
            <button
              key={p.key}
              onClick={() => router.push(p.path)}
              onMouseEnter={() => setHover(p.key)}
              onMouseLeave={() => setHover(null)}
              className={pillClass(isAktif(p.path))}
              style={pillStyle(p.key, isAktif(p.path))}
            >
              {p.etiket}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
          <div className="hidden md:flex items-center gap-3">
            {adSoyad && <span className="text-xs font-semibold text-gray-700">{adSoyad}</span>}
            <div
              onClick={() => router.push("/profil")}
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-gray-200 cursor-pointer"
              style={{ background: "#56aeff" }}
            >
              {bashHarfler}
            </div>
            <button
              onClick={onCikis}
              onMouseEnter={() => setHover("cikis")}
              onMouseLeave={() => setHover(null)}
              className={`${pillClass(false)} flex items-center gap-1.5`}
              style={pillStyle("cikis", false)}
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Çıkış
            </button>
          </div>

          {/* Mobil: avatar + hamburger (sol drawer'ı açar — Adım 1.5). */}
          <div className="flex md:hidden items-center gap-2">
            <div
              onClick={() => router.push("/profil")}
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white cursor-pointer"
              style={{ background: "#56aeff" }}
            >
              {bashHarfler}
            </div>
            <button
              onClick={onHamburger}
              aria-label="Menü"
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
  );
}
