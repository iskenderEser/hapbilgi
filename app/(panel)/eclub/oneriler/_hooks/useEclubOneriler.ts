// app/eclub/oneriler/_hooks/useEclubOneriler.ts
"use client";

import { useCallback, useEffect, useState } from "react";
import type { OneriYayin, OneriKisi, OneriGonderSonuc, OneriLimitler } from "../_types";

interface UseArgs {
  hazir: boolean;
  hata: (mesaj: string, adim?: string, detay?: string) => void;
  basari: (mesaj: string) => void;
}

export function useEclubOneriler({ hazir, hata, basari }: UseArgs) {
  const [yayinlar, setYayinlar] = useState<OneriYayin[]>([]);
  const [kisiler, setKisiler] = useState<OneriKisi[]>([]);
  const [limitler, setLimitler] = useState<OneriLimitler | null>(null);
  const [loading, setLoading] = useState(true);
  const [gonderLoading, setGonderLoading] = useState(false);

  const veriCek = useCallback(async () => {
    setLoading(true);
    try {
      const [yayinRes, kisiRes, limitRes] = await Promise.all([
        fetch("/eclub/oneriler/api/yayinlar"),
        fetch("/eclub/listem/api/kisiler"),
        fetch("/eclub/oneriler/api?yalniz_limit=1"),
      ]);
      const yayinData = await yayinRes.json();
      const kisiData = await kisiRes.json();
      const limitData = await limitRes.json();

      if (!yayinRes.ok) hata(yayinData.hata ?? "Yayınlar yüklenemedi.", yayinData.adim, yayinData.detay);
      else setYayinlar(yayinData.videolar ?? []);

      if (!kisiRes.ok) hata(kisiData.hata ?? "Kişiler yüklenemedi.", kisiData.adim, kisiData.detay);
      else setKisiler(kisiData.kisiler ?? []);

      if (!limitRes.ok) hata(limitData.hata ?? "Gönderim limiti yüklenemedi.", limitData.adim, limitData.detay);
      else setLimitler(limitData.limitler ?? null);
    } catch (err: unknown) {
      hata("Veri yüklenirken hata oluştu.", "useEclubOneriler veriCek", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [hata]);

  useEffect(() => {
    if (hazir) veriCek();
  }, [hazir, veriCek]);

  // Tek video → çok kişi. Dönüş: sonuç (atla-raporla) ya da null (hata).
  const oneriGonder = useCallback(async (
    yayin_id: string,
    kisi_idler: string[],
  ): Promise<OneriGonderSonuc | null> => {
    setGonderLoading(true);
    try {
      const res = await fetch("/eclub/oneriler/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yayin_id, kisi_idler }),
      });
      const d = await res.json();
      if (!res.ok) {
        hata(d.hata ?? "Öneri gönderilemedi.", d.adim, d.detay);
        return null;
      }
      basari(d.mesaj ?? `${d.gonderilen_sayisi} öneri gönderildi.`);
      await veriCek();
      return d as OneriGonderSonuc;
    } catch (err: unknown) {
      hata("Öneri gönderilirken hata oluştu.", "oneriGonder", err instanceof Error ? err.message : undefined);
      return null;
    } finally {
      setGonderLoading(false);
    }
  }, [hata, basari, veriCek]);

  return { yayinlar, kisiler, limitler, loading, gonderLoading, veriCek, oneriGonder };
}
