// app/raporlar/yonetici/_components/TakimBolgeUttAkordeon.tsx
// Lazy load akordeon: takım > bölge > UTT.
// MODERN RPC aile kolonlarını okur: izlenme_sayisi, video_puani, soru_puani,
// oneri_puani, extra_puan, ileri_sarma_kaybi, yanlis_cevap_kaybi,
// oneri_kaybi, toplam_net_puan.

'use client';

import { useEffect, useState } from 'react';

interface ModernItem {
  izlenme_sayisi?: number;
  video_puani?: number;
  soru_puani?: number;
  oneri_puani?: number;
  extra_puan?: number;
  ileri_sarma_kaybi?: number;
  yanlis_cevap_kaybi?: number;
  oneri_kaybi?: number;
  toplam_net_puan?: number;
}

interface TakimItem extends ModernItem {
  takim_id: string;
  takim_adi: string;
}

interface BolgeItem extends ModernItem {
  bolge_id: string;
  bolge_adi: string;
}

interface UttItem extends ModernItem {
  kullanici_id: string;
  ad: string;
  soyad: string;
}

const hesapla = (item: ModernItem) => {
  const kazanim =
    (item.video_puani ?? 0) +
    (item.soru_puani ?? 0) +
    (item.oneri_puani ?? 0) +
    (item.extra_puan ?? 0);
  const kayip =
    (item.ileri_sarma_kaybi ?? 0) +
    (item.yanlis_cevap_kaybi ?? 0) +
    (item.oneri_kaybi ?? 0);
  const izlenme = item.izlenme_sayisi ?? 0;
  const net = item.toplam_net_puan ?? (kazanim - kayip);
  return { izlenme, kazanim, kayip, net };
};

const formatPuan = (n: number) => n.toLocaleString('tr-TR');

