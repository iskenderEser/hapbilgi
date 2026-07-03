// app/admin/eclub/_hooks/useEclubOnaylar.ts
"use client";

import { useCallback, useEffect, useState } from "react";

export interface BekleyenEczane {
  gln: string;
  eczane_adi: string;
  il: string;
  ilce: string | null;
  ekleyen_utt_id: string | null;
  ekleyen_ad: string | null;
  created_at: string;
}

interface UseEclubOnaylarArgs {
  hazir: boolean; // admin auth doğrulandıktan sonra true
  hata: (mesaj: string, adim?: string, detay?: string) => void;
  basari: (mesaj: string) => void;
}

export function useEclubOnaylar({ hazir, hata, basari }: UseEclubOnaylarArgs) {
  const [bekleyenler, setBekleyenler] = useState<BekleyenEczane[]>([]);
  const [loading, setLoading] = useState(true);
  const [islemLoading, setIslemLoading] = useState(false);

  const veriCek = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/admin/api/eclub/onaylar");
      const d = await res.json();
      if (!res.ok) hata(d.hata ?? "Onay bekleyenler yüklenemedi.", d.adim, d.detay);
      else setBekleyenler(d.bekleyenler ?? []);
    } catch (err) {
      hata("Veri yüklenirken hata oluştu.", "useEclubOnaylar veriCek", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [hata]);

  useEffect(() => {
    if (hazir) veriCek();
  }, [hazir, veriCek]);

  const kararVer = useCallback(async (gln: string, karar: "onayla" | "reddet"): Promise<boolean> => {
    setIslemLoading(true);
    try {
      const res = await fetch("/admin/api/eclub/onaylar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gln, karar }),
      });
      const d = await res.json();
      if (!res.ok) {
        hata(d.hata ?? "İşlem yapılamadı.", d.adim, d.detay);
        return false;
      }
      basari(d.mesaj ?? (karar === "onayla" ? "Eczane onaylandı." : "Eczane reddedildi."));
      await veriCek();
      return true;
    } catch (err) {
      hata("İşlem sırasında hata oluştu.", "kararVer", err instanceof Error ? err.message : undefined);
      return false;
    } finally {
      setIslemLoading(false);
    }
  }, [hata, basari, veriCek]);

  return { bekleyenler, loading, islemLoading, veriCek, kararVer };
}