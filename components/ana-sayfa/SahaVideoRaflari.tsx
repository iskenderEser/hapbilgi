"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import type { SahaAnaSayfaVideo } from "@/lib/video/anaSayfaVideolari";
import { anaSayfaRaflari } from "@/lib/video/anaSayfaRaflari";
import { TUR_BASLIK } from "@/lib/video/icerikTuru";
import { YayinTuruFiltresi, type YayinTuruFiltreDegeri } from "@/components/ogrenme-araci/YayinTuruFiltresi";
import { YAYIN_TURLERI } from "@/lib/ogrenmeAraci/turSunumu";

import { YayinKarti } from "@/components/yayin/YayinKarti";
import HayaletTanburSecici, { type TanburBolum } from "@/components/navigasyon/HayaletTanburSecici";

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

import MobilYayinAkisi from "@/components/yayin/MobilYayinAkisi";

function KayanRaf({
  baslik,
  videolar,
  onVideoSec,
  sifirlamaAnahtari,
}: {
  baslik: ReactNode;
  videolar: SahaAnaSayfaVideo[];
  onVideoSec: Props["onVideoSec"];
  sifirlamaAnahtari?: string | number;
}) {
  const raf = useRef<HTMLDivElement>(null);
  const kaydir = (yon: number) => raf.current?.scrollBy({ left: yon * raf.current.clientWidth * 0.85, behavior: "smooth" });

  if (videolar.length === 0) return null;

  const masaustuIcerik = (
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
  );

  return (
    <MobilYayinAkisi<SahaAnaSayfaVideo>
      kayitlar={videolar}
      kayitAnahtari={(v) => v.yayin_id}
      renderKart={(video) => (
        <div className="w-full">
          <SahaVideoKarti video={video} onVideoSec={onVideoSec} />
        </div>
      )}
      baslik={baslik}
      sayacGoster={true}
      sifirlamaAnahtari={sifirlamaAnahtari}
      className="mb-6"
      masaustuIcerik={masaustuIcerik}
    />
  );
}

function SabitBolum({
  baslik,
  videolar,
  onVideoSec,
  sifirlamaAnahtari,
}: {
  baslik: string;
  videolar: SahaAnaSayfaVideo[];
  onVideoSec: Props["onVideoSec"];
  sifirlamaAnahtari?: string | number;
}) {
  if (videolar.length === 0) return null;

  const masaustuIcerik = (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {videolar.map((video) => (
        <SahaVideoKarti key={video.yayin_id} video={video} onVideoSec={onVideoSec} />
      ))}
    </div>
  );

  return (
    <MobilYayinAkisi<SahaAnaSayfaVideo>
      kayitlar={videolar}
      kayitAnahtari={(v) => v.yayin_id}
      renderKart={(video) => (
        <div className="w-full">
          <SahaVideoKarti video={video} onVideoSec={onVideoSec} />
        </div>
      )}
      baslik={<h2 className="text-base font-bold text-gray-900 md:text-lg">{baslik}</h2>}
      sayacGoster={true}
      sifirlamaAnahtari={sifirlamaAnahtari}
      className="mb-6"
      masaustuIcerik={masaustuIcerik}
    />
  );
}

export default function SahaVideoRaflari({ videolar, onVideoSec }: Props) {
  const [tohum] = useState(() => Date.now());
  const [aktifYayinTuru, setAktifYayinTuru] = useState<YayinTuruFiltreDegeri>("tumu");
  const [aktifTanburBolumu, setAktifTanburBolumu] = useState<string>("tumu");
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

  const tanburBolumleri = useMemo(() => {
    const liste: TanburBolum[] = [
      { id: "tumu", etiket: "Tüm Bölümler" },
    ];
    if (raflar.tumuRafi.length > 0) liste.push({ id: "tumu_rafi", etiket: "Tümü", sayi: raflar.tumuRafi.length });
    if (enCokIzlenen.length > 0) liste.push({ id: "en_cok_izlenen", etiket: "En Çok İzlenenler", sayi: enCokIzlenen.length });
    if (enCokBegenilen.length > 0) liste.push({ id: "en_cok_begenilen", etiket: "En Çok Beğenilenler", sayi: enCokBegenilen.length });
    raflar.egitimTuruRaflari.forEach((raf) => {
      liste.push({ id: `tur_${raf.tur}`, etiket: TUR_BASLIK[raf.tur], sayi: raf.videolar.length });
    });
    return liste;
  }, [raflar, enCokIzlenen, enCokBegenilen]);

  if (videolar.length === 0) return null;

  return (
    <div>
      <div className="mb-5"><YayinTuruFiltresi secili={aktifYayinTuru} onSec={setAktifYayinTuru} sayilar={turSayilari} /></div>

      {aktifTanburBolumu !== "tumu" && (
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-blue-200/80 bg-blue-50/90 px-4 py-2.5 text-xs font-bold text-blue-900 shadow-xs sm:hidden">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
            <span className="text-xs font-black">Odak: {tanburBolumleri.find((b) => b.id === aktifTanburBolumu)?.etiket}</span>
          </div>
          <button
            type="button"
            onClick={() => setAktifTanburBolumu("tumu")}
            className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-extrabold text-blue-600 shadow-xs hover:bg-blue-100 active:scale-95"
          >
            Tümünü Göster
          </button>
        </div>
      )}

      {(aktifTanburBolumu === "tumu" || aktifTanburBolumu === "tumu_rafi") && (
        <KayanRaf
          key={`tumu_${aktifTanburBolumu}`}
          baslik={<><span className="text-base font-bold text-gray-900 md:text-lg">Tümü</span><span aria-hidden="true" className="text-lg text-gray-900">›</span></>}
          videolar={raflar.tumuRafi}
          onVideoSec={onVideoSec}
          sifirlamaAnahtari={`${aktifTanburBolumu}-${aktifYayinTuru}`}
        />
      )}
      {(aktifTanburBolumu === "tumu" || aktifTanburBolumu === "en_cok_izlenen") && (
        <SabitBolum
          key={`izlenen_${aktifTanburBolumu}`}
          baslik="🔥 En Çok İzlenenler"
          videolar={enCokIzlenen}
          onVideoSec={onVideoSec}
          sifirlamaAnahtari={`${aktifTanburBolumu}-${aktifYayinTuru}`}
        />
      )}
      {(aktifTanburBolumu === "tumu" || aktifTanburBolumu === "en_cok_begenilen") && (
        <SabitBolum
          key={`begenilen_${aktifTanburBolumu}`}
          baslik="❤️ En Çok Beğenilenler"
          videolar={enCokBegenilen}
          onVideoSec={onVideoSec}
          sifirlamaAnahtari={`${aktifTanburBolumu}-${aktifYayinTuru}`}
        />
      )}
      {raflar.egitimTuruRaflari.map((raf) => {
        const id = `tur_${raf.tur}`;
        if (aktifTanburBolumu !== "tumu" && aktifTanburBolumu !== id) return null;
        return (
          <KayanRaf
            key={`${raf.tur}_${aktifTanburBolumu}`}
            baslik={<h2 className="text-base font-bold text-gray-900 md:text-lg">{TUR_BASLIK[raf.tur]}</h2>}
            videolar={raf.videolar}
            onVideoSec={onVideoSec}
            sifirlamaAnahtari={`${aktifTanburBolumu}-${aktifYayinTuru}`}
          />
        );
      })}

      <HayaletTanburSecici
        bolumler={tanburBolumleri}
        seciliId={aktifTanburBolumu}
        onSec={setAktifTanburBolumu}
      />
    </div>
  );
}
