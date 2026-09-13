"use client";

import React from "react";
import { ApplePodcastsIcon } from "@/components/ogrenme-araci/PodcastKapakGorseli";

export function GorselIcon({ className = "size-8" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  );
}

export function FlipPdfIcon({ className = "size-8" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
      <path d="M6 6h10" />
      <path d="M6 10h10" />
      <path d="M6 14h7" />
    </svg>
  );
}

export function VideoKapakIcon({ className = "size-8" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" />
      <rect x="2" y="6" width="14" height="12" rx="2" />
    </svg>
  );
}

interface Props {
  aracTuru?: "video" | "podcast" | "gorsel" | "flip_pdf" | string | null;
  urunAdi?: string | null;
  className?: string;
  kucuk?: boolean;
}

export function AracVarsayilanKapak({
  aracTuru = "video",
  urunAdi,
  className = "",
  kucuk = false,
}: Props) {
  const tur = aracTuru ?? "video";
  const gecerliAd = urunAdi?.trim() ? urunAdi.trim() : (tur === "podcast" ? "Podcast" : tur === "gorsel" ? "Dijital Broşür" : tur === "flip_pdf" ? "Literatür" : "Video");

  let gradyan = "from-[#1e3a8a] to-[#0f172a]";
  let etiket = "VİDEO";
  let ikon = <VideoKapakIcon className={kucuk ? "size-5" : "size-9"} />;

  if (tur === "podcast") {
    gradyan = "from-[#2a1343] to-[#140824]";
    etiket = "PODCAST";
    ikon = <ApplePodcastsIcon className={kucuk ? "size-6" : "size-10"} />;
  } else if (tur === "gorsel") {
    gradyan = "from-[#064e3b] to-[#022c22]";
    etiket = "DİJİTAL BROŞÜR";
    ikon = <GorselIcon className={kucuk ? "size-5" : "size-9"} />;
  } else if (tur === "flip_pdf") {
    gradyan = "from-[#78350f] to-[#451a03]";
    etiket = "LİTERATÜR";
    ikon = <FlipPdfIcon className={kucuk ? "size-5" : "size-9"} />;
  }

  if (kucuk) {
    return (
      <div
        role="img"
        aria-label={`${gecerliAd} ${etiket.toLowerCase()} kapağı`}
        className={`flex h-full w-full flex-col items-center justify-center bg-gradient-to-br ${gradyan} p-1.5 text-center text-white select-none ${className}`}
      >
        <div className="shrink-0 drop-shadow">{ikon}</div>
        <span className="mt-1 line-clamp-1 max-w-full px-1 text-[10px] font-bold leading-tight text-white/95">
          {gecerliAd}
        </span>
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={`${gecerliAd} ${etiket.toLowerCase()} kapağı`}
      className={`relative flex h-full w-full flex-col items-center justify-center bg-gradient-to-br ${gradyan} p-4 text-center text-white select-none ${className}`}
    >
      <div className="absolute top-2 left-2 rounded-md bg-black/40 px-1.5 py-0.5 text-[8px] font-extrabold tracking-wider text-white/80 backdrop-blur-xs">
        {etiket}
      </div>
      <div className="mb-2 shrink-0 drop-shadow-md">{ikon}</div>
      <span className="line-clamp-2 max-w-[90%] text-xs font-extrabold leading-snug tracking-tight text-white/95">
        {gecerliAd}
      </span>
    </div>
  );
}
