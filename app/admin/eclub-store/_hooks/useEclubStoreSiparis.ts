// app/admin/eclub-store/_hooks/useEclubStoreSiparis.ts
"use client";

import { useState, useEffect } from "react";
import type { EclubStoreAdminSiparis } from "@/lib/eclub/store/eclubStoreTipler";

interface Props {
  hata: (mesaj: string, adim?: string, detay?: string) => void;
  basari: (mesaj: string) => void;
}

export function useEclubStoreSiparis({ hata, basari }: Props) {
  const [siparisler, setSiparisler] = useState<EclubStoreAdminSiparis[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [durumFiltre, setDurumFiltre] = useState<string>("");
  const [seciliSiparis, setSeciliSiparis] = useState<EclubStoreAdminSiparis | null>(null);
  const [islemLoading, setIslemLoading] = useState(false);

  const siparisleriYukle = async (durum?: string) => {
    setYukleniyor(true);
    const url = durum ? `/admin/eclub-store/api/siparis?durum=${durum}` : "/admin/eclub-store/api/siparis";
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) hata(data.hata ?? "Siparişler yüklenemedi.", data.adim, data.detay);
    else setSiparisler(data.siparisler ?? []);
    setYukleniyor(false);
  };

  useEffect(() => { siparisleriYukle(durumFiltre || undefined); /* eslint-disable-next-line */ }, [durumFiltre]);

  const durumGuncelle = async (siparis_id: string, durum: string, kargo?: { firma: string; takip: string }) => {
    setIslemLoading(true);
    const body: Record<string, unknown> = { siparis_id, action: "durum", durum };
    if (durum === "kargoda" && kargo) { body.kargo_firmasi = kargo.firma; body.kargo_takip_no = kargo.takip; }
    const res = await fetch("/admin/eclub-store/api/siparis", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const data = await res.json();
    setIslemLoading(false);
    if (!res.ok) { hata(data.hata ?? "Durum güncellenemedi.", data.adim, data.detay); return false; }
    basari(data.mesaj ?? "Durum güncellendi.");
    setSeciliSiparis(null);
    siparisleriYukle(durumFiltre || undefined);
    return true;
  };

  const siparisIptal = async (siparis_id: string, sebep: string) => {
    setIslemLoading(true);
    const res = await fetch("/admin/eclub-store/api/siparis", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siparis_id, action: "iptal", sebep }),
    });
    const data = await res.json();
    setIslemLoading(false);
    if (!res.ok) { hata(data.hata ?? "Sipariş iptal edilemedi.", data.adim, data.detay); return false; }
    basari(data.mesaj ?? "Sipariş iptal edildi.");
    setSeciliSiparis(null);
    siparisleriYukle(durumFiltre || undefined);
    return true;
  };

  return {
    siparisler, yukleniyor, siparisleriYukle,
    durumFiltre, setDurumFiltre,
    seciliSiparis, setSeciliSiparis,
    islemLoading, durumGuncelle, siparisIptal,
  };
}