"use client";

import { useRef, useState, type TouchEvent, type WheelEvent } from "react";

export interface TanburBolum {
  id: string;
  etiket: string;
  sayi?: number;
}

interface Props {
  bolumler: TanburBolum[];
  seciliId: string;
  onSec: (id: string) => void;
}

const OGE_YUKSEKLIK = 40; // piksel

export default function HayaletTanburSecici({ bolumler, seciliId, onSec }: Props) {
  const [acik, setAcik] = useState(false);
  const varsayilanIndex = Math.max(0, bolumler.findIndex((b) => b.id === seciliId));
  const [kaydirilmisIndex, setKaydirilmisIndex] = useState<number | null>(null);
  const odakIndex = kaydirilmisIndex ?? varsayilanIndex;

  const dokunmaBaslangicY = useRef<number | null>(null);
  const sonSuruklemeZamani = useRef<number>(0);
  const suruklendiRef = useRef(false);

  const secimeGit = (yeniIndex: number) => {
    const hedef = Math.max(0, Math.min(bolumler.length - 1, yeniIndex));
    setKaydirilmisIndex(hedef);
  };

  const onayla = (index = odakIndex) => {
    const secilen = bolumler[index];
    if (secilen) {
      onSec(secilen.id);
    }
    setKaydirilmisIndex(null);
    setAcik(false);
  };

  // Dokunmatik kaydırma (Touch Swipe / Drag)
  const handleTouchStart = (e: TouchEvent) => {
    dokunmaBaslangicY.current = e.touches[0].clientY;
    suruklendiRef.current = false;
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (dokunmaBaslangicY.current === null) return;
    const deltaY = e.touches[0].clientY - dokunmaBaslangicY.current;

    if (Math.abs(deltaY) > 6) {
      suruklendiRef.current = true;
    }

    const simdi = Date.now();
    if (simdi - sonSuruklemeZamani.current < 70) return;

    if (Math.abs(deltaY) > 22) {
      if (deltaY < 0) {
        // Yukarı kaydırma -> sonraki bölüm
        secimeGit(odakIndex + 1);
      } else {
        // Aşağı kaydırma -> önceki bölüm
        secimeGit(odakIndex - 1);
      }
      dokunmaBaslangicY.current = e.touches[0].clientY;
      sonSuruklemeZamani.current = simdi;
    }
  };

  const handleTouchEnd = () => {
    dokunmaBaslangicY.current = null;
    setTimeout(() => {
      suruklendiRef.current = false;
    }, 120);
  };

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (e.deltaY > 0) {
      secimeGit(odakIndex + 1);
    } else {
      secimeGit(odakIndex - 1);
    }
  };

  return (
    <>
      {/* 1. SAĞ KENARDA YÜZEN OK AYRACI (Trigger Arrowhead - no text) */}
      <aside aria-label="Bölüm gezintisi">
        <button
          type="button"
          onClick={() => setAcik((prev) => !prev)}
          aria-label={acik ? "Bölüm tanburunu kapat" : "Bölüm tanburunu aç"}
          className={`fixed right-0 top-1/2 z-50 flex -translate-y-1/2 cursor-pointer items-center justify-center rounded-l-xl border-y border-l border-white/25 bg-slate-900/85 px-1.5 py-3 text-white shadow-xl backdrop-blur-md transition-all active:scale-90 hover:bg-slate-900 sm:hidden ${
            acik ? "translate-x-0 bg-slate-800" : ""
          }`}
        >
          <svg
            className={`h-4 w-4 text-white/90 transition-transform duration-200 ${
              acik ? "rotate-180" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </aside>

      {/* 2. ARKA PLAN DOKUNMA ALANI (Backdrop tap to close) */}
      {acik && (
        <div
          onClick={() => setAcik(false)}
          className="fixed inset-0 z-40 bg-black/15 backdrop-blur-[1px] sm:hidden"
          aria-hidden="true"
        />
      )}

      {/* 3. SAĞDA YÜZEN HAYALET TANBUR (Floating Ghost Drum next to arrow) */}
      {acik && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Bölüm Tanburu"
          className="fixed right-9 top-1/2 z-50 flex h-[200px] w-52 max-w-[65vw] -translate-y-1/2 flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/50 bg-white/85 shadow-2xl backdrop-blur-xl select-none animate-fade-in sm:hidden"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
        >
          {/* Odaklama Şeridi (Ortadaki Seçim Alanı) */}
          <div className="pointer-events-none absolute inset-x-2 top-1/2 -translate-y-1/2 h-10 rounded-xl border border-black/10 bg-black/[0.05] shadow-xs" />

          {/* Dikey Silindir / Tanbur Çarkı */}
          <div
            className="relative flex h-[200px] w-full flex-col items-center overflow-hidden [mask-image:linear-gradient(to_bottom,transparent_0%,black_18%,black_82%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,transparent_0%,black_18%,black_82%,transparent_100%)]"
          >
            <div
              className="flex w-full flex-col items-center transition-transform duration-200 ease-out"
              style={{
                // 200px yükseklikte ortadaki slot y=80px (80px - index * 40px)
                transform: `translateY(${80 - odakIndex * OGE_YUKSEKLIK}px)`,
              }}
            >
              {bolumler.map((bolum, i) => {
                const uzaklik = i - odakIndex;
                const mutlakUzaklik = Math.abs(uzaklik);

                // Uzaklığa göre soluklaşma / hayalet efekti
                let stil = "text-slate-400 opacity-0 scale-75 pointer-events-none";
                if (mutlakUzaklik === 0) {
                  // Ortadaki aktif sekme: Siyah ve bold
                  stil = "text-black font-black text-sm scale-105 opacity-100";
                } else if (mutlakUzaklik === 1) {
                  // Bir üst / alt sekmeler
                  stil = "text-slate-700/60 font-semibold text-xs scale-95 opacity-55";
                } else if (mutlakUzaklik === 2) {
                  // İki üst / alt sekmeler (daha soluk)
                  stil = "text-slate-500/35 font-medium text-[11px] scale-90 opacity-25";
                }

                return (
                  <button
                    key={bolum.id}
                    type="button"
                    onClick={() => {
                      if (suruklendiRef.current) return;
                      onayla(i);
                    }}
                    className={`flex h-10 w-full cursor-pointer items-center justify-center px-3 text-center transition-all duration-150 ${stil}`}
                  >
                    <span className="truncate">{bolum.etiket}</span>
                    {bolum.sayi !== undefined && (
                      <span
                        className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                          mutlakUzaklik === 0
                            ? "bg-black/10 text-black"
                            : "bg-black/5 text-gray-500"
                        }`}
                      >
                        {bolum.sayi}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
