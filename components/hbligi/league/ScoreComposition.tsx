// components/hbligi/league/ScoreComposition.tsx
// "Net Puanın Bileşimi" — net puan + ECharts donut kırılımı + insight.
// Toplamlar GERÇEK (kullanıcı kırılımı); insight metni STUB (motor — Faz 2).

"use client";

import { useMemo } from "react";
import EChart from "@/components/grafik/EChart";
import type { KirilimKalemi } from "./types";
import { Gauge } from "lucide-react";
import styles from "./league.module.css";

const RENK: Record<KirilimKalemi["tip"], string> = {
  izleme: "#16a34a",
  cevaplama: "#7c3aed",
  oneri: "#f59e0b",
  negatif: "#dc2626",
};

export default function ScoreComposition({
  netPuan,
  kirilim,
  insight,
}: {
  netPuan: number;
  kirilim: KirilimKalemi[];
  insight: string;
}) {
  // Donut: negatif dahil mutlak değerle dilimlenir (nereden geldi/gitti); legend işaretli.
  const option = useMemo(
    () => ({
      tooltip: { trigger: "item" as const, formatter: "{b}: {c}" },
      series: [
        {
          type: "pie" as const,
          radius: ["62%", "88%"],
          avoidLabelOverlap: false,
          label: { show: false },
          labelLine: { show: false },
          data: kirilim
            .filter((k) => Math.abs(k.deger) > 0)
            .map((k) => ({ value: Math.abs(k.deger), name: k.etiket, itemStyle: { color: RENK[k.tip] } })),
        },
      ],
    }),
    [kirilim],
  );

  return (
    <section className={`${styles.panel} flex h-full min-h-0 flex-col p-4`}>
        <div className="mb-2 flex items-center justify-between">
          <div><div className={styles.eyebrow}>Neden bu konumdasın?</div><h2 className={styles.sectionHeading}>Net Puanın Bileşimi</h2></div>
          <div className="rounded-full bg-[#edf6ff] p-2 text-[#3599ee]"><Gauge className="h-4 w-4" /></div>
        </div>

        <div className="flex min-h-0 flex-1 items-center gap-3">
          <div className="relative shrink-0" style={{ width: 96 }}>
            <EChart option={option} height={96} />
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[9px] font-bold uppercase tracking-wide text-[#8492a6]">Net puan</span>
              <span className="text-xl font-extrabold tabular-nums text-[#10213d]">{netPuan}</span>
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-1.5">
            {kirilim.map((k) => (
              <div key={k.tip} className="flex items-center gap-2 text-[12px]">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: RENK[k.tip] }} />
                <span className="min-w-0 flex-1 truncate font-medium text-[#64748b]">{k.etiket}</span>
                <span className="font-extrabold tabular-nums text-[#20324c]">{k.deger}</span>
                <span className="w-9 text-right text-[10px] font-semibold text-[#8b99ab] tabular-nums">%{k.yuzde}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-2 rounded-xl bg-[#f5f8fc] px-3 py-2 text-[11px] font-medium leading-snug text-[#61748d]">{insight}</div>
    </section>
  );
}
