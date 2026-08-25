import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import SayfaRehberi from "@/components/rehber/SayfaRehberi";

export function EclubKisiSayfa({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full bg-[#f7f9fc] pb-20 md:pb-8" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-3 py-4 md:gap-5 md:px-6 md:py-6">
        {children}
      </main>
    </div>
  );
}

export function EclubKisiBaslik({
  ikon: Icon,
  baslik,
  aciklama,
  aksiyon,
  ustEtiket = "E‑Club",
  rehberAnahtar,
}: {
  ikon: LucideIcon;
  baslik: string;
  aciklama: string;
  aksiyon?: ReactNode;
  ustEtiket?: string;
  rehberAnahtar?: string;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <div className="mb-1 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#3589d8]">
          <Icon size={14} /> {ustEtiket}
        </div>
        <div className="inline-flex items-center">
          <h1 className="m-0 text-2xl font-extrabold tracking-[-0.03em] text-[#203653]">{baslik}</h1>
          {rehberAnahtar && <SayfaRehberi anahtar={rehberAnahtar} className="ml-1.5 -translate-y-1" />}
        </div>
        <p className="mt-1 max-w-2xl text-xs font-semibold leading-5 text-[#8190a3]">{aciklama}</p>
      </div>
      {aksiyon}
    </header>
  );
}

export function EclubKisiStat({
  ikon: Icon,
  etiket,
  deger,
  detay,
  renk = "#237ac8",
  zemin = "#edf6fd",
}: {
  ikon: LucideIcon;
  etiket: string;
  deger: string | number;
  detay?: string;
  renk?: string;
  zemin?: string;
}) {
  return (
    <article className="rounded-2xl border border-[#dfe7f1] bg-white p-3.5 shadow-[0_5px_16px_rgba(31,55,90,0.035)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.05em] text-[#8190a3]">{etiket}</div>
          <div className="mt-1 text-2xl font-black tabular-nums" style={{ color: renk }}>{deger}</div>
          {detay && <div className="mt-0.5 truncate text-[10px] font-semibold text-[#8796a8]">{detay}</div>}
        </div>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ color: renk, background: zemin }}>
          <Icon size={16} />
        </span>
      </div>
    </article>
  );
}

export function EclubKisiBosDurum({ ikon: Icon, baslik, aciklama }: {
  ikon: LucideIcon;
  baslik: string;
  aciklama: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[#d8e2ec] bg-white px-5 py-12 text-center">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f1f6fa] text-[#8ba0b5]"><Icon size={20} /></span>
      <h2 className="mt-3 text-sm font-extrabold text-[#40556d]">{baslik}</h2>
      <p className="mx-auto mt-1 max-w-md text-xs font-semibold leading-5 text-[#8a99aa]">{aciklama}</p>
    </div>
  );
}

export function EclubKisiYukleniyor() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-[#f7f9fc]">
      <div className="flex items-center gap-2 text-sm font-semibold text-[#71859d]">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#d7e4ef] border-t-[#3589d8]" /> Yükleniyor...
      </div>
    </div>
  );
}
