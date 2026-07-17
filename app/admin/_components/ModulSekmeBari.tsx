// app/admin/_components/ModulSekmeBari.tsx
//
// M2 — Firma bağlamı modül sekmeleri (plan B.2): Kullanıcılar | Yapı |
// T-Club | C-Club | E-Club | Eczanem. Tanımlar MODUL_SEKMELERI tek
// kaynağından gelir (firma admini görünürlüğü de oradan yönetilecek — K-A1).
// Aktif sekme bordo alt çizgi (K-A3 görsel dili).

"use client";

import { MODUL_SEKMELERI, ModulSekmeId, RENK_BORDO, RENK_CIZGI } from "../_constants";

interface ModulSekmeBariProps {
  seciliSekme: ModulSekmeId;
  setSeciliSekme: (v: ModulSekmeId) => void;
  // Modül kapalıysa sekme soluk gösterilir (erişim engellenmez — kart
  // içinde durum + aç/kapa sunulur).
  kapaliModuller?: ModulSekmeId[];
}

export default function ModulSekmeBari(p: ModulSekmeBariProps) {
  return (
    <div style={{ display: "flex", gap: "2px", marginBottom: "20px", borderBottom: `0.5px solid ${RENK_CIZGI}` }}>
      {MODUL_SEKMELERI.map((s) => {
        const aktif = p.seciliSekme === s.id;
        const kapali = p.kapaliModuller?.includes(s.id) ?? false;
        return (
          <button
            key={s.id}
            onClick={() => p.setSeciliSekme(s.id)}
            style={{
              padding: "10px 16px",
              background: "transparent",
              border: "none",
              borderBottom: aktif ? `2px solid ${RENK_BORDO}` : "2px solid transparent",
              color: aktif ? RENK_BORDO : kapali ? "#b3b3b3" : "#737373",
              fontSize: "13px",
              fontWeight: aktif ? 700 : 600,
              cursor: "pointer",
              fontFamily: "'Nunito', sans-serif",
              transition: "border-color 0.15s",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {s.etiket}
            {kapali && (
              <span
                title="Modül bu firmada kapalı"
                style={{ width: 6, height: 6, borderRadius: "50%", background: "#d1d5db", display: "inline-block" }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
