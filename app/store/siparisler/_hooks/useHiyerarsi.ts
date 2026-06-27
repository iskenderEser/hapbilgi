// app/store/siparisler/_hooks/useHiyerarsi.ts
//
// Sipariş listesi sayfasının filtre dropdown'larını dolduracak hiyerarşi verisini
// çeker. Sayfa açılışında bir kez çağrılır, dropdown'lar bu veriyi kullanır.

"use client";

import { useState, useEffect } from "react";
import type { Hiyerarsi } from "../_types";

interface UseHiyerarsiProps {
  hata: (mesaj: string, adim?: string, detay?: string) => void;
}

export function useHiyerarsi({ hata }: UseHiyerarsiProps) {
  const [hiyerarsi, setHiyerarsi] = useState<Hiyerarsi | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);

  const hiyerarsiYukle = async () => {
    setYukleniyor(true);
    const res = await fetch("/store/siparisler/api/hiyerarsi");
    const data = await res.json();
    if (!res.ok) {
      hata(data.hata ?? "Hiyerarşi yüklenemedi.", data.adim, data.detay);
    } else {
      setHiyerarsi(data.hiyerarsi ?? null);
    }
    setYukleniyor(false);
  };

  useEffect(() => {
    hiyerarsiYukle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    hiyerarsi,
    yukleniyor,
    hiyerarsiYukle,
  };
}