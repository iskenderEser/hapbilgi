"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DurumKodu } from "@/lib/utils/durum/mesaj";
import {
  aktifUretimDurumuCoz,
  type DurumSayimi,
} from "@/lib/utils/durum/filtre";

/**
 * Üretim listelerinde ilk dolu işi role göre açar. Otomatik seçim yalnız veri
 * ilk kez hazır olduğunda yapılır; kullanıcının sonraki seçimi korunur.
 */
export function useUretimDurumFiltresi(params: {
  rol: string | null | undefined;
  sayim: DurumSayimi;
  hazir: boolean;
}) {
  const [aktifDurum, setAktifDurum] = useState<DurumKodu | null>(null);
  const ilkSecimYapildi = useRef(false);
  const kullaniciSecti = useRef(false);

  useEffect(() => {
    if (!params.hazir || ilkSecimYapildi.current) return;
    setAktifDurum(aktifUretimDurumuCoz({
      rol: params.rol,
      sayim: params.sayim,
      mevcut: aktifDurum,
      kullaniciSecti: kullaniciSecti.current,
    }));
    ilkSecimYapildi.current = true;
  }, [params.hazir, params.rol, params.sayim, aktifDurum]);

  const durumSec = useCallback((durum: DurumKodu) => {
    kullaniciSecti.current = true;
    ilkSecimYapildi.current = true;
    setAktifDurum(durum);
  }, []);

  return { aktifDurum, durumSec };
}
