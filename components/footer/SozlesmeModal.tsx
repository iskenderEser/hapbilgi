// components/footer/SozlesmeModal.tsx
//
// Yasal sözleşmeleri (Gizlilik, KVKK, Çerez, Mesafeli Satış) temiz ve erişilebilir bir modal penceresinde gösterir.

"use client";

import React, { useEffect } from "react";
import { type SozlesmeDetay } from "./sozlesmelerData";

interface SozlesmeModalProps {
  sozlesme: SozlesmeDetay | null;
  onKapat: () => void;
}

export default function SozlesmeModal({ sozlesme, onKapat }: SozlesmeModalProps) {
  useEffect(() => {
    if (!sozlesme) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onKapat();
    };

    window.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [sozlesme, onKapat]);

  if (!sozlesme) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-6"
      style={{
        background: "rgba(17, 24, 39, 0.65)",
        backdropFilter: "blur(6px)",
      }}
      onClick={onKapat}
    >
      <div
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200"
        style={{ fontFamily: "'Nunito', sans-serif" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Başlığı */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-[#f9fafb]">
          <div>
            <h3 id="modal-title" className="text-lg md:text-xl font-black text-gray-900 leading-tight">
              {sozlesme.baslik}
            </h3>
            <p className="text-xs font-semibold text-gray-400 mt-0.5">
              Son Güncelleme: {sozlesme.sonGuncelleme} • Mill Danışmanlık
            </p>
          </div>
          <button
            type="button"
            onClick={onKapat}
            aria-label="Kapat"
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 transition-colors border-none bg-transparent cursor-pointer text-lg font-bold"
          >
            ✕
          </button>
        </div>

        {/* Modal İçerik Metni */}
        <div className="px-6 py-6 overflow-y-auto space-y-4 text-sm text-gray-700 leading-relaxed">
          {sozlesme.icerik.map((paragraf, index) => (
            <p key={index} className="text-justify text-gray-600">
              {paragraf}
            </p>
          ))}
        </div>

        {/* Modal Alt Buton */}
        <div className="flex items-center justify-end px-6 py-3.5 border-t border-gray-100 bg-[#f9fafb]">
          <button
            type="button"
            onClick={onKapat}
            className="px-5 py-2 rounded-xl text-sm font-bold bg-[#bc2d0d] text-white hover:bg-[#a3260b] transition-colors border-none cursor-pointer shadow-sm"
          >
            Anladım ve Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
