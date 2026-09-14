"use client";

import { useRef } from "react";
import {
  BookOpen,
  Clock3,
  FileText,
  Headphones,
  Heart,
  Image as ImageIcon,
  Play,
  Star,
  Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { talepIdGoster } from "@/lib/utils/talepId";
import { thumbnailUrlUret } from "@/lib/video/thumbnail";
import type { EczanemAracTuru, EczanemMusteriVideo } from "../_types";

interface Props {
  baslik: string;
  videolar: EczanemMusteriVideo[];
  bosMesaj: string;
  onVideoSec: (video: EczanemMusteriVideo) => void;
  onBegeni: (video: EczanemMusteriVideo) => void | Promise<void>;
  onFavori: (video: EczanemMusteriVideo) => void | Promise<void>;
  etkilesimIsliyor?: string | null;
}

const ARAC_TURU_ETIKET: Record<EczanemAracTuru, string> = {
  video: "Video",
  podcast: "Podcast",
  gorsel: "Görsel",
  flip_pdf: "Literatür",
};

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

function AracRozetIkonu({ tur }: { tur: EczanemAracTuru }) {
  switch (tur) {
    case "video":
      return <Video className="size-2.5" />;
    case "podcast":
      return <Headphones className="size-2.5" />;
    case "gorsel":
      return <ImageIcon className="size-2.5" />;
    case "flip_pdf":
      return <BookOpen className="size-2.5" />;
    default:
      return <FileText className="size-2.5" />;
  }
}

function IcerikDurumRozeti({ video }: { video: EczanemMusteriVideo }) {
  if (video.izlendi) {
    return (
      <Badge className="absolute right-2 top-2 border border-white/40 bg-[#166534]/90 text-[9px] font-black text-white shadow-sm backdrop-blur-sm">
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
      <Badge className="absolute right-2 top-2 flex items-center gap-1 border border-[#efd59f] bg-[#fff7e8]/95 text-[9px] font-extrabold text-[#956417] shadow-sm">
        <Clock3 className="size-2.5" />
        <span>Devam Et{sureMetni}</span>
      </Badge>
    );
  }
  return (
    <Badge className="absolute right-2 top-2 border border-[#cbe4f9] bg-[#edf6fd]/95 text-[9px] font-black text-[#1d69ad] shadow-sm">
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
              const thumbnail =
                video.thumbnail_url ?? thumbnailUrlUret(video.video_url);
              const isliyor = etkilesimIsliyor === video.yayin_id;

              return (
                <article
                  key={`${baslik}-${video.gonderim_id}`}
                  className="group/kart flex w-[210px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-[#dfe7ef] bg-white shadow-[0_4px_16px_rgba(31,63,96,0.06)] transition hover:-translate-y-0.5 hover:border-[#b9d4ea] hover:shadow-[0_10px_24px_rgba(31,73,112,0.11)] sm:w-[230px] md:w-[250px]"
                >
                  {/* Görsel Alanı */}
                  <button
                    type="button"
                    onClick={() => onVideoSec(video)}
                    disabled={
                      !video.video_url &&
                      !["podcast", "gorsel", "flip_pdf"].includes(
                        video.arac_turu
                      )
                    }
                    aria-label={`${video.urun_adi} içeriğini sayfaya yerleştir`}
                    className="relative block aspect-video w-full shrink-0 overflow-hidden bg-[#eaf2f8] text-left disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {/* Öğrenme Aracı Türü Rozeti */}
                    <span className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-full border border-white/30 bg-[#0f2338]/75 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-white shadow-sm backdrop-blur-sm">
                      <AracRozetIkonu tur={video.arac_turu} />
                      <span>{ARAC_TURU_ETIKET[video.arac_turu]}</span>
                    </span>

                    {/* İçerik Durum Rozeti (Yeni / Devam Et / Tamamlandı) */}
                    <IcerikDurumRozeti video={video} />

                    {/* Thumbnail veya Yedek Görünüm */}
                    {!thumbnail ? (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-[linear-gradient(135deg,#edf4fa,#dbe7f2)] text-[#5c728a]">
                        <div className="flex size-10 items-center justify-center rounded-full bg-white/80 shadow-sm">
                          <AracMerkezIkonu tur={video.arac_turu} />
                        </div>
                        <span className="text-[10px] font-bold tracking-wide">
                          {ARAC_TURU_ETIKET[video.arac_turu]}
                        </span>
                      </div>
                    ) : (
                      <>
                        {/* Uzak video sağlayıcılarının değişken thumbnail adresleri next/image allowlist'ine bağlı değildir. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={thumbnail}
                          alt=""
                          loading="lazy"
                          className="absolute inset-0 h-full w-full object-contain transition duration-300 group-hover/kart:scale-[1.035]"
                          onError={(event) => {
                            event.currentTarget.style.display = "none";
                          }}
                        />
                        <span className="absolute inset-0 bg-[linear-gradient(180deg,transparent_40%,rgba(15,35,56,0.65)_100%)]" />
                        <span className="absolute bottom-2.5 left-2.5 flex size-8 items-center justify-center rounded-full bg-white/95 text-[#bc2d0d] shadow-md transition-transform group-hover/kart:scale-110">
                          <AracMerkezIkonu tur={video.arac_turu} />
                        </span>
                      </>
                    )}
                  </button>

                  {/* Kart Gövdesi: Belirtilen Bilgi Sırası */}
                  <div className="flex flex-1 flex-col justify-between p-3">
                    {/* Üst Bilgiler ve Beğeni/Favori */}
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          {/* 1. Ürün adı */}
                          <h3
                            className="truncate text-sm font-black text-[#1e344a]"
                            title={video.urun_adi}
                          >
                            {video.urun_adi}
                          </h3>

                          {/* 2. Teknik / eğitim adı (varsa) */}
                          {video.teknik_adi &&
                            video.teknik_adi.trim() !== "-" && (
                              <p
                                className="mt-0.5 truncate text-[10px] font-semibold text-[#64748b]"
                                title={video.teknik_adi}
                              >
                                {video.teknik_adi}
                              </p>
                            )}

                          {/* 3. Firma adı (varsa) */}
                          {video.firma_adi &&
                            video.firma_adi.trim() !== "" && (
                              <p
                                className="mt-0.5 truncate text-[11px] font-bold text-[#475569]"
                                title={video.firma_adi}
                              >
                                {video.firma_adi}
                              </p>
                            )}

                          {/* 4. Eczane adı */}
                          <p
                            className="mt-0.5 truncate text-[10px] font-semibold text-[#8fa0b2]"
                            title={video.eczane_adi}
                          >
                            {video.eczane_adi}
                          </p>
                        </div>

                        {/* Beğeni ve Favori Düğmeleri */}
                        <div className="flex shrink-0 items-center gap-0.5">
                          <button
                            type="button"
                            disabled={isliyor}
                            onClick={() => void onBegeni(video)}
                            aria-label={
                              video.begeni_mi ? "Beğeniyi kaldır" : "Beğen"
                            }
                            className={`rounded-full p-1 transition ${
                              video.begeni_mi
                                ? "text-[#df3d62]"
                                : "text-[#a6b1bd] hover:text-[#df3d62]"
                            }`}
                          >
                            <Heart
                              className={`size-3.5 ${
                                video.begeni_mi ? "fill-current" : ""
                              }`}
                            />
                          </button>
                          <span className="text-[9px] font-bold text-[#7f8fa1]">
                            {video.begeni_sayisi}
                          </span>
                          <button
                            type="button"
                            disabled={isliyor}
                            onClick={() => void onFavori(video)}
                            aria-label={
                              video.favori_mi
                                ? "Favoriden çıkar"
                                : "Favoriye ekle"
                            }
                            className={`ml-1 rounded-full p-1 transition ${
                              video.favori_mi
                                ? "text-[#d49a1d]"
                                : "text-[#a6b1bd] hover:text-[#d49a1d]"
                            }`}
                          >
                            <Star
                              className={`size-3.5 ${
                                video.favori_mi ? "fill-current" : ""
                              }`}
                            />
                          </button>
                          <span className="text-[9px] font-bold text-[#7f8fa1]">
                            {video.favori_sayisi}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Alt Bilgiler: Puanlar ve Tarih / Talep No */}
                    <div className="mt-3">
                      {/* 5. Puan ve soru bilgileri */}
                      <div className="grid grid-cols-3 divide-x divide-[#e3e9ef] rounded-xl border border-[#e5ebf1] bg-[#f8fafc] px-1 py-1.5 text-center">
                        <div className="px-1">
                          <span className="block text-[7px] font-extrabold uppercase tracking-wide text-[#8a99aa]">
                            Tamamlama
                          </span>
                          <strong className="mt-0.5 block text-[11px] font-black tabular-nums text-[#286fae]">
                            {Number(video.video_puani ?? 0).toLocaleString(
                              "tr-TR"
                            )}{" "}
                            puan
                          </strong>
                        </div>
                        <div className="px-1">
                          <span className="block text-[7px] font-extrabold uppercase tracking-wide text-[#8a99aa]">
                            Soru
                          </span>
                          <strong className="mt-0.5 block text-[11px] font-black tabular-nums text-[#654db0]">
                            {Number(video.soru_sayisi ?? 0).toLocaleString(
                              "tr-TR"
                            )}{" "}
                            adet
                          </strong>
                        </div>
                        <div className="px-1">
                          <span className="block text-[7px] font-extrabold uppercase tracking-wide text-[#8a99aa]">
                            Her Doğru
                          </span>
                          <strong className="mt-0.5 block text-[11px] font-black tabular-nums text-[#16865f]">
                            {Number(video.soru_puani ?? 0).toLocaleString(
                              "tr-TR"
                            )}{" "}
                            puan
                          </strong>
                        </div>
                      </div>

                      {/* 6. Gönderim tarihi ve varsa talep numarası */}
                      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-[#edf1f5] pt-2 text-[9px]">
                        <span className="font-semibold text-[#94a3b8]">
                          {tarihYaz(video.gelis_tarihi)}
                        </span>
                        {video.talep_no != null && (
                          <span className="truncate font-mono font-bold text-[#bc2d0d]">
                            {talepIdGoster(video.firma_adi, video.talep_no)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
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
