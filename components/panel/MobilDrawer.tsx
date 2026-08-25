// components/panel/MobilDrawer.tsx
//
// Mobil gezinme çekmecesi — Faz 1 / Adım 1.4
// (docs/ana_sayfa_kabuk_donusum_is_plani.md).
//
// Hamburger → soldan açılan drawer. İçerik masaüstüyle AYNI kaynaklardan:
//   • üstte 5 bilgi pill'i (PanelNavbar ile aynı liste),
//   • altında sol liste ağacı (PANEL_NAV, grup→alt görev, aynı gate + rozet mantığı).
// Rozetler prop'tan gelir (B kararı — layout tek sefer çeker). Bir öğeye tıklanınca
// hedefe gidilir ve drawer kapanır.
//
// NOT: Eski tüketici (UTT) bottom-tab bar'ının son biçimi Faz 1 sonu görselle
// kararlaştırılacak; bu adımda drawer ana mobil gezinme olarak eklenir, bottom-tab'a
// dokunulmaz.
//
// Girdi (NavContext) + rozet prop'ları + açık/kapat layout'tan (Adım 1.5) gelir.

"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { PANEL_NAV, type NavContext, type NavGrup, type NavOge } from "./panelNav.config";

type MobilDrawerProps = NavContext & {
  acik: boolean;
  onKapat: () => void;
  onCikis: () => void;
  badge: Record<string, number>;
  anaSayfaYolu?: string;
  // Çizilecek ağaç — layout verir (eclub_kisi'de ECLUB_KISI_NAV). Varsayılan PANEL_NAV.
  gruplar?: NavGrup[];
};

// PanelNavbar ile birebir aynı bilgi pill'i listesi.
const BILGI_PILLERI: { etiket: string; path: string }[] = [
  { etiket: "Ana Sayfa", path: "/ana-sayfa" },
  { etiket: "HapBilgi Nedir", path: "/hapbilgi-nedir" },
  { etiket: "Nasıl Çalışır", path: "/nasil-calisir" },
];

