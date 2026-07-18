// app/admin/_components/ModulSekmeBari.tsx
//
// M2 — Firma bağlamı sekmeleri, İKİ GRUP halinde (İskender kararı):
//   [Firma: Kullanıcılar | Organizasyon | Ürün & Teknik] ‖ [Modüller: T-Club | ...]
// Takım/bölge ve ürün/teknik firmanın kuruluş tanımlarıdır, modül değildir —
// gruplama bu hiyerarşiyi ekranda okunur kılar. Tanımlar MODUL_SEKMELERI
// tek kaynağından (firma admini görünürlüğü de oradan yönetilecek — K-A1).

"use client";

import { MODUL_SEKMELERI, ModulSekme, ModulSekmeId, RENK_BORDO, RENK_CIZGI } from "../_constants";

interface ModulSekmeBariProps {
  seciliSekme: ModulSekmeId;
  setSeciliSekme: (v: ModulSekmeId) => void;
  // Modül kapalıysa sekme soluk gösterilir (erişim engellenmez — kart
  // içinde durum + aç/kapa sunulur).
  kapaliModuller?: ModulSekmeId[];
}

export default function ModulSekmeBari(p: ModulSekmeBariProps) {
  const firmaSekmeleri = MODUL_SEKMELERI.filter((s) => s.grup === "firma");
  const modulSekmeleri = MODUL_SEKMELERI.filter((s) => s.grup === "modul");

  const sekmeButonu = (s: ModulSekme) => {
    const aktif = p.seciliSekme === s.id;
    const kapali = p.kapaliModuller?.includes(s.id) ?? false;
    return (
      <button
        key={s.id}
        onClick={() => p.setSeciliSekme(s.id)}
        style={{
          padding: "8px 14px",
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
  };

  const grupEtiketi = (metin: string) => (
    <span
      style={{
        fontSize: "10px",
        fontWeight: 700,
        letterSpacing: "0.8px",
        textTransform: "uppercase",
        color: "#b3b3b3",
        margin: "0 2px 4px 14px",
        fontFamily: "'Nunito', sans-serif",
      }}
    >
      {metin}
    </span>
  );

  return (
    <div style={{ marginBottom: "20px", borderBottom: `0.5px solid ${RENK_CIZGI}` }}>
      <div style={{ display: "flex", alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {grupEtiketi("Firma")}
          <div style={{ display: "flex", gap: "2px" }}>{firmaSekmeleri.map(sekmeButonu)}</div>
        </div>

        <div
          style={{
            width: "1px",
            alignSelf: "stretch",
            background: RENK_CIZGI,
            margin: "6px 14px 8px 14px",
          }}
        />

        <div style={{ display: "flex", flexDirection: "column" }}>
          {grupEtiketi("Modüller")}
          <div style={{ display: "flex", gap: "2px" }}>{modulSekmeleri.map(sekmeButonu)}</div>
        </div>
      </div>
    </div>
  );
}
