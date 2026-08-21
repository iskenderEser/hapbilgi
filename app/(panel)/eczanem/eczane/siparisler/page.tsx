// app/(panel)/eczanem/eczane/siparisler/page.tsx
// Eczacı/teknisyen Eczanem — Sipariş Onayları (U8, İP-§8.1.4): kasada müşteri
// barkod okutup sipariş gönderdiğinde burada belirir; onayda puan atomik düşer.
"use client";

import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { EczanemEczaneSayfa } from "../_components/EczanemEczaneArayuz";
import EczanemSiparisKuyrugu from "../_components/EczanemSiparisKuyrugu";

export default function EczanemSiparislerPage() {
  const { mesajlar, hata, basari } = useHataMesaji();

  return (
    <EczanemEczaneSayfa>
      <HataMesajiContainer mesajlar={mesajlar} />
      <EczanemSiparisKuyrugu hata={hata} basari={basari} />
    </EczanemEczaneSayfa>
  );
}
