// app/admin/_components/AdminUstBar.tsx
//
// M2 — Yönetim kabuğunun üst barı (K-A3: login neslinden görsel dil).
// Sol: başlık. Sağ: GLOBAL bölümler (GLOBAL_BOLUMLER tek kaynağından —
// firma bağlamından bağımsız işler), test aracı, kullanıcı + çıkış.
// Global bölümler ileride firma adminine kapalıdır (firmaAdminGorur, K-A1).

"use client";

import { GLOBAL_BOLUMLER, GlobalBolumId, RENK_BORDO, RENK_GRI } from "../_constants";

interface AdminUstBarProps {
  kullaniciAd: string;
  globalBolum: GlobalBolumId | null;
  setGlobalBolum: (v: GlobalBolumId | null) => void;
  onTestSil: () => void;
  onCikis: () => void;
}

export default function AdminUstBar(p: AdminUstBarProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 24px",
        background: RENK_GRI,
        fontFamily: "'Nunito', sans-serif",
      }}
    >
      <button
        onClick={() => p.setGlobalBolum(null)}
        title="Firma görünümüne dön"
        style={{
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span style={{ fontSize: "17px", fontWeight: 800, color: "white", letterSpacing: "0.2px" }}>
          HapBilgi Yönetim
        </span>
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {GLOBAL_BOLUMLER.map((b) => {
          const aktif = p.globalBolum === b.id;
          return (
            <button
              key={b.id}
              onClick={() => p.setGlobalBolum(aktif ? null : b.id)}
              style={{
                padding: "6px 12px",
                background: aktif ? "white" : "rgba(255,255,255,0.10)",
                border: "1px solid rgba(255,255,255,0.25)",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: aktif ? 700 : 600,
                color: aktif ? RENK_BORDO : "white",
                cursor: "pointer",
                fontFamily: "'Nunito', sans-serif",
              }}
            >
              {b.etiket}
            </button>
          );
        })}

        <button
          onClick={p.onTestSil}
          style={{
            padding: "6px 12px",
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.35)",
            borderRadius: "8px",
            fontSize: "12px",
            fontWeight: 600,
            color: "#fecaca",
            cursor: "pointer",
            fontFamily: "'Nunito', sans-serif",
            marginLeft: "8px",
          }}
        >
          Test Verilerini Sil
        </button>

        <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.85)", marginLeft: "8px" }}>
          {p.kullaniciAd}
        </span>
        <button
          onClick={p.onCikis}
          style={{
            padding: "6px 14px",
            background: RENK_BORDO,
            border: "none",
            borderRadius: "8px",
            fontSize: "12px",
            fontWeight: 700,
            color: "white",
            cursor: "pointer",
            fontFamily: "'Nunito', sans-serif",
          }}
        >
          Çıkış
        </button>
      </div>
    </div>
  );
}