export default function MobilDrawer(props: MobilDrawerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const gruplar = props.gruplar ?? PANEL_NAV;

  const cozPath = (oge: NavOge) => typeof oge.path === "function" ? oge.path(props) : (oge.path ?? "");
  const rozetSayisi = (oge: NavOge) => oge.badgeKey ? (props.badge[oge.badgeKey] ?? 0) : 0;

  const grupAktifMi = (grup: NavGrup) => {
    return grup.oglar.some((oge) => {
      if (!oge.gate(props)) return false;
      const p = cozPath(oge);
      if (p && (oge.tamEslesme ? pathname === p : pathname === p || pathname.startsWith(`${p}/`))) {
        return true;
      }
      if (oge.altOglar) {
        return oge.altOglar.some((alt) => {
          if (!alt.gate(props)) return false;
          const ap = cozPath(alt);
          return ap && (alt.tamEslesme ? pathname === ap : pathname.startsWith(ap));
        });
      }
      return false;
    });
  };

  const [kapaliGruplar, setKapaliGruplar] = useState<Set<string>>(() => {
    const gorunurGruplar = gruplar.filter((g) => g.oglar.some((o) => o.gate(props)));
    const kapali = new Set<string>();
    gorunurGruplar.forEach((g, index) => {
      if (index === 0) return; // İlk ana sekme açık başlar
      if (grupAktifMi(g)) return; // Aktif sayfanın grubu açık başlar
      kapali.add(g.baslik);
    });
    return kapali;
  });
  const [acikAltOgeler, setAcikAltOgeler] = useState<Set<string>>(new Set());

  const grupToggle = (baslik: string) =>
    setKapaliGruplar((onceki) => {
      const yeni = new Set(onceki);
      if (yeni.has(baslik)) yeni.delete(baslik); else yeni.add(baslik);
      return yeni;
    });

  if (!props.acik) return null;

  const git = (path: string) => { router.push(path); props.onKapat(); };
  const cikis = () => { props.onKapat(); props.onCikis(); };

  const Satir = ({ etiket, path, sayi, girintili = false, tamEslesme = false }: { etiket: string; path: string; sayi?: number; girintili?: boolean; tamEslesme?: boolean }) => {
    const aktif = tamEslesme ? pathname === path : pathname === path || pathname.startsWith(`${path}/`);
    return (
      <button
        onClick={() => git(path)}
        className="w-full flex items-center justify-between rounded-lg cursor-pointer border-none text-left"
        style={{
          padding: girintili ? "10px 12px 10px 20px" : "10px 12px",
          fontSize: "14px",
          fontWeight: aktif ? 700 : 600,
          color: aktif ? "#185fa5" : "#374151",
          background: aktif ? "rgba(86,174,255,0.12)" : "transparent",
          fontFamily: "'Nunito', sans-serif",
        }}
      >
        <span>{etiket}</span>
        {sayi && sayi > 0 ? (
          <span
            className="flex items-center justify-center rounded-full text-white"
            style={{ minWidth: "18px", height: "18px", padding: "0 5px", background: "#bc2d0d", fontSize: "10px", fontWeight: 700, lineHeight: 1 }}
          >
            {sayi > 99 ? "99+" : sayi}
          </span>
        ) : null}
      </button>
    );
  };

  const OgeBlogu = ({ oge, girintili = false }: { oge: NavOge; girintili?: boolean }) => {
    const altOglar = (oge.altOglar ?? []).filter((altOge) => altOge.gate(props));
    if (altOglar.length === 0) {
      return <Satir etiket={oge.etiket} path={cozPath(oge)} sayi={rozetSayisi(oge)} girintili={girintili} tamEslesme={oge.tamEslesme} />;
    }
    const altAktif = altOglar.some((alt) => {
      const p = cozPath(alt);
      return alt.tamEslesme ? pathname === p : pathname.startsWith(p);
    });
    const altAcik = acikAltOgeler.has(oge.etiket) || altAktif;
    const sayi = rozetSayisi(oge);
    return (
      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          onClick={() => setAcikAltOgeler((onceki) => {
            const yeni = new Set(onceki);
            if (altAcik) yeni.delete(oge.etiket); else yeni.add(oge.etiket);
            return yeni;
          })}
          className="flex w-full cursor-pointer items-center justify-between border-none bg-transparent text-left"
          style={{ padding: girintili ? "10px 12px 4px 20px" : "10px 12px 4px", fontSize: "14px", fontWeight: 700, color: "#374151", fontFamily: "'Nunito', sans-serif" }}
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
          <div className="flex flex-col gap-0.5 pl-3">
            {altOglar.map((altOge) => (
              <Satir key={altOge.etiket} etiket={altOge.etiket} path={cozPath(altOge)} sayi={rozetSayisi(altOge)} girintili tamEslesme={altOge.tamEslesme} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      onClick={props.onKapat}
      className="fixed inset-0 z-[60] md:hidden"
      style={{ background: "rgba(0,0,0,0.45)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute top-0 left-0 h-full overflow-y-auto"
        style={{ width: "270px", maxWidth: "85vw", background: "#ffffff", boxShadow: "2px 0 16px rgba(0,0,0,0.15)", padding: "14px 12px" }}
      >
        {/* Kapat */}
        <div className="flex justify-end mb-1">
          <button
            onClick={props.onKapat}
            className="bg-transparent border-none cursor-pointer"
            style={{ fontSize: "20px", color: "#737373", lineHeight: 1, padding: "2px 6px" }}
          >
            ×
          </button>
        </div>

        {/* Bilgi pilleri */}
        <div className="flex flex-col gap-1">
          {BILGI_PILLERI.map((p) => (
            <Satir key={p.path} etiket={p.etiket} path={p.etiket === "Ana Sayfa" ? (props.anaSayfaYolu ?? p.path) : p.path} tamEslesme />
          ))}
        </div>

        <div className="h-px my-3" style={{ background: "#f0f0f0" }} />

        {/* Fonksiyonel ağaç */}
        <div className="flex flex-col gap-4">
          {gruplar.map((grup) => {
            const gorunur = grup.oglar.filter((o) => o.gate(props));
            if (gorunur.length === 0) return null;

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
                  type="button"
                  onClick={() => grupToggle(grup.baslik)}
                  className="flex w-full cursor-pointer items-center justify-between border-none bg-transparent"
                  style={{ fontSize: "12px", fontWeight: 800, color: "#111827", textTransform: "uppercase", letterSpacing: "0.06em", padding: "2px 12px 4px", fontFamily: "'Nunito', sans-serif" }}
                >
                  <span>{grup.baslik}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth={2.5}
                    style={{ transform: acik ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {acik && gorunur.map((oge) => <OgeBlogu key={oge.etiket} oge={oge} girintili />)}
              </div>
            );
          })}
        </div>

        <div className="h-px my-3" style={{ background: "#f0f0f0" }} />
        <button
          onClick={cikis}
          className="w-full flex items-center gap-2 rounded-lg border-none bg-transparent px-3 py-2.5 text-left font-semibold cursor-pointer"
          style={{ color: "#bc2d0d", fontSize: "14px", fontFamily: "'Nunito', sans-serif" }}
        >
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Çıkış
        </button>
      </div>
    </div>
  );
}
