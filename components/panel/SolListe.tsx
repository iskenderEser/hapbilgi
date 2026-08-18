// components/panel/SolListe.tsx
//
// Panel sol gezinme listesi — Faz 1 / Adım 1.3
// (docs/ana_sayfa_kabuk_donusum_is_plani.md).
//
// PANEL_NAV config'ini (Adım 1.1) okur; her grubun gate'i geçen öğelerini dikey
// liste olarak çizer. Ana görev = grup başlığı, altında alt görevler. PANEL_NAV'da
// grup başlığı görünür öğe sayısından bağımsızdır. Yalnız ayrı kimlik kabukları
// config üzerinden başlıksız çizim isteyebilir. Aktif öğe pathname ile vurgulanır.
//
// Rozetler (B kararı): burada çekilmez — layout tek sefer çeker, prop olarak verir
// (tek kaynak, mükerrer istek yok). MobilDrawer da aynı prop'ları alır.
//
// Girdi (NavContext) + rozet prop'ları layout'tan (Adım 1.5) gelir. Masaüstü içindir
// — mobil drawer Adım 1.4'te ayrı gelir.

"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { PANEL_NAV, type NavContext, type NavGrup, type NavOge } from "./panelNav.config";

type SolListeProps = NavContext & {
  badge: Record<string, number>;
  // Çizilecek ağaç — layout verir (eclub_kisi'de ECLUB_KISI_NAV). Varsayılan PANEL_NAV.
  gruplar?: NavGrup[];
};

export default function SolListe(props: SolListeProps) {
  const gruplar = props.gruplar ?? PANEL_NAV;
  const router = useRouter();
  const pathname = usePathname();
  const [hover, setHover] = useState<string | null>(null);
  const [kapaliGruplar, setKapaliGruplar] = useState<Set<string>>(new Set());
  const [acikAltOgeler, setAcikAltOgeler] = useState<Set<string>>(new Set());
  const grupToggle = (baslik: string) =>
    setKapaliGruplar((onceki) => {
      const yeni = new Set(onceki);
      if (yeni.has(baslik)) yeni.delete(baslik); else yeni.add(baslik);
      return yeni;
    });

  const cozPath = (oge: NavOge) => typeof oge.path === "function" ? oge.path(props) : (oge.path ?? "");
  const rozetSayisi = (oge: NavOge) => oge.badgeKey ? (props.badge[oge.badgeKey] ?? 0) : 0;

  const Satir = ({ oge, seviye = 0 }: { oge: NavOge; seviye?: number }) => {
    const path = cozPath(oge);
    const aktif = oge.tamEslesme ? pathname === path : pathname === path || pathname.startsWith(`${path}/`);
    const isHover = hover === oge.etiket;
    const sayi = rozetSayisi(oge);
    return (
      <button
        onClick={() => router.push(path)}
        onMouseEnter={() => setHover(oge.etiket)}
        onMouseLeave={() => setHover(null)}
        className="relative w-full flex items-center justify-between rounded-lg cursor-pointer border-none text-left transition-all duration-200"
        style={{
          padding: `7px 10px 7px ${10 + seviye * 8}px`,
          fontSize: "14px",
          fontWeight: aktif ? 700 : 600,
          color: aktif ? "#185fa5" : "#374151",
          background: aktif ? "rgba(86,174,255,0.12)" : isHover ? "rgba(0,0,0,0.05)" : "transparent",
          boxShadow: aktif ? "inset 0 0 0 1px rgba(86,174,255,0.35)" : "none",
          fontFamily: "'Nunito', sans-serif",
        }}
      >
        <span>{oge.etiket}</span>
        {sayi > 0 && (
          <span
            className="flex items-center justify-center rounded-full text-white"
            style={{ minWidth: "18px", height: "18px", padding: "0 5px", background: "#bc2d0d", fontSize: "10px", fontWeight: 700, lineHeight: 1 }}
          >
            {sayi > 99 ? "99+" : sayi}
          </span>
        )}
      </button>
    );
  };

  const OgeBlogu = ({ oge, seviye = 0 }: { oge: NavOge; seviye?: number }) => {
    const altOglar = (oge.altOglar ?? []).filter((altOge) => altOge.gate(props));
    if (altOglar.length === 0) return <Satir oge={oge} seviye={seviye} />;
    const altAcik = acikAltOgeler.has(oge.etiket);
    const sayi = rozetSayisi(oge);
    return (
      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          onClick={() => setAcikAltOgeler((onceki) => {
            const yeni = new Set(onceki);
            if (yeni.has(oge.etiket)) yeni.delete(oge.etiket); else yeni.add(oge.etiket);
            return yeni;
          })}
          className="flex w-full cursor-pointer items-center justify-between border-none bg-transparent text-left"
          style={{ padding: `7px 10px 3px ${10 + seviye * 8}px`, fontSize: "14px", fontWeight: 700, color: "#374151", fontFamily: "'Nunito', sans-serif" }}
        >
          <span>{oge.etiket}</span>
          <span className="flex items-center gap-2">
            {sayi > 0 && (
              <span className="flex items-center justify-center rounded-full text-white" style={{ minWidth: "18px", height: "18px", padding: "0 5px", background: "#bc2d0d", fontSize: "10px", fontWeight: 700, lineHeight: 1 }}>
                {sayi > 99 ? "99+" : sayi}
              </span>
            )}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ transform: altAcik ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" /></svg>
          </span>
        </button>
        {altAcik && (
          <div className="flex flex-col gap-0.5">
            {altOglar.map((altOge) => <Satir key={altOge.etiket} oge={altOge} seviye={seviye + 1} />)}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      className="hidden md:block flex-shrink-0 overflow-y-auto"
      style={{ width: "240px", borderRight: "0.5px solid #e5e7eb", padding: "16px 12px", background: "#ffffff" }}
    >
      <div className="flex flex-col gap-4">
        {gruplar.map((grup) => {
          const gorunur = grup.oglar.filter((o) => o.gate(props));
          if (gorunur.length === 0) return null;

          // Ayrı kimlik kabukları başlığı bilinçli olarak gizleyebilir.
          if (grup.baslikGoster === false) {
            return (
              <div key={grup.baslik} className="flex flex-col gap-1">
                {gorunur.map((oge) => <OgeBlogu key={oge.etiket} oge={oge} />)}
              </div>
            );
          }

          const acik = !kapaliGruplar.has(grup.baslik);
          return (
            <div key={grup.baslik} className="flex flex-col gap-1">
              <button
                onClick={() => grupToggle(grup.baslik)}
                className="w-full flex items-center justify-between bg-transparent border-none cursor-pointer"
                style={{ fontSize: "12px", fontWeight: 800, color: "#111827", textTransform: "uppercase", letterSpacing: "0.06em", padding: "2px 10px 4px", fontFamily: "'Nunito', sans-serif" }}
              >
                <span>{grup.baslik}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth={2.5}
                  style={{ transform: acik ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {acik && gorunur.map((oge) => <OgeBlogu key={oge.etiket} oge={oge} seviye={1} />)}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
