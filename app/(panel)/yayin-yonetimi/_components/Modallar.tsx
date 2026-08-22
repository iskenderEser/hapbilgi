// app/yayin-yonetimi/_components/Modallar.tsx
//
// Yayın yönetimi sayfasının üç modalı:
//   - VideoOnizlemeModal: video iframe önizlemesi
//   - YayinOnayModal: yayınlama onayı (hedef rol gösterimi)
//
// Davranış orijinal page.tsx ile birebir aynıdır.

"use client";

import { useEffect } from "react";
import type { Bekleyen } from "../_types";
import { HedefRolPilleri } from "@/components/HedefRolBant";
import VideoOnizleme from "@/components/video/VideoOnizleme";

function useEscapeKapat(onKapat: () => void) {
  useEffect(() => {
    const dinle = (event: KeyboardEvent) => {
      if (event.key === "Escape") onKapat();
    };
    document.addEventListener("keydown", dinle);
    return () => document.removeEventListener("keydown", dinle);
  }, [onKapat]);
}

export function VideoOnizlemeModal({ url, onKapat }: { url: string; onKapat: () => void }) {
  useEscapeKapat(onKapat);
  return (
    <div onClick={onKapat} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="video-onizleme-baslik" onClick={(e) => e.stopPropagation()} className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <span id="video-onizleme-baslik" className="text-sm font-extrabold text-[#243957]">Video Önizleme</span>
          <button type="button" aria-label="Video önizlemeyi kapat" onClick={onKapat} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-none bg-[#f2f5f9] text-lg text-gray-500">✕</button>
        </div>
        <VideoOnizleme videoUrl={url} ariaLabel="Video önizlemeyi oynat" />
      </div>
    </div>
  );
}

export function YayinOnayModal({ bekleyen, onIptal, onYayinla }: {
  bekleyen: Bekleyen;
  onIptal: () => void;
  onYayinla: () => void;
}) {
  useEscapeKapat(onIptal);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div role="dialog" aria-modal="true" aria-labelledby="yayin-onay-baslik" className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
        <div id="yayin-onay-baslik" className="mb-2.5 text-base font-extrabold text-[#243957]">Yayın onayı</div>
        <div className="text-sm text-gray-500 leading-relaxed mb-3">
          <strong>{bekleyen.urun_adi}</strong> ürünü yayınlanacaktır.
        </div>
        <div className="flex items-center gap-2 mb-5">
          <HedefRolPilleri hedefRoller={bekleyen.hedef_roller} />
          <span className="text-xs text-gray-400">hedef kitleye yayınlanacak.</span>
        </div>
        <div className="flex gap-2.5 justify-end">
          <button type="button" onClick={onIptal}
            className="px-4 py-2 rounded-lg border border-gray-200 bg-transparent text-gray-500 text-xs cursor-pointer"
            style={{ fontFamily: "'Nunito', sans-serif" }}>İptal</button>
          <button type="button" onClick={onYayinla}
            className="px-4 py-2 rounded-lg border-none text-white text-xs font-semibold cursor-pointer"
            style={{ background: "#56aeff", fontFamily: "'Nunito', sans-serif" }}>Yayınla</button>
        </div>
      </div>
    </div>
  );
}

export function YayinSilmeModal({ bekleyen, islemde, onIptal, onSil }: {
  bekleyen: Bekleyen;
  islemde: boolean;
  onIptal: () => void;
  onSil: () => void;
}) {
  useEscapeKapat(islemde ? () => undefined : onIptal);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="yayin-silme-baslik" className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
        <div id="yayin-silme-baslik" className="mb-2.5 text-base font-extrabold text-[#243957]">Yayını Sil</div>
        <p className="mb-2 text-sm font-semibold text-gray-700">{bekleyen.urun_adi}</p>
        <p className="mb-5 text-sm leading-relaxed text-gray-500">Bu yayın onayınızla kalıcı olarak silinecektir. Onaylıyor musunuz?</p>
        <div className="flex justify-end gap-2.5">
          <button type="button" onClick={onIptal} disabled={islemde}
            className="rounded-lg border border-gray-200 bg-transparent px-4 py-2 text-xs text-gray-500 disabled:opacity-50">İptal</button>
          <button type="button" onClick={onSil} disabled={islemde}
            className="rounded-lg border-none bg-red-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
            {islemde ? "Siliniyor..." : "Kalıcı Olarak Sil"}
          </button>
        </div>
      </div>
    </div>
  );
}
