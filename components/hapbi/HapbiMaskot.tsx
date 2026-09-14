// components/hapbi/HapbiMaskot.tsx
//
// Sağ altta yüzen, süzülme animasyonlu ve hover olunca göz kırpan canlı 3D Hapbi maskotu.

"use client";

import React, { useEffect, useRef, useState } from "react";
import { useHapbi } from "./HapbiProvider";
import { useAuth } from "@/app/providers/AuthProvider";
import { biKullanabilirMi } from "@/lib/bi/erisim";

type MaskotKonumu = { x: number; y: number };
type EkranTuru = "mobil" | "tablet" | "masaustu";

const MASKOT_BOYUTU = 56;
const EKRAN_KENARI = 12;
const KONUM_ANAHTARI = "hapbilgi:bi-maskot-konumu:v1";

const ekranTurunuBul = (): EkranTuru => {
  if (window.innerWidth < 640) return "mobil";
  if (window.innerWidth < 1024) return "tablet";
  return "masaustu";
};

const konumuSinirla = (konum: MaskotKonumu): MaskotKonumu => ({
  x: Math.min(Math.max(EKRAN_KENARI, konum.x), Math.max(EKRAN_KENARI, window.innerWidth - MASKOT_BOYUTU - EKRAN_KENARI)),
  y: Math.min(Math.max(EKRAN_KENARI, konum.y), Math.max(EKRAN_KENARI, window.innerHeight - MASKOT_BOYUTU - EKRAN_KENARI)),
});

