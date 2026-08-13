"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { VideoPlayer } from "@/lib/video/videoPlayer";

interface Parametreler {
  anahtar: string;
  playerRef: RefObject<VideoPlayer | null>;
  etkin?: boolean;
}

/**
 * Cross-origin video iframe'lerinin ortak ilk tıklama davranışı.
 *
 * İframe'in içindeki cursor CSS'i ana uygulamadan değiştirilemez. Bu hook,
 * VideoCercevesi'nin ortak şeffaf düğmesini player hazır olana kadar açık tutar;
 * kullanıcı tıklayınca videoyu oynatır ve yerini sağlayıcının kendi kontrollerine
 * bırakır. Böylece sayfalar aynı hazır/bekleyen oynatma mantığını kopyalamaz.
 */
export function useVideoEtkilesimKatmani({ anahtar, playerRef, etkin = true }: Parametreler) {
  const [acilanAnahtarlar, setAcilanAnahtarlar] = useState<Set<string>>(() => new Set());
  const hazirRef = useRef(false);
  const oynatmaBekliyorRef = useRef(false);

  useEffect(() => {
    hazirRef.current = false;
    oynatmaBekliyorRef.current = false;
  }, [anahtar, etkin]);

  const katmanAcik = etkin && !acilanAnahtarlar.has(anahtar);

  const katmaniKapat = useCallback(() => {
    setAcilanAnahtarlar((mevcut) => {
      if (mevcut.has(anahtar)) return mevcut;
      const sonraki = new Set(mevcut);
      sonraki.add(anahtar);
      return sonraki;
    });
  }, [anahtar]);

  const oynaticiHazir = useCallback((player: VideoPlayer) => {
    if (!etkin || playerRef.current !== player) return;
    hazirRef.current = true;
    if (!oynatmaBekliyorRef.current) return;

    player.play();
    oynatmaBekliyorRef.current = false;
    katmaniKapat();
  }, [etkin, katmaniKapat, playerRef]);

  const oynat = useCallback(() => {
    if (!etkin) return;
    if (hazirRef.current && playerRef.current) {
      playerRef.current.play();
      katmaniKapat();
      return;
    }
    oynatmaBekliyorRef.current = true;
  }, [etkin, katmaniKapat, playerRef]);

  return { katmanAcik, oynaticiHazir, oynat };
}
