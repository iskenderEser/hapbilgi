// "Net Puanın Bileşenleri" — seçili dönemin kazandıran ve kaybettiren puan kalemleri.

"use client";

import { useMemo } from "react";
import EChart from "@/components/grafik/EChart";
import type { KirilimKalemi } from "./types";
import {
  ArrowDown,
  Gauge,
  Lightbulb,
  MessageCircle,
  Play,
  Trophy,
  Users,
} from "lucide-react";
import styles from "./league.module.css";

const KAZANC_RENK: Record<KirilimKalemi["tip"], string> = {
  izleme: "#28b56b",
  cevaplama: "#7c3aed",
  oneri: "#f59e0b",
  eclub: "#16a9c7",
  negatif: "#dc2626",
};

const KAZANC_META = {
  izleme: { kisa: "İzleme", Icon: Play, ikonStil: "bg-blue-50 text-blue-500" },
  cevaplama: { kisa: "Cevaplama", Icon: MessageCircle, ikonStil: "bg-violet-50 text-violet-500" },
  oneri: { kisa: "Öneri", Icon: Lightbulb, ikonStil: "bg-amber-50 text-amber-500" },
  eclub: { kisa: "E-Club", Icon: Users, ikonStil: "bg-cyan-50 text-cyan-500" },
} as const;

export interface KayipKalemi {
  etiket: string;
  deger: number;
}

