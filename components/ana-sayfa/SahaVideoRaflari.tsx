"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import type { SahaAnaSayfaVideo } from "@/lib/video/anaSayfaVideolari";
import { anaSayfaRaflari } from "@/lib/video/anaSayfaRaflari";
import { TUR_BASLIK } from "@/lib/video/icerikTuru";
import { YayinTuruFiltresi, type YayinTuruFiltreDegeri } from "@/components/ogrenme-araci/YayinTuruFiltresi";
import { YAYIN_TURLERI } from "@/lib/ogrenmeAraci/turSunumu";

import { YayinKarti } from "@/components/yayin/YayinKarti";

interface Props {
  videolar: SahaAnaSayfaVideo[];
  onVideoSec: (video: SahaAnaSayfaVideo) => void;
}

function SahaVideoKarti({ video, onVideoSec }: { video: SahaAnaSayfaVideo; onVideoSec: Props["onVideoSec"] }) {
  return (
    <YayinKarti
      yayin={video}
      onClick={() => onVideoSec(video)}
      etkilesimAktif={false}
      durumGoster={false}
      puanGoster={false}
      donguGoster={false}
      hoverOverlay={
        <span className="absolute inset-0 flex items-center justify-center bg-black/5 transition-colors group-hover:bg-black/15">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white shadow-sm transition-transform group-hover:scale-105">
            <svg aria-hidden="true" width="9" height="11" viewBox="0 0 10 12" fill="currentColor"><path d="M0 0l10 6-10 6z" /></svg>
          </span>
        </span>
      }
    />
  );
}

function KayanRaf({
  baslik,
  videolar,
  onVideoSec,
  varsayilanAcik = false,
}: {
  baslik: ReactNode;
  videolar: SahaAnaSayfaVideo[];
  onVideoSec: Props["onVideoSec"];
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
    <section className="mb-6 rounded-2xl border border-gray-200/80 bg-white/70 p-3.5 shadow-xs sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
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

      {/* MOBİL GÖRÜNÜM (< 640px) */}
      {acik && (
        <div className="mt-3 flex flex-col gap-3 sm:hidden">
          <div className="grid grid-cols-1 gap-4">
            {mobildeGorunenler.map((video) => (
              <div key={video.yayin_id} className="w-full">
                <SahaVideoKarti video={video} onVideoSec={onVideoSec} />
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

      {/* MASAÜSTÜ & TABLET (sm: >= 640px) */}
      <div className="group relative hidden sm:block">
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

function SabitBolum({
  baslik,
  videolar,
  onVideoSec,
  varsayilanAcik = false,
}: {
  baslik: string;
  videolar: SahaAnaSayfaVideo[];
  onVideoSec: Props["onVideoSec"];
  varsayilanAcik?: boolean;
}) {
  const [acik, setAcik] = useState(varsayilanAcik);
  const [gorunenSayisi, setGorunenSayisi] = useState(2);

  if (videolar.length === 0) return null;

  const mobildeGorunenler = videolar.slice(0, gorunenSayisi);
  const kalanSayisi = videolar.length - gorunenSayisi;
  const acilacakSayi = Math.min(5, kalanSayisi);

  return (
    <section className="mb-6 rounded-2xl border border-gray-200/80 bg-white/70 p-3.5 shadow-xs sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
      <div
        onClick={() => setAcik((onceki) => !onceki)}
        className="flex cursor-pointer items-center justify-between gap-2 select-none sm:cursor-default sm:mb-2.5"
      >
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-gray-900 md:text-lg">{baslik}</h2>
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

      {/* MOBİL (< 640px) */}
      {acik && (
        <div className="mt-3 flex flex-col gap-3 sm:hidden">
          <div className="grid grid-cols-1 gap-4">
            {mobildeGorunenler.map((video) => (
              <SahaVideoKarti key={video.yayin_id} video={video} onVideoSec={onVideoSec} />
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

      {/* MASAÜSTÜ & TABLET (sm: >= 640px) */}
      <div className="hidden sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {videolar.map((video) => (
          <SahaVideoKarti key={video.yayin_id} video={video} onVideoSec={onVideoSec} />
        ))}
      </div>
    </section>
  );
}

export default function SahaVideoRaflari({ videolar, onVideoSec }: Props) {
  const [tohum] = useState(() => Date.now());
  const [aktifYayinTuru, setAktifYayinTuru] = useState<YayinTuruFiltreDegeri>("tumu");
  const turSayilari = Object.fromEntries(YAYIN_TURLERI.map((tur) => [tur, videolar.filter((video) => video.arac_turu === tur).length])) as Record<NonNullable<SahaAnaSayfaVideo["arac_turu"]>, number>;
  const filtrelenmisVideolar = useMemo(() => videolar.filter((video) => aktifYayinTuru === "tumu" || video.arac_turu === aktifYayinTuru), [videolar, aktifYayinTuru]);
  const raflar = useMemo(() => anaSayfaRaflari(filtrelenmisVideolar, tohum), [filtrelenmisVideolar, tohum]);
  const enCokIzlenen = useMemo(
    () => [...filtrelenmisVideolar].filter((video) => video.izlenme_sayisi > 0).sort((a, b) => b.izlenme_sayisi - a.izlenme_sayisi).slice(0, 5),
    [filtrelenmisVideolar],
  );
  const enCokBegenilen = useMemo(
    () => [...filtrelenmisVideolar].filter((video) => video.begeni_sayisi > 0).sort((a, b) => b.begeni_sayisi - a.begeni_sayisi).slice(0, 5),
    [filtrelenmisVideolar],
  );

  if (videolar.length === 0) return null;

  return (
    <div>
      <div className="mb-5"><YayinTuruFiltresi secili={aktifYayinTuru} onSec={setAktifYayinTuru} sayilar={turSayilari} /></div>
      <KayanRaf
        baslik={<><span className="text-base font-bold text-gray-900 md:text-lg">Tümü</span><span aria-hidden="true" className="text-lg text-gray-900">›</span></>}
        videolar={raflar.tumuRafi}
        onVideoSec={onVideoSec}
        varsayilanAcik={true}
      />
      <SabitBolum baslik="🔥 En Çok İzlenenler" videolar={enCokIzlenen} onVideoSec={onVideoSec} />
      <SabitBolum baslik="❤️ En Çok Beğenilenler" videolar={enCokBegenilen} onVideoSec={onVideoSec} />
      {raflar.egitimTuruRaflari.map((raf) => (
        <KayanRaf key={raf.tur} baslik={<h2 className="text-base font-bold text-gray-900 md:text-lg">{TUR_BASLIK[raf.tur]}</h2>} videolar={raf.videolar} onVideoSec={onVideoSec} />
      ))}
    </div>
  );
}
