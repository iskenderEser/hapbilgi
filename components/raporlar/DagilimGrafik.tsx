// components/raporlar/DagilimGrafik.tsx
//
// Rapor dağılım görünümü — dört mod: Pasta (donut) · Sütun (bar) · Çizgi (line) ·
// Tablo. Pasta/Sütun/Çizgi ECharts ile animasyonlu (universalTransition morph);
// bar/çizgide apsis (kategori) ve ordinat (puan) başlıkları yazılı. Tablo eski
// liste görünümüdür. Her modda bir kaleme tıklayınca onSecim ile üst bileşene
// bildirir; detay (kırılım/teknik) sayfada o kalemin altında açılır (drill-down).
// Tek grafik motoru: components/grafik/EChart.

"use client";

import { useEffect, useMemo, useState } from "react";
import type { EChartsCoreOption } from "echarts/core";
import EChart, { type EChartTiklama } from "@/components/grafik/EChart";

const RENKLER = ["#378ADD", "#1D9E75", "#EF9F27", "#D4537E", "#7F77DD", "#D85A30", "#639922"];

type Mod = "pie" | "bar" | "line" | "tablo";

export interface DagilimKalem {
  ad: string;
  puan: number;
  renk?: string; // verilirse pasta/sütun bu rengi kullanır (kazanım/kayıp semantiği)
}

interface Props {
  veri: DagilimKalem[];
  secili?: string | null;
  onSecim?: (ad: string | null) => void;
  height?: number;
  apsisAdi?: string;
  ordinatAdi?: string;
  modlar?: Mod[];       // varsayılan dört mod; negatif veri olan yerde pie hariç tutulur
  indirAdi?: string;    // PNG indir butonu dosya adı
}

