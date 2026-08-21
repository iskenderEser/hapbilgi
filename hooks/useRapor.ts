// hooks/useRapor.ts
import { useCallback, useEffect, useRef, useState } from 'react';

interface UseRaporSonuc<T> {
  data: T | null;
  loading: boolean;
  yenileniyor: boolean;
  error: string | null;
  yenile: () => void;
}

export function useRapor<T>(
  endpoint: string,
  periyot: string,
  kullaniciId: string | undefined
): UseRaporSonuc<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [yenileTetik, setYenileTetik] = useState(0);
  const veriVar = useRef(false);
  const sonSorgu = useRef<string | null>(null);

  const yenile = useCallback(() => setYenileTetik((deger) => deger + 1), []);

  useEffect(() => {
    if (!kullaniciId) return;

    const controller = new AbortController();

    const fetchRapor = async () => {
      const sorguAnahtari = `${endpoint}|${periyot}|${kullaniciId}`;
      const ilkYukleme = !veriVar.current || sonSorgu.current !== sorguAnahtari;
      sonSorgu.current = sorguAnahtari;
      if (ilkYukleme) {
        setYenileniyor(false);
        setLoading(true);
        setError(null);
      } else {
        setYenileniyor(true);
      }
      try {
        const url = `${endpoint}?periyot=${periyot}`;
        const res = await fetch(url, { signal: controller.signal });
        const json = await res.json();
        if (json.success) {
          setData(json.data);
          veriVar.current = true;
          setError(null);
        } else if (ilkYukleme) {
          setError(json.error || 'Veri alınamadı');
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (ilkYukleme) setError('Bağlantı hatası');
      } finally {
        if (!controller.signal.aborted) {
          if (ilkYukleme) setLoading(false);
          else setYenileniyor(false);
        }
      }
    };

    fetchRapor();

    return () => controller.abort();
  }, [kullaniciId, endpoint, periyot, yenileTetik]);

  return { data, loading, yenileniyor, error, yenile };
}
