// app/analiz/_components/SonucGrafigi.tsx
//
// "Analiz Et" sonrası seçilen pill kombinasyonunun sonuçlarını gösterir.
// Üst tarafta: seçilen değişkenlerin toplam değer kartları.
// Alt tarafta: birim uyumuna göre çizgi grafik veya iki ayrı bar grafik.
//
// Mod kararı:
//   - Tüm seçimler aynı birim → tek çizgi grafik
//   - Karışık birim            → iki ayrı bar grafik (adet + puan)
//
// Bar grafiklerde: maxBarSize=60 (geniş alan ezilmez),
// linearGradient + drop-shadow ile modern 3D hissi.

"use client";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
  LabelList,
} from "recharts";

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
  if (URETIM_YESIL_IDLERI.has(id)) {
    return { rakam: "text-green-600", kenar: "border-l-green-500" };
  }
  if (URETIM_TURUNCU_IDLERI.has(id)) {
    return { rakam: "text-orange-600", kenar: "border-l-orange-500" };
  }
  if (TUKETIM_KAYIP_IDLERI.has(id)) {
    return { rakam: "text-red-600", kenar: "border-l-red-500" };
  }
  return { rakam: "text-blue-600", kenar: "border-l-blue-500" };
}

function pillBirimi(id: string): "adet" | "puan" {
  if (id === "net_puan" || id === "kazanilan_toplam_puan" || id === "kaybedilen_toplam_puan") {
    return "puan";
  }
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

// Renk gradient için açık ton döndürür (3D hissi için)
function pillBarRengiAcik(id: string): string {
  if (URETIM_YESIL_IDLERI.has(id)) return "#86efac";   // green-300
  if (URETIM_TURUNCU_IDLERI.has(id)) return "#fdba74"; // orange-300
  if (TUKETIM_KAYIP_IDLERI.has(id)) return "#fca5a5";  // red-300
  return "#93c5fd";                                     // blue-300
}

export default function SonucGrafigi({
  degisken_idleri,
  degisken_adlari,
  sonuclar,
  noktalar,
}: Props) {
  const birimler = degisken_idleri.map((id) => pillBirimi(id));
  const hepsiAyniBirim = birimler.every((b) => b === birimler[0]);

  const adetIdleri = degisken_idleri.filter((id) => pillBirimi(id) === "adet");
  const puanIdleri = degisken_idleri.filter((id) => pillBirimi(id) === "puan");

  const adetBarVeri = adetIdleri.map((id) => ({
    ad: degisken_adlari[id] ?? id,
    deger: sonuclar[id] ?? 0,
    id,
    renk: pillBarRengi(id),
    renkAcik: pillBarRengiAcik(id),
  }));
  const puanBarVeri = puanIdleri.map((id) => ({
    ad: degisken_adlari[id] ?? id,
    deger: sonuclar[id] ?? 0,
    id,
    renk: pillBarRengi(id),
    renkAcik: pillBarRengiAcik(id),
  }));

  // BarChart bileşeni (tekrarı önlemek için inline component)
  function BarGrafik({ veri, baslik }: { veri: typeof adetBarVeri; baslik: string }) {
    return (
      <div>
        <div className="text-xs font-medium text-gri-metin uppercase tracking-wide mb-2">
          {baslik}
        </div>
        <div className="w-full" style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={veri} margin={{ top: 25, right: 10, left: 0, bottom: 5 }}>
              <defs>
                {veri.map((entry) => (
                  <linearGradient
                    key={`grad-${entry.id}`}
                    id={`grad-${entry.id}`}
                    x1="0" y1="0" x2="0" y2="1"
                  >
                    <stop offset="0%" stopColor={entry.renkAcik} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={entry.renk} stopOpacity={1} />
                  </linearGradient>
                ))}
                <filter id="bar-shadow" x="-10%" y="-10%" width="120%" height="120%">
                  <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.18" />
                </filter>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="ad"
                tick={{ fontSize: 12, fill: "#374151" }}
                interval={0}
                angle={-15}
                textAnchor="end"
                height={70}
              />
              <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "0.375rem",
                  fontSize: "0.875rem",
                }}
              />
              <Bar
                dataKey="deger"
                radius={[6, 6, 0, 0]}
                maxBarSize={85}
                style={{ filter: "url(#bar-shadow)" }}
              >
                {veri.map((entry) => (
                  <Cell key={entry.id} fill={`url(#grad-${entry.id})`} />
                ))}
                <LabelList
                  dataKey="deger"
                  position="top"
                  style={{ fontSize: 13, fontWeight: 600, fill: "#374151" }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  return (
    <section className="bg-white rounded-lg border border-gray-200 p-6 flex flex-col gap-6">
      {/* Üst: toplam değer kartları */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {degisken_idleri.map((id) => {
          const stil = pillRengiSinifi(id);
          const deger = sonuclar[id] ?? 0;
          return (
            <div
              key={id}
              className={`bg-white border border-gray-200 border-l-4 ${stil.kenar} rounded-md px-4 py-3`}
            >
              <div className="text-xs font-medium text-gri-metin uppercase tracking-wide mb-1">
                {degisken_adlari[id] ?? id}
              </div>
              <div className={`text-2xl font-bold ${stil.rakam}`}>
                {deger}
              </div>
            </div>
          );
        })}
      </div>

      {/* Alt: birim uyumuna göre grafik */}
      {hepsiAyniBirim ? (
        <div className="w-full" style={{ height: 360 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={noktalar} margin={{ top: 20, right: 30, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="etiket"
                tick={{ fontSize: 13, fill: "#374151" }}
              />
              <YAxis tick={{ fontSize: 13, fill: "#6b7280" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "0.375rem",
                  fontSize: "0.875rem",
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: "13px" }}
                formatter={(value) => degisken_adlari[value] ?? value}
              />
              {degisken_idleri.map((id, idx) => (
                <Line
                  key={id}
                  type="monotone"
                  dataKey={id}
                  stroke={CIZGI_PALETI[idx % CIZGI_PALETI.length]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {adetBarVeri.length > 0 && <BarGrafik veri={adetBarVeri} baslik="Adet" />}
          {puanBarVeri.length > 0 && <BarGrafik veri={puanBarVeri} baslik="Puan" />}
        </div>
      )}
    </section>
  );
}