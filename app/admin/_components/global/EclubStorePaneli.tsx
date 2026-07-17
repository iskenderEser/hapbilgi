// app/admin/_components/global/EclubStorePaneli.tsx
//
// M2-b — E-Club Store yönetiminin ana panele gömülü hâli (Navbar'daki
// kopuk "E-Club Store Admin" sayfasının taşınması). Kabuksuz içerik;
// global bağlam (K-A2 firma bazlılık geçişi ayrı alt-iş).

"use client";

import { useState } from "react";
import { useEclubStoreKategori } from "../../eclub-store/_hooks/useEclubStoreKategori";
import { useEclubStoreUrun } from "../../eclub-store/_hooks/useEclubStoreUrun";
import { useEclubStoreSiparis } from "../../eclub-store/_hooks/useEclubStoreSiparis";

import EclubStoreSekmeBari from "../../eclub-store/_components/EclubStoreSekmeBari";
import EclubStoreUrunlerSekmesi from "../../eclub-store/_components/EclubStoreUrunlerSekmesi";
import EclubStoreKategorilerSekmesi from "../../eclub-store/_components/EclubStoreKategorilerSekmesi";
import EclubStoreSiparislerSekmesi from "../../eclub-store/_components/EclubStoreSiparislerSekmesi";

type StoreSekme = "urunler" | "kategoriler" | "siparisler";

interface EclubStorePaneliProps {
  hata: (mesaj: string, adim?: string, detay?: string) => void;
  basari: (mesaj: string) => void;
}

export default function EclubStorePaneli({ hata, basari }: EclubStorePaneliProps) {
  const [aktifSekme, setAktifSekme] = useState<StoreSekme>("urunler");

  const kategori = useEclubStoreKategori({ hata, basari });
  const urun = useEclubStoreUrun({ hata, basari });
  const siparis = useEclubStoreSiparis({ hata, basari });

  return (
    <div>
      <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#111", marginBottom: "16px" }}>
        E-Club Store Yönetimi <span style={{ fontSize: "12px", fontWeight: 600, color: "#737373" }}>(global — tüm firmalar)</span>
      </h2>
      <EclubStoreSekmeBari aktifSekme={aktifSekme} setAktifSekme={setAktifSekme} />

      {aktifSekme === "urunler" && <EclubStoreUrunlerSekmesi {...urun} hata={hata} basari={basari} />}
      {aktifSekme === "kategoriler" && <EclubStoreKategorilerSekmesi {...kategori} hata={hata} basari={basari} />}
      {aktifSekme === "siparisler" && <EclubStoreSiparislerSekmesi {...siparis} />}
    </div>
  );
}
