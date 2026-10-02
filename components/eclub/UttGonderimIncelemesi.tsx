"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import VideoOnizleme from "@/components/video/VideoOnizleme";
import GorselOynatici from "@/components/ogrenme-araci/GorselOynatici";
import FlipPdfOynatici from "@/components/ogrenme-araci/FlipPdfOynatici";
import type { OgrenmeAraciTuru } from "@/lib/ogrenmeAraci/tipler";

interface Props {
  yayinId: string;
  aracId: string;
  aracTuru: OgrenmeAraciTuru;
  videoUrl: string | null;
  urunAdi: string;
  onTamamlandi: () => void | Promise<void>;
  hata: (mesaj: string, adim?: string, detay?: string) => void;
  kanal?: "eclub" | "eczanem";
}

export default function UttGonderimIncelemesi({ yayinId, aracId, aracTuru, videoUrl, urunAdi, onTamamlandi, hata, kanal = "eclub" }: Props) {
  const [incelemeId, setIncelemeId] = useState<string | null>(null);
  const [podcastUrl, setPodcastUrl] = useState<string | null>(null);
  const [islem, setIslem] = useState(false);
  const [beklemeSaniyesi, setBeklemeSaniyesi] = useState(0);
  const kuyruk = useRef<Promise<unknown>>(Promise.resolve());
  const sonKonum = useRef(0);
  const sonGonderilenKonum = useRef(0);

  const istek = useCallback(async (islemTuru: "baslat" | "ilerle" | "tamamla", ek: Record<string, unknown> = {}) => {
    const response = await fetch("/eclub/oneriler/api/inceleme", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yayin_id: yayinId, islem: islemTuru, inceleme_id: incelemeId, sekme_aktif: document.visibilityState === "visible", kanal, ...ek }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.hata ?? "Yayın incelemesi kaydedilemedi.");
    return data;
  }, [yayinId, incelemeId, kanal]);

  useEffect(() => {
    let aktif = true;
    void istek("baslat").then((data) => {
      if (aktif) setIncelemeId(data.inceleme_id);
    }).catch((error) => hata("İnceleme başlatılamadı.", "UTT gönderim incelemesi", error instanceof Error ? error.message : undefined));
    return () => { aktif = false; };
    // Oturum yalnız yayın değişince başlatılır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yayinId]);

  useEffect(() => {
    if (aracTuru !== "podcast") return;
    let aktif = true;
    void fetch(`/api/ogrenme-araclari/${aracId}/erisim`).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.hata ?? "Podcast açılamadı.");
      if (aktif) setPodcastUrl(data.erisim_url);
    }).catch((error) => hata("Podcast açılamadı.", "UTT gönderim incelemesi", error instanceof Error ? error.message : undefined));
    return () => { aktif = false; };
  }, [aracId, aracTuru, hata]);

  const sirayaAl = useCallback((ek: Record<string, unknown>) => {
    kuyruk.current = kuyruk.current.then(() => istek("ilerle", ek)).catch((error) => {
      hata("İnceleme ilerlemesi kaydedilemedi.", "UTT gönderim incelemesi", error instanceof Error ? error.message : undefined);
    });
  }, [istek, hata]);

  const tamamla = useCallback(async (ek: Record<string, unknown>) => {
    if (islem || !incelemeId) return;
    setIslem(true);
    try {
      await kuyruk.current;
      await istek("tamamla", ek);
      await onTamamlandi();
    } catch (error) {
      hata("Yayın henüz tamamlanamadı.", "UTT gönderim incelemesi", error instanceof Error ? error.message : undefined);
    } finally {
      setIslem(false);
    }
  }, [islem, incelemeId, istek, onTamamlandi, hata]);

  useEffect(() => {
    if (!incelemeId || aracTuru !== "gorsel") return;
    const zamanlayici = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setBeklemeSaniyesi((onceki) => onceki + 1);
      sirayaAl({});
    }, 1000);
    return () => window.clearInterval(zamanlayici);
  }, [incelemeId, aracTuru, sirayaAl]);

  const pdfInceleme = useMemo(() => ({
    sayfaIlerle: (sayfalar: number[]) => { if (incelemeId) sirayaAl({ sayfalar }); },
    tamamla: (sayfalar: number[]) => { void tamamla({ sayfalar, kullanici_onayi: true }); },
  }), [incelemeId, sirayaAl, tamamla]);

  if (!incelemeId) return <div className="rounded-xl bg-white p-6 text-sm text-slate-500">İnceleme hazırlanıyor…</div>;

  return (
    <div className="space-y-3">
      <p className="rounded-lg bg-[#f1f6fb] px-3 py-2 text-xs text-[#476078]">{urunAdi} · Gönderim öncesi inceleme. Soru ve puan yoktur.</p>
      {aracTuru === "video" && videoUrl && <VideoOnizleme
        videoUrl={videoUrl}
        ariaLabel={`${urunAdi} yayınını incele`}
        yalnizPlayButonu
        onIlerleme={(konum) => {
          sonKonum.current = konum;
          if (document.visibilityState === "visible" && konum - sonGonderilenKonum.current >= 2) {
            sonGonderilenKonum.current = konum;
            sirayaAl({ konum_saniye: konum, oynuyor: true });
          }
        }}
        onBitti={() => {
          sirayaAl({ konum_saniye: sonKonum.current, oynuyor: true, sona_ulasti: true });
          void tamamla({ konum_saniye: sonKonum.current, oynuyor: true, sona_ulasti: true });
        }}
      />}
      {aracTuru === "video" && !videoUrl && <p className="p-4 text-sm text-red-600">Video bağlantısı bulunamadı.</p>}
      {aracTuru === "podcast" && (podcastUrl ? <audio
        src={podcastUrl} controls controlsList="nodownload" className="w-full" preload="metadata"
        onTimeUpdate={(event) => {
          const konum = event.currentTarget.currentTime;
          sonKonum.current = konum;
          if (document.visibilityState === "visible" && !event.currentTarget.paused && konum - sonGonderilenKonum.current >= 2) {
            sonGonderilenKonum.current = konum;
            sirayaAl({ konum_saniye: konum, oynuyor: true });
          }
        }}
        onEnded={() => {
          sirayaAl({ konum_saniye: sonKonum.current, oynuyor: true, sona_ulasti: true });
          void tamamla({ konum_saniye: sonKonum.current, oynuyor: true, sona_ulasti: true });
        }}
      /> : <p className="p-4 text-sm text-slate-500">Podcast yükleniyor…</p>)}
      {aracTuru === "gorsel" && <>
        <GorselOynatici aracId={aracId} yayinId={yayinId} saltGoruntuleme baslat={async () => ({ izlemeId: incelemeId })} bitir={async () => undefined} hata={hata} />
        <button type="button" disabled={islem || beklemeSaniyesi < 3} onClick={() => void tamamla({ kullanici_onayi: true })} className="rounded-lg bg-[#237ac8] px-4 py-2 text-xs font-bold text-white disabled:opacity-40">İnceledim, tamamla</button>
      </>}
      {aracTuru === "flip_pdf" && <FlipPdfOynatici aracId={aracId} yayinId={yayinId} saltGoruntuleme baslat={async () => ({ izlemeId: incelemeId })} bitir={async () => undefined} inceleme={pdfInceleme} hata={hata} />}
    </div>
  );
}
