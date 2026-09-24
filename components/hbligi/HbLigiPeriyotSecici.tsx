"use client";

import { PeriyotButonlari } from "@/components/ui/periyot-butonlari";

export type Periyot = "ay" | "donem" | "yil" | "hafta";

const SECENEKLER = [
  { key: "hafta", label: "Haftalık" },
  { key: "ay", label: "Aylık" },
  { key: "donem", label: "Dönemlik" },
  { key: "yil", label: "Yıllık" },
] as const;

export default function HbLigiPeriyotSecici({
  periyot,
  onPeriyotChange,
}: {
  periyot: Periyot;
  onPeriyotChange: (periyot: Periyot) => void;
}) {
  return <PeriyotButonlari secenekler={SECENEKLER} deger={periyot} onDegistir={onPeriyotChange} ariaLabel="Lig dönemi" />;
}
