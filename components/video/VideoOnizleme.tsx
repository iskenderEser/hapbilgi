"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { createVideoPlayer, detectProvider, type VideoPlayer } from "@/lib/video/videoPlayer";
import VideoCercevesi from "@/components/video/VideoCercevesi";
import { useVideoEtkilesimKatmani } from "@/components/video/useVideoEtkilesimKatmani";

interface Props {
  videoUrl: string;
  className?: string;
  ariaLabel?: string;
  yalnizPlayButonu?: boolean;
  onBitti?: () => void;
  bitisGecikmesiMs?: number;
}

/** Takipsiz video önizlemelerinin tek iframe + ilk oynatma bileşeni. */
export default function VideoOnizleme({
  videoUrl,
  className = "",
  ariaLabel = "Videoyu oynat",
  yalnizPlayButonu = false,
  onBitti,
  bitisGecikmesiMs = 0,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<VideoPlayer | null>(null);
  const onBittiRef = useRef(onBitti);
  const bittiRef = useRef(false);
  const zamanlayicilarRef = useRef<number[]>([]);
  const [bitisAsamasi, setBitisAsamasi] = useState<"yok" | "mesaj" | "kayboluyor">("yok");
  const destekleniyor = detectProvider(videoUrl) !== "bilinmeyen";
  const { katmanAcik, oynaticiHazir, oynat } = useVideoEtkilesimKatmani({
    anahtar: videoUrl,
    playerRef,
    etkin: destekleniyor,
    ilkOynatmaZorunlu: yalnizPlayButonu,
  });

  useEffect(() => { onBittiRef.current = onBitti; }, [onBitti]);

  useEffect(() => { bittiRef.current = false; }, [videoUrl]);

  useEffect(() => {
    if (!iframeRef.current) return;

    let player: VideoPlayer;
    try {
      player = createVideoPlayer(iframeRef.current, videoUrl);
    } catch {
      // Desteklenmeyen sağlayıcıda şeffaf katman yerel iframe kontrollerini
      // engellemesin. Bu projedeki kayıtlı videolar Bunny üzerinden gelir.
      return;
    }

    playerRef.current = player;
    player.onReady(() => oynaticiHazir(player));

    const tamamla = () => {
      if (bittiRef.current) return;
      bittiRef.current = true;
      if (bitisGecikmesiMs <= 0) {
        onBittiRef.current?.();
        return;
      }

      setBitisAsamasi("mesaj");
      const kaybolmaZamani = Math.max(0, bitisGecikmesiMs - 280);
      zamanlayicilarRef.current.push(window.setTimeout(() => setBitisAsamasi("kayboluyor"), kaybolmaZamani));
      zamanlayicilarRef.current.push(window.setTimeout(() => onBittiRef.current?.(), bitisGecikmesiMs));
    };
    player.onEnded(tamamla);
    // Bazı sağlayıcı/sürümlerde ended olayı kaçabilir; süre sonu güvenli yedektir.
    player.onTimeUpdate(({ seconds, duration }) => {
      if (duration && duration > 0 && seconds >= duration - 0.5) tamamla();
    });

    return () => {
      zamanlayicilarRef.current.forEach((zamanlayici) => window.clearTimeout(zamanlayici));
      zamanlayicilarRef.current = [];
      player.destroy();
      if (playerRef.current === player) playerRef.current = null;
    };
  }, [bitisGecikmesiMs, videoUrl, oynaticiHazir]);

  return (
    <div className={`relative transition-opacity duration-300 ${bitisAsamasi === "kayboluyor" ? "opacity-0" : "opacity-100"}`}>
      <VideoCercevesi
        videoUrl={videoUrl}
        className={className}
        etkilesimKatmani={katmanAcik ? {
          ariaLabel,
          onClick: oynat,
          yalnizPlayButonu,
        } : null}
      >
        <iframe
          key={videoUrl}
          ref={iframeRef}
          src={videoUrl}
          frameBorder="0"
          allowFullScreen
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
        />
      </VideoCercevesi>
      {bitisAsamasi !== "yok" && (
        <div className="absolute inset-0 z-20 flex animate-in items-center justify-center bg-[#10233a]/75 text-white fade-in duration-200">
          <div className="flex flex-col items-center text-center">
            <CheckCircle2 className="size-10" />
            <strong className="mt-3 text-base">Video tamamlandı</strong>
            <span className="mt-1 text-xs font-semibold text-white/75">Listeye dönülüyor…</span>
          </div>
        </div>
      )}
    </div>
  );
}
