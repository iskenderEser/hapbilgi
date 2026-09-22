// components/hbligi/league/LeaguePosition.tsx
// "Ligdeki Konumun" — 3 Tıklanabilir Stat Kartı (Sol) + Dinamik Kürsü (Sağ).

"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown, Trophy, Sparkles } from "lucide-react";
import LeaguePodium from "./LeaguePodium";
import type { SiraliSatir } from "./types";
import styles from "./league.module.css";

export type KapsamTipi = "bolge" | "takim" | "sirket";

export interface StatKonum {
  id: KapsamTipi;
  etiket: string;
  sira: number | null;
  toplam: number;
  degisim: number | null;
}

interface Props {
  konumlar: StatKonum[];
  kursuler?: Record<KapsamTipi, SiraliSatir[]>;
  top3?: SiraliSatir[];
  aylikAyAdi?: string;
  liderFark?: number | null;
  altFark?: number | null;
}

function getKapsamRenk(id: KapsamTipi) {
  switch (id) {
    case "bolge":
      return "#237ac8";
    case "takim":
      return "#16865f";
    case "sirket":
      return "#6957dd";
  }
}

function KonumKarti({
  id,
  etiket,
  sira,
  toplam,
  degisim,
  aktif,
  onClick,
}: StatKonum & { aktif: boolean; onClick: () => void }) {
  const renk = getKapsamRenk(id);
  const pozitif = degisim !== null && degisim > 0;
  const negatif = degisim !== null && degisim < 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex h-[50px] w-full items-center justify-between rounded-xl border bg-white px-2.5 py-1.5 text-left shadow-[0_4px_14px_rgba(31,55,90,0.035)] transition-all cursor-pointer ${
        aktif
          ? "border-[#93c5fd] ring-2 ring-[#237ac8]/25 bg-[#fbfdff]"
          : "border-[#dfe7f1] hover:border-[#b9cbe0] hover:bg-slate-50/60"
      }`}
      style={{ borderLeft: `4px solid ${renk}` }}
    >
      <div className="min-w-0 flex-1">
        <span className="block truncate text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#7d8fa5]">
          {etiket}
        </span>
        <div className="flex items-baseline gap-1 leading-none mt-0.5">
          <strong className="text-base font-black tracking-tight text-[#1e3450] tabular-nums">
            {sira ? `${sira}.` : "—"}
          </strong>
          <span className="text-[10px] font-semibold text-[#8292a7]">
            / {toplam} UTT
          </span>
        </div>
      </div>

      <div className="shrink-0">
        {degisim === null || degisim === 0 ? (
          <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-400">
            —
          </span>
        ) : (
          <span
            className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[9px] font-bold ${
              pozitif
                ? "bg-emerald-50 text-emerald-600 border border-emerald-200/60"
                : "bg-rose-50 text-rose-600 border border-rose-200/60"
            }`}
          >
            {pozitif ? (
              <ChevronUp className="h-2.5 w-2.5 shrink-0 stroke-[2.5]" />
            ) : (
              <ChevronDown className="h-2.5 w-2.5 stroke-[2.5]" />
            )}
            {Math.abs(degisim)}
          </span>
        )}
      </div>
    </button>
  );
}

export default function LeaguePosition({ konumlar, kursuler, top3, aylikAyAdi }: Props) {
  const [aktifKapsam, setAktifKapsam] = useState<KapsamTipi>("bolge");

  const aktifTop3 = kursuler?.[aktifKapsam] ?? top3 ?? [];
  const ayEtiketi = aylikAyAdi ? `${aylikAyAdi} Ayı` : "Geçen Ay";
  const baslik =
    aktifKapsam === "bolge"
      ? `${ayEtiketi} Bölge Kürsüsü`
      : aktifKapsam === "takim"
      ? `${ayEtiketi} Takım Kürsüsü`
      : `${ayEtiketi} Şirket Kürsüsü`;

  return (
    <section className={`${styles.panel} flex h-full min-h-0 flex-col p-4`}>
      <div className="mb-2.5 flex shrink-0 items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className={styles.sectionHeading}>Ligdeki Konumun</h2>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Bu Hafta
          </span>
        </div>
        <div className="rounded-full bg-[#fff6df] p-1.5 text-[#e49a0c]">
          <Trophy className="h-4 w-4" />
        </div>
      </div>

      <div className={styles.positionLayout}>
        {/* Sol Kolon: 3 Stat Kartı Alt Alta (176px dengeli en, estetik dikey bar) */}
        <div className={styles.rankStatsCol}>
          {konumlar.map((konum) => (
            <KonumKarti
              key={konum.id}
              {...konum}
              aktif={aktifKapsam === konum.id}
              onClick={() => setAktifKapsam(konum.id)}
            />
          ))}
        </div>

        {/* Sağ Kolon: Aktif Kapsamın Kürsüsü (Her ayın 1'inde bir önceki ayın ilk 3'ü) */}
        <div className={styles.podiumCol}>
          <div className="flex h-full w-full flex-col items-center justify-center">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-extrabold text-[#64748b]">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              <span>{baslik}</span>
            </div>
            <LeaguePodium top3={aktifTop3} />
          </div>
        </div>
      </div>
    </section>
  );
}
