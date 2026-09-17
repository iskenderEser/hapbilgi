import type { OgrenmeAraciTuru } from "@/lib/ogrenmeAraci/tipler";
import { YAYIN_TURU_SUNUMU } from "@/lib/ogrenmeAraci/turSunumu";

export function YayinTuruPill({ tur, className = "" }: { tur: OgrenmeAraciTuru; className?: string }) {
  const sunum = YAYIN_TURU_SUNUMU[tur];
  return (
    <span
      className={`rounded-full border border-white/60 px-2 py-0.5 text-[9px] font-extrabold shadow-sm backdrop-blur-sm ${className}`}
      style={{ color: sunum.renk, backgroundColor: `${sunum.zemin}e8` }}
    >
      {sunum.etiket}
    </span>
  );
}

