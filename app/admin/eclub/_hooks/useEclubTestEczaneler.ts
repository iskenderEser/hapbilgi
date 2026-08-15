"use client";

import { useCallback, useEffect, useState } from "react";

export interface TestEczane {
  gln: string;
  eczane_adi: string;
  il: string;
  ilce: string | null;
  created_at: string;
  kullaniliyor_mu: boolean;
}

interface Args {
  hata: (mesaj: string, adim?: string, detay?: string) => void;
  basari: (mesaj: string) => void;
}

export function useEclubTestEczaneler({ hata, basari }: Args) {
  const [testEczaneler, setTestEczaneler] = useState<TestEczane[]>([]);
  const [loading, setLoading] = useState(true);
  const [islemLoading, setIslemLoading] = useState(false);

  const veriCek = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/admin/api/eclub/test-eczaneler");
      const d = await res.json();
      if (!res.ok) { hata(d.hata ?? "Test eczaneleri yüklenemedi.", d.adim, d.detay); return; }
      setTestEczaneler(d.test_eczaneler ?? []);
    } catch (err) {
      hata("Test eczaneleri yüklenirken hata oluştu.", "testEczaneVeriCek", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [hata]);

  useEffect(() => { void veriCek(); }, [veriCek]);

  const olustur = useCallback(async (adet: number): Promise<boolean> => {
    setIslemLoading(true);
    try {
      const res = await fetch("/admin/api/eclub/test-eczaneler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adet }),
      });
      const d = await res.json();
      if (!res.ok) { hata(d.hata ?? "Test eczaneleri oluşturulamadı.", d.adim, d.detay); return false; }
      basari(d.mesaj ?? "Test eczaneleri oluşturuldu.");
      await veriCek();
      return true;
    } catch (err) {
      hata("Test eczaneleri oluşturulurken hata oluştu.", "testEczaneOlustur", err instanceof Error ? err.message : undefined);
      return false;
    } finally {
      setIslemLoading(false);
    }
  }, [hata, basari, veriCek]);

  const kullanilmayanlariSil = useCallback(async (): Promise<boolean> => {
    setIslemLoading(true);
    try {
      const res = await fetch("/admin/api/eclub/test-eczaneler", { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) { hata(d.hata ?? "Test eczaneleri silinemedi.", d.adim, d.detay); return false; }
      basari(d.mesaj ?? "Kullanılmayan test eczaneleri silindi.");
      await veriCek();
      return true;
    } catch (err) {
      hata("Test eczaneleri silinirken hata oluştu.", "testEczaneSil", err instanceof Error ? err.message : undefined);
      return false;
    } finally {
      setIslemLoading(false);
    }
  }, [hata, basari, veriCek]);

  return { testEczaneler, loading, islemLoading, veriCek, olustur, kullanilmayanlariSil };
}