export default function DagilimGrafik({
  veri,
  secili,
  onSecim,
  height = 300,
  apsisAdi = "Kategori",
  ordinatAdi = "Puan",
  modlar = ["pie", "bar", "line", "tablo"],
  indirAdi,
}: Props) {
  const [mod, setMod] = useState<Mod>(modlar.includes("pie") ? "pie" : modlar[0]);
  const paletli = veri.some((k) => k.renk); // per-item semantik renk (kazanım/kayıp)

  // Mobilde x-ekseni etiketlerini eğ — 7 uzun kalem dar ekranda üst üste binmesin.
  const [dar, setDar] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const uygula = () => setDar(mq.matches);
    uygula();
    mq.addEventListener("change", uygula);
    return () => mq.removeEventListener("change", uygula);
  }, []);

  const option = useMemo<EChartsCoreOption>(() => {
    const kaynak: (string | number)[][] = [["ad", "puan"], ...veri.map((k) => [k.ad, k.puan])];
    const palet = paletli ? veri.map((k) => k.renk ?? "#888780") : RENKLER;
    const ortak = {
      color: palet,
      textStyle: { color: "#6b7280", fontFamily: "inherit" },
      dataset: { source: kaynak },
      animationDuration: 700,
      animationEasing: "cubicOut" as const,
      animationDurationUpdate: 700,
      animationEasingUpdate: "cubicInOut" as const,
    };
    if (mod === "pie") {
      return {
        ...ortak,
        tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
        series: [{
          id: "dagilim", type: "pie", radius: ["46%", "72%"],
          itemStyle: { borderRadius: 6, borderColor: "#fff", borderWidth: 2 },
          label: { color: "#374151", formatter: "{b}\n{c}", fontSize: 12 },
          emphasis: { focus: "self" },
          universalTransition: true,
          encode: { itemName: "ad", value: "puan" },
        }],
      };
    }
    // bar + line ortak eksenler (apsis/ordinat başlıklı)
    const eksenli = {
      ...ortak,
      tooltip: { trigger: "item", formatter: "{b}: {@puan}" },
      grid: { left: 12, right: 12, top: 28, bottom: dar ? 46 : 34, containLabel: true },
      xAxis: {
        type: "category" as const,
        name: apsisAdi, nameLocation: "middle" as const, nameGap: dar ? 54 : 30,
        nameTextStyle: { color: "#9ca3af", fontSize: 11 },
        axisLabel: { color: "#6b7280", fontSize: dar ? 10 : 12, interval: 0, rotate: dar ? 35 : 0 },
        axisLine: { lineStyle: { color: "#e5e7eb" } },
      },
      yAxis: {
        type: "value" as const,
        name: ordinatAdi, nameLocation: "end" as const, nameGap: 12,
        nameTextStyle: { color: "#9ca3af", fontSize: 11 },
        axisLabel: { color: "#9ca3af" },
        splitLine: { lineStyle: { color: "#f1f1ee" } },
      },
    };
    if (mod === "bar") {
      return {
        ...eksenli,
        series: [{
          id: "dagilim", type: "bar", colorBy: "data", barWidth: "52%",
          itemStyle: { borderRadius: [6, 6, 0, 0] },
          label: { show: true, position: "top", color: paletli ? "inherit" : "#374151", fontSize: 12, formatter: "{@puan}" },
          universalTransition: true,
          encode: { x: "ad", y: "puan" },
        }],
      };
    }
    return {
      ...eksenli,
      series: [{
        id: "dagilim", type: "line", smooth: true, symbolSize: 9,
        lineStyle: { width: 3, color: "#378ADD" }, itemStyle: { color: "#378ADD" },
        areaStyle: { color: "rgba(55,138,221,0.10)" },
        label: { show: true, position: "top", color: "#374151", fontSize: 12, formatter: "{@puan}" },
        universalTransition: true,
        encode: { x: "ad", y: "puan" },
      }],
    };
  }, [veri, mod, apsisAdi, ordinatAdi, paletli, dar]);

  const btnStil = (aktif: boolean): React.CSSProperties => ({
    padding: "4px 13px", borderRadius: 999, fontSize: 13, cursor: "pointer",
    border: "0.5px solid #e5e7eb",
    background: aktif ? "rgba(86,174,255,0.12)" : "#fff",
    color: aktif ? "#185fa5" : "#6b7280",
    fontWeight: aktif ? 600 : 400,
  });

  const modTanimlari: { key: Mod; etiket: string }[] = [
    { key: "pie", etiket: "Pasta" },
    { key: "bar", etiket: "Sütun" },
    { key: "line", etiket: "Çizgi" },
    { key: "tablo", etiket: "Tablo" },
  ];
  const gorunurModlar = modTanimlari.filter((m) => modlar.includes(m.key));

  return (
    <div>
      <div className="flex gap-2 mb-2 flex-wrap">
        {gorunurModlar.map((m) => (
          <button key={m.key} type="button" style={btnStil(mod === m.key)} onClick={() => setMod(m.key)}>
            {m.etiket}
          </button>
        ))}
      </div>

      {mod === "tablo" ? (
        <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "0.5px solid #e5e7eb" }}>
              <th className="text-left py-2" style={{ color: "#9ca3af", fontWeight: 500 }}>{apsisAdi}</th>
              <th className="text-right py-2" style={{ color: "#9ca3af", fontWeight: 500 }}>{ordinatAdi}</th>
            </tr>
          </thead>
          <tbody>
            {veri.map((k) => (
              <tr
                key={k.ad}
                onClick={() => onSecim?.(k.ad === secili ? null : k.ad)}
                className="cursor-pointer hover:bg-gray-50"
                style={{ borderBottom: "0.5px solid #f1f1ee", background: k.ad === secili ? "rgba(86,174,255,0.08)" : "transparent" }}
              >
                <td className="py-2" style={{ color: k.renk ?? "#374151" }}>{k.ad}</td>
                <td className="text-right py-2 font-medium" style={{ color: k.renk ?? "#374151" }}>{k.puan.toLocaleString("tr-TR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EChart
          option={option}
          height={height}
          indirAdi={indirAdi}
          onClick={(p: EChartTiklama) => {
            const ad = p.name ?? null;
            onSecim?.(ad && ad === secili ? null : ad);
          }}
        />
      )}
    </div>
  );
}
