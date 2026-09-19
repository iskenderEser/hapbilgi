// components/panel/PanelNavbar.tsx
//
// Panel üst barı. Sol: logo. Orta: bilgi pill'leri + (UTT/KD_UTT'de) dikey çizgi
// ardından kişisel özet pill'leri (Takım Sırası · Haftalık Puan · Sipariş Puanı).
// Sağ: ad-soyad (bordo) + avatar; Çıkış adın altında. Fonksiyonel gezinme sol listede.

"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { useHbstoreTakvim } from "@/hooks/useHbstoreTakvim";
import { useEclubStoreTakvim } from "@/hooks/useEclubStoreTakvim";

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
  // Store Günleri geri sayımı — alıcı roller (UTT/KD_UTT/BM) ve firma HBStore açıkken görünür.
  storeGeriSayimGoster?: boolean;
  // E-Club Store Günleri geri sayımı — E-Club kişisi ve aktif firma E-Club Store açıkken görünür.
  eclubStoreGeriSayimGoster?: boolean;
  // Dış müşteri ana sayfası /eclub/panel'dir; iç kullanıcıda varsayılan korunur.
  anaSayfaYolu?: string;
  eclubStorePuani?: number | null;
  firmaLogoUrl?: string | null;
  ogrenmePlatformuAktif?: boolean;
  firmaAdi?: string | null;
  onCikis: () => void;
  onHamburger?: () => void; // mobilde sol drawer'ı açar
}

// Bilgi pill'leri — sabit sıra, rolden bağımsız.
const BILGI_PILLERI: { key: string; etiket: string; path: string }[] = [
  { key: "ana-sayfa", etiket: "Ana Sayfa", path: "/ana-sayfa" },
  { key: "hapbilgi-nedir", etiket: "HapBilgi Nedir", path: "/hapbilgi-nedir" },
  { key: "nasil-calisir", etiket: "Nasıl Çalışır", path: "/nasil-calisir" },
];

