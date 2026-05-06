// app/raporlar/bm/_components/UttListesi.tsx
// uttListesi puana göre DESC sıralı olmalı — ortalama çizgisi buna bağlı

import { puanRengi, barGenislik, formatPuan, BORDO, GRI_METIN, GRI_ZEMIN } from '@/lib/utils/raporUtils';

interface UttItem {
  kullanici_id: string;
  ad: string;
  soyad: string;
  puan: number;
}

interface Props {
  uttListesi: UttItem[];
  toplamPuan: number;
  ortalamaPuan: number;
  toplamUtt: number;
}

export default function UttListesi({ uttListesi, toplamPuan, ortalamaPuan, toplamUtt }: Props) {
  const maxUttPuan = Math.max(...uttListesi.map(u => u.puan), 1);

  return (
    <div className="border rounded-xl p-4" style={{ borderColor: '#e5e7eb' }}>
      <div className="text-sm font-medium mb-3" style={{ color: '#111827' }}>
        Toplam: {formatPuan(toplamPuan)} · Ortalama: {formatPuan(ortalamaPuan)}
      </div>
      {uttListesi.map((u, idx) => {
        const renk = puanRengi(u.puan, ortalamaPuan);
        const pct = toplamPuan > 0
          ? ((u.puan / toplamPuan) * 100).toFixed(1)
          : '0.0';
        const ortalamaEkle = idx > 0 &&
          uttListesi[idx - 1].puan >= ortalamaPuan &&
          u.puan < ortalamaPuan;

        return (
          <div key={u.kullanici_id}>
            {ortalamaEkle && (
              <div className="flex items-center gap-2 py-2 px-2.5 rounded-lg my-1" style={{ background: GRI_ZEMIN }}>
                <span className="text-sm font-medium w-24" style={{ color: GRI_METIN }}>— Ortalama</span>
                <div className="flex-1 h-1.5 rounded-full" style={{ background: '#e5e7eb' }}>
                  <div className="h-full rounded-full" style={{ width: `${barGenislik(ortalamaPuan, maxUttPuan)}%`, background: '#d1d5db' }} />
                </div>
                <span className="text-sm font-medium w-14 text-right" style={{ color: GRI_METIN }}>{formatPuan(ortalamaPuan)}</span>
                <span className="text-xs w-10 text-right" style={{ color: GRI_METIN }}>%{(100 / toplamUtt).toFixed(1)}</span>
              </div>
            )}
            <div className="flex items-center gap-2 py-2" style={{ borderBottom: '0.5px solid #e5e7eb' }}>
              <span className="text-sm font-medium w-24 truncate" style={{ color: renk }}>{u.ad} {u.soyad}</span>
              <div className="flex-1 h-1.5 rounded-full" style={{ background: GRI_ZEMIN }}>
                <div className="h-full rounded-full" style={{ width: `${barGenislik(u.puan, maxUttPuan)}%`, background: renk }} />
              </div>
              <span className="text-sm font-medium w-14 text-right" style={{ color: renk }}>{formatPuan(u.puan)}</span>
              <span className="text-xs w-10 text-right" style={{ color: renk }}>%{pct}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}