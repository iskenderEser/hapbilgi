"use client";

import { useRef } from "react";
import {
  BookOpen,
  Clock3,
  FileText,
  Headphones,
  Image as ImageIcon,
  Play,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { EczanemAracTuru, EczanemMusteriVideo } from "../_types";
import { YayinKarti } from "@/components/yayin/YayinKarti";

interface Props {
  baslik: string;
  videolar: EczanemMusteriVideo[];
  bosMesaj: string;
  onVideoSec: (video: EczanemMusteriVideo) => void;
  onBegeni: (video: EczanemMusteriVideo) => void | Promise<void>;
  onFavori: (video: EczanemMusteriVideo) => void | Promise<void>;
  etkilesimIsliyor?: string | null;
}

const tarihYaz = (deger: string) =>
  new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(deger));

const sureYaz = (saniye: number) =>
  `${Math.floor(saniye / 60)}:${String(Math.floor(saniye % 60)).padStart(2, "0")}`;

function AracMerkezIkonu({ tur }: { tur: EczanemAracTuru }) {
  switch (tur) {
    case "video":
      return <Play className="ml-0.5 size-4 fill-current" />;
    case "podcast":
      return <Headphones className="size-4" />;
    case "gorsel":
      return <ImageIcon className="size-4" />;
    case "flip_pdf":
      return <BookOpen className="size-4" />;
    default:
      return <FileText className="size-4" />;
  }
}

function IcerikDurumRozeti({ video }: { video: EczanemMusteriVideo }) {
  if (video.izlendi) {
    return (
      <Badge className="absolute left-2 top-2 border border-white/40 bg-[#166534]/90 text-[9px] font-black text-white shadow-sm backdrop-blur-sm">
        ✓ Tamamlandı
      </Badge>
    );
  }
  if (video.izleme_basladi) {
    const sureMetni =
      video.son_konum_saniye > 0
        ? ` · ${sureYaz(video.son_konum_saniye)}`
        : "";
    return (
      <Badge className="absolute left-2 top-2 flex items-center gap-1 border border-[#efd59f] bg-[#fff7e8]/95 text-[9px] font-extrabold text-[#956417] shadow-sm">
        <Clock3 className="size-2.5" />
        <span>Devam Et{sureMetni}</span>
      </Badge>
    );
  }
  return (
    <Badge className="absolute left-2 top-2 border border-[#cbe4f9] bg-[#edf6fd]/95 text-[9px] font-black text-[#1d69ad] shadow-sm">
      Yeni
    </Badge>
  );
}

