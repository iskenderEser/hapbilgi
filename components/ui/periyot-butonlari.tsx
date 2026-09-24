"use client";

export interface PeriyotSecenegi<T extends string> {
  key: T;
  label: string;
}

export function PeriyotButonlari<T extends string>({
  secenekler,
  deger,
  onDegistir,
  ariaLabel = "Rapor dönemi",
  className = "",
}: {
  secenekler: readonly PeriyotSecenegi<T>[];
  deger: T;
  onDegistir: (deger: T) => void;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex min-w-0 max-w-full flex-1 items-center gap-1 overflow-x-auto rounded-[14px] border border-[rgba(148,163,184,.18)] bg-white/85 p-1 shadow-[0_6px_22px_rgba(36,64,98,.05)] sm:flex-none ${className}`}
      aria-label={ariaLabel}
    >
      {secenekler.map((secenek) => {
        const aktif = deger === secenek.key;
        return (
          <button
            type="button"
            key={secenek.key}
            onClick={() => onDegistir(secenek.key)}
            aria-pressed={aktif}
            className={`shrink-0 rounded-[10px] px-3 py-[7px] text-[11px] font-bold transition-all duration-150 ${
              aktif
                ? "bg-[#237ac8] text-white shadow-[0_5px_14px_rgba(35,122,200,.22)]"
                : "text-[#718198] hover:bg-[#f2f7fc] hover:text-[#237ac8]"
            }`}
          >
            {secenek.label}
          </button>
        );
      })}
    </div>
  );
}
