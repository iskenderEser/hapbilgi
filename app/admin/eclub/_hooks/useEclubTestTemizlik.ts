"use client";

import { useCallback, useState } from "react";

export interface TestTemizlikOnizleme {
  test_master_sayisi: number;
  eczane_sayisi: number;
  firma_bagi_sayisi: number;
  kisi_bagi_sayisi: number;
  silinecek_kisi_sayisi: number;
  korunacak_kisi_sayisi: number;
  eclub_oneri_sayisi: number;
  eclub_izleme_sayisi: number;
  eclub_puan_kaydi_sayisi: number;
  eclub_siparis_sayisi: number;
  eczanem_musteri_bagi_sayisi: number;
  silinecek_musteri_sayisi: number;
  korunacak_musteri_sayisi: number;
  eczanem_gonderim_sayisi: number;
  eczanem_izleme_sayisi: number;
  eczanem_siparis_sayisi: number;
  auth_hesabi_sayisi: number;
}

interface Args {
  hata: (mesaj: string, adim?: string, detay?: string) => void;
  basari: (mesaj: string) => void;
}

export function useEclubTestTemizlik({ hata, basari }: Args) {
  const [onizleme, setOnizleme] = useState<TestTemizlikOnizleme | null>(null);
  const [loading, setLoading] = useState(false);

  const onizlemeCek = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    try {
      const res = await fetch("/admin/api/eclub/test-temizlik");
      const d = await res.json();
      if (!res.ok) { hata(d.hata ?? "Test temizliği önizlenemedi.", d.adim, d.detay); return false; }
      setOnizleme(d.onizleme ?? null);
      return true;
    } catch (err) {
      hata("Test temizliği önizlenirken hata oluştu.", "testTemizlikOnizleme", err instanceof Error ? err.message : undefined);
      return false;
    } finally {
      setLoading(false);
    }
  }, [hata]);

  const temizle = useCallback(async (onay: string): Promise<boolean> => {
    setLoading(true);
    try {
      const res = await fetch("/admin/api/eclub/test-temizlik", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onay }),
      });
      const d = await res.json();
      if (!res.ok) { hata(d.hata ?? "Test verileri temizlenemedi.", d.adim, d.detay); return false; }
      if ((d.auth_silinemeyen ?? []).length > 0) hata(d.mesaj, "Auth hesap temizliği", JSON.stringify(d.auth_silinemeyen));
      else basari(d.mesaj ?? "Test verileri temizlendi.");
      setOnizleme(null);
      return true;
    } catch (err) {
      hata("Test verileri temizlenirken hata oluştu.", "testTemizle", err instanceof Error ? err.message : undefined);
      return false;
    } finally {
      setLoading(false);
    }
  }, [hata, basari]);

  return { onizleme, loading, onizlemeCek, temizle, onizlemeKapat: () => setOnizleme(null) };
}
