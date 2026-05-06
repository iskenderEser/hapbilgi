// app/raporlar/bm/_components/UttTable.tsx
// uttListesi puana göre DESC sıralı olmalı — ortalama çizgisi buna bağlı

import React from 'react';
import { puanRengi, formatPuan, KIRMIZI, GRI_METIN, GRI_ZEMIN } from '@/lib/utils/raporUtils';

interface UttItem {
  kullanici_id: string;
  ad: string;
  soyad: string;
  puan: number;
  video_puani: number;
  soru_puani: number;
  oneri_puani: number;
  extra_puan: number;
  kayiplar: number;
  bekleyen_oneri: number;
}

interface OrtalamaUtt {
  video_puani: number;
  soru_puani: number;
  oneri_puani: number;
  extra_puan: number;
  kayiplar: number;
}

interface Props {
  uttListesi: UttItem[];
  ortalamaUtt: OrtalamaUtt;
  ortalamaPuan: number;
}

export default function UttTable({ uttListesi, ortalamaUtt, ortalamaPuan }: Props) {
  return (
    <div className="border rounded-xl overflow-x-auto" style={{ borderColor: '#e5e7eb' }}>
      <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
        <thead>
          <tr style={{ borderBottom: '0.5px solid #e5e7eb' }}>
            {['UTT', 'Video', 'Soru', 'Öneri', 'Extra', 'Kayıplar', 'Öneri durumu'].map(h => (
              <th key={h} className="text-left px-2 py-2" style={{ fontSize: 11, fontWeight: 500, color: GRI_METIN }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {uttListesi.map((u, idx) => {
            const renk = puanRengi(u.puan, ortalamaPuan);
            const ortalamaEkle = idx > 0 &&
              uttListesi[idx - 1].puan >= ortalamaPuan &&
              u.puan < ortalamaPuan;

            return (
              <React.Fragment key={u.kullanici_id}>
                {ortalamaEkle && (
                  <tr style={{ background: GRI_ZEMIN }}>
                    <td className="px-2 py-2" style={{ color: GRI_METIN, fontWeight: 500 }}>Ortalama</td>
                    <td className="px-2 py-2" style={{ color: GRI_METIN }}>{formatPuan(ortalamaUtt.video_puani)}</td>
                    <td className="px-2 py-2" style={{ color: GRI_METIN }}>{formatPuan(ortalamaUtt.soru_puani)}</td>
                    <td className="px-2 py-2" style={{ color: GRI_METIN }}>{formatPuan(ortalamaUtt.oneri_puani)}</td>
                    <td className="px-2 py-2" style={{ color: GRI_METIN }}>{formatPuan(ortalamaUtt.extra_puan)}</td>
                    <td className="px-2 py-2" style={{ color: GRI_METIN }}>— {formatPuan(ortalamaUtt.kayiplar)}</td>
                    <td className="px-2 py-2" style={{ color: GRI_METIN }}>—</td>
                  </tr>
                )}
                <tr style={{ borderBottom: '0.5px solid #e5e7eb' }}>
                  <td className="px-2 py-2 font-medium" style={{ color: renk }}>{u.ad} {u.soyad}</td>
                  <td className="px-2 py-2" style={{ color: renk }}>{formatPuan(u.video_puani)}</td>
                  <td className="px-2 py-2" style={{ color: renk }}>{formatPuan(u.soru_puani)}</td>
                  <td className="px-2 py-2" style={{ color: renk }}>{formatPuan(u.oneri_puani)}</td>
                  <td className="px-2 py-2" style={{ color: renk }}>{formatPuan(u.extra_puan)}</td>
                  <td className="px-2 py-2" style={{ color: u.kayiplar > 0 ? KIRMIZI : GRI_METIN }}>
                    {u.kayiplar > 0 ? `− ${Math.abs(u.kayiplar).toLocaleString('tr-TR')}` : '—'}
                  </td>
                  <td className="px-2 py-2">
                    {u.bekleyen_oneri > 0 ? (
                      <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: '#FAEEDA', color: '#854F0B' }}>
                        {u.bekleyen_oneri} bekliyor
                      </span>
                    ) : u.puan === 0 ? (
                      <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: GRI_ZEMIN, color: GRI_METIN }}>
                        Öneri yok
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: '#EAF3DE', color: '#3B6D11' }}>
                        Tamamlandı
                      </span>
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