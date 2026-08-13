"use client";

import { useEffect, useRef } from "react";
import { createVideoPlayer, detectProvider, type VideoPlayer } from "@/lib/video/videoPlayer";
import VideoCercevesi from "@/components/video/VideoCercevesi";
import { useVideoEtkilesimKatmani } from "@/components/video/useVideoEtkilesimKatmani";

interface Props {
  videoUrl: string;
  className?: string;
  ariaLabel?: string;
}

/** Takipsiz video önizlemelerinin tek iframe + ilk oynatma bileşeni. */
export default function VideoOnizleme({
  videoUrl,
  className = "",
  ariaLabel = "Videoyu oynat",
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<VideoPlayer | null>(null);
  const destekleniyor = detectProvider(videoUrl) !== "bilinmeyen";
  const { katmanAcik, oynaticiHazir, oynat } = useVideoEtkilesimKatmani({
    anahtar: videoUrl,
    playerRef,
    etkin: destekleniyor,
  });

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

    return () => {
      player.destroy();
      if (playerRef.current === player) playerRef.current = null;
    };
  }, [videoUrl, oynaticiHazir]);

  return (
    <VideoCercevesi
      videoUrl={videoUrl}
      className={className}
      etkilesimKatmani={katmanAcik ? {
        ariaLabel,
        onClick: oynat,
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
  );
}
