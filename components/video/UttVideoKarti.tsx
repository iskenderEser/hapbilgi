"use client";

import { useRef, useState, type MouseEvent, type ReactNode } from "react";
import type { IcerikTuru } from "@/lib/video/icerikTuru";
import type { OgrenmeAraciTuru } from "@/lib/ogrenmeAraci/tipler";
import { YayinKarti } from "@/components/yayin/YayinKarti";

export type UttVideoDurumu = "yeni" | "devam" | "tamamlanan";

export interface UttVideo {
  yayin_id: string;
  talep_no?: number | null;
  firma_adi?: string | null;
  urun_adi: string;
  teknik_adi: string;
  video_url: string | null;
  thumbnail_url: string | null;
  video_puani: number | null;
  sonraki_tur_tarihi?: string | null;
  yayin_tarihi: string;
  extra_puan: number;
  ileri_sarma_acik: boolean;
  izlenme_sayisi: number;
  begeni_sayisi: number;
  favori_sayisi: number;
  begeni_mi: boolean;
  favori_mi: boolean;
  daha_once_izledi: boolean;
  icerik_turu: IcerikTuru | null;
  arac_id: string | null;
  arac_turu: OgrenmeAraciTuru;
  durum: UttVideoDurumu;
}

export interface UttEkstraVideo extends UttVideo {
  toplam_izlemem: number;
  bu_turda_izleme: number;
  extra_kalan: number;
  bu_ay_extra_kazanildi: boolean;
}

export interface UttVideoVeri {
  yeni_videolar: UttVideo[];
  devam_edenler: UttVideo[];
  tamamlananlar: UttVideo[];
  son_izlediklerim?: UttVideo[];
  ekstra_izlediklerim?: UttEkstraVideo[];
  istatistikler: {
    yeni: number;
    devam: number;
    tamamlanan: number;
    hafta_puani: number;
    toplam_puan: number;
  };
}

interface VideoEtkilesimHandlerlari {
  onVideoClick: (video: UttVideo) => void;
  onBegeni: (event: MouseEvent, yayinId: string) => void;
  onFavori: (event: MouseEvent, yayinId: string) => void;
}

interface VideoEtkilesimProps extends VideoEtkilesimHandlerlari {
  video: UttVideo;
  etkilesimAktif?: boolean;
}


export function UttVideoKarti({ video, onVideoClick, onBegeni, onFavori, etkilesimAktif = true }: VideoEtkilesimProps) {
  return (
    <YayinKarti
      yayin={video}
      onClick={() => onVideoClick(video)}
      onBegeni={onBegeni}
      onFavori={onFavori}
      etkilesimAktif={etkilesimAktif}
    />
  );
}

export function UttKayanVideoRafi<T extends UttVideo>({
  baslik,
  videolar,
  onVideoClick,
  onBegeni,
  onFavori,
  kartAlti,
  etkilesimAktif = true,
  varsayilanAcik = false,
}: VideoEtkilesimHandlerlari & {
  baslik: ReactNode;
  videolar: T[];
  kartAlti?: (video: T) => ReactNode;
  etkilesimAktif?: boolean;
  varsayilanAcik?: boolean;
}) {
  const [acik, setAcik] = useState(varsayilanAcik);
  const [gorunenSayisi, setGorunenSayisi] = useState(2);
  const raf = useRef<HTMLDivElement>(null);
  const kaydir = (yon: number) => raf.current?.scrollBy({ left: yon * raf.current.clientWidth * 0.85, behavior: "smooth" });

  if (videolar.length === 0) return null;

  const mobildeGorunenler = videolar.slice(0, gorunenSayisi);
  const kalanSayisi = videolar.length - gorunenSayisi;
  const acilacakSayi = Math.min(5, kalanSayisi);

  return (
    <div className="mb-6 rounded-2xl border border-gray-200/80 bg-white/70 p-3.5 shadow-xs sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
      {/* Başlık ve Akordeon Butonu (Mobilde tıklanabilir başlık, masaüstünde düz) */}
      <div
        onClick={() => setAcik((onceki) => !onceki)}
        className="flex cursor-pointer items-center justify-between gap-2 select-none sm:cursor-default sm:mb-2.5"
      >
        <div className="flex items-center gap-2">
          {baslik}
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-500 sm:hidden">
            {videolar.length}
          </span>
        </div>
        <div className="flex items-center gap-1 sm:hidden">
          <span className="text-xs font-semibold text-gray-400">
            {acik ? "Gizle" : "Göster"}
          </span>
          <svg
            className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${acik ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* MOBİL GÖRÜNÜM (< 640px): Kademeli Dikey Tek Sütun */}
      {acik && (
        <div className="mt-3 flex flex-col gap-3 sm:hidden">
          <div className="grid grid-cols-1 gap-4">
            {mobildeGorunenler.map((video) => (
              <div key={video.yayin_id} className="flex w-full flex-col gap-1">
                <UttVideoKarti
                  video={video}
                  onVideoClick={onVideoClick}
                  onBegeni={onBegeni}
                  onFavori={onFavori}
                  etkilesimAktif={etkilesimAktif}
                />
                {kartAlti?.(video)}
              </div>
            ))}
          </div>

          {kalanSayisi > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setGorunenSayisi((onceki) => onceki + 5);
              }}
              className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white py-2.5 text-xs font-extrabold text-gray-700 shadow-xs transition-colors hover:bg-gray-50 hover:text-gray-900 active:scale-[0.99]"
            >
              <span>Daha Fazla Göster (+{acilacakSayi})</span>
              <span className="text-[10px] font-medium text-gray-400">({kalanSayisi} içerik kaldı)</span>
            </button>
          )}
        </div>
      )}

      {/* MASAÜSTÜ & TABLET GÖRÜNÜMÜ (sm: >= 640px): Yatay Kayan Raf */}
      <div className="group relative hidden sm:block">
        <button
          type="button"
          aria-label="Sola kaydır"
          onClick={() => kaydir(-1)}
          className="absolute inset-y-0 left-0 z-10 flex w-16 cursor-pointer items-center justify-start bg-gradient-to-r from-gray-50 via-gray-50/70 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
        >
          <svg className="h-7 w-7 text-gray-800 drop-shadow-sm" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div ref={raf} className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {videolar.map((video) => (
            <div key={video.yayin_id} className="flex w-40 flex-shrink-0 snap-start flex-col gap-1 sm:w-44 md:w-52">
              <UttVideoKarti
                video={video}
                onVideoClick={onVideoClick}
                onBegeni={onBegeni}
                onFavori={onFavori}
                etkilesimAktif={etkilesimAktif}
              />
              {kartAlti?.(video)}
            </div>
          ))}
        </div>
        <button
          type="button"
          aria-label="Sağa kaydır"
          onClick={() => kaydir(1)}
          className="absolute inset-y-0 right-0 z-10 flex w-16 cursor-pointer items-center justify-end bg-gradient-to-l from-gray-50 via-gray-50/70 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
        >
          <svg className="h-7 w-7 text-gray-800 drop-shadow-sm" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
