"use client";

import { useMemo, useRef } from "react";
import { Play } from "lucide-react";
import type { PanelOneri } from "../_hooks/useEclubPanel";

import { YayinKarti } from "@/components/yayin/YayinKarti";

interface Props {
  oneriler: PanelOneri[];
  seciliFirmaId: string | null;
  seciliFirmaAdi: string | null;
  onVideoSec: (oneri: PanelOneri) => void;
  onBegeni: (yayinId: string) => void;
  onFavori: (yayinId: string) => void;
}

function firmaIyelik(firmaAdi: string): string {
  const sonUnlu = [...firmaAdi.toLocaleLowerCase("tr-TR")].reverse().find((harf) => "aeıioöuü".includes(harf));
  const ek = sonUnlu && "aı".includes(sonUnlu)
    ? "ın"
    : sonUnlu && "ou".includes(sonUnlu)
      ? "un"
      : sonUnlu && "öü".includes(sonUnlu)
        ? "ün"
        : "in";
  return `${firmaAdi}'${ek}`;
}

function VideoKarti({ oneri, onSec, onBegeni, onFavori, etkilesimAktif }: { oneri: PanelOneri; onSec: () => void; onBegeni: () => void; onFavori: () => void; etkilesimAktif: boolean }) {
  const durumMetni = oneri.izlendi_mi
    ? "Tamamlandı"
    : oneri.oneri_durumu === "suresi_gecmis"
      ? "Süresi Geçti"
      : `${oneri.kalan_gun} gün`;

  return (
    <div className="w-40 shrink-0 snap-start sm:w-44 md:w-52">
      <YayinKarti
        yayin={{
          ...oneri,
          yayin_tarihi: oneri.created_at || oneri.oneri_baslangic,
        }}
        onClick={onSec}
        onBegeni={onBegeni}
        onFavori={onFavori}
        etkilesimAktif={etkilesimAktif}
        donguGoster={false}
        solUstRozet={
          <span className="rounded-full border border-white/30 bg-[#10233a]/70 px-2 py-0.5 text-[9px] font-extrabold text-white backdrop-blur-sm">
            {durumMetni}
          </span>
        }
        hoverOverlay={
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/45 bg-[#10233a]/65 text-white shadow-lg backdrop-blur-sm transition-transform group-hover:scale-105">
              <Play size={14} fill="currentColor" />
            </span>
          </span>
        }
      />
    </div>
  );
}

function VideoRafi({ baslik, videolar, onVideoSec, onBegeni, onFavori, etkilesimAktif }: { baslik: string; videolar: PanelOneri[]; onVideoSec: (oneri: PanelOneri) => void; onBegeni: (yayinId: string) => void; onFavori: (yayinId: string) => void; etkilesimAktif: boolean }) {
  const raf = useRef<HTMLDivElement>(null);
  const kaydir = (yon: number) => raf.current?.scrollBy({ left: yon * raf.current.clientWidth * 0.85, behavior: "smooth" });

  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h2 className="text-base font-extrabold text-[#243957] md:text-lg">{baslik}</h2>
        <span className="text-[11px] font-bold text-[#7b8ca5]">{videolar.length} içerik</span>
      </div>
      {videolar.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#d8e2ec] bg-white px-4 py-7 text-center text-xs font-semibold text-[#8a99aa]">Bu rafta henüz öğrenme içeriği bulunmuyor.</div>
      ) : (
        <div className="group relative">
          <button type="button" aria-label={`${baslik} rafını sola kaydır`} onClick={() => kaydir(-1)} className="absolute inset-y-0 left-0 z-10 flex w-16 cursor-pointer items-center justify-start bg-gradient-to-r from-gray-50 via-gray-50/70 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
            <svg className="h-7 w-7 text-gray-800 drop-shadow-sm" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div ref={raf} className="flex snap-x gap-2.5 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {videolar.map((oneri) => <VideoKarti key={oneri.oneri_id} oneri={oneri} onSec={() => onVideoSec(oneri)} onBegeni={() => onBegeni(oneri.yayin_id)} onFavori={() => onFavori(oneri.yayin_id)} etkilesimAktif={etkilesimAktif} />)}
          </div>
          <button type="button" aria-label={`${baslik} rafını sağa kaydır`} onClick={() => kaydir(1)} className="absolute inset-y-0 right-0 z-10 flex w-16 cursor-pointer items-center justify-end bg-gradient-to-l from-gray-50 via-gray-50/70 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
            <svg className="h-7 w-7 text-gray-800 drop-shadow-sm" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      )}
    </section>
  );
}

export default function EclubFirmaVideoKatalogu({ oneriler, seciliFirmaId, seciliFirmaAdi, onVideoSec, onBegeni, onFavori }: Props) {
  const firmaVideolari = useMemo(
    () => seciliFirmaId ? oneriler.filter((oneri) => oneri.firma_id === seciliFirmaId) : oneriler,
    [oneriler, seciliFirmaId],
  );
  const enCokBegenilen = useMemo(() => [...firmaVideolari]
    .filter((oneri) => oneri.begeni_sayisi > 0)
    .sort((a, b) => b.begeni_sayisi - a.begeni_sayisi || a.urun_adi.localeCompare(b.urun_adi, "tr"))
    .slice(0, 10), [firmaVideolari]);
  const enCokFavorilenen = useMemo(() => [...firmaVideolari]
    .filter((oneri) => oneri.favori_sayisi > 0)
    .sort((a, b) => b.favori_sayisi - a.favori_sayisi || a.urun_adi.localeCompare(b.urun_adi, "tr"))
    .slice(0, 10), [firmaVideolari]);
  const firmaBasligi = seciliFirmaAdi ? firmaIyelik(seciliFirmaAdi) : null;

  return (
    <div className="flex flex-col gap-6">
      <VideoRafi baslik={firmaBasligi ? `${firmaBasligi} Tüm İçerikleri` : "Tüm Firmaların İçerikleri"} videolar={firmaVideolari} onVideoSec={onVideoSec} onBegeni={onBegeni} onFavori={onFavori} etkilesimAktif />
      <VideoRafi baslik={firmaBasligi ? `${firmaBasligi} En Çok Beğenilenleri` : "En Çok Beğenilenler"} videolar={enCokBegenilen} onVideoSec={onVideoSec} onBegeni={onBegeni} onFavori={onFavori} etkilesimAktif={false} />
      <VideoRafi baslik={firmaBasligi ? `${firmaBasligi} En Çok Favorilenenleri` : "En Çok Favorilenenler"} videolar={enCokFavorilenen} onVideoSec={onVideoSec} onBegeni={onBegeni} onFavori={onFavori} etkilesimAktif={false} />
    </div>
  );
}
