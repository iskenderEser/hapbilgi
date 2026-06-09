// app/talepler/_components/EkDosyaYukleme.tsx
//
// Talep formunda PDF/dosya çoklu yükleme bölümü.
// Bekleyen dosyaların gösterimi + dosya türüne göre renkli rozet.
// Yükleme aşaması parent'ta (handleSubmit içinde Supabase Storage'a gidiyor).

"use client";

import { useRef } from "react";
import {
  type BekleyenDosya,
  dosyaTipiRenk,
  DESTEKLENEN_FORMATLAR,
  EK_DOSYA_FORMATLAR,
} from "../_types";

interface EkDosyaYuklemeProps {
  bekleyenler: BekleyenDosya[];
  hazirVideo: boolean; // true ise video formatları kabul edilmez (video VideoYukleme'de)
  onSec: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSil: (index: number) => void;
}

export function EkDosyaYukleme({ bekleyenler, hazirVideo, onSec, onSil }: EkDosyaYuklemeProps) {
  const dosyaInputRef = useRef<HTMLInputElement>(null);

  // Dosya seçildikten sonra input'un value'su temizlenir — aynı dosya tekrar seçilebilsin.
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSec(e);
    if (dosyaInputRef.current) dosyaInputRef.current.value = "";
  };

  return (
    <div>
      <label className="text-xs text-gray-500 block mb-1.5">
        Ek Dosyalar <span className="text-gray-400 font-normal">(isteğe bağlı)</span>
      </label>
      <div className="flex items-center gap-2.5 mb-2">
        <label className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-700 cursor-pointer whitespace-nowrap">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Dosya Ekle
          <input
            ref={dosyaInputRef}
            type="file"
            multiple
            accept={hazirVideo ? EK_DOSYA_FORMATLAR : DESTEKLENEN_FORMATLAR}
            onChange={handleChange}
            className="hidden"
          />
        </label>
        <span className="text-xs text-gray-400 leading-snug">
          {hazirVideo
            ? "PDF, docx, pptx, xlsx, txt ve görsel formatları desteklenir."
            : "PDF, docx, pptx, xlsx, txt, görsel ve video formatları desteklenir."}
        </span>
      </div>
      {bekleyenler.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {bekleyenler.map(({ preview }, i) => {
            const { etiket, bg, renk } = dosyaTipiRenk(preview.dosya_adi);
            return (
              <div
                key={i}
                className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-full py-1 pl-2 pr-2.5"
              >
                <div
                  className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                  style={{ background: bg }}
                >
                  <span style={{ fontSize: 7, fontWeight: 700, color: renk }}>{etiket}</span>
                </div>
                <span className="text-xs text-gray-700 max-w-28 truncate">{preview.dosya_adi}</span>
                <svg
                  onClick={() => onSil(i)}
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#9ca3af"
                  strokeWidth="2"
                  className="cursor-pointer flex-shrink-0"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}