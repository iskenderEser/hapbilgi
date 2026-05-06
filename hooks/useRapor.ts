// hooks/useRapor.ts
import { useEffect, useState } from 'react';

interface UseRaporSonuc<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useRapor<T>(
  endpoint: string,
  periyot: string,
  kullaniciId: string | undefined
): UseRaporSonuc<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!kullaniciId) return;

    const controller = new AbortController();

    const fetchRapor = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = `${endpoint}?periyot=${periyot}`;
        const res = await fetch(url, { signal: controller.signal });
        const json = await res.json();
        if (json.success) setData(json.data);
        else setError(json.error || 'Veri alınamadı');
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        setError('Bağlantı hatası');
      } finally {
        setLoading(false);
      }
    };

    fetchRapor();

    return () => controller.abort();
  }, [kullaniciId, endpoint, periyot]);

  return { data, loading, error };
}