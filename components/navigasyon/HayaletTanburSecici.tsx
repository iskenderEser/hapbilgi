"use client";

import { useEffect, useRef, useState, type TouchEvent, type WheelEvent } from "react";

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
  const bulunanIndex = bolumler.findIndex((b) => b.id === seciliId);
  const [odakIndex, setOdakIndex] = useState(bulunanIndex >= 0 ? bulunanIndex : 0);

  const dokunmaBaslangicY = useRef<number | null>(null);
  const sonSuruklemeZamani = useRef<number>(0);

  useEffect(() => {
    const idx = bolumler.findIndex((b) => b.id === seciliId);
    if (idx >= 0) setOdakIndex(idx);
  }, [seciliId, bolumler]);

  const secimeGit = (yeniIndex: number) => {
    const hedef = Math.max(0, Math.min(bolumler.length - 1, yeniIndex));
    setOdakIndex(hedef);
  };

  const onayla = (index = odakIndex) => {
    const secilen = bolumler[index];
    if (secilen) {
      onSec(secilen.id);
    }
    setAcik(false);
  };

  // Dokunmatik kaydırma (Touch Swipe / Drag)
  const handleTouchStart = (e: TouchEvent) => {
    dokunmaBaslangicY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (dokunmaBaslangicY.current === null) return;
    const simdi = Date.now();
    if (simdi - sonSuruklemeZamani.current < 90) return; // yumuşak hız sınırlaması

    const deltaY = e.touches[0].clientY - dokunmaBaslangicY.current;
    if (Math.abs(deltaY) > 28) {
      if (deltaY < 0) {
        // Yukarı kaydırma -> sonraki öğe
        secimeGit(odakIndex + 1);
      } else {
        // Aşağı kaydırma -> önceki öğe
        secimeGit(odakIndex - 1);
      }
      dokunmaBaslangicY.current = e.touches[0].clientY;
      sonSuruklemeZamani.current = simdi;
    }
  };

  const handleTouchEnd = () => {
    dokunmaBaslangicY.current = null;
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
      {/* 1. SAĞ KENARDA YÜZEN AYRAÇ (Floating Edge Handle) */}
      <aside aria-label="Bölüm gezintisi">
        <button
          type="button"
          onClick={() => {
            const idx = bolumler.findIndex((b) => b.id === seciliId);
            if (idx >= 0) setOdakIndex(idx);
            setAcik(true);
          }}
          aria-label="Bölüm gezintisi tanburunu aç"
          className="fixed right-0 top-1/2 z-40 flex -translate-y-1/2 cursor-pointer items-center rounded-l-2xl border-y border-l border-white/30 bg-[#162740]/90 py-3.5 pl-2 pr-1.5 text-white shadow-2xl backdrop-blur-md transition-all hover:bg-[#101e32] active:scale-95 sm:hidden"
        >
          <div className="flex flex-col items-center gap-1.5">
            <span className="rotate-180 text-[10px] font-black uppercase tracking-wider text-blue-400 [writing-mode:vertical-lr]">
              Bölümler
            </span>
            <svg
              className="h-3.5 w-3.5 text-white animate-pulse"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </div>
        </button>
      </aside>

      {/* 2. HAYALET TANBUR MODALI (Glassmorphism Drum) */}
      {acik && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Bölüm Seçici"
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/55 backdrop-blur-sm sm:hidden animate-fade-in"
        >
          {/* Dış alana tıklayınca kapat */}
          <div
            className="flex-1 cursor-pointer"
            onClick={() => setAcik(false)}
            aria-label="Kapat"
          />

          {/* Tanbur Gövdesi */}
          <div className="relative rounded-t-3xl border-t border-white/30 bg-white/95 p-5 shadow-2xl backdrop-blur-xl">
            {/* Tutamaç Çubuğu */}
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300" />

            <div className="mb-2 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600">
                  Dikey Tanbur Gezintisi
                </span>
                <p className="text-xs font-bold text-gray-800">Geçmek istediğiniz bölümü çevirin</p>
              </div>
              <button
                type="button"
                onClick={() => setAcik(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500 hover:bg-gray-200"
              >
                ✕
              </button>
            </div>

            {/* Tanbur Çark Alanı */}
            <div
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onWheel={handleWheel}
              className="relative my-3 flex h-48 select-none flex-col items-center justify-center overflow-hidden [mask-image:linear-gradient(to_bottom,transparent_0%,black_20%,black_80%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,transparent_0%,black_20%,black_80%,transparent_100%)]"
            >
              {/* Odaklama Çizgisi (Seçim Kutusu) */}
              <div className="pointer-events-none absolute inset-x-2 h-11 rounded-xl border border-blue-400/40 bg-blue-50/60 shadow-xs" />

              {/* Dönen Çark Başlıkları */}
              <div
                className="flex w-full flex-col items-center transition-transform duration-200 ease-out"
                style={{
                  transform: `translateY(${(-odakIndex * 44) + 72}px)`,
                }}
              >
                {bolumler.map((bolum, i) => {
                  const uzaklik = i - odakIndex;
                  const mutlakUzaklik = Math.abs(uzaklik);

                  let stil = "text-gray-300 opacity-0 scale-75";
                  if (mutlakUzaklik === 0) {
                    stil = "text-blue-600 font-black text-sm scale-105 opacity-100";
                  } else if (mutlakUzaklik === 1) {
                    stil = "text-gray-700 font-semibold text-xs scale-90 opacity-45";
                  } else if (mutlakUzaklik === 2) {
                    stil = "text-gray-400 font-normal text-[11px] scale-80 opacity-20";
                  }

                  return (
                    <div
                      key={bolum.id}
                      onClick={() => {
                        setOdakIndex(i);
                        onayla(i);
                      }}
                      className={`flex h-11 w-full cursor-pointer items-center justify-center px-4 text-center transition-all duration-150 ${stil}`}
                    >
                      <span className="truncate">{bolum.etiket}</span>
                      {bolum.sayi !== undefined && (
                        <span className="ml-1.5 rounded-full bg-blue-100/70 px-1.5 py-0.5 text-[9px] font-bold text-blue-700">
                          {bolum.sayi}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Aksiyon Butonları */}
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => secimeGit(odakIndex - 1)}
                disabled={odakIndex === 0}
                className="flex-1 rounded-xl border border-gray-200 bg-gray-50 py-2.5 text-xs font-bold text-gray-700 transition-colors active:bg-gray-100 disabled:opacity-30"
              >
                ▲ Önceki
              </button>
              <button
                type="button"
                onClick={() => onayla()}
                className="flex-2 rounded-xl bg-blue-600 py-2.5 text-xs font-black text-white shadow-md transition-colors hover:bg-blue-700 active:scale-[0.99]"
              >
                Seç ve Git
              </button>
              <button
                type="button"
                onClick={() => secimeGit(odakIndex + 1)}
                disabled={odakIndex === bolumler.length - 1}
                className="flex-1 rounded-xl border border-gray-200 bg-gray-50 py-2.5 text-xs font-bold text-gray-700 transition-colors active:bg-gray-100 disabled:opacity-30"
              >
                Sonraki ▼
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
