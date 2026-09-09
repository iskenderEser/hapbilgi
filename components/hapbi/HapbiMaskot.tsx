// components/hapbi/HapbiMaskot.tsx
//
// Sağ altta yüzen, süzülme animasyonlu ve hover olunca göz kırpan canlı 3D Hapbi maskotu.

"use client";

import React, { useState } from "react";
import { useHapbi } from "./HapbiProvider";
import { useAuth } from "@/app/providers/AuthProvider";
import { biKullanabilirMi } from "@/lib/bi/erisim";

export default function HapbiMaskot() {
  const { kullanici } = useAuth();
  const { chatAcik, toggleChat } = useHapbi();
  const [isHovered, setIsHovered] = useState(false);

  if (!kullanici || !biKullanabilirMi(kullanici.kimlik_turu, kullanici.rol)) {
    return null;
  }

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 select-none"
      style={{ fontFamily: "'Nunito', sans-serif" }}
    >
      {/* Slogan Baloncuğu / Tooltip */}
      <div
        className={`transition-all duration-300 transform ${
          isHovered && !chatAcik ? "opacity-100 translate-x-0" : "opacity-0 translate-x-2 pointer-events-none"
        }`}
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
        onClick={toggleChat}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-label="bi"
        className="relative group cursor-pointer border-none bg-transparent p-0 transition-transform duration-300 hover:scale-105 active:scale-95 focus:outline-none"
        style={{
          width: "56px",
          height: "56px",
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
