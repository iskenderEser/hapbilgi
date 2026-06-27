// app/raporlar/yonetici/_components/KonuBazliTablo.tsx
'use client';

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
  konuListesi: KonuSatiri[];
}

const ICERIK_TURU_ADLARI: Record<string, string> = {
  urun_egitimi: 'Ürün Eğitim',
  satis_teknikleri: 'Satış Teknikleri',
  medikal_egitim: 'Medikal Eğitim',
  urun_medikal_egitim: 'Ürün Medikal',
  ik_egitimi: 'İK Eğitim',
};

const ICERIK_TURU_RENKLERI: Record<string, string> = {
  urun_egitimi: '#16a34a',
  satis_teknikleri: '#56aeff',
  medikal_egitim: '#a855f7',
  urun_medikal_egitim: '#a855f7',
  ik_egitimi: '#f59e0b',
};

export default function KonuBazliTablo({ konuListesi }: Props) {
  if (konuListesi.length === 0) {
    return (
      <div className="border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-400">
        Henüz üretilmiş içerik yok.
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-x-auto">
      <table className="w-full" style={{ fontSize: 13, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '0.5px solid #e5e7eb' }}>
            <th className="text-left px-3 py-2 font-medium text-gray-500">Ürün Adı / Eğitim Adı</th>
            <th className="text-right px-3 py-2 font-medium text-gray-500">Üretilen Video</th>
            <th className="text-right px-3 py-2 font-medium text-gray-500">UTT Kendi İzleme</th>
            <th className="text-right px-3 py-2 font-medium text-gray-500">Öneri Sayısı</th>
            <th className="text-right px-3 py-2 font-medium text-gray-500">Extra İzleme</th>
            <th className="text-right px-3 py-2 font-medium text-gray-500">Toplam İzleme</th>
          </tr>
        </thead>
        <tbody>
          {konuListesi.map((satir, idx) => {
            const turRenk = ICERIK_TURU_RENKLERI[satir.icerik_turu] ?? '#9ca3af';
            const turAd = ICERIK_TURU_ADLARI[satir.icerik_turu] ?? satir.icerik_turu;
            return (
              <tr key={`${satir.konu_adi}-${idx}`} style={{ borderBottom: '0.5px solid #f3f4f6' }}>
                <td className="px-3 py-2">
                  <div className="text-sm font-medium text-gray-900">{satir.konu_adi}</div>
                  <div
                    className="inline-block text-xs px-2 py-0.5 rounded-full mt-1"
                    style={{ background: `${turRenk}20`, color: turRenk }}
                  >
                    {turAd}
                  </div>
                </td>
                <td className="px-3 py-2 text-right text-gray-900">{satir.uretilen_video_sayisi}</td>
                <td className="px-3 py-2 text-right text-gray-900">{satir.kendi_izleme_sayisi}</td>
                <td className="px-3 py-2 text-right text-gray-900">{satir.oneri_sayisi}</td>
                <td className="px-3 py-2 text-right text-gray-900">{satir.extra_izleme_sayisi}</td>
                <td className="px-3 py-2 text-right font-bold text-gray-900">{satir.toplam_izleme_sayisi}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}