// app/admin/_hooks/useUrunTeknik.ts
//
// Ürün & Teknik sekmesinin state + handler'ları. useAdminPanel shell'den
// seciliFirma, takimlar, hata, basari prop'larını alır.
// seciliFirma değişince urun/teknik listeleri yeniden fetch edilir, form sıfırlanır.

"use client";

import { useState, useEffect, useCallback } from "react";
import type { Firma, Takim, Urun, Teknik } from "../_types";

interface UseUrunTeknikProps {
  seciliFirma: Firma | null;
  takimlar: Takim[];
  hata: (mesaj: string, adim?: string, detay?: string) => void;
  basari: (mesaj: string) => void;
}

export function useUrunTeknik({ seciliFirma, takimlar, hata, basari }: UseUrunTeknikProps) {
  const [urunler, setUrunler] = useState<Urun[]>([]);
  const [teknikler, setTeknikler] = useState<Teknik[]>([]);
  const [yeniUrunAdi, setYeniUrunAdi] = useState("");
  const [yeniUrunTakimId, setYeniUrunTakimId] = useState("");
  const [yeniTeknikAdi, setYeniTeknikAdi] = useState("");
  const [urunEkleLoading, setUrunEkleLoading] = useState(false);
  const [teknikEkleLoading, setTeknikEkleLoading] = useState(false);
  const [urunSilLoading, setUrunSilLoading] = useState<string | null>(null);
  const [teknikSilLoading, setTeknikSilLoading] = useState<string | null>(null);

  const urunleriCek = useCallback(async (firma_id: string) => {
    const res = await fetch(`/admin/api/firmalar/${firma_id}/urunler`);
    const data = await res.json();
    if (!res.ok) { hata(data.hata ?? "Ürünler yüklenemedi.", data.adim, data.detay); }
    else { setUrunler(data.urunler ?? []); }
  }, [hata]);

  const teknikleriCek = useCallback(async (firma_id: string) => {
    const res = await fetch(`/admin/api/firmalar/${firma_id}/teknikler`);
    const data = await res.json();
    if (!res.ok) { hata(data.hata ?? "Teknikler yüklenemedi.", data.adim, data.detay); }
    else { setTeknikler(data.teknikler ?? []); }
  }, [hata]);

  // seciliFirma değişince listeleri yeniden çek, form alanlarını sıfırla
  useEffect(() => {
    setYeniUrunAdi("");
    setYeniUrunTakimId("");
    setYeniTeknikAdi("");
    if (seciliFirma) {
      urunleriCek(seciliFirma.firma_id);
      teknikleriCek(seciliFirma.firma_id);
    } else {
      setUrunler([]);
      setTeknikler([]);
    }
  }, [seciliFirma?.firma_id, urunleriCek, teknikleriCek]);

  const handleUrunEkle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seciliFirma || !yeniUrunAdi.trim() || !yeniUrunTakimId) return;
    setUrunEkleLoading(true);
    const res = await fetch(`/admin/api/firmalar/${seciliFirma.firma_id}/urunler`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urun_adi: yeniUrunAdi.trim(), takim_id: yeniUrunTakimId }),
    });
    const data = await res.json();
    if (!res.ok) { hata(data.hata ?? "Ürün eklenemedi.", data.adim, data.detay); }
    else { basari("Ürün eklendi."); setYeniUrunAdi(""); urunleriCek(seciliFirma.firma_id); }
    setUrunEkleLoading(false);
  };

  const handleTeknikEkle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seciliFirma || !yeniTeknikAdi.trim()) return;
    setTeknikEkleLoading(true);
    const res = await fetch(`/admin/api/firmalar/${seciliFirma.firma_id}/teknikler`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teknik_adi: yeniTeknikAdi.trim() }),
    });
    const data = await res.json();
    if (!res.ok) { hata(data.hata ?? "Teknik eklenemedi.", data.adim, data.detay); }
    else { basari("Teknik eklendi."); setYeniTeknikAdi(""); teknikleriCek(seciliFirma.firma_id); }
    setTeknikEkleLoading(false);
  };

  const handleUrunSil = async (urun_id: string) => {
    if (!seciliFirma) return;
    setUrunSilLoading(urun_id);
    const res = await fetch(`/admin/api/firmalar/${seciliFirma.firma_id}/urunler`, {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urun_id }),
    });
    const data = await res.json();
    if (!res.ok) { hata(data.hata ?? "Ürün silinemedi.", data.adim, data.detay); }
    else { basari("Ürün silindi."); urunleriCek(seciliFirma.firma_id); }
    setUrunSilLoading(null);
  };

  const handleTeknikSil = async (teknik_id: string) => {
    if (!seciliFirma) return;
    setTeknikSilLoading(teknik_id);
    const res = await fetch(`/admin/api/firmalar/${seciliFirma.firma_id}/teknikler`, {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teknik_id }),
    });
    const data = await res.json();
    if (!res.ok) { hata(data.hata ?? "Teknik silinemedi.", data.adim, data.detay); }
    else { basari("Teknik silindi."); teknikleriCek(seciliFirma.firma_id); }
    setTeknikSilLoading(null);
  };

  // Bir ürünün takım adını döndürür (UI'da göstermek için)
  const takimAdi = (takim_id: string) => takimlar.find(t => t.takim_id === takim_id)?.takim_adi ?? "-";

  return {
    urunler,
    teknikler,
    yeniUrunAdi,
    setYeniUrunAdi,
    yeniUrunTakimId,
    setYeniUrunTakimId,
    yeniTeknikAdi,
    setYeniTeknikAdi,
    urunEkleLoading,
    teknikEkleLoading,
    urunSilLoading,
    teknikSilLoading,
    handleUrunEkle,
    handleTeknikEkle,
    handleUrunSil,
    handleTeknikSil,
    takimAdi,
  };
}