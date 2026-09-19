// components/rehber/UretimVaryantlariModal.tsx
"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { VARYANT_ALT_MODAL } from "@/lib/rehber/sayfaRehberi";

interface Props {
  acik: boolean;
  onKapat: () => void;
}

export default function UretimVaryantlariModal({ acik, onKapat }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!acik) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onKapat();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [acik, onKapat]);

  if (!acik || !mounted) return null;

  return createPortal(
    <div
      onClick={onKapat}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label={VARYANT_ALT_MODAL.baslik}
      style={{ fontFamily: "'Nunito', sans-serif" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[440px] rounded-2xl bg-white p-5 shadow-2xl border border-gray-200 animate-in zoom-in-95 duration-150 text-left"
        style={{
          boxShadow: "0 20px 35px -10px rgba(0, 0, 0, 0.22), 0 2px 8px rgba(0, 0, 0, 0.08)",
        }}
      >
        {/* Başlık ve Kapat Butonu */}
        <div className="flex items-start justify-between pb-3 border-b border-gray-100">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
              Detay Rehberi
            </span>
            <h3 className="text-sm font-extrabold text-gray-900 leading-tight mt-1">
              {VARYANT_ALT_MODAL.baslik}
            </h3>
            {VARYANT_ALT_MODAL.altBaslik && (
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                {VARYANT_ALT_MODAL.altBaslik}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onKapat}
            aria-label="Kapat"
            className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 p-1.5 rounded-full transition-colors cursor-pointer shrink-0 ml-2"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        {/* Varyant Kartları Listesi */}
        <div className="mt-3.5 space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
          {VARYANT_ALT_MODAL.kartlar.map((k) => (
            <div
              key={k.kod}
              className="p-3 rounded-xl bg-gray-50/80 border border-gray-100 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-extrabold text-gray-900">
                  {k.baslik}
                </span>
                {k.rozet && (
                  <span className="text-[10px] font-semibold bg-white text-gray-600 border border-gray-200 px-2 py-0.5 rounded-full whitespace-nowrap shadow-2xs">
                    {k.rozet}
                  </span>
                )}
              </div>
              {k.tanim && (
                <div className="text-[11px] font-bold text-[#1f6db2] mb-1">
                  {k.tanim}
                </div>
              )}
              <p className="text-xs text-gray-600 leading-relaxed m-0">
                {k.aciklama}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
