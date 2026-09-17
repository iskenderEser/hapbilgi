"use client";

import type { OgrenmeAraciTuru } from "@/lib/ogrenmeAraci/tipler";
import { YAYIN_TURLERI, YAYIN_TURU_SUNUMU } from "@/lib/ogrenmeAraci/turSunumu";

export type YayinTuruFiltreDegeri = "tumu" | OgrenmeAraciTuru;

export function YayinTuruFiltresi({
  secili,
  onSec,
  sayilar,
}: {
  secili: YayinTuruFiltreDegeri;
  onSec: (tur: YayinTuruFiltreDegeri) => void;
  sayilar: Record<OgrenmeAraciTuru, number>;
}) {
  const secenekler: Array<{ deger: YayinTuruFiltreDegeri; etiket: string; sayi: number }> = [
    { deger: "tumu", etiket: "Tümü", sayi: Object.values(sayilar).reduce((toplam, sayi) => toplam + sayi, 0) },
    ...YAYIN_TURLERI.map((tur) => ({ deger: tur, etiket: YAYIN_TURU_SUNUMU[tur].cogulEtiket, sayi: sayilar[tur] })),
  ];

  return (
    <div className="flex max-w-full gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Yayın türüne göre filtrele">
      {secenekler.map((secenek) => {
        const aktif = secili === secenek.deger;
        return (
          <button
            key={secenek.deger}
            type="button"
            aria-pressed={aktif}
            onClick={() => onSec(secenek.deger)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-extrabold transition-colors ${aktif ? "border-[#56aeff] bg-[#eaf4ff] text-[#247bc7]" : "border-[#dce5ef] bg-white text-[#60738d] hover:bg-[#f7faff]"}`}
          >
            {secenek.etiket} <span className="ml-1 opacity-70">{secenek.sayi}</span>
          </button>
        );
      })}
    </div>
  );
}

