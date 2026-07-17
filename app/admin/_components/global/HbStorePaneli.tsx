// app/admin/_components/global/HbStorePaneli.tsx
//
// M2-b — HBStore yönetiminin ana panele gömülü hâli (plan A.1'deki YETİM
// sayfanın taşınması). Eski /admin/store sayfasının kabuksuz içeriği:
// auth ve hata konteyneri ana panelin işidir. Global bağlamdır (katalog
// bugün firma-bağımsız — K-A2 firma bazlılık geçişi ayrı alt-iş).

"use client";

import { useState } from "react";
import { useKategoriYonetimi } from "../../store/_hooks/useKategoriYonetimi";
import { useUrunYonetimi } from "../../store/_hooks/useUrunYonetimi";
import { useSiparisYonetimi } from "../../store/_hooks/useSiparisYonetimi";

import SekmeBari from "../../store/_components/SekmeBari";
import UrunlerSekmesi from "../../store/_components/UrunlerSekmesi";
import KategorilerSekmesi from "../../store/_components/KategorilerSekmesi";
import SiparislerSekmesi from "../../store/_components/SiparislerSekmesi";

type StoreSekme = "urunler" | "kategoriler" | "siparisler";

interface HbStorePaneliProps {
  hata: (mesaj: string, adim?: string, detay?: string) => void;
  basari: (mesaj: string) => void;
}

export default function HbStorePaneli({ hata, basari }: HbStorePaneliProps) {
  const [aktifSekme, setAktifSekme] = useState<StoreSekme>("urunler");

  const kategori = useKategoriYonetimi({ hata, basari });
  const urun = useUrunYonetimi({ hata, basari });
  const siparis = useSiparisYonetimi({ hata, basari });

  return (
    <div>
      <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#111", marginBottom: "16px" }}>
        HBStore Yönetimi <span style={{ fontSize: "12px", fontWeight: 600, color: "#737373" }}>(global — tüm firmalar)</span>
      </h2>
      <SekmeBari aktifSekme={aktifSekme} setAktifSekme={setAktifSekme} />

      {aktifSekme === "urunler" && <UrunlerSekmesi {...urun} hata={hata} basari={basari} />}
      {aktifSekme === "kategoriler" && <KategorilerSekmesi {...kategori} hata={hata} basari={basari} />}
      {aktifSekme === "siparisler" && <SiparislerSekmesi {...siparis} hata={hata} basari={basari} />}
    </div>
  );
}
