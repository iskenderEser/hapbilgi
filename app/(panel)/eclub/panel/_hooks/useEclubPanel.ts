// app/eclub/panel/_hooks/useEclubPanel.ts
"use client";

import { useCallback, useEffect, useState } from "react";

export interface PanelOneri {
  oneri_id: string;
  yayin_id: string;
  urun_adi: string;
  teknik_adi: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  icerik_turu: string | null;
  oneri_bitis: string;
  izlendi_mi: boolean;
  created_at: string;
}

export interface PanelKisi {
  ad: string;
  soyad: string;
  rol: string;
}

interface UseEclubPanelArgs {
  hazir: boolean;
  hata: (mesaj: string, adim?: string, detay?: string) => void;
}

export function useEclubPanel({ hazir, hata }: UseEclubPanelArgs) {
  const [kisi, setKisi] = useState<PanelKisi | null>(null);
  const [oneriler, setOneriler] = useState<PanelOneri[]>([]);
  const [loading, setLoading] = useState(true);

  const veriCek = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/eclub/panel/api");
      const d = await res.json();
      if (!res.ok) {
        hata(d.hata ?? "Panel yüklenemedi.", d.adim, d.detay);
      } else {
        setKisi(d.kisi ?? null);
        setOneriler(d.oneriler ?? []);
      }
    } catch (err) {
      hata("Veri yüklenirken hata oluştu.", "useEclubPanel veriCek", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [hata]);

  useEffect(() => {
    if (hazir) veriCek();
  }, [hazir, veriCek]);

  return { kisi, oneriler, loading, veriCek };
}