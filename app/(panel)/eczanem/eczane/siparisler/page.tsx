// app/(panel)/eczanem/eczane/siparisler/page.tsx
// Eczacı/teknisyen Eczanem — Sipariş Onayları (U8, İP-§8.1.4): kasada müşteri
// barkod okutup sipariş gönderdiğinde burada belirir; onayda puan atomik düşer.
"use client";

import { ClipboardList } from "lucide-react";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { EclubKisiSayfa, EclubKisiBaslik } from "@/components/eclub/EclubKisiSayfa";
import EczanemSiparisKuyrugu from "../_components/EczanemSiparisKuyrugu";

export default function EczanemSiparislerPage() {
  const { mesajlar, hata, basari } = useHataMesaji();

  return (
    <EclubKisiSayfa>
      <HataMesajiContainer mesajlar={mesajlar} />
      <EclubKisiBaslik
        ikon={ClipboardList}
        ustEtiket="Eczanem"
        baslik="Sipariş Onayları"
        aciklama="Müşteri kasada sipariş gönderdiğinde burada belirir. Onayladığınızda puan o anda atomik olarak düşer ve fiş kesinleşir."
      />
      <EczanemSiparisKuyrugu hata={hata} basari={basari} />
    </EclubKisiSayfa>
  );
}
