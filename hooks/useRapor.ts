// hooks/useRapor.ts
import { useCallback, useEffect, useRef, useState } from 'react';

interface UseRaporSonuc<T> {
  data: T | null;
  loading: boolean;
  yenileniyor: boolean;
  error: string | null;
  yenile: () => void;
}

interface UseRaporAyarlari {
  onbellekSuresi?: number;
  yenileParametresi?: boolean;
  oturumOnbellegi?: boolean;
  atomikGecis?: boolean;
}

const raporOnbellegi = new Map<string, { data: unknown; zaman: number }>();
const RAPOR_OTURUM_PREFIX = 'hb_rapor_cache_';

function oturumKaydiniOku<T>(anahtar: string): { data: T; zaman: number } | null {
  if (typeof window === 'undefined') return null;
  try {
    const ham = sessionStorage.getItem(`${RAPOR_OTURUM_PREFIX}${anahtar}`);
    if (!ham) return null;
    const kayit = JSON.parse(ham) as { data?: T; zaman?: number };
    return kayit.data !== undefined && typeof kayit.zaman === 'number'
      ? { data: kayit.data, zaman: kayit.zaman }
      : null;
  } catch {
    return null;
  }
}

function oturumKaydiniYaz(anahtar: string, data: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(`${RAPOR_OTURUM_PREFIX}${anahtar}`, JSON.stringify({ data, zaman: Date.now() }));
  } catch {
    // Tarayıcı depolama kotası doluysa bellek önbelleği kullanılmaya devam eder.
  }
}

export function useRapor<T>(
  endpoint: string,
  periyot: string,
  kullaniciId: string | undefined,
  ayarlar: UseRaporAyarlari = {},
): UseRaporSonuc<T> {
  const [data, setData] = useState<T | null>(null);
  const [dataAnahtari, setDataAnahtari] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [yenileTetik, setYenileTetik] = useState(0);
  const veriVar = useRef(false);
  const sonSorgu = useRef<string | null>(null);
  const sonYenileTetik = useRef(0);
  const onbellekSuresi = ayarlar.onbellekSuresi ?? 0;
  const yenileParametresi = ayarlar.yenileParametresi ?? false;
  const oturumOnbellegi = ayarlar.oturumOnbellegi ?? false;
  const atomikGecis = ayarlar.atomikGecis ?? false;

  const yenile = useCallback(() => setYenileTetik((deger) => deger + 1), []);

  useEffect(() => {
    if (!kullaniciId) return;

    const controller = new AbortController();

    const fetchRapor = async () => {
      const sorguAnahtari = `${endpoint}|${periyot}|${kullaniciId}`;
      const manuelYenileme = yenileTetik !== sonYenileTetik.current;
      sonYenileTetik.current = yenileTetik;
      const onbellekKaydi = raporOnbellegi.get(sorguAnahtari)
        ?? (oturumOnbellegi ? oturumKaydiniOku<T>(sorguAnahtari) : null);
      if (!manuelYenileme && onbellekSuresi > 0 && onbellekKaydi && Date.now() - onbellekKaydi.zaman < onbellekSuresi) {
        setData(onbellekKaydi.data as T);
        setDataAnahtari(sorguAnahtari);
        veriVar.current = true;
        sonSorgu.current = sorguAnahtari;
        setLoading(false);
        setYenileniyor(false);
        setError(null);
        return;
      }
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
        const url = `${endpoint}?periyot=${periyot}${manuelYenileme && yenileParametresi ? '&yenile=1' : ''}`;
        const res = await fetch(url, { signal: controller.signal });
        const json = await res.json();
        if (json.success) {
          setData(json.data);
          setDataAnahtari(sorguAnahtari);
          if (onbellekSuresi > 0) {
            raporOnbellegi.set(sorguAnahtari, { data: json.data, zaman: Date.now() });
            if (oturumOnbellegi) oturumKaydiniYaz(sorguAnahtari, json.data);
          }
          veriVar.current = true;
          setError(null);
        } else if (ilkYukleme) {
          if (atomikGecis) {
            setData(null);
            setDataAnahtari(sorguAnahtari);
          }
          setError(json.error || 'Veri alınamadı');
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (ilkYukleme) {
          if (atomikGecis) {
            setData(null);
            setDataAnahtari(sorguAnahtari);
          }
          setError('Bağlantı hatası');
        }
      } finally {
        if (!controller.signal.aborted) {
          if (ilkYukleme) setLoading(false);
          else setYenileniyor(false);
        }
      }
    };

    fetchRapor();

    return () => controller.abort();
  }, [atomikGecis, kullaniciId, endpoint, onbellekSuresi, oturumOnbellegi, periyot, yenileParametresi, yenileTetik]);

  const sorguAnahtari = kullaniciId ? `${endpoint}|${periyot}|${kullaniciId}` : null;
  const atomikGecisBekliyor = atomikGecis && sorguAnahtari !== null && dataAnahtari !== sorguAnahtari;

  return {
    data: atomikGecisBekliyor ? null : data,
    loading: atomikGecisBekliyor || loading,
    yenileniyor,
    error,
    yenile,
  };
}
