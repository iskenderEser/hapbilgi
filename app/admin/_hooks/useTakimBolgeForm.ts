// app/admin/_hooks/useTakimBolgeForm.ts
//
// Takım/Bölge oluşturma sekmesinin state + handler'ları. Birden fazla takım ve
// her takımın altındaki bölgeleri toplu kaydeder. useAdminPanel shell'den
// seciliFirma, refreshTakimlar, hata, basari prop'larını alır.

"use client";

import { useState, useEffect } from "react";
import type { Firma, TakimBlok } from "../_types";

interface UseTakimBolgeFormProps {
  seciliFirma: Firma | null;
  refreshTakimlar: () => void;
  hata: (mesaj: string, adim?: string, detay?: string) => void;
  basari: (mesaj: string) => void;
}

const BASLANGIC_BLOKLAR: TakimBlok[] = [
  { id: 1, takim_adi: "", bolgeler: [""] },
  { id: 2, takim_adi: "", bolgeler: [""] },
];

export function useTakimBolgeForm({ seciliFirma, refreshTakimlar, hata, basari }: UseTakimBolgeFormProps) {
  const [bloklar, setBloklar] = useState<TakimBlok[]>(BASLANGIC_BLOKLAR);
  const [kaydetLoading, setKaydetLoading] = useState(false);

  const sifirlaForm = () => setBloklar(BASLANGIC_BLOKLAR);

  useEffect(() => {
    sifirlaForm();
  }, [seciliFirma?.firma_id]);

  const handleTakimAdiDegis = (id: number, deger: string) => {
    setBloklar(prev => prev.map(b => b.id === id ? { ...b, takim_adi: deger } : b));
  };

  const handleBolgeAdiDegis = (blok_id: number, bolgeIndex: number, deger: string) => {
    setBloklar(prev => prev.map(b => {
      if (b.id !== blok_id) return b;
      const yeniBolgeler = [...b.bolgeler];
      yeniBolgeler[bolgeIndex] = deger;
      if (bolgeIndex === yeniBolgeler.length - 1 && deger.trim().length > 0) yeniBolgeler.push("");
      return { ...b, bolgeler: yeniBolgeler };
    }));
  };

  const handleYeniBlokEkle = () => {
    const yeniId = Math.max(...bloklar.map(b => b.id)) + 1;
    setBloklar(prev => [...prev, { id: yeniId, takim_adi: "", bolgeler: [""] }]);
  };

  // YENİ: Bir takım bloğunu kaldır. En az bir blok kalır.
  const handleBlokSil = (id: number) => {
    setBloklar(prev => {
      const filtered = prev.filter(b => b.id !== id);
      if (filtered.length === 0) return [{ id: 1, takim_adi: "", bolgeler: [""] }];
      return filtered;
    });
  };

  const formGecerliMi = () => bloklar.some(b => b.takim_adi.trim().length >= 3);

  const handleKaydet = async () => {
    if (!seciliFirma) return;
    setKaydetLoading(true);
    for (const blok of bloklar) {
      if (blok.takim_adi.trim().length < 3) continue;
      const takimRes = await fetch(`/admin/api/firmalar/${seciliFirma.firma_id}/takimlar`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ takim_adi: blok.takim_adi.trim() }),
      });
      const takimData = await takimRes.json();
      if (!takimRes.ok) { hata(takimData.hata ?? `"${blok.takim_adi}" eklenemedi.`, takimData.adim, takimData.detay); continue; }
      const takim_id = takimData.takim.takim_id;
      for (const bolge_adi of blok.bolgeler.filter(b => b.trim().length > 0)) {
        const bolgeRes = await fetch(`/admin/api/firmalar/${seciliFirma.firma_id}/takimlar/${takim_id}/bolgeler`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bolge_adi: bolge_adi.trim() }),
        });
        const bolgeData = await bolgeRes.json();
        if (!bolgeRes.ok) { hata(bolgeData.hata ?? `"${bolge_adi}" bölgesi eklenemedi.`, bolgeData.adim, bolgeData.detay); }
      }
    }
    basari("Ekleme başarılı.");
    sifirlaForm();
    refreshTakimlar();
    setKaydetLoading(false);
  };

  return {
    bloklar,
    kaydetLoading,
    handleTakimAdiDegis,
    handleBolgeAdiDegis,
    handleYeniBlokEkle,
    handleBlokSil,
    handleKaydet,
    formGecerliMi,
  };
}
