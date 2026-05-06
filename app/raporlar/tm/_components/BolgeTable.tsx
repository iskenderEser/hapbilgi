// app/raporlar/tm/_components/BolgeTable.tsx
// bolgeListesi puana göre DESC sıralı olmalı — ortalama çizgisi buna bağlı

import React from 'react';
import { puanRengi, formatPuan, KIRMIZI, GRI_METIN, GRI_ZEMIN } from '@/lib/utils/raporUtils';

interface BolgeItem {
  bolge_id: string;
  bolge_adi: string;
  bm: string;
  puan: number;
  video_puani: number;
  soru_puani: number;
  oneri_puani: number;
  extra_puan: number;
  kayiplar: number;
  bekleyen_oneri: number;
}

interface OrtalamaBolge {
  video_puani: number;
  soru_puani: number;
  oneri_puani: number;
  extra_puan: number;
  kayiplar: number;
}

interface Props {
  bolgeListesi: BolgeItem[];
  ortalamaBolge: OrtalamaBolge;
  ortalamaPuan: number;
}

export default function BolgeTable({ bolgeListesi, ortalamaBolge, ortalamaPuan }: Props) {
  return (
    <div className="border rounded-xl overflow-x-auto" style={{ borderColor: '#e5e7eb' }}>
      <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
        <thead>
          <tr style={{ borderBottom: '0.5px solid #e5e7eb' }}>
            {['Bölge', 'BM', 'Video', 'Soru', 'Öneri', 'Extra', 'Kayıplar', 'Öneri durumu'].map(h => (
              <th key={h} className="text-left px-2 py-2" style={{ fontSize: 11, fontWeight: 500, color: GRI_METIN }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bolgeListesi.map((b, idx) => {
            const renk = puanRengi(b.puan, ortalamaPuan);
            const ortalamaEkle = idx > 0 &&
              bolgeListesi[idx - 1].puan >= ortalamaPuan &&
              b.puan < ortalamaPuan;

            return (
              <React.Fragment key={b.bolge_id}>
                {ortalamaEkle && (
                  <tr style={{ background: GRI_ZEMIN }}>
                    <td className="px-2 py-2" style={{ color: GRI_METIN, fontWeight: 500 }}>Ortalama</td>
                    <td className="px-2 py-2" style={{ color: GRI_METIN }}>—</td>
                    <td className="px-2 py-2" style={{ color: GRI_METIN }}>{formatPuan(ortalamaBolge.video_puani)}</td>
                    <td className="px-2 py-2" style={{ color: GRI_METIN }}>{formatPuan(ortalamaBolge.soru_puani)}</td>
                    <td className="px-2 py-2" style={{ color: GRI_METIN }}>{formatPuan(ortalamaBolge.oneri_puani)}</td>
                    <td className="px-2 py-2" style={{ color: GRI_METIN }}>{formatPuan(ortalamaBolge.extra_puan)}</td>
                    <td className="px-2 py-2" style={{ color: GRI_METIN }}>— {formatPuan(ortalamaBolge.kayiplar)}</td>
                    <td className="px-2 py-2" style={{ color: GRI_METIN }}>—</td>
                  </tr>
                )}
                <tr style={{ borderBottom: '0.5px solid #e5e7eb' }}>
                  <td className="px-2 py-2 font-medium" style={{ color: renk }}>{b.bolge_adi}</td>
                  <td className="px-2 py-2" style={{ color: GRI_METIN, fontSize: 12 }}>{b.bm}</td>
                  <td className="px-2 py-2" style={{ color: renk }}>{formatPuan(b.video_puani)}</td>
                  <td className="px-2 py-2" style={{ color: renk }}>{formatPuan(b.soru_puani)}</td>
                  <td className="px-2 py-2" style={{ color: renk }}>{formatPuan(b.oneri_puani)}</td>
                  <td className="px-2 py-2" style={{ color: renk }}>{formatPuan(b.extra_puan)}</td>
                  <td className="px-2 py-2" style={{ color: b.kayiplar > 0 ? KIRMIZI : GRI_METIN }}>
                    {b.kayiplar > 0 ? `− ${Math.abs(b.kayiplar).toLocaleString('tr-TR')}` : '—'}
                  </td>
                  <td className="px-2 py-2">
                    {b.bekleyen_oneri > 0 ? (
                      <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: '#FAEEDA', color: '#854F0B' }}>{b.bekleyen_oneri} bekliyor</span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: '#EAF3DE', color: '#3B6D11' }}>Tamamlandı</span>
                    )}
                  </td>
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}