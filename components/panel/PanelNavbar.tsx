// components/panel/PanelNavbar.tsx
//
// Panel üst barı. Sol: logo. Orta: bilgi pill'leri + (UTT/KD_UTT'de) dikey çizgi
// ardından kişisel özet pill'leri (Takım Sırası · Haftalık Puan · Sipariş Puanı).
// Sağ: ad-soyad (bordo) + avatar; Çıkış adın altında. Fonksiyonel gezinme sol listede.

"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";

const BORDO = "#bc2d0d";

// Özet pill'i — gri zemin, siyah yazı, etiket üstte / değer altta.
function OzetPill({ etiket, deger }: { etiket: string; deger: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-full leading-tight"
      style={{ background: "rgba(0,0,0,0.04)", boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.08)", padding: "5px 16px", fontFamily: "'Nunito', sans-serif" }}
    >
      <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{etiket}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>{deger}</span>
    </div>
  );
}

interface PanelNavbarProps {
  adSoyad?: string;
  email?: string;
  // Kişisel özet — yalnız UTT/KD_UTT (BM sonraya). Verilmezse özet pill'leri çizilmez.
  ozet?: { haftalikPuan: number; takimSirasi: number | null; siparisPuani: number } | null;
  // Sipariş Puanı pill'i yalnız kullanıcının firmasında HBStore aktifse görünür.
  siparisPuaniGoster?: boolean;
  // Dış müşteri ana sayfası /eclub/panel'dir; iç kullanıcıda varsayılan korunur.
  anaSayfaYolu?: string;
  eclubStorePuani?: number | null;
  onCikis: () => void;
  onHamburger?: () => void; // mobilde sol drawer'ı açar
}

// Bilgi pill'leri — sabit sıra, rolden bağımsız.
const BILGI_PILLERI: { key: string; etiket: string; path: string }[] = [
  { key: "ana-sayfa", etiket: "Ana Sayfa", path: "/ana-sayfa" },
  { key: "hapbilgi-nedir", etiket: "HapBilgi Nedir", path: "/hapbilgi-nedir" },
  { key: "nasil-calisir", etiket: "Nasıl Çalışır", path: "/nasil-calisir" },
];

export default function PanelNavbar({ adSoyad, email, ozet, siparisPuaniGoster, anaSayfaYolu = "/ana-sayfa", eclubStorePuani, onCikis, onHamburger }: PanelNavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [hover, setHover] = useState<string | null>(null);

  const isAktif = (path: string) => pathname === path;

  const pillClass = (aktif: boolean) =>
    `relative inline-flex items-center justify-center px-3 md:px-4 py-1 rounded-full border-none cursor-pointer text-xs md:text-sm font-medium transition-all duration-200 whitespace-nowrap ${aktif ? "font-semibold" : ""}`;

  const pillStyle = (key: string, aktif: boolean): React.CSSProperties => {
    const isHover = hover === key;
    return {
      color: aktif ? BORDO : "#374151",
      background: aktif ? "#fef2f2" : isHover ? "rgba(188,45,13,0.07)" : "rgba(0,0,0,0.04)",
      boxShadow: aktif ? "inset 0 0 0 1px #fecaca" : "inset 0 0 0 0.5px rgba(0,0,0,0.08)",
      fontFamily: "'Nunito', sans-serif",
    };
  };

  const bashHarfler = adSoyad
    ? `${adSoyad.split(" ")[0]?.[0] ?? ""}${adSoyad.split(" ")[1]?.[0] ?? ""}`
    : email?.[0]?.toUpperCase();

  return (
    <nav
      className="sticky top-0 z-50 border-b border-gray-200 px-3 py-3 md:px-6 md:py-3.5 min-h-[76px] flex flex-col justify-center"
      style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderBottomColor: "#e5e7eb" }}
    >
      <div className="flex items-center justify-between gap-4">
        {/* Sol Kolon: Logo (Hapbi maskot ebatlarıyla tam uyumlu 3D yatay logo) */}
        <div
          onClick={() => router.push(anaSayfaYolu)}
          className="flex items-center md:w-[216px] flex-shrink-0 cursor-pointer group select-none"
        >
          <img
            src="/hapbilgi-yatay-gri-bordo.png"
            alt="hapbilgi"
            className="h-12 md:h-14 lg:h-[62px] w-auto aspect-[901/340] object-cover transition-transform duration-200 group-hover:scale-105 drop-shadow-sm"
          />
        </div>

        {/* Orta-Sol: Bilgi Pill'leri (Sidebar sınırından hemen sonra başlar) */}
        <div className="hidden md:flex items-center gap-2 flex-1 min-w-0 pl-1">
          {BILGI_PILLERI.map((p) => (
            <button
              key={p.key}
              onClick={() => router.push(p.key === "ana-sayfa" ? anaSayfaYolu : p.path)}
              onMouseEnter={() => setHover(p.key)}
              onMouseLeave={() => setHover(null)}
              className={pillClass(isAktif(p.key === "ana-sayfa" ? anaSayfaYolu : p.path))}
              style={pillStyle(p.key, isAktif(p.key === "ana-sayfa" ? anaSayfaYolu : p.path))}
            >
              {p.etiket}
            </button>
          ))}
        </div>

        {/* Sağ Kolon: Puan/Sıra Pill'leri + Kullanıcı Profili (Dengeli ferah mesafe) */}
        <div className="hidden md:flex items-center gap-10 lg:gap-14 flex-shrink-0" style={{ marginRight: 48 }}>
          {ozet && (
            <div className="flex items-center gap-2">
              <OzetPill etiket="Takım Sırası" deger={ozet.takimSirasi ? `${ozet.takimSirasi}` : "-"} />
              <OzetPill etiket="Haftalık Puan" deger={ozet.haftalikPuan.toLocaleString("tr-TR")} />
              {siparisPuaniGoster && (
                <OzetPill etiket="Sipariş Puanı" deger={ozet.siparisPuani.toLocaleString("tr-TR")} />
              )}
            </div>
          )}
          {eclubStorePuani !== null && eclubStorePuani !== undefined && (
            <div className="flex items-center gap-2">
              <OzetPill etiket="Store Puanı" deger={eclubStorePuani.toLocaleString("tr-TR")} />
            </div>
          )}

          {/* Kullanıcı Adı + Avatar + Çıkış */}
          <div className="flex flex-col items-end gap-0.5">
            <div className="flex items-center gap-2.5">
              {adSoyad && <span className="text-sm font-bold" style={{ color: "#374151" }}>{adSoyad}</span>}
              <div
                onClick={() => router.push("/profil")}
                className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer"
                style={{ background: "#d4d4d4", color: "#374151", border: "1px solid #c9c9c9" }}
              >
                {bashHarfler}
              </div>
            </div>
            <button
              onClick={onCikis}
              className="flex items-center gap-1 text-xs font-semibold cursor-pointer bg-transparent border-none"
              style={{ color: BORDO }}
            >
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Çıkış
            </button>
          </div>
        </div>

        {/* Mobil: avatar + hamburger (sol drawer'ı açar). */}
        <div className="flex md:hidden items-center gap-2">
          <div
            onClick={() => router.push("/profil")}
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer"
            style={{ background: "#d4d4d4", color: "#374151" }}
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
    </nav>
  );
}
