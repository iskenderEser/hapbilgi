'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Rapor önbelleğinden ayrı, oturum firmasının güncel modül durumu. */
export function useRaporModulDurumu(endpoint: string, kullaniciId: string | undefined, sorguAnahtari: string) {
  const [durum, setDurum] = useState<{ kullaniciId: string; acik: boolean | null; hata: string | null } | null>(null);
  const istek = useRef<AbortController | null>(null);
  const yenile = useCallback(async () => {
    if (!kullaniciId) return;
    istek.current?.abort();
    const controller = new AbortController(); istek.current = controller;
    try {
      const r = await fetch(`${endpoint}?modul=1`, { signal: controller.signal, cache: 'no-store' });
      const json = await r.json();
      if (!r.ok || !json.success || typeof json.eclub_acik !== 'boolean') throw new Error(json.error ?? 'E-Club modül durumu alınamadı.');
      if (!controller.signal.aborted) setDurum({ kullaniciId, acik: json.eclub_acik, hata: null });
    } catch (error) {
      if (!controller.signal.aborted) setDurum({ kullaniciId, acik: null, hata: error instanceof Error ? error.message : 'E-Club modül durumu alınamadı.' });
    }
  }, [endpoint, kullaniciId]);
  useEffect(() => {
    void yenile();
    const odak = () => { void yenile(); };
    const gorunur = () => { if (document.visibilityState === 'visible') odak(); };
    window.addEventListener('focus', odak);
    document.addEventListener('visibilitychange', gorunur);
    return () => { istek.current?.abort(); window.removeEventListener('focus', odak); document.removeEventListener('visibilitychange', gorunur); };
  }, [yenile, sorguAnahtari]);
  return { eclubAcik: durum?.kullaniciId === kullaniciId ? durum?.acik ?? null : null, hata: durum?.kullaniciId === kullaniciId ? durum?.hata ?? null : null, yenile };
}
