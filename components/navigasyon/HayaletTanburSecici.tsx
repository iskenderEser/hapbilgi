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

      {/* 2. ARKA PLAN DERİNLİK ALANI (Holografik Derinlik İçin Hafif Buğu) */}
      {acik && (
        <div
          onClick={() => setAcik(false)}
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[4px] sm:hidden transition-opacity duration-200"
          aria-hidden="true"
        />
      )}

      {/* 3. HAVADA ASILI 3D HAYALET TANBUR (Sıfır Kutu, Gerçek 3D Silindir) */}
      {acik && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Bölüm Tanburu"
          className="fixed right-7 top-1/2 z-50 flex h-[240px] w-60 max-w-[70vw] -translate-y-1/2 items-center justify-center select-none sm:hidden"
          style={{
            perspective: "800px",
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
        >
          {/* Ortadaki Aktif Alana İnce Kılavuz Çizgiler (Kutu Yok, Sadece Odak Kılavuzu) */}
          <div className="pointer-events-none absolute inset-x-2 top-1/2 -translate-y-[22px] h-[1px] bg-gradient-to-r from-transparent via-black/25 to-transparent" />
          <div className="pointer-events-none absolute inset-x-2 top-1/2 translate-y-[22px] h-[1px] bg-gradient-to-r from-transparent via-black/25 to-transparent" />

          {/* 3D Silindirik Çark */}
          <div
            className="relative flex h-[240px] w-full items-center justify-center"
            style={{
              transformStyle: "preserve-3d",
            }}
          >
            {bolumler.map((bolum, i) => {
              const uzaklik = i - odakIndex;
              const mutlakUzaklik = Math.abs(uzaklik);

              // 3D Silindir Konumlandırması:
              // translateY: Dikey kaydırma
              // rotateX: Tambur yüzeyinde kavislenme (üsttekiler geriye, alttakiler geriye bükülür)
              // translateZ: Merkezden uzaklaştıkça derinliğe doğru gömülme
              // scale: Silindir perspektifi
              const y = uzaklik * 36;
              const rotX = uzaklik * 24;
              const z = -mutlakUzaklik * 22;
              const olcek = Math.max(0.7, 1 - mutlakUzaklik * 0.08);

              // Görünürlük ve Tipografi
              let stil = "text-slate-400 opacity-0 pointer-events-none";
              let yaziGolgesi = "";
              if (mutlakUzaklik === 0) {
                // Ortadaki aktif sekme: Simsiyah, ekstra kalın, en net
                stil = "text-black font-black text-[15px] opacity-100 cursor-pointer";
                yaziGolgesi = "0 1px 10px rgba(255,255,255,0.95), 0 0 3px rgba(255,255,255,0.9)";
              } else if (mutlakUzaklik === 1) {
                // Bir üst / alt sekmeler: Yarı saydam
                stil = "text-slate-900/60 font-bold text-[12px] opacity-45 cursor-pointer";
                yaziGolgesi = "0 1px 6px rgba(255,255,255,0.8)";
              } else if (mutlakUzaklik === 2) {
                // İki üst / alt sekmeler: Hayalet gibi soluk
                stil = "text-slate-700/30 font-medium text-[11px] opacity-20 cursor-pointer";
                yaziGolgesi = "0 1px 4px rgba(255,255,255,0.6)";
              }

              return (
                <button
                  key={bolum.id}
                  type="button"
                  onClick={() => {
                    if (suruklendiRef.current) return;
                    onayla(i);
                  }}
                  style={{
                    transform: `translateY(${y}px) rotateX(${rotX}deg) translateZ(${z}px) scale(${olcek})`,
                    textShadow: yaziGolgesi,
                    transition: "transform 220ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease",
                  }}
                  className={`absolute flex h-10 w-full items-center justify-center px-2 text-center bg-transparent border-0 shadow-none outline-none ${stil}`}
                >
                  <span className="truncate tracking-tight">{bolum.etiket}</span>
                  {bolum.sayi !== undefined && (
                    <span
                      className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold transition-colors ${
                        mutlakUzaklik === 0
                          ? "bg-black text-white shadow-xs"
                          : "bg-black/10 text-slate-700"
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
      )}
    </>
  );
}
