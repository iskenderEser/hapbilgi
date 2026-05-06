// app/raporlar/yonetici/_components/TakimListesi.tsx
// takimListesi puana göre DESC sıralı olmalı — ortalama çizgisi buna bağlı

import { puanRengi, barGenislik, formatPuan, GRI_METIN, GRI_ZEMIN } from '@/lib/utils/raporUtils';

interface TakimItem {
  takim_id: string;
  takim_adi: string;
  tm: string;
  puan: number;
  katki_yuzdesi: number;
}

interface Props {
  takimListesi: TakimItem[];
  toplamPuan: number;
  ortalamaPuan: number;
  toplamTakim: number;
}

export default function TakimListesi({ takimListesi, toplamPuan, ortalamaPuan, toplamTakim }: Props) {
  const maxTakimPuan = Math.max(...takimListesi.map(t => t.puan), 1);

  return (
    <div className="border rounded-xl p-4" style={{ borderColor: '#e5e7eb' }}>
      <div className="text-sm font-medium mb-3" style={{ color: '#111827' }}>
        Toplam: {formatPuan(toplamPuan)} · Ortalama: {formatPuan(ortalamaPuan)}
      </div>
      {takimListesi.map((t, idx) => {
        const renk = puanRengi(t.puan, ortalamaPuan);
        const ortalamaEkle = idx > 0 &&
          takimListesi[idx - 1].puan >= ortalamaPuan &&
          t.puan < ortalamaPuan;

        return (
          <div key={t.takim_id}>
            {ortalamaEkle && (
              <div className="flex items-center gap-2 py-2 px-2.5 rounded-lg my-1" style={{ background: GRI_ZEMIN }}>
                <span className="text-sm font-medium" style={{ color: GRI_METIN, width: 96 }}>— Ortalama</span>
                <span className="text-xs" style={{ color: GRI_METIN, width: 80 }}></span>
                <div className="flex-1 h-1.5 rounded-full" style={{ background: '#e5e7eb' }}>
                  <div className="h-full rounded-full" style={{ width: `${barGenislik(ortalamaPuan, maxTakimPuan)}%`, background: '#d1d5db' }} />
                </div>
                <span className="text-sm font-medium" style={{ color: GRI_METIN, width: 56, textAlign: 'right' }}>{formatPuan(ortalamaPuan)}</span>
                <span className="text-xs" style={{ color: GRI_METIN, width: 40, textAlign: 'right' }}>%{(100 / toplamTakim).toFixed(1)}</span>
              </div>
            )}
            <div className="flex items-center gap-2 py-2" style={{ borderBottom: '0.5px solid #e5e7eb' }}>
              <span className="text-sm font-medium truncate" style={{ color: renk, width: 96 }}>{t.takim_adi}</span>
              <span className="text-xs truncate" style={{ color: GRI_METIN, width: 80 }}>{t.tm}</span>
              <div className="flex-1 h-1.5 rounded-full" style={{ background: GRI_ZEMIN }}>
                <div className="h-full rounded-full" style={{ width: `${barGenislik(t.puan, maxTakimPuan)}%`, background: renk }} />
              </div>
              <span className="text-sm font-medium" style={{ color: renk, width: 56, textAlign: 'right' }}>{formatPuan(t.puan)}</span>
              <span className="text-xs" style={{ color: renk, width: 40, textAlign: 'right' }}>%{t.katki_yuzdesi}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}