// app/admin/store/_components/SekmeBari.tsx
//
// HBStore admin panel sekme bar'ı: Ürünler / Kategoriler / Siparişler arası geçiş.
"use client";

import { SadeKontrolButonu, SadeKontrolGrubu } from "@/components/kontrol/SadeKontroller";

import type { Sekme } from "../_types";
interface SekmeBariProps {
  aktifSekme: Sekme;
  setAktifSekme: (v: Sekme) => void;
}
const SEKMELER: { id: Sekme; etiket: string }[] = [
  { id: "urunler", etiket: "Ürünler" },
  { id: "kategoriler", etiket: "Kategoriler" },
  { id: "siparisler", etiket: "Siparişler" },
];
export default function SekmeBari({ aktifSekme, setAktifSekme }: SekmeBariProps) {
  return (
    <SadeKontrolGrubu tur="sekme">
      {SEKMELER.map(s => (
        <SadeKontrolButonu key={s.id} onClick={() => setAktifSekme(s.id)} aria-pressed={aktifSekme === s.id}>
          {s.etiket}
        </SadeKontrolButonu>
      ))}
    </SadeKontrolGrubu>
  );
}