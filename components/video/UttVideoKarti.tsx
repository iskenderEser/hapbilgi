"use client";

import { useRef, type MouseEvent, type ReactNode } from "react";
import { thumbnailUrlUret } from "@/lib/video/thumbnail";
import { TUR_BASLIK, type IcerikTuru } from "@/lib/video/icerikTuru";
import { talepIdGoster } from "@/lib/utils/talepId";

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

const GRADYANLAR = [
  "linear-gradient(135deg, #b5d4f4, #56aeff)",
  "linear-gradient(135deg, #c0dd97, #639922)",
  "linear-gradient(135deg, #f5c4b3, #D85A30)",
  "linear-gradient(135deg, #CECBF6, #534AB7)",
  "linear-gradient(135deg, #9FE1CB, #1D9E75)",
];

const GUN_MS = 24 * 60 * 60 * 1000;
const kalanGun = (tarih: string) => Math.max(0, Math.ceil((new Date(tarih).getTime() - Date.now()) / GUN_MS));
const formatTarih = (tarih: string) =>
  new Date(tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });

export function UttVideoKarti({ video, onVideoClick, onBegeni, onFavori, etkilesimAktif = true }: VideoEtkilesimProps) {
  const thumbnail = video.thumbnail_url || thumbnailUrlUret(video.video_url || "");
  const gradyan = GRADYANLAR[parseInt(video.yayin_id, 36) % GRADYANLAR.length];

  return (
    <div className="group cursor-pointer overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md" onClick={() => onVideoClick(video)}>
      <div className="relative aspect-video overflow-hidden bg-gray-100">
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnail} alt={video.urun_adi} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center" style={{ background: gradyan }}>
            <span className="text-base font-bold text-white">{video.urun_adi?.charAt(0) || "V"}</span>
          </div>
        )}

        {video.durum === "yeni" && <div className="absolute right-1.5 top-1.5 rounded-full bg-blue-500 px-1.5 py-0.5 text-[10px] text-white shadow-sm">Yeni</div>}
        {video.durum === "devam" && <div className="absolute right-1.5 top-1.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">Yarım Kaldı</div>}
        {video.durum === "tamamlanan" && <div className="absolute right-1.5 top-1.5 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] text-white">✓ İzlendi</div>}
        {video.icerik_turu && <div className="absolute bottom-1.5 left-1.5 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] text-white">{TUR_BASLIK[video.icerik_turu]}</div>}
      </div>

      <div className="p-2.5">
        <div className="flex items-start justify-between gap-1.5">
          <h3 className="line-clamp-2 flex-1 text-xs font-bold text-gray-900">{video.urun_adi}</h3>
          <div className="flex flex-shrink-0 items-center gap-0.5">
            <button type="button" disabled={!etkilesimAktif} onClick={(event) => onBegeni(event, video.yayin_id)} aria-label="Beğen" className={`rounded-full p-0.5 transition-colors ${!etkilesimAktif ? "cursor-default text-red-500" : video.begeni_mi ? "text-red-500" : "text-gray-400 hover:text-gray-600"}`}>
              <svg className="h-3.5 w-3.5" fill={!etkilesimAktif || video.begeni_mi ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
            </button>
            <span className="text-[10px] text-gray-500">{video.begeni_sayisi}</span>
            <button type="button" disabled={!etkilesimAktif} onClick={(event) => onFavori(event, video.yayin_id)} aria-label="Favoriye ekle" className={`rounded-full p-0.5 transition-colors ${!etkilesimAktif ? "cursor-default text-yellow-500" : video.favori_mi ? "text-yellow-500" : "text-gray-400 hover:text-gray-600"}`}>
              <svg className="h-3.5 w-3.5" fill={!etkilesimAktif || video.favori_mi ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
            </button>
            <span className="text-[10px] text-gray-500">{video.favori_sayisi}</span>
          </div>
        </div>

        <div className="mt-1.5 flex items-center justify-between text-[10px] text-gray-500"><span>{formatTarih(video.yayin_tarihi)}</span><span>{video.izlenme_sayisi} izlenme</span></div>
        <div className="mt-1.5 flex items-center justify-between gap-1">
          <div className="flex items-center gap-1">
            {video.video_puani !== null && <><span className="text-[10px] font-bold text-yellow-600">★ {video.video_puani}</span>{video.extra_puan > 0 && <span className="text-[10px] text-green-600">+{video.extra_puan} extra</span>}</>}
          </div>
          {video.talep_no != null && <span className="font-mono text-[10px] text-[#bc2d0d]">{talepIdGoster(video.firma_adi, video.talep_no)}</span>}
        </div>
        {video.daha_once_izledi && video.sonraki_tur_tarihi && <span className="mt-1.5 inline-block w-fit rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700">{kalanGun(video.sonraki_tur_tarihi)} gün sonra yeniden puanlı</span>}
        {video.durum === "devam" && <div className="mt-2 flex items-center justify-between rounded-lg bg-amber-50 px-2 py-1.5 text-[10px] font-bold text-amber-700"><span>Baştan İzle</span><span aria-hidden="true">→</span></div>}
      </div>
    </div>
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
