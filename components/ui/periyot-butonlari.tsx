"use client";

import { SadeKapsulFiltre } from "@/components/kontrol/SadeKontroller";

export interface PeriyotSecenegi<T extends string> {
  key: T;
  label: string;
}

/** Eski kullanım sözleşmesini koruyarak standart kapsüle bağlar. */
export function PeriyotButonlari<T extends string>({ secenekler, deger, onDegistir, ariaLabel = "Rapor dönemi", className = "" }: {
  secenekler: readonly PeriyotSecenegi<T>[];
  deger: T;
  onDegistir: (deger: T) => void;
  ariaLabel?: string;
  className?: string;
}) {
  return <SadeKapsulFiltre secenekler={secenekler.map((s) => ({ deger: s.key, etiket: s.label }))} deger={deger} onDegistir={onDegistir} etiket={ariaLabel} className={className} />;
}
