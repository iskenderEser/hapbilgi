export type HediyeTakipTuru = "cek" | "siparis";

const TAKIP_SECENEKLERI = [
  { key: "cek", label: "Çek Takibi" },
  { key: "siparis", label: "Sipariş Takibi" },
] as const;

export default function HediyeTakipToggle({
  deger,
  onDegistir,
}: {
  deger: HediyeTakipTuru;
  onDegistir: (deger: HediyeTakipTuru) => void;
}) {
  const klavyeSecimi = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let hedefIndex = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") hedefIndex = (index + 1) % TAKIP_SECENEKLERI.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") hedefIndex = (index - 1 + TAKIP_SECENEKLERI.length) % TAKIP_SECENEKLERI.length;
    else if (event.key === "Home") hedefIndex = 0;
    else if (event.key === "End") hedefIndex = TAKIP_SECENEKLERI.length - 1;
    else return;

    event.preventDefault();
    const hedef = TAKIP_SECENEKLERI[hedefIndex];
    onDegistir(hedef.key);
    const butonlar = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role='tab']");
    butonlar?.[hedefIndex]?.focus();
  };

  return (
    <div role="tablist" aria-label="Hediye takip türü" className="inline-flex h-11 w-fit max-w-full flex-none items-center gap-1 overflow-x-auto rounded-[14px] border border-[rgba(148,163,184,.18)] bg-white/85 p-1 shadow-[0_6px_22px_rgba(36,64,98,.05)]">
      {TAKIP_SECENEKLERI.map((secenek, index) => {
        const aktif = deger === secenek.key;
        return (
          <button
            key={secenek.key}
            id={`hediye-takip-${secenek.key}-sekmesi`}
            type="button"
            role="tab"
            aria-selected={aktif}
            aria-controls={`hediye-takip-${secenek.key}-paneli`}
            tabIndex={aktif ? 0 : -1}
            onClick={() => onDegistir(secenek.key)}
            onKeyDown={(event) => klavyeSecimi(event, index)}
            className={`h-[34px] min-w-[116px] shrink-0 rounded-[10px] px-3 py-0 text-[11px] font-bold transition-all duration-150 ${aktif ? "bg-[#237ac8] text-white shadow-[0_5px_14px_rgba(35,122,200,.22)]" : "text-[#718198] hover:bg-[#f2f7fc] hover:text-[#237ac8]"}`}
          >
            {secenek.label}
          </button>
        );
      })}
    </div>
  );
}
