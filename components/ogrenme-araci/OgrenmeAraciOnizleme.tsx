"use client";

import FlipPdfOynatici from "@/components/ogrenme-araci/FlipPdfOynatici";
import GorselOynatici from "@/components/ogrenme-araci/GorselOynatici";
import PodcastOynatici from "@/components/ogrenme-araci/PodcastOynatici";
import VideoOnizleme from "@/components/video/VideoOnizleme";
import type { OgrenmeAraciTuru } from "@/lib/ogrenmeAraci/tipler";

interface Props {
  yayinId: string;
  aracId: string;
  aracTuru: OgrenmeAraciTuru;
  videoUrl?: string | null;
  urunAdi: string;
  hata: (mesaj: string, adim?: string, detay?: string) => void;
  onBitti: () => void;
}

const saltBaslat = async () => ({ izlemeId: "salt-onizleme" });
const saltBitir = async () => undefined;

/** E-Club gönderim önizlemesi; izleme kaydı ve puan üretmez. */
export default function OgrenmeAraciOnizleme({
  yayinId,
  aracId,
  aracTuru,
  videoUrl,
  urunAdi,
  hata,
  onBitti,
}: Props) {
  if (aracTuru === "video") {
    if (!videoUrl) {
      return <div className="rounded-xl bg-gray-50 p-6 text-center text-sm text-gray-500">Video bağlantısı bulunamadı.</div>;
    }
    return (
      <VideoOnizleme
        videoUrl={videoUrl}
        ariaLabel={`${urunAdi} videosunu oynat`}
        yalnizPlayButonu
        onBitti={onBitti}
        bitisGecikmesiMs={1500}
      />
    );
  }

  const ortak = {
    aracId,
    yayinId,
    urunAdi,
    saltGoruntuleme: true,
    baslat: saltBaslat,
    bitir: saltBitir,
    hata,
  };

  if (aracTuru === "podcast") return <PodcastOynatici {...ortak} />;
  if (aracTuru === "gorsel") return <GorselOynatici {...ortak} />;
  return <FlipPdfOynatici {...ortak} />;
}
