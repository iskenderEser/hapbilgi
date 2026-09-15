// app/talepler/_components/VideoYukleme.tsx
//
// "Hazır videom/aracım var" seçiliyken görünen tek dosya seçim bölümü.
// Parent koşullu render eder.
// Yükleme aşaması parent'ta (A4: talep oluşunca vezneden izin + tarayıcıdan
// doğrudan Bunny'ye TUS — dosya Supabase'e hiç girmez).

"use client";

import { useRef } from "react";
import {
  type BekleyenDosya,
  VIDEO_FORMATLAR,
  PODCAST_FORMATLAR,
  GORSEL_FORMATLAR,
  FLIP_PDF_FORMATLAR,
  dosyaTipiRenk,
} from "../_types";
import type { OgrenmeAraciTuru } from "@/lib/ogrenmeAraci/tipler";

export interface VideoYuklemeProps {
  bekleyen: BekleyenDosya | null;
  onSec: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSil: () => void;
  yuklemeYuzdesi?: number | null;
  ogrenmeAraciTuru?: OgrenmeAraciTuru | null;
  butonMetni?: string;
  accept?: string;
  aciklama?: string;
}

export interface AracYuklemeAyari {
  butonMetni: string;
  accept: string;
  aciklama: string;
  yukleniyorMetni: string;
}

export function aracYuklemeAyarlari(tur?: OgrenmeAraciTuru | null): AracYuklemeAyari {
  switch (tur) {
    case "podcast":
      return {
        butonMetni: "Podcast Ekle",
        accept: PODCAST_FORMATLAR,
        aciklama: "mp3, m4a, aac formatları desteklenir.",
        yukleniyorMetni: "Podcast yükleniyor...",
      };
    case "gorsel":
      return {
        butonMetni: "Dijital Broşür Ekle",
        accept: GORSEL_FORMATLAR,
        aciklama: "jpg, jpeg, png formatları desteklenir.",
        yukleniyorMetni: "Dijital broşür yükleniyor...",
      };
    case "flip_pdf":
      return {
        butonMetni: "Literatür Ekle",
        accept: FLIP_PDF_FORMATLAR,
        aciklama: "pdf formatı desteklenir.",
        yukleniyorMetni: "Literatür yükleniyor...",
      };
    case "video":
    default:
      return {
        butonMetni: "Video Ekle",
        accept: VIDEO_FORMATLAR,
        aciklama: "mp4, mov, avi, mkv, webm formatları desteklenir.",
        yukleniyorMetni: "Video yükleniyor...",
      };
  }
}

export function VideoYukleme({
  bekleyen,
  onSec,
  onSil,
  yuklemeYuzdesi = null,
  ogrenmeAraciTuru,
  butonMetni,
  accept,
  aciklama,
}: VideoYuklemeProps) {
  const videoInputRef = useRef<HTMLInputElement>(null);
  const ayar = aracYuklemeAyarlari(ogrenmeAraciTuru);

  // Dosya seçildikten sonra input'un value'su temizlenir — aynı dosya tekrar seçilebilsin.
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSec(e);
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-1.5">
        <label
          className="flex items-center gap-1 bg-white border rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap"
          style={{ borderColor: "#56aeff", color: "#56aeff" }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#56aeff" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {butonMetni ?? ayar.butonMetni}
          <input
            ref={videoInputRef}
            type="file"
            accept={accept ?? ayar.accept}
            onChange={handleChange}
            className="hidden"
          />
        </label>
        <span className="text-xs text-gray-400">{aciklama ?? ayar.aciklama}</span>
      </div>
      {bekleyen && (() => {
        const rozet = dosyaTipiRenk(bekleyen.preview.dosya_adi);
        return (
          <div className="flex flex-wrap gap-1.5">
            <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-full py-1 pl-2 pr-2.5">
              <div
                className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                style={{ background: rozet.bg }}
              >
                <span className="font-bold" style={{ fontSize: 7, color: rozet.renk }}>
                  {rozet.etiket}
                </span>
              </div>
              <span className="text-xs text-gray-700 max-w-40 truncate">{bekleyen.preview.dosya_adi}</span>
              <svg
                onClick={onSil}
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
          </div>
        );
      })()}
      {yuklemeYuzdesi !== null && (
        <div className="mt-2">
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${yuklemeYuzdesi}%`, background: "#56aeff" }} />
          </div>
          <p className="text-xs text-gray-500 m-0 mt-1">
            {ayar.yukleniyorMetni} %{yuklemeYuzdesi}
          </p>
        </div>
      )}
    </div>
  );
}
