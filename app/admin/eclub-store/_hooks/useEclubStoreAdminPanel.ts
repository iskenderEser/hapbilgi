// app/admin/eclub-store/_hooks/useEclubStoreAdminPanel.ts
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers/AuthProvider";
import { useHataMesaji } from "@/components/HataMesaji";
import type { EclubStoreSekme } from "../_types";

export function useEclubStoreAdminPanel() {
  const { kullanici, yukleniyor, cikisYap } = useAuth();
  const router = useRouter();
  const { mesajlar, hata, basari } = useHataMesaji();

  const [aktifSekme, setAktifSekme] = useState<EclubStoreSekme>("urunler");

  useEffect(() => {
    if (yukleniyor) return;
    if (!kullanici) { router.replace("/login"); return; }
    if (kullanici.rol !== "admin") { router.replace("/ana-sayfa"); return; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kullanici, yukleniyor]);

  return { kullanici, yukleniyor, cikisYap, mesajlar, hata, basari, aktifSekme, setAktifSekme };
}