"use client";

import { useMemo, useRef, useState } from "react";
import { Heart, Play, Star, Video } from "lucide-react";
import type { PanelOneri } from "../_hooks/useEclubPanel";

interface Props {
  oneriler: PanelOneri[];
  seciliFirmaId: string | null;
  onVideoSec: (oneri: PanelOneri) => void;
}

function SecimKarti({ etiket, deger, detay, aktif, onClick, ikon: Ikon = Video }: {
  etiket: string;
  deger: number;
  detay: string;
  aktif: boolean;
  onClick: () => void;
  ikon?: typeof Video;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={aktif}
      className={`rounded-2xl border border-l-[3px] border-l-[#237ac8] bg-white p-3.5 text-left shadow-[0_5px_16px_rgba(31,55,90,0.035)] transition hover:-translate-y-0.5 hover:shadow-md ${aktif ? "border-[#9bc6eb] ring-2 ring-[#d8eafa]" : "border-[#dfe7f1]"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[10px] font-extrabold uppercase tracking-[0.05em] text-[#8190a3]">{etiket}</div>
          <div className="mt-1 text-2xl font-black tabular-nums text-[#237ac8]">{deger}</div>
          <div className="mt-0.5 truncate text-[10px] font-semibold text-[#8796a8]">{detay}</div>
        </div>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#edf6fd] text-[#237ac8]"><Ikon size={16} /></span>
      </div>
    </button>
  );
}

function VideoKarti({ oneri, onSec }: { oneri: PanelOneri; onSec: () => void }) {
  return (
    <article className="group w-40 shrink-0 snap-start overflow-hidden rounded-xl border border-[#dfe7f1] bg-white transition hover:-translate-y-0.5 hover:border-[#b9d5f0] hover:shadow-[0_10px_24px_rgba(31,55,90,0.10)] sm:w-44 md:w-52">
      <button type="button" onClick={onSec} className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#56aeff]">
        <div className="relative aspect-video overflow-hidden bg-[#edf3f8]">
          {oneri.thumbnail_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={oneri.thumbnail_url} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
            : <span className="flex h-full items-center justify-center text-[#9babbc]"><Video size={26} /></span>}
          <div className="absolute inset-0 bg-gradient-to-t from-[#10233a]/45 via-transparent to-transparent" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/45 bg-[#10233a]/65 text-white shadow-lg backdrop-blur-sm transition-transform group-hover:scale-105"><Play size={14} fill="currentColor" /></span>
          </span>
          <span className="absolute right-2 top-2 rounded-full border border-white/30 bg-[#10233a]/70 px-2 py-1 text-[9px] font-extrabold text-white backdrop-blur-sm">
            {oneri.izlendi_mi ? "Tamamlandı" : oneri.oneri_durumu === "suresi_gecmis" ? "Süresi Geçti" : `${oneri.kalan_gun} gün`}
          </span>
        </div>
        <div className="p-3">
          <div className="truncate text-sm font-extrabold text-[#243957]">{oneri.urun_adi}</div>
          <div className="mt-1 truncate text-[10px] font-bold text-[#7b8ca5]">{oneri.teknik_adi || "Ürün eğitimi"}</div>
          <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg bg-[#f7f9fc] px-2 py-1.5 text-[10px] text-[#70849d]">
            <span className="text-center"><b className="text-[#314a68]">+{oneri.video_puani}</b> puan</span>
            <span className="flex items-center justify-center gap-1 border-x border-[#e2e9f1]"><Heart size={11} /><b className="text-[#314a68]">{oneri.begeni_sayisi}</b></span>
            <span className="flex items-center justify-center gap-1"><Star size={11} /><b className="text-[#314a68]">{oneri.favori_sayisi}</b></span>
          </div>
        </div>
      </button>
    </article>
  );
}

function VideoRafi({ baslik, videolar, onVideoSec }: { baslik: string; videolar: PanelOneri[]; onVideoSec: (oneri: PanelOneri) => void }) {
  const raf = useRef<HTMLDivElement>(null);
  const kaydir = (yon: number) => raf.current?.scrollBy({ left: yon * raf.current.clientWidth * 0.85, behavior: "smooth" });

  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h2 className="text-base font-extrabold text-[#243957] md:text-lg">{baslik}</h2>
        <span className="text-[11px] font-bold text-[#7b8ca5]">{videolar.length} video</span>
      </div>
      {videolar.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#d8e2ec] bg-white px-4 py-7 text-center text-xs font-semibold text-[#8a99aa]">Bu rafta henüz video bulunmuyor.</div>
      ) : (
        <div className="group relative">
          <button type="button" aria-label={`${baslik} rafını sola kaydır`} onClick={() => kaydir(-1)} className="absolute inset-y-0 left-0 z-10 hidden w-12 items-center justify-start bg-gradient-to-r from-[#f7f9fc] to-transparent opacity-0 transition group-hover:opacity-100 md:flex">‹</button>
          <div ref={raf} className="flex snap-x gap-2.5 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {videolar.map((oneri) => <VideoKarti key={oneri.oneri_id} oneri={oneri} onSec={() => onVideoSec(oneri)} />)}
          </div>
          <button type="button" aria-label={`${baslik} rafını sağa kaydır`} onClick={() => kaydir(1)} className="absolute inset-y-0 right-0 z-10 hidden w-12 items-center justify-end bg-gradient-to-l from-[#f7f9fc] to-transparent text-xl opacity-0 transition group-hover:opacity-100 md:flex">›</button>
        </div>
      )}
    </section>
  );
}

export default function EclubFirmaVideoKatalogu({ oneriler, seciliFirmaId, onVideoSec }: Props) {
  const [seciliUrun, setSeciliUrun] = useState<string | null>(null);
  const firmaVideolari = useMemo(
    () => oneriler.filter((oneri) => oneri.firma_id === seciliFirmaId),
    [oneriler, seciliFirmaId],
  );
  const urunler = useMemo(() => [...new Set(firmaVideolari.map((oneri) => oneri.urun_adi))].sort((a, b) => a.localeCompare(b, "tr")), [firmaVideolari]);
  const urunVideolari = useMemo(() => firmaVideolari.filter((oneri) => oneri.urun_adi === seciliUrun), [firmaVideolari, seciliUrun]);
  const enSonIzlenen = useMemo(() => [...urunVideolari].filter((oneri) => oneri.izleme_baslangic).sort((a, b) => new Date(b.izleme_baslangic!).getTime() - new Date(a.izleme_baslangic!).getTime()), [urunVideolari]);
  const enCokBegenilen = useMemo(() => [...urunVideolari].filter((oneri) => oneri.begeni_sayisi > 0).sort((a, b) => b.begeni_sayisi - a.begeni_sayisi), [urunVideolari]);
  const enCokFavorilenen = useMemo(() => [...urunVideolari].filter((oneri) => oneri.favori_sayisi > 0).sort((a, b) => b.favori_sayisi - a.favori_sayisi), [urunVideolari]);
  const yaridaBirakilan = useMemo(() => urunVideolari.filter((oneri) => oneri.izleme_baslangic && !oneri.izleme_tamamlandi_mi), [urunVideolari]);

  return (
    <div className="flex flex-col gap-6">
      {seciliFirmaId && (
        <>
          <VideoRafi baslik="Tümü" videolar={firmaVideolari} onVideoSec={onVideoSec} />
          <section>
            <h2 className="mb-2.5 text-base font-extrabold text-[#243957] md:text-lg">Ürünler</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {urunler.map((urun) => (
                <SecimKarti key={urun} etiket={urun} deger={firmaVideolari.filter((oneri) => oneri.urun_adi === urun).length} detay="Ürün videosu" aktif={seciliUrun === urun} onClick={() => setSeciliUrun(urun)} />
              ))}
            </div>
          </section>
        </>
      )}

      {seciliUrun && (
        <div className="flex flex-col gap-6">
          <VideoRafi baslik="Yarıda Bıraktıklarınız" videolar={yaridaBirakilan} onVideoSec={onVideoSec} />
          <VideoRafi baslik="En Son İzledikleriniz" videolar={enSonIzlenen} onVideoSec={onVideoSec} />
          <VideoRafi baslik="En Çok Beğenilenler" videolar={enCokBegenilen} onVideoSec={onVideoSec} />
          <VideoRafi baslik="En Çok Favorilenenler" videolar={enCokFavorilenen} onVideoSec={onVideoSec} />
        </div>
      )}
    </div>
  );
}
