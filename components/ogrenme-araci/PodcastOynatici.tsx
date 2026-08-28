"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  aracId: string;
  yayinId: string;
  bagId?: string | null;
  baslat: () => Promise<{ izlemeId: string; ilerleme?: { sonKonumSaniye?: number } | null }>;
  bitir: (izlemeId: string) => Promise<void>;
  onTamamlandi?: () => void | Promise<void>;
  hata: (mesaj: string, adim?: string, detay?: string) => void;
}

export default function PodcastOynatici({ aracId, yayinId, bagId, baslat, bitir, onTamamlandi, hata }: Props) {
  const [erisim, setErisim] = useState<{ erisim_url: string; kapak_url: string | null; transkript_url: string | null } | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const izlemeIdRef = useRef<string | null>(null);
  const sonTikRef = useRef(0);
  const aktifRef = useRef(0);
  const bitiyorRef = useRef(false);

  useEffect(() => {
    const q = bagId ? `?bag_id=${encodeURIComponent(bagId)}` : "";
    void fetch(`/api/ogrenme-araclari/${aracId}/erisim${q}`).then(async (r) => {
      const d = await r.json();
      if (!r.ok) throw new Error(d.hata ?? "Podcast açılamadı.");
      setErisim(d);
    }).catch((e) => hata("Podcast açılamadı.", "podcast erişimi", e instanceof Error ? e.message : undefined));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aracId, bagId]);

  const ilerlemeKaydet = async (sonaUlasti = false) => {
    const audio = audioRef.current;
    const izlemeId = izlemeIdRef.current;
    if (!audio || !izlemeId) return false;
    const aktif = aktifRef.current;
    aktifRef.current = 0;
    const res = await fetch("/api/ogrenme-araclari/podcast-ilerleme", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ izleme_id: izlemeId, yayin_id: yayinId, arac_id: aracId, konum_saniye: audio.currentTime, aktif_saniye: aktif, sona_ulasti: sonaUlasti, sekme_aktif: document.visibilityState === "visible" }),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.hata ?? "Podcast ilerlemesi kaydedilemedi.");
    return d.tamamlanabilir === true;
  };

  const oynatildi = async () => {
    if (!izlemeIdRef.current) {
      const acilis = await baslat();
      izlemeIdRef.current = acilis.izlemeId;
      if (acilis.ilerleme?.sonKonumSaniye && audioRef.current) audioRef.current.currentTime = acilis.ilerleme.sonKonumSaniye;
    }
    sonTikRef.current = performance.now();
  };

  const zamanGuncellendi = () => {
    if (document.visibilityState !== "visible" || audioRef.current?.paused) return;
    const simdi = performance.now();
    if (sonTikRef.current > 0) aktifRef.current += Math.min(1.5, (simdi - sonTikRef.current) / 1000);
    sonTikRef.current = simdi;
    if (aktifRef.current >= 10) void ilerlemeKaydet().catch(() => undefined);
  };

  const sonaErdi = async () => {
    if (bitiyorRef.current || !izlemeIdRef.current) return;
    bitiyorRef.current = true;
    try {
      if (await ilerlemeKaydet(true)) {
        await bitir(izlemeIdRef.current);
        await onTamamlandi?.();
      } else {
        hata("Podcast tamamlanma süresi doğrulanamadı.", "podcast tamamlanması");
      }
    } catch (e) {
      hata("Podcast tamamlanamadı.", "podcast tamamlanması", e instanceof Error ? e.message : undefined);
    } finally {
      bitiyorRef.current = false;
    }
  };

  if (!erisim) {
    return (
      <div className="rounded-xl bg-gray-50 p-6 text-center text-sm text-gray-500">
        Podcast hazırlanıyor…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4">
      {erisim.kapak_url && (
        <>
          {/* Bunny imzalı URL'leri Next Image optimizasyon hattına açılmaz. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={erisim.kapak_url}
            alt="Podcast kapağı"
            className="mx-auto aspect-square w-full max-w-64 rounded-xl object-cover"
          />
        </>
      )}
      <audio
        ref={audioRef}
        controls
        preload="metadata"
        src={erisim.erisim_url}
        className="w-full"
        onPlay={() => void oynatildi()}
        onTimeUpdate={zamanGuncellendi}
        onPause={() => void ilerlemeKaydet().catch(() => undefined)}
        onEnded={() => void sonaErdi()}
      />
      {erisim.transkript_url && (
        <a
          href={erisim.transkript_url}
          target="_blank"
          rel="noreferrer"
          className="text-center text-sm font-semibold text-[#287fce]"
        >
          Transkripti aç
        </a>
      )}
    </div>
  );
}
