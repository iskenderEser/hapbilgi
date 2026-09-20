"use client";

import { useRef, type MouseEvent, type ReactNode } from "react";
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

export function UttKayanVideoRafi<T extends UttVideo>({ baslik, videolar, onVideoClick, onBegeni, onFavori, kartAlti, etkilesimAktif = true }: VideoEtkilesimHandlerlari & { baslik: ReactNode; videolar: T[]; kartAlti?: (video: T) => ReactNode; etkilesimAktif?: boolean }) {
  const raf = useRef<HTMLDivElement>(null);
  const kaydir = (yon: number) => raf.current?.scrollBy({ left: yon * raf.current.clientWidth * 0.85, behavior: "smooth" });

  return (
    <div className="mb-6">
      <div className="mb-2.5 flex items-center gap-1">{baslik}</div>
      <div className="group relative">
        <button type="button" aria-label="Sola kaydır" onClick={() => kaydir(-1)} className="absolute inset-y-0 left-0 z-10 flex w-16 cursor-pointer items-center justify-start bg-gradient-to-r from-gray-50 via-gray-50/70 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
          <svg className="h-7 w-7 text-gray-800 drop-shadow-sm" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div ref={raf} className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {videolar.map((video) => <div key={video.yayin_id} className="flex w-40 flex-shrink-0 snap-start flex-col gap-1 sm:w-44 md:w-52"><UttVideoKarti video={video} onVideoClick={onVideoClick} onBegeni={onBegeni} onFavori={onFavori} etkilesimAktif={etkilesimAktif} />{kartAlti?.(video)}</div>)}
        </div>
        <button type="button" aria-label="Sağa kaydır" onClick={() => kaydir(1)} className="absolute inset-y-0 right-0 z-10 flex w-16 cursor-pointer items-center justify-end bg-gradient-to-l from-gray-50 via-gray-50/70 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
          <svg className="h-7 w-7 text-gray-800 drop-shadow-sm" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
    </div>
  );
}
