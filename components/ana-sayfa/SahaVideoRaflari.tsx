"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import type { SahaAnaSayfaVideo } from "@/lib/video/anaSayfaVideolari";
import { anaSayfaRaflari } from "@/lib/video/anaSayfaRaflari";
import { TUR_BASLIK } from "@/lib/video/icerikTuru";
import { thumbnailUrlUret } from "@/lib/video/thumbnail";
import { talepIdGoster } from "@/lib/utils/talepId";

interface Props {
  videolar: SahaAnaSayfaVideo[];
  onVideoSec: (video: SahaAnaSayfaVideo) => void;
}

const GRADYANLAR = [
  "linear-gradient(135deg, #b5d4f4, #56aeff)",
  "linear-gradient(135deg, #c0dd97, #639922)",
  "linear-gradient(135deg, #f5c4b3, #D85A30)",
  "linear-gradient(135deg, #CECBF6, #534AB7)",
  "linear-gradient(135deg, #9FE1CB, #1D9E75)",
];

const tarih = (deger: string) =>
  new Date(deger).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });

function SahaVideoKarti({ video, onVideoSec }: { video: SahaAnaSayfaVideo; onVideoSec: Props["onVideoSec"] }) {
  const kapak = video.thumbnail_url ?? thumbnailUrlUret(video.video_url);
  const gradyan = GRADYANLAR[Math.abs(video.yayin_id.charCodeAt(0)) % GRADYANLAR.length];

  return (
    <button
      type="button"
      onClick={() => onVideoSec(video)}
      className="group h-full w-full overflow-hidden rounded-xl border border-gray-200 bg-white text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
      aria-label={`${video.urun_adi} videosunu aç`}
    >
      <span className="relative block aspect-video overflow-hidden bg-gray-100">
        {kapak ? (
          <img src={kapak} alt={video.urun_adi} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
        ) : (
          <span className="block h-full w-full" style={{ background: gradyan }} />
        )}
        {video.icerik_turu && (
          <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/70 px-1.5 py-0.5 text-[9px] font-bold text-white">
            {TUR_BASLIK[video.icerik_turu]}
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/5 transition-colors group-hover:bg-black/15">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white shadow-sm transition-transform group-hover:scale-105">
            <svg aria-hidden="true" width="9" height="11" viewBox="0 0 10 12" fill="currentColor"><path d="M0 0l10 6-10 6z" /></svg>
          </span>
        </span>
      </span>

      <span className="block p-2.5">
        <strong className="block truncate text-xs font-extrabold text-gray-900">{video.urun_adi}</strong>
        <span className="mt-0.5 block truncate text-[10px] font-semibold text-gray-500">{video.teknik_adi || "Teknik belirtilmedi"}</span>
        <span className="mt-2 flex items-center justify-between gap-2 text-[10px] text-gray-500">
          <span>{tarih(video.yayin_tarihi)}</span>
          <span className="whitespace-nowrap">{video.izlenme_sayisi} izlenme</span>
        </span>
        <span className="mt-1.5 flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-[10px] font-bold text-gray-500">
            <span aria-label={`${video.begeni_sayisi} beğeni`}>♡ {video.begeni_sayisi}</span>
            <span aria-label={`${video.favori_sayisi} favori`}>☆ {video.favori_sayisi}</span>
          </span>
          {video.talep_no != null && (
            <span className="truncate font-mono text-[9px] text-[#bc2d0d]">{talepIdGoster(video.firma_adi, video.talep_no)}</span>
          )}
        </span>
      </span>
    </button>
  );
}

function KayanRaf({ baslik, videolar, onVideoSec }: { baslik: ReactNode; videolar: SahaAnaSayfaVideo[]; onVideoSec: Props["onVideoSec"] }) {
  const raf = useRef<HTMLDivElement>(null);
  const kaydir = (yon: number) => raf.current?.scrollBy({ left: yon * raf.current.clientWidth * 0.85, behavior: "smooth" });

  return (
    <section className="mb-6">
      <div className="mb-2.5 flex items-center gap-1">{baslik}</div>
      <div className="group relative">
        <button type="button" aria-label="Sola kaydır" onClick={() => kaydir(-1)} className="absolute inset-y-0 left-0 z-10 flex w-16 items-center justify-start bg-gradient-to-r from-gray-50 via-gray-50/70 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
          <svg className="h-7 w-7 text-gray-800 drop-shadow-sm" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div ref={raf} className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {videolar.map((video) => (
            <div key={video.yayin_id} className="w-40 flex-shrink-0 snap-start sm:w-44 md:w-52">
              <SahaVideoKarti video={video} onVideoSec={onVideoSec} />
            </div>
          ))}
        </div>
        <button type="button" aria-label="Sağa kaydır" onClick={() => kaydir(1)} className="absolute inset-y-0 right-0 z-10 flex w-16 items-center justify-end bg-gradient-to-l from-gray-50 via-gray-50/70 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
          <svg className="h-7 w-7 text-gray-800 drop-shadow-sm" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
    </section>
  );
}

function SabitBolum({ baslik, videolar, onVideoSec }: { baslik: string; videolar: SahaAnaSayfaVideo[]; onVideoSec: Props["onVideoSec"] }) {
  if (videolar.length === 0) return null;
  return (
    <section className="mb-6">
      <h2 className="mb-2.5 text-base font-bold text-gray-900 md:text-lg">{baslik}</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {videolar.map((video) => <SahaVideoKarti key={video.yayin_id} video={video} onVideoSec={onVideoSec} />)}
      </div>
    </section>
  );
}

export default function SahaVideoRaflari({ videolar, onVideoSec }: Props) {
  const [tohum] = useState(() => Date.now());
  const raflar = useMemo(() => anaSayfaRaflari(videolar, tohum), [videolar, tohum]);
  const enCokIzlenen = useMemo(
    () => [...videolar].filter((video) => video.izlenme_sayisi > 0).sort((a, b) => b.izlenme_sayisi - a.izlenme_sayisi).slice(0, 5),
    [videolar],
  );
  const enCokBegenilen = useMemo(
    () => [...videolar].filter((video) => video.begeni_sayisi > 0).sort((a, b) => b.begeni_sayisi - a.begeni_sayisi).slice(0, 5),
    [videolar],
  );

  if (videolar.length === 0) return null;

  return (
    <div>
      <KayanRaf
        baslik={<><span className="text-base font-bold text-gray-900 md:text-lg">Tümü</span><span aria-hidden="true" className="text-lg text-gray-900">›</span></>}
        videolar={raflar.tumuRafi}
        onVideoSec={onVideoSec}
      />
      <SabitBolum baslik="🔥 En Çok İzlenenler" videolar={enCokIzlenen} onVideoSec={onVideoSec} />
      <SabitBolum baslik="❤️ En Çok Beğenilenler" videolar={enCokBegenilen} onVideoSec={onVideoSec} />
      {raflar.egitimTuruRaflari.map((raf) => (
        <KayanRaf key={raf.tur} baslik={<h2 className="text-base font-bold text-gray-900 md:text-lg">{TUR_BASLIK[raf.tur]}</h2>} videolar={raf.videolar} onVideoSec={onVideoSec} />
      ))}
    </div>
  );
}
