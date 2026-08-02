// app/raporlar/yonetici/_components/UretimBolumu.tsx
'use client';

import KonuBazliTablo from './KonuBazliTablo';

interface SayimKartlari {
  urun_egitimi_sayisi: number;
  satis_teknikleri_sayisi: number;
  medikal_toplam_sayisi: number;
  ik_egitimi_sayisi: number;
}

interface KonuSatiri {
  konu_adi: string;
  icerik_turu: string;
  uretilen_video_sayisi: number;
  kendi_izleme_sayisi: number;
  oneri_sayisi: number;
  extra_izleme_sayisi: number;
  toplam_izleme_sayisi: number;
}

interface Props {
  sayimKartlari: SayimKartlari;
  konuListesi: KonuSatiri[];
}

export default function UretimBolumu({ sayimKartlari, konuListesi }: Props) {
  const kartlar = [
    { label: "Ürün Eğitim Video", value: sayimKartlari.urun_egitimi_sayisi, renk: "#16a34a" },
    { label: "Eğitim Video", value: sayimKartlari.satis_teknikleri_sayisi, renk: "#56aeff" },
    { label: "Medikal Eğitim", value: sayimKartlari.medikal_toplam_sayisi, renk: "#a855f7" },
    { label: "İK Eğitim", value: sayimKartlari.ik_egitimi_sayisi, renk: "#f59e0b" },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-6 mb-5">
      <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4">Üretim Süreci</h2>

      {/* Sayım kartları */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
        {kartlar.map((k, idx) => (
          <div
            key={idx}
            className="bg-white border border-gray-200 rounded-xl p-3 md:p-4"
            style={{ borderLeft: `3px solid ${k.renk}` }}
          >
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{k.label}</div>
            <div className="text-2xl md:text-3xl font-extrabold text-gray-900 leading-none">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Konu bazlı tablo */}
      <KonuBazliTablo konuListesi={konuListesi} />
    </div>
  );
}