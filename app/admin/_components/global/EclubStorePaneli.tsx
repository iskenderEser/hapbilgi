// app/admin/_components/global/EclubStorePaneli.tsx
//
// E-Club hediye çeki operasyonunun ana admin paneline gömülü hâli.

"use client";

import { useEclubStoreSiparis } from "../../eclub-store/_hooks/useEclubStoreSiparis";
import EclubStoreSiparislerSekmesi from "../../eclub-store/_components/EclubStoreSiparislerSekmesi";

interface EclubStorePaneliProps {
  hata: (mesaj: string, adim?: string, detay?: string) => void;
  basari: (mesaj: string) => void;
}

export default function EclubStorePaneli({ hata, basari }: EclubStorePaneliProps) {
  const cekler = useEclubStoreSiparis({ hata, basari });

  return (
    <div>
      <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#111", marginBottom: "16px" }}>
        E-Club Hediye Çeki Yönetimi <span style={{ fontSize: "12px", fontWeight: 600, color: "#737373" }}>(global — tüm firmalar)</span>
      </h2>
      <EclubStoreSiparislerSekmesi {...cekler} />
    </div>
  );
}
