// app/talepler/_components/KategoriSecici.tsx
//
// Kategori seçimi için tek dropdown.
// Kategori listesi boşsa hiç render edilmez (return null) — parent'ın bilmesine gerek yok.
// Form-seviyesi zorunluluk validasyonu useTalepFormu içinde.

"use client";

import type { Kategori } from "../_types";

interface KategoriSeciciProps {
  kategoriler: Kategori[];
  secili: string;
  onChange: (id: string) => void;
}

export function KategoriSecici({ kategoriler, secili, onChange }: KategoriSeciciProps) {
  // Kategori yoksa bileşen hiç görünmez — parent koşullu sarmalama yapmasın.
  if (kategoriler.length === 0) return null;

  return (
    <div>
      <label className="text-xs text-gray-500 block mb-1">Kategori</label>
      <select
        value={secili}
        onChange={(e) => onChange(e.target.value)}
        required
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white cursor-pointer box-border"
        style={{ fontFamily: "'Nunito', sans-serif", color: secili ? "#111" : "#9ca3af" }}
      >
        <option value="" disabled>Kategori seçin...</option>
        {kategoriler.map((k) => (
          <option key={k.kategori_id} value={k.kategori_id}>{k.kategori_adi}</option>
        ))}
      </select>
    </div>
  );
}