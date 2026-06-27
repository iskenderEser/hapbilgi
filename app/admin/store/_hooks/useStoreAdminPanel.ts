// app/admin/store/_hooks/useStoreAdminPanel.ts
//
// HBStore admin panelinin shell hook'u: auth + admin rol kontrolü, aktif sekme
// state'i, ortak hata/başarı mesaj sistemi ve çıkış handler'ı.
//
// Sekme hook'ları (useUrunYonetimi, useKategoriYonetimi, useSiparisYonetimi)
// bu hook'un döndürdüğü hata ve basari fonksiyonlarını prop olarak alır.
//
// Veri çekme bu hook'ta yok — her sekme kendi verisini kendi çeker.

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers/AuthProvider";
import { useHataMesaji } from "@/components/HataMesaji";
import type { Sekme } from "../_types";

export function useStoreAdminPanel() {
  const { kullanici, yukleniyor, cikisYap } = useAuth();
  const router = useRouter();
  const { mesajlar, hata, basari } = useHataMesaji();

  const [aktifSekme, setAktifSekme] = useState<Sekme>("urunler");

  useEffect(() => {
    if (yukleniyor) return;
    if (!kullanici) { router.replace("/login"); return; }
    if (kullanici.rol !== "admin") { router.replace("/ana-sayfa"); return; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kullanici, yukleniyor]);

  return {
    kullanici,
    yukleniyor,
    cikisYap,
    mesajlar,
    hata,
    basari,
    aktifSekme,
    setAktifSekme,
  };
}