export default function EczanemVideoRafi({
  baslik,
  videolar,
  bosMesaj,
  onVideoSec,
  onBegeni,
  onFavori,
  etkilesimIsliyor,
}: Props) {
  const rafRef = useRef<HTMLDivElement>(null);
  const kaydir = (yon: number) =>
    rafRef.current?.scrollBy({
      left: yon * rafRef.current.clientWidth * 0.85,
      behavior: "smooth",
    });

  const baslikId = `raf-${baslik.replaceAll(" ", "-").replaceAll("’", "").toLocaleLowerCase("tr-TR")}`;

  return (
    <section aria-labelledby={baslikId} className="min-w-0">
      {/* Üst Satır: Başlık ve Sayaç */}
      <div className="mb-3 flex items-center gap-2.5 min-w-0">
        <h2
          id={baslikId}
          className="truncate text-base font-black tracking-[-0.015em] text-[#1e344a] md:text-lg"
        >
          {baslik}
        </h2>
        <span className="shrink-0 rounded-full border border-[#dfe7ef] bg-white px-2.5 py-0.5 text-[11px] font-extrabold text-[#7c8e9f] shadow-sm">
          {videolar.length} içerik
        </span>
      </div>

      {videolar.length === 0 ? (
        <div className="flex min-h-24 items-center rounded-2xl border border-dashed border-[#d6e1eb] bg-white/70 px-5 text-xs font-bold text-[#8796a8]">
          {bosMesaj}
        </div>
      ) : (
        <div className="group relative">
          <button
            type="button"
            aria-label="Sola kaydır"
            onClick={() => kaydir(-1)}
            className="absolute inset-y-0 left-0 z-10 flex w-16 cursor-pointer items-center justify-start bg-gradient-to-r from-gray-50 via-gray-50/70 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
          >
            <svg
              className="h-7 w-7 text-gray-800 drop-shadow-sm"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <div
            ref={rafRef}
            className="-mx-1 flex snap-x items-stretch gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {videolar.map((video) => {
              const isliyor = etkilesimIsliyor === video.yayin_id;

              return (
                <YayinKarti
                  key={`${baslik}-${video.gonderim_id}`}
                  yayin={{
                    yayin_id: video.yayin_id,
                    urun_adi: video.urun_adi,
                    teknik_adi: video.teknik_adi,
                    video_url: video.video_url,
                    thumbnail_url: video.thumbnail_url,
                    arac_id: video.arac_id,
                    arac_turu: video.arac_turu,
                    yayin_tarihi: video.gelis_tarihi,
                    talep_no: video.talep_no,
                    firma_adi: video.firma_adi,
                    begeni_sayisi: video.begeni_sayisi,
                    favori_sayisi: video.favori_sayisi,
                    begeni_mi: video.begeni_mi,
                    favori_mi: video.favori_mi,
                  }}
                  onClick={() => onVideoSec(video)}
                  ariaLabel={`${video.urun_adi} içeriğini sayfaya yerleştir`}
                  onBegeni={() => void onBegeni(video)}
                  onFavori={() => void onFavori(video)}
                  etkilesimAktif={!isliyor}
                  puanGoster={false}
                  donguGoster={false}
                  solUstRozet={<IcerikDurumRozeti video={video} />}
                  hoverOverlay={
                    <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_40%,rgba(15,35,56,0.65)_100%)]">
                      <span className="absolute bottom-2.5 left-2.5 flex size-8 items-center justify-center rounded-full bg-white/95 text-[#bc2d0d] shadow-md transition-transform group-hover:scale-110">
                        <AracMerkezIkonu tur={video.arac_turu} />
                      </span>
                    </span>
                  }
                  altEkIcerik={
                    <div className="mt-2 space-y-1.5">
                      {video.eczane_adi && (
                        <p className="truncate text-[10px] font-semibold text-[#8fa0b2]" title={video.eczane_adi}>
                          {video.eczane_adi}
                        </p>
                      )}
                      <div className="grid grid-cols-3 divide-x divide-[#e3e9ef] rounded-lg border border-[#e5ebf1] bg-[#f8fafc] px-1 py-1 text-center">
                        <div className="px-0.5">
                          <span className="block text-[7px] font-extrabold uppercase tracking-wide text-[#8a99aa]">Tamamlama</span>
                          <strong className="mt-0.5 block text-[10px] font-black tabular-nums text-[#286fae]">
                            {Number(video.video_puani ?? 0).toLocaleString("tr-TR")} p
                          </strong>
                        </div>
                        <div className="px-0.5">
                          <span className="block text-[7px] font-extrabold uppercase tracking-wide text-[#8a99aa]">Soru</span>
                          <strong className="mt-0.5 block text-[10px] font-black tabular-nums text-[#654db0]">
                            {Number(video.soru_sayisi ?? 0).toLocaleString("tr-TR")} ad
                          </strong>
                        </div>
                        <div className="px-0.5">
                          <span className="block text-[7px] font-extrabold uppercase tracking-wide text-[#8a99aa]">Her Doğru</span>
                          <strong className="mt-0.5 block text-[10px] font-black tabular-nums text-[#16865f]">
                            {Number(video.soru_puani ?? 0).toLocaleString("tr-TR")} p
                          </strong>
                        </div>
                      </div>
                    </div>
                  }
                  className="w-[210px] shrink-0 snap-start sm:w-[230px] md:w-[250px]"
                />
              );
            })}
          </div>
          <button
            type="button"
            aria-label="Sağa kaydır"
            onClick={() => kaydir(1)}
            className="absolute inset-y-0 right-0 z-10 flex w-16 cursor-pointer items-center justify-end bg-gradient-to-l from-gray-50 via-gray-50/70 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
          >
            <svg
              className="h-7 w-7 text-gray-800 drop-shadow-sm"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      )}
    </section>
  );
}
