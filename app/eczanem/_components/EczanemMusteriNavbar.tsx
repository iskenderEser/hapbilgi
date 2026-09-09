"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  CircleHelp,
  House,
  LogOut,
  Menu,
  Phone,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  ad: string;
  telefon?: string | null;
  onCikis: () => void | Promise<void>;
  onYenile?: () => void | Promise<void>;
  yenileniyor?: boolean;
  onHesapSil?: () => void;
  onHamburger?: () => void;
}

const BILGI_PILLERI = [
  { href: "/eczanem", etiket: "Ana Sayfa", ikon: House },
  { href: "/eczanem/hapbilgi-nedir", etiket: "HapBilgi Nedir", ikon: Sparkles },
  { href: "/eczanem/nasil-calisir", etiket: "Nasıl Çalışır", ikon: CircleHelp },
];

export default function EczanemMusteriNavbar({
  ad,
  telefon,
  onCikis,
  onYenile,
  yenileniyor = false,
  onHesapSil,
  onHamburger,
}: Props) {
  const pathname = usePathname();
  const [profilAcik, setProfilAcik] = useState(false);
  const [mobilMenuAcik, setMobilMenuAcik] = useState(false);
  const profilRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profilAcik) return;
    const tiklamaDinle = (e: MouseEvent | TouchEvent) => {
      if (profilRef.current && !profilRef.current.contains(e.target as Node)) {
        setProfilAcik(false);
      }
    };
    const tusDinle = (e: KeyboardEvent) => {
      if (e.key === "Escape") setProfilAcik(false);
    };
    document.addEventListener("mousedown", tiklamaDinle);
    document.addEventListener("touchstart", tiklamaDinle);
    document.addEventListener("keydown", tusDinle);
    return () => {
      document.removeEventListener("mousedown", tiklamaDinle);
      document.removeEventListener("touchstart", tiklamaDinle);
      document.removeEventListener("keydown", tusDinle);
    };
  }, [profilAcik]);

  useEffect(() => {
    if (!mobilMenuAcik) return;
    const tusDinle = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobilMenuAcik(false);
    };
    document.addEventListener("keydown", tusDinle);
    return () => document.removeEventListener("keydown", tusDinle);
  }, [mobilMenuAcik]);

  const hamburgerTiklandi = () => {
    if (onHamburger) {
      onHamburger();
    } else {
      setMobilMenuAcik((prev) => !prev);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[#dfe7ef] bg-white/95 shadow-[0_2px_12px_rgba(30,55,85,0.04)] backdrop-blur">
        <div className="mx-auto flex min-h-16 w-full max-w-[1240px] items-center justify-between gap-3 px-4 md:px-6">
          {/* Sol: Hamburger (mobil) + Logo */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={hamburgerTiklandi}
              aria-label="Gezinme menüsünü aç"
              aria-expanded={mobilMenuAcik}
              className="flex size-9 items-center justify-center rounded-xl text-[#5b738e] transition hover:bg-[#f1f5f9] hover:text-[#237ac8] md:hidden"
            >
              <Menu className="size-5" />
            </button>

            <Link href="/eczanem" aria-label="HapBilgi Eczanem ana sayfası" className="shrink-0 select-none">
              <Image
                src="/hapbilgi-yatay-TM-1-logo.png"
                alt="HapBilgi"
                width={901}
                height={340}
                priority
                className="aspect-[901/340] w-[108px] object-cover transition-transform duration-200 hover:scale-105 md:w-[126px]"
              />
            </Link>
          </div>

          {/* Orta: Bilgi Pill'leri (Masaüstü - PanelNavbar standardı) */}
          <nav aria-label="Müşteri bilgi menüsü" className="hidden min-w-0 flex-1 items-center gap-2 pl-4 md:flex">
            {BILGI_PILLERI.map(({ href, etiket, ikon: Icon }) => {
              const aktif = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={aktif ? "page" : undefined}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-bold transition-all duration-150 ${
                    aktif
                      ? "bg-[#edf6fd] text-[#237ac8] shadow-[inset_0_0_0_1px_rgba(35,122,200,0.25)]"
                      : "bg-black/[0.03] text-[#556d86] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.06)] hover:bg-[#edf6fd]/70 hover:text-[#237ac8]"
                  }`}
                >
                  <Icon className="size-3.5" />
                  {etiket}
                </Link>
              );
            })}
          </nav>

          {/* Sağ: Yenile + Profil + Çıkış */}
          <div className="flex shrink-0 items-center gap-2">
            {onYenile && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => void onYenile()}
                disabled={yenileniyor}
                aria-label="Sayfayı yenile"
                title="Sayfayı yenile"
                className="size-9 rounded-xl text-[#667b91] hover:bg-[#f1f5f9] hover:text-[#237ac8]"
              >
                <RefreshCw className={`size-4 ${yenileniyor ? "animate-spin" : ""}`} />
              </Button>
            )}

            {/* Profil Açılır Menüsü */}
            <div ref={profilRef} className="relative">
              <button
                type="button"
                onClick={() => setProfilAcik((prev) => !prev)}
                aria-expanded={profilAcik}
                aria-haspopup="true"
                aria-label="Profil ve hesap menüsü"
                className={`group flex items-center gap-2 rounded-2xl border p-1 pl-2 transition sm:pl-2.5 ${
                  profilAcik
                    ? "border-[#cfe0ef] bg-[#f2f7fc]"
                    : "border-[#e5edf5] bg-white hover:border-[#cfe0ef] hover:bg-[#f8fafc]"
                }`}
              >
                <div className="hidden text-right md:block">
                  <p className="max-w-36 truncate text-xs font-extrabold text-[#29425f]">{ad}</p>
                  <p className="text-[10px] font-semibold text-[#8a99aa]">Müşteri hesabı</p>
                </div>
                <span className="flex size-8 items-center justify-center rounded-xl bg-[#edf5fb] text-[#397fbf] transition group-hover:bg-[#e2eef8]">
                  <UserRound className="size-4" />
                </span>
                <ChevronDown
                  className={`mr-1 size-3 text-[#8a99aa] transition-transform duration-200 ${
                    profilAcik ? "rotate-180 text-[#237ac8]" : ""
                  }`}
                />
              </button>

              {profilAcik && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-[#dfe7ef] bg-white p-3 shadow-[0_12px_32px_rgba(30,55,85,0.12)] ring-1 ring-black/5 z-50 animate-in fade-in zoom-in-95 duration-100"
                >
                  {/* Profil Kartı */}
                  <div className="flex items-center gap-3 p-2">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#edf5fb] text-[#237ac8]">
                      <UserRound className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-extrabold text-[#263e5b]">{ad}</p>
                      {telefon ? (
                        <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-[#7f90a2]">
                          <Phone className="size-3" />
                          ••• ••• {telefon.slice(-4)}
                        </p>
                      ) : (
                        <p className="mt-0.5 text-[11px] font-semibold text-[#8a99aa]">Telefon bilgisi yok</p>
                      )}
                      <span className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-[#edf6fd] px-2 py-0.5 text-[10px] font-extrabold text-[#237ac8]">
                        <ShieldCheck className="size-3" /> Eczanem Üyesi
                      </span>
                    </div>
                  </div>

                  <div className="my-2 border-t border-[#edf2f7]" />

                  {/* Menü İşlemleri */}
                  <div className="space-y-1">
                    {onHesapSil && (
                      <button
                        type="button"
                        onClick={() => {
                          setProfilAcik(false);
                          onHesapSil();
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-[#b84444] transition hover:bg-[#fff5f5] hover:text-[#9e3333]"
                      >
                        <Trash2 className="size-4 text-[#b84444]" />
                        Hesabımı kalıcı olarak sil
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Doğrudan Çıkış Butonu */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void onCikis()}
              className="h-9 px-2.5 text-xs font-extrabold text-[#667b91] hover:bg-[#f1f5f9] hover:text-[#29425f]"
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Çıkış</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Mobil Gezinme Çekmecesi (Drawer) */}
      {mobilMenuAcik && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="fixed inset-0 bg-[#0f2438]/40 backdrop-blur-sm transition-opacity"
            onClick={() => setMobilMenuAcik(false)}
            aria-hidden="true"
          />

          <div className="fixed inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col bg-white p-5 shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between border-b border-[#eef3f8] pb-4">
              <Link href="/eczanem" onClick={() => setMobilMenuAcik(false)} className="shrink-0">
                <Image
                  src="/hapbilgi-yatay-TM-1-logo.png"
                  alt="HapBilgi"
                  width={901}
                  height={340}
                  className="aspect-[901/340] w-[100px] object-cover"
                />
              </Link>
              <button
                type="button"
                onClick={() => setMobilMenuAcik(false)}
                aria-label="Menüyü kapat"
                className="flex size-8 items-center justify-center rounded-xl text-[#7f93a7] transition hover:bg-[#f1f5f9] hover:text-[#263e5b]"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-5 flex flex-col gap-1.5">
              <p className="px-2 text-[10px] font-extrabold uppercase tracking-wider text-[#9bb0c3]">
                Gezinme
              </p>
              {BILGI_PILLERI.map(({ href, etiket, ikon: Icon }) => {
                const aktif = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobilMenuAcik(false)}
                    className={`flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-xs font-extrabold transition ${
                      aktif
                        ? "bg-[#edf6fd] text-[#237ac8]"
                        : "text-[#556d86] hover:bg-[#f5f8fb] hover:text-[#21374f]"
                    }`}
                  >
                    <Icon className="size-4" />
                    {etiket}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