export default function ScoreComposition({
  netPuan,
  kazandiranlar,
  kaybettirenler,
}: {
  netPuan: number;
  kazandiranlar: KirilimKalemi[];
  kaybettirenler: KayipKalemi[];
}) {
  const toplamKazanc = kazandiranlar.reduce((toplam, kalem) => toplam + kalem.deger, 0);
  const toplamKayip = kaybettirenler.reduce((toplam, kalem) => toplam + kalem.deger, 0);
  const kayipSatirlari: Array<KayipKalemi | null> = [...kaybettirenler, null].slice(0, 4);

  const option = useMemo(() => {
    const enBuyukDeger = Math.max(1, ...kazandiranlar.map((kalem) => kalem.deger));
    const kayiplar = kazandiranlar.map((_, index) => kaybettirenler[index]?.deger ?? 0);

    return {
      animationDuration: 450,
      grid: { left: 0, right: 0, top: 0, bottom: 0 },
      xAxis: { type: "value" as const, min: 0, max: enBuyukDeger, show: false },
      yAxis: {
        type: "category" as const,
        inverse: true,
        data: kazandiranlar.map((kalem) => kalem.etiket),
        show: false,
      },
      series: [
        {
          type: "bar" as const,
          data: kazandiranlar.map(() => enBuyukDeger),
          barWidth: 14,
          silent: true,
          itemStyle: { color: "#e9eef5", borderRadius: 7 },
          z: 1,
        },
        {
          type: "bar" as const,
          data: kazandiranlar.map((kalem) => ({ value: kalem.deger, itemStyle: { color: KAZANC_RENK[kalem.tip], borderRadius: 7 } })),
          barWidth: 14,
          barGap: "-100%",
          silent: true,
          z: 2,
        },
        {
          type: "bar" as const,
          stack: "kayip",
          data: kayiplar.map((deger) => enBuyukDeger - deger),
          barWidth: 14,
          barGap: "-100%",
          silent: true,
          itemStyle: { color: "transparent" },
          z: 3,
        },
        {
          type: "bar" as const,
          stack: "kayip",
          data: kayiplar,
          barWidth: 14,
          silent: true,
          itemStyle: { color: "#ef4444", borderRadius: [0, 7, 7, 0] },
          z: 4,
        },
      ],
    };
  }, [kazandiranlar, kaybettirenler]);

  return (
    <section className={`${styles.panel} flex min-h-0 flex-col p-4`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className={styles.sectionHeading}>Net Puanın Bileşenleri</h2>
        <div className="flex shrink-0 items-center gap-2 rounded-xl border border-blue-100 bg-[#eef6ff] px-3 py-1.5">
          <Gauge className="h-4 w-4 text-[#1761cf]" />
          <span className="text-[13px] font-medium text-[#60728f]">Net Puan</span>
          <span className="text-[13px] font-semibold tabular-nums text-[#174fc2]">{netPuan.toLocaleString("tr-TR")}</span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-1.5">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-600">
            <Trophy className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-wide text-emerald-700">Kazandıranlar</div>
            <div className="text-[9px] font-semibold leading-tight tabular-nums text-emerald-700">+{toplamKazanc.toLocaleString("tr-TR")} Puan</div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 rounded-xl border border-rose-100 bg-rose-50/70 px-3 py-1.5">
          <div className="text-right">
            <div className="text-[9px] font-semibold uppercase tracking-wide text-rose-700">Kaybettirenler</div>
            <div className="text-[9px] font-semibold leading-tight tabular-nums text-rose-700">-{toplamKayip.toLocaleString("tr-TR")} Puan</div>
          </div>
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-rose-100 text-rose-600">
            <ArrowDown className="h-4 w-4" />
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-[minmax(90px,1.2fr)_54px_minmax(120px,2fr)_54px_minmax(90px,1.2fr)] gap-2 px-2 text-[9px] font-medium uppercase tracking-wide text-[#718198]">
        <div>Puan Bileşeni</div>
        <div className="text-center">Kazandıran</div>
        <div />
        <div className="text-center">Kaybettiren</div>
        <div />
      </div>

      <div className="relative mt-1.5 min-h-[176px]">
        <div className="pointer-events-none absolute inset-0 grid grid-rows-4 gap-1.5">
          {kazandiranlar.map((kalem) => <div key={kalem.tip} className="rounded-xl border border-[#e8edf4] bg-white shadow-[0_2px_8px_rgba(36,64,98,0.04)]" />)}
        </div>

        <div className="relative grid grid-cols-[minmax(90px,1.2fr)_54px_minmax(120px,2fr)_54px_minmax(90px,1.2fr)] gap-2 px-2">
          <div className="grid h-[176px] grid-rows-4 gap-1.5">
            {kazandiranlar.map((kalem) => {
              const meta = KAZANC_META[kalem.tip as keyof typeof KAZANC_META];
              const Icon = meta.Icon;
              return (
                <div key={kalem.tip} className="flex min-w-0 items-center gap-2">
                  <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${meta.ikonStil}`}><Icon className="h-3.5 w-3.5" /></div>
                  <div className="truncate text-[11px] font-semibold text-[#20324c]">{meta.kisa}</div>
                </div>
              );
            })}
          </div>

          <div className="grid h-[176px] grid-rows-4 gap-1.5">
            {kazandiranlar.map((kalem) => (
              <div key={kalem.tip} className={`flex items-center justify-center rounded-lg text-xs font-semibold tabular-nums ${kalem.deger > 0 ? "bg-emerald-50 text-emerald-700" : "bg-[#f2f5f9] text-[#52647c]"}`}>
                {kalem.deger > 0 ? "+" : ""}{kalem.deger.toLocaleString("tr-TR")}
              </div>
            ))}
          </div>

          <div className="flex h-[176px] items-center">
            <EChart option={option} height={176} />
          </div>

          <div className="grid h-[176px] grid-rows-4 gap-1.5">
            {kayipSatirlari.map((kalem, index) => (
              <div key={kalem?.etiket ?? `bos-${index}`} className={`flex items-center justify-center rounded-lg text-xs font-semibold tabular-nums ${kalem && kalem.deger > 0 ? "bg-rose-50 text-rose-700" : "bg-[#f2f5f9] text-[#52647c]"}`}>
                {kalem && kalem.deger > 0 ? `-${kalem.deger.toLocaleString("tr-TR")}` : "–"}
              </div>
            ))}
          </div>

          <div className="grid h-[176px] grid-rows-4 gap-1.5">
            {kayipSatirlari.map((kalem, index) => (
              <div key={kalem?.etiket ?? `bos-metin-${index}`} className="flex min-w-0 items-center">
                <div className="truncate text-[11px] font-semibold text-[#20324c]">{kalem?.etiket ?? "Kaybı Yok"}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
