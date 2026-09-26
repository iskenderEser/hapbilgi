"use client";

import { useMemo, type ReactNode } from "react";
import type { YayinTuruFiltreDegeri } from "@/components/ogrenme-araci/YayinTuruFiltresi";
import { PeriyotButonlari } from "@/components/ui/periyot-butonlari";
import type { OgrenmeAraciTuru } from "@/lib/ogrenmeAraci/tipler";
import { YAYIN_TURLERI, YAYIN_TURU_SUNUMU } from "@/lib/ogrenmeAraci/turSunumu";
import MobilYayinAkisi from "./MobilYayinAkisi";

interface YayinTuruTasiyan {
  arac_turu?: string | null;
}

export function UttYayinTuruToggle<T extends YayinTuruTasiyan>({
  yayinlar,
  deger,
  onDegistir,
  sayilariGoster = true,
  className = "",
}: {
  yayinlar: readonly T[];
  deger: YayinTuruFiltreDegeri;
  onDegistir: (deger: YayinTuruFiltreDegeri) => void;
  sayilariGoster?: boolean;
  className?: string;
}) {
  const secenekler = useMemo(() => {
    const sayilar: Record<OgrenmeAraciTuru, number> = {
      video: 0,
      podcast: 0,
      gorsel: 0,
      flip_pdf: 0,
    };

    yayinlar.forEach((yayin) => {
      const tur = yayin.arac_turu as OgrenmeAraciTuru | null | undefined;
      if (tur && tur in sayilar) sayilar[tur] += 1;
    });

    const etiket = (metin: string, sayi: number) => sayilariGoster ? `${metin} ${sayi}` : metin;

    return [
      { key: "tumu" as const, label: etiket("Tümü", yayinlar.length) },
      ...YAYIN_TURLERI.map((tur) => ({
        key: tur,
        label: etiket(YAYIN_TURU_SUNUMU[tur].cogulEtiket, sayilar[tur]),
      })),
    ];
  }, [sayilariGoster, yayinlar]);

  return (
    <PeriyotButonlari
      secenekler={secenekler}
      deger={deger}
      onDegistir={onDegistir}
      ariaLabel="Yayın türüne göre filtrele"
      className={className}
    />
  );
}

export function UttYayinBosDurum({ mesaj }: { mesaj: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
      <p className="text-sm font-bold text-gray-500">{mesaj}</p>
    </div>
  );
}

export function UttYayinListeAkisi<T>({
  kayitlar,
  kayitAnahtari,
  renderKart,
  sifirlamaAnahtari,
  bosMesaj,
  masaustuIzgaraClassName,
  baslik,
  aciklama,
  aksiyonlar,
}: {
  kayitlar: readonly T[];
  kayitAnahtari: (kayit: T, index: number) => string;
  renderKart: (kayit: T, index: number) => ReactNode;
  sifirlamaAnahtari: string | number;
  bosMesaj: string;
  masaustuIzgaraClassName: string;
  baslik?: ReactNode;
  aciklama?: ReactNode;
  aksiyonlar?: ReactNode;
}) {
  const bosDurum = <UttYayinBosDurum mesaj={bosMesaj} />;

  return (
    <MobilYayinAkisi<T>
      kayitlar={kayitlar}
      kayitAnahtari={kayitAnahtari}
      renderKart={renderKart}
      sifirlamaAnahtari={sifirlamaAnahtari}
      baslik={baslik}
      aciklama={aciklama}
      aksiyonlar={aksiyonlar}
      sayacGoster={false}
      bosDurum={bosDurum}
      masaustuIcerik={
        kayitlar.length === 0 ? bosDurum : (
          <div className={masaustuIzgaraClassName}>
            {kayitlar.map((kayit, index) => (
              <div key={kayitAnahtari(kayit, index)} className="min-w-0">
                {renderKart(kayit, index)}
              </div>
            ))}
          </div>
        )
      }
    />
  );
}

export function UttYayinKartIskeletleri({
  izgaraClassName,
  kartSayisi = 2,
}: {
  izgaraClassName: string;
  kartSayisi?: number;
}) {
  return (
    <div className={izgaraClassName}>
      {Array.from({ length: kartSayisi }, (_, kart) => (
        <div key={kart} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="aspect-video bg-gray-200" />
          <div className="space-y-3 p-3">
            <div className="h-4 w-3/4 rounded bg-gray-200" />
            <div className="h-3 w-1/2 rounded bg-gray-100" />
            <div className="h-8 rounded-lg bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
