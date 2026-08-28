"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  aracId: string;
  yayinId: string;
  bagId?: string | null;
  baslat: () => Promise<{ izlemeId: string }>;
  bitir: (izlemeId: string) => Promise<void>;
  onTamamlandi?: () => void | Promise<void>;
  hata: (mesaj: string, adim?: string, detay?: string) => void;
}

export default function GorselOynatici({
  aracId,
  yayinId,
  bagId,
  baslat,
  bitir,
  onTamamlandi,
  hata,
}: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [izlemeId, setIzlemeId] = useState<string | null>(null);
  const [saniye, setSaniye] = useState(0);
  const [islem, setIslem] = useState(false);
  const sonTikRef = useRef(0);

  useEffect(() => {
    const q = bagId ? `?bag_id=${encodeURIComponent(bagId)}` : "";
    void fetch(`/api/ogrenme-araclari/${aracId}/erisim${q}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.hata ?? "Görsel açılamadı.");
        setUrl(data.erisim_url);
        const oturum = await baslat();
        setIzlemeId(oturum.izlemeId);
        sonTikRef.current = performance.now();
      })
      .catch((error) => hata(
        "Görsel açılamadı.",
        "görsel erişimi",
        error instanceof Error ? error.message : undefined,
      ));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aracId, bagId]);

  useEffect(() => {
    if (!url) return;
    const sayac = window.setInterval(() => {
      const simdi = performance.now();
      if (document.visibilityState === "visible") {
        const fark = sonTikRef.current > 0 ? Math.min(1.5, (simdi - sonTikRef.current) / 1000) : 0;
        setSaniye((onceki) => onceki + fark);
      }
      sonTikRef.current = simdi;
    }, 1000);
    return () => window.clearInterval(sayac);
  }, [url]);

  const tamamla = async () => {
    if (!izlemeId || islem) return;
    setIslem(true);
    try {
      const response = await fetch("/api/ogrenme-araclari/gorsel-tamamla", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          izleme_id: izlemeId,
          yayin_id: yayinId,
          arac_id: aracId,
          aktif_saniye: saniye,
          kullanici_onayi: true,
          sekme_aktif: document.visibilityState === "visible",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.hata ?? "Görsel tamamlanamadı.");
      await bitir(izlemeId);
      await onTamamlandi?.();
    } catch (error) {
      hata(
        "Görsel tamamlanamadı.",
        "görsel tamamlanması",
        error instanceof Error ? error.message : undefined,
      );
    } finally {
      setIslem(false);
    }
  };

  if (!url) {
    return <div className="p-6 text-center text-sm text-gray-500">Görsel hazırlanıyor…</div>;
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4">
      {/* Bunny imzalı URL'leri Next Image optimizasyon hattına açılmaz. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Öğrenme görseli"
        className="mx-auto max-h-[72vh] max-w-full rounded-xl object-contain"
      />
      <button
        type="button"
        disabled={islem || saniye < 3}
        onClick={() => void tamamla()}
        className="self-end rounded-lg border-0 bg-[#56aeff] px-5 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
      >
        İnceledim, tamamla
      </button>
    </div>
  );
}
