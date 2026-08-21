// app/store/siparisler/_hooks/useHiyerarsi.ts
//
// Sipariş listesi sayfasının filtre dropdown'larını dolduracak hiyerarşi verisini
// çeker. Sayfa açılışında bir kez çağrılır, dropdown'lar bu veriyi kullanır.

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Hiyerarsi } from "../_types";

interface UseHiyerarsiProps {
  hata: (mesaj: string, adim?: string, detay?: string) => void;
}

export function useHiyerarsi({ hata }: UseHiyerarsiProps) {
  const hataRef = useRef(hata);
  const [hiyerarsi, setHiyerarsi] = useState<Hiyerarsi | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [yenileniyor, setYenileniyor] = useState(false);

  useEffect(() => { hataRef.current = hata; }, [hata]);

  const hiyerarsiYukle = useCallback(async (sessiz = false) => {
    if (sessiz) setYenileniyor(true);
    else setYukleniyor(true);
    try {
      const res = await fetch("/store/siparisler/api/hiyerarsi");
      const data = await res.json();
      if (!res.ok) {
        hataRef.current(data.hata ?? "Hiyerarşi yüklenemedi.", data.adim, data.detay);
        return;
      }
      setHiyerarsi(data.hiyerarsi ?? null);
    } catch (err) {
      hataRef.current("Hiyerarşi yüklenemedi.", "fetch", String(err));
    } finally {
      if (sessiz) setYenileniyor(false);
      else setYukleniyor(false);
    }
  }, []);

  useEffect(() => {
    void hiyerarsiYukle();
  }, [hiyerarsiYukle]);

  return {
    hiyerarsi,
    yukleniyor,
    yenileniyor,
    hiyerarsiYukle,
  };
}