export default function HapbiMaskot() {
  const { kullanici } = useAuth();
  const { chatAcik, toggleChat } = useHapbi();
  const [isHovered, setIsHovered] = useState(false);
  const [konum, setKonum] = useState<MaskotKonumu | null>(null);
  const [surukleniyor, setSurukleniyor] = useState(false);
  const maskotRef = useRef<HTMLDivElement>(null);
  const konumRef = useRef<MaskotKonumu | null>(null);
  const ekranTuruRef = useRef<EkranTuru | null>(null);
  const tiklamayiEngelleRef = useRef(false);
  const suruklemeRef = useRef<{
    pointerId: number;
    baslangicX: number;
    baslangicY: number;
    ilkKonum: MaskotKonumu;
    hareketEtti: boolean;
  } | null>(null);

  const konumuAyarla = (yeniKonum: MaskotKonumu | null) => {
    konumRef.current = yeniKonum;
    setKonum(yeniKonum);
  };

  useEffect(() => {
    const kayitliKonumuYukle = (ekranTuru: EkranTuru) => {
      try {
        const kayit = window.localStorage.getItem(`${KONUM_ANAHTARI}:${ekranTuru}`);
        if (!kayit) {
          konumuAyarla(null);
          return;
        }
        const parsed = JSON.parse(kayit) as Partial<MaskotKonumu>;
        if (typeof parsed.x !== "number" || typeof parsed.y !== "number") {
          konumuAyarla(null);
          return;
        }
        konumuAyarla(konumuSinirla({ x: parsed.x, y: parsed.y }));
      } catch {
        konumuAyarla(null);
      }
    };

    const ekranDegisiminiUygula = () => {
      const yeniEkranTuru = ekranTurunuBul();
      if (ekranTuruRef.current !== yeniEkranTuru) {
        ekranTuruRef.current = yeniEkranTuru;
        kayitliKonumuYukle(yeniEkranTuru);
        return;
      }
      if (konumRef.current) konumuAyarla(konumuSinirla(konumRef.current));
    };

    ekranDegisiminiUygula();
    window.addEventListener("resize", ekranDegisiminiUygula);
    return () => window.removeEventListener("resize", ekranDegisiminiUygula);
  }, []);

  const konumuKaydet = (yeniKonum: MaskotKonumu) => {
    const ekranTuru = ekranTuruRef.current ?? ekranTurunuBul();
    try {
      window.localStorage.setItem(`${KONUM_ANAHTARI}:${ekranTuru}`, JSON.stringify(yeniKonum));
    } catch {
      // Depolama kapalıysa maskot yalnız mevcut sayfa boyunca taşınabilir kalır.
    }
  };

  const kontrolUstundeMi = (hedefKonum: MaskotKonumu) => {
    const noktalar = [
      [hedefKonum.x + 8, hedefKonum.y + 8],
      [hedefKonum.x + MASKOT_BOYUTU - 8, hedefKonum.y + 8],
      [hedefKonum.x + MASKOT_BOYUTU / 2, hedefKonum.y + MASKOT_BOYUTU / 2],
      [hedefKonum.x + 8, hedefKonum.y + MASKOT_BOYUTU - 8],
      [hedefKonum.x + MASKOT_BOYUTU - 8, hedefKonum.y + MASKOT_BOYUTU - 8],
    ];
    return noktalar.some(([x, y]) => document.elementsFromPoint(x, y).some((element) => {
      if (maskotRef.current?.contains(element)) return false;
      return Boolean(element.closest("button, a, input, select, textarea, [role='button'], [role='link']"));
    }));
  };

  const suruklemeyiBaslat = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const rect = maskotRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    suruklemeRef.current = {
      pointerId: event.pointerId,
      baslangicX: event.clientX,
      baslangicY: event.clientY,
      ilkKonum: { x: rect.left, y: rect.top },
      hareketEtti: false,
    };
    setSurukleniyor(true);
  };

  const surukle = (event: React.PointerEvent<HTMLButtonElement>) => {
    const surukleme = suruklemeRef.current;
    if (!surukleme || surukleme.pointerId !== event.pointerId) return;
    const farkX = event.clientX - surukleme.baslangicX;
    const farkY = event.clientY - surukleme.baslangicY;
    if (!surukleme.hareketEtti && Math.hypot(farkX, farkY) < 4) return;
    surukleme.hareketEtti = true;
    event.preventDefault();
    konumuAyarla(konumuSinirla({ x: surukleme.ilkKonum.x + farkX, y: surukleme.ilkKonum.y + farkY }));
  };

  const suruklemeyiBitir = (event: React.PointerEvent<HTMLButtonElement>) => {
    const surukleme = suruklemeRef.current;
    if (!surukleme || surukleme.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    suruklemeRef.current = null;
    setSurukleniyor(false);
    if (!surukleme.hareketEtti) return;
    tiklamayiEngelleRef.current = true;
    window.setTimeout(() => {
      tiklamayiEngelleRef.current = false;
    }, 0);
    const sonKonum = konumRef.current ?? surukleme.ilkKonum;
    if (kontrolUstundeMi(sonKonum)) {
      konumuAyarla(surukleme.ilkKonum);
      return;
    }
    konumuKaydet(sonKonum);
  };

  const suruklemeyiIptalEt = (event: React.PointerEvent<HTMLButtonElement>) => {
    const surukleme = suruklemeRef.current;
    if (!surukleme || surukleme.pointerId !== event.pointerId) return;
    suruklemeRef.current = null;
    setSurukleniyor(false);
    konumuAyarla(surukleme.ilkKonum);
  };

  if (!kullanici || !biKullanabilirMi(kullanici.kimlik_turu, kullanici.rol)) {
    return null;
  }

  return (
    <div
      ref={maskotRef}
      data-hapbi-maskot
      className="pointer-events-none fixed z-50 size-14 select-none"
      style={{
        fontFamily: "'Nunito', sans-serif",
        ...(konum ? { left: konum.x, top: konum.y } : { right: 24, bottom: 24 }),
      }}
    >
      {/* Slogan Baloncuğu / Tooltip */}
      <div
        className={`pointer-events-none absolute top-1/2 hidden -translate-y-1/2 transition-opacity duration-300 sm:block ${
          konum && konum.x < 230 ? "left-full ml-3" : "right-full mr-3"
        } ${isHovered && !chatAcik && !surukleniyor ? "opacity-100" : "opacity-0"}`}
      >
        <div
          className="bg-gray-900/95 backdrop-blur-md text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg shadow-black/10 flex items-center gap-1.5 whitespace-nowrap border border-white/10"
        >
          <span className="font-extrabold text-orange-400 tracking-tight">bi</span>
          <span className="text-gray-600">|</span>
          <div className="text-gray-200 flex items-center gap-1.5">
            <span>Sor</span>
            <span className="w-1 h-1 rounded-full bg-orange-400/80 flex-shrink-0" />
            <span>Öğren</span>
            <span className="w-1 h-1 rounded-full bg-orange-400/80 flex-shrink-0" />
            <span>Değiştir</span>
          </div>
        </div>
      </div>

      {/* Yüzen bi Butonu */}
      <button
        type="button"
        onClick={(event) => {
          if (tiklamayiEngelleRef.current) {
            tiklamayiEngelleRef.current = false;
            event.preventDefault();
            return;
          }
          toggleChat();
        }}
        onPointerDown={suruklemeyiBaslat}
        onPointerMove={surukle}
        onPointerUp={suruklemeyiBitir}
        onPointerCancel={suruklemeyiIptalEt}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-label="bi"
        title="bi — sohbeti açmak için tıklayın, taşımak için sürükleyin"
        className={`pointer-events-auto relative group border-none bg-transparent p-0 transition-transform duration-300 hover:scale-105 active:scale-95 focus:outline-none ${surukleniyor ? "cursor-grabbing" : "cursor-grab"}`}
        style={{
          width: "56px",
          height: "56px",
          touchAction: "none",
          animation: "bi-float 3s ease-in-out infinite",
        }}
      >
        {/* Arkadaki Yumuşak Işıma Efekti (Glow) */}
        <div
          className="absolute inset-0 rounded-full bg-gradient-to-tr from-orange-500 to-amber-400 blur-md opacity-50 transition-all duration-300 group-hover:opacity-80 group-hover:blur-lg"
          style={{ transform: "scale(0.9)" }}
        />

        {/* Ana Dairesel bi Butonu */}
        <div className="relative w-full h-full rounded-full bg-gradient-to-tr from-orange-600 via-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/30 border-2 border-white/90">
          <span className="text-white font-black text-2xl tracking-tighter select-none font-sans drop-shadow-sm lowercase">
            bi
          </span>
        </div>

        {/* Canlı Durum Rozeti */}
        <div
          className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white shadow-sm flex items-center justify-center"
          title="bi hazır"
        >
          <div className="w-1 h-1 bg-white rounded-full animate-ping" />
        </div>
      </button>

      {/* CSS Keyframes for Floating Animation */}
      <style jsx global>{`
        @keyframes bi-float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-5px);
          }
        }
      `}</style>
    </div>
  );
}
