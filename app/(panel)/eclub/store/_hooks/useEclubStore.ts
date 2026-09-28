// app/eclub/store/_hooks/useEclubStore.ts
"use client";

import { useCallback, useEffect, useState } from "react";
import type { EclubEczaneStoreOzetItem } from "@/lib/eclub/store/eclubStoreTipler";

interface Args {
  hata: (mesaj: string, adim?: string, detay?: string) => void;
  basari: (mesaj: string) => void;
}

export function useEclubStore({ hata, basari }: Args) {
  const [cekYayinlar, setCekYayinlar] = useState<EclubEczaneStoreOzetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);

  const vitrinCek = useCallback(async (sessiz = false) => {
    if (sessiz) setYenileniyor(true);
    else setLoading(true);
    try {
      const res = await fetch("/eclub/store/api");
      const d = await res.json();
      if (!res.ok) { hata(d.hata ?? "Mağaza yüklenemedi.", d.adim, d.detay); return; }
      setCekYayinlar(d.cek_yayinlar ?? []);
    } catch (err) {
      hata("Mağaza yüklenirken hata oluştu.", "vitrinCek", err instanceof Error ? err.message : undefined);
    } finally {
      if (sessiz) setYenileniyor(false);
      else setLoading(false);
    }
  }, [hata]);

  useEffect(() => { vitrinCek(); }, [vitrinCek]);

  const yenile = useCallback(async () => {
    await vitrinCek(true);
  }, [vitrinCek]);

  const cekTalebiOlustur = useCallback(async (yayin_id: string, siparis_verilsin_mi: boolean) => {
    const res = await fetch("/eclub/store/api/siparis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yayin_id, siparis_verilsin_mi }),
    });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "İşlem gerçekleştirilemedi.", d.adim, d.detay); return false; }
    basari(d.mesaj ?? "Talebiniz alındı.");
    await vitrinCek(true);
    return true;
  }, [hata, basari, vitrinCek]);

  return {
    cekYayinlar, loading, yenileniyor, vitrinCek, yenile, cekTalebiOlustur,
  };
}
