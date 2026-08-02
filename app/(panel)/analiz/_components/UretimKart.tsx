// app/analiz/_components/UretimKart.tsx
//
// Üretim değişkenleri pill kartı.
// Kullanıcı 1-3 pill seçebilir. 4. tıklama sessizce engellenir.
// Sol kenar renk şeridi:
//   - Yeşil: üretilen miktar (ürün/video/soru sayısı)
//   - Turuncu: potansiyel/koşullu metrikler (ileri sarma, potansiyel puanlar)

"use client";

import type { Degisken } from "@/lib/analiz/paylasilan/kombinasyonlar";

type Props = {
  degiskenler: Degisken[];
  secili: string[];
  onSecimDegisti: (yeniSecim: string[]) => void;
};

const YESIL_IDLERI = new Set<string>([
  "urun_sayisi",
  "video_sayisi",
  "soru_sayisi",
]);

function uretimRengi(degisken_id: string): "yesil" | "turuncu" {
  return YESIL_IDLERI.has(degisken_id) ? "yesil" : "turuncu";
}

const RENK_SINIFLARI: Record<"yesil" | "turuncu", { kenar: string; aktif: string }> = {
  yesil: {
    kenar: "border-l-4 border-l-green-500",
    aktif: "bg-green-500 text-white border-green-500 border-l-4 border-l-green-500",
  },
  turuncu: {
    kenar: "border-l-4 border-l-orange-500",
    aktif: "bg-orange-500 text-white border-orange-500 border-l-4 border-l-orange-500",
  },
};

export default function UretimKart({ degiskenler, secili, onSecimDegisti }: Props) {
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
        Üretim Analizi
      </h2>
      <div className="flex flex-wrap gap-2">
        {degiskenler.map((d) => {
          const aktif = secili.includes(d.degisken_id);
          const renk = uretimRengi(d.degisken_id);
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
    </section>
  );
}