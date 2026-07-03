// components/eclub/LigAkordiyon.tsx
//
// Jenerik lig akordiyon satırı — state'siz (controlled). Merkezi state sayfada tutulur.
// İç içe kullanılabilir: children yine bir LigAkordiyon olabilir (TM→BM→UTT→takım).
//
// baslik: satırın görünen içeriği (sol taraf — ad, metrikler)
// acik: açık mı (sayfa yönetir)
// onTikla: başlığa tıklanınca (sayfa açık state'ini değiştirir)
// tiklanabilir: false ise ok/tıklama yok (en dip seviye — UTT'nin kendi takımı gibi)
// children: açıkken gösterilecek içerik

"use client";

import type { ReactNode } from "react";

interface LigAkordiyonProps {
  baslik: ReactNode;
  acik: boolean;
  onTikla?: () => void;
  tiklanabilir?: boolean;
  children?: ReactNode;
  girinti?: number; // sol girinti seviyesi (px), iç içe derinlik için
}

export default function LigAkordiyon({
  baslik,
  acik,
  onTikla,
  tiklanabilir = true,
  children,
  girinti = 0,
}: LigAkordiyonProps) {
  return (
    <div>
      <div
        onClick={tiklanabilir ? onTikla : undefined}
        className={`flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 ${tiklanabilir ? "cursor-pointer hover:bg-gray-50" : ""}`}
        style={{ paddingLeft: `${12 + girinti}px`, fontFamily: "'Nunito', sans-serif" }}
      >
        {tiklanabilir && (
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"
            style={{ flexShrink: 0, transform: acik ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        )}
        {!tiklanabilir && <span style={{ width: "14px", flexShrink: 0 }} />}
        <div style={{ flex: 1, minWidth: 0 }}>{baslik}</div>
      </div>

      {acik && children && (
        <div className="bg-gray-50 border-b border-gray-100">{children}</div>
      )}
    </div>
  );
}