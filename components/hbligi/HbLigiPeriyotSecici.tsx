"use client";

import { PeriyotButonlari } from "@/components/ui/periyot-butonlari";

import { PERIYOTLAR } from "@/lib/utils/raporUtils";

export type Periyot = "ay" | "donem" | "yil" | "hafta";
// Etiketler ortak kaynaktan; lig API'sinin mevcut değerleri korunur.
const LIG_DEGERLERI = { bu_hafta: "hafta", bu_ay: "ay", bu_donem: "donem", bu_yil: "yil" } as const;
const SECENEKLER = PERIYOTLAR.map((s) => ({ key: LIG_DEGERLERI[s.key], label: s.label }));

export default function HbLigiPeriyotSecici({
  periyot,
  onPeriyotChange,
}: {
  periyot: Periyot;
  onPeriyotChange: (periyot: Periyot) => void;
}) {
  return <PeriyotButonlari secenekler={SECENEKLER} deger={periyot} onDegistir={onPeriyotChange} ariaLabel="Lig dönemi" className="hb-ligi-periyot-secici" />;
}
