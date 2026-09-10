"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  hbstoreTakvimDurumu,
  type TakvimDurumu,
} from "@/lib/tclub/store/takvim";

export interface UseHbstoreTakvimSecenekler {
  aktif?: boolean;
}

export interface UseHbstoreTakvimSonuc {
  takvim: TakvimDurumu | null;
  acik: boolean;
  yukleniyor: boolean;
  yenile: () => Promise<void>;
}

/**
 * HBStore dönemlik sipariş takvimini sunucu zamanına bağlı olarak takip eden ortak hook.
 *
 * SÖZLEŞME:
 * - Tarayıcının cihaz saatini (new Date()) açılış/kapanış kararının kaynağı olarak KULLANMAZ.
 * - Sunucunun /store/api?tip=takvim yanıtındaki simdiIso zamanı çapa (anchor) kabul edilir.
 * - Çapa sonrasında geçen süre, monotonic performance.now() ile hesaplanır; cihaz saatinin
 *   yanlış olması veya 30 saniye sonra durumu bozması engellenir.
 * - Sayfa yeniden görünür olduğunda (visibilitychange) ve açılış/kapanış sınırında
 *   sunucudan otomatik yeniden teyit alınır.
 * - Sunucu bilgisi alınana kadar mağaza kesinlikle AÇIK kabul edilmez (acik: false).
 */
export function useHbstoreTakvim({ aktif = true }: UseHbstoreTakvimSecenekler = {}): UseHbstoreTakvimSonuc {
  const [takvim, setTakvim] = useState<TakvimDurumu | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  // Sunucu zaman çapası:
  // serverMs: sunucudan dönen simdiIso zamanı (milisaniye)
  // perfMs: yanıtın alındığı andaki performance.now() değeri
  const anchorRef = useRef<{ serverMs: number; perfMs: number } | null>(null);
  const sonAcikDurumRef = useRef<boolean | null>(null);

  const sunucudanCek = useCallback(async () => {
    if (!aktif) return;
    try {
      const res = await fetch("/store/api?tip=takvim", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.takvim?.simdiIso) {
        const perfNow = typeof performance !== "undefined" ? performance.now() : 0;
        const serverMs = new Date(data.takvim.simdiIso).getTime();
        anchorRef.current = { serverMs, perfMs: perfNow };
        const guncel = hbstoreTakvimDurumu(new Date(serverMs));
        sonAcikDurumRef.current = guncel.acik;
        setTakvim(guncel);
      }
    } catch {
      // Ağ hatasında sunucu teyidi yoksa açık kabul etmez
    } finally {
      setYukleniyor(false);
    }
  }, [aktif]);

  // İlk yükleme ve sekme görünürlüğü değişimi
  useEffect(() => {
    if (!aktif) {
      setYukleniyor(false);
      return;
    }
    void sunucudanCek();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void sunucudanCek();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [aktif, sunucudanCek]);

  // performance.now() üzerinden sunucu zamanını ilerleten ve sınır geçişinde sunucudan yenileyen sayaç
  useEffect(() => {
    if (!aktif) return;

    const interval = setInterval(() => {
      const anchor = anchorRef.current;
      if (!anchor) return;

      const elapsed = (typeof performance !== "undefined" ? performance.now() : 0) - anchor.perfMs;
      const currentServerTime = new Date(anchor.serverMs + elapsed);
      const yeniDurum = hbstoreTakvimDurumu(currentServerTime);

      // Açılış / kapanış sınırı aşıldığında sunucudan taze durum al
      if (sonAcikDurumRef.current !== null && sonAcikDurumRef.current !== yeniDurum.acik) {
        sonAcikDurumRef.current = yeniDurum.acik;
        void sunucudanCek();
        return;
      }

      setTakvim(yeniDurum);
    }, 1000);

    return () => clearInterval(interval);
  }, [aktif, sunucudanCek]);

  return {
    takvim,
    acik: Boolean(takvim?.acik),
    yukleniyor,
    yenile: sunucudanCek,
  };
}