export default function TakimBolgeUttAkordeon() {
  const [takimlar, setTakimlar] = useState<TakimItem[] | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);

  const [acikTakimlar, setAcikTakimlar] = useState<Set<string>>(new Set());
  const [acikBolgeler, setAcikBolgeler] = useState<Set<string>>(new Set());
  const [bolgeMap, setBolgeMap] = useState<Record<string, BolgeItem[] | 'loading'>>({});
  const [uttMap, setUttMap] = useState<Record<string, UttItem[] | 'loading'>>({});

  useEffect(() => {
    (async () => {
      setYukleniyor(true);
      try {
        const res = await fetch('/raporlar/api/yonetici/akordeon?scope=firma');
        const json = await res.json();
        if (!res.ok || !json.success) {
          setHata(json.mesaj ?? 'Veri alınamadı.');
        } else {
          setTakimlar(json.data ?? []);
        }
      } catch {
        setHata('Bağlantı hatası.');
      } finally {
        setYukleniyor(false);
      }
    })();
  }, []);

  const toggleTakim = async (takim_id: string) => {
    const yeni = new Set(acikTakimlar);
    if (yeni.has(takim_id)) {
      yeni.delete(takim_id);
      setAcikTakimlar(yeni);
      return;
    }
    yeni.add(takim_id);
    setAcikTakimlar(yeni);

    if (!bolgeMap[takim_id]) {
      setBolgeMap(prev => ({ ...prev, [takim_id]: 'loading' }));
      try {
        const res = await fetch(`/raporlar/api/yonetici/akordeon?scope=takim&takim_id=${takim_id}`);
        const json = await res.json();
        setBolgeMap(prev => ({ ...prev, [takim_id]: (res.ok && json.success) ? (json.data ?? []) : [] }));
      } catch {
        setBolgeMap(prev => ({ ...prev, [takim_id]: [] }));
      }
    }
  };

  const toggleBolge = async (bolge_id: string) => {
    const yeni = new Set(acikBolgeler);
    if (yeni.has(bolge_id)) {
      yeni.delete(bolge_id);
      setAcikBolgeler(yeni);
      return;
    }
    yeni.add(bolge_id);
    setAcikBolgeler(yeni);

    if (!uttMap[bolge_id]) {
      setUttMap(prev => ({ ...prev, [bolge_id]: 'loading' }));
      try {
        const res = await fetch(`/raporlar/api/yonetici/akordeon?scope=bolge&bolge_id=${bolge_id}`);
        const json = await res.json();
        setUttMap(prev => ({ ...prev, [bolge_id]: (res.ok && json.success) ? (json.data ?? []) : [] }));
      } catch {
        setUttMap(prev => ({ ...prev, [bolge_id]: [] }));
      }
    }
  };

  if (yukleniyor) return <div className="text-sm text-gray-400 py-8 text-center">Yükleniyor...</div>;
  if (hata) return <div className="text-sm text-red-500 py-8 text-center">Hata: {hata}</div>;
  if (!takimlar || takimlar.length === 0) {
    return <div className="text-sm text-gray-400 py-8 text-center">Bu firmada takım yok.</div>;
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="grid grid-cols-12 px-3 py-2 text-xs font-medium text-gray-500"
        style={{ borderBottom: '0.5px solid #e5e7eb', background: '#f9fafb' }}>
        <div className="col-span-6">Takım / Bölge / UTT</div>
        <div className="col-span-2 text-right">İzlenme</div>
        <div className="col-span-1 text-right">Kazanım</div>
        <div className="col-span-1 text-right">Kayıp</div>
        <div className="col-span-2 text-right">Net Puan</div>
      </div>

      {takimlar.map(takim => {
        const m = hesapla(takim);
        const acik = acikTakimlar.has(takim.takim_id);
        const bolgeler = bolgeMap[takim.takim_id];
        return (
          <div key={takim.takim_id}>
            <div onClick={() => toggleTakim(takim.takim_id)}
              className="grid grid-cols-12 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50"
              style={{ borderBottom: '0.5px solid #f3f4f6' }}>
              <div className="col-span-6 flex items-center gap-2">
                <span className="text-gray-400 text-xs">{acik ? '▼' : '▶'}</span>
                <span className="font-semibold text-gray-900">{takim.takim_adi}</span>
              </div>
              <div className="col-span-2 text-right text-gray-900">{formatPuan(m.izlenme)}</div>
              <div className="col-span-1 text-right text-gray-900">{formatPuan(m.kazanim)}</div>
              <div className="col-span-1 text-right" style={{ color: '#bc2d0d' }}>{m.kayip > 0 ? `−${formatPuan(m.kayip)}` : '—'}</div>
              <div className="col-span-2 text-right font-bold text-gray-900">{formatPuan(m.net)}</div>
            </div>

            {acik && bolgeler === 'loading' && (
              <div className="px-8 py-2 text-xs text-gray-400">Bölgeler yükleniyor...</div>
            )}
            {acik && Array.isArray(bolgeler) && bolgeler.length === 0 && (
              <div className="px-8 py-2 text-xs text-gray-400">Bu takımda bölge yok.</div>
            )}
            {acik && Array.isArray(bolgeler) && bolgeler.map(bolge => {
              const bm = hesapla(bolge);
              const bolgeAcik = acikBolgeler.has(bolge.bolge_id);
              const uttler = uttMap[bolge.bolge_id];
              return (
                <div key={bolge.bolge_id}>
                  <div onClick={() => toggleBolge(bolge.bolge_id)}
                    className="grid grid-cols-12 pl-8 pr-3 py-2 text-sm cursor-pointer hover:bg-gray-50"
                    style={{ borderBottom: '0.5px solid #f3f4f6', background: '#fafafa' }}>
                    <div className="col-span-6 flex items-center gap-2">
                      <span className="text-gray-400 text-xs">{bolgeAcik ? '▼' : '▶'}</span>
                      <span className="text-gray-800">{bolge.bolge_adi}</span>
                    </div>
                    <div className="col-span-2 text-right text-gray-700">{formatPuan(bm.izlenme)}</div>
                    <div className="col-span-1 text-right text-gray-700">{formatPuan(bm.kazanim)}</div>
                    <div className="col-span-1 text-right" style={{ color: '#bc2d0d' }}>{bm.kayip > 0 ? `−${formatPuan(bm.kayip)}` : '—'}</div>
                    <div className="col-span-2 text-right font-semibold text-gray-800">{formatPuan(bm.net)}</div>
                  </div>

                  {bolgeAcik && uttler === 'loading' && (
                    <div className="pl-14 py-2 text-xs text-gray-400">UTT'ler yükleniyor...</div>
                  )}
                  {bolgeAcik && Array.isArray(uttler) && uttler.length === 0 && (
                    <div className="pl-14 py-2 text-xs text-gray-400">Bu bölgede UTT yok.</div>
                  )}
                  {bolgeAcik && Array.isArray(uttler) && uttler.map(utt => {
                    const um = hesapla(utt);
                    return (
                      <div key={utt.kullanici_id}
                        className="grid grid-cols-12 pl-14 pr-3 py-1.5 text-sm"
                        style={{ borderBottom: '0.5px solid #f3f4f6', background: '#f5f5f5' }}>
                        <div className="col-span-6 text-gray-700">{utt.ad} {utt.soyad}</div>
                        <div className="col-span-2 text-right text-gray-700">{formatPuan(um.izlenme)}</div>
                        <div className="col-span-1 text-right text-gray-700">{formatPuan(um.kazanim)}</div>
                        <div className="col-span-1 text-right" style={{ color: '#bc2d0d' }}>{um.kayip > 0 ? `−${formatPuan(um.kayip)}` : '—'}</div>
                        <div className="col-span-2 text-right font-medium text-gray-800">{formatPuan(um.net)}</div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}