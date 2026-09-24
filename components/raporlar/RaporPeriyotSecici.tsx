"use client";

import { PeriyotButonlari } from "@/components/ui/periyot-butonlari";
import { PERIYOTLAR, type Periyot } from "@/lib/utils/raporUtils";

export default function RaporPeriyotSecici({
  deger,
  onDegistir,
}: {
  deger: Periyot;
  onDegistir: (deger: Periyot) => void;
}) {
  return <PeriyotButonlari secenekler={PERIYOTLAR} deger={deger} onDegistir={onDegistir} />;
}
