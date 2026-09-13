"use client";

import { useEffect, useRef, useState } from "react";
import PodcastKapakGorseli from "@/components/ogrenme-araci/PodcastKapakGorseli";

interface Props {
  aracId: string;
  yayinId: string;
  bagId?: string | null;
  urunAdi?: string | null;
  ileriSarmaAcik?: boolean;
  saltGoruntuleme?: boolean;
  baslat: () => Promise<{ izlemeId: string; ilerleme?: { sonKonumSaniye?: number } | null }>;
  bitir: (izlemeId: string) => Promise<void>;
  onTamamlandi?: () => void | Promise<void>;
  hata: (mesaj: string, adim?: string, detay?: string) => void;
}

export default function PodcastOynatici({ aracId, yayinId, bagId, urunAdi, ileriSarmaAcik = false, saltGoruntuleme = false, baslat, bitir, onTamamlandi, hata }: Props) {
  const [erisim, setErisim] = useState<{ erisim_url: string; kapak_url: string | null; transkript_url: string | null; transkript_metni?: string | null; urun_adi?: string | null } | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const izlemeIdRef = useRef<string | null>(null);
  const sonTikRef = useRef(0);
  const aktifRef = useRef(0);
  const bitiyorRef = useRef(false);
  const izinliKonumRef = useRef(0);

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
    if (saltGoruntuleme) return;
    if (!izlemeIdRef.current) {
      const acilis = await baslat();
      izlemeIdRef.current = acilis.izlemeId;
      if (acilis.ilerleme?.sonKonumSaniye && audioRef.current) {
        audioRef.current.currentTime = acilis.ilerleme.sonKonumSaniye;
        izinliKonumRef.current = acilis.ilerleme.sonKonumSaniye;
      }
    }
    sonTikRef.current = performance.now();
  };

  const zamanGuncellendi = () => {
    if (saltGoruntuleme) return;
    const audio = audioRef.current;
    if (!audio || document.visibilityState !== "visible" || audio.paused) return;
    if (!ileriSarmaAcik && audio.currentTime > izinliKonumRef.current + 2) {
      audio.currentTime = izinliKonumRef.current;
      return;
    }
    izinliKonumRef.current = Math.max(izinliKonumRef.current, audio.currentTime);
    const simdi = performance.now();
    if (sonTikRef.current > 0) aktifRef.current += Math.min(1.5, (simdi - sonTikRef.current) / 1000);
    sonTikRef.current = simdi;
    if (aktifRef.current >= 10) void ilerlemeKaydet().catch(() => undefined);
  };

  const sonaErdi = async () => {
    if (saltGoruntuleme) return;
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

  const cozumlenenUrunAdi =
    urunAdi && urunAdi.trim().length > 0
      ? urunAdi.trim()
      : erisim.urun_adi && erisim.urun_adi.trim().length > 0
        ? erisim.urun_adi.trim()
        : "Podcast";

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4">
      <PodcastKapakGorseli
        kapakUrl={erisim.kapak_url}
        urunAdi={cozumlenenUrunAdi}
        className="mx-auto aspect-square w-full max-w-64 rounded-xl object-cover"
      />
      <audio
        ref={audioRef}
        controls
        controlsList="nodownload"
        onContextMenu={(event) => event.preventDefault()}
        preload="metadata"
        src={erisim.erisim_url}
        className="w-full"
        onPlay={() => void oynatildi()}
        onTimeUpdate={zamanGuncellendi}
        onSeeking={() => {
          if (saltGoruntuleme) return;
          const audio = audioRef.current;
          if (audio && !ileriSarmaAcik && audio.currentTime > izinliKonumRef.current + 2) {
            audio.currentTime = izinliKonumRef.current;
          }
        }}
        onPause={() => { if (!saltGoruntuleme) void ilerlemeKaydet().catch(() => undefined); }}
        onEnded={() => void sonaErdi()}
      />
      {/* Onaylanmış transkript okunabilir bir metin panelinde gösterilir.
          Kullanıcının düzenleyip onayladığı son sürüm (transkript_metni) kullanılır.
          Transkript yoksa panel, bağlantı veya hata mesajı gösterilmez.
          Metin güvenli düz içerik olarak render edilir; kullanıcı metni asla HTML olarak çalıştırılmaz. */}
      {erisim.transkript_metni && (
        <details className="group rounded-xl border border-gray-200 bg-gray-50/70 p-3 text-sm transition">
          <summary className="flex cursor-pointer select-none items-center justify-between font-semibold text-gray-800 outline-none hover:text-[#287fce]">
            <span>Podcast Transkripti</span>
            <span className="text-xs text-[#287fce] group-open:hidden">Göster</span>
            <span className="text-xs text-gray-500 hidden group-open:inline">Gizle</span>
          </summary>
          <div className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border border-gray-100 bg-white p-3 font-sans text-xs leading-relaxed text-gray-700 select-text">
            {erisim.transkript_metni.split("\n").map((satir, idx) => {
              if (!satir.trim()) {
                return <div key={idx} className="h-2.5" />;
              }
              const match = satir.match(/^(\*\*[^*]+:\*\*|\*\*[^*]+\*\*:\s*|\*\*[^*]+\*\*)\s*(.*)$/);
              if (match) {
                const etiket = match[1].replace(/\*\*/g, "");
                return (
                  <div key={idx} className="py-0.5">
                    <strong className="font-semibold text-gray-900">{etiket}</strong>
                    <span> {match[2]}</span>
                  </div>
                );
              }
              return (
                <div key={idx} className="py-0.5">
                  {satir}
                </div>
              );
            })}
          </div>
        </details>
      )}
      {!erisim.transkript_metni && erisim.transkript_url && (
        <a
          href={erisim.transkript_url}
          target="_blank"
          rel="noreferrer"
          className="text-center text-sm font-semibold text-[#287fce] hover:underline"
        >
          Transkripti aç
        </a>
      )}
    </div>
  );
}
