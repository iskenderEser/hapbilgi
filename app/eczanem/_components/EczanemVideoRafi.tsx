"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight, Clock3, Heart, Play, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { talepIdGoster } from "@/lib/utils/talepId";
import { thumbnailUrlUret } from "@/lib/video/thumbnail";
import type { EczanemMusteriVideo } from "../_types";

interface Props {
  baslik: string;
  videolar: EczanemMusteriVideo[];
  bosMesaj: string;
  onVideoSec: (video: EczanemMusteriVideo) => void;
  onBegeni: (video: EczanemMusteriVideo) => void | Promise<void>;
  onFavori: (video: EczanemMusteriVideo) => void | Promise<void>;
  etkilesimIsliyor?: string | null;
}

const tarihYaz = (deger: string) => new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(deger));
const sureYaz = (saniye: number) => `${Math.floor(saniye / 60)}:${String(Math.floor(saniye % 60)).padStart(2, "0")}`;

export default function EczanemVideoRafi({ baslik, videolar, bosMesaj, onVideoSec, onBegeni, onFavori, etkilesimIsliyor }: Props) {
  const rafRef = useRef<HTMLDivElement>(null);
  const kaydir = (yon: number) => rafRef.current?.scrollBy({ left: yon * rafRef.current.clientWidth * 0.86, behavior: "smooth" });

  return (
    <section aria-labelledby={`raf-${baslik.replaceAll(" ", "-").toLocaleLowerCase("tr-TR")}`} className="min-w-0">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h2 id={`raf-${baslik.replaceAll(" ", "-").toLocaleLowerCase("tr-TR")}`} className="text-base font-black tracking-[-0.015em] text-[#203653] md:text-lg">{baslik}</h2>
        {videolar.length > 0 && <span className="text-[10px] font-extrabold text-[#93a1b1]">{videolar.length} video</span>}
      </div>

      {videolar.length === 0 ? (
        <div className="flex min-h-24 items-center rounded-2xl border border-dashed border-[#d6e1eb] bg-white/60 px-5 text-xs font-bold text-[#8796a8]">{bosMesaj}</div>
      ) : (
        <div className="group/raf relative">
          <Button type="button" variant="secondary" size="icon" aria-label={`${baslik} rafını sola kaydır`} onClick={() => kaydir(-1)} className="absolute left-1 top-[30%] z-20 hidden size-9 rounded-full border border-white/70 bg-white/95 text-[#29425f] opacity-0 shadow-lg transition group-hover/raf:opacity-100 md:inline-flex"><ChevronLeft /></Button>
          <div ref={rafRef} className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {videolar.map((video) => {
              const thumbnail = video.thumbnail_url ?? thumbnailUrlUret(video.video_url);
              const yarim = video.izleme_basladi && !video.izlendi;
              const isliyor = etkilesimIsliyor === video.yayin_id;
              return (
                <article key={`${baslik}-${video.gonderim_id}`} className="group/kart w-[178px] shrink-0 snap-start overflow-hidden rounded-2xl border border-[#dfe7ef] bg-white shadow-[0_4px_16px_rgba(31,63,96,0.06)] transition hover:-translate-y-0.5 hover:border-[#b9d4ea] hover:shadow-[0_10px_24px_rgba(31,73,112,0.11)] sm:w-[205px] md:w-[230px]">
                  <button type="button" onClick={() => onVideoSec(video)} disabled={!video.video_url && !["podcast", "gorsel", "flip_pdf"].includes(video.arac_turu)} aria-label={`${video.urun_adi} içeriğini sayfaya yerleştir`} className="relative block aspect-video w-full overflow-hidden bg-[linear-gradient(135deg,#dceaf6,#9fc5e1)] text-left disabled:cursor-not-allowed disabled:opacity-60">
                    {/* Uzak video sağlayıcılarının değişken thumbnail adresleri next/image allowlist'ine bağlı değildir. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {thumbnail && <img src={thumbnail} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover/kart:scale-[1.035]" onError={(event) => { event.currentTarget.style.display = "none"; }} />}
                    <span className="absolute inset-0 bg-[linear-gradient(180deg,transparent_35%,rgba(14,38,62,0.66)_100%)]" />
                    <span className="absolute bottom-2.5 left-2.5 flex size-9 items-center justify-center rounded-full bg-white/94 text-[#237ac8] shadow-lg"><Play className="ml-0.5 size-3.5 fill-current" /></span>
                    {yarim && <Badge className="absolute right-2 top-2 border border-[#efd59f] bg-[#fff7e8] font-extrabold text-[#956417]"><Clock3 /> {video.son_konum_saniye > 0 ? `${sureYaz(video.son_konum_saniye)}’dan devam` : "Yarım kaldı"}</Badge>}
                    {video.izlendi && <Badge className="absolute right-2 top-2 border border-white/35 bg-[#122a42]/78 font-extrabold text-white">✓ İzlendi</Badge>}
                  </button>

                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0"><h3 className="truncate text-sm font-black text-[#263e5b]">{video.urun_adi}</h3>{video.teknik_adi && video.teknik_adi !== "-" && <p className="mt-0.5 truncate text-[10px] font-semibold text-[#8a99aa]">{video.teknik_adi}</p>}</div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button type="button" disabled={isliyor} onClick={() => void onBegeni(video)} aria-label={video.begeni_mi ? "Beğeniyi kaldır" : "Beğen"} className={`rounded-full p-1 transition ${video.begeni_mi ? "text-[#df3d62]" : "text-[#a6b1bd] hover:text-[#df3d62]"}`}><Heart className={`size-3.5 ${video.begeni_mi ? "fill-current" : ""}`} /></button><span className="text-[9px] font-bold text-[#7f8fa1]">{video.begeni_sayisi}</span>
                        <button type="button" disabled={isliyor} onClick={() => void onFavori(video)} aria-label={video.favori_mi ? "Favoriden çıkar" : "Favoriye ekle"} className={`ml-1 rounded-full p-1 transition ${video.favori_mi ? "text-[#d49a1d]" : "text-[#a6b1bd] hover:text-[#d49a1d]"}`}><Star className={`size-3.5 ${video.favori_mi ? "fill-current" : ""}`} /></button><span className="text-[9px] font-bold text-[#7f8fa1]">{video.favori_sayisi}</span>
                      </div>
                    </div>
                    <div className="mt-2.5 grid grid-cols-3 divide-x divide-[#e3e9ef] rounded-xl border border-[#e5ebf1] bg-[#f7f9fb] px-1 py-2 text-center">
                      <div className="px-1"><span className="block text-[7px] font-extrabold uppercase tracking-wide text-[#8a99aa]">İzleme</span><strong className="mt-0.5 block text-[11px] font-black tabular-nums text-[#286fae]">{Number(video.video_puani ?? 0).toLocaleString("tr-TR")} puan</strong></div>
                      <div className="px-1"><span className="block text-[7px] font-extrabold uppercase tracking-wide text-[#8a99aa]">Soru</span><strong className="mt-0.5 block text-[11px] font-black tabular-nums text-[#654db0]">{Number(video.soru_sayisi ?? 0).toLocaleString("tr-TR")} adet</strong></div>
                      <div className="px-1"><span className="block text-[7px] font-extrabold uppercase tracking-wide text-[#8a99aa]">Her Doğru</span><strong className="mt-0.5 block text-[11px] font-black tabular-nums text-[#16865f]">{Number(video.soru_puani ?? 0).toLocaleString("tr-TR")} puan</strong></div>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 text-[9px] font-bold text-[#8998a9]"><span className="truncate">{video.eczane_adi}</span><span className="shrink-0">{video.izlenme_sayisi} izlenme</span></div>
                    <div className="mt-2 flex items-center justify-between gap-2 border-t border-[#edf1f5] pt-2"><span className="text-[9px] font-semibold text-[#9aa6b4]">{tarihYaz(video.gelis_tarihi)}</span>{video.talep_no != null && <span className="truncate font-mono text-[9px] font-bold text-[#bc2d0d]">{talepIdGoster(video.firma_adi, video.talep_no)}</span>}</div>
                  </div>
                </article>
              );
            })}
          </div>
          <Button type="button" variant="secondary" size="icon" aria-label={`${baslik} rafını sağa kaydır`} onClick={() => kaydir(1)} className="absolute right-1 top-[30%] z-20 hidden size-9 rounded-full border border-white/70 bg-white/95 text-[#29425f] opacity-0 shadow-lg transition group-hover/raf:opacity-100 md:inline-flex"><ChevronRight /></Button>
        </div>
      )}
    </section>
  );
}
