// app/analiz/_components/TuketimKart.tsx
//
// Tüketim değişkenleri pill kartı.
// 16 değişken kombinasyon havuzunda (8 kazanım + 8 kayıp).
// 3 türev (kazanilan_toplam_puan, kaybedilen_toplam_puan, net_puan) ayrı satırda,
// pill değil sadece okunan değer kartları. Kullanıcı seçemez.
//
// Sol kenar renk şeridi:
//   - Mavi: kazanım metrikleri (alt_kategori = 'kazanim')
//   - Kırmızı: kayıp metrikleri (alt_kategori = 'kayip')
// Türev kartlar:
//   - Kazanılan Toplam: mavi sol şerit, mavi rakam
//   - Kaybedilen Toplam: kırmızı sol şerit, kırmızı rakam
//   - Net Puan: değere göre dinamik (pozitif mavi, negatif kırmızı, sıfır gri)

"use client";

import type { Degisken } from "@/lib/analiz/paylasilan/kombinasyonlar";

type Props = {
  degiskenler: Degisken[];
  secili: string[];
  onSecimDegisti: (yeniSecim: string[]) => void;
  turevDegerleri: Record<string, number>;
};

const TUREV_IDLERI = [
  "kazanilan_toplam_puan",
  "kaybedilen_toplam_puan",
  "net_puan",
];

const RENK_SINIFLARI: Record<"mavi" | "kirmizi", { kenar: string; aktif: string }> = {
  mavi: {
    kenar: "border-l-4 border-l-blue-500",
    aktif: "bg-blue-500 text-white border-blue-500 border-l-4 border-l-blue-500",
  },
  kirmizi: {
    kenar: "border-l-4 border-l-red-500",
    aktif: "bg-red-500 text-white border-red-500 border-l-4 border-l-red-500",
  },
};

function tuketimRengi(d: Degisken): "mavi" | "kirmizi" {
  return d.alt_kategori === "kayip" ? "kirmizi" : "mavi";
}

function turevStili(degisken_id: string, deger: number): { kenar: string; rakam: string } {
  if (degisken_id === "kazanilan_toplam_puan") {
    return { kenar: "border-l-blue-500", rakam: "text-blue-600" };
  }
  if (degisken_id === "kaybedilen_toplam_puan") {
    return { kenar: "border-l-red-500", rakam: "text-red-600" };
  }
  // net_puan: değere göre dinamik
  if (deger > 0) return { kenar: "border-l-blue-500", rakam: "text-blue-600" };
  if (deger < 0) return { kenar: "border-l-red-500", rakam: "text-red-600" };
  return { kenar: "border-l-gray-400", rakam: "text-gray-600" };
}

export default function TuketimKart({
  degiskenler,
  secili,
  onSecimDegisti,
  turevDegerleri,
}: Props) {
  const havuzdakiler = degiskenler.filter((d) => d.kombinasyon_havuzunda === true);
  const turevler = degiskenler.filter((d) => TUREV_IDLERI.includes(d.degisken_id));

  const pillTikla = (degisken_id: string) => {
    if (secili.includes(degisken_id)) {
      onSecimDegisti(secili.filter((id) => id !== degisken_id));
      return;
    }
    if (secili.length >= 3) {
      return;
    }
    onSecimDegisti([...secili, degisken_id]);
  };

  return (
    <section className="bg-white rounded-lg border border-gray-200 p-5">
      <h2 className="text-base font-semibold text-koyu-metin mb-4">
        Tüketim Analizi
      </h2>

      {/* Kombinasyon havuzu (16 pill) */}
      <div className="flex flex-wrap gap-2 mb-4">
        {havuzdakiler.map((d) => {
          const aktif = secili.includes(d.degisken_id);
          const renk = tuketimRengi(d);
          const sinif = RENK_SINIFLARI[renk];

          return (
            <button
              key={d.degisken_id}
              type="button"
              onClick={() => pillTikla(d.degisken_id)}
              className={
                "px-4 py-2 rounded-md text-sm border transition-colors " +
                (aktif
                  ? sinif.aktif
                  : `bg-white text-koyu-metin border-gray-300 ${sinif.kenar} hover:border-bordo hover:text-bordo`)
              }
            >
              {d.ad}
            </button>
          );
        })}
      </div>

      {/* Ayraç çizgi */}
      <div className="border-t border-gray-200 mb-4" />

      {/* Türev değerleri — 3 kart, sol şerit + büyük rakam */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {turevler.map((d) => {
          const deger = turevDegerleri[d.degisken_id] ?? 0;
          const stil = turevStili(d.degisken_id, deger);
          return (
            <div
              key={d.degisken_id}
              className={`bg-white border border-gray-200 border-l-4 ${stil.kenar} rounded-md px-4 py-3`}
            >
              <div className="text-xs font-medium text-gri-metin uppercase tracking-wide mb-1">
                {d.ad}
              </div>
              <div className={`text-2xl font-bold ${stil.rakam}`}>
                {deger}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}