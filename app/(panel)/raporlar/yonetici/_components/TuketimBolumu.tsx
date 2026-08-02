// app/raporlar/yonetici/_components/TuketimBolumu.tsx
'use client';

import TakimBolgeUttAkordeon from './TakimBolgeUttAkordeon';

interface SayimKartlari {
  en_cok_izleyen_takim: string | null;
  en_cok_izleyen_bolge: string | null;
  en_cok_izleyen_utt: string | null;
  en_cok_extra_izlenen_video: string | null;
}

interface Props {
  sayimKartlari: SayimKartlari;
}

export default function TuketimBolumu({ sayimKartlari }: Props) {
  const kartlar = [
    { label: "En Çok İzleyen Takım", value: sayimKartlari.en_cok_izleyen_takim ?? "—", renk: "#a855f7" },
    { label: "En Çok İzleyen Bölge", value: sayimKartlari.en_cok_izleyen_bolge ?? "—", renk: "#0ea5e9" },
    { label: "En Çok İzleyen UTT", value: sayimKartlari.en_cok_izleyen_utt ?? "—", renk: "#bc2d0d" },
    { label: "En Çok Extra İzlenen Video", value: sayimKartlari.en_cok_extra_izlenen_video ?? "—", renk: "#f59e0b" },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-6 mb-5">
      <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4">Tüketim Süreci</h2>

      {/* Sayım kartları — hepsi metin değer */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
        {kartlar.map((k, idx) => (
          <div
            key={idx}
            className="bg-white border border-gray-200 rounded-xl p-3 md:p-4"
            style={{ borderLeft: `3px solid ${k.renk}` }}
          >
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{k.label}</div>
            <div className="text-base md:text-lg font-light text-gray-900 leading-tight">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Takım > Bölge > UTT akordeon */}
      <TakimBolgeUttAkordeon />
    </div>
  );
}