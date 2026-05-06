// app/raporlar/yonetici/_components/TakimTable.tsx
// takimListesi puana göre DESC sıralı olmalı — ortalama çizgisi buna bağlı

import React from 'react';
import { puanRengi, formatPuan, KIRMIZI, GRI_METIN, GRI_ZEMIN } from '@/lib/utils/raporUtils';

interface TakimItem {
  takim_id: string;
  takim_adi: string;
  tm: string;
  puan: number;
  video_puani: number;
  cevaplama_puani: number;
  oneri_puani: number;
  extra_puan: number;
  kayiplar: number;
  izlenme_orani: number;
}

interface OrtalamaTakim {
  video_puani: number;
  cevaplama_puani: number;
  oneri_puani: number;
  extra_puan: number;
  kayiplar: number;
}

interface Props {
  takimListesi: TakimItem[];
  ortalamaTakim: OrtalamaTakim;
  ortalamaPuan: number;
}

export default function TakimTable({ takimListesi, ortalamaTakim, ortalamaPuan }: Props) {
  return (
    <div className="border rounded-xl overflow-x-auto" style={{ borderColor: '#e5e7eb' }}>
      <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
        <thead>
          <tr style={{ borderBottom: '0.5px solid #e5e7eb' }}>
            {['Takım', 'TM', 'Video', 'Soru', 'Öneri', 'Extra', 'Kayıplar', 'İzlenme'].map(h => (
              <th key={h} className="text-left px-2 py-2" style={{ fontSize: 11, fontWeight: 500, color: GRI_METIN }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {takimListesi.map((t, idx) => {
            const renk = puanRengi(t.puan, ortalamaPuan);
            const ortalamaEkle = idx > 0 &&
              takimListesi[idx - 1].puan >= ortalamaPuan &&
              t.puan < ortalamaPuan;

            return (
              <React.Fragment key={t.takim_id}>
                {ortalamaEkle && (
                  <tr style={{ background: GRI_ZEMIN }}>
                    <td className="px-2 py-2" style={{ color: GRI_METIN, fontWeight: 500 }}>Ortalama</td>
                    <td className="px-2 py-2" style={{ color: GRI_METIN }}>—</td>
                    <td className="px-2 py-2" style={{ color: GRI_METIN }}>{formatPuan(ortalamaTakim.video_puani)}</td>
                    <td className="px-2 py-2" style={{ color: GRI_METIN }}>{formatPuan(ortalamaTakim.cevaplama_puani)}</td>
                    <td className="px-2 py-2" style={{ color: GRI_METIN }}>{formatPuan(ortalamaTakim.oneri_puani)}</td>
                    <td className="px-2 py-2" style={{ color: GRI_METIN }}>{formatPuan(ortalamaTakim.extra_puan)}</td>
                    <td className="px-2 py-2" style={{ color: GRI_METIN }}>— {formatPuan(ortalamaTakim.kayiplar)}</td>
                    <td className="px-2 py-2" style={{ color: GRI_METIN }}>—</td>
                  </tr>
                )}
                <tr style={{ borderBottom: '0.5px solid #e5e7eb' }}>
                  <td className="px-2 py-2 font-medium" style={{ color: renk }}>{t.takim_adi}</td>
                  <td className="px-2 py-2" style={{ color: GRI_METIN, fontSize: 12 }}>{t.tm}</td>
                  <td className="px-2 py-2" style={{ color: renk }}>{formatPuan(t.video_puani)}</td>
                  <td className="px-2 py-2" style={{ color: renk }}>{formatPuan(t.cevaplama_puani)}</td>
                  <td className="px-2 py-2" style={{ color: renk }}>{formatPuan(t.oneri_puani)}</td>
                  <td className="px-2 py-2" style={{ color: renk }}>{formatPuan(t.extra_puan)}</td>
                  <td className="px-2 py-2" style={{ color: t.kayiplar > 0 ? KIRMIZI : GRI_METIN }}>
                    {t.kayiplar > 0 ? `− ${Math.abs(t.kayiplar).toLocaleString('tr-TR')}` : '—'}
                  </td>
                  <td className="px-2 py-2" style={{ color: renk }}>%{t.izlenme_orani}</td>
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}