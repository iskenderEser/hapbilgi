// hooks/useBunnyIslemeDurumu.ts
"use client";

import { useEffect, useState } from "react";
import { pollingKarariVer, SORGU_ARALIGI_MS, type IslemeDurumu } from "@/lib/video/islemeDurumu";

interface Sorgu {
  video_id?: string;
  talep_id?: string;
}

/**
 * Bunny encode durumunu izler: kart açılışında bir kez, "işleniyor" ise sınırlı
 * süre boyunca (lib/video/islemeDurumu.ts TAVAN_SANIYE) periyodik tekrar sorgular.
 * Sonsuz polling yok — tavan dolunca durur, kullanıcı manuel yenilemeye döner.
 * IU ve PM/üretici ekranları aynı hook'u kullanır (app/videolar, app/talepler).
 */
export function useBunnyIslemeDurumu(videoUrl: string | null | undefined, sorgu: Sorgu): IslemeDurumu {
  const [durum, setDurum] = useState<IslemeDurumu>(null);
  const sorguId = sorgu.video_id ?? sorgu.talep_id ?? null;

  useEffect(() => {
    setDurum(null);
    if (!videoUrl?.includes("mediadelivery.net") || !sorguId) return;

    let aktif = true;
    let gecenSaniye = 0;
    let zamanlayici: ReturnType<typeof setTimeout> | null = null;
    const parametre = sorgu.video_id ? `video_id=${sorgu.video_id}` : `talep_id=${sorgu.talep_id}`;

    const dongu = async () => {
      try {
        const res = await fetch(`/videolar/api/bunny-durum?${parametre}`);
        const d = await res.json();
        if (!aktif) return;
        if (!res.ok || !d.bunny_kaydi) return; // Bunny-dışı/eski kayıt ya da geçici hata — sessiz geç

        const karar = pollingKarariVer({ hazir: d.hazir, hatali: d.hatali }, gecenSaniye);
        setDurum(karar.durum);
        if (karar.devamEt) {
          gecenSaniye += SORGU_ARALIGI_MS / 1000;
          zamanlayici = setTimeout(dongu, SORGU_ARALIGI_MS);
        }
      } catch {
        // durum sorgusu süs değil ama kritik de değil — sessiz geç, rozet çıkmaz
      }
    };

    dongu();
    return () => { aktif = false; if (zamanlayici) clearTimeout(zamanlayici); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl, sorguId]);

  return durum;
}
