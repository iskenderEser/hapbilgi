// app/(panel)/raporlar/uretim/_hooks/useUretimRaporu.ts
import { useCallback, useEffect, useState } from 'react';
import {
  getUretimRaporuOnbellek,
  setUretimRaporuOnbellek,
  type RaporData,
} from './uretimRaporuOnbellek';

interface UseUretimRaporuSonuc {
  data: RaporData | null;
  loading: boolean;
  yenileniyor: boolean;
  error: string | null;
  yenile: () => void;
}

export function useUretimRaporu(
  periyot: string,
  kullaniciId: string | undefined
): UseUretimRaporuSonuc {
  const baslangicVeri = getUretimRaporuOnbellek(periyot);
  const [data, setData] = useState<RaporData | null>(() => baslangicVeri);
  const [loading, setLoading] = useState(() => !baslangicVeri);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [yenileTetik, setYenileTetik] = useState(0);

  const yenile = useCallback(() => setYenileTetik((deger) => deger + 1), []);

  // Periyot değiştiğinde önbellekteki veriyi anında ekrana bas
  useEffect(() => {
    const onbellek = getUretimRaporuOnbellek(periyot);
    if (onbellek) {
      setData(onbellek);
      setLoading(false);
    }
  }, [periyot]);

  useEffect(() => {
    if (!kullaniciId) return;

    const controller = new AbortController();

    const fetchRapor = async () => {
      const onbellek = getUretimRaporuOnbellek(periyot);
      if (!onbellek) {
        setLoading(true);
      } else {
        setYenileniyor(true);
      }
      setError(null);

      try {
        const res = await fetch(`/raporlar/api/uretim?periyot=${periyot}`, {
          signal: controller.signal,
        });
        const json = await res.json();
        if (json.success && json.data) {
          const rapor = json.data as RaporData;
          setUretimRaporuOnbellek(periyot, rapor);
          setData(rapor);
          setError(null);
        } else if (!onbellek) {
          setError(json.error || 'Veri alınamadı');
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (!onbellek) setError('Bağlantı hatası');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setYenileniyor(false);
        }
      }
    };

    void fetchRapor();

    return () => {
      controller.abort();
    };
  }, [periyot, kullaniciId, yenileTetik]);

  return {
    data,
    loading,
    yenileniyor,
    error,
    yenile,
  };
}
