"use client";

import type { ReactNode } from "react";
import { YayinTuruFiltresi, type YayinTuruFiltreDegeri } from "@/components/ogrenme-araci/YayinTuruFiltresi";
import type { OgrenmeAraciTuru } from "@/lib/ogrenmeAraci/tipler";
import { ListeArama } from "./ListeArama";
import type { AramaAlani } from "./useListe";

export interface IcerikFiltreBariProps<T> {
  turFiltresi?: {
    secili: YayinTuruFiltreDegeri;
    onSec: (tur: YayinTuruFiltreDegeri) => void;
    sayilar: Record<OgrenmeAraciTuru, number>;
  };
  arama?: {
    aranan: string;
    aramaDegistir: (d: string) => void;
    alanAnahtari: string;
    alanDegistir: (a: string) => void;
    alanlar: AramaAlani<T>[];
  };
  ipucu?: string;
  aramaGenislik?: string;
  sagEk?: ReactNode;
  className?: string;
}

export function IcerikFiltreBari<T>({
  turFiltresi,
  arama,
  ipucu,
  aramaGenislik,
  sagEk,
  className = "",
}: IcerikFiltreBariProps<T>) {
  return (
    <div className={`mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      {/* Sol: Yatay Kayan Tür Pilleri */}
      {turFiltresi ? (
        <div className="min-w-0 flex-1">
          <YayinTuruFiltresi
            secili={turFiltresi.secili}
            onSec={turFiltresi.onSec}
            sayilar={turFiltresi.sayilar}
          />
        </div>
      ) : (
        <div />
      )}

      {/* Sağ: Merve Standart ListeArama & Opsiyonel Aksiyonlar */}
      <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 shrink-0">
        {arama && <ListeArama arama={arama} ipucu={ipucu} genislik={aramaGenislik} />}
        {sagEk}
      </div>
    </div>
  );
}
