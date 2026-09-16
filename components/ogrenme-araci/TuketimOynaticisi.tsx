"use client";

import type { ReactNode } from "react";
import FlipPdfOynatici from "@/components/ogrenme-araci/FlipPdfOynatici";
import GorselOynatici from "@/components/ogrenme-araci/GorselOynatici";
import PodcastOynatici from "@/components/ogrenme-araci/PodcastOynatici";
import type { OgrenmeAraciIzlemeBaslangici } from "@/lib/ogrenmeAraci/izlemeIstemci";
import type { OgrenmeAraciTuru } from "@/lib/ogrenmeAraci/tipler";

interface Props {
  aracId: string;
  yayinId: string;
  aracTuru: Exclude<OgrenmeAraciTuru, "video">;
  bagId?: string | null;
  urunAdi?: string | null;
  ileriSarmaAcik?: boolean;
  saltGoruntuleme?: boolean;
  className?: string;
  baslat: () => Promise<OgrenmeAraciIzlemeBaslangici>;
  bitir: (izlemeId: string) => Promise<void>;
  onTamamlandi?: () => void | Promise<void>;
  hata: (mesaj: string, adim?: string, detay?: string) => void;
}

export default function TuketimOynaticisi(props: Props) {
  const ortak = {
    aracId: props.aracId,
    yayinId: props.yayinId,
    bagId: props.bagId,
    saltGoruntuleme: props.saltGoruntuleme,
    baslat: props.baslat,
    bitir: props.bitir,
    onTamamlandi: props.onTamamlandi,
    hata: props.hata,
  };

  let oynatici: ReactNode;
  if (props.aracTuru === "podcast") {
    oynatici = (
      <PodcastOynatici
        {...ortak}
        urunAdi={props.urunAdi}
        ileriSarmaAcik={props.ileriSarmaAcik}
      />
    );
  } else if (props.aracTuru === "gorsel") {
    oynatici = <GorselOynatici {...ortak} />;
  } else {
    oynatici = <FlipPdfOynatici {...ortak} />;
  }

  return props.className ? <div className={props.className}>{oynatici}</div> : oynatici;
}
