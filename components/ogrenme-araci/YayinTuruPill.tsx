import type { OgrenmeAraciTuru } from "@/lib/ogrenmeAraci/tipler";
import { YAYIN_TURU_SUNUMU } from "@/lib/ogrenmeAraci/turSunumu";

export function YayinTuruPill({
  tur,
  boyut = "standart",
  className = "",
}: {
  tur: OgrenmeAraciTuru;
  boyut?: "standart" | "kart";
  className?: string;
}) {
  const sunum = YAYIN_TURU_SUNUMU[tur];
  const boyutSinifi =
    boyut === "kart"
      ? "min-h-[22px] px-2.5 py-0.5 text-xs sm:min-h-0 sm:px-2 sm:py-0.5 sm:text-[9px]"
      : "px-2 py-0.5 text-[9px]";

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border border-white/60 font-extrabold shadow-sm backdrop-blur-sm ${boyutSinifi} ${className}`}
      style={{ color: sunum.renk, backgroundColor: `${sunum.zemin}e8` }}
    >
      {sunum.etiket}
    </span>
  );
}

