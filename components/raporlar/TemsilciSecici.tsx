"use client";

import { SadeKisiSecimi } from "@/components/kontrol/KisiKontroller";

export default function TemsilciSecici({ temsilciler, deger, onDegistir, genelAdi = "Tüm Temsilciler", etiket = "Temsilciler", aramaEtiketi = "Temsilci adıyla ara", disabled = false, adOneki = "" }: {
  temsilciler: Array<{ kullanici_id: string; ad: string; soyad: string; altBilgi?: string }>;
  genelAdi?: string; etiket?: string; aramaEtiketi?: string; disabled?: boolean;
  /** Eski çağrılar için korunur; isme önek eklemez. */
  adOneki?: string;
  deger: string;
  onDegistir: (id: string) => void;
}) {
  return <SadeKisiSecimi baslik={etiket} bosSecenekEtiketi={genelAdi}
    kisiler={temsilciler.map((k) => ({ deger: k.kullanici_id, adSoyad: `${k.ad} ${k.soyad}`, altBilgi: adOneki.trim() === "BM" ? undefined : k.altBilgi }))}
    deger={deger} onDegistir={onDegistir} aramaEtiketi={aramaEtiketi} disabled={disabled} />;
}
