// app/raporlar/pm/_components/UttIzlemeDurumu.tsx

import { formatPuan, BORDO, KOYU_METIN, GRI_METIN, GRI_ZEMIN } from '@/lib/utils/raporUtils';

interface UttIzleme {
  kullanici_id: string;
  ad: string;
  soyad: string;
  izlenen: number;
  toplam: number;
  kalan: number;
  puan: number;
  durum: string;
}

interface Props {
  uttListesi: UttIzleme[];
  toplamUtt: number;
  toplamYayin: number;
}

export default function UttIzlemeDurumu({ uttListesi, toplamUtt, toplamYayin }: Props) {
  return (
    <div className="border rounded-xl p-4" style={{ borderColor: '#e5e7eb' }}>
      <div className="text-sm font-medium mb-3" style={{ color: KOYU_METIN }}>
        {toplamUtt} UTT · {toplamYayin} yayında video
      </div>
      {uttListesi.map(u => {
        const barW = u.toplam > 0 ? (u.izlenen / u.toplam) * 100 : 0;
        const pill = u.durum === 'Hiç izlememiş'
          ? { bg: '#FCEBEB', renk: '#A32D2D', text: 'Hiç izlememiş' }
          : u.durum === 'Devam Ediyor'
            ? { bg: '#FAEEDA', renk: '#854F0B', text: `${u.kalan} kaldı` }
            : { bg: '#EAF3DE', renk: '#3B6D11', text: 'Tamamlandı' };

        return (
          <div key={u.kullanici_id} className="flex items-center gap-3 py-2" style={{ borderBottom: '0.5px solid #e5e7eb' }}>
            <span className="text-sm font-medium" style={{ color: KOYU_METIN, width: 112 }}>{u.ad} {u.soyad}</span>
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-1" style={{ color: GRI_METIN }}>
                <span>{u.izlenen} / {u.toplam}</span>
                <span>{formatPuan(u.puan)} puan</span>
              </div>
              <div className="h-1.5 rounded-full" style={{ background: GRI_ZEMIN }}>
                <div className="h-full rounded-full" style={{ width: `${barW}%`, background: BORDO }} />
              </div>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap"
              style={{ background: pill.bg, color: pill.renk }}>
              {pill.text}
            </span>
          </div>
        );
      })}
    </div>
  );
}