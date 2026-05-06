// app/raporlar/tm/_components/BolgeListesi.tsx
// bolgeListesi puana göre DESC sıralı olmalı — ortalama çizgisi buna bağlı

import { puanRengi, barGenislik, formatPuan, GRI_METIN, GRI_ZEMIN } from '@/lib/utils/raporUtils';

interface BolgeItem {
  bolge_id: string;
  bolge_adi: string;
  bm: string;
  puan: number;
  katki_yuzdesi: number;
}

interface Props {
  bolgeListesi: BolgeItem[];
  toplamPuan: number;
  ortalamaPuan: number;
  toplamBolge: number;
}

export default function BolgeListesi({ bolgeListesi, toplamPuan, ortalamaPuan, toplamBolge }: Props) {
  const maxBolgePuan = Math.max(...bolgeListesi.map(b => b.puan), 1);

  return (
    <div className="border rounded-xl p-4" style={{ borderColor: '#e5e7eb' }}>
      <div className="text-sm font-medium mb-3" style={{ color: '#111827' }}>
        Toplam: {formatPuan(toplamPuan)} · Ortalama: {formatPuan(ortalamaPuan)}
      </div>
      {bolgeListesi.map((b, idx) => {
        const renk = puanRengi(b.puan, ortalamaPuan);
        const ortalamaEkle = idx > 0 &&
          bolgeListesi[idx - 1].puan >= ortalamaPuan &&
          b.puan < ortalamaPuan;

        return (
          <div key={b.bolge_id}>
            {ortalamaEkle && (
              <div className="flex items-center gap-2 py-2 px-2.5 rounded-lg my-1" style={{ background: GRI_ZEMIN }}>
                <span className="text-sm font-medium w-24" style={{ color: GRI_METIN }}>— Ortalama</span>
                <span className="text-xs w-20" style={{ color: GRI_METIN }}></span>
                <div className="flex-1 h-1.5 rounded-full" style={{ background: '#e5e7eb' }}>
                  <div className="h-full rounded-full" style={{ width: `${barGenislik(ortalamaPuan, maxBolgePuan)}%`, background: '#d1d5db' }} />
                </div>
                <span className="text-sm font-medium w-16 text-right" style={{ color: GRI_METIN }}>{formatPuan(ortalamaPuan)}</span>
                <span className="text-xs w-10 text-right" style={{ color: GRI_METIN }}>%{(100 / toplamBolge).toFixed(1)}</span>
              </div>
            )}
            <div className="flex items-center gap-2 py-2" style={{ borderBottom: '0.5px solid #e5e7eb' }}>
              <span className="text-sm font-medium w-24 truncate" style={{ color: renk }}>{b.bolge_adi}</span>
              <span className="text-xs w-20 truncate" style={{ color: GRI_METIN }}>{b.bm}</span>
              <div className="flex-1 h-1.5 rounded-full" style={{ background: GRI_ZEMIN }}>
                <div className="h-full rounded-full" style={{ width: `${barGenislik(b.puan, maxBolgePuan)}%`, background: renk }} />
              </div>
              <span className="text-sm font-medium w-16 text-right" style={{ color: renk }}>{formatPuan(b.puan)}</span>
              <span className="text-xs w-10 text-right" style={{ color: renk }}>%{b.katki_yuzdesi}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}