export default function PanelNavbar({
  adSoyad,
  email,
  ozet,
  siparisPuaniGoster,
  storeGeriSayimGoster,
  eclubStoreGeriSayimGoster,
  anaSayfaYolu = "/ana-sayfa",
  eclubStorePuani,
  firmaLogoUrl,
  ogrenmePlatformuAktif,
  firmaAdi,
  onCikis,
  onHamburger,
}: PanelNavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [hover, setHover] = useState<string | null>(null);
  const { takvim } = useHbstoreTakvim({ aktif: Boolean(storeGeriSayimGoster) });
  const { takvim: eclubTakvim } = useEclubStoreTakvim({ aktif: Boolean(eclubStoreGeriSayimGoster) });

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
        {/* Sol Kolon: Logo & Co-Branding (Ayraç sidebarın 240px sağ kenarı ile tam hizalıdır: 24px padding + 216px = 240px) */}
        <div className="flex items-center flex-shrink-0">
          <div
            onClick={() => router.push(anaSayfaYolu)}
            className="flex items-center md:w-[216px] flex-shrink-0 cursor-pointer group select-none"
          >
            <img
              src="/hapbilgi-yatay-TM-1-logo.png"
              alt="hapbilgi"
              className="h-12 md:h-14 lg:h-[62px] w-auto aspect-[901/340] object-cover transition-transform duration-200 group-hover:scale-105 drop-shadow-sm"
            />
          </div>

          {ogrenmePlatformuAktif && firmaLogoUrl && (
            <div className="flex items-center flex-shrink-0 select-none pl-2.5 sm:pl-0">
              <div className="h-7 md:h-8 w-[1.5px] bg-slate-200 rounded-full" />
              
              {/* Mobil (<sm): Dikey (Logo üstte, bold yazı altta) | Masaüstü (>=sm): Yatay (Logo solda, yazı sağda) */}
              <div className="flex flex-col sm:flex-row sm:items-center items-start gap-0.5 sm:gap-2.5 pl-2 sm:pl-4">
                <img
                  src={firmaLogoUrl}
                  alt={firmaAdi ?? "Firma"}
                  className="h-6 sm:h-[30px] max-h-8 w-auto max-w-[115px] sm:max-w-[140px] block object-contain"
                />
                <span
                  style={{ fontFamily: "'Nunito', sans-serif" }}
                  className="text-[8.5px] sm:text-[11.5px] font-bold sm:font-normal text-[#1e3a8a] sm:text-[#64748b] tracking-[-0.1px] sm:tracking-[0.1px] whitespace-nowrap"
                >
                  resmi öğrenme sponsoru
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Orta: Esnek Boşluk */}
        <div className="flex-1" />

        {/* Sağ Kolon: Bilgi Pill'leri + Puan/Sıra Pill'leri + Kullanıcı Profili */}
        <div className="hidden md:flex items-center gap-6 lg:gap-8 flex-shrink-0" style={{ marginRight: 48 }}>
          {/* Bilgi Pill'leri (Sağa çekildi) */}
          <div className="flex items-center gap-2">
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

          <div className="h-6 w-[1px] bg-gray-200" />
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
            <div className="flex items-center gap-2">
              {storeGeriSayimGoster && takvim && (
                <>
                  <button
                    type="button"
                    onClick={() => router.push("/store")}
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold transition-all hover:opacity-80 cursor-pointer bg-transparent border-none p-0 select-none"
                    style={{ color: takvim.acik ? "#027a48" : "#4b5563" }}
                    title={
                      takvim.acik
                        ? `Store Günleri açık · Kapanışa ${takvim.kalanSureMetni} kaldı`
                        : `Sonraki sipariş dönemi: ${takvim.sonrakiDonemEtiketi} (${takvim.kalanSureMetni} kaldı)`
                    }
                  >
                    <span
                      className="size-1.5 rounded-full shrink-0"
                      style={{
                        backgroundColor: takvim.acik ? "#12b76a" : "#f59e0b",
                        boxShadow: takvim.acik ? "0 0 6px #12b76a" : "none",
                      }}
                    />
                    <span>{takvim.navMetni}</span>
                  </button>
                  <span style={{ color: "#d1d5db", fontSize: 11, userSelect: "none" }}>·</span>
                </>
              )}
              {eclubStoreGeriSayimGoster && eclubTakvim && (
                <>
                  <button
                    type="button"
                    onClick={() => router.push("/eclub/store")}
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold transition-all hover:opacity-80 cursor-pointer bg-transparent border-none p-0 select-none"
                    style={{ color: eclubTakvim.acik ? "#027a48" : "#4b5563" }}
                    title={
                      eclubTakvim.acik
                        ? `E-Club Store açık · Kapanışa ${eclubTakvim.kalanSureMetni} kaldı`
                        : `Sonraki sipariş dönemi: ${eclubTakvim.sonrakiDonemEtiketi} (${eclubTakvim.kalanSureMetni} kaldı)`
                    }
                  >
                    <span
                      className="size-1.5 rounded-full shrink-0"
                      style={{
                        backgroundColor: eclubTakvim.acik ? "#12b76a" : "#f59e0b",
                        boxShadow: eclubTakvim.acik ? "0 0 6px #12b76a" : "none",
                      }}
                    />
                    <span>{eclubTakvim.durumMetni}</span>
                  </button>
                  <span style={{ color: "#d1d5db", fontSize: 11, userSelect: "none" }}>·</span>
                </>
              )}
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
        </div>

        {/* Mobil: avatar + hamburger (sol drawer'ı açar). */}
        <div className="flex md:hidden items-center gap-2">
          {storeGeriSayimGoster && takvim && (
            <button
              type="button"
              onClick={() => router.push("/store")}
              className="inline-flex items-center gap-1 text-[11px] font-bold bg-transparent border-none p-0 mr-1"
              style={{ color: takvim.acik ? "#027a48" : "#4b5563" }}
            >
              <span
                className="size-1.5 rounded-full shrink-0"
                style={{
                  backgroundColor: takvim.acik ? "#12b76a" : "#f59e0b",
                }}
              />
              <span>{takvim.acik ? "Açık" : takvim.kisaKalanSureMetni}</span>
            </button>
          )}
          {eclubStoreGeriSayimGoster && eclubTakvim && (
            <button
              type="button"
              onClick={() => router.push("/eclub/store")}
              className="inline-flex items-center gap-1 text-[11px] font-bold bg-transparent border-none p-0 mr-1"
              style={{ color: eclubTakvim.acik ? "#027a48" : "#4b5563" }}
            >
              <span
                className="size-1.5 rounded-full shrink-0"
                style={{
                  backgroundColor: eclubTakvim.acik ? "#12b76a" : "#f59e0b",
                }}
              />
              <span>{eclubTakvim.acik ? "Açık" : eclubTakvim.kisaKalanSureMetni}</span>
            </button>
          )}
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
