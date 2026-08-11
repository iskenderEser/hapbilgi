// components/grafik/EChart.tsx
//
// Projenin TEK grafik sarmalayıcısı (ECharts). Recharts emekliye ayrılıyor —
// karma/veri-yoğun (Analiz) ve az-veri/animasyonlu (raporlar) tüm grafikler buradan.
//
// Neden custom wrapper: echarts-for-react yerine ince bir sarmalayıcı — sürüm/
// peer-dependency riski yok (echarts/core React'a bağımlı değil), tree-shake ile
// yalnız kullanılan grafik/bileşenler bundle'a girer, React 19 + React Compiler
// güvenli (ref + effect). SSR: "use client" + init effect içinde → sunucuda div
// boş render olur, grafik istemcide kurulur (window'a import anında dokunulmaz).

"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart, PieChart, LineChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DatasetComponent,
  GraphicComponent,
} from "echarts/components";
import { LabelLayout, UniversalTransition } from "echarts/features";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsCoreOption } from "echarts/core";

echarts.use([
  BarChart,
  PieChart,
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DatasetComponent,
  GraphicComponent,
  LabelLayout,
  UniversalTransition,
  CanvasRenderer,
]);

export interface EChartTiklama {
  name?: string;
  dataIndex?: number;
  value?: unknown;
}

interface EChartProps {
  option: EChartsCoreOption;
  height?: number | string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (p: EChartTiklama) => void;
  indirAdi?: string; // verilirse sağ üstte PNG indir butonu çizilir (dosya adı)
}

export default function EChart({ option, height = 320, className, style, onClick, indirAdi }: EChartProps) {
  const kutuRef = useRef<HTMLDivElement>(null);
  const grafikRef = useRef<echarts.ECharts | null>(null);
  // Handler'ı ref'te tut ki her değişimde grafik yeniden kurulmasın.
  const tiklamaRef = useRef(onClick);
  tiklamaRef.current = onClick;

  // Kurulum + tıklama + boyut takibi + temizlik (bir kez).
  useEffect(() => {
    if (!kutuRef.current) return;
    const grafik = echarts.init(kutuRef.current);
    grafikRef.current = grafik;
    grafik.on("click", (p) => tiklamaRef.current?.(p as EChartTiklama));
    const gozlemci = new ResizeObserver(() => grafik.resize());
    gozlemci.observe(kutuRef.current);
    return () => {
      gozlemci.disconnect();
      grafik.dispose();
      grafikRef.current = null;
    };
  }, []);

  // Option değişince güncelle. replaceMerge: eksen bileşenleri (pie↔bar geçişinde
  // pie'da eksen yok → kaldırılır); series universalTransition ile morph olur.
  useEffect(() => {
    grafikRef.current?.setOption(option, { replaceMerge: ["xAxis", "yAxis"] });
  }, [option]);

  // PNG indir — ekrandaki grafik değişmez; yalnız indirilen dosyanın sağ-alt
  // köşesine HapBilgi logosu (baykuş + "hapbilgi") filigran olarak basılır.
  const indir = async () => {
    const grafik = grafikRef.current;
    if (!grafik) return;
    const kaynak = grafik.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: "#fff" });

    const yukle = (src: string) =>
      new Promise<HTMLImageElement>((coz, red) => {
        const im = new Image();
        im.onload = () => coz(im);
        im.onerror = red;
        im.src = src;
      });

    const tetikle = (dataUrl: string) => {
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${indirAdi}.png`;
      a.click();
    };

    try {
      const [taban, logo] = await Promise.all([yukle(kaynak), yukle("/logo-acik-zemin.png")]);
      const canvas = document.createElement("canvas");
      canvas.width = taban.naturalWidth;
      canvas.height = taban.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return tetikle(kaynak);
      ctx.drawImage(taban, 0, 0);
      // Sağ-alt filigran — genişlik grafiğin %7'si (40–110px arası), oran korunur, %50 saydam.
      const lw = Math.min(110, Math.max(40, canvas.width * 0.07));
      const lh = lw * (logo.naturalHeight / logo.naturalWidth);
      const bosluk = Math.max(12, canvas.width * 0.02);
      ctx.globalAlpha = 0.5;
      ctx.drawImage(logo, canvas.width - lw - bosluk, canvas.height - lh - bosluk, lw, lh);
      ctx.globalAlpha = 1;
      tetikle(canvas.toDataURL("image/png"));
    } catch {
      tetikle(kaynak); // logo yüklenemezse filigransız indir
    }
  };

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <div ref={kutuRef} className={className} style={{ width: "100%", height, ...style }} />
      {indirAdi && (
        <button
          type="button"
          onClick={indir}
          title="PNG indir"
          aria-label="PNG indir"
          style={{
            position: "absolute", top: 4, right: 4, display: "flex", alignItems: "center", gap: 4,
            padding: "3px 9px", fontSize: 12, borderRadius: 999, cursor: "pointer",
            border: "0.5px solid #e5e7eb", background: "rgba(255,255,255,0.9)", color: "#6b7280",
          }}
        >
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
          </svg>
          PNG
        </button>
      )}
    </div>
  );
}
