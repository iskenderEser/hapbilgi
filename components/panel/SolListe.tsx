// components/panel/SolListe.tsx
//
// Panel sol gezinme listesi — Faz 1 / Adım 1.3
// (docs/ana_sayfa_kabuk_donusum_is_plani.md).
//
// PANEL_NAV config'ini (Adım 1.1) okur; her grubun gate'i geçen öğelerini dikey
// liste olarak çizer. Ana görev = grup başlığı, altında alt görevler. Bir grup tek
// öğeye düşerse başlıksız tek satır olur. Aktif öğe pathname ile vurgulanır.
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
  yayinBekleyen: number;
  // Çizilecek ağaç — layout verir (eclub_kisi'de ECLUB_KISI_NAV). Varsayılan PANEL_NAV.
  gruplar?: NavGrup[];
};

export default function SolListe(props: SolListeProps) {
  const gruplar = props.gruplar ?? PANEL_NAV;
  const router = useRouter();
  const pathname = usePathname();
  const [hover, setHover] = useState<string | null>(null);

  const cozPath = (oge: NavOge) => (typeof oge.path === "function" ? oge.path(props) : oge.path);
  const rozetSayisi = (oge: NavOge) =>
    oge.yayinBekleyenRozeti ? props.yayinBekleyen : oge.badgeKey ? (props.badge[oge.badgeKey] ?? 0) : 0;

  const Satir = ({ oge }: { oge: NavOge }) => {
    const path = cozPath(oge);
    const aktif = pathname.startsWith(path);
    const isHover = hover === oge.etiket;
    const sayi = rozetSayisi(oge);
    return (
      <button
        onClick={() => router.push(path)}
        onMouseEnter={() => setHover(oge.etiket)}
        onMouseLeave={() => setHover(null)}
        className="relative w-full flex items-center justify-between rounded-lg cursor-pointer border-none text-left transition-all duration-200"
        style={{
          padding: "7px 10px",
          fontSize: "13px",
          fontWeight: aktif ? 700 : 500,
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

  return (
    <aside
      className="hidden md:block flex-shrink-0"
      style={{ width: "220px", borderRight: "0.5px solid #e5e7eb", padding: "16px 12px", background: "#ffffff" }}
    >
      <div className="flex flex-col gap-4">
        {gruplar.map((grup) => {
          const gorunur = grup.oglar.filter((o) => o.gate(props));
          if (gorunur.length === 0) return null;

          // Tek öğeye düşen grup → başlıksız tek satır.
          if (gorunur.length === 1) {
            return <Satir key={grup.baslik} oge={gorunur[0]} />;
          }

          return (
            <div key={grup.baslik} className="flex flex-col gap-1">
              <span
                style={{ fontSize: "11px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.04em", padding: "0 10px 2px", fontFamily: "'Nunito', sans-serif" }}
              >
                {grup.baslik}
              </span>
              {gorunur.map((oge) => (
                <Satir key={oge.etiket} oge={oge} />
              ))}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
