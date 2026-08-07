// app/analiz/_components/SonucGrafigi.tsx
//
// "Analiz Et" sonrası seçilen pill kombinasyonunun sonuçlarını gösterir.
// Üst: seçilen değişkenlerin toplam değer kartları.
// Alt: birim uyumuna göre grafik —
//   - Tüm seçimler aynı birim → tek çizgi grafik (çok serili)
//   - Karışık birim            → iki ayrı bar grafik (adet + puan)
// Grafik motoru: components/grafik/EChart (ECharts). Bar'larda dikey gradient
// (3D his), değer etiketleri; çizgide serilere göre legend.

"use client";

import type { EChartsCoreOption } from "echarts/core";
import EChart from "@/components/grafik/EChart";

type Props = {
  degisken_idleri: string[];
  degisken_adlari: Record<string, string>;
  sonuclar: Record<string, number>;
  noktalar: Record<string, number | string>[];
};

const URETIM_YESIL_IDLERI = new Set<string>([
  "urun_sayisi",
  "video_sayisi",
  "soru_sayisi",
]);

const URETIM_TURUNCU_IDLERI = new Set<string>([
  "ileri_sarma_izinli_video_sayisi",
  "potansiyel_video_izleme_puani",
  "potansiyel_dogru_cevap_puani",
]);

const TUKETIM_KAYIP_IDLERI = new Set<string>([
  "izlenmeyen_video_sayisi",
  "kaybedilen_video_puani",
  "yanlis_cevaplanan_soru_sayisi",
  "kaybedilen_cevaplama_puani",
  "izlenmeyen_oneri_video_sayisi",
  "kaybedilen_oneri_video_puani",
  "ileri_sarilan_video_sayisi",
  "kaybedilen_ileri_sarma_puani",
]);

const CIZGI_PALETI = ["#3b82f6", "#f97316", "#22c55e"];

function pillRengiSinifi(id: string): { rakam: string; kenar: string } {
  if (URETIM_YESIL_IDLERI.has(id)) return { rakam: "text-green-600", kenar: "border-l-green-500" };
  if (URETIM_TURUNCU_IDLERI.has(id)) return { rakam: "text-orange-600", kenar: "border-l-orange-500" };
  if (TUKETIM_KAYIP_IDLERI.has(id)) return { rakam: "text-red-600", kenar: "border-l-red-500" };
  return { rakam: "text-blue-600", kenar: "border-l-blue-500" };
}

function pillBirimi(id: string): "adet" | "puan" {
  if (id === "net_puan" || id === "kazanilan_toplam_puan" || id === "kaybedilen_toplam_puan") return "puan";
  if (id.endsWith("_puani")) return "puan";
  if (id.endsWith("_sayisi")) return "adet";
  return "adet";
}

function pillBarRengi(id: string): string {
  if (URETIM_YESIL_IDLERI.has(id)) return "#22c55e";
  if (URETIM_TURUNCU_IDLERI.has(id)) return "#f97316";
  if (TUKETIM_KAYIP_IDLERI.has(id)) return "#ef4444";
  return "#3b82f6";
}

// Gradient için açık ton (3D his).
function pillBarRengiAcik(id: string): string {
  if (URETIM_YESIL_IDLERI.has(id)) return "#86efac";
  if (URETIM_TURUNCU_IDLERI.has(id)) return "#fdba74";
  if (TUKETIM_KAYIP_IDLERI.has(id)) return "#fca5a5";
  return "#93c5fd";
}

interface BarKalem {
  ad: string;
  deger: number;
  renk: string;
  renkAcik: string;
}

function barOption(veri: BarKalem[]): EChartsCoreOption {
  return {
    tooltip: { trigger: "item", formatter: "{b}: {c}" },
    grid: { left: 8, right: 10, top: 28, bottom: 40, containLabel: true },
    xAxis: {
      type: "category",
      data: veri.map((v) => v.ad),
      axisLabel: { color: "#374151", fontSize: 12, interval: 0, rotate: 15 },
      axisLine: { lineStyle: { color: "#e5e7eb" } },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#6b7280", fontSize: 12 },
      splitLine: { lineStyle: { color: "#eef0f2" } },
    },
    series: [{
      type: "bar",
      barMaxWidth: 85,
      itemStyle: { borderRadius: [6, 6, 0, 0] },
      label: { show: true, position: "top", color: "#374151", fontSize: 13, fontWeight: "bold" },
      data: veri.map((v) => ({
        value: v.deger,
        itemStyle: {
          color: {
            type: "linear", x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: v.renkAcik },
              { offset: 1, color: v.renk },
            ],
          },
        },
      })),
    }],
  };
}

export default function SonucGrafigi({ degisken_idleri, degisken_adlari, sonuclar, noktalar }: Props) {
  const birimler = degisken_idleri.map((id) => pillBirimi(id));
  const hepsiAyniBirim = birimler.every((b) => b === birimler[0]);

  const barVeri = (idler: string[]): BarKalem[] =>
    idler.map((id) => ({
      ad: degisken_adlari[id] ?? id,
      deger: sonuclar[id] ?? 0,
      renk: pillBarRengi(id),
      renkAcik: pillBarRengiAcik(id),
    }));

  const adetBarVeri = barVeri(degisken_idleri.filter((id) => pillBirimi(id) === "adet"));
  const puanBarVeri = barVeri(degisken_idleri.filter((id) => pillBirimi(id) === "puan"));

  const cizgiOption: EChartsCoreOption = {
    color: CIZGI_PALETI,
    tooltip: { trigger: "axis" },
    legend: {
      bottom: 0,
      data: degisken_idleri.map((id) => degisken_adlari[id] ?? id),
      textStyle: { color: "#374151", fontSize: 13 },
    },
    grid: { left: 8, right: 16, top: 16, bottom: 40, containLabel: true },
    xAxis: {
      type: "category",
      data: noktalar.map((n) => String(n.etiket ?? "")),
      axisLabel: { color: "#374151", fontSize: 13 },
      axisLine: { lineStyle: { color: "#e5e7eb" } },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#6b7280", fontSize: 13 },
      splitLine: { lineStyle: { color: "#eef0f2" } },
    },
    series: degisken_idleri.map((id) => ({
      name: degisken_adlari[id] ?? id,
      type: "line",
      smooth: true,
      symbolSize: 8,
      lineStyle: { width: 2 },
      data: noktalar.map((n) => Number(n[id] ?? 0)),
    })),
  };

  return (
    <section className="bg-white rounded-lg border border-gray-200 p-6 flex flex-col gap-6">
      {/* Üst: toplam değer kartları */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {degisken_idleri.map((id) => {
          const stil = pillRengiSinifi(id);
          return (
            <div key={id} className={`bg-white border border-gray-200 border-l-4 ${stil.kenar} rounded-md px-4 py-3`}>
              <div className="text-xs font-medium text-gri-metin uppercase tracking-wide mb-1">
                {degisken_adlari[id] ?? id}
              </div>
              <div className={`text-2xl font-bold ${stil.rakam}`}>{sonuclar[id] ?? 0}</div>
            </div>
          );
        })}
      </div>

      {/* Alt: birim uyumuna göre grafik */}
      {hepsiAyniBirim ? (
        <EChart option={cizgiOption} height={360} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {adetBarVeri.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gri-metin uppercase tracking-wide mb-2">Adet</div>
              <EChart option={barOption(adetBarVeri)} height={300} />
            </div>
          )}
          {puanBarVeri.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gri-metin uppercase tracking-wide mb-2">Puan</div>
              <EChart option={barOption(puanBarVeri)} height={300} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
