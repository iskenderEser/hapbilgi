"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  aracId: string;
  yayinId: string;
  bagId?: string | null;
  saltGoruntuleme?: boolean;
  baslat: () => Promise<{ izlemeId: string }>;
  bitir: (izlemeId: string) => Promise<void>;
  onTamamlandi?: () => void | Promise<void>;
  hata: (mesaj: string, adim?: string, detay?: string) => void;
}

export default function GorselOynatici({
  aracId,
  yayinId,
  bagId,
  saltGoruntuleme = false,
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
        if (!saltGoruntuleme) {
          const oturum = await baslat();
          setIzlemeId(oturum.izlemeId);
          sonTikRef.current = performance.now();
        }
      })
      .catch((error) => hata(
        "Görsel açılamadı.",
        "görsel erişimi",
        error instanceof Error ? error.message : undefined,
      ));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aracId, bagId]);

  useEffect(() => {
    if (!url || saltGoruntuleme) return;
    const sayac = window.setInterval(() => {
      const simdi = performance.now();
      if (document.visibilityState === "visible") {
        const fark = sonTikRef.current > 0 ? Math.min(1.5, (simdi - sonTikRef.current) / 1000) : 0;
        setSaniye((onceki) => onceki + fark);
      }
      sonTikRef.current = simdi;
    }, 1000);
    return () => window.clearInterval(sayac);
  }, [url, saltGoruntuleme]);

  const [olcek, setOlcek] = useState(1);
  const [konum, setKonum] = useState({ x: 0, y: 0 });
  const [surukleniyor, setSurukleniyor] = useState(false);
  const suruklemeBaslangicRef = useRef<{ x: number; y: number } | null>(null);
  const konteynerRef = useRef<HTMLDivElement>(null);

  const yakinlastir = () => {
    setOlcek((onceki) => Math.min(4, Math.round((onceki + 0.25) * 100) / 100));
  };

  const uzaklastir = () => {
    setOlcek((onceki) => {
      const yeni = Math.max(0.5, Math.round((onceki - 0.25) * 100) / 100);
      if (yeni === 1) setKonum({ x: 0, y: 0 });
      return yeni;
    });
  };

  const sifirla = () => {
    setOlcek(1);
    setKonum({ x: 0, y: 0 });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (olcek <= 1) return;
    setSurukleniyor(true);
    suruklemeBaslangicRef.current = {
      x: e.clientX - konum.x,
      y: e.clientY - konum.y,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!surukleniyor || !suruklemeBaslangicRef.current) return;
    setKonum({
      x: e.clientX - suruklemeBaslangicRef.current.x,
      y: e.clientY - suruklemeBaslangicRef.current.y,
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setSurukleniyor(false);
    suruklemeBaslangicRef.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {
      // yut
    }
  };

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
      {/* Pan ve Zoom özellikli görsel kapsayıcısı */}
      <div
        ref={konteynerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={() => (olcek === 1 ? setOlcek(2) : sifirla())}
        className={`relative flex min-h-[300px] max-h-[72vh] w-full items-center justify-center overflow-hidden rounded-xl bg-gray-50 select-none ${
          olcek > 1 ? (surukleniyor ? "cursor-grabbing" : "cursor-grab") : "cursor-default"
        }`}
      >
        {/* Yakınlaştırma ve Kaydırma Kontrol Araç Çubuğu */}
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-lg bg-black/75 px-2.5 py-1.5 text-white shadow-lg backdrop-blur-sm">
          <button
            type="button"
            title="Uzaklaştır"
            aria-label="Uzaklaştır"
            onClick={uzaklastir}
            disabled={olcek <= 0.5}
            className="flex h-6 w-6 items-center justify-center rounded hover:bg-white/20 disabled:opacity-30 cursor-pointer text-sm font-bold"
          >
            −
          </button>
          <button
            type="button"
            title="Sıfırla (%100)"
            aria-label="Sıfırla"
            onClick={sifirla}
            className="min-w-[45px] rounded px-1.5 py-0.5 text-center text-[11px] font-semibold hover:bg-white/20 cursor-pointer"
          >
            %{Math.round(olcek * 100)}
          </button>
          <button
            type="button"
            title="Yakınlaştır"
            aria-label="Yakınlaştır"
            onClick={yakinlastir}
            disabled={olcek >= 4}
            className="flex h-6 w-6 items-center justify-center rounded hover:bg-white/20 disabled:opacity-30 cursor-pointer text-sm font-bold"
          >
            +
          </button>
          <button
            type="button"
            title="Ekrana Sığdır (Sıfırla)"
            aria-label="Ekrana Sığdır"
            onClick={sifirla}
            className="rounded px-1.5 py-0.5 text-[11px] font-medium text-gray-300 hover:bg-white/20 hover:text-white cursor-pointer"
          >
            ↺ Sıfırla
          </button>
        </div>

        {/* Bunny imzalı URL'leri Next Image optimizasyon hattına açılmaz. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="Öğrenme görseli"
          draggable={false}
          onContextMenu={(event) => event.preventDefault()}
          style={{
            transform: `translate(${konum.x}px, ${konum.y}px) scale(${olcek})`,
            transformOrigin: "center center",
            transition: surukleniyor ? "none" : "transform 0.12s ease-out",
          }}
          className="max-h-[72vh] max-w-full rounded-xl object-contain pointer-events-none"
        />
      </div>

      {!saltGoruntuleme && (
        <button
          type="button"
          disabled={islem || saniye < 3}
          onClick={() => void tamamla()}
          className="self-end rounded-lg border-0 bg-[#56aeff] px-5 py-2.5 text-xs font-semibold text-white disabled:opacity-50 cursor-pointer"
        >
          İnceledim, tamamla
        </button>
      )}
    </div>
  );
}
