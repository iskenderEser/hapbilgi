"use client";

import { SadeSecim } from "@/components/kontrol/SadeKontroller";

export default function TemsilciSecici({ temsilciler, deger, onDegistir, genelAdi = "Bölge Geneli", etiket = "Rapor kapsamı", aramaEtiketi = "Temsilci adıyla ara", disabled = false, adOneki = "" }: {
  temsilciler: Array<{ kullanici_id: string; ad: string; soyad: string; altBilgi?: string }>;
  genelAdi?: string; etiket?: string; aramaEtiketi?: string; disabled?: boolean; adOneki?: string;
  deger: string;
  onDegistir: (id: string) => void;
}) {
  const bmSecimi = adOneki.trim() === "BM";
  return <SadeSecim
    secenekler={[
      { deger: "", etiket: genelAdi },
      ...temsilciler.map((k) => ({ deger: k.kullanici_id, etiket: `${adOneki}${k.ad} ${k.soyad}`.trim(), altBilgi: bmSecimi ? undefined : k.altBilgi })),
    ]}
    deger={deger} onDegistir={onDegistir} etiket={etiket} aramaEtiketi={aramaEtiketi} disabled={disabled} placeholder={genelAdi}
  />;
}
