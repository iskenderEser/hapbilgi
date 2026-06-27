// app/admin/store/_hooks/useSiparisYonetimi.ts
//
// Sipariş sekmesi state + handler'ları:
//   - Siparişleri çekme (siparisleriYukle)
//   - Kargo / iptal modalı state (modalAcik, mod, seciliSiparis)
// Silme yok — sipariş silinmiyor, sadece iptal ediliyor.
// useStoreAdminPanel'den hata ve basari prop'larını alır.

"use client";

import { useState, useEffect } from "react";
import type { SiparisYonetimModu } from "../_components/SiparisYonetimModal";
import type { SiparisGosterim } from "../_types";

interface UseSiparisYonetimiProps {
  hata: (mesaj: string, adim?: string, detay?: string) => void;
  basari: (mesaj: string) => void;
}

export function useSiparisYonetimi({ hata, basari }: UseSiparisYonetimiProps) {
  const [siparisler, setSiparisler] = useState<SiparisGosterim[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);

  // Modal state'leri
  const [modalAcik, setModalAcik] = useState(false);
  const [mod, setMod] = useState<SiparisYonetimModu>("kargola");
  const [seciliSiparis, setSeciliSiparis] = useState<SiparisGosterim | null>(null);

  const siparisleriYukle = async () => {
    setYukleniyor(true);
    const res = await fetch("/admin/store/api/siparis");
    const data = await res.json();
    if (!res.ok) { hata(data.hata ?? "Siparişler yüklenemedi.", data.adim, data.detay); }
    else { setSiparisler(data.siparisler ?? []); }
    setYukleniyor(false);
  };

  useEffect(() => {
    siparisleriYukle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleKargola = (s: SiparisGosterim) => {
    setSeciliSiparis(s);
    setMod("kargola");
    setModalAcik(true);
  };

  const handleIptal = (s: SiparisGosterim) => {
    setSeciliSiparis(s);
    setMod("iptal");
    setModalAcik(true);
  };

  const handleModalKapat = () => {
    setModalAcik(false);
    setSeciliSiparis(null);
  };

  return {
    // Veri
    siparisler,
    yukleniyor,
    siparisleriYukle,

    // Modal state
    modalAcik,
    mod,
    seciliSiparis,
    handleKargola,
    handleIptal,
    handleModalKapat,
  };
}